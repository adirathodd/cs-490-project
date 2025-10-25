import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import CandidateProfile, CandidateSkill

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

    def test_delete_account_removes_user_and_profile(self):
        # Add a skill to profile
        CandidateSkill.objects.create(candidate=self.profile, skill_id=1, level='beginner')
        url = reverse('core:current-user')
        response = self.client.delete(url)
        assert response.status_code == 200
        assert User.objects.filter(username='testuid').count() == 0
        assert CandidateProfile.objects.filter(user__username='testuid').count() == 0
        assert CandidateSkill.objects.filter(candidate__user__username='testuid').count() == 0

    def test_delete_account_returns_200(self):
        url = reverse('core:current-user')
        response = self.client.delete(url)
        assert response.status_code == 200
        assert 'Account deleted successfully' in response.data['message']

    def test_delete_account_requires_auth(self):
        self.client.force_authenticate(user=None)
        url = reverse('core:current-user')
        response = self.client.delete(url)
        assert response.status_code == 401
