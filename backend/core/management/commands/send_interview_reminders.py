from collections import Counter
from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.management.base import BaseCommand
from django.template.loader import render_to_string
from django.utils import timezone

from core import interview_followup
from core.models import InterviewEvent, InterviewSchedule, Notification


class Command(BaseCommand):
    help = 'Send 24h/2h interview reminders and thank-you follow-up nudges.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print stats without sending emails or mutating records.'
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        now = timezone.now()
        stats = Counter()

        upcoming = InterviewSchedule.objects.filter(
            status__in=['scheduled', 'rescheduled'],
            scheduled_at__gte=now - timedelta(minutes=5),  # ignore long-past entries
            scheduled_at__lte=now + timedelta(hours=30),
        ).select_related('candidate__user', 'job', 'event_metadata')

        for interview in upcoming:
            event_meta = interview.ensure_event_metadata()
            if not event_meta:
                continue

            time_until = interview.scheduled_at - now
            if time_until.total_seconds() <= 0:
                continue

            # 24-hour reminder window: between 2h and 24h remaining
            if (
                not event_meta.reminder_24h_sent
                and timedelta(hours=2) < time_until <= timedelta(hours=24)
            ):
                if self._send_interview_reminder(interview, event_meta, '24h', dry_run):
                    stats['24h'] += 1

            # 2-hour reminder window: between now and 2h remaining
            if (
                not event_meta.reminder_2h_sent
                and timedelta(seconds=0) < time_until <= timedelta(hours=2)
            ):
                if self._send_interview_reminder(interview, event_meta, '2h', dry_run):
                    stats['2h'] += 1

        # Follow-up nudges happen after the scheduled time (within 36h)
        followup_events = InterviewEvent.objects.select_related(
            'interview__candidate__user', 'interview__job'
        ).filter(
            interview__scheduled_at__lte=now - timedelta(hours=2),
            interview__scheduled_at__gte=now - timedelta(days=2),
            interview__status__in=['scheduled', 'rescheduled', 'completed'],
            thank_you_note_sent=False,
            follow_up_status='pending',
        )

        for event_meta in followup_events:
            if self._send_followup_reminder(event_meta, dry_run):
                stats['followup'] += 1

        summary = (
            f"Sent 24h={stats['24h']}, 2h={stats['2h']} reminders, "
            f"follow-up nudges={stats['followup']}"
        )
        if dry_run:
            self.stdout.write(self.style.WARNING(f"[dry-run] {summary}"))
        else:
            self.stdout.write(self.style.SUCCESS(summary))

    # ------------------------------------------------------------------
    # Helper methods
    # ------------------------------------------------------------------

    def _send_interview_reminder(self, interview, event_meta, reminder_type, dry_run=False):
        candidate = interview.candidate
        user = getattr(candidate, 'user', None)
        if not user or not user.email:
            return False

        subject_prefix = 'Interview Tomorrow'
        headline = 'Interview Tomorrow'
        subtext = 'You have 24 hours to finish prep—review your checklist and materials.'
        if reminder_type == '2h':
            subject_prefix = 'Interview in 2 Hours'
            headline = 'Interview in 2 Hours'
            subtext = 'Double-check logistics, test your tech, and take a few deep breaths.'

        subject = f"{subject_prefix}: {interview.job.title} @ {interview.job.company_name}"
        context = self._build_email_context(interview)
        context.update({
            'reminder_headline': headline,
            'reminder_subtext': subtext,
            'cta_label': 'Open Interview Workspace',
            'cta_url': context['interview_url'],
        })

        plain = render_to_string('emails/interview_reminder.txt', context)
        html = render_to_string('emails/interview_reminder.html', context)

        if dry_run:
            return True

        try:
            msg = EmailMultiAlternatives(
                subject,
                plain,
                getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com'),
                [user.email],
            )
            msg.attach_alternative(html, 'text/html')
            msg.send(fail_silently=False)
        except Exception as exc:  # pragma: no cover - logged in command output
            self.stderr.write(self.style.ERROR(
                f"Failed to send {reminder_type} reminder for interview {interview.id}: {exc}"
            ))
            return False

        self._mark_reminder_sent(interview, event_meta, reminder_type)
        Notification.objects.create(
            user=user,
            title=subject_prefix,
            message=f"{subject_prefix} for {interview.job.title} at {interview.job.company_name}.",
            notification_type='interview_reminder',
            link_url=f"/interviews?highlight={interview.id}",
        )
        return True

    def _send_followup_reminder(self, event_meta, dry_run=False):
        interview = event_meta.interview
        candidate = interview.candidate
        user = getattr(candidate, 'user', None)
        if not user or not user.email:
            return False

        subject = f"Send your thank-you note: {interview.job.title} @ {interview.job.company_name}"
        conversation_points = []
        questions_to_ask = getattr(interview, 'questions_to_ask', '')
        if questions_to_ask:
            conversation_points = [line.strip() for line in questions_to_ask.splitlines() if line.strip()][:3]

        details = {
            'role': interview.job.title,
            'company': interview.job.company_name,
            'interviewer_name': interview.interviewer_name or '[Interviewer]',
            'candidate_name': f"{user.first_name} {user.last_name}".strip() or user.email,
            'interview_date': interview.scheduled_at.date().isoformat(),
            'conversation_points': conversation_points,
        }
        templates = interview_followup.run_followup_generation(
            interview_details=details,
            followup_type='thank_you',
            tone='appreciative',
        )
        template_preview = (templates.get('templates') or [{}])[0]

        context = self._build_email_context(interview)
        context.update({
            'followup_subject': template_preview.get('subject') or 'Thank you for the interview',
            'followup_body': template_preview.get('body') or 'Dear [Interviewer Name], ...',
            'cta_label': 'Generate thank-you note',
            'cta_url': f"{context['interview_url']}#follow-up",
        })

        plain = render_to_string('emails/interview_followup_reminder.txt', context)
        html = render_to_string('emails/interview_followup_reminder.html', context)

        if dry_run:
            return True

        try:
            msg = EmailMultiAlternatives(
                subject,
                plain,
                getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com'),
                [user.email],
            )
            msg.attach_alternative(html, 'text/html')
            msg.send(fail_silently=False)
        except Exception as exc:  # pragma: no cover - logged in command output
            self.stderr.write(self.style.ERROR(
                f"Failed to send follow-up reminder for interview {interview.id}: {exc}"
            ))
            return False

        event_meta.follow_up_status = 'scheduled'
        event_meta.save(update_fields=['follow_up_status', 'updated_at'])
        Notification.objects.create(
            user=user,
            title='Send your thank-you note',
            message=f"Follow up with {interview.job.company_name} while the conversation is fresh.",
            notification_type='interview_followup',
            link_url=f"/interviews?highlight={interview.id}#follow-up",
        )
        return True

    def _build_email_context(self, interview):
        frontend_base = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        local_time = timezone.localtime(interview.scheduled_at)
        return {
            'brand': 'ResumeRocket',
            'interview_type': interview.get_interview_type_display(),
            'job_title': interview.job.title,
            'company_name': interview.job.company_name,
            'interview_time': local_time.strftime('%A, %B %d at %I:%M %p %Z'),
            'duration': interview.duration_minutes,
            'location': interview.location,
            'meeting_link': interview.meeting_link,
            'interviewer_name': interview.interviewer_name,
            'preparation_notes': interview.preparation_notes,
            'job_url': f"{frontend_base}/jobs?highlight={interview.job.id}",
            'interview_url': f"{frontend_base}/interviews?highlight={interview.id}",
        }

    def _mark_reminder_sent(self, interview, event_meta, reminder_type):
        event_fields = ['updated_at']
        interview_fields = []
        if reminder_type == '24h':
            event_meta.reminder_24h_sent = True
            event_fields.append('reminder_24h_sent')
            interview.show_24h_reminder = True
            interview.reminder_24h_dismissed = False
            interview_fields.extend(['show_24h_reminder', 'reminder_24h_dismissed'])
        else:
            event_meta.reminder_2h_sent = True
            event_fields.append('reminder_2h_sent')
            interview.show_1h_reminder = True
            interview.reminder_1h_dismissed = False
            interview_fields.extend(['show_1h_reminder', 'reminder_1h_dismissed'])

        event_meta.save(update_fields=event_fields)
        if interview_fields:
            interview.save(update_fields=interview_fields + ['updated_at'])
