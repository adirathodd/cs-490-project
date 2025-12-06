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
        self.url = reverse('job-cover-letter-generate', kwargs={'job_id': self.job.id})
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
        bad_url = reverse('job-cover-letter-generate', kwargs={'job_id': self.job.id + 1})
        resp = self.client.post(bad_url, {'tone': 'professional'}, format='json')
        assert resp.status_code == 404


@pytest.mark.django_db
class TestCoverLetterLatexGeneration:
    """Test LaTeX generation for cover letters."""

    def test_generate_cover_letter_latex(self):
        """Test that LaTeX generation produces valid document structure."""
        from core.cover_letter_ai import generate_cover_letter_latex

        latex = generate_cover_letter_latex(
            candidate_name='John Doe',
            candidate_email='john@example.com',
            candidate_phone='555-1234',
            candidate_location='San Francisco, CA',
            company_name='Acme Corp',
            job_title='Software Engineer',
            opening_paragraph='I am excited to apply for the Software Engineer position.',
            body_paragraphs=[
                'I have 5 years of experience in Python and Django.',
                'My previous work includes building scalable APIs.'
            ],
            closing_paragraph='I look forward to discussing this opportunity with you.',
        )

        # Check document structure
        assert '\\documentclass[letterpaper,11pt]{article}' in latex
        assert '\\begin{document}' in latex
        assert '\\end{document}' in latex
        
        # Check header
        assert 'John Doe' in latex
        assert 'john@example.com' in latex
        assert '555-1234' in latex
        assert 'San Francisco, CA' in latex
        
        # Check job info
        assert 'Acme Corp' in latex
        assert 'Software Engineer' in latex
        
        # Check content
        assert 'I am excited to apply' in latex
        assert '5 years of experience' in latex
        assert 'I look forward to discussing' in latex
        assert 'Sincerely,' in latex

    def test_latex_escaping(self):
        """Test that special LaTeX characters are properly escaped."""
        from core.cover_letter_ai import generate_cover_letter_latex

        latex = generate_cover_letter_latex(
            candidate_name='Jane Smith & Co.',
            candidate_email='jane@test.com',
            candidate_phone='555-0000',
            candidate_location='Test City',
            company_name='Test & Associates',
            job_title='Developer #1',
            opening_paragraph='I have experience with C++ & Python.',
            body_paragraphs=['I worked on projects worth $100K+'],
            closing_paragraph='Looking forward to it!',
        )

        # Check that special characters are escaped
        assert r'\&' in latex  # & should be escaped
        assert r'\$' in latex  # $ should be escaped
        assert r'\#' in latex  # # should be escaped
        # The actual text should not contain unescaped special characters in content areas
