import json
from bs4 import BeautifulSoup

import pytest

from core import job_import_utils as ji


def test_clean_text_empty_and_whitespace():
    assert ji.clean_text(None) == ''
    assert ji.clean_text('   ') == ''
    assert ji.clean_text('\n  hello   world \t') == 'hello world'


def test_detect_job_board():
    assert ji.detect_job_board('https://www.linkedin.com/jobs/view/123') == 'linkedin'
    assert ji.detect_job_board('https://indeed.com/viewjob?jk=abc') == 'indeed'
    assert ji.detect_job_board('https://glassdoor.com/job-listing/foo') == 'glassdoor'
    assert ji.detect_job_board('https://example.com') is None


def test_normalize_and_proxy_url():
    url = 'HTTP://Example.COM/some/path?x=1'
    norm = ji._normalize_url(url)
    assert norm.startswith('http://example.com')
    proxy = ji._proxy_reader_url(url)
    assert proxy.startswith('https://r.jina.ai/')
    # proxy should contain the normalized path
    assert '/some/path' in proxy


@pytest.mark.parametrize(
    'text,expected',
    [
        ('Full-Time Software Engineer', 'ft'),
        ('part time role', 'pt'),
        ('This is a contract position', 'contract'),
        ('Intern', 'intern'),
        ('temporary gig', 'temp'),
        ('nothing matched', None),
        ('', None),
    ],
)
def test_infer_job_type(text, expected):
    assert ji._infer_job_type(text) == expected


def test_load_json_ld_objects_yields_dicts():
    # build a simple soup containing JSON-LD scripts
    data1 = {'@type': 'JobPosting', 'title': 'Test Job'}
    data2 = {'@type': ['Thing', 'JobPosting'], 'hiringOrganization': {'name': 'Acme'}}
    html = f"""
    <html><head>
    <script type="application/ld+json">{json.dumps(data1)}</script>
    <script type="application/ld+json">{json.dumps(data2)}</script>
    </head><body></body></html>
    """
    soup = BeautifulSoup(html, 'html.parser')
    objs = list(ji._load_json_ld_objects(soup))
    # ensure both objects are present
    assert any(o.get('title') == 'Test Job' for o in objs)
    assert any(o.get('hiringOrganization') for o in objs)


def test_import_job_from_url_invalid_inputs():
    # None and empty string should return failed status
    res = ji.import_job_from_url(None)
    assert res.status == ji.JobImportResult.STATUS_FAILED
    res2 = ji.import_job_from_url('not-a-url')
    assert res2.status == ji.JobImportResult.STATUS_FAILED
