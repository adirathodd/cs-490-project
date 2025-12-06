import uuid

import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_contacts_search_and_delete(django_user_model):
    user = django_user_model.objects.create_user(username="suser", email="suser@example.com", password="pass")
    client = APIClient()
    client.force_authenticate(user=user)

    # Create two contacts
    url = reverse("contacts-list-create")
    resp1 = client.post(url, data={"first_name": "Alice", "last_name": "Smith", "email": "alice@example.com", "company_name": "Acme"}, format="json")
    resp2 = client.post(url, data={"first_name": "Bob", "last_name": "Jones", "email": "bob@example.com", "company_name": "OtherCo"}, format="json")
    assert resp1.status_code == 201 and resp2.status_code == 201
    id1 = resp1.data.get("id")
    id2 = resp2.data.get("id")

    # Search by company_name
    resp = client.get(url + "?q=Acme")
    assert resp.status_code == 200
    results = [c.get("id") for c in resp.data]
    assert id1 in results and id2 not in results

    # Delete contact 2
    del_url = reverse("contact-detail", args=[id2])
    del_resp = client.delete(del_url)
    assert del_resp.status_code == 204

    # Ensure detail now returns 404
    get_resp = client.get(del_url)
    assert get_resp.status_code == 404


@pytest.mark.django_db
def test_contacts_import_callback_no_code_and_enqueue_branch(monkeypatch, django_user_model):
    user = django_user_model.objects.create_user(username="iuser", email="iuser@example.com", password="pass")
    client = APIClient()
    client.force_authenticate(user=user)

    from core.models import ImportJob

    job = ImportJob.objects.create(owner=user)

    callback_url = reverse("contacts-import-callback")

    # Post with job_id but no code -> should return job info
    resp = client.post(callback_url, data={"job_id": job.id.hex}, format="json")
    assert resp.status_code == 200
    assert resp.data.get("job_id") and resp.data.get("status")

    # Now simulate enqueue branch where .delay exists and succeeds
    def fake_exchange(code, redirect):
        return {"access_token": "a", "refresh_token": "r"}

    monkeypatch.setattr("core.google_import.exchange_code_for_tokens", fake_exchange)

    class FakeTask:
        def delay(self, *args, **kwargs):
            return None

    # Attach fake task with delay attribute
    monkeypatch.setattr("core.tasks.process_import_job", FakeTask())

    resp2 = client.post(callback_url, data={"job_id": job.id.hex, "code": "c"}, format="json")
    assert resp2.status_code == 200
    # When delay worked, view sets 'enqueued' True
    assert resp2.data.get("enqueued") is True
