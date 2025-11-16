import pytest
from datetime import datetime, date

from core import resume_ai as ra


def test_format_date_value_and_month_year():
    assert ra._format_date_value(None) is None
    dt = datetime(2020, 5, 17, 12, 0, 0)
    assert ra._format_date_value(dt) == '2020-05-17'
    d = date(2019, 1, 2)
    assert ra._format_date_value(d) == '2019-01-02'

    assert ra._month_year('2020-05-17') == 'May 2020'
    assert ra._month_year('not-a-date') == 'not-a-date'


def test_format_date_range():
    item = {'start_date': '2020-01-01', 'is_current': True}
    r = ra._format_date_range(item)
    assert 'Present' in r or '2020' in r


def test_fallback_bullets_and_degree_label():
    text = 'First line.\nSecond line\n• Third bullet - fourth'
    bullets = ra._fallback_bullets_from_text(text, limit=3)
    assert isinstance(bullets, list)
    assert len(bullets) >= 2

    edu = {'degree_type': 'bs', 'field_of_study': 'Computer Science'}
    assert 'Bachelor of Science in Computer Science' in ra._format_degree_label(edu)
    assert ra._format_degree_label({'degree_type': '', 'field_of_study': ''}) == 'Coursework'


def test_dedupe_and_beautify_and_extract_keywords():
    seq = ['Python', 'python', '', 'Java']
    out = ra._dedupe(seq)
    assert out[0].lower() == 'python'
    assert 'Java' in out

    assert ra._beautify_keyword('py') == 'PY'
    assert ra._beautify_keyword('python') == 'Python'

    kws = ra._extract_keywords('Python developer, AWS cloud microservices Python')
    assert isinstance(kws, list)
    assert len(kws) > 0


def test_call_gemini_api_requires_key():
    with pytest.raises(ra.ResumeAIError):
        ra.call_gemini_api('prompt', api_key='')


def test_build_generation_prompt_contains_snapshots():
    candidate = {'name': 'A', 'skills': []}
    job = {'title': 'Engineer', 'description': 'Do work'}
    prompt = ra.build_generation_prompt(candidate, job, tone='impact', variation_count=1)
    assert 'Candidate:' in prompt and 'Job:' in prompt
