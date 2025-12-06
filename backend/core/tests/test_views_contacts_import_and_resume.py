import uuid
from types import SimpleNamespace

import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_contacts_import_start_and_callback_and_mutuals(monkeypatch, django_user_model):
    # Create and authenticate a user
    user = django_user_model.objects.create_user(username="testuser", email="test@example.com", password="pass")
    client = APIClient()
    client.force_authenticate(user=user)

    # Mock building the google auth url
    monkeypatch.setattr("core.google_import.build_google_auth_url", lambda redirect, state: "https://auth.example/?state=" + state)

    # Start import -> should return a URL to redirect client to
    url = reverse("contacts-import-start")
    resp = client.post(url, data={})
    assert resp.status_code in (200, 201, 202, 302)
    # If body contains url, ensure it's our mocked URL
    if isinstance(resp.data, dict) and resp.data.get("url"):
        assert "auth.example" in resp.data["url"]

    # Prepare an ImportJob id (simulate that start created one)
    import_job_id = uuid.uuid4()
    from core.models import ImportJob
    ImportJob.objects.create(id=import_job_id, owner=user)

    # Mock exchange_code_for_tokens to return tokens and profile id
    def fake_exchange(code, client_id=None, client_secret=None, redirect_uri=None):
        return {"access_token": "x", "refresh_token": "y", "expires_in": 3600}

    monkeypatch.setattr("core.google_import.exchange_code_for_tokens", fake_exchange)

    # Monkeypatch background task so it doesn't run asynchronously
    monkeypatch.setattr("core.tasks.process_import_job", lambda *a, **k: None)

    callback_url = reverse("contacts-import-callback")
    # Use a valid UUID hex to satisfy validation in views
    resp = client.post(callback_url, data={"job_id": import_job_id.hex, "code": "fakecode"}, format="json")
    assert resp.status_code in (200, 201, 202)

    # Hit mutuals endpoint with a random contact id — should not 500
    mutuals_url = reverse("contact-mutuals", args=[str(uuid.uuid4())])
    resp = client.get(mutuals_url)
    assert resp.status_code in (200, 404)


@pytest.mark.django_db
def test_resume_export_endpoint_smoke(monkeypatch, django_user_model):
    # Create user and profile
    user = django_user_model.objects.create_user(username="exportuser", email="export@example.com", password="pass")
    client = APIClient()
    client.force_authenticate(user=user)

    url = reverse("resume-export")
    resp = client.get(url)
    # When profile is missing the view intentionally returns 404
    assert resp.status_code == 404
