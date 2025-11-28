from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from core.models import CandidateProfile, InterviewSchedule, JobEntry, Notification


class SendInterviewRemindersCommandTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="candidate",
            email="candidate@example.com",
            password="pass1234",
            first_name="Case",
            last_name="Walker",
        )
        self.candidate = CandidateProfile.objects.create(user=self.user)
        self.job = JobEntry.objects.create(
            candidate=self.candidate,
            title="Software Engineer",
            company_name="Acme Corp",
        )

    def _create_interview(self, when, status="scheduled"):
        return InterviewSchedule.objects.create(
            job=self.job,
            candidate=self.candidate,
            interview_type="video",
            scheduled_at=when,
            duration_minutes=60,
            status=status,
            preparation_notes="Review the system design brief.",
            meeting_link="https://meet.example.com/abc",
            interviewer_name="Ada Recruiter",
        )

    @patch("core.management.commands.send_interview_reminders.EmailMultiAlternatives")
    def test_send_24h_reminder_sets_flags(self, mock_email):
        mock_email.return_value.send.return_value = 1
        interview = self._create_interview(timezone.now() + timedelta(hours=23, minutes=30))

        call_command("send_interview_reminders")

        interview.refresh_from_db()
        event_meta = interview.event_metadata
        self.assertTrue(event_meta.reminder_24h_sent)
        self.assertTrue(interview.show_24h_reminder)
        self.assertFalse(event_meta.reminder_2h_sent)
        self.assertEqual(Notification.objects.filter(notification_type="interview_reminder").count(), 1)
        mock_email.assert_called_once()

    @patch("core.management.commands.send_interview_reminders.EmailMultiAlternatives")
    def test_send_2h_reminder_only(self, mock_email):
        mock_email.return_value.send.return_value = 1
        interview = self._create_interview(timezone.now() + timedelta(hours=1, minutes=15))

        call_command("send_interview_reminders")

        interview.refresh_from_db()
        event_meta = interview.event_metadata
        self.assertTrue(event_meta.reminder_2h_sent)
        self.assertFalse(event_meta.reminder_24h_sent)
        self.assertTrue(interview.show_1h_reminder)
        self.assertEqual(Notification.objects.filter(notification_type="interview_reminder").count(), 1)
        mock_email.assert_called_once()

    @patch("core.management.commands.send_interview_reminders.interview_followup.run_followup_generation")
    @patch("core.management.commands.send_interview_reminders.EmailMultiAlternatives")
    def test_followup_reminder_marks_event_and_notification(self, mock_email, mock_followup):
        mock_email.return_value.send.return_value = 1
        mock_followup.return_value = {
            "templates": [
                {
                    "subject": "Thank you for the interview",
                    "body": "Dear interviewer, thank you...",
                }
            ]
        }
        interview = self._create_interview(
            timezone.now() - timedelta(hours=4),
            status="completed",
        )
        interview.ensure_event_metadata()

        call_command("send_interview_reminders")

        interview.refresh_from_db()
        event_meta = interview.event_metadata
        self.assertEqual(event_meta.follow_up_status, "scheduled")
        self.assertEqual(
            Notification.objects.filter(notification_type="interview_followup").count(),
            1,
        )
        mock_email.assert_called_once()
        mock_followup.assert_called_once()
