import json

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from core.models import CandidateProfile, WorkExperience, Skill, CandidateSkill, JobEntry

User = get_user_model()


@pytest.mark.django_db
class TestAICoverLetterEndpoint:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='ai-user-cl',
            email='ai-cl@example.com',
            password='pass1234',
            first_name='Ada',
            last_name='Lovelace',
        )
        self.profile = CandidateProfile.objects.create(
            user=self.user,
            headline='Senior Software Engineer',
            summary='Engineer with a passion for clean APIs.',
            city='Newark',
            state='NJ',
        )
        self.work = WorkExperience.objects.create(
            candidate=self.profile,
            company_name='Tech Corp',
            job_title='Software Engineer',
            location='Remote',
            start_date='2022-01-01',
            is_current=True,
            description='Built APIs.',
            achievements=['Increased reliability by 30%'],
        )
        self.skill = Skill.objects.create(name='Python', category='Language')
        CandidateSkill.objects.create(candidate=self.profile, skill=self.skill, level='expert', years=4)
        self.job = JobEntry.objects.create(
            candidate=self.profile,
            title='Backend Engineer',
            company_name='Acme Corp',
            description='Looking for someone to scale APIs with Python and cloud.',
            job_type='ft',
            industry='Software',
        )
        self.url = reverse('core:job-cover-letter-generate', kwargs={'job_id': self.job.id})
        self.client.force_authenticate(user=self.user)

    def test_ai_cover_letter_requires_api_key(self, settings):
        settings.GEMINI_API_KEY = ''
        resp = self.client.post(self.url, {'tone': 'professional'}, format='json')
        assert resp.status_code == 503
        assert resp.json()['error']['code'] == 'service_unavailable'

    def test_ai_cover_letter_success(self, monkeypatch, settings):
        settings.GEMINI_API_KEY = 'test-key'

        payload = {
            'shared_analysis': {
                'personalization_strategy': 'Reference mission and product momentum.',
                'key_achievements': ['Increased reliability by 30%'],
            },
            'variations': [
                {
                    'label': 'Warm + Data',
                    'tone': 'warm',
                    'opening_paragraph': f"I’m excited by Acme Corp’s vision for backend scale.",
                    'body_paragraphs': [
                        'At Tech Corp, I increased reliability by 30% and scaled APIs to millions of req/day.',
                    ],
                    'closing_paragraph': 'I’d welcome a conversation to share details and learn more.',
                    'achievements_referenced': ['Increased reliability by 30%'],
                    'keywords_used': ['Python', 'APIs'],
                    'news_citations': [],
                }
            ]
        }

        monkeypatch.setattr(
            'core.cover_letter_ai.resume_ai.call_gemini_api',
            lambda prompt, api_key, **kwargs: json.dumps(payload),
        )

        resp = self.client.post(self.url, {'tone': 'warm', 'variation_count': 1}, format='json')
        assert resp.status_code == 200
        data = resp.json()
        assert data['job']['id'] == self.job.id
        assert data['tone'] == 'warm'
        assert data['variation_count'] == 1
        var = data['variations'][0]
        assert 'opening_paragraph' in var and var['opening_paragraph']
        assert 'closing_paragraph' in var and var['closing_paragraph']
        assert 'full_text' in var and len(var['full_text']) > 10

    def test_ai_cover_letter_handles_generation_error(self, monkeypatch, settings):
        settings.GEMINI_API_KEY = 'test-key'

        from core.cover_letter_ai import CoverLetterAIError

        def _boom(*args, **kwargs):
            raise CoverLetterAIError('synthetic failure')

        monkeypatch.setattr('core.cover_letter_ai.resume_ai.call_gemini_api', _boom)
        resp = self.client.post(self.url, {'tone': 'balanced'}, format='json')
        assert resp.status_code == 502
        assert resp.json()['error']['code'] == 'ai_generation_failed'

    def test_ai_cover_letter_job_not_found(self, settings):
        settings.GEMINI_API_KEY = 'test-key'
        bad_url = reverse('core:job-cover-letter-generate', kwargs={'job_id': self.job.id + 1})
        resp = self.client.post(bad_url, {'tone': 'professional'}, format='json')
        assert resp.status_code == 404
