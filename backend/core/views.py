"""
Authentication views for Firebase-based user registration and login.
"""
from rest_framework import status
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
)
from core.models import CandidateProfile, Skill, CandidateSkill, Education
from core.firebase_utils import create_firebase_user, initialize_firebase
from core.permissions import IsOwnerOrAdmin
from core.storage_utils import (
    process_profile_picture,
    delete_old_picture,
)
from django.db.models import Case, When, Value, IntegerField, F
from django.db.models.functions import Coalesce
import firebase_admin
from firebase_admin import auth as firebase_auth
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


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
        return Response(
            {'error': {'code': 'validation_error', 'message': 'Please check your input.', 'details': serializer.errors}},
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
                {'error': {'code': 'duplicate_email', 'message': 'A user with this email already exists.'}},
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
            user = User.objects.create_user(
                username=firebase_user.uid,  # Use Firebase UID as username
                email=email,
                first_name=first_name,
                last_name=last_name,
            )
            
            # Create candidate profile
            profile = CandidateProfile.objects.create(user=user)
            
            logger.info(f"Created Django user and profile for: {email}")
        except Exception as e:
            # Rollback: delete Firebase user if Django user creation fails
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
            'message': 'Registration successful. Welcome to ATS!'
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
        return Response(
            {'error': {'code': 'validation_error', 'message': 'Please check your input.', 'details': serializer.errors}},
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


@api_view(['GET', 'DELETE'])
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

        # Handle account deletion
        if request.method == 'DELETE':
            try:
                uid = user.username
                email = user.email

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
                user.delete()

                # Delete Firebase user
                try:
                    firebase_auth.delete_user(uid)
                except Exception as e:
                    logger.warning(f"Failed to delete Firebase user {uid}: {e}")

                # Send confirmation email
                try:
                    from django.core.mail import send_mail
                    from django.conf import settings

                    subject = 'Your account has been deleted'
                    message = (
                        'This is a confirmation that your account and all associated data have been permanently deleted from ATS.'
                    )
                    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'noreply@example.com'
                    if email:
                        send_mail(subject, message, from_email, [email], fail_silently=True)
                except Exception as e:
                    logger.warning(f"Failed to send account deletion email to {email}: {e}")

                return Response({'message': 'Account deleted successfully.'}, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Error deleting account for user {getattr(request.user, 'email', 'unknown')}: {e}")
                return Response(
                    {'error': {'code': 'deletion_failed', 'message': 'Failed to delete account.'}},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        # For GET, return profile as before
        profile = CandidateProfile.objects.get(user=user)

        user_serializer = UserSerializer(user)
        profile_serializer = UserProfileSerializer(profile)

        return Response({
            'user': user_serializer.data,
            'profile': profile_serializer.data,
        }, status=status.HTTP_200_OK)
    
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
                {'error': 'You do not have permission to access this profile'},
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
                {'error': 'You do not have permission to edit this profile'},
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
            serializer = BasicProfileSerializer(profile)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # PUT/PATCH
        partial = request.method == 'PATCH'
        serializer = BasicProfileSerializer(profile, data=request.data, partial=partial)

        if not serializer.is_valid():
            return Response(
                {'error': {'code': 'validation_error', 'message': 'Please check your input.', 'details': serializer.errors}},
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
            return Response(
                {'error': {'code': 'validation_error', 'message': 'Invalid file upload.', 'details': serializer.errors}},
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

        # Clear profile picture field
        profile.profile_picture = None
        profile.profile_picture_uploaded_at = None
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
            # List all user skills
            candidate_skills = CandidateSkill.objects.filter(candidate=profile).select_related('skill')
            serializer = CandidateSkillSerializer(candidate_skills, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        elif request.method == 'POST':
            # Add new skill
            serializer = CandidateSkillSerializer(data=request.data)
            
            if not serializer.is_valid():
                return Response(
                    {'error': {'code': 'validation_error', 'message': 'Please check your input.', 'details': serializer.errors}},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer.save(candidate=profile)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        logger.error(f"Error in skills_list_create: {e}")
        return Response(
            {'error': {'code': 'internal_error', 'message': 'An error occurred processing your request.'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


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
            return Response(
                {'error': {'code': 'validation_error', 'message': 'Please check your input.', 'details': serializer.errors}},
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
                return Response(
                    {'error': {'code': 'validation_error', 'message': 'Please check your input.', 'details': serializer.errors}},
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
