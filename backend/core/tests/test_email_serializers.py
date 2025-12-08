"""
Tests for email integration serializers (UC-113)
"""
import pytest
from datetime import datetime, timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory
from core.models import GmailIntegration, ApplicationEmail, EmailScanLog, JobEntry
from core.serializers import (
    GmailIntegrationSerializer,
    ApplicationEmailSerializer,
    EmailScanLogSerializer
)

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
def request_factory():
    """Create API request factory"""
    return APIRequestFactory()


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
        access_token='test_token',
        refresh_token='refresh_token',
        token_expires_at=timezone.now() + timedelta(hours=1),
        gmail_address='user@gmail.com',
        status='connected',
        scan_enabled=True,
        last_scan_at=timezone.now() - timedelta(hours=1)
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
class TestGmailIntegrationSerializer:
    """Tests for GmailIntegrationSerializer"""
    
    def test_serialize_gmail_integration(self, gmail_integration):
        """Test serializing Gmail integration"""
        serializer = GmailIntegrationSerializer(gmail_integration)
        data = serializer.data
        
        assert data['gmail_address'] == 'user@gmail.com'
        assert data['status'] == 'connected'
        assert data['scan_enabled'] is True
        assert 'last_scan_at' in data
        assert 'last_error' in data
    
    def test_does_not_expose_tokens(self, gmail_integration):
        """Test access tokens are not exposed"""
        serializer = GmailIntegrationSerializer(gmail_integration)
        data = serializer.data
        
        assert 'access_token' not in data
        assert 'refresh_token' not in data
        assert 'token_expires_at' not in data
    
    def test_serialize_with_null_last_scan(self, user):
        """Test serializing integration with null last_scan_at"""
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='token',
            refresh_token='refresh',
            gmail_address='user@gmail.com'
        )
        
        serializer = GmailIntegrationSerializer(integration)
        data = serializer.data
        
        assert data['last_scan_at'] is None
    
    def test_serialize_error_status(self, user):
        """Test serializing integration with error"""
        integration = GmailIntegration.objects.create(
            user=user,
            access_token='token',
            refresh_token='refresh',
            gmail_address='user@gmail.com',
            status='error',
            last_error='Token expired'
        )
        
        serializer = GmailIntegrationSerializer(integration)
        data = serializer.data
        
        assert data['status'] == 'error'
        assert data['last_error'] == 'Token expired'


@pytest.mark.django_db
class TestApplicationEmailSerializer:
    """Tests for ApplicationEmailSerializer"""
    
    def test_serialize_application_email(self, user, gmail_integration, job_entry):
        """Test serializing application email"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            thread_id='thread123',
            subject='Interview Invitation',
            sender_email='hr@techcorp.com',
            sender_name='HR Department',
            received_at=timezone.now(),
            snippet='Email preview',
            body_text='Full email body',
            email_type='interview_invitation',
            confidence_score=0.9,
            suggested_job_status='phone',
            job=job_entry
        )
        
        serializer = ApplicationEmailSerializer(email)
        data = serializer.data
        
        assert data['id'] == str(email.id)
        assert data['subject'] == 'Interview Invitation'
        assert data['sender_email'] == 'hr@techcorp.com'
        assert data['sender_name'] == 'HR Department'
        assert data['email_type'] == 'interview_invitation'
        assert data['confidence_score'] == 0.9
        assert data['suggested_job_status'] == 'phone'
        assert data['job'] == job_entry.id
    
    def test_serialize_email_without_job(self, user, gmail_integration):
        """Test serializing email without linked job"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            thread_id='thread123',
            subject='Test Email',
            sender_email='sender@example.com',
            received_at=timezone.now(),
            job=None
        )
        
        serializer = ApplicationEmailSerializer(email)
        data = serializer.data
        
        assert data['job'] is None
    
    def test_serialize_includes_timestamps(self, user, gmail_integration):
        """Test serializer includes timestamp fields"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            thread_id='thread123',
            subject='Test',
            sender_email='sender@example.com',
            received_at=timezone.now()
        )
        
        serializer = ApplicationEmailSerializer(email)
        data = serializer.data
        
        assert 'received_at' in data
        assert 'created_at' in data
    
    def test_serialize_snippet_and_preview(self, user, gmail_integration):
        """Test serializer includes snippet and body text"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            thread_id='thread123',
            subject='Test',
            sender_email='sender@example.com',
            received_at=timezone.now(),
            snippet='Short preview',
            body_text='Full email content here'
        )
        
        serializer = ApplicationEmailSerializer(email)
        data = serializer.data
        
        assert data['snippet'] == 'Short preview'
    
    def test_deserialize_email_data(self, user, gmail_integration, job_entry):
        """Test deserializing email data - most fields are read-only"""
        data = {
            'subject': 'New Email',
            'job': job_entry.id
        }
        
        serializer = ApplicationEmailSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
    
    def test_validates_required_fields(self):
        """Test validation - subject is required but most other fields are read-only"""
        data = {}
        
        serializer = ApplicationEmailSerializer(data=data)
        assert not serializer.is_valid()
        assert 'subject' in serializer.errors


@pytest.mark.django_db
class TestEmailScanLogSerializer:
    """Tests for EmailScanLogSerializer"""
    
    def test_serialize_scan_log(self, gmail_integration):
        """Test serializing scan log"""
        log = EmailScanLog.objects.create(
            integration=gmail_integration,
            status='success'
        )
        log.completed_at = timezone.now()
        log.emails_processed = 8
        log.emails_matched = 5
        log.emails_linked = 3
        log.save()
        
        serializer = EmailScanLogSerializer(log)
        data = serializer.data
        
        assert data['emails_processed'] == 8
        assert data['emails_matched'] == 5
        assert data['emails_linked'] == 3
        assert data['status'] == 'success'
        assert 'started_at' in data
        assert 'completed_at' in data
    
    def test_serialize_failed_scan(self, gmail_integration):
        """Test serializing failed scan log"""
        log = EmailScanLog.objects.create(
            integration=gmail_integration,
            status='failed',
            error_message='API error'
        )
        
        serializer = EmailScanLogSerializer(log)
        data = serializer.data
        
        assert data['status'] == 'failed'
        assert data['error_message'] == 'API error'
        assert data['completed_at'] is None
    
    def test_serialize_in_progress_scan(self, gmail_integration):
        """Test serializing in-progress scan log"""
        log = EmailScanLog.objects.create(
            integration=gmail_integration,
            status='in_progress'
        )
        
        serializer = EmailScanLogSerializer(log)
        data = serializer.data
        
        assert data['status'] == 'in_progress'
        assert data['completed_at'] is None
        assert data['emails_processed'] == 0
    
    def test_serialize_includes_id(self, gmail_integration):
        """Test serializer includes log ID"""
        log = EmailScanLog.objects.create(
            integration=gmail_integration,
            status='success'
        )
        
        serializer = EmailScanLogSerializer(log)
        data = serializer.data
        
        assert 'id' in data
        assert data['id'] == log.id


@pytest.mark.django_db
class TestSerializerRelationships:
    """Tests for serializer relationships"""
    
    def test_email_serializer_shows_job_id(self, user, gmail_integration, job_entry):
        """Test email serializer includes job ID"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            thread_id='thread123',
            subject='Test',
            sender_email='sender@example.com',
            received_at=timezone.now(),
            job=job_entry
        )
        
        serializer = ApplicationEmailSerializer(email)
        data = serializer.data
        
        assert data['job'] == job_entry.id
    
    def test_serializer_list_multiple_emails(self, user, gmail_integration):
        """Test serializing multiple emails"""
        email1 = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg1',
            thread_id='thread1',
            subject='Email 1',
            sender_email='sender1@example.com',
            received_at=timezone.now()
        )
        
        email2 = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg2',
            thread_id='thread2',
            subject='Email 2',
            sender_email='sender2@example.com',
            received_at=timezone.now()
        )
        
        serializer = ApplicationEmailSerializer([email1, email2], many=True)
        data = serializer.data
        
        assert len(data) == 2
        assert data[0]['subject'] == 'Email 1'
        assert data[1]['subject'] == 'Email 2'
    
    def test_serializer_read_only_fields(self, user, gmail_integration):
        """Test read-only fields cannot be updated"""
        email = ApplicationEmail.objects.create(
            user=user,
            gmail_message_id='msg123',
            thread_id='thread123',
            subject='Original',
            sender_email='sender@example.com',
            received_at=timezone.now()
        )
        
        # Try to update with different created_at
        data = {
            'subject': 'Updated',
            'created_at': (timezone.now() - timedelta(days=10)).isoformat()
        }
        
        serializer = ApplicationEmailSerializer(email, data=data, partial=True)
        if serializer.is_valid():
            updated_email = serializer.save()
            
            # created_at should not change
            assert updated_email.created_at == email.created_at
