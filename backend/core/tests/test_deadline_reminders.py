import datetime
from unittest.mock import patch
from django.utils import timezone
from django.core.management import call_command
from django.contrib.auth import get_user_model
from core.models import CandidateProfile, JobEntry
import pytest
from django.conf import settings
from django.test.utils import override_settings

pytestmark = pytest.mark.django_db

def create_candidate(email="reminder_tester@example.com"):
    User = get_user_model()
    user = User.objects.create_user(username=email, email=email, password="pass1234")
    profile = CandidateProfile.objects.create(user=user)
    return user, profile

@patch("core.management.commands.send_deadline_reminders.EmailMultiAlternatives")
def test_three_day_reminder_sent(mock_email_cls):
    user, profile = create_candidate()
    three_days_out = timezone.localdate() + datetime.timedelta(days=3)
    job = JobEntry.objects.create(
        candidate=profile,
        title="Data Engineer",
        company_name="Acme Corp",
        application_deadline=three_days_out,
        status="interested",
    )
    assert job.three_day_notice_sent_at is None
    call_command("send_deadline_reminders")
    job.refresh_from_db()
    # One email should be sent
    assert mock_email_cls.call_count == 1
    # Inspect constructed message args
    args, kwargs = mock_email_cls.call_args
    subject = args[0]
    body = args[1]
    assert "3 days left" in subject
    assert "Data Engineer" in body
    # HTML alternative should attach once
    inst = mock_email_cls.return_value
    assert inst.attach_alternative.call_count == 1
    assert job.three_day_notice_sent_at is not None
    # Running again should not resend
    call_command("send_deadline_reminders")
    assert mock_email_cls.call_count == 1, "Should not resend 3-day reminder"

@patch("core.management.commands.send_deadline_reminders.EmailMultiAlternatives")
def test_day_of_reminder_sent(mock_email_cls):
    user, profile = create_candidate(email="day_of@example.com")
    today = timezone.localdate()
    job = JobEntry.objects.create(
        candidate=profile,
        title="Frontend Engineer",
        company_name="Globex",
        application_deadline=today,
        status="phone_screen",
    )
    assert job.day_of_notice_sent_at is None
    call_command("send_deadline_reminders")
    job.refresh_from_db()
    assert mock_email_cls.call_count == 1
    args, kwargs = mock_email_cls.call_args
    assert "Today:" in args[0]
    inst = mock_email_cls.return_value
    assert inst.attach_alternative.call_count == 1
    assert job.day_of_notice_sent_at is not None
    # Second run should not send again
    call_command("send_deadline_reminders")
    assert mock_email_cls.call_count == 1, "Should not resend day-of reminder"

@patch("core.management.commands.send_deadline_reminders.EmailMultiAlternatives")
def test_no_emails_for_applied_status(mock_email_cls):
    user, profile = create_candidate(email="applied_status@example.com")
    today = timezone.localdate()
    three_days_out = today + datetime.timedelta(days=3)

    JobEntry.objects.create(
        candidate=profile,
        title="AI Engineer",
        company_name="Initech",
        application_deadline=three_days_out,
        status="applied",  # Should be excluded
    )
    JobEntry.objects.create(
        candidate=profile,
        title="Backend Engineer",
        company_name="Umbrella",
        application_deadline=today,
        status="applied",  # Should be excluded
    )

    call_command("send_deadline_reminders")
    assert mock_email_cls.call_count == 0, "No emails should be sent for applied jobs"

@patch("core.management.commands.send_deadline_reminders.EmailMultiAlternatives")
def test_mixed_jobs_counts(mock_email_cls):
    user, profile = create_candidate(email="mixed_jobs@example.com")
    today = timezone.localdate()
    three_days_out = today + datetime.timedelta(days=3)

    JobEntry.objects.create(
        candidate=profile,
        title="ML Engineer",
        company_name="Stark",
        application_deadline=three_days_out,
        status="offer",  # qualifies for 3-day
    )
    JobEntry.objects.create(
        candidate=profile,
        title="QA Engineer",
        company_name="Wayne",
        application_deadline=today,
        status="interview",  # qualifies for day-of
    )
    JobEntry.objects.create(
        candidate=profile,
        title="Support Engineer",
        company_name="Wonka",
        application_deadline=three_days_out,
        status="applied",  # excluded
    )

    call_command("send_deadline_reminders")
    # Expect 2 emails: one three-day, one day-of
    assert mock_email_cls.call_count == 2
    # Validate both subjects collected
    subjects = [call.args[0] for call in mock_email_cls.call_args_list]
    assert any("3 days left" in s for s in subjects)
    assert any("Today:" in s for s in subjects)
    # Re-run should not increase count
    call_command("send_deadline_reminders")
    assert mock_email_cls.call_count == 2

@override_settings(FRONTEND_URL="https://app.example.com")
@patch("core.management.commands.send_deadline_reminders.EmailMultiAlternatives")
def test_html_contains_brand_and_link_three_day(mock_email_cls):
    user, profile = create_candidate(email="htmlcase@example.com")
    three_days_out = timezone.localdate() + datetime.timedelta(days=3)
    job = JobEntry.objects.create(
        candidate=profile,
        title="Designer",
        company_name="Pixar",
        application_deadline=three_days_out,
        status="interested",
    )
    call_command("send_deadline_reminders")
    # Check HTML content
    inst = mock_email_cls.return_value
    assert inst.attach_alternative.call_count == 1
    html_args, html_kwargs = inst.attach_alternative.call_args
    html_content = html_args[0]
    assert "ResumeRocket" in html_content
    assert f"https://app.example.com/jobs?highlight={job.id}" in html_content

@patch("core.management.commands.send_deadline_reminders.EmailMultiAlternatives")
def test_multiple_users_isolation(mock_email_cls):
    # Two different users, each receives one email
    u1, p1 = create_candidate(email="a@example.com")
    u2, p2 = create_candidate(email="b@example.com")
    three_days_out = timezone.localdate() + datetime.timedelta(days=3)
    JobEntry.objects.create(candidate=p1, title="A", company_name="X", application_deadline=three_days_out, status="interested")
    JobEntry.objects.create(candidate=p2, title="B", company_name="Y", application_deadline=three_days_out, status="offer")
    call_command("send_deadline_reminders")
    assert mock_email_cls.call_count == 2
    recipients = [call.args[3][0] for call in mock_email_cls.call_args_list]
    assert set(recipients) == {"a@example.com", "b@example.com"}

@patch("core.management.commands.send_deadline_reminders.EmailMultiAlternatives")
def test_command_stdout_counts(mock_email_cls, capsys):
    user, profile = create_candidate(email="stdout@example.com")
    three_days_out = timezone.localdate() + datetime.timedelta(days=3)
    JobEntry.objects.create(candidate=profile, title="C", company_name="Z", application_deadline=three_days_out, status="interview")
    call_command("send_deadline_reminders")
    out = capsys.readouterr().out
    assert "Sent 1 three-day reminders and 0 day-of reminders" in out

@override_settings(FRONTEND_URL="https://foo.bar")
@patch("core.management.commands.send_deadline_reminders.EmailMultiAlternatives")
def test_frontend_url_override_used(mock_email_cls):
    user, profile = create_candidate(email="fronturl@example.com")
    three_days_out = timezone.localdate() + datetime.timedelta(days=3)
    job = JobEntry.objects.create(candidate=profile, title="PM", company_name="Meta", application_deadline=three_days_out, status="interested")
    call_command("send_deadline_reminders")
    inst = mock_email_cls.return_value
    html_args, _ = inst.attach_alternative.call_args
    assert f"https://foo.bar/jobs?highlight={job.id}" in html_args[0]

@patch("core.management.commands.send_deadline_reminders.EmailMultiAlternatives")
def test_send_failure_does_not_set_timestamp(mock_email_cls):
    user, profile = create_candidate(email="fail@example.com")
    three_days_out = timezone.localdate() + datetime.timedelta(days=3)
    job = JobEntry.objects.create(candidate=profile, title="SRE", company_name="GCP", application_deadline=three_days_out, status="interested")
    inst = mock_email_cls.return_value
    inst.send.side_effect = Exception("smtp down")
    call_command("send_deadline_reminders")
    job.refresh_from_db()
    assert job.three_day_notice_sent_at is None

@patch("core.management.commands.send_deadline_reminders.EmailMultiAlternatives")
def test_rejected_status_excluded(mock_email_cls):
    user, profile = create_candidate(email="rej@example.com")
    three_days_out = timezone.localdate() + datetime.timedelta(days=3)
    JobEntry.objects.create(
        candidate=profile,
        title="Ops",
        company_name="Umbrella",
        application_deadline=three_days_out,
        status="rejected",  # excluded by base_qs
    )
    call_command("send_deadline_reminders")
    assert mock_email_cls.call_count == 0
@patch("core.management.commands.send_deadline_reminders.EmailMultiAlternatives")
def test_skips_when_no_email(mock_email_cls):
    """Job with candidate missing email should be skipped without error."""
    User = get_user_model()
    user = User.objects.create_user(username="noemail", email="", password="pass1234")
    profile = CandidateProfile.objects.create(user=user)
    job = JobEntry.objects.create(
        candidate=profile,
        title="DevOps Engineer",
        company_name="Hydra",
        application_deadline=timezone.localdate() + datetime.timedelta(days=3),
        status="interested",
    )
    call_command("send_deadline_reminders")
    job.refresh_from_db()
    assert job.three_day_notice_sent_at is None
    assert mock_email_cls.call_count == 0

@patch("core.management.commands.send_deadline_reminders.EmailMultiAlternatives")
def test_skips_when_deadline_missing(mock_email_cls):
    """Job without a deadline should not trigger reminders."""
    user, profile = create_candidate(email="nodeadline@example.com")
    JobEntry.objects.create(
        candidate=profile,
        title="Security Engineer",
        company_name="Oscorp",
        application_deadline=None,
        status="interested",
    )
    call_command("send_deadline_reminders")
    assert mock_email_cls.call_count == 0
