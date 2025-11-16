import uuid

import pytest
from django.urls import reverse
from rest_framework.test import APIClient


class FakeResult:
    def __init__(self, status, payload):
        self.status = status
        self._payload = payload

    def to_dict(self):
        return self._payload


@pytest.mark.django_db
def test_import_job_from_url_success_and_retryable(monkeypatch, django_user_model):
    user = django_user_model.objects.create_user(username="u1", email="u1@example.com", password="pass")
    client = APIClient()
    client.force_authenticate(user=user)

    # Success case
    def fake_import_success(url):
        return FakeResult('success', {'status': 'success', 'data': {'title': 'Eng', 'company_name': 'Acme'}, 'fields_extracted': ['title', 'company_name']})

    monkeypatch.setattr('core.job_import_utils.import_job_from_url', fake_import_success)

    url = reverse('core:import-job-from-url')
    resp = client.post(url, data={'url': 'https://example.com/job/1'}, format='json')
    assert resp.status_code == 200
    assert resp.data.get('status') == 'success'

    # Failed retryable case
    def fake_import_failed(url):
        return FakeResult('failed', {'status': 'failed', 'error': 'The request took too long to respond'})

    monkeypatch.setattr('core.job_import_utils.import_job_from_url', fake_import_failed)
    resp2 = client.post(url, data={'url': 'https://example.com/job/2'}, format='json')
    assert resp2.status_code == 503
    assert resp2.data.get('retryable') is True


@pytest.mark.django_db
def test_job_match_score_cached_and_post(monkeypatch, django_user_model):
    user = django_user_model.objects.create_user(username='jm', email='jm@example.com', password='pass')
    client = APIClient()
    client.force_authenticate(user=user)

    from core.models import CandidateProfile, JobEntry, JobMatchAnalysis

    profile = CandidateProfile.objects.create(user=user)
    job = JobEntry.objects.create(candidate=profile, title='Dev', company_name='Acme')

    # Create cached analysis
    JobMatchAnalysis.objects.create(
        job=job,
        candidate=profile,
        overall_score=85.5,
        skills_score=80.0,
        experience_score=90.0,
        education_score=70.0,
        match_data={'breakdown': {}},
        user_weights={'skills': 0.6, 'experience': 0.3, 'education': 0.1}
    )

    # GET should return cached result
    get_url = reverse('core:job-match-score', args=[job.id])
    resp = client.get(get_url)
    assert resp.status_code == 200
    assert resp.data.get('cached') is True or 'cached' in resp.data

    # POST with invalid weights (not dict)
    post_resp = client.post(get_url, data={'weights': 'not-a-dict'}, format='json')
    assert post_resp.status_code == 400

    # Now test POST with valid weights, monkeypatch calculation
    def fake_calc(job_obj, profile_obj, user_weights=None):
        return {
            'overall_score': 88.0,
            'skills_score': 85.0,
            'experience_score': 90.0,
            'education_score': 80.0,
            'breakdown': {},
            'weights_used': user_weights or {'skills': 0.6, 'experience': 0.3, 'education': 0.1}
        }

    monkeypatch.setattr('core.job_matching.JobMatchingEngine.calculate_match_score', fake_calc, raising=False)

    valid_weights = {'skills': 0.5, 'experience': 0.4, 'education': 0.1}
    post_resp2 = client.post(get_url, data={'weights': valid_weights}, format='json')
    assert post_resp2.status_code == 200
    assert post_resp2.data.get('overall_score') == 88.0
