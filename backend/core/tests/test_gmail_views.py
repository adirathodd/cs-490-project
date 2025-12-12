"""
Tests for Gmail integration views (UC-113)
"""
import pytest
from unittest.mock import patch, MagicMock
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from core.models import GmailIntegration, ApplicationEmail, EmailScanLog


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
    )


@pytest.fixture
def gmail_integration(db, user):
    """Create test Gmail integration"""
    return GmailIntegration.objects.create(
        user=user,
        access_token='test_access_token',
        refresh_token='test_refresh_token',
        status='connected',
        scan_enabled=True,
        gmail_address='test@gmail.com',
        scan_frequency='daily',
        auto_update_status=False
    )


class TestGmailOAuthStart:
    """Tests for gmail_oauth_start endpoint"""
    
    @patch('core.gmail_utils.build_gmail_auth_url')
    def test_oauth_start_success(self, mock_build_url, api_client, user):
        """Test starting OAuth flow"""
        mock_build_url.return_value = 'https://accounts.google.com/o/oauth2/auth?...'
        
        api_client.force_authenticate(user=user)
        url = reverse('gmail-oauth-start')
        response = api_client.post(url, {'redirect_uri': 'http://localhost:3000/gmail-callback'})
        
        assert response.status_code == status.HTTP_200_OK
        assert 'auth_url' in response.data
        assert 'state' in response.data
    
    def test_oauth_start_unauthenticated(self, api_client):
        """Test OAuth start requires authentication"""
        url = reverse('gmail-oauth-start')
        response = api_client.post(url, {'redirect_uri': 'http://localhost:3000/gmail-callback'})
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestGmailIntegrationStatus:
    """Tests for gmail_integration_status endpoint"""
    
    def test_status_with_integration(self, api_client, user, gmail_integration):
        """Test getting status when integration exists"""
        api_client.force_authenticate(user=user)
        url = reverse('gmail-status')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'connected'
        assert response.data['gmail_address'] == 'test@gmail.com'
        assert response.data['scan_enabled'] == True
        assert response.data['scan_frequency'] == 'daily'
        assert response.data['auto_update_status'] == False
    
    def test_status_without_integration(self, api_client, user):
        """Test getting status when no integration exists"""
        api_client.force_authenticate(user=user)
        url = reverse('gmail-status')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {'connected': False}


class TestGmailDisconnect:
    """Tests for gmail_disconnect endpoint"""
    
    def test_disconnect_deletes_all_data(self, api_client, user, gmail_integration):
        """Test disconnect removes integration and all associated data"""
        # Create some test data
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            sender_email='hr@company.com',
            subject='Test',
            received_at=timezone.now(),
            snippet='Test email',
            email_type='other',
            confidence_score=0.5
        )
        scan_log = EmailScanLog.objects.create(
            integration=gmail_integration,
            emails_processed=1,
            emails_matched=1,
            status='success'
        )
        
        api_client.force_authenticate(user=user)
        url = reverse('gmail-disconnect')
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'disconnected'
        
        # Verify all data is deleted
        assert not GmailIntegration.objects.filter(user=user).exists()
        assert not ApplicationEmail.objects.filter(user=user).exists()
        assert not EmailScanLog.objects.filter(integration=gmail_integration).exists()


class TestGmailEnableScanning:
    """Tests for gmail_enable_scanning endpoint"""
    
    @patch('core.tasks.scan_gmail_emails')
    def test_enable_scanning_success(self, mock_scan_task, api_client, user, gmail_integration):
        """Test enabling email scanning"""
        gmail_integration.scan_enabled = False
        gmail_integration.save()
        
        mock_scan_task.delay = MagicMock()
        
        api_client.force_authenticate(user=user)
        url = reverse('gmail-enable-scanning')
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'scanning_enabled'
        
        # Verify scan_enabled is now True
        gmail_integration.refresh_from_db()
        assert gmail_integration.scan_enabled == True
        
        # Verify scan was triggered
        mock_scan_task.delay.assert_called_once()
    
    def test_enable_scanning_no_integration(self, api_client, user):
        """Test enable scanning when no integration exists"""
        api_client.force_authenticate(user=user)
        url = reverse('gmail-enable-scanning')
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestGmailUpdatePreferences:
    """Tests for gmail_update_preferences endpoint"""
    
    def test_update_scan_frequency(self, api_client, user, gmail_integration):
        """Test updating scan frequency"""
        api_client.force_authenticate(user=user)
        url = reverse('gmail-update-preferences')
        response = api_client.patch(url, {'scan_frequency': 'hourly'})
        
        assert response.status_code == status.HTTP_200_OK
        
        gmail_integration.refresh_from_db()
        assert gmail_integration.scan_frequency == 'hourly'
    
    def test_update_auto_update_status(self, api_client, user, gmail_integration):
        """Test updating auto_update_status"""
        api_client.force_authenticate(user=user)
        url = reverse('gmail-update-preferences')
        response = api_client.patch(url, {'auto_update_status': True})
        
        assert response.status_code == status.HTTP_200_OK
        
        gmail_integration.refresh_from_db()
        assert gmail_integration.auto_update_status == True
    
    def test_update_both_preferences(self, api_client, user, gmail_integration):
        """Test updating both preferences at once"""
        api_client.force_authenticate(user=user)
        url = reverse('gmail-update-preferences')
        response = api_client.patch(url, {
            'scan_frequency': 'realtime',
            'auto_update_status': True
        })
        
        assert response.status_code == status.HTTP_200_OK
        
        gmail_integration.refresh_from_db()
        assert gmail_integration.scan_frequency == 'realtime'
        assert gmail_integration.auto_update_status == True
    
    def test_update_invalid_frequency(self, api_client, user, gmail_integration):
        """Test updating with invalid scan frequency"""
        api_client.force_authenticate(user=user)
        url = reverse('gmail-update-preferences')
        response = api_client.patch(url, {'scan_frequency': 'invalid'})
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Invalid scan_frequency' in response.data['error']
    
    def test_update_preferences_no_integration(self, api_client, user):
        """Test update preferences when no integration exists"""
        api_client.force_authenticate(user=user)
        url = reverse('gmail-update-preferences')
        response = api_client.patch(url, {'scan_frequency': 'hourly'})
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestGmailScanNow:
    """Tests for gmail_scan_now endpoint"""
    
    @patch('core.tasks.scan_gmail_emails')
    def test_scan_now_success(self, mock_scan_task, api_client, user, gmail_integration):
        """Test manually triggering a scan"""
        mock_scan_task.delay = MagicMock()
        
        api_client.force_authenticate(user=user)
        url = reverse('gmail-scan')
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'scan_started'
        mock_scan_task.delay.assert_called_once()
    
    def test_scan_now_no_integration(self, api_client, user):
        """Test scan now when no integration exists"""
        api_client.force_authenticate(user=user)
        url = reverse('gmail-scan')
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestApplicationEmailsList:
    """Tests for application_emails_list endpoint"""
    
    def test_list_unlinked_emails(self, api_client, user):
        """Test listing unlinked emails"""
        email1 = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg1',
            sender_email='hr@company.com',
            subject='Interview',
            received_at=timezone.now(),
            snippet='Test',
            email_type='interview_invitation',
            confidence_score=0.9,
            is_application_related=True,
            is_linked=False
        )
        email2 = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg2',
            sender_email='hr@company2.com',
            subject='Rejection',
            received_at=timezone.now(),
            snippet='Test',
            email_type='rejection',
            confidence_score=0.95,
            is_linked=True  # Linked email (without actual job)
        )
        
        api_client.force_authenticate(user=user)
        url = reverse('application-emails-list')
        response = api_client.get(url, {'unlinked_only': 'true'})
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
    
    def test_list_dismissed_emails_excluded(self, api_client, user):
        """Test that dismissed emails are not returned"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg1',
            sender_email='hr@company.com',
            subject='Test',
            received_at=timezone.now(),
            snippet='Test',
            email_type='other',
            confidence_score=0.5,
            is_dismissed=True
        )
        
        api_client.force_authenticate(user=user)
        url = reverse('application-emails-list')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 0


class TestDismissEmail:
    """Tests for dismiss_email endpoint"""
    
    def test_dismiss_email_success(self, api_client, user):
        """Test dismissing an email"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg1',
            sender_email='hr@company.com',
            subject='Test',
            received_at=timezone.now(),
            snippet='Test',
            email_type='other',
            confidence_score=0.5
        )
        
        api_client.force_authenticate(user=user)
        url = reverse('dismiss-email', kwargs={'email_id': email.id})
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        
        email.refresh_from_db()
        assert email.is_dismissed == True
    
    def test_dismiss_email_not_found(self, api_client, user):
        """Test dismissing non-existent email"""
        import uuid
        api_client.force_authenticate(user=user)
        url = reverse('dismiss-email', kwargs={'email_id': uuid.uuid4()})
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestEmailSearchFilters:
    """UC-113: Tests for email search and filter functionality"""
    
    def test_search_by_subject(self, api_client, user):
        """Test searching emails by subject text"""
        ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg1',
            sender_email='hr@company.com',
            subject='Software Engineer Interview Invitation',
            received_at=timezone.now(),
            snippet='Test',
            email_type='interview_invitation',
            confidence_score=0.9
        )
        ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg2',
            sender_email='recruiter@tech.com',
            subject='Application Received',
            received_at=timezone.now(),
            snippet='Test',
            email_type='acknowledgment',
            confidence_score=0.8
        )
        
        api_client.force_authenticate(user=user)
        url = reverse('application-emails-list')
        
        # Search for "Engineer"
        response = api_client.get(url, {'search': 'Engineer'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert 'Engineer' in response.data[0]['subject']
        
        # Search for "Application"
        response = api_client.get(url, {'search': 'Application'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert 'Application' in response.data[0]['subject']
    
    def test_search_by_sender_email(self, api_client, user):
        """Test searching emails by sender email"""
        ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg1',
            sender_email='hr@google.com',
            subject='Interview',
            received_at=timezone.now(),
            snippet='Test',
            email_type='interview_invitation',
            confidence_score=0.9
        )
        ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg2',
            sender_email='recruiter@microsoft.com',
            subject='Interview',
            received_at=timezone.now(),
            snippet='Test',
            email_type='interview_invitation',
            confidence_score=0.9
        )
        
        api_client.force_authenticate(user=user)
        url = reverse('application-emails-list')
        
        response = api_client.get(url, {'search': 'google'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert 'google' in response.data[0]['sender_email']
    
    def test_search_by_sender_name(self, api_client, user):
        """Test searching emails by sender name"""
        ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg1',
            sender_email='john@company.com',
            sender_name='John Smith',
            subject='Interview',
            received_at=timezone.now(),
            snippet='Test',
            email_type='interview_invitation',
            confidence_score=0.9
        )
        ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg2',
            sender_email='jane@company.com',
            sender_name='Jane Doe',
            subject='Interview',
            received_at=timezone.now(),
            snippet='Test',
            email_type='interview_invitation',
            confidence_score=0.9
        )
        
        api_client.force_authenticate(user=user)
        url = reverse('application-emails-list')
        
        response = api_client.get(url, {'search': 'John'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['sender_name'] == 'John Smith'
    
    def test_filter_by_sender(self, api_client, user):
        """Test filtering emails by sender parameter"""
        ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg1',
            sender_email='hr@company.com',
            sender_name='HR Team',
            subject='Interview',
            received_at=timezone.now(),
            snippet='Test',
            email_type='interview_invitation',
            confidence_score=0.9
        )
        ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg2',
            sender_email='tech@company.com',
            sender_name='Tech Recruiter',
            subject='Interview',
            received_at=timezone.now(),
            snippet='Test',
            email_type='interview_invitation',
            confidence_score=0.9
        )
        
        api_client.force_authenticate(user=user)
        url = reverse('application-emails-list')
        
        response = api_client.get(url, {'sender': 'hr@company'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert 'hr@company' in response.data[0]['sender_email']
    
    def test_filter_by_company_name(self, api_client, user):
        """Test filtering emails by company name through job relationship"""
        from core.models import JobEntry, CandidateProfile
        
        # Create candidate profile
        candidate_profile = CandidateProfile.objects.create(user=user)
        
        job1 = JobEntry.objects.create(
            candidate=candidate_profile,
            title='Software Engineer',
            company_name='Google LLC',
            status='applied'
        )
        job2 = JobEntry.objects.create(
            candidate=candidate_profile,
            title='Frontend Developer',
            company_name='Microsoft Corp',
            status='applied'
        )
        
        email1 = ApplicationEmail.objects.create(
            user=user,
            job=job1,
            gmail_message_id='msg1',
            sender_email='hr@google.com',
            subject='Interview Invitation',
            received_at=timezone.now(),
            snippet='Test',
            email_type='interview_invitation',
            confidence_score=0.9,
            is_linked=True
        )
        email2 = ApplicationEmail.objects.create(
            user=user,
            job=job2,
            gmail_message_id='msg2',
            sender_email='hr@microsoft.com',
            subject='Interview Invitation',
            received_at=timezone.now(),
            snippet='Test',
            email_type='interview_invitation',
            confidence_score=0.9,
            is_linked=True
        )
        
        api_client.force_authenticate(user=user)
        url = reverse('application-emails-list')
        
        response = api_client.get(url, {'company': 'Google'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert 'Google' in response.data[0]['company_name']
    
    def test_filter_by_date_range(self, api_client, user):
        """Test filtering emails by date range"""
        from datetime import datetime, timedelta
        
        now = timezone.now()
        yesterday = now - timedelta(days=1)
        last_week = now - timedelta(days=7)
        
        ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg1',
            sender_email='hr@company.com',
            subject='Recent Email',
            received_at=now,
            snippet='Test',
            email_type='other',
            confidence_score=0.5
        )
        ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg2',
            sender_email='hr@company.com',
            subject='Yesterday Email',
            received_at=yesterday,
            snippet='Test',
            email_type='other',
            confidence_score=0.5
        )
        ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg3',
            sender_email='hr@company.com',
            subject='Old Email',
            received_at=last_week,
            snippet='Test',
            email_type='other',
            confidence_score=0.5
        )
        
        api_client.force_authenticate(user=user)
        url = reverse('application-emails-list')
        
        # Filter from yesterday onwards
        response = api_client.get(url, {'date_from': yesterday.isoformat()})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2
        
        # Filter up to yesterday
        response = api_client.get(url, {'date_to': yesterday.isoformat()})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2
        
        # Filter specific range
        two_days_ago = now - timedelta(days=2)
        response = api_client.get(url, {
            'date_from': two_days_ago.isoformat(),
            'date_to': now.isoformat()
        })
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2
    
    def test_combined_filters(self, api_client, user):
        """Test using multiple filters together"""
        from core.models import JobEntry, CandidateProfile
        from datetime import timedelta
        
        # Create candidate profile
        candidate_profile = CandidateProfile.objects.create(user=user)
        
        now = timezone.now()
        yesterday = now - timedelta(days=1)
        
        job = JobEntry.objects.create(
            candidate=candidate_profile,
            title='Software Engineer',
            company_name='Tech Corp',
            status='applied'
        )
        
        # Matching all filters
        ApplicationEmail.objects.create(
            user=user,
            job=job,
            gmail_message_id='msg1',
            sender_email='john@techcorp.com',
            sender_name='John Recruiter',
            subject='Engineer Interview',
            received_at=now,
            snippet='Test',
            email_type='interview_invitation',
            confidence_score=0.9,
            is_linked=True
        )
        # Not matching sender
        ApplicationEmail.objects.create(
            user=user,
            job=job,
            gmail_message_id='msg2',
            sender_email='hr@techcorp.com',
            sender_name='HR Team',
            subject='Engineer Interview',
            received_at=now,
            snippet='Test',
            email_type='interview_invitation',
            confidence_score=0.9,
            is_linked=True
        )
        # Too old
        ApplicationEmail.objects.create(
            user=user,
            job=job,
            gmail_message_id='msg3',
            sender_email='john@techcorp.com',
            sender_name='John Recruiter',
            subject='Engineer Interview',
            received_at=yesterday - timedelta(days=10),
            snippet='Test',
            email_type='interview_invitation',
            confidence_score=0.9,
            is_linked=True
        )
        
        api_client.force_authenticate(user=user)
        url = reverse('application-emails-list')
        
        response = api_client.get(url, {
            'search': 'Engineer',
            'sender': 'john',
            'company': 'Tech',
            'date_from': yesterday.isoformat()
        })
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['sender_name'] == 'John Recruiter'
