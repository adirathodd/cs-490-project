import pytest
from django.utils import timezone
from django.contrib.auth import get_user_model

from core.models import ImportJob, Contact
from core import tasks


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
