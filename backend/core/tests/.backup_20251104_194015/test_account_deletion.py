import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import CandidateProfile, CandidateSkill, AccountDeletionRequest, Skill
from django.utils import timezone

User = get_user_model()

@pytest.mark.django_db
class TestAccountDeletion:
    def setup_method(self):
        self.client = APIClient()
        self.email = 'testuser@example.com'
        self.password = 'testpass123'
        self.user = User.objects.create_user(username='testuid', email=self.email, password=self.password)
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def test_request_deletion_creates_token_and_sends_200(self):
        url = reverse('core:request-account-deletion')
        response = self.client.post(url)
        assert response.status_code == 200
        assert AccountDeletionRequest.objects.filter(user=self.user, consumed=False).exists()

    def test_request_deletion_token_expires_in_one_hour(self):
        url = reverse('core:request-account-deletion')
        before = timezone.now()
        response = self.client.post(url)
        assert response.status_code == 200
        deletion = AccountDeletionRequest.objects.filter(user=self.user, consumed=False).latest('created_at')
        # TTL ~1 hour
        assert deletion.expires_at <= before + timezone.timedelta(hours=1, minutes=1)
        assert deletion.expires_at >= before + timezone.timedelta(minutes=50)

    def test_confirm_deletion_removes_user_and_profile(self):
        # Create pending deletion
        deletion = AccountDeletionRequest.create_for_user(self.user)
        # Add a skill to profile
        skill = Skill.objects.create(name='Python')
        CandidateSkill.objects.create(candidate=self.profile, skill=skill, level='beginner')
        # Confirm via POST
        url = reverse('core:confirm-account-deletion', kwargs={'token': deletion.token})
        response = self.client.post(url)
        assert response.status_code == 200
        assert User.objects.filter(username='testuid').count() == 0
        assert CandidateProfile.objects.filter(user__username='testuid').count() == 0
        assert CandidateSkill.objects.filter(candidate__user__username='testuid').count() == 0

    def test_request_deletion_requires_auth(self):
        self.client.force_authenticate(user=None)
        url = reverse('core:request-account-deletion')
        response = self.client.post(url)
        assert response.status_code == 401
