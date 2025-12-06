from django.test import override_settings
from rest_framework.test import APITestCase, APIClient
from django.urls import reverse
from django.contrib.auth import get_user_model
from core.models import CandidateProfile, JobEntry
from unittest.mock import patch

User = get_user_model()


@override_settings(GEMINI_API_KEY='test-key')
class CoverLetterGenerationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuid', email='tester@example.com', password='pass')
        # Ensure profile exists
        self.profile = CandidateProfile.objects.create(user=self.user)
        # Create a minimal job entry
        self.job = JobEntry.objects.create(candidate=self.profile, title='Software Engineer', company_name='Acme Inc')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch('core.cover_letter_ai.run_cover_letter_generation')
    def test_generate_with_valid_customization(self, mock_run):
        # Mock AI generation result
        mock_run.return_value = {
            'variation_count': 1,
            'variations': [
                {
                    'id': 'v1',
                    'label': 'Variation 1',
                    'tone': 'balanced',
                    'opening_paragraph': 'Hello',
                    'body_paragraphs': ['Body'],
                    'closing_paragraph': 'Sincerely',
                }
            ],
            'shared_analysis': {'tone_rationale': 'Matches tone well.'}
        }

        url = reverse('job-cover-letter-generate', kwargs={'job_id': self.job.id})
        payload = {
            'tone': 'balanced',
            'variation_count': 1,
            'length': 'standard',
            'writing_style': 'direct',
            'company_culture': 'auto',
            'industry': 'fintech',
            'custom_instructions': 'Emphasize leadership.'
        }

        resp = self.client.post(url, payload, format='json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # Basic sanity checks on returned shape
        self.assertIn('variations', data)
        self.assertEqual(len(data['variations']), 1)
        self.assertEqual(data['variations'][0]['id'], 'v1')
        mock_run.assert_called_once()

    def test_generate_with_invalid_enums_returns_400(self):
        url = reverse('job-cover-letter-generate', kwargs={'job_id': self.job.id})
        payload = {
            'tone': 'balanced',
            'variation_count': 1,
            'length': 'unknown_length',
            'writing_style': 'weird_style',
            'company_culture': 'alien_culture',
        }

        resp = self.client.post(url, payload, format='json')
        self.assertEqual(resp.status_code, 400)
        data = resp.json()
        self.assertIn('error', data)
        self.assertEqual(data['error']['code'], 'invalid_parameter')
        # details should mention each invalid field
        details = data['error'].get('details', [])
        self.assertTrue(any('length must be one of' in d for d in details))
        self.assertTrue(any('writing_style must be one of' in d for d in details))
        self.assertTrue(any('company_culture must be one of' in d for d in details))
