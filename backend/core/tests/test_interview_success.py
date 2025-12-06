import pytest
from datetime import timedelta
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.models import (
    CandidateProfile,
    JobEntry,
    InterviewSchedule,
    InterviewPreparationTask,
    InterviewChecklistProgress,
    JobMatchAnalysis,
    JobQuestionPractice,
)
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
class TestInterviewSuccessForecast:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user('forecast', 'forecast@example.com', 'password123')
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.job = JobEntry.objects.create(
            candidate=self.profile,
            title='Product Manager',
            company_name='Forecast Labs',
            location='Remote',
            status='interview',
        )
        self.interview = InterviewSchedule.objects.create(
            job=self.job,
            candidate=self.profile,
            interview_type='video',
            scheduled_at=timezone.now() + timedelta(days=2),
            duration_minutes=60,
        )

        InterviewPreparationTask.objects.create(
            interview=self.interview,
            task_type='research_company',
            title='Research Company',
            description='',
            is_completed=True,
            order=1,
        )
        InterviewPreparationTask.objects.create(
            interview=self.interview,
            task_type='prepare_questions',
            title='Questions',
            description='',
            is_completed=False,
            order=2,
        )

        InterviewChecklistProgress.objects.create(
            interview=self.interview,
            task_id='research_mission',
            category='Company Research',
            task='Research Mission',
            completed=True,
        )

        JobMatchAnalysis.objects.create(
            job=self.job,
            candidate=self.profile,
            overall_score=82,
            skills_score=80,
            experience_score=85,
            education_score=70,
            match_data={'breakdown': {}},
            user_weights={'skills': 0.5, 'experience': 0.3, 'education': 0.2},
        )

        JobQuestionPractice.objects.create(
            job=self.job,
            question_id='q1',
            category='behavioral',
            question_text='Tell me about a time',
            practice_count=1,
            total_duration_seconds=5400,
        )

        self.client.force_authenticate(self.user)

    def test_success_forecast_returns_probability_and_actions(self):
        url = reverse('interview-success-forecast')
        response = self.client.get(url, {'job': self.job.id, 'refresh': 'true'})
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['summary']['total_upcoming'] == 1
        assert data['accuracy']['tracked_predictions'] == 0

        interview_payload = data['interviews'][0]
        assert interview_payload['job_title'] == 'Product Manager'
        assert 'probability' in interview_payload
        assert interview_payload['probability'] > 0
        assert interview_payload['recommendations']
        assert interview_payload['action_items']

    def test_accuracy_populates_when_outcome_recorded(self):
        url = reverse('interview-success-forecast')
        # generate and store prediction snapshot
        self.client.get(url, {'job': self.job.id, 'refresh': 'true'})

        complete_url = reverse('interview-complete', kwargs={'pk': self.interview.id})
        complete_response = self.client.post(complete_url, {'outcome': 'good'}, format='json')
        assert complete_response.status_code == status.HTTP_200_OK

        prediction = self.interview.success_predictions.filter(is_latest=True).first()
        assert prediction is not None
        assert prediction.actual_outcome == 'good'
        assert prediction.accuracy is not None
