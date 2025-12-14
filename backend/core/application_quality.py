"""
Application quality scoring utilities.

Generates AI-style quality scores for application packages (resume, cover letter,
LinkedIn) against a specific job so users can spot weak applications before
submitting. The scorer is intentionally deterministic and offline so it can run
on-demand without external API calls.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Dict, List, Tuple

from django.db.models import Avg, Max
from django.utils import timezone

from core.skills_gap_analysis import SkillsGapAnalyzer
from core.models import (
    ApplicationQualityReview,
    CandidateProfile,
    CandidateSkill,
    Document,
    JobEntry,
    Project,
    WorkExperience,
)

logger = logging.getLogger(__name__)


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    """Clamp a numeric value into a range."""
    try:
        return max(minimum, min(maximum, float(value)))
    except Exception:
        return minimum


class ApplicationQualityScorer:
    """Lightweight scorer that evaluates application quality for a job."""

    DEFAULT_THRESHOLD = 70

    def __init__(
        self,
        job: JobEntry,
        candidate: CandidateProfile,
        resume_doc: Document | None = None,
        cover_letter_doc: Document | None = None,
        linkedin_url: str | None = None,
        threshold: int | None = None,
    ):
        self.job = job
        self.candidate = candidate
        self.resume_doc = resume_doc or getattr(job, 'resume_doc', None) or candidate.default_resume_doc
        self.cover_letter_doc = cover_letter_doc or getattr(job, 'cover_letter_doc', None) or candidate.default_cover_letter_doc
        self.linkedin_url = linkedin_url or candidate.linkedin_url or ''
        self.threshold = threshold or self.DEFAULT_THRESHOLD

    def evaluate(self) -> Dict[str, Any]:
        """Run the scoring algorithm and return an analysis dict."""
        try:
            skills_gap = SkillsGapAnalyzer.analyze_job(
                job=self.job,
                candidate_profile=self.candidate,
                include_similar_trends=False,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Skills gap analysis failed for job %s: %s", self.job.id, exc)
            skills_gap = {'skills': [], 'summary': {}}

        snapshot = self._build_candidate_snapshot()

        alignment_score = self._score_alignment(skills_gap.get('skills', []))
        keyword_score, missing_keywords = self._evaluate_keywords(snapshot['combined_text'])
        formatting_score, formatting_issues = self._evaluate_formatting(snapshot['combined_text'])
        consistency_score = self._evaluate_consistency(snapshot)

        # Weighted overall score
        overall_score = _clamp(
            (alignment_score * 0.4)
            + (keyword_score * 0.25)
            + (formatting_score * 0.2)
            + (consistency_score * 0.15)
        )

        missing_skills = [
            skill.get('name')
            for skill in skills_gap.get('skills', [])
            if (skill.get('gap_severity', 0) > 60 or not skill.get('candidate_level'))
        ][:8]

        suggestions = self._build_suggestions(
            overall_score=overall_score,
            missing_keywords=missing_keywords,
            missing_skills=missing_skills,
            formatting_issues=formatting_issues,
        )

        return {
            'score': round(overall_score, 2),
            'alignment_score': round(alignment_score, 2),
            'keyword_score': round(keyword_score, 2),
            'consistency_score': round(consistency_score, 2),
            'formatting_score': round(formatting_score, 2),
            'missing_keywords': missing_keywords,
            'missing_skills': missing_skills,
            'formatting_issues': formatting_issues,
            'suggestions': suggestions,
            'threshold': self.threshold,
            'meets_threshold': overall_score >= self.threshold,
        }

    def persist(self) -> Tuple[ApplicationQualityReview, Dict[str, Any]]:
        """
        Evaluate, store the review, and return (review, analysis dict).
        """
        analysis = self.evaluate()
        previous = ApplicationQualityReview.objects.filter(
            candidate=self.candidate,
            job=self.job
        ).order_by('-created_at', '-id').first()

        score_delta = None
        if previous:
            score_delta = round(analysis['score'] - float(previous.overall_score), 2)

        review = ApplicationQualityReview.objects.create(
            candidate=self.candidate,
            job=self.job,
            resume_doc=self.resume_doc,
            cover_letter_doc=self.cover_letter_doc,
            linkedin_url=self.linkedin_url,
            overall_score=analysis['score'],
            alignment_score=analysis['alignment_score'],
            keyword_score=analysis['keyword_score'],
            consistency_score=analysis['consistency_score'],
            formatting_score=analysis['formatting_score'],
            missing_keywords=analysis['missing_keywords'],
            missing_skills=analysis['missing_skills'],
            formatting_issues=analysis['formatting_issues'],
            improvement_suggestions=analysis['suggestions'],
            threshold=analysis['threshold'],
            meets_threshold=analysis['meets_threshold'],
            score_delta=score_delta,
        )

        comparison = self._build_comparison_snapshot(current_score=analysis['score'])
        review.comparison_snapshot = comparison
        review.save(update_fields=['comparison_snapshot'])

        analysis.update({
            'review_id': review.id,
            'score_delta': score_delta,
            'comparison': comparison,
            'created_at': review.created_at,
        })

        return review, analysis

    def _build_candidate_snapshot(self) -> Dict[str, Any]:
        """Aggregate candidate info into a single snapshot for keyword matching."""
        skill_records = CandidateSkill.objects.filter(candidate=self.candidate).select_related('skill')
        skill_names = [cs.skill.name for cs in skill_records if cs.skill]

        experiences = WorkExperience.objects.filter(candidate=self.candidate)
        projects = Project.objects.filter(candidate=self.candidate)

        text_parts: List[str] = [
            self.candidate.headline or '',
            self.candidate.summary or '',
            self.candidate.industry or '',
        ]
        text_parts.extend(skill_names)

        for exp in experiences:
            text_parts.extend([
                exp.job_title or '',
                exp.company_name or '',
                exp.description or '',
            ])
            text_parts.extend(exp.achievements or [])

        for project in projects:
            text_parts.extend([
                project.name or '',
                project.description or '',
                project.outcomes or '',
            ])

        combined_text = ' '.join([part for part in text_parts if part]).lower()

        return {
            'combined_text': combined_text,
            'skill_count': len(skill_names),
            'experience_count': experiences.count(),
        }

    def _score_alignment(self, skills: List[Dict[str, Any]]) -> float:
        if not skills:
            return 60.0  # Neutral default when we lack structure

        total = len(skills)
        matched = len([s for s in skills if s.get('candidate_level')])
        severe_gaps = len([s for s in skills if s.get('gap_severity', 0) > 70])

        base = (matched / total) * 100
        penalty = severe_gaps * 3  # penalize hard gaps a bit
        return _clamp(base - penalty)

    def _evaluate_keywords(self, candidate_text: str) -> Tuple[float, List[str]]:
        job_text = ' '.join(
            filter(
                None,
                [
                    getattr(self.job, 'title', ''),
                    getattr(self.job, 'description', ''),
                    getattr(self.job, 'industry', ''),
                    getattr(self.job, 'location', ''),
                ],
            )
        ).lower()

        extracted_keywords = []
        try:
            extracted_keywords = SkillsGapAnalyzer._extract_skill_keywords(job_text)  # type: ignore[attr-defined]
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("Keyword extraction failed for job %s: %s", self.job.id, exc)

        # De-duplicate and normalize
        keyword_list = []
        seen = set()
        for kw in extracted_keywords:
            kw_norm = (kw or '').strip().lower()
            if kw_norm and kw_norm not in seen:
                seen.add(kw_norm)
                keyword_list.append(kw_norm)

        if not keyword_list:
            return 72.0, []

        missing_keywords = [kw for kw in keyword_list if kw not in candidate_text]
        coverage_ratio = 1 - (len(missing_keywords) / len(keyword_list))
        keyword_score = _clamp(coverage_ratio * 100)

        return keyword_score, missing_keywords

    def _evaluate_formatting(self, candidate_text: str = '') -> Tuple[float, List[str]]:
        score = 100.0
        issues: List[str] = []
        now = timezone.now()
        lower_text = (candidate_text or '').lower()

        if not self.resume_doc:
            score -= 30
            issues.append("Attach a tailored resume to this job.")
        else:
            uploaded_at = getattr(self.resume_doc, 'created_at', None)
            if uploaded_at and (now - uploaded_at) > timedelta(days=180):
                score -= 8
                issues.append("Resume version looks older than 6 months.")

        if not self.cover_letter_doc:
            score -= 20
            issues.append("Add a cover letter linked to this job.")
        else:
            uploaded_at = getattr(self.cover_letter_doc, 'created_at', None)
            if uploaded_at and (now - uploaded_at) > timedelta(days=180):
                score -= 5
                issues.append("Cover letter version looks stale.")

        if not self.linkedin_url:
            score -= 10
            issues.append("Link your LinkedIn profile so recruiters can verify your background.")

        if getattr(self.job, 'resume_customized', False) is False and self.resume_doc:
            score -= 5
            issues.append("Mark the resume as customized for this job once tailored.")

        if getattr(self.job, 'cover_letter_customized', False) is False and self.cover_letter_doc:
            score -= 5
            issues.append("Mark the cover letter as customized for this job once tailored.")

        # Quick hygiene checks for obvious typos/placeholders in supplied text
        if lower_text:
            placeholder_hits = ['lorem ipsum', 'insert role', 'your name', 'company name']
            if any(token in lower_text for token in placeholder_hits):
                score -= 6
                issues.append("Remove placeholder text (e.g., 'Lorem ipsum' or 'Your Name').")

            typo_markers = [' teh ', ' adn ', 'manger ', ' acheive', 'repsonsible', ' enviroment ']
            if any(marker in lower_text for marker in typo_markers):
                score -= 4
                issues.append("Fix obvious typos in your resume or cover letter.")

        return _clamp(score), issues

    def _evaluate_consistency(self, snapshot: Dict[str, Any]) -> float:
        score = 70.0

        if self.resume_doc and self.cover_letter_doc:
            score += 10
        if self.linkedin_url:
            score += 5
        if snapshot.get('skill_count', 0) >= 8:
            score += 5
        if snapshot.get('experience_count', 0) >= 3:
            score += 5

        return _clamp(score)

    def _build_suggestions(
        self,
        overall_score: float,
        missing_keywords: List[str],
        missing_skills: List[str],
        formatting_issues: List[str],
    ) -> List[Dict[str, Any]]:
        suggestions: List[Dict[str, Any]] = []

        if missing_skills:
            suggestions.append({
                'title': 'Cover missing skills with proof',
                'detail': f"Add bullets or projects that show: {', '.join(missing_skills[:5])}.",
                'priority': 'high',
                'area': 'skills',
            })

        if missing_keywords:
            suggestions.append({
                'title': 'Improve keyword coverage',
                'detail': f"Weave these keywords into your resume/cover letter: {', '.join(missing_keywords[:8])}.",
                'priority': 'high',
                'area': 'keywords',
            })

        for issue in formatting_issues[:4]:
            suggestions.append({
                'title': 'Fix formatting readiness',
                'detail': issue,
                'priority': 'medium',
                'area': 'formatting',
            })

        if overall_score < self.threshold:
            suggestions.append({
                'title': 'Reach the submission threshold',
                'detail': f"Focus on the top two suggestions to push the score above {self.threshold}.",
                'priority': 'high',
                'area': 'readiness',
            })

        if not self.linkedin_url:
            suggestions.append({
                'title': 'Add LinkedIn link',
                'detail': 'Include a LinkedIn URL for quick credibility checks.',
                'priority': 'medium',
                'area': 'consistency',
            })

        return suggestions

    def _build_comparison_snapshot(self, current_score: float) -> Dict[str, Any]:
        qs = ApplicationQualityReview.objects.filter(candidate=self.candidate)
        aggregates = qs.aggregate(
            avg_score=Avg('overall_score'),
            top_score=Max('overall_score'),
        )

        avg_score = aggregates.get('avg_score')
        top_score = aggregates.get('top_score')

        average = float(avg_score) if avg_score is not None else current_score
        top = float(top_score) if top_score is not None else current_score

        return {
            'average_score': round(average, 2) if average is not None else None,
            'top_score': round(top, 2) if top is not None else None,
            'delta_from_average': round(current_score - average, 2) if average is not None else None,
            'total_reviews': qs.count(),
        }


def build_quality_history(candidate: CandidateProfile, job: JobEntry, limit: int = 8) -> List[Dict[str, Any]]:
    """Return a lightweight history payload for a job's quality reviews."""
    history = []
    for entry in ApplicationQualityReview.objects.filter(candidate=candidate, job=job).order_by('-created_at', '-id')[:limit]:
        history.append({
            'id': entry.id,
            'score': float(entry.overall_score),
            'created_at': entry.created_at.isoformat(),
            'score_delta': float(entry.score_delta) if entry.score_delta is not None else None,
        })
    return history
