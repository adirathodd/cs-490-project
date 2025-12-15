import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import CandidateProfile, JobEntry, JobOffer

User = get_user_model()


@pytest.mark.django_db
class TestJobOfferComparison:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='offer-user', email='offer@example.com', password='pass')
        self.profile = CandidateProfile.objects.create(user=self.user, headline='Product leader')
        self.client.force_authenticate(self.user)
        self.job = JobEntry.objects.create(
            candidate=self.profile,
            title='Product Manager',
            company_name='Axis Labs',
            location='New York, NY',
            job_type='ft',
        )

    def test_create_and_list_offers(self):
        url = reverse('job-offers')
        resp = self.client.post(
            url,
            {
                'job_id': self.job.id,
                'role_title': 'Senior PM',
                'company_name': 'Axis Labs',
                'location': 'New York, NY',
                'remote_policy': 'hybrid',
                'base_salary': 180000,
                'bonus': 20000,
                'equity': 30000,
                'benefits': {'healthValue': 6000, 'retirementValue': 4000, 'ptoDays': 20},
                'culture_fit_score': 8,
                'growth_opportunity_score': 9,
                'work_life_balance_score': 6,
            },
            format='json',
        )
        assert resp.status_code == 201
        data = resp.json()['result']
        assert data['company_name'] == 'Axis Labs'

        resp = self.client.get(url)
        assert resp.status_code == 200
        body = resp.json()
        assert len(body['results']) == 1
        assert body['results'][0]['benefits_total_value'] > 0

    def test_comparison_matrix_and_scenario(self):
        JobOffer.objects.create(
            candidate=self.profile,
            job=self.job,
            role_title='Offer A',
            company_name='Axis Labs',
            location='New York, NY',
            base_salary=180000,
            bonus=20000,
            equity=20000,
            benefits_breakdown={'health_value': 5000},
            benefits_total_value=5000,
            culture_fit_score=8,
            growth_opportunity_score=9,
            work_life_balance_score=7,
        )
        JobOffer.objects.create(
            candidate=self.profile,
            role_title='Offer B',
            company_name='Northwind',
            location='Austin, TX',
            base_salary=150000,
            bonus=15000,
            equity=15000,
            benefits_breakdown={'health_value': 4000},
            benefits_total_value=4000,
            culture_fit_score=7,
            growth_opportunity_score=8,
            work_life_balance_score=8,
        )

        url = reverse('job-offer-comparison')
        resp = self.client.get(url)
        assert resp.status_code == 200
        body = resp.json()
        assert len(body['offers']) == 2
        assert body['matrix']['headers'][0]['company'] == 'Axis Labs'
        row_keys = {row['key'] for row in body['matrix']['rows']}
        assert 'adjusted_total_comp' in row_keys

        resp = self.client.post(url, {'scenario': {'salary_increase_percent': 10}}, format='json')
        assert resp.status_code == 200
        scenario = resp.json()['scenario']
        assert scenario['applied'] is True

    def test_archive_offer_and_fetch(self):
        offer = JobOffer.objects.create(
            candidate=self.profile,
            job=self.job,
            role_title='Offer to archive',
            company_name='ArchiveCo',
            location='Remote',
            base_salary=100000,
            bonus=10000,
            equity=5000,
            benefits_total_value=2000,
        )
        archive_url = reverse('job-offer-archive', kwargs={'offer_id': offer.id})
        resp = self.client.post(archive_url, {'reason': 'declined comp'}, format='json')
        assert resp.status_code == 200
        offer.refresh_from_db()
        assert offer.status == 'archived'
        assert offer.archived_reason == 'declined comp'

        comparison_url = f"{reverse('job-offer-comparison')}?include_archived=true"
        resp = self.client.get(comparison_url)
        assert resp.status_code == 200
        body = resp.json()
        assert len(body['archived_offers']) == 1
