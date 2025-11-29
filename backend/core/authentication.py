"""
Custom authentication backend for Firebase tokens with Django REST Framework.
"""
from rest_framework import authentication
from rest_framework import exceptions
from django.contrib.auth import get_user_model
from core.firebase_utils import verify_firebase_token, initialize_firebase
from firebase_admin import auth as firebase_auth
import logging
import os
from django.utils import timezone
from django.core.files.base import ContentFile
from PIL import Image
import io
import re
from django.core.exceptions import MultipleObjectsReturned

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
            
            # Get or link the user record
            uid = decoded_token.get('uid')
            email = decoded_token.get('email')
            # Some providers (e.g., GitHub with private email) may omit email in ID token; try fetching from Firebase user record
            if uid and not email:
                try:
                    fu = firebase_auth.get_user(uid)
                    email = getattr(fu, 'email', None) or None
                except Exception:
                    email = None

            if not uid:
                raise exceptions.AuthenticationFailed('Invalid token payload')

            # Strategy:
            # 1) Prefer existing user by Firebase UID (username)
            # 2) Else, find by email (case-insensitive). If multiple, pick a canonical one deterministically.
            #    Link that user by setting username to UID (if no conflict)
            # 3) Else, create a new user
            created = False
            user = None
            try:
                user = User.objects.get(username=uid)
            except User.DoesNotExist:
                # Not found by UID; try link by email
                try:
                    user = User.objects.get(email__iexact=email)
                    # Link this Django user to Firebase UID if not already linked
                    if user.username != uid:
                        # Avoid rare collision
                        if not User.objects.filter(username=uid).exclude(pk=user.pk).exists():
                            user.username = uid
                            user.save(update_fields=['username'])
                        else:
                            logger.warning(f"Username collision for UID {uid}; keeping existing username for user {user.id}")
                except User.DoesNotExist:
                    # Create a brand new user
                    name = decoded_token.get('name', '') or ''
                    parts = name.split()
                    first = parts[0] if parts else ''
                    last = ' '.join(parts[1:]) if len(parts) > 1 else ''
                    user = User.objects.create_user(
                        username=uid,
                        email=(email or '').lower(),
                        first_name=first,
                        last_name=last,
                    )
                    created = True
                except MultipleObjectsReturned:
                    # Multiple users share the same email (legacy/bug). Choose a canonical user deterministically.
                    # Prefer earliest date_joined; fall back to lowest id.
                    try:
                        qs = User.objects.filter(email__iexact=email)
                        # Some custom user models may not have date_joined; use getattr check
                        if hasattr(User, 'DATE_JOINED_FIELD') or (hasattr(User, '_meta') and 'date_joined' in [f.name for f in User._meta.fields]):
                            canonical = qs.order_by('date_joined', 'id').first()
                        else:
                            canonical = qs.order_by('id').first()
                        user = canonical
                        if user and user.username != uid:
                            if not User.objects.filter(username=uid).exclude(pk=user.pk).exists():
                                user.username = uid
                                user.save(update_fields=['username'])
                            else:
                                logger.warning(f"Username collision while resolving duplicates for UID {uid}; canonical user id={user.id}")
                        # Log the duplicate condition for later clean-up/merge
                        dup_ids = list(qs.exclude(pk=user.pk).values_list('id', flat=True)) if user else []
                        if dup_ids:
                            logger.warning("Multiple Django users share the same email '%s'. Canonical user id=%s; duplicates=%s", email, getattr(user, 'id', None), dup_ids)
                    except Exception as e:
                        logger.error(f"Failed resolving duplicate users for email {email}: {e}")
                        # As a last resort, create a new user to avoid auth failure (but this shouldn't normally happen)
                        name = decoded_token.get('name', '') or ''
                        parts = name.split()
                        first = parts[0] if parts else ''
                        last = ' '.join(parts[1:]) if len(parts) > 1 else ''
                        user = User.objects.create_user(
                            username=uid,
                            email=(email or '').lower(),
                            first_name=first,
                            last_name=last,
                        )
                        created = True
            
            if created:
                logger.info(f"Created new user from Firebase token: {email}")
                # Create candidate profile automatically
                from core.models import CandidateProfile
                # Create application-level user account record with UUID
                try:
                    from core.models import UserAccount
                    # Ensure a unique UserAccount for this email
                    UserAccount.objects.get_or_create(user=user, defaults={'email': (email or '').lower()})
                except Exception:
                    # Not fatal if creation fails; will be retried in later flows
                    pass
                # Try to fetch additional info from Firebase user record (e.g., photo URL)
                try:
                    firebase_user = firebase_auth.get_user(uid)
                    display_name = firebase_user.display_name or decoded_token.get('name', '')
                    photo_url = getattr(firebase_user, 'photo_url', None)

                    # Update user fields if available
                    if display_name:
                        parts = display_name.split()
                        user.first_name = parts[0]
                        user.last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''
                        user.save()

                    profile = CandidateProfile.objects.create(user=user)
                    # Store profile picture URL in portfolio_url to make it accessible via existing serializers
                    if photo_url:
                                profile.portfolio_url = photo_url
                                profile.save()
                                # Try to download the remote photo once and save to ImageField to avoid hotlink/rate-limit issues
                                try:
                                    # Build candidate URLs (try to request a larger size if Google-style URL)
                                    def candidate_urls(url):
                                        urls = [url]
                                        try:
                                            # handle Google user content URLs e.g. '.../s96-c/photo.jpg' or '?sz=50'
                                            # replace '/sNN-c/' with '/s400-c/'
                                            m = re.search(r"/s(\d+)(-c)?/", url)
                                            if m:
                                                urls.insert(0, re.sub(r"/s(\d+)(-c)?/", "/s400-c/", url))
                                            # replace or add 'sz' param
                                            if 'sz=' in url:
                                                urls.insert(0, re.sub(r"(sz=)\d+", r"\1400", url))
                                            else:
                                                if '?' in url:
                                                    urls.append(url + '&sz=400')
                                                else:
                                                    urls.append(url + '?sz=400')
                                        except Exception:
                                            pass
                                        # dedupe preserving order
                                        seen = set()
                                        out = []
                                        for u in urls:
                                            if u not in seen:
                                                out.append(u); seen.add(u)
                                        return out

                                    urls_to_try = candidate_urls(photo_url)
                                    content = None
                                    content_type = ''
                                    status_code = None
                                    for u in urls_to_try:
                                        try:
                                            import requests
                                            resp = requests.get(u, timeout=6)
                                            status_code = resp.status_code
                                            if status_code == 200:
                                                content = resp.content
                                                content_type = resp.headers.get('Content-Type', '')
                                                break
                                        except Exception:
                                            try:
                                                from urllib.request import urlopen
                                                uresp = urlopen(u, timeout=6)
                                                s = getattr(uresp, 'getcode', lambda: None)()
                                                if s == 200 or s is None:
                                                    content = uresp.read()
                                                    content_type = uresp.headers.get_content_type() if hasattr(uresp, 'headers') else ''
                                                    break
                                            except Exception:
                                                continue

                                    if content:
                                        # Determine file extension
                                        ext = ''
                                        if content_type:
                                            if 'jpeg' in content_type:
                                                ext = 'jpg'
                                            elif 'png' in content_type:
                                                ext = 'png'
                                            elif 'gif' in content_type:
                                                ext = 'gif'
                                        if not ext:
                                            # Fallback: try to guess from bytes using Pillow
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

                                        filename = f"profile_{user.username}.{ext}"
                                        # Save to profile.profile_picture (ImageField)
                                        profile.profile_picture.save(filename, ContentFile(content), save=True)
                                        profile.profile_picture_uploaded_at = timezone.now()
                                        profile.save()
                                except Exception as e:
                                    # Non-fatal: log and continue using portfolio_url fallback
                                    logger.warning(f"Failed to download/save Google photo for {uid}: {e}")
                except Exception as e:
                    logger.warning(f"Could not fetch extra Firebase user info for {uid}: {e}")
                    CandidateProfile.objects.create(user=user)
            
            # Update email if it changed (normalize to lowercase)
            if user.email != (email or '').lower():
                user.email = (email or '').lower()
                user.save(update_fields=['email'])

            # Ensure a corresponding UserAccount exists and is synced to this email
            try:
                from core.models import UserAccount
                acc = getattr(user, 'account', None)
                if not acc:
                    UserAccount.objects.get_or_create(user=user, defaults={'email': (email or '').lower()})
                else:
                    if acc.email != (email or '').lower():
                        acc.email = (email or '').lower()
                        acc.save(update_fields=['email'])
            except Exception:
                # Non-fatal
                pass

            # Try to update user/profile fields from Firebase record on each auth
            try:
                firebase_user = firebase_auth.get_user(uid)
                display_name = firebase_user.display_name or decoded_token.get('name', '')
                photo_url = getattr(firebase_user, 'photo_url', None)

                # Update user's name from Firebase ONLY if the local name is blank.
                # Do not overwrite names the user has explicitly set in their profile.
                if display_name and not ((user.first_name or '').strip() or (user.last_name or '').strip()):
                    parts = display_name.split()
                    first = parts[0]
                    last = ' '.join(parts[1:]) if len(parts) > 1 else ''
                    if user.first_name != first or user.last_name != last:
                        user.first_name = first
                        user.last_name = last
                        user.save(update_fields=['first_name', 'last_name'])

                # Ensure CandidateProfile exists and update portfolio_url with photo if available
                from core.models import CandidateProfile
                profile, _ = CandidateProfile.objects.get_or_create(user=user)
                if photo_url and profile.portfolio_url != photo_url:
                    profile.portfolio_url = photo_url
                    profile.save()
            except Exception:
                # Non-fatal: if we can't fetch Firebase user info, continue
                pass
            
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
