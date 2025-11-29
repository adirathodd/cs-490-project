import uuid
import datetime

import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_contacts_crud_and_related_endpoints(django_user_model):
    user = django_user_model.objects.create_user(username="cuser", email="cuser@example.com", password="pass")
    client = APIClient()
    client.force_authenticate(user=user)

    # Create contact
    url = reverse("core:contacts-list-create")
    payload = {"first_name": "Jane", "last_name": "Doe", "email": "jane@example.com", "company_name": "Acme"}
    resp = client.post(url, data=payload, format="json")
    assert resp.status_code == 201
    contact = resp.data
    assert contact["first_name"] == "Jane" or contact.get("first_name") == "Jane"
    contact_id = contact.get("id")
    assert contact_id

    # Get list should include the contact
    resp = client.get(url)
    assert resp.status_code == 200
    ids = [c.get("id") for c in resp.data]
    assert contact_id in ids

    # Retrieve detail
    detail_url = reverse("core:contact-detail", args=[contact_id])
    resp = client.get(detail_url)
    assert resp.status_code == 200
    assert resp.data.get("email") == "jane@example.com"

    # Patch update
    patch_resp = client.patch(detail_url, data={"display_name": "Jane D."}, format="json")
    assert patch_resp.status_code == 200
    assert patch_resp.data.get("display_name") == "Jane D."

    # Create an interaction
    interactions_url = reverse("core:contact-interactions", args=[contact_id])
    interaction_payload = {"type": "call", "date": "2025-01-01T12:00:00Z", "duration_minutes": 20, "summary": "Intro call"}
    resp = client.post(interactions_url, data=interaction_payload, format="json")
    assert resp.status_code == 201
    assert resp.data.get("type") == "call"

    # Create a note
    notes_url = reverse("core:contact-notes", args=[contact_id])
    note_payload = {"content": "Met at conference", "interests": "networking"}
    resp = client.post(notes_url, data=note_payload, format="json")
    assert resp.status_code == 201
    assert "Met at conference" in resp.data.get("content")

    # Create a reminder
    reminders_url = reverse("core:contact-reminders", args=[contact_id])
    # Use UTC timestamp in Zulu format (no offset) to match API expectations
    due = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ')
    reminder_payload = {"message": "Follow up on opportunity", "due_date": due}
    resp = client.post(reminders_url, data=reminder_payload, format="json")
    assert resp.status_code == 201
    assert resp.data.get("message") == "Follow up on opportunity"

    # List interactions, notes, reminders
    resp = client.get(interactions_url)
    assert resp.status_code == 200
    assert any(i.get("type") == "call" for i in resp.data)

    resp = client.get(notes_url)
    assert resp.status_code == 200
    assert any("Met at conference" in n.get("content", "") for n in resp.data)

    resp = client.get(reminders_url)
    assert resp.status_code == 200
    assert any(r.get("message") == "Follow up on opportunity" for r in resp.data)
