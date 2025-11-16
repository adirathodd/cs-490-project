import pytest
from types import SimpleNamespace
from core.automation import ApplicationPackageGenerator
from django.conf import settings


@pytest.mark.django_db
def test_generate_resume_returns_none_when_no_api_key(monkeypatch):
    # Prepare fake job and candidate without default resume
    job = SimpleNamespace(id=1, company_name='X', title='Engineer')
    candidate = SimpleNamespace(id=1, default_resume_doc=None)

    # Ensure GEMINI_API_KEY is empty
    monkeypatch.setattr(settings, 'GEMINI_API_KEY', '', raising=False)

    res = ApplicationPackageGenerator._generate_resume(job, candidate, parameters=None)
    assert res is None


@pytest.mark.django_db
def test_generate_cover_letter_returns_none_when_no_api_key(monkeypatch):
    job = SimpleNamespace(id=1, company_name='X', title='Engineer')
    candidate = SimpleNamespace(id=1, default_cover_letter_doc=None)

    monkeypatch.setattr(settings, 'GEMINI_API_KEY', '', raising=False)

    res = ApplicationPackageGenerator._generate_cover_letter(job, candidate, parameters=None)
    assert res is None
