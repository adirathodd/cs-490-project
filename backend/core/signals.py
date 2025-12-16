import logging
import os
import requests
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.signals import user_logged_in, user_login_failed, user_logged_out
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils import timezone

from core.models import JobEntry, JobStatusChange, UserAccount
from core.utils.cache_utils import bump_jobs_cache_version

logger = logging.getLogger(__name__)


@receiver(user_login_failed)
def log_login_failed(sender, credentials, request, **kwargs):
    """Log details when a login attempt fails (e.g., admin form)."""
    try:
        username = None
        if isinstance(credentials, dict):
            username = credentials.get('username') or credentials.get('email')

        remote_addr = None
        user_agent = None
        referer = None
        if request is not None:
            try:
                remote_addr = request.META.get('REMOTE_ADDR')
                xff = request.META.get('HTTP_X_FORWARDED_FOR')
                if xff:
                    remote_addr = xff.split(',')[0].strip()
                user_agent = request.META.get('HTTP_USER_AGENT')
                referer = request.META.get('HTTP_REFERER')
            except Exception:
                pass

        logger.warning(
            "AUTH login_failed username=%s ip=%s ua=%s referer=%s",
            username, remote_addr, user_agent, referer
        )
    except Exception:
        # Never break auth flow on logging
        pass


@receiver(user_logged_in)
def log_user_logged_in(sender, request, user, **kwargs):
    """Log successful logins (including admin)."""
    remote_addr = None
    try:
        if request is not None:
            remote_addr = request.META.get('REMOTE_ADDR')
            xff = request.META.get('HTTP_X_FORWARDED_FOR')
            if xff:
                remote_addr = xff.split(',')[0].strip()
    except Exception:
        pass

    logger.info(
        "AUTH login_success user_id=%s username=%s staff=%s superuser=%s ip=%s",
        getattr(user, 'id', None), getattr(user, 'username', None), getattr(user, 'is_staff', None), getattr(user, 'is_superuser', None), remote_addr
    )


@receiver(user_logged_out)
def log_user_logged_out(sender, request, user, **kwargs):
    """Log logouts to complete the auth trail."""
    remote_addr = None
    try:
        if request is not None:
            remote_addr = request.META.get('REMOTE_ADDR')
            xff = request.META.get('HTTP_X_FORWARDED_FOR')
            if xff:
                remote_addr = xff.split(',')[0].strip()
    except Exception:
        pass

    logger.info(
        "AUTH logout user_id=%s username=%s ip=%s",
        getattr(user, 'id', None), getattr(user, 'username', None), remote_addr
    )


@receiver(post_save, sender=get_user_model())
def ensure_useraccount_exists(sender, instance, created, **kwargs):
    """Ensure a UserAccount record exists for every Django User."""
    try:
        if created:
            # Create linked UserAccount with normalized email
            UserAccount.objects.get_or_create(user=instance, defaults={'email': (getattr(instance, 'email', '') or '').lower()})
        else:
            # Keep email in sync (lowercased)
            acc = getattr(instance, 'account', None)
            if acc and acc.email != (instance.email or '').lower():
                acc.email = (instance.email or '').lower()
                acc.save(update_fields=['email'])
    except Exception:
        # Avoid breaking auth flows due to side-effect errors
        pass


@receiver(post_save, sender='core.InterviewSchedule')
def send_interview_reminder_email(sender, instance, created, **kwargs):
    """Send immediate email reminder if interview is scheduled within 24 hours."""
    from core.models import InterviewSchedule
    from django.core.mail import EmailMultiAlternatives
    from django.template.loader import render_to_string
    from django.conf import settings
    
    # Only for newly created interviews that are scheduled/rescheduled
    if not created or instance.status not in ['scheduled', 'rescheduled']:
        return
    
    try:
        now = timezone.now()
        time_until_interview = instance.scheduled_at - now
        
        # Only send if interview is less than 24 hours away
        if time_until_interview > timedelta(hours=24):
            return
        
        # Don't send if interview is in the past
        if time_until_interview < timedelta(0):
            return
        
        candidate = instance.candidate
        user = candidate.user if candidate else None
        
        if not user or not user.email:
            return
        
        # Prepare email content
        subject = f"Interview Scheduled: {instance.job.title} @ {instance.job.company_name}"
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com')
        frontend_base = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        job_url = f"{frontend_base.rstrip('/')}/jobs/{instance.job.id}"
        
        # Format time nicely
        interview_time = instance.scheduled_at.strftime('%A, %B %d at %I:%M %p')
        
        context = {
            'brand': 'ResumeRocket',
            'interview_type': instance.get_interview_type_display(),
            'job_title': instance.job.title,
            'company_name': instance.job.company_name,
            'interview_time': interview_time,
            'duration': instance.duration_minutes,
            'location': instance.location,
            'meeting_link': instance.meeting_link,
            'interviewer_name': instance.interviewer_name,
            'preparation_notes': instance.preparation_notes,
            'job_url': job_url,
            'urgent': True,  # Flag to show this is urgent
        }
        
        plain = render_to_string('emails/interview_reminder.txt', context)
        html = render_to_string('emails/interview_reminder.html', context)
        
        msg = EmailMultiAlternatives(subject, plain, from_email, [user.email])
        msg.attach_alternative(html, 'text/html')
        msg.send(fail_silently=True)
        
        logger.info(
            f"Sent immediate interview reminder to {user.email} for interview {instance.id} "
            f"scheduled in {time_until_interview.total_seconds() / 3600:.1f} hours"
        )
    except Exception as e:
        logger.error(f"Failed to send immediate interview reminder for interview {instance.id}: {str(e)}")
        # Don't raise - we don't want to break interview creation


@receiver(post_save, sender=JobEntry)
def geocode_job_location(sender, instance: JobEntry, created: bool, **kwargs):
    """Best-effort geocode when a job's location is present but coordinates are missing.

    This persists lat/lon so map rendering is fast and deterministic.
    Lightweight and resilient: timeouts are short, failures are ignored.
    """
    try:
        city = (getattr(instance, 'location', '') or '').strip()
        if not city:
            return
        # Prevent recursion when we save updated coords below
        if getattr(instance, '_skip_geocode', False):
            return

        base = os.environ.get('NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org')
        ua = os.environ.get('NOMINATIM_USER_AGENT', 'cs-490-project/1.0 (signals)')
        headers = {'User-Agent': ua}
        try:
            resp = requests.get(
                f"{base}/search",
                params={'q': city, 'format': 'json', 'limit': '1'},
                headers=headers,
                timeout=6,
            )
            resp.raise_for_status()
            data = resp.json() or []
            if data:
                lat = float(data[0].get('lat'))
                lon = float(data[0].get('lon'))
            else:
                lat = lon = None
        except Exception:
            lat = lon = None

        if lat is not None and lon is not None:
            from django.utils import timezone
            # If values are unchanged (e.g., location string edits that resolve to same coords), avoid extra save
            cur_lat = getattr(instance, 'location_lat', None)
            cur_lon = getattr(instance, 'location_lon', None)
            if cur_lat is not None and cur_lon is not None:
                try:
                    if abs(cur_lat - lat) < 1e-5 and abs(cur_lon - lon) < 1e-5:
                        return
                except Exception:
                    pass
            instance.location_lat = lat
            instance.location_lon = lon
            # If we matched a house/place, mark as address; else city
            try:
                precision = 'city'
                if 'data' in locals() and data:
                    cls = data[0].get('class')
                    typ = data[0].get('type')
                    if cls == 'place' and typ == 'house':
                        precision = 'address'
                instance.location_geo_precision = precision
            except Exception:
                instance.location_geo_precision = 'city'
            instance.location_geo_updated_at = timezone.now()
            # Save only geo fields to avoid recursion issues; second post_save will be a quick no-op
            try:
                instance._skip_geocode = True
                instance.save(update_fields=['location_lat', 'location_lon', 'location_geo_precision', 'location_geo_updated_at'])
            except Exception:
                pass
    except Exception:
        # Never raise from signal
        pass


@receiver([post_save, post_delete], sender=JobEntry)
def invalidate_jobentry_cache(sender, instance: JobEntry, **kwargs):
    """Invalidate cached job lists/stats when a job changes."""
    try:
        candidate_id = getattr(instance, 'candidate_id', None)
        if candidate_id:
            bump_jobs_cache_version(candidate_id)
    except Exception:
        pass


@receiver([post_save, post_delete], sender=JobStatusChange)
def invalidate_jobstatuschange_cache(sender, instance: JobStatusChange, **kwargs):
    """Invalidate cached job stats when a status change is recorded."""
    try:
        job = getattr(instance, 'job', None)
        candidate_id = getattr(job, 'candidate_id', None)
        if candidate_id:
            bump_jobs_cache_version(candidate_id)
    except Exception:
        pass
