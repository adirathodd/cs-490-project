import pytest
from datetime import timedelta

from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
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
        list_url = reverse('jobs-list-create')

        # Initial list empty (paginated response)
        resp = self.client.get(list_url)
        assert resp.status_code == 200
        data = resp.json()
        assert data['count'] == 0
        assert data['results'] == []

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

        # List returns the created job (paginated response)
        resp = self.client.get(list_url)
        assert resp.status_code == 200
        data = resp.json()
        items = data['results']
        assert len(items) == 1
        assert items[0]['id'] == job_id

        # Detail update and delete
        detail_url = reverse('job-detail', kwargs={'job_id': job_id})
        resp = self.client.patch(detail_url, {'location': 'NYC'}, format='json')
        assert resp.status_code == 200
        assert resp.json()['location'] == 'NYC'

        resp = self.client.delete(detail_url)
        assert resp.status_code == 200
        assert JobEntry.objects.filter(id=job_id).count() == 0

    def test_list_with_filters_and_search_returns_enhanced_payload(self):
        list_url = reverse('jobs-list-create')

        today = timezone.localdate()
        JobEntry.objects.create(
            candidate=self.profile,
            title='Backend Engineer',
            company_name='Foobar Corp',
            location='Austin, TX',
            job_type='ft',
            industry='Software',
            salary_min=90000,
            salary_max=130000,
            application_deadline=today + timedelta(days=40),
            description='Django and APIs'
        )
        JobEntry.objects.create(
            candidate=self.profile,
            title='Frontend Engineer',
            company_name='Foobar Corp',
            location='Remote',
            job_type='ft',
            industry='Software',
            salary_min=95000,
            salary_max=140000,
            application_deadline=today + timedelta(days=70),
            description='React experience required'
        )
        JobEntry.objects.create(
            candidate=self.profile,
            title='Data Analyst',
            company_name='Datafy',
            location='New York, NY',
            job_type='contract',
            industry='Analytics',
            salary_min=80000,
            salary_max=90000,
            application_deadline=today + timedelta(days=20),
            description='SQL and dashboards'
        )

        params = {
            'q': 'engineer',
            'industry': 'software',
            'job_type': 'ft',
            'sort': 'salary',
        }
        resp = self.client.get(list_url, params)
        assert resp.status_code == 200
        payload = resp.json()
        # Paginated response includes count, next, previous, results
        assert 'results' in payload
        assert 'count' in payload
        assert payload['count'] == 2
        titles = [item['title'] for item in payload['results']]
        assert titles == ['Frontend Engineer', 'Backend Engineer']

        params = {
            'deadline_from': (today + timedelta(days=10)).isoformat(),
            'deadline_to': (today + timedelta(days=60)).isoformat(),
            'sort': 'deadline',
        }
        resp = self.client.get(list_url, params)
        assert resp.status_code == 200
        payload = resp.json()
        deadlines = [item['application_deadline'] for item in payload['results']]
        assert deadlines == [
            (today + timedelta(days=20)).isoformat(),
            (today + timedelta(days=40)).isoformat(),
        ]
        assert payload['count'] == 2

    def test_bulk_status_updates_and_stats_endpoint(self):
        JobEntry.objects.bulk_create([
            JobEntry(
                candidate=self.profile,
                title='Job A',
                company_name='A',
                status='interested',
                job_type='ft',
            ),
            JobEntry(
                candidate=self.profile,
                title='Job B',
                company_name='B',
                status='applied',
                job_type='ft',
            ),
            JobEntry(
                candidate=self.profile,
                title='Job C',
                company_name='C',
                status='interview',
                job_type='contract',
            ),
        ])

        stats_url = reverse('jobs-stats')
        resp = self.client.get(stats_url)
        assert resp.status_code == 200

        stats = resp.json()
        # API returns status counts under 'counts'
        counts = stats.get('counts', {})
        assert counts.get('interested') == 1
        assert counts.get('applied') == 1
        assert counts.get('interview') == 1

        bulk_status_url = reverse('jobs-bulk-status')
        ids = list(JobEntry.objects.values_list('id', flat=True))
        resp = self.client.post(bulk_status_url, {'ids': ids[:2], 'status': 'applied'}, format='json')
        assert resp.status_code == 200
        assert resp.json()['updated'] == 1
        refreshed = list(JobEntry.objects.order_by('title').values_list('status', flat=True))
        assert refreshed.count('applied') == 2

        resp = self.client.post(bulk_status_url, {'ids': ids, 'status': 'invalid'}, format='json')
        assert resp.status_code == 400
        assert 'error' in resp.json()

    def test_jobs_bulk_deadline_and_upcoming_deadlines(self):
        today = timezone.localdate()
        job1 = JobEntry.objects.create(
            candidate=self.profile,
            title='Deadline Soon',
            company_name='Soon Inc',
            application_deadline=today + timedelta(days=15),
            job_type='ft',
        )
        job2 = JobEntry.objects.create(
            candidate=self.profile,
            title='Deadline Later',
            company_name='Later Inc',
            application_deadline=today + timedelta(days=45),
            job_type='ft',
        )
        job3 = JobEntry.objects.create(
            candidate=self.profile,
            title='No Deadline',
            company_name='None Inc',
            job_type='ft',
        )

        bulk_deadline_url = reverse('jobs-bulk-deadline')
        new_deadline = (today + timedelta(days=90)).isoformat()
        resp = self.client.post(bulk_deadline_url, {'ids': [job1.id, job3.id], 'deadline': new_deadline}, format='json')
        assert resp.status_code == 200
        assert resp.json()['updated'] == 2

        job1.refresh_from_db()
        job3.refresh_from_db()
        assert job1.application_deadline.isoformat() == new_deadline
        assert job3.application_deadline.isoformat() == new_deadline

        resp = self.client.post(bulk_deadline_url, {'ids': [job2.id], 'deadline': 'invalid'}, format='json')
        assert resp.status_code == 400

        upcoming_url = reverse('jobs-upcoming-deadlines')
        resp = self.client.get(upcoming_url)
        assert resp.status_code == 200
        upcoming = resp.json()
        assert len(upcoming) >= 2
        first = upcoming[0]['application_deadline']
        second = upcoming[1]['application_deadline'] if len(upcoming) > 1 else None
        assert first <= second if second else True
