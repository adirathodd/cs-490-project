from django.core.management.base import BaseCommand
from django.utils import timezone
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from core.models import InterviewSchedule
from datetime import timedelta

class Command(BaseCommand):
    help = 'Send reminder emails for interviews scheduled in the next 24 hours'

    def handle(self, *args, **options):
        now = timezone.now()
        # Find interviews happening in the next 24-26 hours
        # (26 hours to give a 2-hour window if the cron runs hourly)
        start_time = now + timedelta(hours=24)
        end_time = now + timedelta(hours=26)
        
        # Get scheduled or rescheduled interviews in the time window
        interviews = InterviewSchedule.objects.filter(
            scheduled_at__gte=start_time,
            scheduled_at__lt=end_time,
            status__in=['scheduled', 'rescheduled']
        ).select_related('candidate__user', 'job')
        
        sent_count = 0
        
        for interview in interviews:
            candidate = interview.candidate
            user = candidate.user if candidate else None
            
            if not user or not user.email:
                continue
                
            try:
                # Prepare email content
                subject = f"Interview Tomorrow: {interview.job.title} @ {interview.job.company_name}"
                from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com')
                frontend_base = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
                job_url = f"{frontend_base.rstrip('/')}/jobs/{interview.job.id}"
                
                # Format time nicely
                interview_time = interview.scheduled_at.strftime('%A, %B %d at %I:%M %p')
                
                context = {
                    'brand': 'ResumeRocket',
                    'interview_type': interview.get_interview_type_display(),
                    'job_title': interview.job.title,
                    'company_name': interview.job.company_name,
                    'interview_time': interview_time,
                    'duration': interview.duration_minutes,
                    'location': interview.location,
                    'meeting_link': interview.meeting_link,
                    'interviewer_name': interview.interviewer_name,
                    'preparation_notes': interview.preparation_notes,
                    'job_url': job_url,
                }
                
                plain = render_to_string('emails/interview_reminder.txt', context)
                html = render_to_string('emails/interview_reminder.html', context)
                
                msg = EmailMultiAlternatives(subject, plain, from_email, [user.email])
                msg.attach_alternative(html, 'text/html')
                msg.send(fail_silently=True)
                
                sent_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Sent reminder to {user.email} for {interview.job.title} at {interview.job.company_name}"
                    )
                )
            except Exception as e:
                self.stderr.write(
                    self.style.ERROR(
                        f"Failed to send reminder for interview {interview.id}: {str(e)}"
                    )
                )
                continue
        
        self.stdout.write(
            self.style.SUCCESS(f"Sent {sent_count} interview reminder(s)")
        )
