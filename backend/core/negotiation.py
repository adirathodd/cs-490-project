"""Salary negotiation planning utilities for UC-083."""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from core.models import (
    Achievement,
    CandidateProfile,
    JobEntry,
    SalaryNegotiationOutcome,
    SalaryResearch,
)
from core.salary_scraper import salary_aggregator


def _format_currency(value: Optional[Decimal | int | float]) -> str:
    if value in (None, "", "null"):
        return "N/A"
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return "N/A"
    return f"${numeric:,.0f}"


def _safe_number(value: Optional[Decimal | int | float]) -> Optional[float]:
    if value in (None, "", "null"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class SalaryNegotiationPlanner:
    """Generate structured guidance for salary negotiations."""

    def __init__(
        self,
        profile: CandidateProfile,
        job: JobEntry,
        salary_research: Optional[SalaryResearch] = None,
        offer_details: Optional[Dict[str, Any]] = None,
        outcomes: Optional[List[SalaryNegotiationOutcome]] = None,
    ) -> None:
        self.profile = profile
        self.job = job
        self.salary_research = salary_research
        self.offer_details = offer_details or {}
        self.outcomes = outcomes or []

    def build_plan(self) -> Dict[str, Any]:
        research = self._ensure_research()
        stats = self._derive_stats(research)

        talking_points = self._build_talking_points(stats)
        total_comp = self._build_total_comp_framework(stats)
        scripts = self._build_scenario_scripts(stats)
        timing = self._build_timing_strategy()
        templates = self._build_counter_templates(stats)
        exercises = self._build_confidence_exercises()
        offer_guidance = self._build_offer_guidance(stats)

        return {
            'market_context': self._build_market_context(stats, research),
            'talking_points': talking_points,
            'total_comp_framework': total_comp,
            'scenario_scripts': scripts,
            'timing_strategy': timing,
            'counter_offer_templates': templates,
            'confidence_exercises': exercises,
            'offer_guidance': offer_guidance,
            'readiness_checklist': self._build_readiness_checklist(),
        }

    # ------------------------------------------------------------------
    # Data helpers
    # ------------------------------------------------------------------
    def _ensure_research(self) -> Optional[SalaryResearch]:
        if self.salary_research:
            return self.salary_research
        return SalaryResearch.objects.filter(job=self.job).order_by('-created_at').first()

    def _derive_stats(self, research: Optional[SalaryResearch]) -> Dict[str, Any]:
        if research:
            return {
                'salary_min': _safe_number(research.salary_min),
                'salary_max': _safe_number(research.salary_max),
                'salary_median': _safe_number(research.salary_median),
                'percentile_25': _safe_number(research.percentile_25),
                'percentile_75': _safe_number(research.percentile_75),
                'recommended_ask': _safe_number(research.recommended_ask) or _safe_number(research.salary_max),
                'bonus_avg': _safe_number(research.bonus_avg),
                'stock_equity': _safe_number(research.stock_equity),
                'total_comp_min': _safe_number(research.total_comp_min),
                'total_comp_max': _safe_number(research.total_comp_max),
                'market_trend': research.market_trend or 'stable',
                'sample_size': research.sample_size or 0,
                'location': research.location,
                'experience_level': research.experience_level,
            }

        # Fall back to aggregator for fresh snapshot
        aggregated = salary_aggregator.aggregate_salary_data(
            job_title=self.job.title,
            location=self.job.location or 'Remote',
            experience_level=self.profile.experience_level or 'mid',
            company_size='medium',
            job_type=self.job.job_type,
            company_name=self.job.company_name,
        )
        stats = aggregated.get('aggregated_stats', {})
        negotiation = aggregated.get('negotiation_recommendations', {})
        return {
            'salary_min': _safe_number(stats.get('salary_min')),
            'salary_max': _safe_number(stats.get('salary_max')),
            'salary_median': _safe_number(stats.get('salary_median')),
            'percentile_25': _safe_number(stats.get('percentile_25')),
            'percentile_75': _safe_number(stats.get('percentile_75')),
            'recommended_ask': _safe_number(negotiation.get('recommended_ask')),
            'bonus_avg': _safe_number(stats.get('bonus_avg')),
            'stock_equity': _safe_number(stats.get('stock_equity')),
            'total_comp_min': _safe_number(stats.get('total_comp_min')),
            'total_comp_max': _safe_number(stats.get('total_comp_max')),
            'market_trend': aggregated.get('market_insights', {}).get('market_trend', 'stable'),
            'sample_size': stats.get('data_points', 0),
            'location': self.job.location or 'Remote',
            'experience_level': self.profile.experience_level or 'mid',
        }

    # ------------------------------------------------------------------
    # Builders for plan sections
    # ------------------------------------------------------------------
    def _build_market_context(self, stats: Dict[str, Any], research: Optional[SalaryResearch]) -> Dict[str, Any]:
        return {
            'title': self.job.title,
            'company': self.job.company_name,
            'location': stats.get('location') or (self.job.location or 'Remote'),
            'job_type': dict(JobEntry.JOB_TYPES).get(self.job.job_type, self.job.job_type),
            'salary_range': {
                'min': stats.get('salary_min'),
                'max': stats.get('salary_max'),
                'median': stats.get('salary_median'),
                'display': f"{_format_currency(stats.get('salary_min'))} - {_format_currency(stats.get('salary_max'))}",
                'recommended_target': _format_currency(stats.get('recommended_ask')),
            },
            'market_trend': stats.get('market_trend', 'stable'),
            'sample_size': stats.get('sample_size', 0),
            'salary_research_id': research.id if research else None,
        }

    def _build_talking_points(self, stats: Dict[str, Any]) -> List[Dict[str, Any]]:
        points: List[Dict[str, Any]] = []
        summary = (self.profile.summary or '').strip()
        if summary:
            points.append({
                'title': 'Strategic Narrative',
                'detail': f"Open by tying your summary (\"{summary[:120]}...\") to {self.job.company_name}'s current goals.",
            })

        years = self.profile.years_experience or 0
        if years:
            points.append({
                'title': 'Experience Edge',
                'detail': f"Reference your {years}+ years of experience to justify a request near {_format_currency(stats.get('percentile_75'))}.",
            })

        achievements = Achievement.objects.filter(candidate=self.profile).order_by('-date')[:3]
        for achievement in achievements:
            descriptor = achievement.description or 'impact'
            points.append({
                'title': achievement.title,
                'detail': f"Connect {descriptor[:140]} to the outcomes this role owns to show measurable ROI.",
                'date': achievement.date.isoformat() if achievement.date else None,
            })

        if not points:
            points.append({
                'title': 'Quantify Impact',
                'detail': 'Have two concise stories ready: one revenue/efficiency win and one cross-functional collaboration example.',
            })
        return points

    def _build_total_comp_framework(self, stats: Dict[str, Any]) -> Dict[str, Any]:
        return {
            'cash_components': [
                {
                    'label': 'Base Salary Range',
                    'value': {
                        'min': stats.get('salary_min'),
                        'max': stats.get('salary_max'),
                        'recommended': stats.get('recommended_ask'),
                    },
                    'display': f"{_format_currency(stats.get('salary_min'))} – {_format_currency(stats.get('salary_max'))}",
                },
                {
                    'label': 'Bonus Target',
                    'value': stats.get('bonus_avg'),
                    'display': _format_currency(stats.get('bonus_avg')),
                },
                {
                    'label': 'Equity / Stock',
                    'value': stats.get('stock_equity'),
                    'display': _format_currency(stats.get('stock_equity')),
                },
            ],
            'benefits_checklist': [
                'Health + dental/vision coverage tiers',
                'Retirement match (401k / pension)',
                'Signing bonus or relocation stipend',
                'Remote-work flexibility + equipment budget',
                'Professional development allowance',
                'Equity refresh cadence / vesting schedule',
            ],
            'evaluation_matrix': [
                {'factor': 'Role impact scope', 'prompt': 'Will you own revenue, cost, or platform KPIs?'},
                {'factor': 'Visibility and sponsors', 'prompt': 'Who is the VP/Director championing this hire?'},
                {'factor': 'Career acceleration', 'prompt': 'Does this role create VP-track exposure in 12-18 months?'},
            ],
            'total_comp_projection': {
                'min': stats.get('total_comp_min'),
                'max': stats.get('total_comp_max'),
                'display': f"{_format_currency(stats.get('total_comp_min'))} – {_format_currency(stats.get('total_comp_max'))}",
            },
        }

    def _build_scenario_scripts(self, stats: Dict[str, Any]) -> List[Dict[str, Any]]:
        recommended = _format_currency(stats.get('recommended_ask'))
        median = _format_currency(stats.get('salary_median'))
        company = self.job.company_name
        title = self.job.title

        return [
            {
                'scenario': 'Initial Offer Response',
                'objective': 'Anchor the conversation above the median by layering data + impact.',
                'script': [
                    f"Thank you for the offer and for outlining how {title} ladders up to {company}'s roadmap.",
                    f"Based on current market data I collected ({median} median, {recommended} top quartile), I'd like to explore a total package toward the upper end to reflect my track record leading similar scope.",
                    "Pause, let them respond, then ask an open-ended question about flexibility across base, sign-on, or equity.",
                ],
                'data_points': [median, recommended],
            },
            {
                'scenario': 'Counteroffer Email (Written)',
                'objective': 'Document the ask with gratitude and precise justification.',
                'script': [
                    'Lead with enthusiasm: reiterate why the team/problem energizes you.',
                    f"State the delta factually: 'Given the responsibilities, a base of {recommended} keeps the offer aligned with comparable roles I am exploring.'",
                    'Offer trade-offs: higher base vs. signing bonus vs. equity top-up.',
                ],
            },
            {
                'scenario': 'Multiple Offer Leverage',
                'objective': 'Reference competing timelines without ultimatums.',
                'script': [
                    'Share that another process is moving quickly and outline what makes this role your top choice.',
                    'Ask if the team can accelerate comp conversations or add clarity on progression so you can make an informed decision.',
                ],
            },
        ]

    def _build_timing_strategy(self) -> Dict[str, List[str]]:
        respond_by = self.offer_details.get('respond_by')
        respond_hint = f"Mark {respond_by} as the final decision date" if respond_by else 'Confirm the company timeline in writing'
        return {
            'preparation': [
                'List two quantifiable wins tied to revenue, cost, or efficiency.',
                'Rehearse the ask with a mentor or record yourself for clarity/pace.',
                respond_hint,
            ],
            'live_conversation': [
                'Lead with appreciation, then restate value before numbers.',
                'Ask calibrated questions ("How much flexibility do we have in base vs bonus?")',
                'Take notes on every component mentioned.',
            ],
            'follow_up': [
                'Send recap email with agreed next steps within 2 hours.',
                'Set reminder to follow up if you do not hear back within the promised window.',
            ],
        }

    def _build_counter_templates(self, stats: Dict[str, Any]) -> List[Dict[str, Any]]:
        recommended = _format_currency(stats.get('recommended_ask'))
        company = self.job.company_name
        return [
            {
                'name': 'Collaborative Counter',
                'subject': 'Excited to take the next step',
                'body': (
                    f"Hi {{recruiter}},\n\nThanks again for the {self.job.title} offer. I'm energized by {company}'s mission and would like to accept pending a quick alignment on compensation. "
                    f"Given my ownership of similar initiatives, aligning base closer to {recommended} keeps things market competitive while letting me fully commit. "
                    "If base flexibility is limited, I'm open to discussing a signing bonus or equity refresh so we can close the gap.\n\nThanks for exploring this together!"
                ),
                'checklist': ['Reiterate enthusiasm', 'State data-backed target', 'Offer two trade-offs'],
            },
            {
                'name': 'Counteroffer Evaluation Worksheet',
                'subject': 'Offer comparison grid',
                'body': 'List each component (base, bonus, equity, benefits) and rate confidence 1-5. Highlight gaps vs. priorities before responding.',
                'checklist': ['Quantify each component', 'Mark non-negotiables', 'Decide walk-away number'],
            },
        ]

    def _build_confidence_exercises(self) -> List[Dict[str, Any]]:
        return [
            {
                'name': 'Evidence Sprint',
                'duration_minutes': 5,
                'instructions': 'Write three bullet points linking your achievements to the job description and read them aloud before the call.',
            },
            {
                'name': 'Breathing Ladder',
                'duration_minutes': 3,
                'instructions': 'Inhale 4 seconds, hold 4, exhale 6 to reset nervous system prior to negotiations.',
            },
            {
                'name': 'Confidence Replay',
                'duration_minutes': 4,
                'instructions': 'Listen to a recording of your practiced ask to normalize tone and pacing.',
            },
        ]

    def _build_offer_guidance(self, stats: Dict[str, Any]) -> Dict[str, Any]:
        offer = {
            'base_salary': _safe_number(self.offer_details.get('base_salary')),
            'bonus': _safe_number(self.offer_details.get('bonus')),
            'equity': _safe_number(self.offer_details.get('equity')),
            'respond_by': self.offer_details.get('respond_by'),
            'notes': self.offer_details.get('notes'),
        }

        gaps = []
        if offer['base_salary'] and stats.get('recommended_ask'):
            delta = stats['recommended_ask'] - offer['base_salary']
            gaps.append({
                'component': 'Base salary',
                'delta': delta,
                'display': _format_currency(delta),
            })
        if offer['bonus'] and stats.get('bonus_avg'):
            gaps.append({
                'component': 'Bonus',
                'delta': stats['bonus_avg'] - offer['bonus'],
                'display': _format_currency(stats['bonus_avg'] - offer['bonus']),
            })

        return {
            'offer_details': offer,
            'gaps': gaps,
            'decision_filters': [
                'Does the role accelerate your 12-month goal?',
                'Is the manager invested in your growth plan?',
                'Are scope, title, and pay all aligned? If one lags, negotiate the lever that matters most.',
            ],
        }

    def _build_readiness_checklist(self) -> List[Dict[str, Any]]:
        return [
            {'label': 'Market data summarized', 'done': bool(self._ensure_research())},
            {'label': 'Talking points rehearsed', 'done': False},
            {'label': 'Counter script drafted', 'done': bool(self.offer_details)},
        ]


def build_progression_snapshot(outcomes: List[SalaryNegotiationOutcome]) -> Dict[str, Any]:
    """Summarize progression metrics for timeline visualization."""
    if not outcomes:
        return {'attempts': 0, 'avg_lift_percent': 0, 'timeline': []}

    timeline = []
    lifts = []
    for outcome in sorted(outcomes, key=lambda o: o.created_at):
        company_offer = _safe_number(outcome.company_offer)
        final_result = _safe_number(outcome.final_result) or _safe_number(outcome.counter_amount)
        lift_percent = 0
        if company_offer and final_result:
            lift_percent = ((final_result - company_offer) / company_offer) * 100
            lifts.append(lift_percent)
        timeline.append({
            'id': outcome.id,
            'stage': outcome.stage,
            'status': outcome.status,
            'company_offer': company_offer,
            'final_result': final_result,
            'lift_percent': round(lift_percent, 2) if lift_percent else 0,
            'notes': outcome.notes,
            'created_at': outcome.created_at.isoformat(),
        })

    avg_lift = sum(lifts) / len(lifts) if lifts else 0
    return {
        'attempts': len(outcomes),
        'avg_lift_percent': round(avg_lift, 2),
        'timeline': timeline,
    }
