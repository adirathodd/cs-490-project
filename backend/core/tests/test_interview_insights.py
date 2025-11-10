"""
Tests for UC-068: Interview Insights and Preparation
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse

from core.models import CandidateProfile, JobEntry

User = get_user_model()


@pytest.mark.django_db
class TestInterviewInsightsEndpoint:
    """Test suite for interview insights endpoint"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.client = APIClient()
        
        # Create test user and profile
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        
        # Create a test job
        self.job = JobEntry.objects.create(
            candidate=self.profile,
            title='Senior Software Engineer',
            company_name='Tech Corp',
            location='San Francisco, CA',
            job_type='ft',
            status='applied'
        )
        
        # Authenticate client
        self.client.force_authenticate(user=self.user)
    
    def test_interview_insights_returns_expected_structure(self):
        """Test that endpoint returns properly structured interview insights"""
        url = reverse('core:job-interview-insights', kwargs={'job_id': self.job.id})
        response = self.client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Verify top-level structure
        assert data['has_data'] is True
        assert data['job_title'] == 'Senior Software Engineer'
        assert data['company_name'] == 'Tech Corp'
        
        # Verify process overview
        assert 'process_overview' in data
        process = data['process_overview']
        assert 'total_stages' in process
        assert 'estimated_duration' in process
        assert 'stages' in process
        assert len(process['stages']) > 0
        
        # Verify stage structure
        first_stage = process['stages'][0]
        assert 'stage_number' in first_stage
        assert 'name' in first_stage
        assert 'duration' in first_stage
        assert 'description' in first_stage
        assert 'activities' in first_stage
        assert isinstance(first_stage['activities'], list)
        
        # Verify common questions
        assert 'common_questions' in data
        questions = data['common_questions']
        assert 'technical' in questions
        assert 'behavioral' in questions
        assert isinstance(questions['behavioral'], list)
        
        # Verify preparation recommendations
        assert 'preparation_recommendations' in data
        assert isinstance(data['preparation_recommendations'], list)
        assert len(data['preparation_recommendations']) > 0
        
        # Verify timeline
        assert 'timeline' in data
        timeline = data['timeline']
        assert 'total_duration' in timeline
        assert 'response_time' in timeline
        assert 'between_rounds' in timeline
        assert 'final_decision' in timeline
        
        # Verify success tips
        assert 'success_tips' in data
        assert isinstance(data['success_tips'], list)
        assert len(data['success_tips']) > 0
        
        # Verify preparation checklist
        assert 'preparation_checklist' in data
        checklist = data['preparation_checklist']
        assert isinstance(checklist, list)
        assert len(checklist) > 0
        
        first_category = checklist[0]
        assert 'category' in first_category
        assert 'items' in first_category
        assert isinstance(first_category['items'], list)
        
        if len(first_category['items']) > 0:
            first_item = first_category['items'][0]
            assert 'task' in first_item
            assert 'completed' in first_item
        
        # Verify disclaimer
        assert 'disclaimer' in data
        assert isinstance(data['disclaimer'], str)
    
    def test_interview_insights_requires_job_ownership(self):
        """Test that users can only access insights for their own jobs"""
        # Create another user
        other_user = User.objects.create_user(
            username='another-user',
            email='another@example.com',
            password='pass',
        )
        CandidateProfile.objects.create(user=other_user)
        
        other_client = APIClient()
        other_client.force_authenticate(user=other_user)
        
        url = reverse('core:job-interview-insights', kwargs={'job_id': self.job.id})
        response = other_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert 'error' in data
        assert data['error']['code'] == 'job_not_found'
    
    def test_interview_insights_requires_authentication(self):
        """Test that endpoint requires authentication"""
        client = APIClient()  # Unauthenticated client
        url = reverse('core:job-interview-insights', kwargs={'job_id': self.job.id})
        response = client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_interview_insights_technical_vs_non_technical(self):
        """Test that insights differ for technical vs non-technical roles"""
        # Create a non-technical job
        non_tech_job = JobEntry.objects.create(
            candidate=self.profile,
            title='Marketing Manager',
            company_name='Marketing Inc',
            location='New York, NY',
            job_type='ft',
            status='interested'
        )
        
        # Get insights for technical role
        tech_url = reverse('core:job-interview-insights', kwargs={'job_id': self.job.id})
        tech_response = self.client.get(tech_url)
        tech_data = tech_response.json()
        
        # Get insights for non-technical role
        non_tech_url = reverse('core:job-interview-insights', kwargs={'job_id': non_tech_job.id})
        non_tech_response = self.client.get(non_tech_url)
        non_tech_data = non_tech_response.json()
        
        # Technical role should have technical questions
        assert len(tech_data['common_questions']['technical']) > 0
        
        # Non-technical role should not have technical questions
        assert len(non_tech_data['common_questions']['technical']) == 0
        
        # Both should have behavioral questions
        assert len(tech_data['common_questions']['behavioral']) > 0
        assert len(non_tech_data['common_questions']['behavioral']) > 0
    
    def test_interview_insights_for_nonexistent_job(self):
        """Test that endpoint returns 404 for non-existent job"""
        url = reverse('core:job-interview-insights', kwargs={'job_id': 99999})
        response = self.client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert 'error' in data
        assert data['error']['code'] == 'job_not_found'
