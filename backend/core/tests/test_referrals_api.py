from django.urls import reverse
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from django.contrib.auth import get_user_model
from core.models import JobOpportunity, CandidateProfile, Application, Referral
import json

User = get_user_model()


class ReferralStatusAPITests(APITestCase):
    def setUp(self):
        # Create a user and candidate profile
        self.user = User.objects.create_user(username='testuser', email='test@example.com')
        self.client = APIClient()
        # Authenticate by forcing user (tests bypass Firebase)
        self.client.force_authenticate(user=self.user)

        self.candidate_profile = CandidateProfile.objects.create(user=self.user)
        # Create a job and application
        self.job = JobOpportunity.objects.create(title='Test Job', company_name='TestCo')
        self.application = Application.objects.create(candidate=self.candidate_profile, job=self.job)
        # Create a referral
        self.referral = Referral.objects.create(application=self.application, contact=None, notes='{}', status='draft')

    def test_mark_sent(self):
        url = reverse('core:referral-mark-sent', args=[str(self.referral.id)])
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.referral.refresh_from_db()
        self.assertEqual(self.referral.status, 'requested')

    def test_mark_response_accepted(self):
        # First mark sent so response is meaningful
        url_sent = reverse('core:referral-mark-sent', args=[str(self.referral.id)])
        self.client.post(url_sent)

        url = reverse('core:referral-response', args=[str(self.referral.id)])
        resp = self.client.post(url, data={'accepted': True}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.referral.refresh_from_db()
        self.assertIn(self.referral.status, ['received', 'used', 'accepted'])

    def test_mark_completed_and_uncomplete(self):
        # mark completed
        url_complete = reverse('core:referral-complete', args=[str(self.referral.id)])
        resp = self.client.post(url_complete)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.referral.refresh_from_db()
        self.assertEqual(self.referral.status, 'used')
        self.assertIsNotNone(self.referral.completed_date)

        # uncomplete
        url_un = reverse('core:referral-uncomplete', args=[str(self.referral.id)])
        resp2 = self.client.post(url_un)
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.referral.refresh_from_db()
        self.assertEqual(self.referral.status, 'requested')