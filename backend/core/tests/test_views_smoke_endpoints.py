import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_views_smoke_endpoints():
    User = get_user_model()
    user = User.objects.create_user(username='smoke', email='smoke@example.com', password='p')
    client = APIClient()

    # unauthenticated endpoints should not crash (will usually be 401/403)
    unauth_paths = [
        ('get', '/api/auth/verify-token'),
        ('post', '/api/auth/login'),
        ('post', '/api/auth/register'),
    ]
    for method, path in unauth_paths:
        resp = getattr(client, method)(path)
        assert resp.status_code in (200, 201, 400, 401, 403, 404, 405)

    # authenticate
    client.force_authenticate(user=user)

    paths = [
        ('get', '/api/users/me', None),
        ('get', '/api/users/profile', None),
        ('get', '/api/contacts', None),
        ('post', '/api/contacts/import/start', {'provider': 'google'}),
        ('post', '/api/contacts/import/callback', {'job_id': __import__('uuid').uuid4().hex}),
        ('get', '/api/cover-letter-templates', None),
        ('get', '/api/cover-letter-templates/stats', None),
        ('get', '/api/jobs/stats', None),
        ('post', '/api/jobs/import-from-url', {'url': 'https://example.com/job'}),
        ('get', '/api/resume/export', None),
        ('get', '/api/resume/export/themes', None),
        ('get', '/api/companies/ExampleCorp', None),
        ('get', '/api/companies/ExampleCorp/research', None),
        ('get', '/api/profile/education', None),
        ('get', '/api/profile/employment', None),
        ('get', '/api/skills', None),
        ('get', '/api/skills/autocomplete', {'q': 'py'}),
        # Additional endpoints to exercise more view branches
        ('get', '/api/jobs', None),
        ('get', '/api/jobs/1', None),
        ('post', '/api/jobs/1/archive', None),
        ('post', '/api/jobs/1/restore', None),
        ('post', '/api/jobs/1/delete', None),
        ('get', '/api/documents/', None),
        ('get', '/api/documents/1/', None),
        ('get', '/api/jobs/1/materials/', None),
        ('get', '/api/materials/defaults/', None),
        ('get', '/api/materials/analytics/', None),
        ('get', '/api/cover-letter-templates/import', None),
        ('get', '/api/cover-letter-templates/invalid-id/customize', None),
        ('get', '/api/interviews/', None),
        ('get', '/api/interviews/1/', None),
        ('get', '/api/resume-versions/', None),
        ('get', '/api/automation/rules/', None),
        ('get', '/api/jobs/1/match-score/', None),
        ('get', '/api/jobs/match-scores/', None),
        ('post', '/api/jobs/1/cover-letter/generate', None),
    ]

    for method, path, payload in paths:
        func = getattr(client, method)
        if payload is None:
            resp = func(path)
        else:
            resp = func(path, payload, format='json')
        assert resp.status_code in (200, 201, 202, 204, 400, 401, 403, 404, 405)
