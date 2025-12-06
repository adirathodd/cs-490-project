import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import CandidateProfile, JobEntry

User = get_user_model()


@pytest.mark.django_db
class TestSalaryNegotiationPrep:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='nego-user', email='nego@example.com', password='pass')
        self.profile = CandidateProfile.objects.create(user=self.user, years_experience=6, summary='Scaled revenue by 35%')
        self.client.force_authenticate(self.user)
        self.job = JobEntry.objects.create(
            candidate=self.profile,
            title='Senior Product Manager',
            company_name='Helios Labs',
            location='San Francisco, CA',
            job_type='ft',
            salary_min=150000,
            salary_max=190000,
            description='Own roadmap for growth initiatives',
        )

    def test_plan_is_generated_on_first_request(self):
        url = reverse('salary-negotiation-prep', kwargs={'job_id': self.job.id})
        resp = self.client.get(url)
        assert resp.status_code == 200
        payload = resp.json()
        assert payload['job_id'] == self.job.id
        plan = payload['plan']
        assert plan['market_context']['title'] == 'Senior Product Manager'
        assert len(plan['talking_points']) > 0
        assert plan['offer_guidance']

    def test_plan_refresh_accepts_offer_details(self):
        url = reverse('salary-negotiation-prep', kwargs={'job_id': self.job.id})
        resp = self.client.post(
            url,
            {
                'force_refresh': True,
                'offer_details': {
                    'base_salary': 160000,
                    'bonus': 20000,
                    'equity': 50000,
                    'respond_by': '2025-12-01',
                },
            },
            format='json',
        )
        assert resp.status_code == 201
        plan = resp.json()['plan']
        assert plan['offer_guidance']['offer_details']['base_salary'] == 160000.0
        assert plan['offer_guidance']['gaps']

    def test_outcome_logging_and_stats(self):
        outcomes_url = reverse('salary-negotiation-outcomes', kwargs={'job_id': self.job.id})
        resp = self.client.post(
            outcomes_url,
            {
                'stage': 'offer',
                'company_offer': 150000,
                'counter_amount': 175000,
                'final_result': 170000,
                'confidence_score': 4,
                'status': 'pending',
                'notes': 'Team considering higher base',
            },
            format='json',
        )
        assert resp.status_code == 201
        resp = self.client.get(outcomes_url)
        assert resp.status_code == 200
        body = resp.json()
        assert body['stats']['attempts'] == 1
        assert len(body['results']) == 1
        assert body['results'][0]['final_result'] == 170000.0
