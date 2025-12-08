"""
Tests for email integration models (UC-113)
"""
import pytest
from datetime import datetime, timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from core.models import GmailIntegration, ApplicationEmail, EmailScanLog, JobEntry

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
def job_entry(db, candidate_profile):
    """Create test job entry"""
    return JobEntry.objects.create(
        candidate=candidate_profile,
        company_name='TechCorp',
        title='Software Engineer',
        status='applied'
    )


@pytest.mark.django_db
class TestGmailIntegration:
    """Tests for GmailIntegration model"""
    
    def test_create_gmail_integration(self, user):
        """Test creating Gmail integration"""
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='test_token',
            refresh_token='refresh_token',
            token_expires_at=timezone.now() + timedelta(hours=1),
            gmail_address='user@gmail.com',
            status='connected',
            scan_enabled=True
        )
        
        assert integration.user == user
        assert integration.access_token == 'test_token'
        assert integration.gmail_address == 'user@gmail.com'
        assert integration.status == 'connected'
        assert integration.scan_enabled is True
    
    def test_gmail_integration_str(self, user):
        """Test string representation"""
        integration = GmailIntegration.objects.create(
            user=user,
            gmail_address='user@gmail.com'
        )
        
        assert str(integration) == 'test@example.com - Gmail (disconnected)'
    
    def test_gmail_integration_default_values(self, user):
        """Test default field values"""
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='token',
            refresh_token='refresh'
        )
        
        assert integration.status == 'disconnected'
        assert integration.scan_enabled is False
        assert integration.last_scan_at is None
        assert integration.last_error == ''
    
    def test_token_expiry_tracking(self, user):
        """Test token expiration tracking"""
        expires_at = timezone.now() + timedelta(hours=1)
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='token',
            refresh_token='refresh',
            token_expires_at=expires_at
        )
        
        assert integration.token_expires_at == expires_at
    
    def test_one_integration_per_user(self, user):
        """Test user can have one Gmail integration"""
        GmailIntegration.objects.create(
            user=user,
            access_token='token1',
            refresh_token='refresh1'
        )
        
        # Creating second integration should fail with OneToOneField
        from django.db import IntegrityError
        with pytest.raises(IntegrityError):
            GmailIntegration.objects.create(
                user=user,
                access_token='token2',
                refresh_token='refresh2'
            )
    
    def test_update_last_scan(self, user):
        """Test updating last scan timestamp"""
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='token',
            refresh_token='refresh'
        )
        
        scan_time = timezone.now()
        integration.last_scan_at = scan_time
        integration.save()
        
        integration.refresh_from_db()
        assert integration.last_scan_at == scan_time
    
    def test_track_error_status(self, user):
        """Test tracking error status"""
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='token',
            refresh_token='refresh',
            status='error',
            last_error='Token expired'
        )
        
        assert integration.status == 'error'
        assert integration.last_error == 'Token expired'


@pytest.mark.django_db
class TestApplicationEmail:
    """Tests for ApplicationEmail model"""
    
    def test_create_application_email(self, user):
        """Test creating application email"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            thread_id='thread123',
            subject='Interview Invitation',
            sender_email='hr@techcorp.com',
            sender_name='HR Department',
            received_at=timezone.now(),
            snippet='Email preview',
            email_type='interview_invitation'
        )
        
        assert email.user == user
        assert email.gmail_message_id == 'msg123'
        assert email.subject == 'Interview Invitation'
        assert email.email_type == 'interview_invitation'
    
    def test_application_email_str(self, user):
        """Test string representation"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            thread_id='thread123',
            subject='Test Email',
            sender_email='sender@example.com',
            received_at=timezone.now()
        )
        
        assert str(email) == 'Test Email - sender@example.com'
    
    def test_link_email_to_job(self, user, job_entry):
        """Test linking email to job"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            thread_id='thread123',
            subject='Interview',
            sender_email='hr@techcorp.com',
            received_at=timezone.now(),
            job=job_entry
        )
        
        assert email.job == job_entry
    
    def test_email_classification(self, user):
        """Test email classification fields"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            thread_id='thread123',
            subject='Interview',
            sender_email='hr@example.com',
            received_at=timezone.now(),
            email_type='interview_invitation',
            confidence_score=0.9,
            suggested_job_status='phone'
        )
        
        assert email.email_type == 'interview_invitation'
        assert email.confidence_score == 0.9
        assert email.suggested_job_status == 'phone'
    
    def test_email_unique_message_id(self, user):
        """Test gmail_message_id uniqueness enforced by database"""
        ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            thread_id='thread123',
            subject='Email 1',
            sender_email='sender@example.com',
            received_at=timezone.now()
        )
        
        # Creating duplicate gmail_message_id should fail (unique=True)
        from django.db import IntegrityError
        with pytest.raises(IntegrityError):
            ApplicationEmail.objects.create(
                user=user,
                gmail_message_id='msg123',
                thread_id='thread456',
                subject='Email 2',
                sender_email='sender@example.com',
                received_at=timezone.now()
            )
    
    def test_email_body_preview(self, user):
        """Test storing email body text"""
        body = 'This is a long email body that should be stored...' * 10
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            thread_id='thread123',
            subject='Test',
            sender_email='sender@example.com',
            received_at=timezone.now(),
            body_text=body
        )
        
        assert email.body_text == body
    
    def test_email_ordering(self, user):
        """Test emails are ordered by received_at descending"""
        email1 = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg1',
            thread_id='thread1',
            subject='First',
            sender_email='sender@example.com',
            received_at=timezone.now() - timedelta(days=2)
        )
        
        email2 = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg2',
            thread_id='thread2',
            subject='Second',
            sender_email='sender@example.com',
            received_at=timezone.now() - timedelta(days=1)
        )
        
        emails = list(ApplicationEmail.objects.filter(user=user))
        assert emails[0] == email2  # Most recent first
        assert emails[1] == email1


@pytest.mark.django_db
class TestEmailScanLog:
    """Tests for EmailScanLog model"""
    
    def test_create_scan_log(self, user):
        """Test creating scan log"""
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='token',
            refresh_token='refresh'
        )
        
        log = EmailScanLog.objects.create(
            integration=integration,
            status='in_progress'
        )
        
        assert log.integration == integration
        assert log.status == 'in_progress'
    
    def test_scan_log_str(self, user):
        """Test string representation"""
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='token',
            refresh_token='refresh',
            gmail_address='user@gmail.com'
        )
        
        log = EmailScanLog.objects.create(
            integration=integration,
            status='success'
        )
        
        expected = f'EmailScanLog({integration.id}, success)'
        assert str(log) == expected
    
    def test_scan_log_completion(self, user):
        """Test completing scan log"""
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='token',
            refresh_token='refresh'
        )
        
        log = EmailScanLog.objects.create(
            integration=integration,
            status='in_progress'
        )
        
        completion_time = timezone.now()
        log.completed_at = completion_time
        log.emails_processed = 8
        log.emails_matched = 5
        log.emails_linked = 3
        log.status = 'completed'
        log.save()
        
        log.refresh_from_db()
        assert log.completed_at == completion_time
        assert log.emails_processed == 8
        assert log.emails_matched == 5
        assert log.emails_linked == 3
        assert log.status == 'completed'
    
    def test_scan_log_error(self, user):
        """Test logging scan error"""
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='token',
            refresh_token='refresh'
        )
        
        log = EmailScanLog.objects.create(
            integration=integration,
            status='failed',
            error_message='API quota exceeded'
        )
        
        assert log.status == 'failed'
        assert log.error_message == 'API quota exceeded'
    
    def test_scan_log_default_values(self, user):
        """Test default field values"""
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='token',
            refresh_token='refresh'
        )
        
        log = EmailScanLog.objects.create(
            integration=integration,
            status='in_progress'
        )
        
        assert log.emails_processed == 0
        assert log.emails_matched == 0
        assert log.emails_linked == 0
        assert log.error_message == ''
        assert log.completed_at is None
    
    def test_scan_log_ordering(self, user):
        """Test logs are ordered by started_at descending"""
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='token',
            refresh_token='refresh'
        )
        
        log1 = EmailScanLog.objects.create(
            integration=integration,
            status='success'
        )
        
        # Add small delay to ensure different timestamps
        import time
        time.sleep(0.01)
        
        log2 = EmailScanLog.objects.create(
            integration=integration,
            status='success'
        )
        
        logs = list(EmailScanLog.objects.filter(integration=integration).order_by('-started_at'))
        assert logs[0] == log2  # Most recent first
        assert logs[1] == log1


@pytest.mark.django_db
class TestEmailModelRelationships:
    """Tests for model relationships"""
    
    def test_delete_user_cascades(self, user, job_entry):
        """Test deleting user cascades to related objects"""
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='token',
            refresh_token='refresh'
        )
        
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            thread_id='thread123',
            subject='Test',
            sender_email='sender@example.com',
            received_at=timezone.now(),
            job=job_entry
        )
        
        EmailScanLog.objects.create(
            integration=integration,
            status='success'
        )
        
        user.delete()
        
        assert not GmailIntegration.objects.filter(id=integration.id).exists()
        assert not ApplicationEmail.objects.filter(id=email.id).exists()
    
    def test_delete_integration_cascades_logs(self, user):
        """Test deleting integration cascades to logs"""
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='token',
            refresh_token='refresh'
        )
        
        log = EmailScanLog.objects.create(
            integration=integration,
            status='success'
        )
        
        integration.delete()
        
        assert not EmailScanLog.objects.filter(id=log.id).exists()
    
    def test_delete_job_nullifies_email_reference(self, user, job_entry):
        """Test deleting job sets email.job to null"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            thread_id='thread123',
            subject='Test',
            sender_email='sender@example.com',
            received_at=timezone.now(),
            job=job_entry
        )
        
        job_entry.delete()
        
        # Email is CASCADE deleted when job is deleted
        assert not ApplicationEmail.objects.filter(id=email.id).exists()
