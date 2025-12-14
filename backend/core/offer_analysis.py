"""
Offer comparison analytics utilities (UC-127).

Provides helper functions to normalize compensation components, apply
scenario adjustments, and generate negotiation recommendations that can
be rendered by the frontend comparison matrix.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Dict, Iterable, List, Optional

DEFAULT_COL_INDEX = Decimal('100')
FINANCIAL_WEIGHT = 0.6
NON_FINANCIAL_WEIGHT = 0.4
NON_FINANCIAL_WEIGHTS = {
    'culture_fit_score': 0.4,
    'growth_opportunity_score': 0.35,
    'work_life_balance_score': 0.25,
}

# Lightweight COL data pulled from public cost-of-living indexes.
COST_OF_LIVING_INDEXES = {
    'san francisco': Decimal('180'),
    'new york': Decimal('168'),
    'seattle': Decimal('145'),
    'boston': Decimal('140'),
    'los angeles': Decimal('138'),
    'washington, dc': Decimal('135'),
    'austin': Decimal('118'),
    'denver': Decimal('112'),
    'atlanta': Decimal('108'),
    'chicago': Decimal('110'),
    'dallas': Decimal('105'),
    'remote': DEFAULT_COL_INDEX,
}


def to_decimal(value, default=Decimal('0')) -> Decimal:
    if value in (None, '', 'null'):
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def infer_cost_of_living_index(location: str) -> Decimal:
    if not location:
        return DEFAULT_COL_INDEX
    key = location.lower().strip()
    for city, index in COST_OF_LIVING_INDEXES.items():
        if city in key:
            return index
    return DEFAULT_COL_INDEX


def compute_benefits_total(breakdown: Optional[Dict], base_salary: Decimal) -> Decimal:
    breakdown = breakdown or {}
    total = Decimal('0')
    for key in ('health_value', 'retirement_value', 'wellness_value', 'other_value'):
        total += to_decimal(breakdown.get(key), Decimal('0'))

    pto_days = to_decimal(breakdown.get('pto_days'), Decimal('0'))
    daily_rate = Decimal('0')
    if base_salary and base_salary > 0:
        # Assume 260 working days in a year.
        daily_rate = base_salary / Decimal('260')
    if pto_days and daily_rate:
        total += pto_days * daily_rate
    return total


def generate_negotiation_recommendations(snapshot: Dict) -> List[str]:
    recs: List[str] = []
    non_fin = snapshot.get('non_financial', {})
    financial_score = snapshot.get('financial_score', 0)
    benefits_value = snapshot.get('benefits_value', 0)

    if financial_score < 70:
        recs.append('Use salary benchmarks to anchor a counter closer to the market 75th percentile.')
    if benefits_value < 8000:
        recs.append('Ask for a richer benefits package (health stipends, education budget, extra PTO).')
    if non_fin.get('culture_fit_score', 0) < 7:
        recs.append('Schedule additional conversations with future teammates to evaluate culture fit.')
    if non_fin.get('growth_opportunity_score', 0) < 7:
        recs.append('Frame a growth plan (scope increases, promotion timeline) as part of negotiations.')
    if not recs:
        recs.append('Leverage competing offers to secure higher total comp or flexibility perks.')
    return recs


@dataclass
class OfferHeader:
    id: int
    label: str
    company: str
    location: str
    remote_policy: str


class OfferComparisonEngine:
    """
    Build comparison data structures that the frontend can consume.
    """

    def __init__(self, scenario: Optional[Dict] = None):
        self.scenario = scenario or {}

    def build(self, offers: Iterable) -> Dict:
        snapshots = [self._build_snapshot(offer) for offer in offers]
        if not snapshots:
            return {
                'offers': [],
                'matrix': {'headers': [], 'rows': []},
                'summary': {'notes': ['Log job offers to unlock comparisons.']},
                'weights': {
                    'financial': FINANCIAL_WEIGHT,
                    'non_financial': NON_FINANCIAL_WEIGHT,
                    'non_financial_breakdown': NON_FINANCIAL_WEIGHTS,
                },
                'scenario': self._describe_scenario(False),
            }

        best_adjusted = max(s.get('adjusted_total_comp', 0) for s in snapshots) or 1
        for snapshot in snapshots:
            snapshot['financial_score'] = self._score_financial(snapshot['adjusted_total_comp'], best_adjusted)
            snapshot['non_financial']['weighted_score'] = self._score_non_financial(snapshot['non_financial'])
            snapshot['overall_score'] = round(
                (snapshot['financial_score'] * FINANCIAL_WEIGHT)
                + (snapshot['non_financial']['weighted_score'] * NON_FINANCIAL_WEIGHT),
                2,
            )
            snapshot['negotiation_recommendations'] = generate_negotiation_recommendations(snapshot)

        snapshots.sort(key=lambda item: item['overall_score'], reverse=True)
        matrix = self._build_matrix(snapshots)
        summary = self._build_summary(snapshots)

        return {
            'offers': snapshots,
            'matrix': matrix,
            'summary': summary,
            'weights': {
                'financial': FINANCIAL_WEIGHT,
                'non_financial': NON_FINANCIAL_WEIGHT,
                'non_financial_breakdown': NON_FINANCIAL_WEIGHTS,
            },
            'scenario': self._describe_scenario(self._scenario_applied()),
        }

    def _scenario_applied(self) -> bool:
        return any(
            to_decimal(self.scenario.get(key), Decimal('0')) != 0
            for key in ('salary_increase_percent', 'bonus_increase_percent', 'equity_increase_percent', 'benefits_increase_percent')
        )

    def _describe_scenario(self, applied: bool) -> Dict:
        label = self.scenario.get('label') or 'Baseline view'
        details = {
            'applied': applied,
            'label': label,
            'params': self.scenario,
        }
        if applied and label == 'Baseline view':
            del details['label']
            details['label'] = 'Scenario adjustment'
        return details

    def _build_snapshot(self, offer) -> Dict:
        base_salary = to_decimal(offer.base_salary)
        bonus = to_decimal(offer.bonus)
        equity = to_decimal(offer.equity)
        benefits_total = to_decimal(offer.benefits_total_value)
        if not benefits_total:
            benefits_total = compute_benefits_total(offer.benefits_breakdown, base_salary)

        scenario_multiplier = self._scenario_multiplier(offer.id)
        scenario_bonus_mult = self._scenario_multiplier(offer.id, key='bonus')
        scenario_equity_mult = self._scenario_multiplier(offer.id, key='equity')
        scenario_benefits_mult = self._scenario_multiplier(offer.id, key='benefits')

        base_salary = base_salary * scenario_multiplier
        bonus = bonus * scenario_bonus_mult
        equity = equity * scenario_equity_mult
        benefits_total = benefits_total * scenario_benefits_mult

        total_comp = base_salary + bonus + equity + benefits_total
        col_index = to_decimal(offer.cost_of_living_index, DEFAULT_COL_INDEX)
        if col_index <= 0:
            col_index = DEFAULT_COL_INDEX
        adjusted_total = total_comp / (col_index / Decimal('100'))

        non_financial = {
            'culture_fit_score': offer.culture_fit_score or 0,
            'growth_opportunity_score': offer.growth_opportunity_score or 0,
            'work_life_balance_score': offer.work_life_balance_score or 0,
        }

        return {
            'id': offer.id,
            'role_title': offer.role_title,
            'company_name': offer.company_name,
            'location': offer.location,
            'remote_policy': offer.remote_policy,
            'status': offer.status,
            'base_salary': float(base_salary),
            'bonus': float(bonus),
            'equity': float(equity),
            'benefits_value': float(benefits_total),
            'total_comp': float(total_comp),
            'adjusted_total_comp': float(adjusted_total),
            'cost_of_living_index': float(col_index),
            'non_financial': non_financial,
            'notes': offer.notes,
            'decline_reason': offer.decline_reason,
        }

    def _scenario_multiplier(self, offer_id: int, key: str = 'salary') -> Decimal:
        percent_field = {
            'salary': 'salary_increase_percent',
            'bonus': 'bonus_increase_percent',
            'equity': 'equity_increase_percent',
            'benefits': 'benefits_increase_percent',
        }[key]
        percent = to_decimal(self.scenario.get(percent_field), Decimal('0'))
        if not percent:
            return Decimal('1')
        offer_ids = self.scenario.get('offer_ids') or []
        if offer_ids and offer_id not in offer_ids:
            return Decimal('1')
        return Decimal('1') + (percent / Decimal('100'))

    def _score_financial(self, adjusted_total: float, best_adjusted: float) -> float:
        if best_adjusted <= 0:
            return 0
        return round((adjusted_total / best_adjusted) * 100, 2)

    def _score_non_financial(self, scores: Dict[str, float]) -> float:
        weighted = 0.0
        for key, weight in NON_FINANCIAL_WEIGHTS.items():
            value = scores.get(key, 0) or 0
            weighted += (value / 10.0) * weight * 100
        return round(weighted, 2)

    def _build_matrix(self, snapshots: List[Dict]) -> Dict:
        headers = [
            OfferHeader(
                id=s['id'],
                label=s['role_title'],
                company=s['company_name'],
                location=s['location'],
                remote_policy=s['remote_policy'],
            )
            for s in snapshots
        ]

        def collect(metric: str) -> List[float]:
            return [snapshots[i][metric] for i in range(len(snapshots))]

        rows = [
            {'key': 'base_salary', 'label': 'Base salary', 'format': 'currency', 'values': collect('base_salary')},
            {'key': 'bonus', 'label': 'Bonus', 'format': 'currency', 'values': collect('bonus')},
            {'key': 'equity', 'label': 'Equity', 'format': 'currency', 'values': collect('equity')},
            {'key': 'benefits_value', 'label': 'Benefits value', 'format': 'currency', 'values': collect('benefits_value')},
            {'key': 'total_comp', 'label': 'Total compensation', 'format': 'currency', 'values': collect('total_comp')},
            {'key': 'cost_of_living_index', 'label': 'Cost of living index', 'format': 'number', 'values': collect('cost_of_living_index')},
            {'key': 'adjusted_total_comp', 'label': 'COL-adjusted total', 'format': 'currency', 'values': collect('adjusted_total_comp')},
            {
                'key': 'culture_fit_score',
                'label': 'Culture fit (1-10)',
                'format': 'score',
                'values': [snap['non_financial']['culture_fit_score'] for snap in snapshots],
            },
            {
                'key': 'growth_opportunity_score',
                'label': 'Growth opportunities (1-10)',
                'format': 'score',
                'values': [snap['non_financial']['growth_opportunity_score'] for snap in snapshots],
            },
            {
                'key': 'work_life_balance_score',
                'label': 'Work-life balance (1-10)',
                'format': 'score',
                'values': [snap['non_financial']['work_life_balance_score'] for snap in snapshots],
            },
            {
                'key': 'overall_score',
                'label': 'Weighted score',
                'format': 'score',
                'values': [snap['overall_score'] for snap in snapshots],
            },
        ]
        return {
            'headers': [header.__dict__ for header in headers],
            'rows': rows,
        }

    def _build_summary(self, snapshots: List[Dict]) -> Dict:
        top = snapshots[0]
        highest_comp = max(snapshots, key=lambda s: s['adjusted_total_comp'])
        notes = []
        if top['id'] != highest_comp['id']:
            notes.append(f"{top['company_name']} wins overall, but {highest_comp['company_name']} leads on pure compensation.")
        else:
            notes.append(f"{top['company_name']} leads on both total compensation and weighted score.")
        notes.append('Use scenario analysis to test negotiation levers like +10% salary or richer benefits.')
        return {
            'top_overall': {'offer_id': top['id'], 'company': top['company_name'], 'score': top['overall_score']},
            'highest_total_comp': {
                'offer_id': highest_comp['id'],
                'company': highest_comp['company_name'],
                'adjusted_total_comp': highest_comp['adjusted_total_comp'],
            },
            'notes': notes,
        }
