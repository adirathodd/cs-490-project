"""Helpers to interact with Google People API for importing contacts.
This module provides minimal implementations used during the import flow.
Note: In production, use google-auth libraries and securely store refresh tokens.
"""
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

GOOGLE_OAUTH_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_OAUTH_TOKEN = 'https://oauth2.googleapis.com/token'
GOOGLE_PEOPLE_CONNECTIONS = 'https://people.googleapis.com/v1/people/me/connections'

SCOPES = [
    'https://www.googleapis.com/auth/contacts.readonly',
    'openid',
    'email',
    'profile',
]


def build_google_auth_url(redirect_uri, state=None):
    params = {
        'client_id': settings.GOOGLE_CLIENT_ID,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': ' '.join(SCOPES),
        'access_type': 'offline',
        'prompt': 'consent',
    }
    if state:
        params['state'] = state
    from urllib.parse import urlencode
    return GOOGLE_OAUTH_AUTHORIZE + '?' + urlencode(params)


def exchange_code_for_tokens(code, redirect_uri):
    payload = {
        'code': code,
        'client_id': settings.GOOGLE_CLIENT_ID,
        'client_secret': settings.GOOGLE_CLIENT_SECRET,
        'redirect_uri': redirect_uri,
        'grant_type': 'authorization_code',
    }
    resp = requests.post(GOOGLE_OAUTH_TOKEN, data=payload, timeout=10)
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
        resp = requests.get(url, headers=headers, params=params, timeout=15)
        if resp.status_code >= 400:
            logger.error('People API returned %s: %s', resp.status_code, resp.text)
            resp.raise_for_status()
        data = resp.json()
        connections = data.get('connections', [])
        results.extend(connections)
        next_token = data.get('nextPageToken')
        if not next_token:
            break
        params['pageToken'] = next_token
        url = GOOGLE_PEOPLE_CONNECTIONS
    return results


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
