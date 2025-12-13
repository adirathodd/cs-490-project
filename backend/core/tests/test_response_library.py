"""
Tests for UC-126: Interview Response Library.
"""
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from django.urls import reverse

from core.models import (
    CandidateProfile, JobEntry, InterviewResponseLibrary, ResponseVersion,
    QuestionResponseCoaching, JobQuestionPractice
)

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(username='testuser', password='testpass123', email='test@example.com')


@pytest.fixture
def profile(db, user):
    return CandidateProfile.objects.create(user=user, headline='Software Engineer')


@pytest.fixture
def job(db, profile):
    return JobEntry.objects.create(
        candidate=profile,
        title='Senior Software Engineer',
        company_name='Tech Corp',
        description='Build awesome software with Python and React.',
    )


@pytest.fixture
def authenticated_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestInterviewResponseLibraryModel:
    """Test the InterviewResponseLibrary model."""
    
    def test_create_response_library_entry(self, user):
        response = InterviewResponseLibrary.objects.create(
            user=user,
            question_text='Tell me about a time you led a project.',
            question_type='behavioral',
            current_response_text='I led a project where I managed a team of 5 engineers...',
            current_star_response={
                'situation': 'Managing a critical project',
                'task': 'Deliver on time',
                'action': 'Organized daily standups',
                'result': 'Delivered 2 weeks early'
            },
            skills=['leadership', 'project management'],
            tags=['management', 'teamwork'],
        )
        
        assert response.id is not None
        assert response.question_type == 'behavioral'
        assert response.times_used == 0
        assert response.success_rate == 0.0
        assert response.led_to_offer is False
    
    def test_calculate_success_rate(self, user):
        response = InterviewResponseLibrary.objects.create(
            user=user,
            question_text='Test question',
            question_type='behavioral',
            current_response_text='Test response',
            times_used=5,
            led_to_next_round=True,
        )
        
        response.calculate_success_rate()
        assert response.success_rate > 0
    
    def test_response_version_creation(self, user):
        response = InterviewResponseLibrary.objects.create(
            user=user,
            question_text='Test question',
            question_type='behavioral',
            current_response_text='Version 1',
        )
        
        version = ResponseVersion.objects.create(
            response_library=response,
            version_number=1,
            response_text='Version 1',
            change_notes='Initial version',
        )
        
        assert version.response_library == response
        assert version.version_number == 1


@pytest.mark.django_db
class TestResponseLibraryAPI:
    """Test the Response Library API endpoints."""
    
    def test_list_responses_empty(self, authenticated_client):
        url = reverse('response-library-list')
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert 'responses' in response.data
        assert 'gap_analysis' in response.data
        assert len(response.data['responses']) == 0
    
    def test_create_response(self, authenticated_client):
        url = reverse('response-library-list')
        data = {
            'question_text': 'Describe a challenging project.',
            'question_type': 'behavioral',
            'response_text': 'I worked on a challenging project where...',
            'star_response': {
                'situation': 'Complex technical challenge',
                'task': 'Solve the problem',
                'action': 'Researched and implemented solution',
                'result': 'Successful delivery'
            },
            'skills': ['problem-solving', 'technical'],
            'tags': ['challenge', 'technical'],
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert 'id' in response.data
        assert response.data['message'] == 'Response added to library'
        
        # Verify it was created with a version
        library_response = InterviewResponseLibrary.objects.get(id=response.data['id'])
        assert library_response.versions.count() == 1
        assert library_response.versions.first().version_number == 1
    
    def test_list_responses_with_filter(self, authenticated_client, user):
        # Create responses of different types
        InterviewResponseLibrary.objects.create(
            user=user,
            question_text='Behavioral question',
            question_type='behavioral',
            current_response_text='Response 1',
        )
        InterviewResponseLibrary.objects.create(
            user=user,
            question_text='Technical question',
            question_type='technical',
            current_response_text='Response 2',
        )
        
        # Filter by behavioral
        url = reverse('response-library-list') + '?type=behavioral'
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['responses']) == 1
        assert response.data['responses'][0]['question_type'] == 'behavioral'
    
    def test_get_response_detail(self, authenticated_client, user):
        library_response = InterviewResponseLibrary.objects.create(
            user=user,
            question_text='Test question',
            question_type='behavioral',
            current_response_text='Test response',
        )
        
        # Create a version
        ResponseVersion.objects.create(
            response_library=library_response,
            version_number=1,
            response_text='Test response',
            change_notes='Initial',
        )
        
        url = reverse('response-library-detail', kwargs={'response_id': library_response.id})
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['question_text'] == 'Test question'
        assert len(response.data['versions']) == 1
    
    def test_update_response(self, authenticated_client, user):
        library_response = InterviewResponseLibrary.objects.create(
            user=user,
            question_text='Test question',
            question_type='behavioral',
            current_response_text='Original response',
        )
        
        ResponseVersion.objects.create(
            response_library=library_response,
            version_number=1,
            response_text='Original response',
        )
        
        url = reverse('response-library-detail', kwargs={'response_id': library_response.id})
        data = {
            'response_text': 'Updated response',
            'tags': ['updated', 'improved'],
            'led_to_offer': True,
            'change_notes': 'Improved clarity',
        }
        
        response = authenticated_client.put(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify update
        library_response.refresh_from_db()
        assert library_response.current_response_text == 'Updated response'
        assert 'updated' in library_response.tags
        assert library_response.led_to_offer is True
        
        # Verify new version was created
        assert library_response.versions.count() == 2
        assert library_response.versions.first().version_number == 2
    
    def test_delete_response(self, authenticated_client, user):
        library_response = InterviewResponseLibrary.objects.create(
            user=user,
            question_text='Test question',
            question_type='behavioral',
            current_response_text='Test response',
        )
        
        url = reverse('response-library-detail', kwargs={'response_id': library_response.id})
        response = authenticated_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not InterviewResponseLibrary.objects.filter(id=library_response.id).exists()
    
    def test_record_usage(self, authenticated_client, user):
        library_response = InterviewResponseLibrary.objects.create(
            user=user,
            question_text='Test question',
            question_type='behavioral',
            current_response_text='Test response',
            times_used=2,
        )
        
        url = reverse('response-library-record-usage', kwargs={'response_id': library_response.id})
        data = {
            'company_name': 'Google',
            'led_to_next_round': True,
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        
        library_response.refresh_from_db()
        assert library_response.times_used == 3
        assert library_response.led_to_next_round is True
        assert 'Google' in library_response.companies_used_for
    
    def test_save_from_coaching(self, authenticated_client, user, profile, job):
        # Create a practice log and coaching session
        practice_log = JobQuestionPractice.objects.create(
            job=job,
            question_id='test-q1',
            question_text='Tell me about a challenge',
            category='behavioral',
            difficulty='mid',
            written_response='I faced a challenge when...',
            star_response={
                'situation': 'Test situation',
                'task': 'Test task',
                'action': 'Test action',
                'result': 'Test result'
            }
        )
        
        coaching_session = QuestionResponseCoaching.objects.create(
            job=job,
            practice_log=practice_log,
            question_id='test-q1',
            question_text='Tell me about a challenge',
            response_text='I faced a challenge when...',
            star_response=practice_log.star_response,
            scores={'overall': 85},
        )
        
        url = reverse('response-library-save-from-coaching')
        data = {
            'coaching_session_id': coaching_session.id,
            'question_type': 'behavioral',
            'tags': ['challenge', 'problem-solving'],
            'skills': ['resilience', 'adaptability'],
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['action'] == 'created'
        
        # Verify the response was saved
        library_response = InterviewResponseLibrary.objects.get(id=response.data['id'])
        assert library_response.question_text == 'Tell me about a challenge'
        assert 'challenge' in library_response.tags
        assert library_response.versions.count() == 1
        assert library_response.versions.first().coaching_session == coaching_session


@pytest.mark.django_db
class TestResponseSuggestionEngine:
    """Test the response suggestion engine."""
    
    def test_suggest_responses_for_job(self, authenticated_client, user, profile, job):
        # Create some responses
        response1 = InterviewResponseLibrary.objects.create(
            user=user,
            question_text='Leadership question',
            question_type='behavioral',
            current_response_text='Led a team...',
            skills=['leadership', 'management'],
            led_to_offer=True,
            times_used=3,
            success_rate=100.0,
        )
        
        response2 = InterviewResponseLibrary.objects.create(
            user=user,
            question_text='Technical question',
            question_type='technical',
            current_response_text='Solved a technical problem...',
            skills=['python', 'debugging'],
            led_to_next_round=True,
            times_used=2,
        )
        
        url = reverse('response-library-suggestions', kwargs={'job_id': job.id})
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert 'suggestions' in response.data
        assert len(response.data['suggestions']) > 0
        
        # Suggestions should be sorted by score
        if len(response.data['suggestions']) > 1:
            scores = [s['match_score'] for s in response.data['suggestions']]
            assert scores == sorted(scores, reverse=True)


@pytest.mark.django_db
class TestGapAnalysis:
    """Test gap analysis functionality."""
    
    def test_gap_analysis_with_empty_library(self, authenticated_client):
        url = reverse('response-library-list')
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        gap = response.data['gap_analysis']
        
        assert gap['total_responses'] == 0
        assert gap['by_type']['behavioral'] == 0
        assert len(gap['recommendations']) > 0
    
    def test_gap_analysis_with_responses(self, authenticated_client, user):
        # Create several behavioral responses
        for i in range(5):
            InterviewResponseLibrary.objects.create(
                user=user,
                question_text=f'Behavioral question {i}',
                question_type='behavioral',
                current_response_text=f'Response {i}',
                tags=['leadership'] if i < 2 else ['teamwork'],
            )
        
        # Create one technical response
        InterviewResponseLibrary.objects.create(
            user=user,
            question_text='Technical question',
            question_type='technical',
            current_response_text='Technical response',
        )
        
        url = reverse('response-library-list')
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        gap = response.data['gap_analysis']
        
        assert gap['total_responses'] == 6
        assert gap['by_type']['behavioral'] == 5
        assert gap['by_type']['technical'] == 1
        assert gap['by_type']['situational'] == 0


@pytest.mark.django_db
class TestResponseLibraryExport:
    """Test export functionality."""
    
    def test_export_as_text(self, authenticated_client, user):
        InterviewResponseLibrary.objects.create(
            user=user,
            question_text='Test question',
            question_type='behavioral',
            current_response_text='Test response',
            skills=['skill1', 'skill2'],
        )
        
        url = reverse('response-library-export') + '?format=text'
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert 'text/plain' in response['Content-Type']
        assert b'INTERVIEW RESPONSE LIBRARY' in response.content
    
    def test_export_as_json(self, authenticated_client, user):
        InterviewResponseLibrary.objects.create(
            user=user,
            question_text='Test question',
            question_type='behavioral',
            current_response_text='Test response',
        )
        
        url = reverse('response-library-export') + '?format=json'
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert 'application/json' in response['Content-Type']
