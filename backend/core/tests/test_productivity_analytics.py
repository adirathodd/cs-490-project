import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import (
    CandidateProfile,
    JobEntry,
    MockInterviewSession,
    Skill,
    SkillDevelopmentProgress,
)

User = get_user_model()


@pytest.mark.django_db
class TestProductivityAnalytics:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='productivity', email='prod@example.com', password='pass')
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def test_productivity_analytics_shapes_response(self):
        skill = Skill.objects.create(name='Python')
        SkillDevelopmentProgress.objects.create(
            candidate=self.profile,
            skill=skill,
            hours_spent=1.5,
        )

        job = JobEntry.objects.create(candidate=self.profile, title='Engineer', company_name='ACME', status='applied')
        job.application_history = [{'action': 'Applied', 'timestamp': timezone.now().isoformat()}]
        job.save(update_fields=['application_history'])

        MockInterviewSession.objects.create(
            user=self.user,
            interview_type='behavioral',
            status='completed',
            total_duration_seconds=900,
        )

        url = reverse('core:productivity-analytics')
        resp = self.client.get(url)
        assert resp.status_code == 200

        payload = resp.json()
        assert 'time_investment' in payload
        assert payload['time_investment']['total_hours'] > 0
        assert 'patterns' in payload
        assert isinstance(payload['patterns'].get('by_time_block', []), list)
        assert 'recommendations' in payload
