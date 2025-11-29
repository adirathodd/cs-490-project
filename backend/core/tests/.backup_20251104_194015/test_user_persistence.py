import uuid
import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from core.models import UserAccount, CandidateProfile


@pytest.mark.django_db
def test_user_account_created_and_email_normalized():
    User = get_user_model()
    user = User.objects.create_user(username='uid_123', email='TestUser@Example.COM', first_name='T', last_name='U')
    user.set_password('StrongPass1!')
    user.save()

    # UserAccount is created via signal
    account = UserAccount.objects.get(user=user)
    assert isinstance(account.id, uuid.UUID)
    assert account.email == 'testuser@example.com'

    # Password should be stored using bcrypt hasher
    assert user.password.startswith('bcrypt'), 'Password should be hashed with bcrypt*'

    # CandidateProfile linkage remains intact (created elsewhere on flows), ensure model allows linking
    # Create a profile to validate relation wiring
    profile = CandidateProfile.objects.create(user=user)
    assert profile.user == user


@pytest.mark.django_db
def test_user_account_unique_email_constraint():
    User = get_user_model()
    u1 = User.objects.create_user(username='uid_a', email='dup@example.com')
    u1.set_password('Pass12345!')
    u1.save()
    # Ensure account exists
    acc1 = UserAccount.objects.get(user=u1)

    # Attempt to create another user with the same email in UserAccount
    u2 = User.objects.create_user(username='uid_b', email='DUP@EXAMPLE.com')
    u2.set_password('Pass12345!')
    u2.save()

    # Signals would try to sync, but enforce uniqueness
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            UserAccount.objects.create(user=u2, email='dup@example.com')
