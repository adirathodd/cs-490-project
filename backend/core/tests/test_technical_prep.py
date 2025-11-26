"""
Tests for UC-078 Technical Interview Preparation endpoints.
"""

from datetime import datetime, timezone as datetime_timezone
import time
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.models import CandidateProfile, JobEntry, TechnicalPrepCache, TechnicalPrepGeneration
from core.technical_prep import TechnicalPrepGenerator, build_technical_prep_fallback
from django.utils import timezone

User = get_user_model()


@pytest.mark.django_db
class TestTechnicalPrepEndpoint:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='techprep-user',
            email='techprep@example.com',
            password='safe-pass-123',
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.job = JobEntry.objects.create(
            candidate=self.profile,
            title='Senior Platform Engineer',
            company_name='Prep Corp',
            industry='Software',
            description='Build resilient services with Python and AWS.',
            status='applied',
        )
        self.client.force_authenticate(user=self.user)
        self._enqueue_patcher = mock.patch('core.tasks.enqueue_technical_prep_generation')
        self.mock_enqueue = self._enqueue_patcher.start()
        self.mock_enqueue.side_effect = lambda generation_id: None

    def teardown_method(self):
        if hasattr(self, '_enqueue_patcher'):
            self._enqueue_patcher.stop()

    def _mock_problem_sets(self):
        primary = [
            {"slug": "group-anagrams", "title": "Group Anagrams", "difficulty": "mid"},
            {"slug": "two-sum", "title": "Two Sum", "difficulty": "entry"},
            {"slug": "course-schedule", "title": "Course Schedule", "difficulty": "mid"},
            {"slug": "lru-cache", "title": "LRU Cache", "difficulty": "senior"},
            {"slug": "merge-intervals", "title": "Merge Intervals", "difficulty": "mid"},
        ]
        suggested = [
            {"slug": "binary-tree-level-order-traversal", "title": "Binary Tree Level Order Traversal", "difficulty": "mid"},
            {"slug": "climbing-stairs", "title": "Climbing Stairs", "difficulty": "entry"},
            {"slug": "maximum-subarray", "title": "Maximum Subarray", "difficulty": "entry"},
            {"slug": "jump-game", "title": "Jump Game", "difficulty": "mid"},
            {"slug": "palindromic-substrings", "title": "Palindromic Substrings", "difficulty": "mid"},
        ]
        return primary, suggested

    def _sample_ai_responses(self):
        summary = {
            "tech_stack": {"languages": ["Python"], "frameworks": ["Django"], "tooling": ["AWS"]},
            "focus_areas": [
                {
                    "skill": "Scalability",
                    "category": "Technical",
                    "recommended_hours": 8,
                    "practice_tip": "Discuss measurable reliability improvements.",
                    "relevance": "core",
                }
            ],
        }
        coding = {
            "coding_challenges": [
                {
                    "slug": "group-anagrams",
                    "title": "Scale API throughput",
                    "description": "Tune async workers for burst traffic.",
                    "difficulty": "senior",
                    "objectives": ["Define SLAs", "Implement bulkheads"],
                    "best_practices": ["Narrate tradeoffs"],
                    "timer": {
                        "recommended_minutes": 45,
                        "benchmark": "Pass core tests",
                        "stretch_goal": "Outline rollback strategy",
                    },
                    "evaluation_metrics": ["Latency", "Error budget"],
                    "solution_outline": {
                        "setup": ["Clarify dependencies"],
                        "implementation": ["Add circuit breakers"],
                        "testing": ["Load test critical flows"],
                    },
                    "real_world_alignment": "Matches customer-facing API work.",
                },
                {
                    "slug": "two-sum",
                    "title": "Data pipeline guardrails",
                    "description": "Design validation + backfill routines for analytics jobs.",
                    "difficulty": "mid",
                    "objectives": ["Catch regressions", "Recover missing batches"],
                    "best_practices": ["Automate alerts", "Document thresholds"],
                    "timer": {
                        "recommended_minutes": 35,
                        "benchmark": "Detect schema drift fast",
                        "stretch_goal": "Propose rollback automation",
                    },
                    "evaluation_metrics": ["Data freshness", "Accuracy"],
                    "solution_outline": {
                        "setup": ["Map upstream dependencies"],
                        "implementation": ["Build validation kernel"],
                        "testing": ["Simulate null batches"],
                    },
                    "real_world_alignment": "Aligns with data reliability interviews.",
                },
                {
                    "slug": "course-schedule",
                    "title": "Schedule orchestration",
                    "description": "Coordinate dependency-heavy workflows.",
                    "difficulty": "mid",
                    "objectives": ["Map DAG", "De-risk retries"],
                    "best_practices": ["Explain observability"],
                    "timer": {"recommended_minutes": 40, "benchmark": "Draft resilient plan", "stretch_goal": "Add blue/green"},
                    "evaluation_metrics": ["Throughput"],
                    "solution_outline": {
                        "setup": ["Audit tasks"],
                        "implementation": ["Define scheduling"],
                        "testing": ["Chaos drill"],
                    },
                    "real_world_alignment": "Covers async flows.",
                },
                {
                    "slug": "lru-cache",
                    "title": "Caching warm path",
                    "description": "Design LRU cache + eviction policy.",
                    "difficulty": "senior",
                    "objectives": ["Protect p99", "Cover degradations"],
                    "best_practices": ["Narrate monitoring"],
                    "timer": {"recommended_minutes": 30, "benchmark": "Explain API contract", "stretch_goal": "Discuss TTL"},
                    "evaluation_metrics": ["Hit rate"],
                    "solution_outline": {
                        "setup": ["Gather access patterns"],
                        "implementation": ["Pick eviction"],
                        "testing": ["Simulate spikes"],
                    },
                    "real_world_alignment": "Used in infra rounds.",
                },
                {
                    "slug": "merge-intervals",
                    "title": "Incident merge",
                    "description": "Normalize overlapping maintenance windows.",
                    "difficulty": "mid",
                    "objectives": ["Sort events", "Resolve conflicts"],
                    "best_practices": ["Clarify assumptions"],
                    "timer": {"recommended_minutes": 25, "benchmark": "Ship tested helper", "stretch_goal": "Add audit trail"},
                    "evaluation_metrics": ["Correctness"],
                    "solution_outline": {
                        "setup": ["Ask clarifying questions"],
                        "implementation": ["Process intervals"],
                        "testing": ["Edge cases"],
                    },
                    "real_world_alignment": "Matches ops interviews.",
                },
            ],
            "suggested_challenges": [
                {
                    "slug": "binary-tree-level-order-traversal",
                    "title": "Operational telemetry",
                    "description": "Traverse dependencies layer by layer.",
                    "difficulty": "mid",
                    "timer": {"recommended_minutes": 18},
                    "practice_focus": "Clarify traversal narration",
                    "key_metric": "Node throughput",
                },
                {
                    "slug": "climbing-stairs",
                    "title": "Release iteration cadence",
                    "description": "Reason about incremental rollouts.",
                    "difficulty": "entry",
                    "timer": {"recommended_minutes": 12},
                    "practice_focus": "Explain recursion vs DP tradeoff",
                    "key_metric": "Deployment velocity",
                },
                {
                    "slug": "maximum-subarray",
                    "title": "Traffic smoothing",
                    "description": "Spot best performing segments.",
                    "difficulty": "entry",
                    "timer": {"recommended_minutes": 15},
                    "practice_focus": "Narrate sliding window",
                    "key_metric": "Throughput gain",
                },
                {
                    "slug": "jump-game",
                    "title": "Experiment migration",
                    "description": "Map min hops to milestone.",
                    "difficulty": "mid",
                    "timer": {"recommended_minutes": 16},
                    "practice_focus": "Tie greedy proof",
                    "key_metric": "Time-to-value",
                },
                {
                    "slug": "palindromic-substrings",
                    "title": "Content normalization",
                    "description": "Detect mirrored signals.",
                    "difficulty": "mid",
                    "timer": {"recommended_minutes": 20},
                    "practice_focus": "Discuss expand-around-center",
                    "key_metric": "Detection accuracy",
                },
            ],
        }
        advanced = {
            "system_design_scenarios": [
                {
                    "title": "Realtime insights",
                    "scenario": "Surface metrics for enterprise teams.",
                    "requirements": ["Sub-second dashboards"],
                    "constraints": ["Regional data residency"],
                    "evaluation": ["Partitioning strategy"],
                    "whiteboarding_tips": ["Draw control + data planes"],
                    "follow_up_questions": ["How to handle replay traffic?"],
                }
            ],
            "case_studies": [
                {
                    "title": "Platform modernization",
                    "role_focus": "Consulting",
                    "scenario": "Migrate legacy batch flows.",
                    "tasks": ["Quantify toil", "Sequence rollout"],
                    "expected_output": ["Pilot plan", "KPIs"],
                    "best_practices": ["Tie to business impact"],
                }
            ],
            "technical_questions": [
                {
                    "prompt": "Walk through scaling a multi-tenant API.",
                    "linked_skill": "System architecture",
                    "difficulty": "advanced",
                    "job_requirement": "Lead reliability initiatives",
                    "answer_framework": ["Context", "Bottleneck", "Result"],
                }
            ],
            "solution_frameworks": [
                {
                    "name": "TRACE",
                    "steps": ["Trigger", "Requirements", "Architecture", "Checks", "Evolution"],
                    "best_practices": ["Tie to customer metrics"],
                }
            ],
            "whiteboarding_practice": {
                "techniques": ["Narrate assumptions"],
                "drills": [
                    {"name": "API contract sprint", "duration_minutes": 12, "steps": ["Outline resources"]},
                ],
                "evaluation_rubric": ["Communication", "Tradeoffs"],
                "timed_exercises": [{"name": "Five-minute diagram", "goal": "Explain MVP architecture"}],
            },
            "real_world_alignment": [
                {
                    "skill": "Observability",
                    "scenario": "Design SLO dashboards for execs.",
                    "business_link": "Keeps churn low",
                    "suggested_story": "Describe how you tied alerts to ARR risk.",
                }
            ],
        }
        return [summary, coding, advanced]

    def _seed_ready_cache(self, job=None, generated_at=None):
        job = job or self.job
        payload = build_technical_prep_fallback(job, self.profile)
        generated_at = generated_at or timezone.now()
        return TechnicalPrepCache.objects.create(
            job=job,
            prep_data=payload,
            source=payload.get('source', 'fallback'),
            generated_at=generated_at,
            is_valid=True,
        )

    def test_response_includes_generation_metadata(self, settings):
        settings.GEMINI_API_KEY = 'fake-key'

        url = reverse('core:job-technical-prep', kwargs={'job_id': self.job.id})
        first_ts = timezone.make_aware(datetime(2024, 1, 1, 12, 0, 0))
        refresh_ts = timezone.make_aware(datetime(2024, 1, 1, 12, 30, 0))
        cached_read_ts = timezone.make_aware(datetime(2024, 1, 1, 13, 0, 0))
        cache = self._seed_ready_cache(generated_at=first_ts)

        def iso_utc(dt):
            return dt.astimezone(datetime_timezone.utc).isoformat()

        first_response = self.client.get(url)
        assert first_response.status_code == status.HTTP_200_OK
        first_data = first_response.json()
        first_iso = iso_utc(first_ts)
        assert first_data['generated_at'] == first_iso
        assert first_data['cache_generated_at'] == first_iso
        assert first_data['cached_at'] == first_iso
        assert first_data['build_status']['state'] == 'idle'

        with mock.patch('django.utils.timezone.now', return_value=cached_read_ts):
            cached_response = self.client.get(url)
        assert cached_response.status_code == status.HTTP_200_OK
        cached_data = cached_response.json()
        assert cached_data['generated_at'] == first_iso
        assert 'refreshed_at' not in cached_data

        with mock.patch('django.utils.timezone.now', return_value=refresh_ts):
            refreshed_response = self.client.get(f"{url}?refresh=true")
        assert refreshed_response.status_code == status.HTTP_200_OK
        refreshed_data = refreshed_response.json()
        refresh_iso = iso_utc(refresh_ts)
        assert refreshed_data['generated_at'] == first_iso  # cached payload returned
        assert refreshed_data['refreshed_at'] == refresh_iso
        assert refreshed_data['build_status']['state'] == TechnicalPrepGeneration.STATUS_PENDING
        assert TechnicalPrepGeneration.objects.filter(job=self.job).count() == 1

    def test_returns_structured_prep_sections(self, settings):
        settings.GEMINI_API_KEY = 'fake-key'
        self._seed_ready_cache()

        url = reverse('core:job-technical-prep', kwargs={'job_id': self.job.id})
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data['has_data'] is True
        assert data['job_title'] == 'Senior Platform Engineer'
        assert 'coding_challenges' in data and len(data['coding_challenges']) > 0
        assert data['focus_areas'][0]['id']
        challenge = data['coding_challenges'][0]
        assert 'title' in challenge and challenge['title']
        assert 'timer' in challenge and 'recommended_minutes' in challenge['timer']
        assert 'practice_stats' in challenge

        assert 'system_design_scenarios' in data and len(data['system_design_scenarios']) > 0
        assert 'case_studies' in data and len(data['case_studies']) > 0
        assert 'whiteboarding_practice' in data
        assert 'real_world_alignment' in data and len(data['real_world_alignment']) > 0

    def test_logging_practice_updates_stats(self, settings):
        settings.GEMINI_API_KEY = 'fake-key'
        self._seed_ready_cache()

        prep_url = reverse('core:job-technical-prep', kwargs={'job_id': self.job.id})
        prep_data = self.client.get(prep_url).json()
        challenge = prep_data['coding_challenges'][0]

        practice_url = reverse('core:job-technical-prep-practice', kwargs={'job_id': self.job.id})
        payload = {
            'challenge_id': challenge['id'],
            'challenge_title': challenge['title'],
            'challenge_type': 'coding',
            'duration_seconds': 1800,
            'tests_passed': 5,
            'tests_total': 6,
            'confidence': 'steady',
            'notes': 'Struggled with caching layer but recovered.',
        }
        response = self.client.post(practice_url, payload, format='json')
        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body['challenge_stats']['attempts'] == 1
        assert body['challenge_stats']['best_time_seconds'] == 1800
        assert body['challenge_stats']['best_accuracy'] is not None

        refreshed = self.client.get(prep_url).json()
        refreshed_challenge = next(item for item in refreshed['coding_challenges'] if item['id'] == challenge['id'])
        assert refreshed_challenge['practice_stats']['attempts'] == 1
        assert len(refreshed_challenge['recent_attempts']) == 1

    def test_non_technical_jobs_hide_coding_sections(self, settings):
        settings.GEMINI_API_KEY = 'fake-key'

        consulting_job = JobEntry.objects.create(
            candidate=self.profile,
            title='Strategy Consultant',
            company_name='Prep Corp',
            industry='Consulting',
            description='Lead business cases and executive alignment.',
            status='applied',
        )

        url = reverse('core:job-technical-prep', kwargs={'job_id': consulting_job.id})
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['role_profile'] == 'business'
        assert data['coding_challenges'] == []
        assert data['suggested_challenges'] == []

    def test_software_engineer_roles_remain_technical(self, settings):
        settings.GEMINI_API_KEY = 'fake-key'

        engineer_job = JobEntry.objects.create(
            candidate=self.profile,
            title='Software Engineer',
            company_name='Prep Corp',
            industry='Software',
            description='Design and build REST APIs in Python and React across microservices.',
            status='applied',
        )

        url = reverse('core:job-technical-prep', kwargs={'job_id': engineer_job.id})
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data['role_profile'] == 'technical'
        assert len(data['coding_challenges']) > 0
        assert len(data['suggested_challenges']) > 0

    def test_description_with_engineering_signals_marks_role_technical(self, settings):
        settings.GEMINI_API_KEY = 'fake-key'

        api_pm_job = JobEntry.objects.create(
            candidate=self.profile,
            title='Product Manager',
            company_name='Prep Corp',
            industry='Software',
            description='Own the API platform roadmap, partner with engineers to design microservices and review Python code.',
            status='applied',
        )

        url = reverse('core:job-technical-prep', kwargs={'job_id': api_pm_job.id})
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data['role_profile'] == 'technical'
        assert data['coding_challenges']
        assert data['suggested_challenges']

    @mock.patch('core.technical_prep.TechnicalPrepGenerator._request_gemini', side_effect=AssertionError("Should not call Gemini when cache is present"))
    def test_cached_plan_reclassified_to_business(self, mock_request, settings):
        settings.GEMINI_API_KEY = 'fake-key'

        consulting_job = JobEntry.objects.create(
            candidate=self.profile,
            title='Business Analyst 4-Ops',
            company_name='Oracle',
            industry='Operations',
            description='Analyze processes and drive business programs.',
            status='applied',
        )

        TechnicalPrepCache.objects.create(
            job=consulting_job,
            prep_data={
                'role_profile': 'technical',
                'coding_challenges': [{'id': 'legacy', 'title': 'Legacy Challenge', 'slug': 'two-sum'}],
                'suggested_challenges': [{'id': 'legacy-suggested', 'title': 'Legacy Suggested', 'slug': 'two-sum-ii-input-array-is-sorted'}],
                'case_studies': [{'id': 'case', 'title': 'Business Case'}],
            },
            source='ai',
            generated_at=timezone.now(),
            is_valid=True,
        )

        url = reverse('core:job-technical-prep', kwargs={'job_id': consulting_job.id})
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data['role_profile'] == 'business'
        assert data['coding_challenges'] == []
        assert data['suggested_challenges'] == []

    def test_endpoint_returns_fallback_when_cache_missing(self, settings):
        settings.GEMINI_API_KEY = 'fake-key'
        url = reverse('core:job-technical-prep', kwargs={'job_id': self.job.id})
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['coding_challenges'], 'Fallback drills should populate when cache is empty'
        assert data['build_status']['state'] == TechnicalPrepGeneration.STATUS_PENDING
        assert TechnicalPrepGeneration.objects.filter(job=self.job).count() == 1

    def test_refresh_request_queues_generation_without_invalidating_cache(self, settings):
        settings.GEMINI_API_KEY = 'fake-key'
        self._seed_ready_cache()
        url = reverse('core:job-technical-prep', kwargs={'job_id': self.job.id})
        response = self.client.get(f"{url}?refresh=true")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['coding_challenges']
        assert data['build_status']['state'] == TechnicalPrepGeneration.STATUS_PENDING
        assert TechnicalPrepCache.objects.filter(job=self.job, is_valid=True).count() == 1

    def test_build_technical_prep_fallback_returns_structured_payload(self, settings):
        settings.GEMINI_API_KEY = ''
        payload = build_technical_prep_fallback(self.job, self.profile)
        assert payload['coding_challenges']
        assert payload['system_design_scenarios']
        assert payload['focus_areas']

    def test_request_gemini_respects_build_budget(self, settings):
        settings.GEMINI_API_KEY = 'fake-key'
        generator = TechnicalPrepGenerator(self.job, self.profile)
        generator.deadline = time.monotonic() - 1
        with pytest.raises(TimeoutError):
            generator._request_gemini('{"prompt": "test"}')
