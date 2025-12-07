import logging
import requests
from urllib.parse import urlencode
from core.api_monitoring import track_api_call, get_or_create_service

logger = logging.getLogger(__name__)


def fetch_remotive_jobs(search=None, category=None, location=None, limit=200):
    """Fetch jobs from Remotive public API.

    Returns list of job dicts.
    """
    try:
        params = {}
        if search:
            params['search'] = search
        if category:
            params['category'] = category
        url = 'https://remotive.io/api/remote-jobs'
        if params:
            url = f"{url}?{urlencode(params)}"
        service = get_or_create_service('market_data_remotive', 'Remotive Jobs API')
        with track_api_call(service, endpoint='/api/remote-jobs', method='GET'):
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
        data = resp.json()
        jobs = data.get('jobs') or []
        return jobs[:limit]
    except Exception as e:
        logger.exception('remotive fetch failed: %s', e)
        return []


def fetch_arbeitnow_jobs(search=None, location=None, limit=200):
    """Fetch jobs from ArbeitNow public API.

    Returns list of job dicts.
    """
    try:
        url = 'https://www.arbeitnow.com/api/job-board-api'
        params = {}
        if search:
            params['search'] = search
        if location:
            params['location'] = location
        service = get_or_create_service('market_data_arbeitnow', 'ArbeitNow Jobs API')
        with track_api_call(service, endpoint='/api/job-board-api', method='GET'):
            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
        data = resp.json()
        # API returns data under 'data' key
        jobs = data.get('data') or []
        return jobs[:limit]
    except Exception as e:
        logger.exception('arbeitnow fetch failed: %s', e)
        return []


def aggregate_job_providers(search=None, category=None, location=None, limit=300):
    """Query available job providers and return combined job list."""
    jobs = []
    jobs += fetch_remotive_jobs(search=search, category=category, location=location, limit=limit)
    jobs += fetch_arbeitnow_jobs(search=search, location=location, limit=limit)
    # deduplicate by URL or title+company
    seen = set()
    deduped = []
    for j in jobs:
        key = (j.get('url') or j.get('job_url') or '') + '|' + (j.get('company_name') or j.get('company') or '') + '|' + (j.get('title') or j.get('job_title') or '')
        if key in seen:
            continue
        seen.add(key)
        deduped.append(j)
    return deduped
