"""
Authentication views for Firebase-based user registration and login.
"""
from rest_framework import status, serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.utils import timezone
from core.serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    UserSerializer,
    BasicProfileSerializer,
    ProfilePictureUploadSerializer,
    ProfilePictureSerializer,
    SkillSerializer,
    CandidateSkillSerializer,
    SkillAutocompleteSerializer,
    EducationSerializer,
    CertificationSerializer,
    ProjectSerializer,
    ProjectMediaSerializer,
    WorkExperienceSerializer,
    JobEntrySerializer,
)
from core.models import CandidateProfile, Skill, CandidateSkill, Education, Certification, AccountDeletionRequest, Project, ProjectMedia, WorkExperience, UserAccount, JobEntry
from core.firebase_utils import create_firebase_user, initialize_firebase
from core.permissions import IsOwnerOrAdmin
from core.storage_utils import (
    process_profile_picture,
    delete_old_picture,
)
from django.core.files.base import ContentFile
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from PIL import Image
import io
import logging
import traceback
import requests
from django.db.models import Case, When, Value, IntegerField, F, Q
from django.db import models
from django.db.models.functions import Coalesce
import firebase_admin
from firebase_admin import auth as firebase_auth
import logging
from django.conf import settings


# ------------------------------
# Validation error message helpers
# ------------------------------
def _validation_messages(errors) -> list[str]:
    """Return a list of human-readable validation error messages.

    Example input:
      {"credential_url": ["Enter a valid URL."], "issue_date": ["This field is required."]}
    Output list:
      ["Credential url: Enter a valid URL.", "Issue date: This field is required."]
    """
    messages = []
    try:
        if isinstance(errors, dict):
            for field, err in errors.items():
                # Normalize to first meaningful message per field
                if isinstance(err, (list, tuple)) and err:
                    msg = str(err[0])
                else:
                    msg = str(err)
                if field == 'non_field_errors':
                    messages.append(msg)
                else:
                    field_label = str(field).replace('_', ' ').capitalize()
                    messages.append(f"{field_label}: {msg}")
        elif isinstance(errors, (list, tuple)):
            for e in errors:
                if e:
                    messages.append(str(e))
        elif errors:
            messages.append(str(errors))
    except Exception:
        # Fallback to a generic message if formatting fails
        messages.append("Validation error")
    return messages

logger = logging.getLogger(__name__)
User = get_user_model()


def _delete_user_and_data(user):
    """Permanently delete user and associated data across Django and Firebase."""
    uid = getattr(user, 'username', None)
    email = getattr(user, 'email', None)

    # Delete candidate profile and related data
    try:
        profile = CandidateProfile.objects.get(user=user)
        # Delete profile picture file if present
        if profile.profile_picture:
            try:
                delete_old_picture(profile.profile_picture.name)
            except Exception as e:
                logger.warning(f"Failed to delete profile picture file for {email}: {e}")
        # Delete related CandidateSkill entries
        CandidateSkill.objects.filter(candidate=profile).delete()
        profile.delete()
    except CandidateProfile.DoesNotExist:
        logger.info(f"No profile found when deleting user {email}")

    # Delete Django user
    try:
        user.delete()
    except Exception as e:
        logger.warning(f"Failed to delete Django user {email}: {e}")

    # Delete Firebase user
    if uid:
        try:
            firebase_auth.delete_user(uid)
        except Exception as e:
            logger.warning(f"Failed to delete Firebase user {uid}: {e}")

    # Send confirmation email (HTML + text alternative)
    try:
        from django.core.mail import EmailMultiAlternatives
        subject = 'Your account has been deleted'
        context = {
            'brand': 'ResumeRocket',
            'primary_start': '#667eea',
            'primary_end': '#764ba2',
        }
        html_content = render_to_string('emails/account_deletion_done.html', context)
        text_content = strip_tags(html_content)
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'noreply@example.com'
        if email:
            msg = EmailMultiAlternatives(subject, text_content, from_email, [email])
            msg.attach_alternative(html_content, "text/html")
            msg.send(fail_silently=True)
    except Exception as e:
        logger.warning(f"Failed to send account deletion email to {email}: {e}")


@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    """
    UC-001: User Registration with Email
    
    Register a new user with email and password using Firebase Authentication.
    
    Request Body:
    {
        "email": "user@example.com",
        "password": "SecurePass123",
        "confirm_password": "SecurePass123",
        "first_name": "John",
        "last_name": "Doe"
    }
    
    Response:
    {
        "user": {...},
        "profile": {...},
        "token": "firebase_custom_token",
        "message": "Registration successful"
    }
    """
    serializer = UserRegistrationSerializer(data=request.data)
    
    if not serializer.is_valid():
        msgs = _validation_messages(serializer.errors)
        return Response(
            {
                'error': {
                    'code': 'validation_error',
                    'message': (msgs[0] if msgs else 'Validation error'),
                    'messages': msgs,
                    'details': serializer.errors
                }
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Initialize Firebase
        if not initialize_firebase():
            return Response(
                {'error': {'code': 'service_unavailable', 'message': 'Authentication service is not available.'}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        validated_data = serializer.validated_data
        email = validated_data['email']
        password = validated_data['password']
        first_name = validated_data['first_name']
        last_name = validated_data['last_name']
        
        # First check if user already exists in Django
        if User.objects.filter(email=email).exists():
            return Response(
                {
                    'error': {
                        'code': 'duplicate_email',
                        'message': 'An account with this email already exists. Please log in instead. If you forgot your password, use the password reset option.'
                    }
                },
                status=status.HTTP_409_CONFLICT
            )
        
        # Create user in Firebase
        try:
            firebase_user = firebase_auth.create_user(
                email=email,
                password=password,
                display_name=f"{first_name} {last_name}"
            )
            logger.info(f"Created Firebase user: {firebase_user.uid}")
        except firebase_admin.exceptions.AlreadyExistsError:
            return Response(
                {
                    'error': {
                        'code': 'duplicate_email',
                        'message': 'An account with this email already exists. Please log in instead. If you forgot your password, use the password reset option.'
                    }
                },
                status=status.HTTP_409_CONFLICT
            )
        except Exception as e:
            logger.error(f"Firebase user creation failed: {e}")
            return Response(
                {'error': {'code': 'registration_failed', 'message': 'Registration failed. Please try again.'}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Create Django user
        try:
            # Create Django user first since we already checked for duplicates
            user = User.objects.create_user(
                username=firebase_user.uid,  # Use Firebase UID as username
                email=email,
                first_name=first_name,
                last_name=last_name,
            )
            # Store password using bcrypt (configured in settings)
            try:
                user.set_password(password)
                user.save(update_fields=['password'])
            except Exception:
                # Non-fatal: password storage should not block registration if Firebase created
                logger.warning("Failed to set local password hash for user %s", email)
            
            # Create candidate profile
            profile = CandidateProfile.objects.create(user=user)

            # Create application-level UserAccount record with UUID id and normalized email
            try:
                UserAccount.objects.create(user=user, email=email)
            except Exception as e:
                logger.warning(f"Failed to create UserAccount for {email}: {e}")
            
            logger.info(f"Created Django user and profile for: {email}")
        except Exception as e:
            # Something went wrong creating the Django user - rollback Firebase user
            try:
                firebase_auth.delete_user(firebase_user.uid)
            except:
                pass
            logger.error(f"Django user creation failed: {e}")
            return Response(
                {'error': {'code': 'registration_failed', 'message': 'Registration failed. Please try again.'}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Generate custom token for automatic login
        try:
            custom_token = firebase_auth.create_custom_token(firebase_user.uid)
            token_str = custom_token.decode('utf-8') if isinstance(custom_token, bytes) else custom_token
        except Exception as e:
            logger.error(f"Token generation failed: {e}")
            token_str = None
        
        # Serialize response
        user_serializer = UserSerializer(user)
        profile_serializer = UserProfileSerializer(profile)
        
        return Response({
            'user': user_serializer.data,
            'profile': profile_serializer.data,
            'token': token_str,
            'message': 'Registration successful. Welcome to ResumeRocket!'
        }, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        logger.error(f"Unexpected registration error: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An unexpected error occurred.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def login_user(request):
    """
    UC-002: User Login with Email and Password
    
    This endpoint validates credentials and returns user information.
    The actual authentication with Firebase should be done on the client side,
    and the client should send the Firebase ID token for subsequent requests.
    
    Request Body:
    {
        "email": "user@example.com",
        "password": "SecurePass123"
    }
    
    Response:
    {
        "user": {...},
        "profile": {...},
        "message": "Login successful"
    }
    
    Note: After successful login, client should:
    1. Authenticate with Firebase on client side
    2. Get Firebase ID token
    3. Send ID token in Authorization header for API requests
    """
    serializer = UserLoginSerializer(data=request.data)
    
    if not serializer.is_valid():
        msgs = _validation_messages(serializer.errors)
        return Response(
            {
                'error': {
                    'code': 'validation_error',
                    'message': (msgs[0] if msgs else 'Validation error'),
                    'messages': msgs,
                    'details': serializer.errors
                }
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Initialize Firebase
        if not initialize_firebase():
            return Response(
                {'error': {'code': 'service_unavailable', 'message': 'Authentication service is not available.'}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        validated_data = serializer.validated_data
        email = validated_data['email']
        password = validated_data['password']
        
        # Note: Firebase Admin SDK cannot verify passwords directly
        # This should be done on the client side using Firebase Auth SDK
        # Here we just verify the user exists in our system
        
        try:
            firebase_user = firebase_auth.get_user_by_email(email)
        except firebase_admin.exceptions.UserNotFoundError:
            return Response(
                {'error': {'code': 'invalid_credentials', 'message': 'Invalid email or password.'}},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            logger.error(f"Firebase user lookup failed: {e}")
            return Response(
                {'error': {'code': 'authentication_failed', 'message': 'Authentication failed. Please try again.'}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Get Django user
        try:
            user = User.objects.get(username=firebase_user.uid)
            profile = CandidateProfile.objects.get(user=user)
        except (User.DoesNotExist, CandidateProfile.DoesNotExist):
            # User exists in Firebase but not in Django - create them
            user = User.objects.create_user(
                username=firebase_user.uid,
                email=email,
                first_name=firebase_user.display_name.split()[0] if firebase_user.display_name else '',
                last_name=' '.join(firebase_user.display_name.split()[1:]) if firebase_user.display_name else '',
            )
            profile = CandidateProfile.objects.create(user=user)
            logger.info(f"Created Django user from existing Firebase user: {email}")
            # Ensure UserAccount exists
            try:
                UserAccount.objects.get_or_create(user=user, defaults={'email': (email or '').lower()})
            except Exception:
                pass
        
        # Generate custom token
        try:
            custom_token = firebase_auth.create_custom_token(firebase_user.uid)
            token_str = custom_token.decode('utf-8') if isinstance(custom_token, bytes) else custom_token
        except Exception as e:
            logger.error(f"Token generation failed: {e}")
            token_str = None
        
        # Serialize response
        user_serializer = UserSerializer(user)
        profile_serializer = UserProfileSerializer(profile)
        
        return Response({
            'user': user_serializer.data,
            'profile': profile_serializer.data,
            'token': token_str,
            'message': 'Login successful. Please authenticate with Firebase on the client.'
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Unexpected login error: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An unexpected error occurred.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_user(request):
    """
    POST /api/auth/logout

    For Firebase-based auth, revoke the user's refresh tokens so that any
    subsequent ID tokens minted with the old refresh token are invalid.
    Frontend should also clear its cached token.
    """
    try:
        user = request.user
        try:
            if initialize_firebase():
                firebase_auth.revoke_refresh_tokens(user.username)
        except Exception:
            # Non-fatal; proceed with response even if revoke fails
            pass

        if hasattr(request, 'session'):
            request.session.flush()

        return Response({
            'success': True,
            'message': 'Logout successful. Tokens revoked where applicable.'
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return Response(
            {'error': {'code': 'logout_failed', 'message': 'Failed to logout.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    """
    Get current authenticated user profile.
    
    Requires Firebase ID token in Authorization header.
    
    Response:
    {
        "user": {...},
        "profile": {...}
    }
    """
    try:
        user = request.user
        
        # Refresh user from database to get latest changes (e.g., after profile update)
        user.refresh_from_db()

        profile = CandidateProfile.objects.get(user=user)

        if request.method == 'GET':
            user_serializer = UserSerializer(user)
            profile_serializer = UserProfileSerializer(profile)
            return Response({'user': user_serializer.data, 'profile': profile_serializer.data}, status=status.HTTP_200_OK)

        # PUT: update
        serializer = BasicProfileSerializer(profile, data=request.data, partial=False)
        if not serializer.is_valid():
            return Response(
                {'error': {'code': 'validation_error', 'message': 'Please check your input.', 'details': serializer.errors}},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer.save()
        return Response({'profile': serializer.data, 'message': 'Profile updated successfully.'}, status=status.HTTP_200_OK)
    
    except CandidateProfile.DoesNotExist:
        # Create profile if it doesn't exist
        profile = CandidateProfile.objects.create(user=user)
        profile_serializer = UserProfileSerializer(profile)
        
        return Response({
            'user': UserSerializer(user).data,
            'profile': profile_serializer.data,
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'Failed to fetch user profile.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_account_deletion(request):
    """Initiate account deletion by sending an email with a confirmation link."""
    try:
        user = request.user
        logger.debug(f"Account deletion requested by user id={getattr(user, 'id', None)} email={getattr(user, 'email', None)}")
        # Create a new deletion request token (invalidate older by allowing overwrite behavior on retrieve)
        # Token valid for 1 hour
        deletion = AccountDeletionRequest.create_for_user(user, ttl_hours=1)

        # Build confirmation URL
        confirm_path = f"/api/auth/delete/confirm/{deletion.token}"
        confirm_url = request.build_absolute_uri(confirm_path)

        # Send email with confirmation link (HTML + text alternative)
        try:
            from django.core.mail import EmailMultiAlternatives

            subject = 'Confirm your account deletion request'
            context = {
                'brand': 'ResumeRocket',
                'confirm_url': confirm_url,
                'primary_start': '#667eea',
                'primary_end': '#764ba2',
                'ttl_hours': 1,
            }
            html_content = render_to_string('emails/account_deletion_request.html', context)
            text_content = render_to_string('emails/account_deletion_request.txt', context)
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'noreply@example.com'
            if user.email:
                msg = EmailMultiAlternatives(subject, text_content, from_email, [user.email])
                msg.attach_alternative(html_content, "text/html")
                try:
                    # In DEBUG, surface email errors to logs to aid troubleshooting
                    sent = msg.send(fail_silently=not settings.DEBUG)
                    logger.info(f"Account deletion email send result={sent} to={user.email} from={from_email}")
                except Exception as send_err:
                    logger.warning(f"Email send error (deletion link) to {user.email}: {send_err}")
        except Exception as e:
            logger.warning(f"Failed to send deletion confirmation email to {user.email}: {e}")

        payload = {
            'message': "We've emailed you a confirmation link. Please check your inbox to permanently delete your account."
        }
        # In development, return the confirm URL for easier testing
        if settings.DEBUG:
            payload['confirm_url'] = confirm_url

        return Response(payload, status=status.HTTP_200_OK)
    except Exception as e:
        # Log full traceback to aid debugging
        logger.exception(f"Error initiating account deletion for {getattr(request.user, 'email', 'unknown')}: {e}")
        return Response(
            {'error': {'code': 'deletion_init_failed', 'message': 'Failed to initiate account deletion.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


from django.shortcuts import render


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def confirm_account_deletion(request, token: str):
    """Render confirmation page and on POST permanently delete the associated account."""
    try:
        try:
            deletion = AccountDeletionRequest.objects.select_related('user').get(token=token)
        except AccountDeletionRequest.DoesNotExist:
            return render(request._request, 'core/account_deletion_invalid.html', status=404)

        if not deletion.is_valid():
            return render(request._request, 'core/account_deletion_expired.html', status=400)

        if request.method == 'GET':
            return render(request._request, 'core/account_deletion_confirm.html', context={'email': deletion.user.email})

        # POST: proceed with permanent deletion
        # Mark token consumed BEFORE deleting the user (CASCADE would remove this row)
        deletion.mark_consumed()
        user = deletion.user
        _delete_user_and_data(user)
        return render(request._request, 'core/account_deletion_done.html')
    except Exception as e:
        logger.error(f"Error confirming account deletion for token {token}: {e}")
        return render(request._request, 'core/account_deletion_error.html', status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def verify_token(request):
    """
    Verify a Firebase ID token and return user information.
    
    Request Body:
    {
        "id_token": "firebase_id_token_here"
    }
    
    Response:
    {
        "valid": true,
        "user": {...},
        "profile": {...}
    }
    """
    id_token = request.data.get('id_token')
    
    if not id_token:
        return Response(
            {'error': {'code': 'missing_token', 'message': 'ID token is required.'}},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        from core.firebase_utils import verify_firebase_token
        
        decoded_token = verify_firebase_token(id_token)
        
        if not decoded_token:
            return Response(
                {'error': {'code': 'invalid_token', 'message': 'Invalid or expired token.'}},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        uid = decoded_token.get('uid')
        
        try:
            user = User.objects.get(username=uid)
            profile = CandidateProfile.objects.get(user=user)
            
            return Response({
                'valid': True,
                'user': UserSerializer(user).data,
                'profile': UserProfileSerializer(profile).data,
            }, status=status.HTTP_200_OK)
        
        except (User.DoesNotExist, CandidateProfile.DoesNotExist):
            return Response(
                {'error': {'code': 'user_not_found', 'message': 'User not found in system.'}},
                status=status.HTTP_404_NOT_FOUND
            )
    
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return Response(
            {'error': {'code': 'verification_failed', 'message': 'Token verification failed.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def oauth_link_via_provider(request):
    """
    Given a provider name and provider access token (e.g., GitHub), verify the
    provider token with the provider API, extract the verified email, and
    return a Firebase custom token for the existing Firebase user with that email.

    Request body:
    {
        "provider": "github",
        "access_token": "gho_..."
    }

    Response:
    {
        "custom_token": "...",
        "email": "user@example.com"
    }
    """
    provider = request.data.get('provider')
    access_token = request.data.get('access_token')

    if not provider or not access_token:
        return Response({'error': {'code': 'missing_parameters', 'message': 'provider and access_token are required.'}}, status=status.HTTP_400_BAD_REQUEST)

    try:
        if provider.lower() == 'github':
            # Query user's emails via GitHub API
            headers = {
                'Authorization': f'token {access_token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            resp = requests.get('https://api.github.com/user/emails', headers=headers, timeout=6)
            if resp.status_code != 200:
                logger.error(f"GitHub emails lookup failed: {resp.status_code} {resp.text}")
                return Response({'error': {'code': 'provider_verification_failed', 'message': 'Failed to verify provider token.'}}, status=status.HTTP_400_BAD_REQUEST)

            emails = resp.json()
            # emails is a list of objects: { email, primary, verified, visibility }
            chosen = None
            for e in emails:
                if e.get('primary') and e.get('verified'):
                    chosen = e.get('email')
                    break
            if not chosen:
                for e in emails:
                    if e.get('verified'):
                        chosen = e.get('email')
                        break
            if not chosen and emails:
                chosen = emails[0].get('email')

            if not chosen:
                return Response({'error': {'code': 'no_email', 'message': 'Provider did not return an email.'}}, status=status.HTTP_400_BAD_REQUEST)

            # Find Firebase user by email
            try:
                fb_user = firebase_auth.get_user_by_email(chosen)
            except firebase_admin.exceptions.UserNotFoundError:
                return Response({'error': {'code': 'user_not_found', 'message': 'No account with that email in our system.'}}, status=status.HTTP_404_NOT_FOUND)

            # Create custom token for that user
            try:
                custom_token = firebase_auth.create_custom_token(fb_user.uid)
                token_str = custom_token.decode('utf-8') if isinstance(custom_token, bytes) else custom_token
                return Response({'custom_token': token_str, 'email': chosen}, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Failed to create custom token for {fb_user.uid}: {e}")
                return Response({'error': {'code': 'token_error', 'message': 'Failed to create authentication token.'}}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        else:
            return Response({'error': {'code': 'unsupported_provider', 'message': 'Provider not supported.'}}, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"oauth_link_via_provider error: {e}")
        return Response({'error': {'code': 'internal_error', 'message': 'Failed to process provider token.'}}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- UC-008: User Profile Access Control ---
@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def user_profile(request, user_id=None):
    """
    UC-008: User Profile Access Control

    GET: Retrieve a user's profile
    PUT: Update a user's profile

    URL Parameters:
    - user_id: The Firebase UID of the user whose profile to retrieve/update
               If not provided, returns the current user's profile

    Returns:
    {
        "profile": {...},
        "user": {...}
    }
    """
    try:
        # Debug: log authenticated user and incoming auth header for troubleshooting
        try:
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        except Exception:
            auth_header = ''
        logger.debug(
            "user_profile called: request.user=%s is_staff=%s username=%s auth_header=%s",
            request.user,
            getattr(request.user, 'is_staff', None),
            getattr(request.user, 'username', None),
            (auth_header[:80] + '...') if auth_header else 'None'
        )

        # If no user_id provided, use the current user's id
        target_uid = user_id or request.user.username

        # Get the target user
        try:
            target_user = User.objects.get(username=target_uid)
        except User.DoesNotExist:
            # Check if user exists in Firebase; if so, create a Django user
            try:
                firebase_user = firebase_auth.get_user(target_uid)
                target_user = User.objects.create_user(
                    username=target_uid,
                    email=firebase_user.email,
                    first_name=firebase_user.display_name.split()[0] if firebase_user.display_name else "",
                    last_name=" ".join(firebase_user.display_name.split()[1:]) if firebase_user.display_name else ""
                )
                logger.info(f"Created Django user for existing Firebase user: {target_uid}")
            except firebase_admin.exceptions.NotFoundError:
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

        # Debug permissions check
        logger.debug(
            "Profile access check: authenticated_user=%s (id=%s, staff=%s, superuser=%s) "
            "trying to access target_user=%s (id=%s)",
            request.user.username,
            request.user.id,
            request.user.is_staff,
            request.user.is_superuser,
            target_user.username,
            target_user.id
        )

        # Check permissions: owner or staff/admin
        if not request.user.is_staff and request.user != target_user:
            logger.debug(
                "Access denied: is_staff=%s, users_match=%s",
                request.user.is_staff,
                request.user == target_user
            )
            return Response(
                {
                    'error': {
                        'code': 'forbidden',
                        'message': 'You do not have permission to access this profile',
                        'messages': ['You do not have permission to access this profile']
                    }
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # Get or create profile
        profile, created = CandidateProfile.objects.get_or_create(user=target_user)

        if request.method == 'GET':
            return Response({
                'profile': UserProfileSerializer(profile).data,
                'user': UserSerializer(target_user).data
            })

        # PUT
        if not request.user.is_staff and request.user != target_user:
            return Response(
                {
                    'error': {
                        'code': 'forbidden',
                        'message': 'You do not have permission to edit this profile',
                        'messages': ['You do not have permission to edit this profile']
                    }
                },
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                'profile': serializer.data,
                'user': UserSerializer(target_user).data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"Profile operation error: {e}")
        return Response(
            {'error': 'An error occurred while processing your request'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ------------------------------
# Employment (Work Experience)
# ------------------------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def employment_list_create(request):
    try:
        profile = CandidateProfile.objects.get(user=request.user)
    except CandidateProfile.DoesNotExist:
        return Response({'error': {'code': 'profile_not_found', 'message': 'Profile not found.'}}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        experiences = WorkExperience.objects.filter(candidate=profile).order_by('-start_date')
        serializer = WorkExperienceSerializer(experiences, many=True)
        return Response({'results': serializer.data}, status=status.HTTP_200_OK)

    data = request.data.copy()
    data['candidate'] = profile.id
    serializer = WorkExperienceSerializer(data=data)
    if serializer.is_valid():
        serializer.save(candidate=profile)
        return Response({'work_experience': serializer.data, 'message': 'Employment record created.'}, status=status.HTTP_201_CREATED)
    return Response({'error': {'code': 'validation_error', 'message': 'Invalid input.', 'details': serializer.errors}}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def employment_detail(request, pk: int):
    try:
        profile = CandidateProfile.objects.get(user=request.user)
    except CandidateProfile.DoesNotExist:
        return Response({'error': {'code': 'profile_not_found', 'message': 'Profile not found.'}}, status=status.HTTP_404_NOT_FOUND)

    try:
        experience = WorkExperience.objects.get(pk=pk, candidate=profile)
    except WorkExperience.DoesNotExist:
        return Response({'error': {'code': 'not_found', 'message': 'Employment record not found.'}}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({'work_experience': WorkExperienceSerializer(experience).data}, status=status.HTTP_200_OK)
    if request.method in ['PUT', 'PATCH']:
        partial = request.method == 'PATCH'
        serializer = WorkExperienceSerializer(experience, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response({'work_experience': serializer.data, 'message': 'Employment record updated.'}, status=status.HTTP_200_OK)
        return Response({'error': {'code': 'validation_error', 'message': 'Invalid input.', 'details': serializer.errors}}, status=status.HTTP_400_BAD_REQUEST)
    experience.delete()
    return Response({'message': 'Employment record deleted.'}, status=status.HTTP_204_NO_CONTENT)

# --- UC-021: Basic Profile Information Form ---
@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_basic_profile(request):
    """
    Get or update basic profile information for the authenticated user.
    Authorization: users can only view/edit their own profile.
    """
    try:
        user = request.user

        # Get or create profile for this user
        try:
            profile = CandidateProfile.objects.get(user=user)
        except CandidateProfile.DoesNotExist:
            profile = CandidateProfile.objects.create(user=user)
            logger.info(f"Created new profile for user: {user.email}")

        if request.method == 'GET':
            # Autofill first/last name if empty using Firebase display name when available
            try:
                if (not (user.first_name or '').strip()) and (not (user.last_name or '').strip()):
                    try:
                        fb_user = firebase_auth.get_user(user.username)
                        display_name = getattr(fb_user, 'display_name', None)
                        if display_name:
                            parts = display_name.split()
                            user.first_name = parts[0] if parts else ''
                            user.last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''
                            user.save(update_fields=['first_name', 'last_name'])
                    except Exception:
                        # As a soft fallback, derive a name-like value from email prefix
                        try:
                            if (not (user.first_name or '').strip()) and user.email:
                                local = user.email.split('@')[0]
                                if local:
                                    # Basic capitalization of segments
                                    segs = [s for s in local.replace('.', ' ').replace('_', ' ').split() if s]
                                    if segs:
                                        user.first_name = segs[0].capitalize()
                                        user.last_name = ' '.join([s.capitalize() for s in segs[1:]])
                                        user.save(update_fields=['first_name', 'last_name'])
                        except Exception:
                            pass
            except Exception:
                # Non-fatal: if autofill fails, proceed with existing values
                pass

            serializer = BasicProfileSerializer(profile)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # PUT/PATCH
        partial = request.method == 'PATCH'
        serializer = BasicProfileSerializer(profile, data=request.data, partial=partial)

        if not serializer.is_valid():
            msgs = _validation_messages(serializer.errors)
            return Response(
                {
                    'error': {
                        'code': 'validation_error',
                        'message': (msgs[0] if msgs else 'Validation error'),
                        'messages': msgs,
                        'details': serializer.errors
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer.save()
        logger.info(f"Profile updated for user: {user.email}")

        return Response({
            'profile': serializer.data,
            'message': 'Profile updated successfully.'
        }, status=status.HTTP_200_OK)

    except Exception as e:
        ident = request.user.email if getattr(request.user, "is_authenticated", False) else 'anonymous'
        logger.error(f"Error updating profile for user {ident}: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'Failed to update profile.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# --- UC-022: Profile Picture Upload ---
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_profile_picture(request):
    """
    Upload a profile picture for the authenticated user.
    """
    try:
        user = request.user

        # Get or create profile
        try:
            profile = CandidateProfile.objects.get(user=user)
        except CandidateProfile.DoesNotExist:
            profile = CandidateProfile.objects.create(user=user)
            logger.info(f"Created new profile for user during picture upload: {user.email}")

        # Validate request data
        serializer = ProfilePictureUploadSerializer(data=request.data)
        if not serializer.is_valid():
            msgs = _validation_messages(serializer.errors)
            return Response(
                {
                    'error': {
                        'code': 'validation_error',
                        'message': (msgs[0] if msgs else 'Validation error'),
                        'messages': msgs,
                        'details': serializer.errors
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        profile_picture = serializer.validated_data['profile_picture']

        # Process image (validate, resize, optimize)
        logger.info(f"Processing profile picture for user: {user.email}")
        processed_file, error_msg = process_profile_picture(profile_picture)

        if error_msg:
            return Response(
                {'error': {'code': 'processing_failed', 'message': error_msg}},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Delete old profile picture if exists
        if profile.profile_picture:
            logger.info(f"Deleting old profile picture: {profile.profile_picture.name}")
            delete_old_picture(profile.profile_picture.name)

        # Save new profile picture
        profile.profile_picture = processed_file
        profile.profile_picture_uploaded_at = timezone.now()
        profile.save()

        logger.info(f"Profile picture uploaded successfully for user: {user.email}")

        picture_serializer = ProfilePictureSerializer(profile, context={'request': request})
        return Response({
            **picture_serializer.data,
            'message': 'Profile picture uploaded successfully'
        }, status=status.HTTP_200_OK)

    except Exception as e:
        ident = request.user.email if getattr(request.user, "is_authenticated", False) else 'anonymous'
        logger.error(f"Error uploading profile picture for user {ident}: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'Failed to upload profile picture.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_profile_picture(request):
    """
    Delete the profile picture for the authenticated user.
    """
    try:
        user = request.user

        # Get profile
        try:
            profile = CandidateProfile.objects.get(user=user)
        except CandidateProfile.DoesNotExist:
            return Response(
                {'error': {'code': 'profile_not_found', 'message': 'Profile not found.'}},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if profile picture exists
        if not profile.profile_picture:
            return Response(
                {'error': {'code': 'no_picture', 'message': 'No profile picture to delete.'}},
                status=status.HTTP_404_NOT_FOUND
            )

        # Delete file from storage
        logger.info(f"Deleting profile picture for user: {user.email}")
        delete_old_picture(profile.profile_picture.name)

        # Clear profile picture field and clear any linked external portfolio_url
        profile.profile_picture = None
        profile.profile_picture_uploaded_at = None
        # If the portfolio_url is present and likely points to an external provider (e.g., Google),
        # remove it as well so we don't automatically re-download the same image.
        try:
            if profile.portfolio_url:
                profile.portfolio_url = None
        except Exception:
            # If the model doesn't have the field for some reason, ignore silently
            pass

        profile.save()

        logger.info(f"Profile picture deleted successfully for user: {user.email}")

        return Response({'message': 'Profile picture deleted successfully'}, status=status.HTTP_200_OK)

    except Exception as e:
        ident = request.user.email if getattr(request.user, "is_authenticated", False) else 'anonymous'
        logger.error(f"Error deleting profile picture for user {ident}: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'Failed to delete profile picture.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_profile_picture(request):
    """
    Get profile picture information for the authenticated user.
    """
    try:
        user = request.user

        # Get or create profile
        try:
            profile = CandidateProfile.objects.get(user=user)
        except CandidateProfile.DoesNotExist:
            profile = CandidateProfile.objects.create(user=user)

        # If no uploaded profile picture exists but we have a portfolio_url (Google photo),
        # attempt an on-demand download/save so we can serve the image from our domain
        if not profile.profile_picture and profile.portfolio_url:
            photo_url = profile.portfolio_url
            try:
                # Try higher-resolution variants for Google profile URLs, then requests -> urllib
                def candidate_urls(url):
                    urls = [url]
                    try:
                        m = __import__('re').search(r"/s(\d+)(-c)?/", url)
                        if m:
                            urls.insert(0, __import__('re').sub(r"/s(\d+)(-c)?/", "/s400-c/", url))
                        if 'sz=' in url:
                            urls.insert(0, __import__('re').sub(r"(sz=)\d+", r"\1400", url))
                        else:
                            if '?' in url:
                                urls.append(url + '&sz=400')
                            else:
                                urls.append(url + '?sz=400')
                    except Exception:
                        pass
                    seen = set(); out = []
                    for u in urls:
                        if u not in seen:
                            out.append(u); seen.add(u)
                    return out

                urls_to_try = candidate_urls(photo_url)
                content = None
                content_type = ''
                for u in urls_to_try:
                    try:
                        import requests
                        resp = requests.get(u, timeout=6)
                        if resp.status_code == 200:
                            content = resp.content
                            content_type = resp.headers.get('Content-Type', '')
                            break
                    except Exception:
                        try:
                            from urllib.request import urlopen
                            uresp = urlopen(u, timeout=6)
                            content = uresp.read()
                            content_type = uresp.headers.get_content_type() if hasattr(uresp, 'headers') else ''
                            break
                        except Exception:
                            continue

                if content:
                    ext = ''
                    if content_type:
                        if 'jpeg' in content_type:
                            ext = 'jpg'
                        elif 'png' in content_type:
                            ext = 'png'
                        elif 'gif' in content_type:
                            ext = 'gif'
                    if not ext:
                        try:
                            img = Image.open(io.BytesIO(content))
                            fmt = (img.format or '').lower()
                            if fmt in ('jpeg', 'jpg'):
                                ext = 'jpg'
                            elif fmt in ('png', 'gif', 'webp'):
                                ext = fmt
                            else:
                                ext = 'jpg'
                        except Exception:
                            ext = 'jpg'

                    filename = f"profile_{profile.user.username}.{ext}"
                    try:
                        profile.profile_picture.save(filename, ContentFile(content), save=True)
                        profile.profile_picture_uploaded_at = timezone.now()
                        profile.save()
                        logger.info(f"Saved downloaded profile picture for user {profile.user.username}")
                    except Exception as e:
                        logger.warning(f"Failed to save downloaded profile picture for {profile.user.username}: {e}")
            except Exception as e:
                logger.warning(f"Failed to download portfolio_url for user {profile.user.username}: {e}\n{traceback.format_exc()}")

        serializer = ProfilePictureSerializer(profile, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Exception as e:
        ident = request.user.email if getattr(request.user, "is_authenticated", False) else 'anonymous'
        logger.error(f"Error fetching profile picture for user {ident}: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'Failed to fetch profile picture.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ======================
# UC-026: SKILLS VIEWS
# ======================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def skills_list_create(request):
    """
    UC-026: Add and Manage Skills
    
    GET: List all skills for the authenticated user
    POST: Add a new skill to the user's profile
    
    POST Request Body:
    {
        "skill_id": 1,  // OR "name": "Python" (if creating new skill)
        "name": "Python",  // Optional if skill_id provided
        "category": "Technical",  // Optional
        "level": "advanced",  // beginner|intermediate|advanced|expert
        "years": 3.5  // Optional
    }
    """
    try:
        user = request.user
        # Get or create profile
        try:
            profile = CandidateProfile.objects.get(user=user)
        except CandidateProfile.DoesNotExist:
            profile = CandidateProfile.objects.create(user=user)

        if request.method == 'GET':
            candidate_skills = CandidateSkill.objects.filter(candidate=profile).select_related('skill')
            data = CandidateSkillSerializer(candidate_skills, many=True).data
            return Response(data, status=status.HTTP_200_OK)

        # POST: add new skill
        serializer = CandidateSkillSerializer(data=request.data, context={'candidate': profile})
        if not serializer.is_valid():
            msgs = _validation_messages(serializer.errors)
            return Response(
                {
                    'error': {
                        'code': 'validation_error',
                        'message': (msgs[0] if msgs else 'Validation error'),
                        'messages': msgs,
                        'details': serializer.errors
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            saved = serializer.save()
            return Response(CandidateSkillSerializer(saved).data, status=status.HTTP_201_CREATED)
        except serializers.ValidationError as ve:
            # Duplicate or semantic validation at create time
            detail = getattr(ve, 'detail', ve.args)
            msgs = _validation_messages(detail)
            code = 'conflict' if ('already' in ' '.join(msgs).lower() or 'exists' in ' '.join(msgs).lower()) else 'validation_error'
            return Response(
                {
                    'error': {
                        'code': code,
                        'message': (msgs[0] if msgs else 'Validation error'),
                        'messages': msgs,
                        'details': detail
                    }
                },
                status=status.HTTP_409_CONFLICT if code == 'conflict' else status.HTTP_400_BAD_REQUEST
            )
    except Exception as e:
        logger.error(f"Error in skills_list_create: {e}\n{traceback.format_exc()}")
        return Response({'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def skill_detail(request, skill_id):
    """
    UC-026: Manage Individual Skill
    
    GET: Retrieve a specific skill
    PUT/PATCH: Update skill proficiency level or years
    DELETE: Remove skill from profile (with confirmation)
    
    PUT/PATCH Request Body:
    {
        "level": "expert",
        "years": 5.0
    }
    """
    try:
        user = request.user
        
        # Get profile
        try:
            profile = CandidateProfile.objects.get(user=user)
        except CandidateProfile.DoesNotExist:
            return Response(
                {'error': {'code': 'profile_not_found', 'message': 'Profile not found.'}},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get candidate skill
        try:
            candidate_skill = CandidateSkill.objects.get(id=skill_id, candidate=profile)
        except CandidateSkill.DoesNotExist:
            return Response(
                {'error': {'code': 'skill_not_found', 'message': 'Skill not found.'}},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if request.method == 'GET':
            serializer = CandidateSkillSerializer(candidate_skill)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        elif request.method in ['PUT', 'PATCH']:
            # Update skill proficiency or years
            partial = request.method == 'PATCH'
            
            # Only allow updating level and years
            update_data = {}
            if 'level' in request.data:
                update_data['level'] = request.data['level']
            if 'years' in request.data:
                update_data['years'] = request.data['years']
            
            serializer = CandidateSkillSerializer(candidate_skill, data=update_data, partial=True)
            
            if not serializer.is_valid():
                return Response(
                    {'error': {'code': 'validation_error', 'message': 'Please check your input.', 'details': serializer.errors}},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        elif request.method == 'DELETE':
            # Delete skill
            skill_name = candidate_skill.skill.name
            candidate_skill.delete()
            return Response(
                {'message': f'Skill "{skill_name}" removed successfully.'},
                status=status.HTTP_200_OK
            )
    
    except Exception as e:
        logger.error(f"Error in skill_detail: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# Back-compat wrapper for routes expecting `skills_detail` with `<int:pk>`
@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def skills_detail(request, pk: int):
    # Pass the underlying Django HttpRequest to the DRF-decorated view
    django_request = getattr(request, '_request', request)
    return skill_detail(django_request, skill_id=pk)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def skills_autocomplete(request):
    """
    UC-026: Skill Autocomplete Suggestions
    
    GET: Return autocomplete suggestions for common skills based on query parameter
    
    Query Parameters:
    - q: Search query (minimum 2 characters)
    - category: Optional filter by category
    - limit: Maximum results (default 10)
    
    Example: /api/skills/autocomplete?q=pyt&category=Technical&limit=5
    """
    try:
        query = request.GET.get('q', '').strip()
        category = request.GET.get('category', '').strip()
        limit = int(request.GET.get('limit', 10))
        
        if len(query) < 2:
            return Response(
                {'error': {'code': 'invalid_query', 'message': 'Search query must be at least 2 characters.'}},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Search skills by name
        skills_query = Skill.objects.filter(name__icontains=query)
        
        # Filter by category if provided
        if category:
            skills_query = skills_query.filter(category__iexact=category)
        
        # Annotate with usage count and order by popularity
        from django.db.models import Count
        skills_query = skills_query.annotate(
            usage_count=Count('candidates')
        ).order_by('-usage_count', 'name')[:limit]
        
        # Serialize results
        results = []
        for skill in skills_query:
            results.append({
                'id': skill.id,
                'name': skill.name,
                'category': skill.category,
                'usage_count': skill.usage_count
            })
        
        return Response(results, status=status.HTTP_200_OK)
    
    except ValueError:
        return Response(
            {'error': {'code': 'invalid_parameter', 'message': 'Invalid limit parameter.'}},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error in skills_autocomplete: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def skills_categories(request):
    """
    UC-026: Get Skill Categories
    
    GET: Return list of available skill categories
    
    Response:
    [
        "Technical",
        "Soft Skills",
        "Languages",
        "Industry-Specific"
    ]
    """
    categories = [
        "Technical",
        "Soft Skills",
        "Languages",
        "Industry-Specific"
    ]
    return Response(categories, status=status.HTTP_200_OK)


# ======================
# UC-027: SKILLS CATEGORY ORGANIZATION VIEWS
# ======================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def skills_reorder(request):
    """
    UC-027: Reorder Skills (Drag and Drop)
    
    POST: Reorder skills within a category or move between categories
    
    Request Body:
    {
        "skill_id": 1,
        "new_order": 2,
        "new_category": "Technical"  // Optional - for moving between categories
    }
    """
    try:
        user = request.user
        profile = CandidateProfile.objects.get(user=user)
        
        skill_id = request.data.get('skill_id')
        new_order = request.data.get('new_order')
        new_category = request.data.get('new_category')
        
        if skill_id is None or new_order is None:
            return Response(
                {'error': {'code': 'invalid_data', 'message': 'skill_id and new_order are required.'}},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get the skill to reorder
        try:
            candidate_skill = CandidateSkill.objects.get(id=skill_id, candidate=profile)
        except CandidateSkill.DoesNotExist:
            return Response(
                {'error': {'code': 'skill_not_found', 'message': 'Skill not found.'}},
                status=status.HTTP_404_NOT_FOUND
            )
        
        old_category = candidate_skill.skill.category
        
        # If moving to a new category, update the skill's category
        if new_category and new_category != old_category:
            candidate_skill.skill.category = new_category
            candidate_skill.skill.save()
        
        # Update the order
        candidate_skill.order = new_order
        candidate_skill.save()
        
        return Response(
            {'message': 'Skill reordered successfully.', 'skill': CandidateSkillSerializer(candidate_skill).data},
            status=status.HTTP_200_OK
        )
    
    except Exception as e:
        logger.error(f"Error in skills_reorder: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def skills_bulk_reorder(request):
    """
    UC-027: Bulk Reorder Skills
    
    POST: Update order for multiple skills at once (for drag-and-drop optimization)
    
    Request Body:
    {
        "skills": [
            {"skill_id": 1, "order": 0},
            {"skill_id": 2, "order": 1},
            {"skill_id": 3, "order": 2}
        ]
    }
    """
    try:
        user = request.user
        profile = CandidateProfile.objects.get(user=user)
        
        skills_data = request.data.get('skills', [])
        
        if not skills_data:
            return Response(
                {'error': {'code': 'invalid_data', 'message': 'skills array is required.'}},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update all skills in a single transaction
        from django.db import transaction
        
        with transaction.atomic():
            for skill_data in skills_data:
                skill_id = skill_data.get('skill_id')
                order = skill_data.get('order')
                
                if skill_id is not None and order is not None:
                    CandidateSkill.objects.filter(
                        id=skill_id,
                        candidate=profile
                    ).update(order=order)
        
        return Response(
            {'message': 'Skills reordered successfully.'},
            status=status.HTTP_200_OK
        )
    
    except Exception as e:
        logger.error(f"Error in skills_bulk_reorder: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def skills_by_category(request):
    """
    UC-027: Get Skills Grouped by Category
    
    GET: Return skills organized by category with counts and summaries
    
    Response:
    {
        "Technical": {
            "skills": [...],
            "count": 5,
            "proficiency_distribution": {"beginner": 1, "intermediate": 2, "advanced": 1, "expert": 1},
            "avg_years": 3.5
        },
        ...
    }
    """
    try:
        user = request.user
        profile = CandidateProfile.objects.get(user=user)
        
        # Get all skills
        skills = CandidateSkill.objects.filter(candidate=profile).select_related('skill').order_by('order', 'id')
        
        # Group by category
        from collections import defaultdict
        from decimal import Decimal
        
        categories_data = defaultdict(lambda: {
            'skills': [],
            'count': 0,
            'proficiency_distribution': {'beginner': 0, 'intermediate': 0, 'advanced': 0, 'expert': 0},
            'total_years': Decimal('0'),
        })
        
        for skill in skills:
            category = skill.skill.category or 'Uncategorized'
            skill_data = CandidateSkillSerializer(skill).data
            
            categories_data[category]['skills'].append(skill_data)
            categories_data[category]['count'] += 1
            categories_data[category]['proficiency_distribution'][skill.level] += 1
            categories_data[category]['total_years'] += skill.years
        
        # Calculate averages
        result = {}
        for category, data in categories_data.items():
            result[category] = {
                'skills': data['skills'],
                'count': data['count'],
                'proficiency_distribution': data['proficiency_distribution'],
                'avg_years': float(data['total_years'] / data['count']) if data['count'] > 0 else 0
            }
        
        return Response(result, status=status.HTTP_200_OK)
    
    except CandidateProfile.DoesNotExist:
        return Response(
            {'error': {'code': 'profile_not_found', 'message': 'Profile not found.'}},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error in skills_by_category: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def skills_export(request):
    """
    UC-027: Export Skills
    
    GET: Export skills in CSV or JSON format, grouped by category
    
    Query Parameters:
    - format: csv|json (default: json)
    
    Example: /api/skills/export?format=csv
    """
    try:
        import csv
        from io import StringIO
        
        user = request.user
        profile = CandidateProfile.objects.get(user=user)
        
        export_format = request.GET.get('format', 'json').lower()
        
        # Get all skills
        skills = CandidateSkill.objects.filter(candidate=profile).select_related('skill').order_by('skill__category', 'order', 'id')
        
        if export_format == 'csv':
            # Create CSV
            output = StringIO()
            writer = csv.writer(output)
            writer.writerow(['Category', 'Skill Name', 'Proficiency Level', 'Years of Experience'])
            
            for skill in skills:
                writer.writerow([
                    skill.skill.category or 'Uncategorized',
                    skill.skill.name,
                    skill.level.capitalize(),
                    float(skill.years)
                ])
            
            response = Response(output.getvalue(), content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="skills_export.csv"'
            return response
        
        else:  # JSON format
            data = []
            for skill in skills:
                data.append({
                    'category': skill.skill.category or 'Uncategorized',
                    'name': skill.skill.name,
                    'level': skill.level,
                    'years': float(skill.years)
                })
            
            return Response(data, status=status.HTTP_200_OK)
    
    except CandidateProfile.DoesNotExist:
        return Response(
            {'error': {'code': 'profile_not_found', 'message': 'Profile not found.'}},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error in skills_export: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ======================
# Education views
# ======================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def education_levels(request):
    """
    Return available education levels for dropdown.
    """
    levels = [
        {'value': k, 'label': v} for k, v in Education.DEGREE_CHOICES
    ]
    return Response(levels, status=status.HTTP_200_OK)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def education_list_create(request):
    """
    List and create education entries for the authenticated user.

    GET: List all education entries
    POST: Create new education entry
    """
    try:
        user = request.user
        # Ensure profile exists
        profile, _ = CandidateProfile.objects.get_or_create(user=user)

        if request.method == 'GET':
            # Order: currently enrolled first, then by most recent graduation/start date
            qs = (
                Education.objects
                .filter(candidate=profile)
                .annotate(
                    current=Case(
                        When(currently_enrolled=True, then=Value(1)),
                        default=Value(0),
                        output_field=IntegerField(),
                    ),
                    end_sort=Coalesce('end_date', 'start_date')
                )
                .order_by(F('current').desc(), F('end_sort').desc(nulls_last=True), '-id')
            )
            return Response(EducationSerializer(qs, many=True).data, status=status.HTTP_200_OK)

        # POST
        serializer = EducationSerializer(data=request.data)
        if not serializer.is_valid():
            msgs = _validation_messages(serializer.errors)
            return Response(
                {
                    'error': {
                        'code': 'validation_error',
                        'message': (msgs[0] if msgs else 'Validation error'),
                        'messages': msgs,
                        'details': serializer.errors
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        instance = serializer.save(candidate=profile)
        return Response(EducationSerializer(instance).data, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f"Error in education_list_create: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def education_detail(request, education_id):
    """
    Retrieve/Update/Delete an education entry for the authenticated user.
    """
    try:
        user = request.user
        try:
            profile = CandidateProfile.objects.get(user=user)
        except CandidateProfile.DoesNotExist:
            return Response(
                {'error': {'code': 'profile_not_found', 'message': 'Profile not found.'}},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            edu = Education.objects.get(id=education_id, candidate=profile)
        except Education.DoesNotExist:
            return Response(
                {'error': {'code': 'education_not_found', 'message': 'Education entry not found.'}},
                status=status.HTTP_404_NOT_FOUND
            )

        if request.method == 'GET':
            return Response(EducationSerializer(edu).data, status=status.HTTP_200_OK)

        if request.method in ['PUT', 'PATCH']:
            partial = request.method == 'PATCH'
            serializer = EducationSerializer(edu, data=request.data, partial=partial)
            if not serializer.is_valid():
                msgs = _validation_messages(serializer.errors)
                return Response(
                    {
                        'error': {
                            'code': 'validation_error',
                            'message': (msgs[0] if msgs else 'Validation error'),
                            'messages': msgs,
                            'details': serializer.errors
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        # DELETE
        edu.delete()
        return Response({'message': 'Education entry deleted successfully.'}, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error in education_detail: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ======================
# UC-036: JOB ENTRIES
# ======================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def jobs_list_create(request):
    """List and create user job entries. UC-039: Supports search, filter, and sort."""
    try:
        user = request.user
        profile, _ = CandidateProfile.objects.get_or_create(user=user)

        if request.method == 'GET':
            # UC-039: Start with base queryset
            qs = JobEntry.objects.filter(candidate=profile)
            
            # Search by keywords in title, company_name, description
            search_query = request.GET.get('q', '').strip()
            if search_query:
                qs = qs.filter(
                    Q(title__icontains=search_query) |
                    Q(company_name__icontains=search_query) |
                    Q(description__icontains=search_query)
                )
            
            # Filter by industry
            industry = request.GET.get('industry', '').strip()
            if industry:
                qs = qs.filter(industry__icontains=industry)
            
            # Filter by location
            location = request.GET.get('location', '').strip()
            if location:
                qs = qs.filter(location__icontains=location)
            
            # Filter by job_type
            job_type = request.GET.get('job_type', '').strip()
            if job_type:
                qs = qs.filter(job_type=job_type)
            
            # Filter by salary range
            salary_min = request.GET.get('salary_min', '').strip()
            salary_max = request.GET.get('salary_max', '').strip()
            if salary_min:
                try:
                    qs = qs.filter(Q(salary_min__gte=int(salary_min)) | Q(salary_max__gte=int(salary_min)))
                except ValueError:
                    pass
            if salary_max:
                try:
                    qs = qs.filter(Q(salary_max__lte=int(salary_max)) | Q(salary_min__lte=int(salary_max)))
                except ValueError:
                    pass
            
            # Filter by deadline date range
            deadline_from = request.GET.get('deadline_from', '').strip()
            deadline_to = request.GET.get('deadline_to', '').strip()
            if deadline_from:
                try:
                    from datetime import datetime
                    date_obj = datetime.strptime(deadline_from, '%Y-%m-%d').date()
                    qs = qs.filter(application_deadline__gte=date_obj)
                except ValueError:
                    pass
            if deadline_to:
                try:
                    from datetime import datetime
                    date_obj = datetime.strptime(deadline_to, '%Y-%m-%d').date()
                    qs = qs.filter(application_deadline__lte=date_obj)
                except ValueError:
                    pass
            
            # Sorting
            sort_by = request.GET.get('sort', 'date_added').strip()
            if sort_by == 'deadline':
                qs = qs.order_by(F('application_deadline').asc(nulls_last=True), '-updated_at')
            elif sort_by == 'salary':
                qs = qs.order_by(F('salary_max').desc(nulls_last=True), F('salary_min').desc(nulls_last=True), '-updated_at')
            elif sort_by == 'company_name':
                qs = qs.order_by('company_name', '-updated_at')
            else:  # date_added (default)
                qs = qs.order_by('-updated_at', '-id')
            
            results = JobEntrySerializer(qs, many=True).data
            return Response({
                'results': results,
                'count': len(results),
                'search_query': search_query
            }, status=status.HTTP_200_OK)

        # POST
        serializer = JobEntrySerializer(data=request.data)
        if not serializer.is_valid():
            msgs = _validation_messages(serializer.errors)
            return Response(
                {
                    'error': {
                        'code': 'validation_error',
                        'message': (msgs[0] if msgs else 'Validation error'),
                        'messages': msgs,
                        'details': serializer.errors,
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance = serializer.save(candidate=profile)
        data = JobEntrySerializer(instance).data
        data['message'] = 'Job entry saved successfully.'
        return Response(data, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Error in jobs_list_create: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def job_detail(request, job_id):
    """Retrieve/Update/Delete a job entry for the authenticated user."""
    try:
        try:
            profile = CandidateProfile.objects.get(user=request.user)
        except CandidateProfile.DoesNotExist:
            return Response(
                {'error': {'code': 'profile_not_found', 'message': 'Profile not found.'}},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            job = JobEntry.objects.get(id=job_id, candidate=profile)
        except JobEntry.DoesNotExist:
            return Response(
                {'error': {'code': 'job_not_found', 'message': 'Job entry not found.'}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.method == 'GET':
            return Response(JobEntrySerializer(job).data, status=status.HTTP_200_OK)

        if request.method in ['PUT', 'PATCH']:
            partial = request.method == 'PATCH'
            serializer = JobEntrySerializer(job, data=request.data, partial=partial)
            if not serializer.is_valid():
                msgs = _validation_messages(serializer.errors)
                return Response(
                    {
                        'error': {
                            'code': 'validation_error',
                            'message': (msgs[0] if msgs else 'Validation error'),
                            'messages': msgs,
                            'details': serializer.errors,
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        # DELETE
        job.delete()
        return Response({'message': 'Job entry deleted successfully.'}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error in job_detail: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_job_from_url(request):
    """
    SCRUM-39: Import job details from a job posting URL.
    
    Supports LinkedIn, Indeed, and Glassdoor URLs.
    
    POST Request Body:
    {
        "url": "https://www.linkedin.com/jobs/view/123456"
    }
    
    Response:
    {
        "status": "success|partial|failed",
        "data": {
            "title": "Software Engineer",
            "company_name": "Acme Inc",
            "description": "...",
            "location": "New York, NY",
            "job_type": "ft",
            "posting_url": "..."
        },
        "fields_extracted": ["title", "company_name", "description", ...],
        "error": "Error message if failed"
    }
    """
    try:
        from core.job_import_utils import import_job_from_url as do_import
        
        url = request.data.get('url', '').strip()
        
        if not url:
            return Response(
                {
                    'error': {
                        'code': 'missing_url',
                        'message': 'URL is required',
                        'messages': ['Please provide a job posting URL']
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Perform import
        result = do_import(url)
        
        # Return result
        response_data = result.to_dict()
        
        if result.status == 'failed':
            return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error importing job from URL: {e}")
        return Response(
            {
                'error': {
                    'code': 'import_failed',
                    'message': 'Failed to import job details from URL',
                    'messages': [str(e)]
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ======================
# UC-030: CERTIFICATIONS VIEWS
# ======================

# Predefined categories (can be expanded later or driven from data)
CERTIFICATION_CATEGORIES = [
    "Cloud",
    "Security",
    "Project Management",
    "Data & Analytics",
    "Networking",
    "Software Development",
    "DevOps",
    "Design / UX",
    "Healthcare",
    "Finance",
    "Other",
]


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def certification_categories(request):
    return Response(CERTIFICATION_CATEGORIES, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def certification_org_search(request):
    """Autocomplete search for issuing organizations"""
    query = request.GET.get('q', '').strip()
    limit = int(request.GET.get('limit', 10))
    if len(query) < 2:
        return Response(
            {'error': {'code': 'invalid_query', 'message': 'Search query must be at least 2 characters.'}},
            status=status.HTTP_400_BAD_REQUEST
        )
    # Search distinct orgs in DB
    orgs = (
        Certification.objects
        .filter(issuing_organization__icontains=query)
        .values_list('issuing_organization', flat=True)
        .distinct()[:limit]
    )
    # Seed common orgs if DB is empty
    if not orgs:
        seed = [
            # Cloud & Platform
            'Amazon Web Services (AWS)',
            'Microsoft',
            'Google Cloud',
            'Oracle',
            'IBM',
            'Red Hat',
            'VMware',
            'Salesforce',
            'ServiceNow',
            'SAP',
            'Linux Foundation',
            'Cloud Native Computing Foundation (CNCF)',

            # Networking & Security Vendors
            'Cisco',
            'Palo Alto Networks',
            'Fortinet',
            'Juniper Networks',

            # Security & Governance Bodies
            '(ISC)²',
            'ISACA',
            'GIAC',
            'EC-Council',
            'Offensive Security',

            # IT Generalist / Ops
            'CompTIA',
            'Atlassian',
            'HashiCorp',

            # Data & Analytics
            'Snowflake',
            'Databricks',
            'Tableau',
            'MongoDB',
            'Elastic',

            # Agile / Project / ITSM
            'PMI',
            'Scrum Alliance',
            'Scrum.org',
            'Scaled Agile (SAFe)',
            'AXELOS / PeopleCert (ITIL)',

            # Other notable issuers
            'Adobe',
            'NVIDIA',
        ]
        orgs = [o for o in seed if query.lower() in o.lower()][:limit]
    return Response(list(orgs), status=status.HTTP_200_OK)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def certifications_list_create(request):
    """
    List and create certifications for the authenticated user.

    GET: list all
    POST: create (supports multipart for document upload)
    """
    try:
        user = request.user
        profile, _ = CandidateProfile.objects.get_or_create(user=user)

        if request.method == 'GET':
            qs = Certification.objects.filter(candidate=profile).order_by('-issue_date', '-id')
            return Response(CertificationSerializer(qs, many=True, context={'request': request}).data, status=status.HTTP_200_OK)

        # POST create
        data = request.data.copy()
        serializer = CertificationSerializer(data=data, context={'request': request})
        if not serializer.is_valid():
            msgs = _validation_messages(serializer.errors)
            return Response(
                {
                    'error': {
                        'code': 'validation_error',
                        'message': (msgs[0] if msgs else 'Validation error'),
                        'messages': msgs,
                        'details': serializer.errors
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        instance = serializer.save(candidate=profile)

        # Handle file upload if present
        document = request.FILES.get('document')
        if document:
            instance.document = document
            instance.save()

        return Response(CertificationSerializer(instance, context={'request': request}).data, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Error in certifications_list_create: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def certification_detail(request, certification_id):
    """Retrieve/Update/Delete a certification"""
    try:
        user = request.user
        try:
            profile = CandidateProfile.objects.get(user=user)
        except CandidateProfile.DoesNotExist:
            return Response(
                {'error': {'code': 'profile_not_found', 'message': 'Profile not found.'}},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            cert = Certification.objects.get(id=certification_id, candidate=profile)
        except Certification.DoesNotExist:
            return Response(
                {'error': {'code': 'certification_not_found', 'message': 'Certification not found.'}},
                status=status.HTTP_404_NOT_FOUND
            )

        if request.method == 'GET':
            return Response(CertificationSerializer(cert, context={'request': request}).data, status=status.HTTP_200_OK)

        if request.method in ['PUT', 'PATCH']:
            partial = request.method == 'PATCH'
            data = request.data.copy()
            serializer = CertificationSerializer(cert, data=data, partial=partial, context={'request': request})
            if not serializer.is_valid():
                msgs = _validation_messages(serializer.errors)
                return Response(
                    {
                        'error': {
                            'code': 'validation_error',
                            'message': (msgs[0] if msgs else 'Validation error'),
                            'messages': msgs,
                            'details': serializer.errors
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            instance = serializer.save()

            # Update document if provided
            document = request.FILES.get('document')
            if document is not None:
                instance.document = document
                instance.save()
            # Allow clearing document by sending empty value
            elif 'document' in request.data and (request.data.get('document') in ['', None]):
                instance.document = None
                instance.save()

            return Response(CertificationSerializer(instance, context={'request': request}).data, status=status.HTTP_200_OK)

        # DELETE
        cert.delete()
        return Response({'message': 'Certification deleted successfully.'}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error in certification_detail: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    
# ======================
# UC-031: PROJECTS VIEWS
# ======================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def projects_list_create(request):
    """List and create projects for the authenticated user.

    GET: list all
    POST: create (supports multipart for media uploads using key 'media')
    """
    try:
        user = request.user
        profile, _ = CandidateProfile.objects.get_or_create(user=user)

        if request.method == 'GET':
            qs = Project.objects.filter(candidate=profile)

            # Filtering
            q = request.query_params.get('q') or request.query_params.get('search')
            industry = request.query_params.get('industry')
            status_param = request.query_params.get('status')
            tech = request.query_params.get('tech') or request.query_params.get('technology')
            date_from = request.query_params.get('date_from')
            date_to = request.query_params.get('date_to')
            match = (request.query_params.get('match') or 'any').lower()  # any|all for tech

            if q:
                # simple relevance via conditional scoring
                name_hit = Case(When(name__icontains=q, then=Value(3)), default=Value(0), output_field=IntegerField())
                desc_hit = Case(When(description__icontains=q, then=Value(2)), default=Value(0), output_field=IntegerField())
                outc_hit = Case(When(outcomes__icontains=q, then=Value(1)), default=Value(0), output_field=IntegerField())
                role_hit = Case(When(role__icontains=q, then=Value(1)), default=Value(0), output_field=IntegerField())
                tech_hit = Case(When(skills_used__name__icontains=q, then=Value(2)), default=Value(0), output_field=IntegerField())
                qs = qs.annotate(relevance=(name_hit + desc_hit + outc_hit + role_hit + tech_hit))
                # Base text filter
                qs = qs.filter(
                    Q(name__icontains=q) | Q(description__icontains=q) | Q(outcomes__icontains=q) | Q(role__icontains=q) | Q(skills_used__name__icontains=q)
                )

            if industry:
                qs = qs.filter(industry__icontains=industry)

            if status_param:
                qs = qs.filter(status=status_param)

            if tech:
                tech_list = [t.strip() for t in tech.split(',') if t.strip()]
                if tech_list:
                    if match == 'all':
                        # Ensure project has all techs: chain filters
                        for t in tech_list:
                            qs = qs.filter(skills_used__name__iexact=t)
                    else:
                        qs = qs.filter(skills_used__name__in=tech_list)

            # Date range: filter by start_date/end_date overlapping window
            # If only date_from: projects ending after or starting after date_from
            if date_from:
                qs = qs.filter(Q(start_date__gte=date_from) | Q(end_date__gte=date_from))
            if date_to:
                qs = qs.filter(Q(end_date__lte=date_to) | Q(start_date__lte=date_to))

            qs = qs.distinct()

            # Sorting
            sort = (request.query_params.get('sort') or 'date_desc').lower()
            if sort == 'date_asc':
                qs = qs.order_by('start_date', 'created_at', 'id')
            elif sort == 'custom':
                qs = qs.order_by('display_order', '-start_date', '-created_at', '-id')
            elif sort == 'created_asc':
                qs = qs.order_by('created_at')
            elif sort == 'created_desc':
                qs = qs.order_by('-created_at')
            elif sort == 'updated_asc':
                qs = qs.order_by('updated_at')
            elif sort == 'updated_desc':
                qs = qs.order_by('-updated_at')
            elif sort == 'relevance' and q:
                qs = qs.order_by('-relevance', 'display_order', '-start_date', '-created_at')
            else:
                # date_desc default
                qs = qs.order_by('-start_date', '-created_at', '-id')

            data = ProjectSerializer(qs, many=True, context={'request': request}).data
            return Response(data, status=status.HTTP_200_OK)

        # POST create
        payload = request.data.copy()
        # If technologies is a comma-separated string, split it
        techs = payload.get('technologies')
        if isinstance(techs, str):
            # Allow JSON list string or comma-separated
            import json
            try:
                parsed = json.loads(techs)
                if isinstance(parsed, list):
                    payload.setlist('technologies', parsed) if hasattr(payload, 'setlist') else payload.update({'technologies': parsed})
            except Exception:
                payload['technologies'] = [t.strip() for t in techs.split(',') if t.strip()]

        serializer = ProjectSerializer(data=payload, context={'request': request})
        if not serializer.is_valid():
            msgs = _validation_messages(serializer.errors)
            return Response(
                {
                    'error': {
                        'code': 'validation_error',
                        'message': (msgs[0] if msgs else 'Validation error'),
                        'messages': msgs,
                        'details': serializer.errors
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        project = serializer.save(candidate=profile)

        # Handle media files (multiple allowed)
        files = request.FILES.getlist('media')
        for idx, f in enumerate(files):
            ProjectMedia.objects.create(project=project, image=f, order=idx)

        return Response(ProjectSerializer(project, context={'request': request}).data, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Error in projects_list_create: {e}\n{traceback.format_exc()}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def project_detail(request, project_id):
    """Retrieve/Update/Delete a project; PATCH/PUT may accept additional 'media' files to append."""
    try:
        user = request.user
        try:
            profile = CandidateProfile.objects.get(user=user)
        except CandidateProfile.DoesNotExist:
            return Response(
                {'error': {'code': 'profile_not_found', 'message': 'Profile not found.'}},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            project = Project.objects.get(id=project_id, candidate=profile)
        except Project.DoesNotExist:
            return Response(
                {'error': {'code': 'project_not_found', 'message': 'Project not found.'}},
                status=status.HTTP_404_NOT_FOUND
            )

        if request.method == 'GET':
            return Response(ProjectSerializer(project, context={'request': request}).data, status=status.HTTP_200_OK)

        if request.method in ['PUT', 'PATCH']:
            partial = request.method == 'PATCH'
            payload = request.data.copy()
            techs = payload.get('technologies')
            if isinstance(techs, str):
                import json
                try:
                    parsed = json.loads(techs)
                    if isinstance(parsed, list):
                        payload.setlist('technologies', parsed) if hasattr(payload, 'setlist') else payload.update({'technologies': parsed})
                except Exception:
                    payload['technologies'] = [t.strip() for t in techs.split(',') if t.strip()]

            serializer = ProjectSerializer(project, data=payload, partial=partial, context={'request': request})
            if not serializer.is_valid():
                msgs = _validation_messages(serializer.errors)
                return Response(
                    {
                        'error': {
                            'code': 'validation_error',
                            'message': (msgs[0] if msgs else 'Validation error'),
                            'messages': msgs,
                            'details': serializer.errors
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            instance = serializer.save()

            # Append any uploaded media
            files = request.FILES.getlist('media')
            if files:
                # continue ordering from last
                start_order = (instance.media.aggregate(m=models.Max('order')).get('m') or 0) + 1
                for offset, f in enumerate(files):
                    ProjectMedia.objects.create(project=instance, image=f, order=start_order + offset)

            return Response(ProjectSerializer(instance, context={'request': request}).data, status=status.HTTP_200_OK)

        # DELETE
        project.delete()
        return Response({'message': 'Project deleted successfully.'}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error in project_detail: {e}\n{traceback.format_exc()}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def project_media_upload(request, project_id):
    """Upload one or more media files for a project. Field name: 'media' (multiple)."""
    try:
        user = request.user
        profile = CandidateProfile.objects.get(user=user)
        project = Project.objects.get(id=project_id, candidate=profile)
        files = request.FILES.getlist('media')
        if not files:
            return Response({'error': {'code': 'no_files', 'message': 'No files provided.'}}, status=status.HTTP_400_BAD_REQUEST)
        start_order = (project.media.aggregate(m=models.Max('order')).get('m') or 0) + 1
        created = []
        for i, f in enumerate(files):
            m = ProjectMedia.objects.create(project=project, image=f, order=start_order + i)
            created.append(m)
        return Response(ProjectMediaSerializer(created, many=True, context={'request': request}).data, status=status.HTTP_201_CREATED)
    except CandidateProfile.DoesNotExist:
        return Response({'error': {'code': 'profile_not_found', 'message': 'Profile not found.'}}, status=status.HTTP_404_NOT_FOUND)
    except Project.DoesNotExist:
        return Response({'error': {'code': 'project_not_found', 'message': 'Project not found.'}}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in project_media_upload: {e}\n{traceback.format_exc()}")
        return Response({'error': {'code': 'internal_error', 'message': 'Failed to upload media.'}}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Wrapper for profile/projects/<int:pk> -> projects_detail
@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def projects_detail(request, pk: int):
    django_request = getattr(request, '_request', request)
    return project_detail(django_request, project_id=pk)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def project_media_delete(request, project_id, media_id):
    """Delete a specific media item from a project."""
    try:
        user = request.user
        profile = CandidateProfile.objects.get(user=user)
        project = Project.objects.get(id=project_id, candidate=profile)
        media = ProjectMedia.objects.get(id=media_id, project=project)
        media.delete()
        return Response({'message': 'Media deleted successfully.'}, status=status.HTTP_200_OK)
    except CandidateProfile.DoesNotExist:
        return Response({'error': {'code': 'profile_not_found', 'message': 'Profile not found.'}}, status=status.HTTP_404_NOT_FOUND)
    except Project.DoesNotExist:
        return Response({'error': {'code': 'project_not_found', 'message': 'Project not found.'}}, status=status.HTTP_404_NOT_FOUND)
    except ProjectMedia.DoesNotExist:
        return Response({'error': {'code': 'media_not_found', 'message': 'Media not found.'}}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in project_media_delete: {e}\n{traceback.format_exc()}")
        return Response({'error': {'code': 'internal_error', 'message': 'Failed to delete media.'}}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ======================
# UC-023, UC-024, UC-025: EMPLOYMENT HISTORY VIEWS
# ======================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def employment_list_create(request):
    """
    UC-023: Employment History - Add Entry
    UC-024: Employment History - View (List)
    
    GET: List all employment history entries for the authenticated user
    POST: Create a new employment history entry
    
    **GET Response**:
    [
        {
            "id": 1,
            "company_name": "Tech Corp",
            "job_title": "Senior Software Engineer",
            "location": "San Francisco, CA",
            "start_date": "2020-01-15",
            "end_date": "2023-06-30",
            "is_current": false,
            "description": "Led development of...",
            "achievements": ["Increased performance by 40%", "Led team of 5 engineers"],
            "skills_used": [{"id": 1, "name": "Python", "category": "Technical"}],
            "duration": "3 years, 5 months",
            "formatted_dates": "Jan 2020 - Jun 2023"
        }
    ]
    
    **POST Request Body**:
    {
        "company_name": "Tech Corp",
        "job_title": "Senior Software Engineer",
        "location": "San Francisco, CA",
        "start_date": "2020-01-15",
        "end_date": "2023-06-30",  // Optional if is_current = true
        "is_current": false,
        "description": "Led development of cloud infrastructure...",
        "achievements": ["Increased performance by 40%"],
        "skills_used_names": ["Python", "AWS", "Docker"]
    }
    """
    try:
        user = request.user
        profile = CandidateProfile.objects.get(user=user)
        
        if request.method == 'GET':
            # Get all employment entries ordered by start_date (most recent first)
            from core.models import WorkExperience
            from core.serializers import WorkExperienceSerializer
            
            work_experiences = WorkExperience.objects.filter(candidate=profile).order_by('-start_date')
            serializer = WorkExperienceSerializer(work_experiences, many=True, context={'request': request})
            
            return Response({
                'employment_history': serializer.data,
                'total_entries': work_experiences.count()
            }, status=status.HTTP_200_OK)
        
        elif request.method == 'POST':
            # Create new employment entry
            from core.models import WorkExperience
            from core.serializers import WorkExperienceSerializer
            
            serializer = WorkExperienceSerializer(data=request.data, context={'request': request})
            
            if serializer.is_valid():
                serializer.save(candidate=profile)
                
                logger.info(f"Employment entry created for user {user.email}: {serializer.data.get('job_title')} at {serializer.data.get('company_name')}")
                
                return Response({
                    'message': 'Employment entry added successfully.',
                    'employment': serializer.data
                }, status=status.HTTP_201_CREATED)
            
            logger.warning(f"Invalid employment data from user {user.email}: {serializer.errors}")
            return Response({
                'error': {
                    'code': 'validation_error',
                    'message': 'Invalid employment data.',
                    'details': serializer.errors
                }
            }, status=status.HTTP_400_BAD_REQUEST)
    
    except CandidateProfile.DoesNotExist:
        # Create profile if it doesn't exist
        if request.method == 'GET':
            return Response({'employment_history': [], 'total_entries': 0}, status=status.HTTP_200_OK)
        else:
            profile = CandidateProfile.objects.create(user=user)
            return employment_list_create(request)  # Retry with created profile
    
    except Exception as e:
        logger.error(f"Error in employment_list_create: {e}\n{traceback.format_exc()}")
        return Response({
            'error': {
                'code': 'internal_error',
                'message': 'Failed to process employment history request.'
            }
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def employment_detail(request, employment_id):
    """
    UC-024: Employment History - View and Edit
    UC-025: Employment History - Delete Entry
    
    GET: Retrieve a specific employment entry
    PUT/PATCH: Update an employment entry
    DELETE: Delete an employment entry (with confirmation)
    
    **GET Response**:
    {
        "id": 1,
        "company_name": "Tech Corp",
        "job_title": "Senior Software Engineer",
        ...
    }
    
    **PUT/PATCH Request Body** (UC-024):
    {
        "company_name": "Tech Corp Updated",
        "job_title": "Lead Software Engineer",
        "location": "Remote",
        "start_date": "2020-01-15",
        "end_date": null,
        "is_current": true,
        "description": "Updated description...",
        "achievements": ["New achievement"],
        "skills_used_names": ["Python", "Go", "Kubernetes"]
    }
    
    **DELETE Response** (UC-025):
    {
        "message": "Employment entry deleted successfully."
    }
    """
    try:
        user = request.user
        profile = CandidateProfile.objects.get(user=user)
        
        from core.models import WorkExperience
        from core.serializers import WorkExperienceSerializer
        
        # Get the employment entry
        try:
            employment = WorkExperience.objects.get(id=employment_id, candidate=profile)
        except WorkExperience.DoesNotExist:
            return Response({
                'error': {
                    'code': 'employment_not_found',
                    'message': 'Employment entry not found.'
                }
            }, status=status.HTTP_404_NOT_FOUND)
        
        if request.method == 'GET':
            # Retrieve employment entry details
            serializer = WorkExperienceSerializer(employment, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        elif request.method in ['PUT', 'PATCH']:
            # Update employment entry (UC-024)
            partial = request.method == 'PATCH'
            serializer = WorkExperienceSerializer(
                employment,
                data=request.data,
                partial=partial,
                context={'request': request}
            )
            
            if serializer.is_valid():
                serializer.save()
                
                logger.info(f"Employment entry {employment_id} updated by user {user.email}")
                
                return Response({
                    'message': 'Employment entry updated successfully.',
                    'employment': serializer.data
                }, status=status.HTTP_200_OK)
            
            logger.warning(f"Invalid employment update data from user {user.email}: {serializer.errors}")
            return Response({
                'error': {
                    'code': 'validation_error',
                    'message': 'Invalid employment data.',
                    'details': serializer.errors
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        elif request.method == 'DELETE':
            # Delete employment entry (UC-025)
            company_name = employment.company_name
            job_title = employment.job_title
            
            employment.delete()
            
            logger.info(f"Employment entry {employment_id} ({job_title} at {company_name}) deleted by user {user.email}")
            
            return Response({
                'message': 'Employment entry deleted successfully.'
            }, status=status.HTTP_200_OK)
    
    except CandidateProfile.DoesNotExist:
        return Response({
            'error': {
                'code': 'profile_not_found',
                'message': 'Profile not found.'
            }
        }, status=status.HTTP_404_NOT_FOUND)
    
    except Exception as e:
        logger.error(f"Error in employment_detail: {e}\n{traceback.format_exc()}")
        return Response({
            'error': {
                'code': 'internal_error',
                'message': 'Failed to process employment request.'
            }
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def employment_timeline(request):
    """
    Get employment history in timeline format for career progression visualization.
    
    **Response**:
    {
        "timeline": [
            {
                "id": 1,
                "company_name": "Tech Corp",
                "job_title": "Senior Engineer",
                "start_date": "2020-01-15",
                "end_date": "2023-06-30",
                "is_current": false,
                "duration": "3y 5m",
                "formatted_dates": "Jan 2020 - Jun 2023"
            }
        ],
        "total_years_experience": 5.4,
        "companies_count": 3,
        "current_position": {
            "company_name": "Current Corp",
            "job_title": "Lead Engineer"
        }
    }
    """
    try:
        user = request.user
        profile = CandidateProfile.objects.get(user=user)
        
        from core.models import WorkExperience
        from core.serializers import WorkExperienceSummarySerializer
        from datetime import date
        from dateutil.relativedelta import relativedelta
        
        work_experiences = WorkExperience.objects.filter(candidate=profile).order_by('-start_date')
        serializer = WorkExperienceSummarySerializer(work_experiences, many=True, context={'request': request})
        
        # Calculate total years of experience
        total_months = 0
        for exp in work_experiences:
            start = exp.start_date
            end = exp.end_date if exp.end_date else date.today()
            delta = relativedelta(end, start)
            total_months += delta.years * 12 + delta.months
        
        total_years = round(total_months / 12, 1)
        
        # Get current position
        current_position = work_experiences.filter(is_current=True).first()
        current_position_data = None
        if current_position:
            current_position_data = {
                'company_name': current_position.company_name,
                'job_title': current_position.job_title,
                'location': current_position.location
            }
        
        # Count unique companies
        companies_count = work_experiences.values('company_name').distinct().count()
        
        return Response({
            'timeline': serializer.data,
            'total_years_experience': total_years,
            'companies_count': companies_count,
            'current_position': current_position_data
        }, status=status.HTTP_200_OK)
    
    except CandidateProfile.DoesNotExist:
        return Response({
            'timeline': [],
            'total_years_experience': 0,
            'companies_count': 0,
            'current_position': None
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error in employment_timeline: {e}\n{traceback.format_exc()}")
        return Response({
            'error': {
                'code': 'internal_error',
                'message': 'Failed to generate employment timeline.'
            }
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

