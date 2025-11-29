import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.utils import timezone

from core.models import Contact, ImportJob
from core import tasks, google_import


@pytest.mark.django_db
def test_interaction_note_reminder_and_mutuals_flow(monkeypatch):
    User = get_user_model()
    user = User.objects.create_user(username='u5', email='u5@example.com', password='p')
    client = APIClient()
    client.force_authenticate(user=user)

    # create two contacts with same company to be mutuals
    c1 = Contact.objects.create(owner=user, display_name='One', email='one@example.com', company_name='Acme')
    c2 = Contact.objects.create(owner=user, display_name='Two', email='two@example.com', company_name='Acme')

    # add interaction to c1
    r = client.post(f'/api/contacts/{c1.id}/interactions', {'type': 'call', 'summary': 'Hello', 'date': timezone.now().isoformat()}, format='json')
    assert r.status_code in (200, 201)
    c1.refresh_from_db()
    assert c1.last_interaction is not None

    # add note
    r = client.post(f'/api/contacts/{c1.id}/notes', {'content': 'met at meetup'}, format='json')
    assert r.status_code in (200, 201)

    # add reminder
    due = (timezone.now() + timezone.timedelta(days=3)).isoformat()
    r = client.post(f'/api/contacts/{c1.id}/reminders', {'message': 'follow up', 'due_date': due}, format='json')
    assert r.status_code in (200, 201)

    # mutuals
    r = client.get(f'/api/contacts/{c1.id}/mutuals')
    assert r.status_code == 200
    assert any(m['id'] == str(c2.id) for m in r.data)


@pytest.mark.django_db
def test_process_import_job_updates_and_handles_errors(monkeypatch):
    User = get_user_model()
    user = User.objects.create_user(username='u6', email='u6@example.com', password='p')
    # existing contact
    existing = Contact.objects.create(owner=user, display_name='Existing', email='exist@example.com', external_id='people/1')

    job = ImportJob.objects.create(owner=user, provider='google')

    def fake_fetch_success(token):
        return [
            {
                'resourceName': 'people/1',
                'names': [{'displayName': 'Existing Updated', 'givenName': 'Existing', 'familyName': 'U'}],
                'emails': [{'value': 'exist@example.com'}],
                'phones': [{'value': '+1999'}],
                'photo': 'http://new'
            }
        ]

    monkeypatch.setattr(tasks, 'fetch_and_normalize', fake_fetch_success)
    tasks.process_import_job(str(job.id), 't')
    existing.refresh_from_db()
    assert existing.photo_url == 'http://new' or existing.metadata.get('last_imported')

    # now simulate error
    job2 = ImportJob.objects.create(owner=user, provider='google')

    def fake_fetch_error(token):
        raise RuntimeError('boom')

    monkeypatch.setattr(tasks, 'fetch_and_normalize', fake_fetch_error)
    tasks.process_import_job(str(job2.id), 't')
    job2.refresh_from_db()
    assert job2.status == 'failed'
