from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.utils import timezone

from core.models import Company, JobOpportunity, ReferralRequest

User = get_user_model()


class ReferralUnmarkTestCase(TestCase):
    """Verify that a completed referral can be reverted via PATCH (unmark completed)."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='refuser', email='ref@example.com')
        self.client.force_authenticate(user=self.user)

        # create minimal company and job
        self.company = Company.objects.create(name='Acme')
        self.job = JobOpportunity.objects.create(company=self.company, title='Backend Engineer')

        # create a completed referral
        self.referral = ReferralRequest.objects.create(
            user=self.user,
            job=self.job,
            referral_source_name='Alice Referrer',
            status='completed',
            referral_given_date=timezone.now()
        )

    def test_patch_unmark_completed_resets_status_and_clears_date(self):
        url = f'/api/referral-requests/{self.referral.id}/'
        payload = {
            'status': 'accepted',
            'referral_given_date': None,
            'referral_source_name': self.referral.referral_source_name
        }

        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, 200)

        self.referral.refresh_from_db()
        self.assertEqual(self.referral.status, 'accepted')
        self.assertIsNone(self.referral.referral_given_date)
