import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from core.models import Contact


@pytest.mark.django_db
def test_contacts_create_list_and_detail_flow():
    User = get_user_model()
    user = User.objects.create_user(username='u1', email='u1@example.com', password='pass')
    client = APIClient()
    client.force_authenticate(user)

    # Create a contact
    url = reverse('core:contacts-list-create')
    payload = {'first_name': 'Alice', 'last_name': 'Smith', 'email': 'alice@example.com'}
    resp = client.post(url, payload, format='json')
    assert resp.status_code == 201
    data = resp.json()
    assert data.get('first_name') == 'Alice'
    contact_id = data.get('id')

    # List contacts should include the created contact
    resp = client.get(url)
    assert resp.status_code == 200
    items = resp.json()
    assert any(i.get('id') == contact_id for i in items)

    # Get detail
    detail_url = reverse('core:contact-detail', kwargs={'contact_id': contact_id})
    resp = client.get(detail_url)
    assert resp.status_code == 200
    detail = resp.json()
    assert detail.get('email') == 'alice@example.com'

    # Patch the contact
    resp = client.patch(detail_url, {'last_name': 'Jones'}, format='json')
    assert resp.status_code == 200
    assert resp.json().get('last_name') == 'Jones'

    # Create a note for the contact
    notes_url = reverse('core:contact-notes', kwargs={'contact_id': contact_id})
    resp = client.post(notes_url, {'content': 'Met at conference'}, format='json')
    assert resp.status_code == 201
    note = resp.json()
    assert note.get('content') == 'Met at conference'

    # Create an interaction and confirm contact last_interaction updated
    interactions_url = reverse('core:contact-interactions', kwargs={'contact_id': contact_id})
    resp = client.post(interactions_url, {'type': 'call', 'date': '2020-01-01', 'summary': 'Intro call'}, format='json')
    assert resp.status_code == 201
    # Refresh from DB
    c = Contact.objects.get(id=contact_id)
    assert c.last_interaction is not None
