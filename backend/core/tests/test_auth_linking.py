import types
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory
from core.authentication import FirebaseAuthentication


@pytest.mark.django_db
def test_google_login_does_not_overwrite_password_and_preserves_name(monkeypatch):
    User = get_user_model()
    # Existing user created via email/password flow
    user = User.objects.create_user(
        username='legacy-username',
        email='test@example.com',
        password='Passw0rd!'
    )
    # Give the user an explicit name to ensure it doesn't get overwritten
    user.first_name = 'Alice'
    user.last_name = 'Smith'
    user.save(update_fields=['first_name', 'last_name'])

    original_hash = user.password  # store the password hash

    # Stub firebase initialization and token verification
    def fake_initialize_firebase():
        return True

    def fake_verify_token(_token):
        return {
            'uid': 'firebase-uid-123',
            'email': 'test@example.com',
            'name': 'Google DisplayName'
        }

    # Minimal fake object returned by firebase_auth.get_user
    fake_fb_user = types.SimpleNamespace(
        display_name='Google DisplayName',
        photo_url=None,
    )

    # Patch dependencies used inside FirebaseAuthentication
    monkeypatch.setattr('core.authentication.initialize_firebase', fake_initialize_firebase)
    monkeypatch.setattr('core.authentication.verify_firebase_token', fake_verify_token)
    monkeypatch.setattr('core.authentication.firebase_auth.get_user', lambda uid: fake_fb_user)

    # Build a DRF request with Authorization header
    factory = APIRequestFactory()
    req = factory.get('/api/mock')
    req.META['HTTP_AUTHORIZATION'] = 'Bearer dummy-token'

    auth = FirebaseAuthentication()
    user_out, decoded = auth.authenticate(req)

    # It should link to the same user by email and update username to the Firebase UID
    assert user_out.id == user.id
    user_out.refresh_from_db()
    assert user_out.username == 'firebase-uid-123'

    # Password must be unchanged (still usable and same hash)
    assert user_out.password == original_hash
    assert user_out.check_password('Passw0rd!') is True

    # Name should be preserved (not overwritten by Google display name)
    assert user_out.first_name == 'Alice'
    assert user_out.last_name == 'Smith'


@pytest.mark.django_db
def test_github_login_handles_duplicate_users_by_email(monkeypatch):
    """If multiple Django users share the same email (legacy bug), auth should pick a canonical one and link by UID."""
    User = get_user_model()
    # Create two users with the same email (simulating a historical duplicate)
    u1 = User.objects.create_user(username='old-uid-1', email='dup@example.com', password='x')
    u2 = User.objects.create_user(username='old-uid-2', email='DUP@example.com', password='y')

    # Stub firebase initialization and token verification
    def fake_initialize_firebase():
        return True

    def fake_verify_token(_token):
        return {
            'uid': 'firebase-uid-github',
            'email': 'dup@example.com',
            'name': 'GitHub User'
        }

    fake_fb_user = types.SimpleNamespace(
        display_name='GitHub User',
        photo_url=None,
    )

    monkeypatch.setattr('core.authentication.initialize_firebase', fake_initialize_firebase)
    monkeypatch.setattr('core.authentication.verify_firebase_token', fake_verify_token)
    monkeypatch.setattr('core.authentication.firebase_auth.get_user', lambda uid: fake_fb_user)

    factory = APIRequestFactory()
    req = factory.get('/api/mock')
    req.META['HTTP_AUTHORIZATION'] = 'Bearer dummy-token'

    auth = FirebaseAuthentication()
    user_out, decoded = auth.authenticate(req)

    # Should link to the canonical existing user (the earliest created one: u1)
    assert user_out.id == u1.id
    user_out.refresh_from_db()
    assert user_out.username == 'firebase-uid-github'

    # No new user should be created
    assert User.objects.filter(email__iexact='dup@example.com').count() == 2
