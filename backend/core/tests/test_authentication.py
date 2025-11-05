"""
UC-035: Authentication Tests
Tests for user registration, login, logout, OAuth, and token verification.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from unittest.mock import patch, MagicMock, Mock
from core.models import CandidateProfile, UserAccount
import json

User = get_user_model()


class UserRegistrationTests(APITestCase):
    """Test user registration functionality (UC-001)"""
    
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register'
        self.valid_payload = {
            'email': 'newuser@example.com',
            'password': 'SecurePass123!',
            'confirm_password': 'SecurePass123!',
            'first_name': 'John',
            'last_name': 'Doe'
        }
    
    @patch('core.views.firebase_auth.create_user')
    @patch('core.views.firebase_auth.create_custom_token')
    @patch('core.views.initialize_firebase')
    def test_successful_registration(self, mock_init, mock_token, mock_create):
        """Test successful user registration with valid data"""
        mock_init.return_value = True
        mock_user = MagicMock()
        mock_user.uid = 'firebase_uid_123'
        mock_create.return_value = mock_user
        mock_token.return_value = b'custom_token_123'
        
        response = self.client.post(self.register_url, self.valid_payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('user', response.data)
        self.assertIn('profile', response.data)
        self.assertIn('token', response.data)
        
        # Verify Django user created
        user = User.objects.get(email='newuser@example.com')
        self.assertEqual(user.first_name, 'John')
        self.assertEqual(user.last_name, 'Doe')
        self.assertEqual(user.username, 'firebase_uid_123')
        
        # Verify profile created
        profile = CandidateProfile.objects.get(user=user)
        self.assertIsNotNone(profile)
        
        # Verify UserAccount created
        user_account = UserAccount.objects.get(user=user)
        self.assertEqual(user_account.email, 'newuser@example.com')
    
    def test_registration_password_mismatch(self):
        """Test registration fails when passwords don't match"""
        payload = self.valid_payload.copy()
        payload['confirm_password'] = 'DifferentPass123!'
        
        response = self.client.post(self.register_url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_registration_weak_password(self):
        """Test registration fails with weak password"""
        payload = self.valid_payload.copy()
        payload['password'] = 'weak'
        payload['confirm_password'] = 'weak'
        
        response = self.client.post(self.register_url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_registration_invalid_email(self):
        """Test registration fails with invalid email format"""
        payload = self.valid_payload.copy()
        payload['email'] = 'invalid_email'
        
        response = self.client.post(self.register_url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_registration_missing_first_name(self):
        """Test registration fails without first name"""
        payload = self.valid_payload.copy()
        del payload['first_name']
        
        response = self.client.post(self.register_url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_registration_missing_last_name(self):
        """Test registration fails without last name"""
        payload = self.valid_payload.copy()
        del payload['last_name']
        
        response = self.client.post(self.register_url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_registration_password_no_uppercase(self):
        """Test password must contain uppercase letter"""
        payload = self.valid_payload.copy()
        payload['password'] = 'securepass123!'
        payload['confirm_password'] = 'securepass123!'
        
        response = self.client.post(self.register_url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_registration_password_no_number(self):
        """Test password must contain number"""
        payload = self.valid_payload.copy()
        payload['password'] = 'SecurePass!'
        payload['confirm_password'] = 'SecurePass!'
        
        response = self.client.post(self.register_url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_registration_password_too_short(self):
        """Test password must be at least 8 characters"""
        payload = self.valid_payload.copy()
        payload['password'] = 'Pass1!'
        payload['confirm_password'] = 'Pass1!'
        
        response = self.client.post(self.register_url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TokenVerificationTests(APITestCase):
    """Test Firebase token verification"""
    
    def setUp(self):
        self.client = APIClient()
        self.verify_url = '/api/auth/verify-token'
        self.user = User.objects.create_user(
            username='test_uid',
            email='test@example.com',
            first_name='Test',
            last_name='User'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
    
    @patch('core.authentication.firebase_auth.verify_id_token')
    @patch('core.authentication.initialize_firebase')
    def test_valid_token_verification(self, mock_init, mock_verify):
        """Test verification with valid Firebase token"""
        mock_init.return_value = True
        mock_verify.return_value = {
            'uid': 'test_uid',
            'email': 'test@example.com'
        }
        
        response = self.client.post(
            self.verify_url,
            {'id_token': 'valid_token_123'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user', response.data)
    
    @patch('core.authentication.firebase_auth.verify_id_token')
    @patch('core.authentication.initialize_firebase')
    def test_invalid_token_verification(self, mock_init, mock_verify):
        """Test verification with invalid token"""
        mock_init.return_value = True
        mock_verify.side_effect = Exception('Invalid token')
        
        response = self.client.post(
            self.verify_url,
            {'id_token': 'invalid_token'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_missing_token(self):
        """Test verification without token"""
        response = self.client.post(self.verify_url, {}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LogoutTests(APITestCase):
    """Test logout functionality"""
    
    def setUp(self):
        self.client = APIClient()
        self.logout_url = '/api/auth/logout'
        self.user = User.objects.create_user(
            username='test_uid',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
    
    @patch('core.views.firebase_auth.revoke_refresh_tokens')
    @patch('core.views.initialize_firebase')
    def test_successful_logout(self, mock_init, mock_revoke):
        """Test successful logout"""
        mock_init.return_value = True
        mock_revoke.return_value = None
        
        response = self.client.post(self.logout_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
    
    def test_logout_unauthenticated(self):
        """Test logout requires authentication"""
        self.client.force_authenticate(user=None)
        
        response = self.client.post(self.logout_url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class OAuthGitHubTests(APITestCase):
    """Test GitHub OAuth integration"""
    
    def setUp(self):
        self.client = APIClient()
        self.oauth_url = '/api/auth/oauth/github'
    
    @patch('requests.get')
    @patch('core.views.firebase_auth.get_user')
    @patch('core.views.firebase_auth.create_user')
    @patch('core.views.firebase_auth.update_user')
    @patch('core.views.firebase_auth.create_custom_token')
    @patch('core.views.initialize_firebase')
    def test_github_oauth_new_user(self, mock_init, mock_token, mock_update, 
                                   mock_create, mock_get, mock_requests):
        """Test GitHub OAuth for new user"""
        mock_init.return_value = True
        
        # Mock GitHub API response
        mock_email_response = Mock()
        mock_email_response.json.return_value = [{
            'email': 'github@example.com',
            'verified': True,
            'primary': True
        }]
        mock_requests.return_value = mock_email_response
        
        # Mock Firebase user creation
        mock_fb_user = MagicMock()
        mock_fb_user.uid = 'github_uid_123'
        mock_create.return_value = mock_fb_user
        mock_token.return_value = b'custom_token'
        
        # Mock Firebase get_user to raise not found first
        from firebase_admin import auth as firebase_auth_module
        mock_get.side_effect = firebase_auth_module.UserNotFoundError('Not found')
        
        response = self.client.post(
            self.oauth_url,
            {'access_token': 'github_token_123'},
            format='json'
        )
        
        # Should create user and return success
        self.assertIn(response.status_code, [200, 201])


class PasswordValidationTests(TestCase):
    """Test password hashing and validation"""
    
    def test_password_hashing(self):
        """Test that passwords are properly hashed"""
        user = User.objects.create_user(
            username='test_user',
            email='test@example.com',
            password='TestPass123!'
        )
        
        # Password should be hashed
        self.assertNotEqual(user.password, 'TestPass123!')
        # Should be able to check password
        self.assertTrue(user.check_password('TestPass123!'))
        self.assertFalse(user.check_password('WrongPass'))
    
    def test_password_length_validation(self):
        """Test password minimum length validation"""
        from django.core.exceptions import ValidationError
        from django.contrib.auth.password_validation import validate_password
        
        with self.assertRaises(ValidationError):
            validate_password('short')
    
    def test_password_common_validation(self):
        """Test password common password validation"""
        from django.core.exceptions import ValidationError
        from django.contrib.auth.password_validation import validate_password
        
        with self.assertRaises(ValidationError):
            validate_password('password123')
