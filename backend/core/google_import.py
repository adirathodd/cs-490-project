"""Helpers to interact with Google People API for importing contacts.
This module provides minimal implementations used during the import flow.
Note: In production, use google-auth libraries and securely store refresh tokens.
"""
import logging
import requests
from django.conf import settings
from core.api_monitoring import track_api_call, get_or_create_service


class GoogleOAuthConfigError(RuntimeError):
    """Raised when required Google OAuth credentials are missing."""

    def __init__(self, missing_vars):
        if isinstance(missing_vars, str):
            message = missing_vars
        else:
            joined = ', '.join(missing_vars)
            message = f"Google import is not configured. Set {joined} in backend/.env (or the container environment)."
        super().__init__(message)
        self.missing_vars = missing_vars


class GooglePeopleAPIError(RuntimeError):
    """Raised when Google People API rejects a request with actionable info."""

    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code

logger = logging.getLogger(__name__)

GOOGLE_OAUTH_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_OAUTH_TOKEN = 'https://oauth2.googleapis.com/token'
GOOGLE_PEOPLE_CONNECTIONS = 'https://people.googleapis.com/v1/people/me/connections'

PEOPLE_SCOPES = [
    'https://www.googleapis.com/auth/contacts.readonly',
    'openid',
    'email',
    'profile',
]

CALENDAR_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar',
    'openid',
    'email',
    'profile',
]


def _require_client_id():
    client_id = (settings.GOOGLE_CLIENT_ID or '').strip()
    if not client_id:
        raise GoogleOAuthConfigError(['GOOGLE_CLIENT_ID'])
    return client_id


def _require_client_secret():
    secret = (settings.GOOGLE_CLIENT_SECRET or '').strip()
    if not secret:
        raise GoogleOAuthConfigError(['GOOGLE_CLIENT_SECRET'])
    return secret


def build_google_auth_url(redirect_uri, state=None, scopes=None, prompt='consent'):
    client_id = _require_client_id()
    scope_list = scopes or PEOPLE_SCOPES
    params = {
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': ' '.join(scope_list),
        'access_type': 'offline',
        'prompt': prompt,
    }
    if state:
        params['state'] = state
    from urllib.parse import urlencode
    return GOOGLE_OAUTH_AUTHORIZE + '?' + urlencode(params)


def exchange_code_for_tokens(code, redirect_uri):
    client_id = _require_client_id()
    client_secret = _require_client_secret()
    payload = {
        'code': code,
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': redirect_uri,
        'grant_type': 'authorization_code',
    }
    service = get_or_create_service('google_oauth', 'Google OAuth')
    with track_api_call(service, endpoint='/token', method='POST'):
        resp = requests.post(GOOGLE_OAUTH_TOKEN, data=payload, timeout=10)
        resp.raise_for_status()
    return resp.json()


def refresh_access_token(refresh_token):
    client_id = _require_client_id()
    client_secret = _require_client_secret()
    payload = {
        'refresh_token': refresh_token,
        'client_id': client_id,
        'client_secret': client_secret,
        'grant_type': 'refresh_token',
    }
    service = get_or_create_service('google_oauth', 'Google OAuth')
    with track_api_call(service, endpoint='/token', method='POST'):
        resp = requests.post(GOOGLE_OAUTH_TOKEN, data=payload, timeout=10)
        resp.raise_for_status()
    return resp.json()


def fetch_user_profile(access_token):
    headers = {'Authorization': f'Bearer {access_token}'}
    service = get_or_create_service('google_userinfo', 'Google UserInfo')
    with track_api_call(service, endpoint='/oauth2/v2/userinfo', method='GET'):
        resp = requests.get('https://www.googleapis.com/oauth2/v2/userinfo', headers=headers, timeout=10)
        resp.raise_for_status()
    return resp.json()


def fetch_connections(access_token, page_size=200):
    headers = {'Authorization': f'Bearer {access_token}'}
    params = {
        'personFields': 'names,emailAddresses,phoneNumbers,organizations,photos,metadata',
        'pageSize': page_size,
    }
    results = []
    url = GOOGLE_PEOPLE_CONNECTIONS
    while url:
        service = get_or_create_service('google_contacts', 'Google Contacts')
        with track_api_call(service, endpoint='/v1/people/me/connections', method='GET'):
            resp = requests.get(url, headers=headers, params=params, timeout=15)
        if resp.status_code >= 400:
            logger.error('People API returned %s: %s', resp.status_code, resp.text)
            raise GooglePeopleAPIError(_format_people_api_error(resp), status_code=resp.status_code)
        data = resp.json()
        connections = data.get('connections', [])
        results.extend(connections)
        next_token = data.get('nextPageToken')
        if not next_token:
            break
        params['pageToken'] = next_token
        url = GOOGLE_PEOPLE_CONNECTIONS
    return results


def _format_people_api_error(resp):
    """Return a human friendly error the frontend can show directly."""
    detail = ''
    try:
        payload = resp.json()
    except ValueError:
        payload = None

    if isinstance(payload, dict):
        error_obj = payload.get('error') if isinstance(payload.get('error'), dict) else None
        detail = (error_obj or {}).get('message') or payload.get('error_description') or payload.get('message', '')
    if not detail:
        detail = (resp.text or '').strip()

    detail = detail.strip()

    if resp.status_code == 403:
        base = (
            'Google People API returned 403 (Forbidden). Enable the Google People API for your Cloud project and '
            'make sure the Google account authorizing the import has been added as a test user on the OAuth consent '
            'screen (unverified apps only work for test users) and granted access to contacts.'
        )
    elif resp.status_code == 401:
        base = 'Google People API rejected the request (401 Unauthorized). Try reconnecting your Google account.'
    else:
        base = f'Google People API request failed with status {resp.status_code}.'

    if detail:
        return f"{base} Details: {detail}"
    return base


def normalize_person(person):
    """Return normalized dict with primary fields: resourceName, names, emails, phones, orgs, photo"""
    out = {
        'resourceName': person.get('resourceName'),
        'names': [],
        'emails': [],
        'phones': [],
        'organizations': [],
        'photo': None,
    }
    for n in person.get('names', []) or []:
        out['names'].append({'displayName': n.get('displayName'), 'givenName': n.get('givenName'), 'familyName': n.get('familyName')})
    for e in person.get('emailAddresses', []) or []:
        out['emails'].append({'value': e.get('value')})
    for p in person.get('phoneNumbers', []) or []:
        out['phones'].append({'value': p.get('value')})
    for o in person.get('organizations', []) or []:
        out['organizations'].append({'name': o.get('name'), 'title': o.get('title')})
    photos = person.get('photos', []) or []
    if photos:
        out['photo'] = photos[0].get('url')
    return out


def fetch_and_normalize(access_token):
    raw = fetch_connections(access_token)
    normalized = [normalize_person(p) for p in raw]
    return normalized
