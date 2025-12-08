"""
Tests for Gmail email scanning tasks (UC-113)
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from django.utils import timezone
from django.contrib.auth import get_user_model
from core.models import GmailIntegration, ApplicationEmail, EmailScanLog, JobEntry
from core.tasks import scan_gmail_emails, auto_link_email_to_job

User = get_user_model()


@pytest.fixture
def user(db):
    """Create test user"""
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
    )


@pytest.fixture
def candidate_profile(db, user):
    """Create candidate profile"""
    from core.models import CandidateProfile
    return CandidateProfile.objects.create(user=user)


@pytest.fixture
def gmail_integration(db, user):
    """Create test Gmail integration"""
    return GmailIntegration.objects.create(
        user=user,
        access_token='test_access_token',
        refresh_token='test_refresh_token',
        token_expires_at=timezone.now() + timedelta(hours=1),
        gmail_address='test@gmail.com',
        status='connected',
        scan_enabled=True,
        last_scan_at=None
    )


@pytest.fixture
def job_entry(db, candidate_profile):
    """Create test job entry"""
    return JobEntry.objects.create(
        candidate=candidate_profile,
        company_name='TechCorp',
        title='Software Engineer',
        status='applied'
    )


@pytest.mark.django_db
class TestAutoLinkEmailToJob:
    """Tests for auto_link_email_to_job helper function"""
    
    def test_link_by_exact_company_match(self, user, job_entry):
        """Test linking email by exact company name match"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg1',
            thread_id='thread1',
            subject='Interview at TechCorp',
            sender_email='hr@techcorp.com',
            received_at=timezone.now(),
            email_type='interview_invitation',
            body_text='Interview scheduled with TechCorp for next week.'
        )
        
        auto_link_email_to_job(email)
        
        email.refresh_from_db()
        assert email.job == job_entry
    
    def test_link_by_sender_domain(self, user, job_entry):
        """Test linking email by sender domain"""
        job_entry.company_website = 'techcorp.com'
        job_entry.save()
        
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg2',
            thread_id='thread2',
            subject='Follow up',
            sender_email='recruiter@techcorp.com',
            received_at=timezone.now(),
            email_type='other',
            body_text='We would like to follow up about your application to TechCorp.'
        )
        
        auto_link_email_to_job(email)
        
        email.refresh_from_db()
        assert email.job == job_entry
    
    def test_link_by_company_in_subject(self, user, job_entry):
        """Test linking email by company name in subject"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg3',
            thread_id='thread3',
            subject='Application for position at TechCorp',
            sender_email='careers@example.com',
            received_at=timezone.now(),
            email_type='acknowledgment',
            body_text='Thank you for your application to TechCorp.'
        )
        
        auto_link_email_to_job(email)
        
        email.refresh_from_db()
        assert email.job == job_entry
    
    def test_no_link_when_no_match(self, user):
        """Test no linking when no matching job"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg4',
            thread_id='thread4',
            subject='Random email',
            sender_email='random@example.com',
            received_at=timezone.now(),
            email_type='other',
            body_text='This is a random email about something else.'
        )
        
        auto_link_email_to_job(email)
        
        email.refresh_from_db()
        assert email.job is None
    
    def test_no_link_when_already_linked(self, user, job_entry, candidate_profile):
        """Test doesn't override existing job link"""
        other_job = JobEntry.objects.create(
            candidate=candidate_profile,
            company_name='OtherCorp',
            title='Developer',
            status='applied'
        )
        
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg5',
            thread_id='thread5',
            subject='Email about TechCorp',
            sender_email='hr@techcorp.com',
            received_at=timezone.now(),
            email_type='other',
            job=other_job,
            body_text='This email mentions TechCorp in the content.'
        )
        
        auto_link_email_to_job(email)
        
        email.refresh_from_db()
        assert email.job == other_job


@pytest.mark.django_db
class TestScanGmailEmails:
    """Tests for scan_gmail_emails task"""
    
    @patch('core.gmail_utils.ensure_valid_token')
    @patch('core.gmail_utils.fetch_messages')
    @patch('core.gmail_utils.get_message_detail')
    @patch('core.gmail_utils.parse_email_headers')
    @patch('core.gmail_utils.extract_email_body')
    @patch('core.gmail_utils.classify_email_type')
    @patch('core.tasks.auto_link_email_to_job')
    def test_scan_success(self, mock_link, mock_classify, mock_extract, mock_parse,
                         mock_get_detail, mock_fetch, mock_ensure_token,
                         gmail_integration, user):
        """Test successful email scan"""
        mock_ensure_token.return_value = 'valid_token'
        mock_fetch.return_value = {
            'messages': [
                {'id': 'msg1', 'threadId': 'thread1'},
                {'id': 'msg2', 'threadId': 'thread2'}
            ]
        }
        mock_get_detail.return_value = {
            'id': 'msg1',
            'threadId': 'thread1',
            'snippet': 'Email snippet',
            'internalDate': str(int(timezone.now().timestamp() * 1000))
        }
        mock_parse.return_value = {
            'from': 'HR <hr@techcorp.com>',
            'subject': 'Interview Invitation',
            'date': 'Mon, 1 Jan 2024 12:00:00 +0000'
        }
        mock_extract.return_value = 'Full email body'
        mock_classify.return_value = ('interview_invitation', 0.9, 'phone')
        
        scan_gmail_emails(gmail_integration.id)
        
        gmail_integration.refresh_from_db()
        assert gmail_integration.last_scan_at is not None
        
        # Check scan log created
        log = EmailScanLog.objects.filter(integration=gmail_integration).first()
        assert log is not None
        assert log.status == 'success'
        assert log.emails_processed == 2
        
        # Check emails created
        assert ApplicationEmail.objects.filter(user=user).count() == 2
    
    def test_scan_no_integration(self, user):
        """Test scan when no integration exists"""
        # Should raise exception for non-existent integration
        with pytest.raises(Exception):  # Could be DoesNotExist or Retry
            scan_gmail_emails(99999)  # Non-existent ID
    
    def test_scan_disabled_integration(self, gmail_integration, user):
        """Test scan when integration disabled"""
        gmail_integration.scan_enabled = False
        gmail_integration.save()
        
        scan_gmail_emails(gmail_integration.id)
        
        # Should not scan
        assert not ApplicationEmail.objects.filter(user=user).exists()
    
    @patch('core.gmail_utils.ensure_valid_token')
    @patch('core.gmail_utils.fetch_messages')
    def test_scan_api_error(self, mock_fetch, mock_ensure_token, gmail_integration, user):
        """Test scan handles API errors"""
        from core.gmail_utils import GmailAPIError
        
        mock_ensure_token.return_value = 'valid_token'
        mock_fetch.side_effect = GmailAPIError('API Error')
        
        # May raise Retry exception if Celery is available
        try:
            scan_gmail_emails(gmail_integration.id)
        except Exception:
            pass  # Expected - either GmailAPIError or Celery Retry
        
        # Check error logged
        log = EmailScanLog.objects.filter(integration=gmail_integration).first()
        assert log is not None
        assert log.status == 'error'
        assert 'API Error' in log.error_message
        
        gmail_integration.refresh_from_db()
        assert 'API Error' in gmail_integration.last_error
    
    @patch('core.gmail_utils.ensure_valid_token')
    @patch('core.gmail_utils.fetch_messages')
    @patch('core.gmail_utils.get_message_detail')
    def test_scan_skips_existing_emails(self, mock_get_detail, mock_fetch, mock_ensure_token,
                                        gmail_integration, user):
        """Test scan skips already-processed emails"""
        # Create existing email
        ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg1',
            thread_id='thread1',
            subject='Existing',
            sender_email='sender@example.com',
            received_at=timezone.now(),
            email_type='other'
        )
        
        mock_ensure_token.return_value = 'valid_token'
        mock_fetch.return_value = {
            'messages': [
                {'id': 'msg1', 'threadId': 'thread1'},  # Already exists
                {'id': 'msg2', 'threadId': 'thread2'}   # New
            ]
        }
        mock_get_detail.return_value = {
            'id': 'msg2',
            'threadId': 'thread2',
            'snippet': 'New email',
            'internalDate': str(int(timezone.now().timestamp() * 1000)),
            'payload': {
                'headers': [
                    {'name': 'From', 'value': 'new@example.com'},
                    {'name': 'Subject', 'value': 'New Email'},
                    {'name': 'Date', 'value': 'Mon, 1 Jan 2024 12:00:00 +0000'}
                ],
                'body': {}
            }
        }
        
        scan_gmail_emails(gmail_integration.id)
        
        # Should only have 2 emails (1 existing + 1 new)
        assert ApplicationEmail.objects.filter(user=user).count() == 2
    
    @patch('core.gmail_utils.ensure_valid_token')
    @patch('core.gmail_utils.fetch_messages')
    @patch('core.gmail_utils.get_message_detail')
    @patch('core.gmail_utils.parse_email_headers')
    @patch('core.gmail_utils.extract_email_body')
    @patch('core.gmail_utils.classify_email_type')
    def test_scan_respects_max_messages(self, mock_classify, mock_extract, mock_parse,
                                        mock_get_detail, mock_fetch, mock_ensure_token,
                                        gmail_integration, user):
        """Test scan processes all messages returned by fetch"""
        mock_ensure_token.return_value = 'valid_token'
        
        # fetch_messages should respect max_results, returning only 100
        messages = [{'id': f'msg{i}', 'threadId': f'thread{i}'} for i in range(100)]
        mock_fetch.return_value = {'messages': messages}
        
        mock_get_detail.return_value = {
            'id': 'msg1',
            'threadId': 'thread1',
            'snippet': 'Snippet',
            'internalDate': str(int(timezone.now().timestamp() * 1000))
        }
        mock_parse.return_value = {
            'from': 'sender@example.com',
            'subject': 'Subject',
            'date': 'Mon, 1 Jan 2024 12:00:00 +0000'
        }
        mock_extract.return_value = 'Body'
        mock_classify.return_value = ('other', 0.5, '')
        
        scan_gmail_emails(gmail_integration.id)
        
        # Should process all returned messages
        log = EmailScanLog.objects.filter(integration=gmail_integration).first()
        assert log.emails_processed == 100
        
        # Verify fetch_messages was called with max_results=100
        assert mock_fetch.call_args[1]['max_results'] == 100
    
    @patch('core.gmail_utils.ensure_valid_token')
    @patch('core.gmail_utils.fetch_messages')
    def test_scan_no_messages(self, mock_fetch, mock_ensure_token, gmail_integration, user):
        """Test scan when no messages found"""
        mock_ensure_token.return_value = 'valid_token'
        mock_fetch.return_value = {}
        
        scan_gmail_emails(gmail_integration.id)
        
        log = EmailScanLog.objects.filter(integration=gmail_integration).first()
        assert log.status == 'success'
        assert log.emails_processed == 0
    
    @patch('core.gmail_utils.ensure_valid_token')
    @patch('core.gmail_utils.fetch_messages')
    @patch('core.gmail_utils.get_message_detail')
    def test_scan_handles_message_detail_error(self, mock_get_detail, mock_fetch,
                                               mock_ensure_token, gmail_integration, user):
        """Test scan continues when individual message detail fails"""
        from core.gmail_utils import GmailAPIError
        
        mock_ensure_token.return_value = 'valid_token'
        mock_fetch.return_value = {
            'messages': [
                {'id': 'msg1', 'threadId': 'thread1'},
                {'id': 'msg2', 'threadId': 'thread2'}
            ]
        }
        
        # First message fails, second succeeds
        mock_get_detail.side_effect = [
            GmailAPIError('Message not found'),
            {
                'id': 'msg2',
                'threadId': 'thread2',
                'snippet': 'Success',
                'internalDate': str(int(timezone.now().timestamp() * 1000)),
                'payload': {
                    'headers': [
                        {'name': 'From', 'value': 'sender@example.com'},
                        {'name': 'Subject', 'value': 'Subject'},
                        {'name': 'Date', 'value': 'Mon, 1 Jan 2024 12:00:00 +0000'}
                    ],
                    'body': {}
                }
            }
        ]
        
        scan_gmail_emails(gmail_integration.id)
        
        # Should have processed second message
        assert ApplicationEmail.objects.filter(user=user).count() == 1
        assert ApplicationEmail.objects.filter(gmail_message_id='msg2').exists()


@pytest.mark.django_db
class TestScanGmailEmailsDateFiltering:
    """Tests for date filtering in scan_gmail_emails"""
    
    @patch('core.gmail_utils.ensure_valid_token')
    @patch('core.gmail_utils.fetch_messages')
    def test_scan_uses_correct_date_query(self, mock_fetch, mock_ensure_token, gmail_integration, user):
        """Test scan constructs correct date query"""
        mock_ensure_token.return_value = 'valid_token'
        mock_fetch.return_value = {}
        
        scan_gmail_emails(gmail_integration.id)
        
        # Verify fetch_messages called with date query
        call_args = mock_fetch.call_args
        query = call_args[1]['query']
        assert 'newer_than:' in query or 'after:' in query
        assert 'application' in query.lower() or 'interview' in query.lower()
