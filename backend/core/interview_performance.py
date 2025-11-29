import json
import logging
from statistics import mean
from typing import Any, Dict, Iterable

from django.conf import settings
from django.db import models
from django.db.models import Avg, Case, Count, Q, Value, When
from django.db.models.functions import TruncMonth
from django.utils import timezone

from core.models import (
    CandidateProfile,
    InterviewChecklistProgress,
    InterviewSchedule,
    InterviewSuccessPrediction,
    JobEntry,
    JobStatusChange,
    TechnicalPrepPractice,
)

logger = logging.getLogger(__name__)


class InterviewPerformanceAnalyticsService:
    """Generate UC-080 interview performance analytics for a candidate."""

    OUTCOME_SCORES = {
        'excellent': 1.0,
        'good': 0.8,
        'average': 0.55,
        'poor': 0.35,
        'rejected': 0.0,
        'withdrew': 0.2,
    }

    def __init__(self, candidate: CandidateProfile):
        self.candidate = candidate
        self.now = timezone.now()
        self._gemini_api_key = getattr(settings, 'GEMINI_API_KEY', '')
        self._gemini_model = getattr(settings, 'GEMINI_MODEL', 'gemini-2.5-flash')
        self._offer_job_ids = self._get_offer_job_ids()

    def build(self) -> Dict[str, Any]:
        interviews = (
            InterviewSchedule.objects.filter(candidate=self.candidate)
            .select_related('job')
            .prefetch_related('checklist_progress')
        )
        total = interviews.count()
        if not total:
            return self._empty_payload()

        summary = self._build_summary(interviews)
        company_types = self._company_type_trends(interviews)
        formats = self._format_performance(interviews)
        preparation = self._preparation_areas()
        practice = self._practice_impact(interviews)
        timeline = self._timeline(interviews, practice.get('timeline_overlay', {}))
        benchmarks = self._benchmarks(interviews, summary, practice)
        insights = self._insights(summary, company_types, formats, preparation, practice, benchmarks)
        ai_recommendations = self._ai_recommendations(summary, formats, preparation, benchmarks, insights)

        return {
            'summary': summary,
            'company_type_trends': company_types,
            'format_performance': formats,
            'preparation_areas': preparation,
            'practice_impact': practice,
            'timeline': timeline,
            'benchmarks': benchmarks,
            'insights': insights,
            'ai_recommendations': ai_recommendations,
            'generated_at': self.now.isoformat(),
        }

    # ------------------------------------------------------------------ summary
    def _build_summary(self, interviews: Iterable[InterviewSchedule]) -> Dict[str, Any]:
        unique_job_ids = list(
            interviews.values_list('job_id', flat=True).distinct()
        )
        offer_job_ids = self._offer_job_ids
        processes_with_offers = len([job_id for job_id in unique_job_ids if job_id in offer_job_ids])
        total_interviews = interviews.count()

        completed = interviews.filter(status='completed').count()
        conversion_rate = self._percent(processes_with_offers, len(unique_job_ids) or 0)
        per_offer = self._safe_div(total_interviews, processes_with_offers)

        outcome_mix = {
            choice: interviews.filter(outcome=choice).count()
            for choice, _ in InterviewSchedule.OUTCOME_CHOICES
            if choice
        }
        recent_period = self.now - timezone.timedelta(days=30)
        recent_completed = interviews.filter(status='completed', scheduled_at__gte=recent_period).count()

        latest_predictions = (
            InterviewSuccessPrediction.objects.filter(candidate=self.candidate)
            .order_by('-generated_at')[:5]
        )
        readiness_signal = mean([float(p.predicted_probability or 0) for p in latest_predictions]) if latest_predictions else None

        return {
            'total_interviews': total_interviews,
            'unique_processes': len(unique_job_ids),
            'completed_interviews': completed,
            'offers_won': processes_with_offers,
            'interview_to_offer_rate': conversion_rate,
            'avg_interviews_per_offer': per_offer,
            'outcome_mix': outcome_mix,
            'recent_completed': recent_completed,
            'readiness_signal': self._decimal(readiness_signal),
            'last_activity': interviews.order_by('-scheduled_at').first().scheduled_at.isoformat(),
        }

    # --------------------------------------------------------- company patterns
    def _company_type_trends(self, interviews):
        outcome_case = self._outcome_case()
        offer_filter = Q(job__in=self._offer_job_ids)
        raw = (
            interviews.values('job__industry')
            .annotate(
                interviews=Count('id'),
                unique_processes=Count('job', distinct=True),
                offers=Count('job', filter=offer_filter, distinct=True),
                avg_outcome=Avg(outcome_case),
            )
            .order_by('-offers', '-interviews')
        )

        trends = []
        for row in raw:
            label = row['job__industry'] or 'General'
            conversion = self._percent(row['offers'], row['unique_processes'])
            trends.append({
                'company_type': label,
                'interviews': row['interviews'],
                'unique_processes': row['unique_processes'],
                'offers': row['offers'],
                'conversion_rate': conversion,
                'avg_outcome_score': self._decimal(row['avg_outcome']),
            })

        return trends

    # ---------------------------------------------------------- format metrics
    def _format_performance(self, interviews):
        outcome_case = self._outcome_case()
        offer_filter = Q(job__in=self._offer_job_ids)
        raw = (
            interviews.values('interview_type')
            .annotate(
                interviews=Count('id'),
                unique_processes=Count('job', distinct=True),
                duration=Avg('duration_minutes'),
                offers=Count('job', filter=offer_filter, distinct=True),
                avg_outcome=Avg(outcome_case),
            )
            .order_by('interview_type')
        )
        payload = []
        for row in raw:
            format_label = dict(InterviewSchedule.INTERVIEW_TYPES).get(row['interview_type'], row['interview_type'])
            conversion = self._percent(row['offers'], row['unique_processes'])
            payload.append({
                'interview_type': row['interview_type'],
                'label': format_label,
                'interviews': row['interviews'],
                'unique_processes': row['unique_processes'],
                'avg_duration': self._decimal(row['duration']),
                'offers': row['offers'],
                'conversion_rate': conversion,
                'avg_outcome_score': self._decimal(row['avg_outcome']),
            })
        payload.sort(key=lambda item: item['conversion_rate'], reverse=True)
        return payload

    # --------------------------------------------------------- preparation mix
    def _preparation_areas(self) -> Dict[str, Any]:
        qs = (
            InterviewChecklistProgress.objects
            .filter(interview__candidate=self.candidate)
            .values('category')
            .annotate(
                total_tasks=Count('id'),
                completed_tasks=Count('id', filter=Q(completed=True)),
                interviews=Count('interview', distinct=True),
                offers=Count('interview', filter=Q(interview__job__status='offer'), distinct=True),
            )
        )
        if not qs:
            return {'areas': [], 'strongest': None, 'weakest': None}

        areas = []
        for row in qs:
            label = row['category'] or 'General'
            completion_rate = self._percent(row['completed_tasks'], row['total_tasks'])
            success_rate = self._percent(row['offers'], row['interviews'])
            areas.append({
                'category': label,
                'completion_rate': completion_rate,
                'success_rate': success_rate,
                'total_tasks': row['total_tasks'],
            })

        strongest = max(areas, key=lambda item: item['success_rate']) if areas else None
        weakest = min(areas, key=lambda item: item['completion_rate']) if areas else None
        return {
            'areas': areas,
            'strongest': strongest,
            'weakest': weakest,
        }

    # ------------------------------------------------------------- practice IQ
    def _practice_impact(self, interviews):
        practice_logs = TechnicalPrepPractice.objects.filter(job__candidate=self.candidate)
        if not practice_logs.exists():
            return {
                'summary': {
                    'jobs_with_practice': 0,
                    'avg_sessions_per_job': 0,
                    'avg_score': None,
                },
                'skill_focus': {},
                'timeline_overlay': {},
            }

        per_job = {
            row['job_id']: {
                'sessions': row['sessions'],
                'avg_score': self._decimal(row['avg_score']),
            }
            for row in practice_logs.values('job_id').annotate(
                sessions=Count('id'),
                avg_score=Avg('score'),
            )
        }
        offer_job_ids = self._offer_job_ids
        with_offers = [per_job[jid]['sessions'] for jid in offer_job_ids if jid in per_job]
        without_offers = [meta['sessions'] for jid, meta in per_job.items() if jid not in offer_job_ids]

        practice_by_month = {
            row['month'].strftime('%Y-%m'): {
                'sessions': row['sessions'],
                'avg_score': self._decimal(row['avg_score']),
            }
            for row in practice_logs.annotate(month=TruncMonth('attempted_at')).values('month').annotate(
                sessions=Count('id'),
                avg_score=Avg('score'),
            )
        }

        skill_focus = {
            row['challenge_type']: row['count']
            for row in practice_logs.values('challenge_type').annotate(count=Count('id'))
        }

        session_values = [meta['sessions'] for meta in per_job.values()]
        score_values = [meta['avg_score'] for meta in per_job.values() if meta['avg_score'] is not None]

        return {
            'summary': {
                'jobs_with_practice': len(per_job),
                'avg_sessions_per_job': self._decimal(mean(session_values)) if session_values else 0,
                'avg_score': self._decimal(mean(score_values)) if score_values else None,
                'sessions_leading_to_offers': self._decimal(mean(with_offers)) if with_offers else None,
                'sessions_without_offers': self._decimal(mean(without_offers)) if without_offers else None,
            },
            'skill_focus': skill_focus,
            'timeline_overlay': practice_by_month,
        }

    # --------------------------------------------------------------- timelines
    def _timeline(self, interviews, practice_overlay: Dict[str, Any]):
        outcome_case = self._outcome_case()
        offer_filter = Q(job__in=self._offer_job_ids)
        rows = (
            interviews.annotate(month=TruncMonth('scheduled_at'))
            .values('month')
            .annotate(
                interviews=Count('id'),
                offers=Count('job', filter=offer_filter, distinct=True),
                avg_outcome=Avg(outcome_case),
            )
            .order_by('month')
        )
        timeline = []
        weighted_points = []
        for row in rows:
            month_str = row['month'].strftime('%Y-%m')
            entry = {
                'month': month_str,
                'interviews': row['interviews'],
                'offers': row['offers'],
                'avg_outcome_score': self._decimal(row['avg_outcome']),
            }
            if practice_overlay.get(month_str):
                entry['practice_sessions'] = practice_overlay[month_str]['sessions']
                entry['practice_score'] = practice_overlay[month_str]['avg_score']
            if entry['avg_outcome_score'] is not None:
                weighted_points.append((entry['avg_outcome_score'], row['interviews']))
            timeline.append(entry)

        if weighted_points:
            midpoint = max(len(weighted_points) // 2, 1)
            early = self._weighted_mean(weighted_points[:midpoint])
            late = self._weighted_mean(weighted_points[midpoint:])
            if early is not None and late is not None:
                trend = self._decimal(late - early)
            else:
                trend = None
        else:
            trend = None

        return {
            'monthly': timeline,
            'outcome_trend_delta': trend,
        }

    # -------------------------------------------------------------- benchmarks
    def _benchmarks(self, interviews, summary, practice):
        industries = list(
            interviews.exclude(job__industry__isnull=True).exclude(job__industry='').values_list('job__industry', flat=True).distinct()
        )

        global_jobs = JobEntry.objects.filter(interviews__isnull=False)
        if industries:
            global_jobs = global_jobs.filter(industry__in=industries)

        global_interview_jobs = global_jobs.distinct().count()
        global_offer_jobs = global_jobs.filter(status='offer').count()
        global_conversion = self._percent(global_offer_jobs, global_interview_jobs)

        global_interviews = InterviewSchedule.objects.filter(job__in=global_jobs).count()
        global_avg_rounds = self._safe_div(global_interviews, max(global_offer_jobs, 1))

        candidate_practice = practice['summary']
        return {
            'industry_interview_to_offer_rate': global_conversion,
            'candidate_interview_to_offer_rate': summary['interview_to_offer_rate'],
            'industry_avg_rounds_per_offer': self._decimal(global_avg_rounds),
            'candidate_avg_rounds_per_offer': summary['avg_interviews_per_offer'],
            'industry_sample_size': global_interview_jobs,
            'practice_sessions_per_offer': candidate_practice.get('sessions_leading_to_offers'),
        }

    # --------------------------------------------------------------- insights
    def _insights(self, summary, company_types, formats, preparation, practice, benchmarks):
        insights = []
        recommendations = []

        if formats:
            best_format = formats[0]
            worst_format = formats[-1]
            if best_format['conversion_rate'] and worst_format['conversion_rate'] is not None:
                insights.append({
                    'headline': f"{best_format['label']} interviews convert best",
                    'detail': f"{best_format['conversion_rate']:.1f}% of {best_format['label']} interviews led to offers.",
                })
                if worst_format['conversion_rate'] + 5 < best_format['conversion_rate']:
                    recommendations.append(
                        f"Double down on {best_format['label']} interview formats and rehearse the {worst_format['label']} format where conversion is only {worst_format['conversion_rate']:.1f}%."
                    )

        weak_area = preparation.get('weakest')
        if weak_area and weak_area['completion_rate'] < 70:
            recommendations.append(
                f"Increase completion in '{weak_area['category']}' checklist tasks ({weak_area['completion_rate']:.0f}% complete)."
            )

        if practice['summary']['sessions_leading_to_offers'] and practice['summary']['sessions_without_offers']:
            if practice['summary']['sessions_leading_to_offers'] > practice['summary']['sessions_without_offers']:
                insights.append({
                    'headline': 'Practice volume correlates with offers',
                    'detail': f"Successful processes averaged {practice['summary']['sessions_leading_to_offers']:.1f} sessions vs {practice['summary']['sessions_without_offers'] or 0:.1f} otherwise.",
                })

        if benchmarks['industry_interview_to_offer_rate']:
            diff = summary['interview_to_offer_rate'] - benchmarks['industry_interview_to_offer_rate']
            if diff < -5:
                recommendations.append(
                    f"Interview-to-offer conversion is {abs(diff):.1f} pts below similar candidates. Focus on post-interview follow-up cadence."
                )
            elif diff > 5:
                insights.append({
                    'headline': 'Above-industry conversion',
                    'detail': f"Interview-to-offer rate beats industry benchmarks by {diff:.1f} pts.",
                })

        return {
            'insights': insights,
            'recommendations': recommendations,
        }

    # -------------------------------------------------------------- ai helper
    def _ai_recommendations(self, summary, formats, preparation, benchmarks, insights):
        if not self._gemini_api_key:
            return None

        try:
            import requests
        except ImportError:  # pragma: no cover - handled in runtime environments
            logger.warning('Requests library unavailable for Gemini interview analytics.')
            return None

        payload = {
            'summary': summary,
            'formats': formats,
            'preparation': preparation,
            'benchmarks': benchmarks,
            'heuristic_insights': insights,
        }

        prompt = (
            "You are an elite interview coach. Review the JSON metrics and provide tailored advice. "
            "Respond only with JSON using this schema: {\n"
            '  "executive_summary": string,\n'
            '  "priority_actions": [string],\n'
            '  "confidence_boosters": [string]\n'
            "}\n"
            "Use concise, motivational language."
        )

        body = {
            'contents': [{
                'role': 'user',
                'parts': [{'text': f"{prompt}\nMetrics:\n{json.dumps(payload, default=str)}"}],
            }],
            'generationConfig': {'temperature': 0.55, 'maxOutputTokens': 400},
        }
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self._gemini_model}:generateContent"

        try:
            response = requests.post(
                endpoint,
                params={'key': self._gemini_api_key},
                json=body,
                timeout=20,
            )
            response.raise_for_status()
            text = response.json()['candidates'][0]['content']['parts'][0]['text'].strip()
            if text.startswith('```'):
                text = text.split('```')[1].strip()
                if text.lower().startswith('json'):
                    text = text[4:].strip()
            parsed = json.loads(text)
            return {
                'executive_summary': parsed.get('executive_summary', ''),
                'priority_actions': parsed.get('priority_actions') or [],
                'confidence_boosters': parsed.get('confidence_boosters') or [],
            }
        except Exception as exc:  # pragma: no cover - external dependency
            logger.warning('Gemini interview analytics generation failed: %s', exc)
            return None

    # --------------------------------------------------------------- utilities
    @staticmethod
    def _empty_payload():
        return {
            'summary': {
                'total_interviews': 0,
                'unique_processes': 0,
                'completed_interviews': 0,
                'offers_won': 0,
                'interview_to_offer_rate': 0,
                'avg_interviews_per_offer': None,
                'outcome_mix': {},
                'recent_completed': 0,
                'readiness_signal': None,
                'last_activity': None,
            },
            'company_type_trends': [],
            'format_performance': [],
            'preparation_areas': {'areas': [], 'strongest': None, 'weakest': None},
            'practice_impact': {
                'summary': {
                    'jobs_with_practice': 0,
                    'avg_sessions_per_job': 0,
                    'avg_score': None,
                    'sessions_leading_to_offers': None,
                    'sessions_without_offers': None,
                },
                'skill_focus': {},
                'timeline_overlay': {},
            },
            'timeline': {'monthly': [], 'outcome_trend_delta': None},
            'benchmarks': {
                'industry_interview_to_offer_rate': None,
                'candidate_interview_to_offer_rate': None,
                'industry_avg_rounds_per_offer': None,
                'candidate_avg_rounds_per_offer': None,
                'industry_sample_size': 0,
                'practice_sessions_per_offer': None,
            },
            'insights': {'insights': [], 'recommendations': []},
            'ai_recommendations': None,
            'generated_at': timezone.now().isoformat(),
        }

    def _outcome_case(self):
        whens = [
            When(outcome=key, then=Value(val))
            for key, val in self.OUTCOME_SCORES.items()
        ]
        return Case(*whens, default=Value(0.5), output_field=models.FloatField())

    @staticmethod
    def _percent(numerator, denominator):
        if not denominator:
            return 0.0
        return round((numerator / denominator) * 100, 2)

    @staticmethod
    def _decimal(value):
        if value is None:
            return None
        try:
            return round(float(value), 2)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _safe_div(numerator, denominator):
        if not denominator:
            return None
        return round(numerator / denominator, 2)

    @staticmethod
    def _weighted_mean(points):
        """
        points: iterable of (value, weight)
        """
        total_weight = sum(weight for _, weight in points if weight)
        if not total_weight:
            return None
        weighted_sum = sum(value * weight for value, weight in points if weight)
        return weighted_sum / total_weight

    def _get_offer_job_ids(self):
        current = set(
            JobEntry.objects.filter(candidate=self.candidate, status='offer').values_list('id', flat=True)
        )
        historical = set(
            JobStatusChange.objects.filter(
                job__candidate=self.candidate,
                new_status='offer'
            ).values_list('job_id', flat=True)
        )
        return current.union(historical)


__all__ = ['InterviewPerformanceAnalyticsService']
