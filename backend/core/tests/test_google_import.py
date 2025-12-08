import json
import types
import pytest
from django.conf import settings

from core import google_import


def test_build_google_auth_url(monkeypatch):
    monkeypatch.setattr(settings, 'GOOGLE_CLIENT_ID', 'test-client')
    url = google_import.build_google_auth_url('https://example.com/cb', state='s123')
    assert 'test-client' in url
    assert 'redirect_uri=https%3A%2F%2Fexample.com%2Fcb' in url
    assert 'state=s123' in url


def test_build_google_auth_url_requires_client_id(monkeypatch):
    monkeypatch.setattr(settings, 'GOOGLE_CLIENT_ID', '')
    with pytest.raises(google_import.GoogleOAuthConfigError):
        google_import.build_google_auth_url('https://example.com/cb')


class DummyResp:
    def __init__(self, data, status_code=200, text=None):
        self._data = data
        self.status_code = status_code
        if text is None and data is not None:
            try:
                text = json.dumps(data)
            except TypeError:
                text = str(data)
        self.text = text or ''

    def json(self):
        return self._data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception('http error')


@pytest.mark.django_db
def test_exchange_code_for_tokens(monkeypatch):
    def fake_post(url, data, timeout):
        assert url == google_import.GOOGLE_OAUTH_TOKEN
        return DummyResp({'access_token': 'x', 'refresh_token': 'r'})

    monkeypatch.setattr(google_import.requests, 'post', fake_post)
    monkeypatch.setattr(settings, 'GOOGLE_CLIENT_ID', 'abc')
    monkeypatch.setattr(settings, 'GOOGLE_CLIENT_SECRET', 'def')
    res = google_import.exchange_code_for_tokens('code123', 'https://cb')
    assert res['access_token'] == 'x'


def test_exchange_code_for_tokens_requires_secret(monkeypatch):
    monkeypatch.setattr(settings, 'GOOGLE_CLIENT_ID', 'abc')
    monkeypatch.setattr(settings, 'GOOGLE_CLIENT_SECRET', '')
    with pytest.raises(google_import.GoogleOAuthConfigError):
        google_import.exchange_code_for_tokens('code123', 'https://cb')


@pytest.mark.django_db
def test_fetch_connections_pagination(monkeypatch):
    # simulate two pages
    calls = {'n': 0}

    def fake_get(url, headers, params, timeout):
        calls['n'] += 1
        if calls['n'] == 1:
            return DummyResp({'connections': [{'resourceName': 'r1'}], 'nextPageToken': 't1'})
        return DummyResp({'connections': [{'resourceName': 'r2'}]})

    monkeypatch.setattr(google_import.requests, 'get', fake_get)
    res = google_import.fetch_connections('token1', page_size=1)
    assert isinstance(res, list)
    assert any(r.get('resourceName') == 'r1' for r in res)
    assert any(r.get('resourceName') == 'r2' for r in res)


@pytest.mark.django_db
def test_fetch_connections_raises_user_friendly_error_on_403(monkeypatch):
    def fake_get(url, headers, params, timeout):
        data = {'error': {'message': 'Google People API has not been used in project 12345 before or it is disabled.'}}
        return DummyResp(data, status_code=403)

    monkeypatch.setattr(google_import.requests, 'get', fake_get)

    with pytest.raises(google_import.GooglePeopleAPIError) as exc:
        google_import.fetch_connections('token1')

    msg = str(exc.value)
    assert 'Google People API returned 403' in msg
    assert 'Enable the Google People API' in msg


def test_normalize_person():
    person = {
        'resourceName': 'people/1',
        'names': [{'displayName': 'Alice A', 'givenName': 'Alice', 'familyName': 'A'}],
        'emailAddresses': [{'value': 'a@example.com'}],
        'phoneNumbers': [{'value': '+1'}],
        'organizations': [{'name': 'Org', 'title': 'Engineer'}],
        'photos': [{'url': 'http://img'}]
    }
    n = google_import.normalize_person(person)
    assert n['resourceName'] == 'people/1'
    assert n['names'][0]['displayName'] == 'Alice A'
    assert n['emails'][0]['value'] == 'a@example.com'
    assert n['photo'] == 'http://img'
