import json
import requests
from bs4 import BeautifulSoup

import pytest

from core import job_import_utils as ji


def test_clean_text_empty():
    assert ji.clean_text('') == ''
    assert ji.clean_text(None) == ''


def test_clean_text_normalizes_whitespace():
    assert ji.clean_text('  Hello   world\n') == 'Hello world'


def test_detect_job_board():
    assert ji.detect_job_board('https://www.linkedin.com/jobs/view/123') == 'linkedin'
    assert ji.detect_job_board('https://indeed.com/viewjob?jk=abc') == 'indeed'
    assert ji.detect_job_board('https://www.glassdoor.com/job-listing/foo') == 'glassdoor'
    assert ji.detect_job_board('https://example.com/jobs/1') is None


def test_normalize_and_proxy_url():
    url = 'HTTP://Example.COM/Path'
    assert ji._normalize_url(url).startswith('http://example.com/')
    proxy = ji._proxy_reader_url('https://example.com/foo')
    assert proxy.startswith('https://r.jina.ai/')


def test_infer_job_type():
    assert ji._infer_job_type('This is Full-Time role') == 'ft'
    assert ji._infer_job_type('part time position') == 'pt'
    assert ji._infer_job_type('contractor') == 'contract'
    assert ji._infer_job_type('Internship opportunity') == 'intern'
    assert ji._infer_job_type('') is None


def make_soup_with_jsonld(obj):
    html = '<html><head>'
    html += f"<script type=\"application/ld+json\">{json.dumps(obj)}</script>"
    html += '</head><body></body></html>'
    return BeautifulSoup(html, 'html.parser')


def test_load_json_ld_objects_dict_and_list():
    obj = {"@type": "JobPosting", "title": "Engineer"}
    soup = make_soup_with_jsonld(obj)
    objs = list(ji._load_json_ld_objects(soup))
    assert any(o.get('title') == 'Engineer' for o in objs)


def test_format_fetch_error_status_codes():
    # 404
    resp = type('R', (), {'status_code': 404})()
    err = requests.HTTPError(response=resp)
    msg = ji._format_fetch_error(err, 'Site')
    assert 'not found' in msg.lower() or 'removed' in msg.lower()

    # 403/429
    resp2 = type('R', (), {'status_code': 403})()
    err2 = requests.HTTPError(response=resp2)
    msg2 = ji._format_fetch_error(err2, 'Site')
    assert 'rejected' in msg2 or 'blocking' in msg2


def test_fetch_job_soup_success(monkeypatch):
    class DummyResp:
        status_code = 200
        text = '<html><head><title>ok</title></head><body><p>content</p></body></html>'
        headers = {'Content-Type': 'text/html'}

        def raise_for_status(self):
            return None

    def fake_get(url, headers=None, timeout=None, allow_redirects=True):
        return DummyResp()

    monkeypatch.setattr(ji.requests, 'get', fake_get)
    soup = ji._fetch_job_soup('https://example.com')
    assert 'content' in soup.get_text()


def test_fetch_job_soup_proxy_fallback(monkeypatch):
    # First attempts raise HTTPError 403, then proxy succeeds
    class Resp403:
        status_code = 403
        headers = {}
        text = ''
        def raise_for_status(self):
            raise requests.HTTPError(response=type('R', (), {'status_code': 403})())

    class ProxyResp:
        status_code = 200
        text = '<html><body><p>proxied</p></body></html>'
        headers = {'Content-Type': 'text/html'}
        def raise_for_status(self):
            return None

    calls = {'n': 0}

    def fake_get(url, headers=None, timeout=None, allow_redirects=True):
        calls['n'] += 1
        if 'r.jina.ai' not in url and calls['n'] <= 2:
            return Resp403()
        return ProxyResp()

    monkeypatch.setattr(ji.requests, 'get', fake_get)
    soup = ji._fetch_job_soup('https://blocked.example.com')
    assert 'proxied' in soup.get_text()


def test_extract_generic_job_from_jsonld(monkeypatch):
    # Build a simple JSON-LD JobPosting
    job = {
        '@type': 'JobPosting',
        'title': 'Test Engineer',
        'description': 'Do things',
        'hiringOrganization': {'name': 'Acme'},
        'employmentType': 'Full-time',
        'baseSalary': {'value': {'value': 120000}, 'currency': 'USD'},
    }
    soup = make_soup_with_jsonld(job)

    def fake_fetch(url, allow_proxy=True, depth=0, visited=None):
        return soup, url

    monkeypatch.setattr(ji, '_fetch_job_document', fake_fetch)
    res = ji.extract_generic_job('https://example.com/job')
    assert res.status == ji.JobImportResult.STATUS_SUCCESS
    assert res.data.get('title') == 'Test Engineer'
    assert res.data.get('company_name') == 'Acme'


def test_import_job_from_url_fallback(monkeypatch):
    # Simulate LinkedIn extractor failing and generic extractor succeeding
    def fake_linkedin(url):
        return ji.JobImportResult(ji.JobImportResult.STATUS_FAILED, error='fail')

    def fake_generic(url):
        return ji.JobImportResult(ji.JobImportResult.STATUS_SUCCESS, data={'title': 'G'}, fields_extracted=['title'])

    monkeypatch.setattr(ji, 'extract_linkedin_job', fake_linkedin)
    monkeypatch.setattr(ji, 'extract_generic_job', fake_generic)
    res = ji.import_job_from_url('https://www.linkedin.com/jobs/view/1')
    assert res.status == ji.JobImportResult.STATUS_SUCCESS
