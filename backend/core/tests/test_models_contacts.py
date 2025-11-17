import pytest
from django.utils import timezone
from django.contrib.auth import get_user_model

from core.models import AccountDeletionRequest, Contact, Tag


@pytest.mark.django_db
def test_account_deletion_request_create_and_consume():
    User = get_user_model()
    user = User.objects.create_user(username='u3', email='u3@example.com', password='p')
    req = AccountDeletionRequest.create_for_user(user, ttl_hours=1)
    assert req.is_valid()
    req.mark_consumed()
    req.refresh_from_db()
    assert not req.is_valid()


@pytest.mark.django_db
def test_contact_and_tag_relations():
    User = get_user_model()
    user = User.objects.create_user(username='u4', email='u4@example.com', password='p')
    t = Tag.objects.create(owner=user, name='friend')
    c = Contact.objects.create(owner=user, display_name='Timo', email='t@example.com')
    c.tags.add(t)
    assert t in c.tags.all()
    # ensure contact searchable by email
    found = Contact.objects.filter(owner=user, email__iexact='t@example.com').exists()
    assert found
