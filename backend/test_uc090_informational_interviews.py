"""
Test suite for UC-090: Informational Interview Management
Tests model, serializers, and API endpoints
"""
import pytest
import json
from datetime import datetime, timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from core.models import (
    InformationalInterview, 
    Contact, 
    JobEntry, 
    Tag,
    CandidateProfile
)

User = get_user_model()


@pytest.fixture
def user(db):
    """Create a test user"""
    return User.objects.create_user(
        username='testuser',
        email='testuser@example.com',
        password='testpass123'
    )


@pytest.fixture
def profile(user):
    """Create a candidate profile"""
    return CandidateProfile.objects.create(
        user=user
    )


@pytest.fixture
def contact(user):
    """Create a test contact"""
    return Contact.objects.create(
        owner=user,
        first_name='Jane',
        last_name='Smith',
        display_name='Jane Smith',
        email='jane.smith@example.com',
        title='Senior Software Engineer',
        company_name='Tech Corp',
        industry='Technology',
        location='San Francisco, CA',
        relationship_type='professional'
    )


@pytest.fixture
def job_entry(profile):
    """Create a test job entry"""
    return JobEntry.objects.create(
        candidate=profile,
        company_name='Tech Corp',
        title='Software Engineer'
    )


@pytest.fixture
def tag(user):
    """Create a test tag"""
    return Tag.objects.create(
        owner=user,
        name='High Priority'
    )


@pytest.fixture
def api_client(user):
    """Create an authenticated API client"""
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def interview(user, contact):
    """Create a test informational interview"""
    return InformationalInterview.objects.create(
        user=user,
        contact=contact,
        status='identified',
        preparation_notes='Prepare questions about career path',
        questions_to_ask=['What does a typical day look like?', 'How did you get started?'],
        goals=['Learn about industry trends', 'Build relationship']
    )


@pytest.mark.django_db
class TestInformationalInterviewModel:
    """Test InformationalInterview model"""
    
    def test_create_interview(self, user, contact):
        """Test creating an informational interview"""
        interview = InformationalInterview.objects.create(
            user=user,
            contact=contact,
            status='identified',
            preparation_notes='Test notes'
        )
        
        assert interview.id is not None
        assert interview.user == user
        assert interview.contact == contact
        assert interview.status == 'identified'
        assert interview.outcome == ''
    
    def test_mark_outreach_sent(self, interview):
        """Test marking outreach as sent"""
        assert interview.status == 'identified'
        assert interview.outreach_sent_at is None
        
        interview.mark_outreach_sent()
        
        assert interview.status == 'outreach_sent'
        assert interview.outreach_sent_at is not None
    
    def test_mark_scheduled(self, interview):
        """Test marking interview as scheduled"""
        interview.mark_outreach_sent()
        scheduled_time = timezone.now() + timedelta(days=7)
        
        interview.mark_scheduled(scheduled_time)
        
        assert interview.status == 'scheduled'
        assert interview.scheduled_at == scheduled_time
    
    def test_mark_completed(self, interview):
        """Test marking interview as completed"""
        interview.mark_outreach_sent()
        scheduled_time = timezone.now() + timedelta(days=7)
        interview.mark_scheduled(scheduled_time)
        
        interview.mark_completed('excellent')
        
        assert interview.status == 'completed'
        assert interview.outcome == 'excellent'
        assert interview.completed_at is not None
    
    def test_json_fields(self, interview):
        """Test JSON fields work correctly"""
        interview.questions_to_ask = ['Question 1', 'Question 2']
        interview.goals = ['Goal 1', 'Goal 2']
        interview.key_insights = ['Insight 1', 'Insight 2']
        interview.save()
        
        # Refresh from database
        interview.refresh_from_db()
        
        assert isinstance(interview.questions_to_ask, list)
        assert len(interview.questions_to_ask) == 2
        assert interview.questions_to_ask[0] == 'Question 1'
    
    def test_relationships(self, interview, job_entry, tag):
        """Test many-to-many relationships"""
        interview.connected_jobs.add(job_entry)
        interview.tags.add(tag)
        
        assert interview.connected_jobs.count() == 1
        assert interview.tags.count() == 1
        assert interview.connected_jobs.first() == job_entry


@pytest.mark.django_db
class TestInformationalInterviewAPI:
    """Test Informational Interview API endpoints"""
    
    def test_list_interviews(self, api_client, interview):
        """Test listing informational interviews"""
        response = api_client.get('/api/informational-interviews')
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]['id'] == str(interview.id)
        assert data[0]['status'] == 'identified'
    
    def test_create_interview(self, api_client, contact, profile):
        """Test creating an informational interview"""
        data = {
            'contact': str(contact.id),
            'status': 'identified',
            'preparation_notes': 'Prepare thoroughly',
            'questions_to_ask': ['Question 1', 'Question 2'],
            'goals': ['Goal 1', 'Goal 2']
        }
        
        response = api_client.post(
            '/api/informational-interviews',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        result = response.json()
        assert result['contact'] == str(contact.id)
        assert result['status'] == 'identified'
        assert len(result['questions_to_ask']) == 2
    
    def test_retrieve_interview(self, api_client, interview):
        """Test retrieving a specific interview"""
        response = api_client.get(f'/api/informational-interviews/{interview.id}')
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['id'] == str(interview.id)
        assert 'contact_details' in data
        assert data['contact_details']['display_name'] == 'Jane Smith'
    
    def test_update_interview(self, api_client, interview):
        """Test updating an interview"""
        data = {
            'preparation_notes': 'Updated notes',
            'status': 'outreach_sent'
        }
        
        response = api_client.patch(
            f'/api/informational-interviews/{interview.id}',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert result['preparation_notes'] == 'Updated notes'
    
    def test_delete_interview(self, api_client, interview):
        """Test deleting an interview"""
        interview_id = interview.id
        
        response = api_client.delete(f'/api/informational-interviews/{interview_id}')
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not InformationalInterview.objects.filter(id=interview_id).exists()
    
    def test_mark_outreach_sent_endpoint(self, api_client, interview):
        """Test mark outreach sent endpoint"""
        response = api_client.post(
            f'/api/informational-interviews/{interview.id}/mark-outreach-sent'
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['status'] == 'outreach_sent'
        assert data['outreach_sent_at'] is not None
    
    def test_mark_scheduled_endpoint(self, api_client, interview):
        """Test mark scheduled endpoint"""
        interview.mark_outreach_sent()
        
        scheduled_time = (timezone.now() + timedelta(days=7)).isoformat()
        data = {'scheduled_at': scheduled_time}
        
        response = api_client.post(
            f'/api/informational-interviews/{interview.id}/mark-scheduled',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert result['status'] == 'scheduled'
        assert result['scheduled_at'] is not None
    
    def test_mark_completed_endpoint(self, api_client, interview):
        """Test mark completed endpoint"""
        interview.mark_outreach_sent()
        scheduled_time = timezone.now() + timedelta(days=7)
        interview.mark_scheduled(scheduled_time)
        
        data = {'outcome': 'excellent'}
        
        response = api_client.post(
            f'/api/informational-interviews/{interview.id}/mark-completed',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert result['status'] == 'completed'
        assert result['outcome'] == 'excellent'
        assert result['completed_at'] is not None
    
    def test_filter_by_status(self, api_client, user, contact):
        """Test filtering interviews by status"""
        # Create interviews with different statuses
        InformationalInterview.objects.create(
            user=user, contact=contact, status='identified'
        )
        InformationalInterview.objects.create(
            user=user, contact=contact, status='scheduled'
        )
        
        response = api_client.get('/api/informational-interviews?status=identified')
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]['status'] == 'identified'
    
    def test_generate_outreach_template(self, api_client, interview):
        """Test generating outreach template"""
        data = {'style': 'professional'}
        
        response = api_client.post(
            f'/api/informational-interviews/{interview.id}/generate-outreach',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert 'template' in result
        assert 'Jane Smith' in result['template'] or 'Jane' in result['template']
        assert result['style'] == 'professional'
    
    def test_generate_preparation_framework(self, api_client, interview):
        """Test generating preparation framework"""
        response = api_client.post(
            f'/api/informational-interviews/{interview.id}/generate-preparation'
        )
        
        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert 'suggested_questions' in result
        assert 'research_checklist' in result
        assert 'suggested_goals' in result
        assert len(result['suggested_questions']) > 0
    
    def test_analytics_endpoint(self, api_client, user, contact):
        """Test analytics endpoint"""
        # Create interviews with various statuses
        for status_val in ['identified', 'outreach_sent', 'scheduled', 'completed']:
            interview = InformationalInterview.objects.create(
                user=user,
                contact=contact,
                status=status_val
            )
            if status_val == 'completed':
                interview.outcome = 'excellent'
                interview.led_to_job_application = True
                interview.save()
        
        response = api_client.get('/api/informational-interviews/analytics')
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert 'overview' in data
        assert 'success_metrics' in data
        assert 'impact' in data
        assert data['overview']['total'] == 4
        assert data['success_metrics']['completed'] == 1
        assert data['impact']['led_to_job_application'] == 1
    
    def test_unauthorized_access(self):
        """Test that unauthenticated users cannot access endpoints"""
        client = APIClient()
        
        response = client.get('/api/informational-interviews')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_cannot_access_other_users_interviews(self, api_client, interview):
        """Test users cannot access other users' interviews"""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='pass123'
        )
        other_contact = Contact.objects.create(
            owner=other_user,
            display_name='Other Contact'
        )
        other_interview = InformationalInterview.objects.create(
            user=other_user,
            contact=other_contact,
            status='identified'
        )
        
        response = api_client.get(f'/api/informational-interviews/{other_interview.id}')
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestInformationalInterviewValidation:
    """Test serializer validation"""
    
    def test_status_transition_validation(self, api_client, interview):
        """Test invalid status transitions are rejected"""
        # Try to go from 'identified' directly to 'completed' (invalid)
        data = {'status': 'completed'}
        
        response = api_client.patch(
            f'/api/informational-interviews/{interview.id}',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        # Should fail validation
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_relationship_strength_validation(self, api_client, interview):
        """Test relationship strength change must be in valid range"""
        # Try to set invalid relationship strength change
        data = {'relationship_strength_change': 10}  # Invalid (> 5)
        
        response = api_client.patch(
            f'/api/informational-interviews/{interview.id}',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_contact_ownership_validation(self, api_client, profile):
        """Test cannot create interview with another user's contact"""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='pass123'
        )
        other_contact = Contact.objects.create(
            owner=other_user,
            display_name='Other Contact'
        )
        
        data = {
            'contact': str(other_contact.id),
            'status': 'identified'
        }
        
        response = api_client.post(
            '/api/informational-interviews',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
