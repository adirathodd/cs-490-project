import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import Contact, ImportJob


@pytest.mark.django_db
def test_contacts_import_start_and_callback_and_mutuals(monkeypatch):
    User = get_user_model()
    user = User.objects.create_user(username='u_import', email='imp@example.com', password='p')
    client = APIClient()
    client.force_authenticate(user=user)

    # Patch google_import.build_google_auth_url to return a predictable URL
    import core.google_import as google_import

    monkeypatch.setattr(google_import, 'build_google_auth_url', lambda redirect, state=None: f"https://auth.example/?rd={redirect}&s={state}")

    # Start import
    r = client.post('/api/contacts/import/start', {'provider': 'google'}, format='json')
    assert r.status_code == 200
    assert 'job_id' in r.data
    assert r.data.get('auth_url') and 'https://auth.example' in r.data.get('auth_url')

    job_id = r.data['job_id']
    assert ImportJob.objects.filter(id=job_id, owner=user).exists()

    # Callback without code should return job info
    r2 = client.post('/api/contacts/import/callback', {'job_id': job_id}, format='json')
    assert r2.status_code == 200
    assert r2.data.get('job_id') == job_id

    # Now simulate exchange_code_for_tokens and tasks processing
    monkeypatch.setattr(google_import, 'exchange_code_for_tokens', lambda code, redirect: {'access_token': 'A', 'refresh_token': 'R'})

    # Monkeypatch tasks to avoid Celery - set delay to a harmless callable
    import core.tasks as tasks
    class Dummy:
        @staticmethod
        def delay(*a, **k):
            return None
    monkeypatch.setattr(tasks, 'process_import_job', Dummy)

    r3 = client.post('/api/contacts/import/callback', {'job_id': job_id, 'code': 'fake'}, format='json')
    assert r3.status_code == 200
    assert r3.data.get('job_id') == job_id
    assert 'status' in r3.data


@pytest.mark.django_db
def test_contacts_import_start_missing_google_credentials(monkeypatch):
    User = get_user_model()
    user = User.objects.create_user(username='u_missing_google', email='missing@example.com', password='p')
    client = APIClient()
    client.force_authenticate(user=user)

    monkeypatch.setattr(settings, 'GOOGLE_CLIENT_ID', '')
    monkeypatch.setattr(settings, 'GOOGLE_CLIENT_SECRET', '')

    resp = client.post('/api/contacts/import/start', {'provider': 'google'}, format='json')
    assert resp.status_code == 500
    assert 'error' in resp.data
    assert 'job_id' in resp.data


@pytest.mark.django_db
def test_contact_mutuals_and_notes_interactions_reminders():
    User = get_user_model()
    user = User.objects.create_user(username='u_mut', email='mut@example.com', password='p')
    client = APIClient()
    client.force_authenticate(user=user)

    # create three contacts
    c1 = Contact.objects.create(owner=user, display_name='A One', email='a1@example.com', company_name='Acme')
    c2 = Contact.objects.create(owner=user, display_name='B Two', email='b2@example.com', company_name='Acme')
    c3 = Contact.objects.create(owner=user, display_name='C Three', email='c3@example.com', company_name='Other')

    # mutuals for c1 should include c2 but not c3
    r = client.get(f'/api/contacts/{c1.id}/mutuals')
    assert r.status_code == 200
    ids = [i.get('id') for i in r.data]
    assert str(c2.id) in ids
    assert str(c3.id) not in ids

    # interactions: POST one and verify contact.last_interaction updates
    payload = {'date': '2020-01-01', 'notes': 'Met at conference', 'type': 'meeting'}
    r2 = client.post(f'/api/contacts/{c1.id}/interactions', payload, format='json')
    assert r2.status_code in (200, 201)
    c1.refresh_from_db()
    assert c1.last_interaction is not None

    # notes
    r3 = client.post(f'/api/contacts/{c1.id}/notes', {'content': 'Important note'}, format='json')
    assert r3.status_code in (200, 201)
    assert r3.data.get('content') == 'Important note'

    # reminders
    r4 = client.post(f'/api/contacts/{c1.id}/reminders', {'due_date': '2025-12-31', 'message': 'Follow up'}, format='json')
    assert r4.status_code in (200, 201)
    assert r4.data.get('message') == 'Follow up'
