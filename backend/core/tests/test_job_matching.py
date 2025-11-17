import pytest
from decimal import Decimal
from types import SimpleNamespace
from core.job_matching import JobMatchingEngine


@pytest.mark.unit
def test_normalize_weights():
    w = {'skills': 2, 'experience': 1, 'education': 1}
    norm = JobMatchingEngine._normalize_weights(w)
    total = sum(norm.values())
    assert round(float(total), 5) == 1.0
    assert set(norm.keys()) == {'skills', 'experience', 'education'}


@pytest.mark.unit
def test_calculate_skills_score_empty(monkeypatch):
    # When SkillsGapAnalyzer returns empty skills, should return base 40
    monkeypatch.setattr('core.job_matching.SkillsGapAnalyzer', SimpleNamespace(analyze_job=lambda j, c: {'skills': [], 'summary': {}}))
    job = SimpleNamespace()
    candidate = SimpleNamespace()
    score = JobMatchingEngine.calculate_skills_score(job, candidate)
    assert isinstance(score, Decimal)
    assert score == Decimal('40')


@pytest.mark.unit
def test_calculate_skills_score_with_data(monkeypatch):
    # Construct skills data with a mix of gap severities and matched/missing counts
    skills = [
        {'name': 'python', 'gap_severity': 10, 'candidate_level': 3, 'target_level': 4},
        {'name': 'django', 'gap_severity': 30, 'candidate_level': 2, 'target_level': 3},
        {'name': 'sql', 'gap_severity': 70, 'candidate_level': 1, 'target_level': 3},
        {'name': 'aws', 'gap_severity': 90, 'candidate_level': None, 'target_level': 2}
    ]
    summary = {'total_skills_required': 4, 'total_skills_matched': 2, 'total_skills_missing': 1}
    monkeypatch.setattr('core.job_matching.SkillsGapAnalyzer', SimpleNamespace(analyze_job=lambda j, c: {'skills': skills, 'summary': summary}))
    job = SimpleNamespace()
    candidate = SimpleNamespace()
    score = JobMatchingEngine.calculate_skills_score(job, candidate)
    assert isinstance(score, Decimal)
    assert score >= Decimal('0') and score <= Decimal('100')


@pytest.mark.unit
def test_calculate_match_score_integration(monkeypatch):
    # Provide a simple SkillsGapAnalyzer and simple experience/education behaviors
    skills = [{'name': 'x', 'gap_severity': 10, 'candidate_level': 2, 'target_level': 2}]
    summary = {'total_skills_required': 1, 'total_skills_matched': 1, 'total_skills_missing': 0}
    monkeypatch.setattr('core.job_matching.SkillsGapAnalyzer', SimpleNamespace(analyze_job=lambda j, c: {'skills': skills, 'summary': summary}))

    # Fake experiences and education query methods by monkeypatching methods that access DB
    job = SimpleNamespace(title='Software Engineer', description='Work on software')
    candidate = SimpleNamespace(experience_level='mid')

    result = JobMatchingEngine.calculate_match_score(job, candidate)
    assert 'overall_score' in result
    assert 'skills_score' in result
    assert result['overall_score'] >= 0
    assert result['overall_score'] <= 100
