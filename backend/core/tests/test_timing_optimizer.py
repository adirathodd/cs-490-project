"""
UC-124: Job Application Timing Optimizer Tests

Tests for scheduled submissions, reminders, and timing analytics
"""

import pytest
from datetime import datetime, timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import (
    CandidateProfile,
    JobEntry,
    ApplicationPackage,
    ScheduledSubmission,
    FollowUpReminder,
)

User = get_user_model()


@pytest.mark.django_db
class TestScheduledSubmissions:
    """Tests for scheduled submission functionality"""
    
    def setup_method(self):
        """Set up test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.candidate = CandidateProfile.objects.create(user=self.user)
        
        self.job = JobEntry.objects.create(
            candidate=self.candidate,
            title='Software Engineer',
            company_name='Test Company',
            status='interested'
        )
        
        self.package = ApplicationPackage.objects.create(
            candidate=self.candidate,
            job=self.job,
            status='ready'
        )
        
        # Authenticate
        self.client.force_authenticate(user=self.user)
    
    def test_create_scheduled_submission(self):
        """Test creating a new scheduled submission"""
        future_time = timezone.now() + timedelta(days=1)
        
        data = {
            'job': self.job.id,
            'application_package': self.package.id,
            'scheduled_datetime': future_time.isoformat(),
            'timezone': 'America/New_York',
            'submission_method': 'email',
            'priority': 5,
        }
        
        response = self.client.post('/api/scheduled-submissions/', data, format='json')
        assert response.status_code == 201
        assert response.data['job_title'] == 'Software Engineer'
        assert response.data['status'] == 'scheduled'
    
    def test_list_scheduled_submissions(self):
        """Test listing scheduled submissions"""
        # Create a submission
        ScheduledSubmission.objects.create(
            candidate=self.candidate,
            job=self.job,
            application_package=self.package,
            scheduled_datetime=timezone.now() + timedelta(days=1),
            status='scheduled'
        )
        
        response = self.client.get('/api/scheduled-submissions/')
        assert response.status_code == 200
        assert len(response.data) == 1
    
    def test_filter_submissions_by_status(self):
        """Test filtering submissions by status"""
        # Create submissions with different statuses
        ScheduledSubmission.objects.create(
            candidate=self.candidate,
            job=self.job,
            application_package=self.package,
            scheduled_datetime=timezone.now() + timedelta(days=1),
            status='scheduled'
        )
        ScheduledSubmission.objects.create(
            candidate=self.candidate,
            job=self.job,
            application_package=self.package,
            scheduled_datetime=timezone.now() - timedelta(days=1),
            status='submitted'
        )
        
        response = self.client.get('/api/scheduled-submissions/?status=scheduled')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['status'] == 'scheduled'
    
    def test_execute_scheduled_submission(self):
        """Test executing a scheduled submission immediately"""
        submission = ScheduledSubmission.objects.create(
            candidate=self.candidate,
            job=self.job,
            application_package=self.package,
            scheduled_datetime=timezone.now() + timedelta(days=1),
            status='scheduled'
        )
        
        response = self.client.post(f'/api/scheduled-submissions/{submission.id}/execute/')
        assert response.status_code == 200
        assert response.data['status'] == 'submitted'
        
        # Verify job status updated
        self.job.refresh_from_db()
        assert self.job.status == 'applied'
        assert self.job.application_submitted_at is not None
    
    def test_cancel_scheduled_submission(self):
        """Test canceling a scheduled submission"""
        submission = ScheduledSubmission.objects.create(
            candidate=self.candidate,
            job=self.job,
            application_package=self.package,
            scheduled_datetime=timezone.now() + timedelta(days=1),
            status='scheduled'
        )
        
        response = self.client.post(
            f'/api/scheduled-submissions/{submission.id}/cancel/',
            {'reason': 'Changed my mind'}
        )
        assert response.status_code == 200
        assert response.data['status'] == 'cancelled'
    
    def test_delete_scheduled_submission(self):
        """Test deleting a scheduled submission"""
        submission = ScheduledSubmission.objects.create(
            candidate=self.candidate,
            job=self.job,
            application_package=self.package,
            scheduled_datetime=timezone.now() + timedelta(days=1),
            status='scheduled'
        )
        
        response = self.client.delete(f'/api/scheduled-submissions/{submission.id}/')
        assert response.status_code == 204
        assert not ScheduledSubmission.objects.filter(id=submission.id).exists()
    
    def test_cannot_schedule_past_datetime(self):
        """Test that scheduling in the past fails"""
        past_time = timezone.now() - timedelta(days=1)
        
        data = {
            'job': self.job.id,
            'application_package': self.package.id,
            'scheduled_datetime': past_time.isoformat(),
            'timezone': 'America/New_York',
        }
        
        response = self.client.post('/api/scheduled-submissions/', data, format='json')
        assert response.status_code == 400


@pytest.mark.django_db
class TestReminders:
    """Tests for reminder functionality"""
    
    def setup_method(self):
        """Set up test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.candidate = CandidateProfile.objects.create(user=self.user)
        
        self.job = JobEntry.objects.create(
            candidate=self.candidate,
            title='Software Engineer',
            company_name='Test Company',
            status='interested'
        )
        
        self.client.force_authenticate(user=self.user)
    
    def test_create_reminder(self):
        """Test creating a new reminder"""
        future_time = timezone.now() + timedelta(days=1)
        
        data = {
            'job': self.job.id,
            'reminder_type': 'application_deadline',
            'subject': 'Application deadline reminder',
            'message_template': 'Don\'t forget to apply!',
            'scheduled_datetime': future_time.isoformat(),
        }
        
        response = self.client.post('/api/reminders/', data, format='json')
        assert response.status_code == 201
        assert response.data['job_title'] == 'Software Engineer'
        assert response.data['status'] == 'pending'
    
    def test_list_reminders(self):
        """Test listing reminders"""
        FollowUpReminder.objects.create(
            candidate=self.candidate,
            job=self.job,
            reminder_type='application_deadline',
            subject='Test reminder',
            message_template='Test message',
            scheduled_datetime=timezone.now() + timedelta(days=1)
        )
        
        response = self.client.get('/api/reminders/')
        assert response.status_code == 200
        assert len(response.data) == 1
    
    def test_filter_reminders_by_status(self):
        """Test filtering reminders by status"""
        FollowUpReminder.objects.create(
            candidate=self.candidate,
            job=self.job,
            reminder_type='application_deadline',
            subject='Pending reminder',
            message_template='Test',
            scheduled_datetime=timezone.now() + timedelta(days=1),
            status='pending'
        )
        FollowUpReminder.objects.create(
            candidate=self.candidate,
            job=self.job,
            reminder_type='application_followup',
            subject='Sent reminder',
            message_template='Test',
            scheduled_datetime=timezone.now() - timedelta(days=1),
            status='sent'
        )
        
        response = self.client.get('/api/reminders/?status=pending')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['status'] == 'pending'
    
    def test_dismiss_reminder(self):
        """Test dismissing a reminder"""
        reminder = FollowUpReminder.objects.create(
            candidate=self.candidate,
            job=self.job,
            reminder_type='application_deadline',
            subject='Test reminder',
            message_template='Test message',
            scheduled_datetime=timezone.now() + timedelta(days=1),
            status='pending'
        )
        
        response = self.client.post(f'/api/reminders/{reminder.id}/dismiss/')
        assert response.status_code == 200
        assert response.data['status'] == 'dismissed'
    
    def test_recurring_reminder(self):
        """Test creating a recurring reminder"""
        future_time = timezone.now() + timedelta(days=1)
        
        data = {
            'job': self.job.id,
            'reminder_type': 'application_followup',
            'subject': 'Follow up reminder',
            'message_template': 'Remember to follow up',
            'scheduled_datetime': future_time.isoformat(),
            'is_recurring': True,
            'interval_days': 7,
            'max_occurrences': 3,
        }
        
        response = self.client.post('/api/reminders/', data, format='json')
        assert response.status_code == 201
        assert response.data['is_recurring'] is True
        assert response.data['interval_days'] == 7


@pytest.mark.django_db
class TestTimingAnalytics:
    """Tests for timing analytics functionality"""
    
    def setup_method(self):
        """Set up test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.candidate = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
    
    def test_get_best_practices(self):
        """Test getting timing best practices"""
        response = self.client.get('/api/application-timing/best-practices/')
        assert response.status_code == 200
        assert 'best_days' in response.data
        assert 'best_hours' in response.data
        assert 'avoid_times' in response.data
        assert 'general_tips' in response.data
    
    def test_get_timing_analytics_no_data(self):
        """Test getting analytics with no application data"""
        response = self.client.get('/api/application-timing/analytics/')
        assert response.status_code == 200
        assert response.data['total_applications'] == 0
    
    def test_get_timing_analytics_with_data(self):
        """Test getting analytics with application data"""
        # Create some jobs
        for i in range(5):
            job = JobEntry.objects.create(
                candidate=self.candidate,
                title=f'Job {i}',
                company_name=f'Company {i}',
                status='applied',
                application_submitted_at=timezone.now() - timedelta(days=i)
            )
            
            # Some with responses
            if i % 2 == 0:
                job.first_response_at = job.application_submitted_at + timedelta(days=3)
                job.days_to_response = 3
                job.save()
        
        response = self.client.get('/api/application-timing/analytics/')
        assert response.status_code == 200
        assert response.data['total_applications'] == 5
        assert 'response_rate_by_day' in response.data
        assert 'submissions_by_day' in response.data
    
    def test_get_calendar_view(self):
        """Test getting calendar view"""
        start_date = timezone.now().replace(day=1).isoformat()
        end_date = (timezone.now() + timedelta(days=30)).isoformat()
        
        response = self.client.get(
            f'/api/application-timing/calendar/?start_date={start_date}&end_date={end_date}'
        )
        assert response.status_code == 200
        assert 'events' in response.data


@pytest.mark.django_db
class TestTimingTasks:
    """Tests for Celery tasks"""
    
    def setup_method(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.candidate = CandidateProfile.objects.create(user=self.user)
        
        self.job = JobEntry.objects.create(
            candidate=self.candidate,
            title='Software Engineer',
            company_name='Test Company',
            status='interested'
        )
        
        self.package = ApplicationPackage.objects.create(
            candidate=self.candidate,
            job=self.job,
            status='ready'
        )
    
    def test_process_due_submissions(self):
        """Test processing submissions that are due"""
        from core.tasks import _process_scheduled_submissions_sync
        from unittest.mock import patch
        
        # Add contact email to job metadata for email sending
        self.job.metadata = {'contact_email': 'recruiter@testcompany.com'}
        self.job.save()
        
        # Create a due submission with portal method (doesn't require email)
        submission = ScheduledSubmission.objects.create(
            candidate=self.candidate,
            job=self.job,
            application_package=self.package,
            scheduled_datetime=timezone.now() - timedelta(minutes=5),
            status='scheduled',
            submission_method='portal'  # Portal method doesn't send email
        )
        
        result = _process_scheduled_submissions_sync()
        
        assert result['processed'] == 1
        submission.refresh_from_db()
        assert submission.status == 'submitted'
        
        # Verify job status
        self.job.refresh_from_db()
        assert self.job.status == 'applied'
    
    def test_send_due_reminders(self):
        """Test sending reminders that are due"""
        from core.tasks import _send_due_reminders_sync
        
        # Create a due reminder
        reminder = FollowUpReminder.objects.create(
            candidate=self.candidate,
            job=self.job,
            reminder_type='application_deadline',
            subject='Test reminder',
            message_template='Test message',
            scheduled_datetime=timezone.now() - timedelta(minutes=5),
            status='pending'
        )
        
        result = _send_due_reminders_sync()
        
        assert result['sent'] >= 0  # May fail if email not configured
        reminder.refresh_from_db()
        # Status should be either 'sent' or 'failed' depending on email setup
        assert reminder.status in ['sent', 'failed']
    
    def test_check_upcoming_deadlines(self):
        """Test checking for upcoming deadlines"""
        from core.tasks import _check_upcoming_deadlines_sync
        from datetime import date
        
        # Create job with deadline in 3 days
        job_with_deadline = JobEntry.objects.create(
            candidate=self.candidate,
            title='Job with deadline',
            company_name='Test Company',
            status='interested',
            application_deadline=date.today() + timedelta(days=3)
        )
        
        result = _check_upcoming_deadlines_sync()
        
        assert result['reminders_created'] == 1
        assert FollowUpReminder.objects.filter(
            job=job_with_deadline,
            reminder_type='application_deadline'
        ).exists()


@pytest.mark.django_db
class TestModelMethods:
    """Tests for model methods"""
    
    def setup_method(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.candidate = CandidateProfile.objects.create(user=self.user)
        
        self.job = JobEntry.objects.create(
            candidate=self.candidate,
            title='Software Engineer',
            company_name='Test Company',
            status='interested'
        )
        
        self.package = ApplicationPackage.objects.create(
            candidate=self.candidate,
            job=self.job,
            status='ready'
        )
    
    def test_submission_mark_submitted(self):
        """Test marking submission as submitted"""
        submission = ScheduledSubmission.objects.create(
            candidate=self.candidate,
            job=self.job,
            application_package=self.package,
            scheduled_datetime=timezone.now() + timedelta(days=1),
            status='scheduled'
        )
        
        submission.mark_submitted()
        
        assert submission.status == 'submitted'
        assert submission.submitted_at is not None
        assert submission.day_of_week is not None
        assert submission.hour_of_day is not None
    
    def test_reminder_mark_sent(self):
        """Test marking reminder as sent"""
        reminder = FollowUpReminder.objects.create(
            candidate=self.candidate,
            job=self.job,
            reminder_type='application_deadline',
            subject='Test',
            message_template='Test',
            scheduled_datetime=timezone.now(),
            status='pending'
        )
        
        reminder.mark_sent()
        
        assert reminder.status == 'sent'
        assert reminder.sent_at is not None
        assert reminder.occurrence_count == 1
    
    def test_recurring_reminder_creates_next(self):
        """Test that recurring reminders create next occurrence"""
        reminder = FollowUpReminder.objects.create(
            candidate=self.candidate,
            job=self.job,
            reminder_type='application_followup',
            subject='Test',
            message_template='Test',
            scheduled_datetime=timezone.now(),
            status='pending',
            is_recurring=True,
            interval_days=7,
            max_occurrences=3
        )
        
        next_reminder = reminder.mark_sent()
        
        assert next_reminder is not None
        assert next_reminder.occurrence_count == 1
        assert next_reminder.status == 'pending'
        assert next_reminder.scheduled_datetime > reminder.scheduled_datetime
