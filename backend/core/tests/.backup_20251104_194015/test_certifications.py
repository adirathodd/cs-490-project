import pytest
from datetime import date, timedelta
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import CandidateProfile, Certification

User = get_user_model()


@pytest.mark.django_db
class TestCertifications:
    def setup_method(self):
        self.user = User.objects.create_user(username='uid123', email='user@example.com')
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client = APIClient()
        # Simulate auth middleware by setting request.user
        self.client.force_authenticate(user=self.user)

    def test_list_empty(self):
        url = reverse('core:certifications-list-create')
        resp = self.client.get(url)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_and_expiration_flags(self):
        url = reverse('core:certifications-list-create')
        payload = {
            'name': 'AWS Certified Cloud Practitioner',
            'issuing_organization': 'Amazon Web Services (AWS)',
            'issue_date': str(date.today()),
            'expiry_date': str(date.today() + timedelta(days=90)),
            'does_not_expire': False,
            'credential_id': 'ABC-123',
            'category': 'Cloud',
            'renewal_reminder_enabled': True,
            'reminder_days_before': 30,
        }
        resp = self.client.post(url, payload, format='json')
        assert resp.status_code == 201, resp.content
        data = resp.json()
        assert data['name'] == payload['name']
        assert data['issuing_organization'] == payload['issuing_organization']
        assert data['does_not_expire'] is False
        assert data['is_expired'] is False
        assert isinstance(data['days_until_expiration'], int)
        assert data['category'] == 'Cloud'
        assert data['renewal_reminder_enabled'] is True
        assert data['reminder_days_before'] == 30
        assert data['reminder_date'] is not None

    def test_update_and_delete(self):
        cert = Certification.objects.create(
            candidate=self.profile,
            name='PMP',
            issuing_organization='PMI',
            issue_date=date(2020, 1, 1),
            expiry_date=date.today() - timedelta(days=1),
        )
        url = reverse('core:certification-detail', args=[cert.id])
        # Update to never expire
        resp = self.client.patch(url, {'does_not_expire': True}, format='json')
        assert resp.status_code == 200
        data = resp.json()
        assert data['does_not_expire'] is True
        assert data['is_expired'] is False
        # Delete
        resp = self.client.delete(url)
        assert resp.status_code == 200
        assert Certification.objects.filter(id=cert.id).count() == 0
