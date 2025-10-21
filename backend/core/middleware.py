"""
Custom middleware for Firebase authentication.
"""
from django.contrib.auth import get_user_model
from core.firebase_utils import verify_firebase_token
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


class FirebaseAuthenticationMiddleware:
    """
    Middleware to authenticate users via Firebase tokens for non-API requests.
    This supplements DRF's authentication for regular Django views.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Skip for API endpoints (handled by DRF authentication)
        if request.path.startswith('/api/'):
            return self.get_response(request)
        
        # Try to authenticate via Firebase token
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            decoded_token = verify_firebase_token(token)
            
            if decoded_token:
                uid = decoded_token.get('uid')
                try:
                    user = User.objects.get(username=uid)
                    request.user = user
                except User.DoesNotExist:
                    pass
        
        response = self.get_response(request)
        return response
