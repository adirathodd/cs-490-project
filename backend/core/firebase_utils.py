"""
Firebase Admin SDK utilities for authentication and Firestore access.
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

import firebase_admin
from firebase_admin import credentials, auth, firestore
FIREBASE_AVAILABLE = True


_app = None
_db = None


def initialize_firebase() -> Optional[firebase_admin.App]:
    """
    Initialize Firebase Admin SDK.
    
    Returns:
        Firebase app instance or None if initialization fails
    """
    global _app
    
    if _app is not None:
        return _app
    
    if not FIREBASE_AVAILABLE:
        logger.error("Firebase Admin SDK is not available")
        return None
    
    cred_path = os.environ.get('FIREBASE_CREDENTIALS')
    
    if not cred_path:
        logger.warning("FIREBASE_CREDENTIALS environment variable not set")
        return None
    
    if not os.path.exists(cred_path):
        logger.error(f"Firebase credentials file not found at: {cred_path}")
        return None
    
    try:
        cred = credentials.Certificate(cred_path)
        _app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK initialized successfully")
        return _app
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        return None


def get_firestore_client():
    """
    Get Firestore client instance.
    
    Returns:
        Firestore client or None
    """
    global _db
    
    if _db is not None:
        return _db
    
    if initialize_firebase() is None:
        return None
    
    try:
        _db = firestore.client()
        return _db
    except Exception as e:
        logger.error(f"Failed to get Firestore client: {e}")
        return None


def verify_firebase_token(id_token: str) -> Optional[dict]:
    """
    Verify a Firebase ID token.
    
    Args:
        id_token: Firebase ID token from client
        
    Returns:
        Decoded token claims or None if verification fails
    """
    if initialize_firebase() is None:
        return None
    
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        return None


def get_user_by_email(email: str) -> Optional[dict]:
    """
    Get Firebase user by email.
    
    Args:
        email: User email address
        
    Returns:
        User record or None
    """
    if initialize_firebase() is None:
        return None
    
    try:
        user = auth.get_user_by_email(email)
        return {
            'uid': user.uid,
            'email': user.email,
            'display_name': user.display_name,
            'photo_url': user.photo_url,
            'disabled': user.disabled,
        }
    except Exception as e:
        logger.error(f"Failed to get user by email: {e}")
        return None


def create_firebase_user(email: str, password: str, display_name: Optional[str] = None) -> Optional[dict]:
    """
    Create a new Firebase user.
    
    Args:
        email: User email
        password: User password
        display_name: Optional display name
        
    Returns:
        User record or None
    """
    if initialize_firebase() is None:
        return None
    
    try:
        user = auth.create_user(
            email=email,
            password=password,
            display_name=display_name
        )
        return {
            'uid': user.uid,
            'email': user.email,
            'display_name': user.display_name,
        }
    except Exception as e:
        logger.error(f"Failed to create Firebase user: {e}")
        return None
