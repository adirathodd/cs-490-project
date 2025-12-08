"""Utilities for UC-085 Interview Success Probability Scoring."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from core.api_monitoring import track_api_call, get_or_create_service, SERVICE_GEMINI
from typing import Any, Dict, Iterable, List, Optional

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone

from core.models import (
    CandidateProfile,
    InterviewChecklistProgress,
    PreparationChecklistProgress,
    InterviewPreparationTask,
    InterviewSchedule,
    InterviewSuccessPrediction,
    JobEntry,
    JobMatchAnalysis,
    JobQuestionPractice,
    TechnicalPrepPractice,
)
from core.interview_checklist import build_checklist_tasks


logger = logging.getLogger(__name__)


def _decimal(value: float, places: int = 2) -> float:
    """Round helpers that keep consistent floats for API responses."""
    quant = Decimal(value).quantize(Decimal('1.' + '0' * places), rounding=ROUND_HALF_UP)
    return float(quant)


@dataclass
class PreparationStats:
    completed: int
    total: int

    @property
    def score(self) -> float:
        if self.total == 0:
            return 0.4  # optimistic default when no tasks have been generated
        return self.completed / max(self.total, 1)


class InterviewSuccessScorer:
    """Aggregate data points that influence interview success."""

    COMPANY_RESEARCH_TASK_IDS = {
        'research_mission',
        'research_news',
        'research_competitors',
        'research_products',
    }
    PRACTICE_TARGET_HOURS = 5
    TECHNICAL_TARGET_HOURS = 3
    OUTCOME_TO_SCORE = {
        'excellent': 1.0,
        'good': 0.85,
        'average': 0.55,
        'poor': 0.2,
        'rejected': 0.0,
        'withdrew': 0.15,
    }

    def __init__(self, candidate: CandidateProfile):
        self.candidate = candidate
        self._historical_stats = None

    def score_interview(self, interview: InterviewSchedule) -> Dict[str, Any]:
        prep_stats = self._get_preparation_stats(interview)
        match_score, match_source = self._get_match_score(interview)
        research_completion = self._get_research_completion(interview)
        practice_hours, technical_hours = self._get_practice_metrics(interview.job)
        historical_stats = self._get_historical_performance(interview)

        prep_score = prep_stats.score
        match_ratio = match_score / 100
        research_ratio = research_completion
        practice_ratio = min(practice_hours / self.PRACTICE_TARGET_HOURS, 1.0) if practice_hours else 0.0
        technical_ratio = (
            min(technical_hours / self.TECHNICAL_TARGET_HOURS, 1.0)
            if technical_hours else 0.0
        )
        
        if technical_hours > 0:
            combined_practice_ratio = min((practice_ratio * 0.4) + (technical_ratio * 0.6), 1.0)
        else:
            combined_practice_ratio = practice_ratio

        history_ratio = historical_stats['score']

        weighted_score = (
            (prep_score * 0.25)
            + (match_ratio * 0.30)
            + (research_ratio * 0.10)
            + (combined_practice_ratio * 0.25)
            + (history_ratio * 0.10)
        )
        weighted_score = max(0.05, min(weighted_score, 0.97))
        probability = _decimal(weighted_score * 100, 1)

        confidence = self._calculate_confidence(
            prep_stats,
            bool(match_source == 'analysis'),
            research_completion > 0,
            practice_hours,
            historical_stats['samples'],
        )

        recommendations = self._build_recommendations(
            prep_stats,
            research_completion,
            practice_hours,
            match_score,
            historical_stats,
        )
        action_items = self._build_action_items(prep_stats, research_completion, practice_hours)

        payload = {
            'probability': probability,
            'confidence': confidence,
            'confidence_label': self._confidence_label(confidence),
            'generated_at': timezone.now().isoformat(),
            'preparation': {
                'completed': prep_stats.completed,
                'total': prep_stats.total,
                'remaining': max(prep_stats.total - prep_stats.completed, 0),
                'score': _decimal(prep_score * 100),
            },
            'match': {
                'score': _decimal(match_score),
                'source': match_source,
            },
            'research': {
                'score': _decimal(research_completion * 100),
                'completed': int(research_completion * len(self.COMPANY_RESEARCH_TASK_IDS)),
                'total': len(self.COMPANY_RESEARCH_TASK_IDS),
            },
            'practice': {
                'hours': _decimal(practice_hours, 2),
                'technical_hours': _decimal(technical_hours, 2),
                'score': _decimal(combined_practice_ratio * 100),
                'target_hours': self.PRACTICE_TARGET_HOURS,
                'technical_target_hours': self.TECHNICAL_TARGET_HOURS,
            },
            'historical': {
                'score': _decimal(history_ratio * 100),
                'samples': historical_stats['samples'],
                'recent_outcomes': historical_stats['recent'],
            },
            'recommendations': recommendations,
            'action_items': action_items,
            'factors': {
                'preparation_ratio': _decimal(prep_score, 3),
                'match_ratio': _decimal(match_ratio, 3),
                'research_ratio': _decimal(research_ratio, 3),
                'practice_ratio': _decimal(combined_practice_ratio, 3),
                'historical_ratio': _decimal(history_ratio, 3),
            },
        }
        return payload

    def _get_preparation_stats(self, interview: InterviewSchedule) -> PreparationStats:
        progress_entries = list(InterviewChecklistProgress.objects.filter(interview=interview))
        job_progress_entries = list(PreparationChecklistProgress.objects.filter(job=interview.job))
        if job_progress_entries:
            completed = sum(1 for entry in job_progress_entries if entry.completed)
            total = len(job_progress_entries)
            return PreparationStats(completed=completed, total=total)
        try:
            # Disable AI generation during scoring to prevent API latency
            checklist_tasks = build_checklist_tasks(interview, include_ai=False)
        except Exception:
            checklist_tasks = []

        if checklist_tasks:
            existing_ids = {task['task_id'] for task in checklist_tasks}
            progress_map = {}
            stale_ids = []
            for entry in progress_entries:
                if entry.task_id in existing_ids:
                    progress_map[entry.task_id] = entry
                else:
                    stale_ids.append(entry.id)
            if stale_ids:
                InterviewChecklistProgress.objects.filter(id__in=stale_ids).delete()
            
            # Merge job-level progress if not already in interview progress
            if job_progress_entries:
                for entry in job_progress_entries:
                    if entry.task_id in existing_ids and entry.task_id not in progress_map:
                        progress_map[entry.task_id] = entry

            completed = sum(
                1
                for task in checklist_tasks
                if progress_map.get(task['task_id']) and progress_map[task['task_id']].completed
            )
            return PreparationStats(completed=completed, total=len(checklist_tasks))

        tasks = list(interview.preparation_tasks.all())
        completed = sum(1 for task in tasks if task.is_completed)
        return PreparationStats(completed=completed, total=len(tasks))

    def _get_match_score(self, interview: InterviewSchedule) -> tuple[float, str]:
        analysis = JobMatchAnalysis.objects.filter(
            job=interview.job,
            candidate=self.candidate,
            is_valid=True,
        ).order_by('-generated_at').first()
        if not analysis:
            analysis = JobMatchAnalysis.objects.filter(
                job=interview.job,
                candidate=self.candidate,
            ).order_by('-generated_at').first()
            if analysis:
                return float(analysis.overall_score), 'cached'
        else:
            return float(analysis.overall_score), 'analysis'

        fallback = 65.0
        if interview.job.status == 'interview':
            fallback = 75.0
        elif interview.job.status == 'phone_screen':
            fallback = 70.0
        return fallback, 'heuristic'

    def _get_research_completion(self, interview: InterviewSchedule) -> float:
        interview_progress = InterviewChecklistProgress.objects.filter(
            interview=interview,
            task_id__in=self.COMPANY_RESEARCH_TASK_IDS,
            completed=True
        ).values_list('task_id', flat=True)
        
        job_progress = PreparationChecklistProgress.objects.filter(
            job=interview.job,
            task_id__in=self.COMPANY_RESEARCH_TASK_IDS,
            completed=True
        ).values_list('task_id', flat=True)
        
        completed_ids = set(interview_progress) | set(job_progress)
        return len(completed_ids) / len(self.COMPANY_RESEARCH_TASK_IDS)

    def _get_practice_metrics(self, job: JobEntry) -> tuple[float, float]:
        question_practice = job.question_practice_logs.aggregate(total=Sum('total_duration_seconds'))
        technical_practice = job.technical_prep_practice.aggregate(total=Sum('duration_seconds'))
        technical_seconds = technical_practice.get('total') or 0
        total_seconds = (question_practice.get('total') or 0) + technical_seconds
        if not total_seconds:
            return 0.0, 0.0
        total_hours = total_seconds / 3600
        technical_hours = technical_seconds / 3600
        return total_hours, technical_hours

    def _get_historical_performance(self, interview: InterviewSchedule) -> Dict[str, Any]:
        if self._historical_stats is not None:
            return self._historical_stats

        history = InterviewSchedule.objects.filter(
            candidate=self.candidate,
            status='completed',
        ).exclude(outcome='')
        samples = history.count()
        if samples == 0:
            self._historical_stats = {'score': 0.55, 'samples': 0, 'recent': []}
            return self._historical_stats

        values = []
        recent = []
        for instance in history.order_by('-updated_at')[:5]:
            score = self.OUTCOME_TO_SCORE.get(instance.outcome, 0.5)
            values.append(score)
            recent.append({
                'outcome': instance.outcome,
                'job_title': instance.job.title if instance.job_id else '',
                'company': instance.job.company_name if instance.job_id else '',
                'recorded_at': instance.updated_at.isoformat() if instance.updated_at else None,
            })

        avg = sum(values) / len(values)
        self._historical_stats = {'score': avg, 'samples': samples, 'recent': recent}
        return self._historical_stats

    def _calculate_confidence(
        self,
        prep_stats: PreparationStats,
        has_analysis: bool,
        has_research: bool,
        practice_hours: float,
        history_samples: int,
    ) -> float:
        confidence = 0.35
        if prep_stats.total:
            confidence += 0.2
        if has_analysis:
            confidence += 0.15
        if has_research:
            confidence += 0.1
        if practice_hours >= 1:
            confidence += 0.1
        if history_samples >= 5:
            confidence += 0.15
        elif history_samples > 0:
            confidence += 0.08
        return min(_decimal(confidence, 2), 0.95)

    def _confidence_label(self, confidence: float) -> str:
        if confidence >= 0.75:
            return 'high'
        if confidence >= 0.55:
            return 'moderate'
        return 'developing'

    def _build_recommendations(
        self,
        prep_stats: PreparationStats,
        research_completion: float,
        practice_hours: float,
        match_score: float,
        history: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        recs: List[Dict[str, Any]] = []

        if prep_stats.total and prep_stats.score < 0.75:
            remaining = prep_stats.total - prep_stats.completed
            recs.append({
                'title': 'Finish preparation checklist',
                'detail': f'{remaining} prep task(s) remaining. Finishing them increases readiness by ~15%.',
                'category': 'Preparation',
                'impact': 'high',
            })

        if research_completion < 0.75:
            recs.append({
                'title': 'Deepen company research',
                'detail': 'Validate mission, products, and competitor notes to boost contextual confidence.',
                'category': 'Research',
                'impact': 'medium',
            })

        if practice_hours < 3:
            recs.append({
                'title': 'Log focused practice hours',
                'detail': 'Aim for at least 3 hours of mock responses or technical reps before interview day.',
                'category': 'Practice',
                'impact': 'medium',
            })

        if match_score < 70:
            recs.append({
                'title': 'Revisit match gaps',
                'detail': 'Review the job match analysis to highlight 1-2 differentiators for this role.',
                'category': 'Role Fit',
                'impact': 'medium',
            })

        if history['samples'] >= 3 and history['score'] < 0.6:
            recs.append({
                'title': 'Review prior interview feedback',
                'detail': 'Identify patterns from recent interviews to avoid repeated pitfalls.',
                'category': 'Reflection',
                'impact': 'medium',
            })

        return recs[:4]

    def _build_action_items(
        self,
        prep_stats: PreparationStats,
        research_completion: float,
        practice_hours: float,
    ) -> List[Dict[str, Any]]:
        actions: List[Dict[str, Any]] = []
        if prep_stats.total and prep_stats.score < 0.9:
            actions.append({
                'title': 'Complete prep tasks',
                'priority': 'high',
                'detail': 'Check off the remaining preparation tasks inside your interview workspace.',
                'target_completion': 'Today',
            })
        if research_completion < 1.0:
            actions.append({
                'title': 'Verify research notes',
                'priority': 'medium',
                'detail': 'Capture mission, recent news, and competitor talking points.',
                'target_completion': 'Tomorrow',
            })
        if practice_hours < self.PRACTICE_TARGET_HOURS:
            actions.append({
                'title': 'Schedule practice reps',
                'priority': 'medium',
                'detail': 'Block a 45-minute session for mock responses or coding drills.',
                'target_completion': 'Before interview',
            })
        return actions[:3]

    @classmethod
    def normalized_outcome(cls, outcome: str) -> float:
        return cls.OUTCOME_TO_SCORE.get(outcome or '', 0.5)


class InterviewSuccessForecastService:
    """Generate and persist interview forecasts for a candidate."""

    STALE_HOURS = 6

    def __init__(self, candidate: CandidateProfile):
        self.candidate = candidate
        self.scorer = InterviewSuccessScorer(candidate)
        self._gemini_api_key = getattr(settings, 'GEMINI_API_KEY', '')
        self._gemini_model = getattr(settings, 'GEMINI_MODEL', 'gemini-1.5-flash-latest')

    def generate(
        self,
        interviews: Iterable[InterviewSchedule],
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        entries: List[Dict[str, Any]] = []

        for interview in interviews:
            payload, cached = self._get_or_build_payload(interview, force_refresh)
            entry = {
                **payload,
                'interview_id': interview.id,
                'job_id': interview.job_id,
                'job_title': interview.job.title,
                'company': interview.job.company_name,
                'interview_type': interview.interview_type,
                'scheduled_at': interview.scheduled_at.isoformat(),
                'cached': cached,
            }
            entry['trend'] = self._build_trend(interview, entry['probability'])
            entries.append(entry)

        entries.sort(key=lambda row: row['probability'], reverse=True)
        for idx, entry in enumerate(entries, start=1):
            entry['rank'] = idx

        summary = self._build_summary(entries)
        accuracy = self._build_accuracy()

        return {
            'interviews': entries,
            'summary': summary,
            'accuracy': accuracy,
        }

    def _match_analysis_updated_after(self, interview: InterviewSchedule, generated_at: Optional[timezone.datetime]) -> bool:
        if not generated_at:
            return False
        latest_analysis = (
            JobMatchAnalysis.objects.filter(job=interview.job, candidate=self.candidate)
            .order_by('-updated_at')
            .values_list('updated_at', flat=True)
            .first()
        )
        return bool(latest_analysis and latest_analysis > generated_at)

    def _get_or_build_payload(self, interview: InterviewSchedule, force_refresh: bool) -> tuple[Dict[str, Any], bool]:
        latest = interview.success_predictions.filter(is_latest=True).first()
        refresh_needed = force_refresh
        if latest and not refresh_needed:
            if self._match_analysis_updated_after(interview, latest.generated_at):
                refresh_needed = True
        if latest and not refresh_needed and not self._is_stale(latest):
            payload = latest.payload or {}
            if payload:
                return payload, True

        computed = self.scorer.score_interview(interview)
        ai_insights = self._generate_ai_insights(interview, computed)
        if ai_insights:
            computed['ai_insights'] = ai_insights
        self._save_prediction(interview, computed)
        return computed, False

    def _is_stale(self, prediction: InterviewSuccessPrediction) -> bool:
        delta = timezone.now() - prediction.generated_at
        return delta.total_seconds() > self.STALE_HOURS * 3600

    def _save_prediction(self, interview: InterviewSchedule, payload: Dict[str, Any]) -> InterviewSuccessPrediction:
        previous = interview.success_predictions.filter(is_latest=True)
        previous.update(is_latest=False)
        return InterviewSuccessPrediction.objects.create(
            interview=interview,
            job=interview.job,
            candidate=self.candidate,
            predicted_probability=payload['probability'],
            confidence_score=payload['confidence'],
            preparation_score=payload['preparation']['score'] / 100,
            match_score=payload['match']['score'],
            research_completion=payload['research']['score'] / 100,
            practice_hours=payload['practice']['hours'],
            historical_adjustment=payload['historical']['score'] / 100,
            payload=payload,
        )

    def _build_trend(self, interview: InterviewSchedule, latest_probability: float) -> Dict[str, Any]:
        previous = interview.success_predictions.filter(is_latest=False).order_by('-generated_at').first()
        if not previous:
            return {'change': 0.0, 'direction': 'steady'}
        delta = _decimal(latest_probability - float(previous.predicted_probability), 1)
        direction = 'up' if delta > 0 else 'down' if delta < 0 else 'steady'
        return {'change': delta, 'direction': direction}

    def _build_summary(self, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not entries:
            return {
                'total_upcoming': 0,
                'average_probability': 0,
                'confidence_snapshot': 'n/a',
                'comparison': [],
                'priority_actions': [],
            }

        average = _decimal(sum(e['probability'] for e in entries) / len(entries), 1)
        confidence_levels = [e['confidence'] for e in entries]
        summary = {
            'total_upcoming': len(entries),
            'average_probability': average,
            'highest_probability': entries[0]['probability'],
            'lowest_probability': entries[-1]['probability'],
            'confidence_snapshot': self.scorer._confidence_label(sum(confidence_levels) / len(confidence_levels)),
            'comparison': [
                {
                    'interview_id': e['interview_id'],
                    'job_title': e['job_title'],
                    'company': e['company'],
                    'probability': e['probability'],
                    'scheduled_at': e['scheduled_at'],
                }
                for e in entries
            ],
            'priority_actions': self._collect_priority_actions(entries),
        }
        return summary

    def _collect_priority_actions(self, entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        actions: List[Dict[str, Any]] = []
        for entry in entries:
            for action in entry.get('action_items', []):
                enriched = action.copy()
                enriched['job_title'] = entry['job_title']
                enriched['company'] = entry['company']
                actions.append(enriched)
        actions.sort(key=lambda a: {'high': 0, 'medium': 1, 'low': 2}.get(a.get('priority', 'medium'), 1))
        return actions[:5]

    def _build_accuracy(self) -> Dict[str, Any]:
        predictions = InterviewSuccessPrediction.objects.filter(
            candidate=self.candidate,
            accuracy__isnull=False,
        ).order_by('-evaluated_at')
        count = predictions.count()
        if not count:
            return {
                'tracked_predictions': 0,
                'mean_absolute_error': None,
                'recent_results': [],
            }
        mae = sum(float(p.accuracy or 0) for p in predictions) / count
        recent = [
            {
                'interview_id': pred.interview_id,
                'job_title': pred.job.title if pred.job_id else '',
                'company': pred.job.company_name if pred.job_id else '',
                'predicted': float(pred.predicted_probability),
                'actual_outcome': pred.actual_outcome,
                'recorded_at': pred.evaluated_at.isoformat() if pred.evaluated_at else None,
                'error': float(pred.accuracy or 0),
            }
            for pred in predictions[:5]
        ]
        return {
            'tracked_predictions': count,
            'mean_absolute_error': _decimal(mae, 3),
            'recent_results': recent,
        }

    def _generate_ai_insights(self, interview: InterviewSchedule, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not self._gemini_api_key:
            return None

        try:
            import requests
        except ImportError:  # pragma: no cover - requests included in env, but guard anyway
            logger.warning('Requests library unavailable for Gemini insights.')
            return None

        context = {
            'job_title': interview.job.title,
            'company': interview.job.company_name,
            'probability': payload['probability'],
            'confidence': payload['confidence_label'],
            'factors': payload['factors'],
            'preparation': payload['preparation'],
            'match': payload['match'],
            'research': payload['research'],
            'practice': payload['practice'],
            'historical': payload['historical'],
            'recommendations': payload.get('recommendations', []),
            'action_items': payload.get('action_items', []),
        }

        prompt = (
            "You are an expert interview coach. Analyze the candidate's readiness metrics and create an "
            "encouraging briefing. Respond with STRICT JSON using this schema: {\n"
            "  \"summary\": string,\n"
            "  \"focus_points\": [string],\n"
            "  \"risk_alerts\": [string],\n"
            "  \"confidence_context\": string\n"
            "}. Provide at most 3 focus points and 2 risk alerts. Keep sentences concise and action-oriented.\n"
            f"Metrics JSON:\n{json.dumps(context, ensure_ascii=False)}"
        )

        endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{self._gemini_model}:generateContent"
        )
        payload_body = {
            'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
            'generationConfig': {
                'temperature': 0.6,
                'topP': 0.9,
                'topK': 40,
                'maxOutputTokens': 512,
            },
        }

        try:
            service = get_or_create_service(SERVICE_GEMINI, 'Google Gemini AI')
            with track_api_call(service, endpoint=f'/models/{self._gemini_model}:generateContent', method='POST'):
                response = requests.post(
                    endpoint,
                    params={'key': self._gemini_api_key},
                    json=payload_body,
                    timeout=20,
                )
                response.raise_for_status()
            result = response.json()
            text = result['candidates'][0]['content']['parts'][0]['text'].strip()
            if text.startswith('```'):
                segments = text.split('```')
                if len(segments) >= 2:
                    text = segments[1]
                    if text.lower().startswith('json'):
                        text = text[4:]
                text = text.strip()
            ai_payload = json.loads(text)
            return {
                'summary': ai_payload.get('summary') or '',
                'focus_points': ai_payload.get('focus_points') or [],
                'risk_alerts': ai_payload.get('risk_alerts') or [],
                'confidence_context': ai_payload.get('confidence_context') or '',
            }
        except Exception as exc:  # pragma: no cover - external service
            logger.warning('Gemini insights generation failed: %s', exc)
            return None


__all__ = ['InterviewSuccessScorer', 'InterviewSuccessForecastService']
