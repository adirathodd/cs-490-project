import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from core.models import (
    CandidateProfile,
    InterviewChecklistProgress,
    InterviewSchedule,
    JobEntry,
    TechnicalPrepPractice,
)

User = get_user_model()


@pytest.mark.django_db
class TestInterviewPerformanceAnalytics:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user('analytics', 'analytics@example.com', 'password123')
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(self.user)

    def _create_interview_flow(self):
        job = JobEntry.objects.create(
            candidate=self.profile,
            title='Product Manager',
            company_name='Northwind',
            industry='Technology',
            status='offer',
        )
        interview = InterviewSchedule.objects.create(
            job=job,
            candidate=self.profile,
            interview_type='video',
            scheduled_at=timezone.now() - timezone.timedelta(days=3),
            duration_minutes=60,
            status='completed',
            outcome='good',
        )
        InterviewChecklistProgress.objects.create(
            interview=interview,
            task_id='research_company',
            category='Company Research',
            task='Review mission',
            completed=True,
        )
        TechnicalPrepPractice.objects.create(
            job=job,
            challenge_id='warmup-1',
            challenge_title='Arrays warmup',
            challenge_type='coding',
            duration_seconds=1800,
            score=85,
        )
        return job, interview

    def test_returns_interview_analytics_payload(self):
        self._create_interview_flow()
        url = reverse('core:interview-performance-analytics')
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['summary']['total_interviews'] == 1
        assert data['summary']['offers_won'] == 1
        assert data['company_type_trends']
        video_format = next(item for item in data['format_performance'] if item['interview_type'] == 'video')
        assert video_format['unique_processes'] == 1
        assert video_format['conversion_rate'] >= 100.0
        assert data['preparation_areas']['areas'][0]['category'] == 'Company Research'
        assert data['practice_impact']['summary']['jobs_with_practice'] == 1
        assert data['practice_impact']['summary']['avg_score'] == 85.0
        assert data['timeline']['monthly']

    def test_empty_state_when_no_interviews(self):
        url = reverse('core:interview-performance-analytics')
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['summary']['total_interviews'] == 0
        assert data['company_type_trends'] == []
