"""Utilities for Gmail API integration (UC-113)"""

import logging
import requests
import base64
import re
import time
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from django.conf import settings
from django.utils import timezone
from core import google_import
from core.api_monitoring import track_api_call, get_or_create_service, SERVICE_GMAIL

logger = logging.getLogger(__name__)

GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1'

GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'openid',
    'email',
    'profile',
]


class GmailAPIError(RuntimeError):
    """Raised when Gmail API operations fail"""
    pass


class GmailRateLimitError(GmailAPIError):
    """Raised when Gmail API rate limit is exceeded"""
    def __init__(self, message, retry_after=None):
        super().__init__(message)
        self.retry_after = retry_after


class GmailAuthError(GmailAPIError):
    """Raised when Gmail API authentication fails"""
    pass


def build_gmail_auth_url(redirect_uri, state=None):
    """Build OAuth URL for Gmail read-only access"""
    return google_import.build_google_auth_url(
        redirect_uri=redirect_uri,
        state=state,
        scopes=GMAIL_SCOPES,
        prompt='consent'
    )


def refresh_gmail_token(integration):
    """Refresh access token for Gmail integration"""
    if not integration.refresh_token:
        raise GmailAPIError('Missing refresh token')
    
    tokens = google_import.refresh_access_token(integration.refresh_token)
    new_token = tokens.get('access_token')
    if not new_token:
        raise GmailAPIError('Failed to refresh token')
    
    expires_in = tokens.get('expires_in', 3600)
    integration.access_token = new_token
    integration.token_expires_at = timezone.now() + timedelta(seconds=int(expires_in))
    integration.status = 'connected'
    integration.last_error = ''
    integration.save(update_fields=['access_token', 'token_expires_at', 'status', 'last_error', 'updated_at'])
    
    return new_token


def ensure_valid_token(integration):
    """Ensure integration has valid access token"""
    if integration.access_token and integration.token_expires_at:
        if integration.token_expires_at > timezone.now() + timedelta(minutes=5):
            return integration.access_token
    
    return refresh_gmail_token(integration)


def fetch_messages(access_token, query='', max_results=50, page_token=None, max_retries=3):
    """Fetch messages from Gmail API with retry logic for rate limits"""
    url = f"{GMAIL_API_BASE}/users/me/messages"
    headers = {'Authorization': f'Bearer {access_token}'}
    params = {
        'q': query,
        'maxResults': max_results,
    }
    if page_token:
        params['pageToken'] = page_token
    
    for attempt in range(max_retries):
        try:
            service = get_or_create_service(SERVICE_GMAIL, 'Gmail API')
            with track_api_call(service, endpoint='/users/me/messages', method='GET'):
                resp = requests.get(url, headers=headers, params=params, timeout=15)
            
            # Handle authentication errors
            if resp.status_code == 401:
                logger.error('Gmail API authentication failed: token may be expired or invalid')
                raise GmailAuthError('Authentication failed. Please reconnect your Gmail account.')
            
            # Handle rate limiting
            if resp.status_code == 429:
                retry_after = int(resp.headers.get('Retry-After', 60))
                logger.warning(f'Gmail API rate limit hit. Retry after {retry_after} seconds')
                
                if attempt < max_retries - 1:
                    time.sleep(retry_after)
                    continue
                else:
                    raise GmailRateLimitError(
                        f'Rate limit exceeded. Try again in {retry_after} seconds.',
                        retry_after=retry_after
                    )
            
            # Handle other client errors
            if resp.status_code == 403:
                error_data = resp.json() if resp.content else {}
                error_message = error_data.get('error', {}).get('message', 'Permission denied')
                logger.error(f'Gmail API permission error: {error_message}')
                raise GmailAPIError(f'Gmail API permission error: {error_message}')
            
            # Handle server errors with exponential backoff
            if resp.status_code >= 500:
                if attempt < max_retries - 1:
                    delay = (2 ** attempt) * 1  # Exponential backoff: 1s, 2s, 4s
                    logger.warning(f'Gmail API server error {resp.status_code}. Retrying in {delay}s...')
                    time.sleep(delay)
                    continue
                else:
                    raise GmailAPIError(f'Gmail API server error: {resp.status_code}')
            
            # Success
            if resp.status_code == 200:
                return resp.json()
            
            # Other errors
            raise GmailAPIError(f"Gmail API returned {resp.status_code}: {resp.text[:500]}")
            
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                logger.warning(f'Gmail API timeout. Retrying... (attempt {attempt + 1}/{max_retries})')
                time.sleep(2 ** attempt)
                continue
            else:
                raise GmailAPIError('Gmail API request timed out after multiple retries')
        
        except requests.exceptions.RequestException as e:
            logger.error(f'Gmail API request failed: {e}')
            raise GmailAPIError(f'Network error: {str(e)}')
    
    raise GmailAPIError('Failed to fetch messages after maximum retries')


def get_message_detail(access_token, message_id, max_retries=3):
    """Get full message details with retry logic"""
    url = f"{GMAIL_API_BASE}/users/me/messages/{message_id}"
    headers = {'Authorization': f'Bearer {access_token}'}
    params = {'format': 'full'}
    
    for attempt in range(max_retries):
        try:
            service = get_or_create_service(SERVICE_GMAIL, 'Gmail API')
            with track_api_call(service, endpoint=f'/users/me/messages/{message_id}', method='GET'):
                resp = requests.get(url, headers=headers, params=params, timeout=10)
            
            # Handle authentication errors
            if resp.status_code == 401:
                raise GmailAuthError('Authentication failed. Please reconnect your Gmail account.')
            
            # Handle rate limiting
            if resp.status_code == 429:
                retry_after = int(resp.headers.get('Retry-After', 60))
                if attempt < max_retries - 1:
                    logger.warning(f'Rate limit hit for message {message_id}. Waiting {retry_after}s...')
                    time.sleep(retry_after)
                    continue
                else:
                    raise GmailRateLimitError(
                        f'Rate limit exceeded. Try again in {retry_after} seconds.',
                        retry_after=retry_after
                    )
            
            # Handle not found
            if resp.status_code == 404:
                logger.warning(f'Message {message_id} not found')
                raise GmailAPIError(f'Message not found: {message_id}')
            
            # Handle server errors with exponential backoff
            if resp.status_code >= 500:
                if attempt < max_retries - 1:
                    delay = (2 ** attempt) * 1
                    logger.warning(f'Server error fetching message {message_id}. Retrying in {delay}s...')
                    time.sleep(delay)
                    continue
                else:
                    raise GmailAPIError(f'Server error: {resp.status_code}')
            
            # Success
            if resp.status_code == 200:
                return resp.json()
            
            raise GmailAPIError(f"Failed to fetch message: {resp.status_code}")
            
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                logger.warning(f'Timeout fetching message {message_id}. Retrying...')
                time.sleep(2 ** attempt)
                continue
            else:
                raise GmailAPIError('Request timed out after multiple retries')
        
        except requests.exceptions.RequestException as e:
            logger.error(f'Request failed for message {message_id}: {e}')
            raise GmailAPIError(f'Network error: {str(e)}')
    
    raise GmailAPIError('Failed to get message after maximum retries')


def parse_email_headers(message_data):
    """Extract key headers from Gmail message"""
    headers = {}
    payload = message_data.get('payload', {})
    for header in payload.get('headers', []):
        name = header.get('name', '').lower()
        value = header.get('value', '')
        if name in ['from', 'to', 'subject', 'date']:
            headers[name] = value
    
    return headers


def extract_email_body(message_data):
    """Extract plain text body from Gmail message"""
    payload = message_data.get('payload', {})
    
    # Try to get body from parts
    parts = payload.get('parts', [])
    for part in parts:
        if part.get('mimeType') == 'text/plain':
            body_data = part.get('body', {}).get('data', '')
            if body_data:
                try:
                    return base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')
                except Exception as e:
                    logger.warning(f"Failed to decode part body: {e}")
    
    # Try direct body
    body_data = payload.get('body', {}).get('data', '')
    if body_data:
        try:
            return base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')
        except Exception as e:
            logger.warning(f"Failed to decode direct body: {e}")
    
    return ''


def extract_email_from_header(from_header):
    """Extract email address from From header"""
    match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', from_header)
    if match:
        return match.group(0)
    return from_header


def extract_name_from_header(from_header):
    """Extract sender name from From header"""
    # Pattern: "Name" <email@example.com> or Name <email@example.com>
    match = re.match(r'^"?([^"<]+)"?\s*<', from_header)
    if match:
        return match.group(1).strip()
    
    # If no angle brackets, might just be an email
    if '@' in from_header and '<' not in from_header:
        return ''
    
    return from_header.split('<')[0].strip().strip('"')


def parse_gmail_date(date_str):
    """Parse Gmail date string to datetime"""
    if not date_str:
        return timezone.now()
    
    try:
        dt = parsedate_to_datetime(date_str)
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.utc)
        return dt
    except Exception as e:
        logger.warning(f"Failed to parse date '{date_str}': {e}")
        return timezone.now()


def classify_email_type(subject, body, sender):
    """
    Classify email type based on content
    Returns: (email_type, confidence_score, suggested_status)
    """
    subject_lower = subject.lower()
    body_lower = body[:2000].lower()  # Only check first 2000 chars for performance
    
    # Patterns for classification
    patterns = {
        'interview_invitation': {
            'keywords': ['interview', 'schedule', 'meet', 'video call', 'phone screen', 'zoom', 'teams meeting'],
            'status': 'phone',
            'confidence': 0.9
        },
        'rejection': {
            'keywords': ['unfortunately', 'not moving forward', 'other candidates', 'position has been filled', 'decided not to move forward', 'pursuing other candidates'],
            'status': 'rejected',
            'confidence': 0.95
        },
        'offer': {
            'keywords': ['offer letter', 'pleased to offer', 'compensation package', 'start date', 'employment offer', 'joining bonus'],
            'status': 'offer',
            'confidence': 0.95
        },
        'acknowledgment': {
            'keywords': ['received your application', 'thank you for applying', 'application confirmation', 'application received'],
            'status': 'applied',
            'confidence': 0.85
        },
        'recruiter_outreach': {
            'keywords': ['opportunity', 'position at', 'recruiting', 'career opportunity', 'interested in speaking', 'great fit for'],
            'status': 'interested',
            'confidence': 0.7
        },
    }
    
    # Check each pattern
    for email_type, config in patterns.items():
        keyword_count = sum(1 for kw in config['keywords'] if kw in subject_lower or kw in body_lower)
        if keyword_count >= 2:
            # Adjust confidence based on how many keywords matched
            base_confidence = config['confidence']
            keyword_bonus = min(0.05 * (keyword_count - 2), 0.1)  # Up to +0.1 for extra matches
            adjusted_confidence = min(base_confidence + keyword_bonus, 0.99)
            return email_type, adjusted_confidence, config['status']
    
    # Check for single high-confidence keywords (reduced confidence for single matches)
    if 'interview' in subject_lower:
        # Higher confidence if in subject
        return 'interview_invitation', 0.75, 'phone'
    
    if 'interview' in body_lower:
        return 'interview_invitation', 0.65, 'phone'
    
    if 'offer' in subject_lower and any(word in subject_lower for word in ['job', 'position', 'employment']):
        return 'offer', 0.80, 'offer'
    
    if 'reject' in subject_lower or 'regret' in subject_lower:
        return 'rejection', 0.75, 'rejected'
    
    if 'reject' in body_lower or 'regret' in body_lower:
        return 'rejection', 0.60, 'rejected'
    
    # Low confidence catch-all for potential application emails
    if any(word in subject_lower + body_lower for word in ['application', 'applied', 'resume', 'cv', 'candidate']):
        return 'other', 0.45, ''
    
    return 'other', 0.25, ''
