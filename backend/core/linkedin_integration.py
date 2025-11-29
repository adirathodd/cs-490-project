"""
UC-089: LinkedIn OAuth and profile import functionality
Handles LinkedIn OAuth flow and profile data fetching
"""
import requests
import logging
from django.conf import settings
from typing import Dict, Optional
from urllib.parse import urlencode

logger = logging.getLogger(__name__)

LINKEDIN_OAUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
LINKEDIN_PROFILE_URL = 'https://api.linkedin.com/v2/me'
LINKEDIN_EMAIL_URL = 'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))'

LINKEDIN_SCOPES = ['r_liteprofile', 'r_emailaddress']


class LinkedInOAuthError(Exception):
    """LinkedIn OAuth-related errors"""
    pass


def build_linkedin_auth_url(redirect_uri: str, state: str) -> str:
    """
    Build LinkedIn OAuth authorization URL
    
    Args:
        redirect_uri: OAuth callback URL
        state: CSRF protection state token
    
    Returns:
        Complete authorization URL for LinkedIn OAuth
    
    Raises:
        LinkedInOAuthError: If LinkedIn client ID is not configured
    """
    client_id = getattr(settings, 'LINKEDIN_CLIENT_ID', None)
    if not client_id:
        raise LinkedInOAuthError('LINKEDIN_CLIENT_ID not configured in settings')
    
    params = {
        'response_type': 'code',
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'state': state,
        'scope': ' '.join(LINKEDIN_SCOPES)
    }
    
    return f"{LINKEDIN_OAUTH_URL}?{urlencode(params)}"


def exchange_code_for_tokens(code: str, redirect_uri: str) -> Dict[str, any]:
    """
    Exchange authorization code for access token
    
    Args:
        code: Authorization code from OAuth callback
        redirect_uri: Same redirect URI used in authorization
    
    Returns:
        Dict containing access_token, expires_in, and optionally refresh_token
    
    Raises:
        LinkedInOAuthError: If token exchange fails
    """
    client_id = getattr(settings, 'LINKEDIN_CLIENT_ID', None)
    client_secret = getattr(settings, 'LINKEDIN_CLIENT_SECRET', None)
    
    if not client_id or not client_secret:
        raise LinkedInOAuthError('LinkedIn OAuth credentials not configured in settings')
    
    payload = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirect_uri,
        'client_id': client_id,
        'client_secret': client_secret
    }
    
    try:
        response = requests.post(LINKEDIN_TOKEN_URL, data=payload, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"LinkedIn token exchange failed: {e}")
        raise LinkedInOAuthError(f'Token exchange failed: {str(e)}')


def fetch_linkedin_profile(access_token: str) -> Dict[str, any]:
    """
    Fetch basic LinkedIn profile information using access token
    
    Args:
        access_token: Valid LinkedIn OAuth access token
    
    Returns:
        Dict containing profile data (id, name, headline, email, profile_picture_url)
    
    Raises:
        LinkedInOAuthError: If profile fetch fails
    """
    headers = {'Authorization': f'Bearer {access_token}'}
    
    try:
        # Fetch basic profile
        profile_response = requests.get(LINKEDIN_PROFILE_URL, headers=headers, timeout=10)
        profile_response.raise_for_status()
        profile_data = profile_response.json()
        
        # Fetch email address
        email = None
        try:
            email_response = requests.get(LINKEDIN_EMAIL_URL, headers=headers, timeout=10)
            if email_response.status_code == 200:
                email_data = email_response.json()
                elements = email_data.get('elements', [])
                if elements:
                    email = elements[0].get('handle~', {}).get('emailAddress')
        except Exception as e:
            logger.warning(f"Failed to fetch LinkedIn email: {e}")
        
        # Extract profile picture URL
        profile_picture_url = None
        profile_picture = profile_data.get('profilePicture', {})
        if profile_picture:
            display_image = profile_picture.get('displayImage~', {})
            elements = display_image.get('elements', [])
            if elements:
                identifiers = elements[-1].get('identifiers', [])  # Get largest image
                if identifiers:
                    profile_picture_url = identifiers[0].get('identifier')
        
        return {
            'linkedin_id': profile_data.get('id'),
            'first_name': profile_data.get('localizedFirstName', ''),
            'last_name': profile_data.get('localizedLastName', ''),
            'headline': profile_data.get('localizedHeadline', ''),
            'profile_picture_url': profile_picture_url,
            'email': email
        }
        
    except requests.RequestException as e:
        logger.error(f"LinkedIn profile fetch failed: {e}")
        raise LinkedInOAuthError(f'Failed to fetch profile: {str(e)}')


def refresh_access_token(refresh_token: str) -> Dict[str, any]:
    """
    Refresh LinkedIn access token using refresh token
    
    Args:
        refresh_token: Valid LinkedIn refresh token
    
    Returns:
        Dict containing new access_token and expires_in
    
    Raises:
        LinkedInOAuthError: If token refresh fails
    """
    client_id = getattr(settings, 'LINKEDIN_CLIENT_ID', None)
    client_secret = getattr(settings, 'LINKEDIN_CLIENT_SECRET', None)
    
    if not client_id or not client_secret:
        raise LinkedInOAuthError('LinkedIn OAuth credentials not configured')
    
    payload = {
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token,
        'client_id': client_id,
        'client_secret': client_secret
    }
    
    try:
        response = requests.post(LINKEDIN_TOKEN_URL, data=payload, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"LinkedIn token refresh failed: {e}")
        raise LinkedInOAuthError(f'Token refresh failed: {str(e)}')
