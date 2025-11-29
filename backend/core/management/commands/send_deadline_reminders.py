from django.core.management.base import BaseCommand
from django.utils import timezone
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from core.models import JobEntry
from datetime import timedelta

class Command(BaseCommand):
    help = 'Send reminder emails for job application deadlines approaching in N days (default 3)'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=3, help='Notify for deadlines within this many days')

    def handle(self, *args, **options):
        days = options.get('days') or 3
        # Use localdate to match test expectations and local timezone-aware dates
        now = timezone.localdate()
        # Jobs not applied yet
        base_qs = JobEntry.objects.filter(status__in=['interested', 'phone_screen', 'interview', 'offer'])
        sent_three_day = 0
        sent_day_of = 0

        # 3-day reminders (exactly 3 days away, not already sent)
        three_day_date = now + timedelta(days=3)
        three_day_qs = base_qs.filter(
            application_deadline=three_day_date,
            three_day_notice_sent_at__isnull=True,
        ).select_related('candidate__user')
        for job in three_day_qs:
            candidate = getattr(job, 'candidate', None)
            user = getattr(candidate, 'user', None)
            if not user or not user.email or not job.application_deadline:
                continue
            try:
                subject = f"3 days left: {job.title} @ {job.company_name}"
                from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com')
                frontend_base = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
                job_url = f"{frontend_base.rstrip('/')}/jobs?highlight={job.id}"
                context = {
                    'brand': 'ResumeRocket',
                    'job_title': job.title,
                    'company_name': job.company_name,
                    'deadline': job.application_deadline,
                    'job_url': job_url,
                    'urgency': 'three_day',
                }
                plain = render_to_string('emails/deadline_reminder.txt', context)
                html = render_to_string('emails/deadline_reminder.html', context)
                msg = EmailMultiAlternatives(subject, plain, from_email, [user.email])
                msg.attach_alternative(html, 'text/html')
                msg.send(fail_silently=True)
                job.three_day_notice_sent_at = timezone.now()
                job.save(update_fields=['three_day_notice_sent_at'])
                sent_three_day += 1
            except Exception:
                continue

        # Day-of reminders (deadline is today, not already sent, and still not applied)
        day_of_qs = base_qs.filter(
            application_deadline=now,
            day_of_notice_sent_at__isnull=True,
        ).select_related('candidate__user')
        for job in day_of_qs:
            candidate = getattr(job, 'candidate', None)
            user = getattr(candidate, 'user', None)
            if not user or not user.email or not job.application_deadline:
                continue
            try:
                subject = f"Today: {job.title} @ {job.company_name} deadline"
                from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com')
                frontend_base = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
                job_url = f"{frontend_base.rstrip('/')}/jobs?highlight={job.id}"
                context = {
                    'brand': 'ResumeRocket',
                    'job_title': job.title,
                    'company_name': job.company_name,
                    'deadline': job.application_deadline,
                    'job_url': job_url,
                    'urgency': 'day_of',
                }
                plain = render_to_string('emails/deadline_reminder.txt', context)
                html = render_to_string('emails/deadline_reminder.html', context)
                msg = EmailMultiAlternatives(subject, plain, from_email, [user.email])
                msg.attach_alternative(html, 'text/html')
                msg.send(fail_silently=True)
                job.day_of_notice_sent_at = timezone.now()
                job.save(update_fields=['day_of_notice_sent_at'])
                sent_day_of += 1
            except Exception:
                continue

        self.stdout.write(self.style.SUCCESS(
            f"Sent {sent_three_day} three-day reminders and {sent_day_of} day-of reminders"
        ))
