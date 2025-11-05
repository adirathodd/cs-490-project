import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import CandidateProfile, JobEntry

User = get_user_model()


@pytest.mark.django_db
class TestJobsAPI:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='jobsuid', email='jobs@example.com', password='pass')
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def test_create_list_delete_and_validation(self):
        list_url = reverse('core:jobs-list-create')

        # Initial list empty
        resp = self.client.get(list_url)
        assert resp.status_code == 200
        assert resp.json() == []

        # Validation: required fields
        bad_payload = {
            'title': '',
            'company_name': '',
            'description': 'x' * 2001,
        }
        resp = self.client.post(list_url, bad_payload, format='json')
        assert resp.status_code == 400
        details = (resp.json().get('error') or {}).get('details') or {}
        assert 'title' in details
        assert 'company_name' in details
        assert 'description' in details

        # Validation: salary range
        bad_salary = {
            'title': 'Software Engineer',
            'company_name': 'Acme Inc',
            'salary_min': 200000,
            'salary_max': 100000,
        }
        resp = self.client.post(list_url, bad_salary, format='json')
        assert resp.status_code == 400
        details = (resp.json().get('error') or {}).get('details') or {}
        assert 'salary_min' in details

        # Create valid
        payload = {
            'title': 'Software Engineer',
            'company_name': 'Acme Inc',
            'location': 'Remote',
            'salary_min': 100000,
            'salary_max': 150000,
            'posting_url': 'https://example.com/job/123',
            'application_deadline': '2025-12-31',
            'description': 'Great role working with Python and React',
            'industry': 'Software',
            'job_type': 'ft',
        }
        resp = self.client.post(list_url, payload, format='json')
        assert resp.status_code == 201
        data = resp.json()
        assert data['title'] == 'Software Engineer'
        assert data['company_name'] == 'Acme Inc'
        assert 'message' in data
        job_id = data['id']

        # List returns the created job
        resp = self.client.get(list_url)
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 1
        assert items[0]['id'] == job_id

        # Detail update and delete
        detail_url = reverse('core:job-detail', kwargs={'job_id': job_id})
        resp = self.client.patch(detail_url, {'location': 'NYC'}, format='json')
        assert resp.status_code == 200
        assert resp.json()['location'] == 'NYC'

        resp = self.client.delete(detail_url)
        assert resp.status_code == 200
        assert JobEntry.objects.filter(id=job_id).count() == 0
