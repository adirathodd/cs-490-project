import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Contact


@pytest.mark.django_db
def test_contacts_endpoints_auth_and_crud():
    User = get_user_model()
    user = User.objects.create_user(username='u2', email='u2@example.com', password='p')
    client = APIClient()

    # unauthenticated should be 401
    r = client.get('/api/contacts')
    assert r.status_code in (401, 403)

    # authenticate
    client.force_authenticate(user=user)

    # initially empty
    r = client.get('/api/contacts')
    assert r.status_code == 200
    assert isinstance(r.data, list)

    # create a contact
    payload = {'display_name': 'Alice', 'email': 'alice@example.com'}
    r = client.post('/api/contacts', payload, format='json')
    assert r.status_code in (200, 201)
    cid = r.data.get('id')
    assert cid

    # detail
    r = client.get(f'/api/contacts/{cid}')
    assert r.status_code == 200
    assert r.data.get('email') == 'alice@example.com'
