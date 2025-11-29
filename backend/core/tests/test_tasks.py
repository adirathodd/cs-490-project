import pytest
from django.utils import timezone
from django.contrib.auth import get_user_model

from core.models import ImportJob, Contact
from core import tasks
from core.google_import import GooglePeopleAPIError


@pytest.mark.django_db
def test_process_import_job_creates_contacts(monkeypatch):
    User = get_user_model()
    user = User.objects.create_user(username='u1', email='u1@example.com', password='p')

    job = ImportJob.objects.create(owner=user, provider='google')

    # fake fetch_and_normalize to return one entry
    def fake_fetch(token):
        return [
            {
                'resourceName': 'people/1',
                'names': [{'displayName': 'Bob B', 'givenName': 'Bob', 'familyName': 'B'}],
                'emails': [{'value': 'bob@example.com'}],
                'phones': [{'value': '+1555'}],
                'organizations': [{'name': 'Acme', 'title': 'Eng'}],
                'photo': 'http://img',
            }
        ]

    monkeypatch.setattr(tasks, 'fetch_and_normalize', fake_fetch)

    # call task synchronously
    tasks.process_import_job(str(job.id), 'fake-token')

    job.refresh_from_db()
    assert job.status == 'completed'
    # A contact should have been created
    c = Contact.objects.filter(owner=user, email__iexact='bob@example.com').first()
    assert c is not None
    assert c.display_name == 'Bob B'


@pytest.mark.django_db
def test_process_import_job_handles_people_api_error(monkeypatch):
    User = get_user_model()
    user = User.objects.create_user(username='u2', email='u2@example.com', password='p')

    job = ImportJob.objects.create(owner=user, provider='google')

    def fake_fetch(token):
        raise GooglePeopleAPIError('Enable the Google People API for your project.', status_code=403)

    monkeypatch.setattr(tasks, 'fetch_and_normalize', fake_fetch)

    tasks.process_import_job(str(job.id), 'fake-token')

    job.refresh_from_db()
    assert job.status == 'failed'
    assert job.errors
    assert job.errors[0]['id'] == 'google_people_api'
    assert 'Google People API' in job.errors[0]['message']


@pytest.mark.django_db
def test_process_import_job_handles_missing_email(monkeypatch):
    User = get_user_model()
    user = User.objects.create_user(username='u3', email='u3@example.com', password='p')

    job = ImportJob.objects.create(owner=user, provider='google')

    def fake_fetch(token):
        return [
            {
                'resourceName': 'people/2',
                'names': [{'displayName': 'Laila Lopez', 'givenName': 'Laila', 'familyName': 'Lopez'}],
                'phones': [{'value': '+18567772039'}],
                'emails': [],
                'photo': 'http://img',
            }
        ]

    monkeypatch.setattr(tasks, 'fetch_and_normalize', fake_fetch)

    tasks.process_import_job(str(job.id), 'fake-token')

    job.refresh_from_db()
    assert job.status == 'completed'
    c = Contact.objects.filter(owner=user, external_id='people/2').first()
    assert c is not None
    assert c.email == ''
