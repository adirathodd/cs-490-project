"""
Custom authentication backend for Firebase tokens with Django REST Framework.
"""
from rest_framework import authentication
from rest_framework import exceptions
from django.contrib.auth import get_user_model
from core.firebase_utils import verify_firebase_token, initialize_firebase
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


class FirebaseAuthentication(authentication.BaseAuthentication):
    """
    Firebase token-based authentication for Django REST Framework.
    
    Clients should authenticate by passing the Firebase ID token in the
    "Authorization" HTTP header, prepended with the string "Bearer ".
    
    Example:
        Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6...
    """
    
    def authenticate(self, request):
        """
        Authenticate the request and return a two-tuple of (user, token).
        """
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if not auth_header:
            return None
        
        try:
            # Split the header: "Bearer <token>"
            auth_parts = auth_header.split()
            
            if len(auth_parts) != 2 or auth_parts[0].lower() != 'bearer':
                return None
            
            id_token = auth_parts[1]
            
            # Initialize Firebase if not already done
            if not initialize_firebase():
                raise exceptions.AuthenticationFailed('Firebase not configured')
            
            # Verify the Firebase token
            decoded_token = verify_firebase_token(id_token)
            
            if not decoded_token:
                raise exceptions.AuthenticationFailed('Invalid authentication token')
            
            # Get or create the user
            uid = decoded_token.get('uid')
            email = decoded_token.get('email')
            
            if not uid or not email:
                raise exceptions.AuthenticationFailed('Invalid token payload')
            
            # Try to get existing user, or create if first time
            user, created = User.objects.get_or_create(
                username=uid,  # Use Firebase UID as username
                defaults={
                    'email': email,
                    'first_name': decoded_token.get('name', '').split()[0] if decoded_token.get('name') else '',
                    'last_name': ' '.join(decoded_token.get('name', '').split()[1:]) if decoded_token.get('name') else '',
                }
            )
            
            if created:
                logger.info(f"Created new user from Firebase token: {email}")
                # Create candidate profile automatically
                from core.models import CandidateProfile
                CandidateProfile.objects.create(user=user)
            
            # Update email if it changed
            if user.email != email:
                user.email = email
                user.save()
            
            return (user, decoded_token)
            
        except exceptions.AuthenticationFailed:
            raise
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            raise exceptions.AuthenticationFailed('Authentication failed')
    
    def authenticate_header(self, request):
        """
        Return a string to be used as the value of the `WWW-Authenticate`
        header in a `401 Unauthenticated` response.
        """
        return 'Bearer realm="api"'
