import base64
import json

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from core import resume_ai
from core.models import (
    CandidateProfile,
    CandidateSkill,
    Education,
    JobEntry,
    Skill,
    WorkExperience,
)

User = get_user_model()


@pytest.mark.django_db
class TestAIResumeEndpoint:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='ai-user',
            email='ai@example.com',
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
        self.education = Education.objects.create(
            candidate=self.profile,
            institution='NJIT',
            degree_type='ba',
            field_of_study='Computer Science',
            start_date='2015-01-01',
            end_date='2019-05-01',
        )
        self.job = JobEntry.objects.create(
            candidate=self.profile,
            title='Backend Engineer',
            company_name='Acme Corp',
            description='Looking for someone to scale APIs with Python and cloud.',
            job_type='ft',
            industry='Software',
        )
        self.url = reverse('job-resume-generate', kwargs={'job_id': self.job.id})
        self.tailor_url = reverse('tailor-experience', kwargs={'job_id': self.job.id, 'experience_id': self.work.id})
        self.tailor_bullet_url = reverse('tailor-experience-bullet', kwargs={'job_id': self.job.id, 'experience_id': self.work.id})
        self.client.force_authenticate(user=self.user)

    def test_ai_resume_requires_api_key(self, settings):
        settings.GEMINI_API_KEY = ''
        resp = self.client.post(self.url, {'tone': 'impact'}, format='json')
        assert resp.status_code == 503
        assert resp.json()['error']['code'] == 'service_unavailable'

    def test_ai_resume_success(self, monkeypatch, settings):
        settings.GEMINI_API_KEY = 'test-key'

        payload = {
            'shared_analysis': {
                'job_focus_summary': 'Role needs backend API leadership.',
                'keyword_strategy': ['Python', 'APIs'],
            },
            'variations': [
                {
                    'label': 'Impact Driven',
                    'tone': 'impact',
                    'summary_headline': 'API-Focused Engineer',
                    'summary': 'Delivers reliable APIs aligned with Acme needs.',
                    'skills_to_highlight': ['Python', 'Mentorship'],
                    'ats_keywords': ['Scalable APIs', 'Cloud'],
                    'experience_sections': [
                        {
                            'source_experience_id': self.work.id,
                            'role': 'Software Engineer',
                            'company': 'Tech Corp',
                            'location': 'Remote',
                            'dates': 'Jan 2022 – Present',
                            'bullets': [
                                'Scaled APIs handling 2M req/day.',
                                'Reduced latency by 30% via caching.',
                            ],
                        }
                    ],
                    'project_sections': [],
                    'education_highlights': [
                        {'source_education_id': self.education.id, 'notes': 'B.S. Computer Science, NJIT (2019)'}
                    ],
                }
            ],
        }

        monkeypatch.setattr(
            'core.resume_ai.call_gemini_api',
            lambda prompt, api_key, **kwargs: json.dumps(payload),
        )
        monkeypatch.setattr(
            'core.resume_ai.compile_latex_pdf',
            lambda latex: base64.b64encode(b'%PDF').decode('ascii'),
        )

        resp = self.client.post(self.url, {'tone': 'impact', 'variation_count': 1}, format='json')
        assert resp.status_code == 200
        data = resp.json()
        assert data['job']['id'] == self.job.id
        assert data['tone'] == 'impact'
        assert data['variation_count'] == 1
        variation = data['variations'][0]
        assert variation['experience_sections'][0]['bullets']
        assert '\\section{Experience}' in variation['latex_document']
        assert variation['pdf_document']

    def test_ai_resume_handles_generation_error(self, monkeypatch, settings):
        settings.GEMINI_API_KEY = 'test-key'

        def _boom(*args, **kwargs):
            raise resume_ai.ResumeAIError('synthetic failure')

        monkeypatch.setattr('core.resume_ai.call_gemini_api', _boom)
        resp = self.client.post(self.url, {'tone': 'impact'}, format='json')
        assert resp.status_code == 502
        assert resp.json()['error']['code'] == 'ai_generation_failed'

    def test_ai_resume_job_not_found(self, settings):
        settings.GEMINI_API_KEY = 'test-key'
        bad_url = reverse('job-resume-generate', kwargs={'job_id': self.job.id + 1})
        resp = self.client.post(bad_url, {'tone': 'impact'}, format='json')
        assert resp.status_code == 404

    def test_tailor_experience_variations_endpoint(self, monkeypatch, settings):
        settings.GEMINI_API_KEY = 'test-key'
        payload = {
            'experience_id': self.work.id,
            'variations': [
                {
                    'id': 'gem-impact',
                    'label': 'Gemini impact',
                    'description': 'Gemini rewrite',
                    'bullets': ['Gemini bullet text'],
                }
            ],
        }
        monkeypatch.setattr('core.resume_ai.generate_experience_variations', lambda *args, **kwargs: payload)

        resp = self.client.post(self.tailor_url, {'tone': 'impact', 'variation_count': 2}, format='json')
        assert resp.status_code == 200
        assert resp.json()['variations'][0]['bullets'][0] == 'Gemini bullet text'

    def test_tailor_experience_bullet_endpoint(self, monkeypatch, settings):
        settings.GEMINI_API_KEY = 'test-key'
        payload = {
            'experience_id': self.work.id,
            'bullet_index': 0,
            'bullet': 'Regenerated bullet text',
        }
        monkeypatch.setattr('core.resume_ai.generate_experience_bullet', lambda *args, **kwargs: payload)

        resp = self.client.post(self.tailor_bullet_url, {'tone': 'impact', 'bullet_index': 0}, format='json')
        assert resp.status_code == 200
        assert resp.json()['bullet'] == 'Regenerated bullet text'
