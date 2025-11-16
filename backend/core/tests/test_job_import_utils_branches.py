import json
from bs4 import BeautifulSoup
import requests
import pytest

from core import job_import_utils as ji


def _soup_from_html(html: str):
    return BeautifulSoup(html, 'html.parser')


def test_fetch_document_follows_canonical(monkeypatch):
    html = '<html><head><link rel="canonical" href="/final"/></head><body><p>done</p></body></html>'
    soup_initial = _soup_from_html(html)
    soup_final = _soup_from_html('<html><body><p>final</p></body></html>')

    calls = {'n': 0}

    def fake_fetch_soup(url, allow_proxy=True):
        calls['n'] += 1
        # first url returns canonical pointing to /final
        if calls['n'] == 1:
            return soup_initial
        return soup_final

    monkeypatch.setattr(ji, '_fetch_job_soup', fake_fetch_soup)
    soup, final_url = ji._fetch_job_document('https://example.com/initial')
    assert 'final' in soup.get_text()


def test_fetch_document_follows_meta_refresh(monkeypatch):
    html = '<meta http-equiv="refresh" content="5; url=/redirected"/>'
    soup_initial = _soup_from_html(f'<html><head>{html}</head><body></body></html>')
    soup_redirect = _soup_from_html('<html><body>redirected</body></html>')

    def fake_fetch_soup(url, allow_proxy=True):
        if 'initial' in url:
            return soup_initial
        return soup_redirect

    monkeypatch.setattr(ji, '_fetch_job_soup', fake_fetch_soup)
    soup, final = ji._fetch_job_document('https://example.com/initial')
    assert 'redirected' in soup.get_text()


def test_format_fetch_error_timeout_and_connection():
    t = requests.Timeout()
    c = requests.ConnectionError()
    assert 'too long' in ji._format_fetch_error(t, 'S').lower()
    assert 'could not connect' in ji._format_fetch_error(c, 'S').lower()


def test_extract_linkedin_job_parses_fields(monkeypatch):
    # Construct simplified LinkedIn-like markup
    html = '''<h1 class="top-card-layout__title">Eng</h1>
    <a class="topcard__org-name-link">Org</a>
    <span class="topcard__flavor--bullet">Remote</span>
    <div class="show-more-less-html__markup">Description text</div>'''
    soup = _soup_from_html(f'<html><body>{html}</body></html>')

    def fake_fetch(url, *args, **kwargs):
        return soup, url

    monkeypatch.setattr(ji, '_fetch_job_document', fake_fetch)
    res = ji.extract_linkedin_job('https://www.linkedin.com/jobs/view/1')
    assert res.status == ji.JobImportResult.STATUS_SUCCESS
    assert res.data.get('title') == 'Eng'
    assert res.data.get('company_name') == 'Org'


def test_extract_indeed_job_parses_salary_and_title(monkeypatch):
    html = '<h1 class="jobsearch-JobInfoHeader-title">Dev</h1><div class="jobsearch-InlineCompanyRating"><a>Acme</a></div><div id="jobDescriptionText">Desc</div><div class="jobsearch-JobMetadataHeader-item">$120,000</div>'
    soup = _soup_from_html(f'<html><body>{html}</body></html>')

    def fake_fetch(url, *args, **kwargs):
        return soup, url

    monkeypatch.setattr(ji, '_fetch_job_document', fake_fetch)
    res = ji.extract_indeed_job('https://indeed.com/viewjob?jk=1')
    assert res.status == ji.JobImportResult.STATUS_SUCCESS
    assert res.data.get('salary_min') == 120000


def test_extract_glassdoor_job_parses_salary(monkeypatch):
    html = '<div class="job-title">GDev</div><div class="employer-name">GCorp</div><div class="job-description">GDesc</div><span class="salary-estimate">$85,000</span>'
    soup = _soup_from_html(f'<html><body>{html}</body></html>')

    def fake_fetch(url, *args, **kwargs):
        return soup, url

    monkeypatch.setattr(ji, '_fetch_job_document', fake_fetch)
    res = ji.extract_glassdoor_job('https://glassdoor.com/job-listing/1')
    assert res.status == ji.JobImportResult.STATUS_SUCCESS
    assert res.data.get('salary_min') == 85000


def test_generic_meta_and_title_and_company(monkeypatch):
    html = '<meta property="og:title" content="MetaTitle"/><meta property="og:site_name" content="MetaSite"/><article>Article Desc</article>'
    soup = _soup_from_html(f'<html><head>{html}</head><body></body></html>')

    def fake_fetch(url, *args, **kwargs):
        return soup, url

    monkeypatch.setattr(ji, '_fetch_job_document', fake_fetch)
    res = ji.extract_generic_job('https://example.com/job')
    assert res.status == ji.JobImportResult.STATUS_SUCCESS
    assert res.data.get('title') == 'MetaTitle'
    assert res.data.get('company_name') == 'MetaSite'


def test_generic_jsonld_employment_and_salary(monkeypatch):
    job_posting = {
        '@type': 'JobPosting',
        'title': 'JSON Engineer',
        'description': '<p>Some description</p>',
        'hiringOrganization': {'name': 'JsonCo'},
        'employmentType': ['Full-time'],
        'baseSalary': {'value': {'value': 90000.0}, 'currency': 'USD'}
    }
    html = f'<script type="application/ld+json">{json.dumps(job_posting)}</script>'
    soup = _soup_from_html(f'<html><head>{html}</head><body></body></html>')

    def fake_fetch(url, *args, **kwargs):
        return soup, url

    monkeypatch.setattr(ji, '_fetch_job_document', fake_fetch)
    res = ji.extract_generic_job('https://x')
    assert res.status == ji.JobImportResult.STATUS_SUCCESS
    assert res.data.get('job_type') == 'ft'
    assert res.data.get('salary_min') in ("90000", "90000.00")


def test_import_job_from_url_invalid_and_unsupported():
    r = ji.import_job_from_url('')
    assert r.status == ji.JobImportResult.STATUS_FAILED
    r2 = ji.import_job_from_url('ftp://bad')
    assert r2.status == ji.JobImportResult.STATUS_FAILED
