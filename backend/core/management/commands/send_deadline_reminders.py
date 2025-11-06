from django.core.management.base import BaseCommand
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from core.models import JobEntry, CandidateProfile
from datetime import timedelta

class Command(BaseCommand):
    help = 'Send reminder emails for job application deadlines approaching in N days (default 3)'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=3, help='Notify for deadlines within this many days')

    def handle(self, *args, **options):
        days = options.get('days') or 3
        now = timezone.now().date()
        cutoff = now + timedelta(days=days)
        qs = JobEntry.objects.filter(application_deadline__gte=now, application_deadline__lte=cutoff).select_related('candidate')
        sent = 0
        for job in qs:
            try:
                candidate = job.candidate
                if not candidate or not candidate.user or not candidate.user.email:
                    continue
                subject = f"Reminder: application deadline for {job.title} at {job.company_name}"
                days_left = (job.application_deadline - now).days
                message = f"Hi {candidate.user.first_name or ''},\n\nThis is a reminder that the application deadline for '{job.title}' at {job.company_name} is on {job.application_deadline} ({days_left} days left).\n\nGood luck!\n"
                from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com')
                send_mail(subject, message, from_email, [candidate.user.email], fail_silently=True)
                sent += 1
            except Exception:
                continue
        self.stdout.write(self.style.SUCCESS(f"Sent {sent} reminder emails (within {days} days)"))