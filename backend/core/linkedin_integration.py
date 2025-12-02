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
LINKEDIN_PROFILE_URL = 'https://api.linkedin.com/v2/userinfo'  # OpenID Connect endpoint
LINKEDIN_EMAIL_URL = 'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))'

# Updated scopes for LinkedIn API v2
# Use profile and email (OpenID Connect scopes) or r_basicprofile and r_emailaddress
LINKEDIN_SCOPES = ['openid', 'profile', 'email']


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
        # Fetch basic profile using OpenID Connect userinfo endpoint
        profile_response = requests.get(LINKEDIN_PROFILE_URL, headers=headers, timeout=10)
        profile_response.raise_for_status()
        profile_data = profile_response.json()
        
        # OpenID Connect userinfo response format
        # {
        #   "sub": "linkedin_user_id",
        #   "name": "Full Name",
        #   "given_name": "First",
        #   "family_name": "Last",
        #   "picture": "https://...",
        #   "email": "user@example.com",
        #   "email_verified": true
        # }
        
        # Extract name components
        full_name = profile_data.get('name', '')
        first_name = profile_data.get('given_name', '')
        last_name = profile_data.get('family_name', '')
        
        # If name components aren't available, try to split full name
        if not first_name and full_name:
            name_parts = full_name.split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''
        
        return {
            'linkedin_id': profile_data.get('sub', ''),  # LinkedIn user ID
            'first_name': first_name,
            'last_name': last_name,
            'headline': '',  # Not available in OpenID Connect endpoint
            'profile_picture_url': profile_data.get('picture'),
            'email': profile_data.get('email')
        }
        
    except requests.RequestException as e:
        logger.error(f"LinkedIn profile fetch failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Response status: {e.response.status_code}, body: {e.response.text}")
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
