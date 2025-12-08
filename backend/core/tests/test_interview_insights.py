"""
Tests for UC-068: Interview Insights and Preparation
"""

import pytest
from unittest import mock
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from django.utils import timezone

from core.models import CandidateProfile, JobEntry, JobQuestionPractice, QuestionResponseCoaching

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
        url = reverse('job-interview-insights', kwargs={'job_id': self.job.id})
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
            assert 'task_id' in first_item
    
        # Verify disclaimer
        assert 'disclaimer' in data
        assert isinstance(data['disclaimer'], str)

    def test_preparation_checklist_toggle_persists(self):
        """Ensure checklist toggle saves and reflects in subsequent responses."""
        url = reverse('job-interview-insights', kwargs={'job_id': self.job.id})
        data = self.client.get(url).json()
        checklist = data['preparation_checklist']
        category = checklist[0]
        item = category['items'][0]

        toggle_url = reverse('job-preparation-checklist', kwargs={'job_id': self.job.id})
        payload = {
            'task_id': item['task_id'],
            'category': category['category'],
            'task': item['task'],
            'completed': True,
        }
        toggle_response = self.client.post(toggle_url, payload, format='json')
        assert toggle_response.status_code == status.HTTP_200_OK
        assert toggle_response.json()['completed'] is True

        refreshed = self.client.get(url).json()
        refreshed_item = refreshed['preparation_checklist'][0]['items'][0]
        assert refreshed_item['completed'] is True
    
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
        
        url = reverse('job-interview-insights', kwargs={'job_id': self.job.id})
        response = other_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert 'error' in data
        assert data['error']['code'] == 'job_not_found'


@pytest.mark.django_db
class TestInterviewQuestionBankEndpoint:
    """Tests for UC-075 question bank and practice tracking."""

    def setup_method(self):
        self.client = APIClient()
        User = get_user_model()
        self.user = User.objects.create_user(
            username='bank-user',
            email='bank@example.com',
            password='bankpass123',
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.job = JobEntry.objects.create(
            candidate=self.profile,
            title='Data Analyst',
            company_name='Insight Corp',
            industry='Finance',
            status='applied',
        )
        self.client.force_authenticate(user=self.user)

    def test_question_bank_structure(self):
        url = reverse('job-question-bank', kwargs={'job_id': self.job.id})
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data['job_title'] == 'Data Analyst'
        assert 'categories' in data and len(data['categories']) >= 2
        assert 'difficulty_levels' in data
        assert 'star_framework' in data and 'steps' in data['star_framework']

        first_category = data['categories'][0]
        assert 'questions' in first_category and len(first_category['questions']) > 0
        first_question = first_category['questions'][0]
        assert 'prompt' in first_question
        assert 'difficulty' in first_question
        assert 'practice_status' in first_question

    def test_question_practice_logging(self):
        bank_url = reverse('job-question-bank', kwargs={'job_id': self.job.id})
        bank_data = self.client.get(bank_url).json()
        question = bank_data['categories'][0]['questions'][0]

        practice_url = reverse('job-question-practice', kwargs={'job_id': self.job.id})
        payload = {
            'question_id': question['id'],
            'question_text': question['prompt'],
            'category': question['category'],
            'difficulty': question['difficulty'],
            'written_response': 'Outlined challenge and measurable impact.',
            'star_response': {
                'situation': 'Legacy process causing delays',
                'task': 'Lead analysis and redesign',
                'action': 'Built dashboards and alignment meetings',
                'result': 'Reduced SLA by 30%',
            },
        }

        response = self.client.post(practice_url, payload, format='json')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['practice_status']['practiced'] is True
        assert data['practice_status']['practice_count'] >= 1

    @mock.patch('core.views.response_coach.generate_coaching_feedback')
    def test_question_response_coach_endpoint(self, mock_generate):
        mock_generate.return_value = {
            'summary': 'Great framing with clear outcomes.',
            'scores': {'relevance': 90, 'specificity': 85, 'impact': 88, 'clarity': 84, 'overall': 87},
            'length_analysis': {'word_count': 180, 'spoken_time_seconds': 95, 'recommended_window': '90-120 seconds', 'recommendation': 'Keep result punchy.'},
            'feedback': {'content': ['Solid context'], 'structure': ['Lead with stakes'], 'clarity': ['Tight verbs']},
            'weak_language': {'patterns': [], 'summary': 'Confident tone'},
            'star_adherence': {'situation': {'status': 'covered', 'feedback': ''}, 'task': {'status': 'covered', 'feedback': ''}, 'action': {'status': 'covered', 'feedback': ''}, 'result': {'status': 'light', 'feedback': 'Add metric'}, 'overall_feedback': 'Add numbers'},
            'alternative_approaches': [],
            'improvement_focus': ['Add metric'],
            'history_callout': '',
        }

        url = reverse('job-question-response-coach', kwargs={'job_id': self.job.id})
        payload = {
            'question_id': 'coach-1',
            'question_text': 'Tell me about a time you influenced stakeholders.',
            'category': 'behavioral',
            'difficulty': 'mid',
            'written_response': 'I led a cross-team launch and improved adoption.',
            'star_response': {
                'situation': 'Launch lagging alignment.',
                'task': 'Unblock decision making.',
                'action': 'Created working group and weekly readouts.',
                'result': 'Adoption up 30%.',
            },
        }

        response = self.client.post(url, payload, format='json')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['coaching']['scores']['overall'] == 87
        assert data['practice_status']['latest_coaching']['scores']['overall'] == 87
        assert data['improvement']['session_count'] == 1
        assert mock_generate.called

    def test_practice_history_includes_coaching(self):
        log = JobQuestionPractice.objects.create(
            job=self.job,
            question_id='history-1',
            category='behavioral',
            question_text='Describe a leadership win.',
            difficulty='mid',
            skills=[],
            written_response='I led a migration.',
            star_response={'situation': 'Legacy system', 'task': 'Migrate', 'action': 'Led plan', 'result': 'Cut outages'},
        )
        QuestionResponseCoaching.objects.create(
            job=self.job,
            practice_log=log,
            question_id='history-1',
            question_text='Describe a leadership win.',
            response_text='I led a migration.',
            star_response=log.star_response,
            coaching_payload={'summary': 'Nice job', 'length_analysis': {'word_count': 120}, 'scores': {'overall': 80}},
            scores={'overall': 80},
            word_count=120,
        )

        url = reverse('get-question-practice-history', kwargs={'job_id': self.job.id, 'question_id': 'history-1'})
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert 'coaching_history' in data
        assert len(data['coaching_history']) == 1

    def test_question_bank_caching_and_refresh(self):
        url = reverse('job-question-bank', kwargs={'job_id': self.job.id})
        sample_bank = {
            'job_id': self.job.id,
            'job_title': self.job.title,
            'company_name': self.job.company_name,
            'industry': 'Finance',
            'generated_at': timezone.now().isoformat(),
            'difficulty_levels': [],
            'star_framework': {},
            'categories': [
                {
                    'id': 'behavioral',
                    'label': 'Behavioral',
                    'questions': [
                        {'id': 'q-cache', 'prompt': 'Prompt', 'category': 'behavioral', 'difficulty': 'mid', 'skills': [], 'concepts': []}
                    ],
                    'guidance': '',
                }
            ],
            'company_focus': [],
            'skills_referenced': [],
            'source': 'template',
        }

        with mock.patch('core.views.build_question_bank', return_value=sample_bank) as mock_builder:
            response1 = self.client.get(url)
            assert response1.status_code == status.HTTP_200_OK
            assert response1.json()['job_id'] == self.job.id
            assert mock_builder.call_count == 1

            mock_builder.reset_mock()
            response2 = self.client.get(url)
            assert response2.status_code == status.HTTP_200_OK
            mock_builder.assert_not_called()

            response3 = self.client.get(f'{url}?refresh=true')
            assert response3.status_code == status.HTTP_200_OK
            mock_builder.assert_called_once()
    
    def test_interview_insights_requires_authentication(self):
        """Test that endpoint requires authentication"""
        client = APIClient()  # Unauthenticated client
        url = reverse('job-interview-insights', kwargs={'job_id': self.job.id})
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
        tech_url = reverse('job-interview-insights', kwargs={'job_id': self.job.id})
        tech_response = self.client.get(tech_url)
        tech_data = tech_response.json()
        
        # Get insights for non-technical role
        non_tech_url = reverse('job-interview-insights', kwargs={'job_id': non_tech_job.id})
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
        url = reverse('job-interview-insights', kwargs={'job_id': 99999})
        response = self.client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert 'error' in data
        assert data['error']['code'] == 'job_not_found'
