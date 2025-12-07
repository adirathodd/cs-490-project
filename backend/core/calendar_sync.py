"""Utilities to synchronize interviews with external calendars (UC-079)."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple

import requests
from django.utils import timezone
from django.conf import settings

from core.models import CalendarIntegration
from core import google_import
from core.api_monitoring import track_api_call, get_or_create_service, SERVICE_GOOGLE_CALENDAR

logger = logging.getLogger(__name__)

GOOGLE_CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars'


class CalendarSyncError(RuntimeError):
    """Raised when pushing events to an external calendar fails."""


def _get_google_integration(candidate) -> Optional[CalendarIntegration]:
    return CalendarIntegration.objects.filter(
        candidate=candidate,
        provider='google',
        sync_enabled=True,
        status__in=['connected', 'pending']
    ).first()


def _mark_integration_error(integration: CalendarIntegration, message: str):
    integration.status = 'error'
    integration.last_error = message[:500]
    integration.save(update_fields=['status', 'last_error', 'updated_at'])


def _ensure_google_access_token(integration: CalendarIntegration) -> str:
    token = integration.access_token or ''
    now = timezone.now()
    if token and integration.token_expires_at and integration.token_expires_at - timedelta(minutes=2) > now:
        return token
    if not integration.refresh_token:
        raise CalendarSyncError('Missing refresh token. Please reconnect Google Calendar.')
    tokens = google_import.refresh_access_token(integration.refresh_token)
    new_token = tokens.get('access_token')
    if not new_token:
        raise CalendarSyncError('Google did not return a new access token. Reconnect your account.')
    expires_in = tokens.get('expires_in') or 3600
    integration.access_token = new_token
    integration.token_expires_at = now + timedelta(seconds=int(expires_in))
    integration.status = 'connected'
    integration.last_error = ''
    integration.save(update_fields=['access_token', 'token_expires_at', 'status', 'last_error', 'updated_at'])
    return new_token


def _format_datetime(dt):
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return {
        'dateTime': dt.isoformat(),
        'timeZone': str(dt.tzinfo or timezone.get_current_timezone()),
    }


def _build_event_payload(interview):
    event_meta = getattr(interview, 'event_metadata', None)
    job = interview.job
    summary = f"{job.title} Interview"
    description_parts = [
        f"Company: {job.company_name}",
        f"Interview type: {interview.get_interview_type_display()}",
    ]
    if interview.interviewer_name:
        description_parts.append(f"Interviewer: {interview.interviewer_name}")
    if interview.meeting_link:
        description_parts.append(f"Video link: {interview.meeting_link}")
    if interview.location:
        description_parts.append(f"Location: {interview.location}")
    if event_meta and event_meta.logistics_notes:
        description_parts.append(f"Notes: {event_meta.logistics_notes}")
    if interview.questions_to_ask:
        description_parts.append('Questions to ask prepared in app.')

    reminders = [
        {'method': 'popup', 'minutes': 1440},
        {'method': 'popup', 'minutes': 120},
    ]

    payload = {
        'summary': summary,
        'description': '\n'.join(description_parts),
        'start': _format_datetime(interview.scheduled_at),
        'end': _format_datetime(interview.get_end_time()),
        'reminders': {
            'useDefault': False,
            'overrides': reminders,
        },
        'source': {
            'title': 'ATS for Candidates',
            'url': f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')}/dashboard",
        },
    }

    location_override = ''
    if event_meta:
        location_override = event_meta.location_override.strip()
    meeting_link = event_meta.video_conference_link if event_meta else ''

    location = location_override or interview.location or ''
    if location:
        payload['location'] = location
    if meeting_link and not interview.meeting_link:
        payload['description'] += f"\nVideo link: {meeting_link}"
    return payload


def sync_interview_event(interview):
    integration = _get_google_integration(interview.candidate)
    if not integration:
        return None

    event_meta = interview.ensure_event_metadata()
    try:
        access_token = _ensure_google_access_token(integration)
    except CalendarSyncError as exc:
        _mark_integration_error(integration, str(exc))
        if event_meta:
            event_meta.sync_status = 'failed'
            event_meta.save(update_fields=['sync_status', 'updated_at'])
        raise

    calendar_id = event_meta.external_calendar_id or 'primary'
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    }
    payload = _build_event_payload(interview)

    try:
        service = get_or_create_service(SERVICE_GOOGLE_CALENDAR, 'Google Calendar')
        if event_meta.external_event_id:
            url = f"{GOOGLE_CAL_BASE}/{calendar_id}/events/{event_meta.external_event_id}"
            with track_api_call(service, endpoint=f'/calendars/{calendar_id}/events', method='PATCH'):
                resp = requests.patch(url, headers=headers, json=payload, params={'sendUpdates': 'none'}, timeout=15)
        else:
            url = f"{GOOGLE_CAL_BASE}/{calendar_id}/events"
            with track_api_call(service, endpoint=f'/calendars/{calendar_id}/events', method='POST'):
                resp = requests.post(url, headers=headers, json=payload, params={'sendUpdates': 'none'}, timeout=15)
        if resp.status_code >= 400:
            raise CalendarSyncError(f"Google Calendar API returned {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
    except requests.RequestException as exc:
        raise CalendarSyncError(f"Network error talking to Google Calendar: {exc}") from exc

    event_meta.external_event_id = data.get('id', event_meta.external_event_id)
    event_meta.external_event_link = data.get('htmlLink', '')
    event_meta.external_calendar_id = data.get('organizer', {}).get('email', calendar_id)
    event_meta.calendar_provider = 'google'
    event_meta.sync_enabled = True
    event_meta.sync_status = 'synced'
    event_meta.last_synced_at = timezone.now()
    event_meta.save(update_fields=[
        'external_event_id',
        'external_event_link',
        'external_calendar_id',
        'calendar_provider',
        'sync_enabled',
        'sync_status',
        'last_synced_at',
        'updated_at',
    ])

    integration.status = 'connected'
    integration.last_synced_at = timezone.now()
    integration.last_error = ''
    integration.save(update_fields=['status', 'last_synced_at', 'last_error', 'updated_at'])
    return data


def remove_interview_event(interview):
    integration = _get_google_integration(interview.candidate)
    event_meta = getattr(interview, 'event_metadata', None)
    if not integration or not event_meta or not event_meta.external_event_id:
        return

    try:
        access_token = _ensure_google_access_token(integration)
    except CalendarSyncError as exc:
        logger.warning('Could not refresh Google token during delete: %s', exc)
        return

    calendar_id = event_meta.external_calendar_id or 'primary'
    url = f"{GOOGLE_CAL_BASE}/{calendar_id}/events/{event_meta.external_event_id}"
    headers = {'Authorization': f'Bearer {access_token}'}
    try:
        service = get_or_create_service(SERVICE_GOOGLE_CALENDAR, 'Google Calendar')
        with track_api_call(service, endpoint=f'/calendars/{calendar_id}/events', method='DELETE'):
            resp = requests.delete(url, headers=headers, params={'sendUpdates': 'none'}, timeout=15)
        if resp.status_code >= 400 and resp.status_code != 404:
            raise CalendarSyncError(f"Failed to delete Google event ({resp.status_code}): {resp.text[:200]}")
    except requests.RequestException as exc:
        logger.warning('Network error deleting Google event: %s', exc)
        return

    event_meta.external_event_id = ''
    event_meta.external_event_link = ''
    event_meta.sync_status = 'not_synced'
    event_meta.save(update_fields=['external_event_id', 'external_event_link', 'sync_status', 'updated_at'])


def _serialize_time_bound(dt):
    if dt is None:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt.isoformat()


def _extract_google_datetime(payload: Optional[dict]) -> Tuple[Optional[str], bool]:
    if not payload:
        return None, False
    if payload.get('dateTime'):
        return payload['dateTime'], False
    if payload.get('date'):
        # All-day events return only the date (exclusive end). Normalize to midnight UTC.
        return f"{payload['date']}T00:00:00Z", True
    return None, False


def _normalize_google_event(item: dict, integration: CalendarIntegration) -> dict:
    start, is_all_day = _extract_google_datetime(item.get('start'))
    end, _ = _extract_google_datetime(item.get('end'))
    hangout_link = item.get('hangoutLink') or ''
    if not hangout_link:
        conference = (item.get('conferenceData') or {}).get('entryPoints') or []
        if conference:
            hangout_link = conference[0].get('uri') or ''

    return {
        'id': item.get('id'),
        'integration_id': integration.id,
        'external_account_id': integration.external_account_id,
        'external_email': integration.external_email,
        'summary': item.get('summary') or '(Busy)',
        'description': item.get('description') or '',
        'location': item.get('location') or '',
        'hangout_link': hangout_link,
        'html_link': item.get('htmlLink'),
        'start': start,
        'end': end,
        'all_day': is_all_day,
        'attendees': item.get('attendees', []),
        'organizer': item.get('organizer', {}),
        'status': item.get('status'),
        'updated': item.get('updated'),
    }


def list_google_events(
    integration: CalendarIntegration,
    *,
    time_min: Optional[datetime] = None,
    time_max: Optional[datetime] = None,
    max_results: int = 200,
):
    """Fetch upcoming events from the user's Google Calendar."""

    if max_results <= 0:
        return []

    access_token = _ensure_google_access_token(integration)
    calendar_id = integration.external_email or 'primary'
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    }

    params = {
        'singleEvents': 'true',
        'orderBy': 'startTime',
        'showDeleted': 'false',
        'maxResults': min(max_results, 250),
    }
    if time_min:
        params['timeMin'] = _serialize_time_bound(time_min)
    if time_max:
        params['timeMax'] = _serialize_time_bound(time_max)

    events = []
    page_params = params.copy()
    while True:
        try:
            service = get_or_create_service(SERVICE_GOOGLE_CALENDAR, 'Google Calendar')
            with track_api_call(service, endpoint=f'/calendars/{calendar_id}/events', method='GET'):
                resp = requests.get(
                    f"{GOOGLE_CAL_BASE}/{calendar_id}/events",
                    headers=headers,
                    params=page_params,
                    timeout=15,
                )
        except requests.RequestException as exc:
            raise CalendarSyncError(f"Network error talking to Google Calendar: {exc}") from exc

        if resp.status_code >= 400:
            raise CalendarSyncError(f"Google Calendar API returned {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        items = data.get('items', [])
        for item in items:
            events.append(_normalize_google_event(item, integration))
            if len(events) >= max_results:
                break

        if len(events) >= max_results:
            break

        next_token = data.get('nextPageToken')
        if not next_token:
            break
        page_params = page_params.copy()
        page_params['pageToken'] = next_token
        page_params['maxResults'] = min(max_results - len(events), 250)

    integration.last_synced_at = timezone.now()
    integration.save(update_fields=['last_synced_at', 'updated_at'])
    return events