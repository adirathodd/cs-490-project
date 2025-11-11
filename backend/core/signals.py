import logging
from django.dispatch import receiver
from django.contrib.auth.signals import user_logged_in, user_login_failed, user_logged_out
from django.db.models.signals import post_save
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

from core.models import UserAccount

logger = logging.getLogger(__name__)


@receiver(user_login_failed)
def log_login_failed(sender, credentials, request, **kwargs):
    """Log details when a login attempt fails (e.g., admin form)."""
    try:
        username = credentials.get('username') if isinstance(credentials, dict) else None
    except Exception:
        username = None

    remote_addr = None
    user_agent = None
    referer = None

    try:
        if request is not None:
            remote_addr = request.META.get('REMOTE_ADDR')
            # Honor X-Forwarded-For if present (docker/nginx)
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
