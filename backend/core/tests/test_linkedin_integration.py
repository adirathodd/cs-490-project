"""
Tests for LinkedIn OAuth integration and AI features (UC-089)
"""
from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from unittest.mock import patch, Mock, MagicMock
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

from core.models import CandidateProfile, LinkedInIntegration

User = get_user_model()


class LinkedInOAuthTests(APITestCase):
    """Test LinkedIn OAuth flow"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
    
    def test_oauth_initiate(self):
        """Test LinkedIn OAuth initialization"""
        response = self.client.get('/api/auth/oauth/linkedin/initiate')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('auth_url', response.data)
        self.assertIn('linkedin.com', response.data['auth_url'])
    
    @patch('core.linkedin_integration.fetch_linkedin_profile')
    @patch('core.linkedin_integration.exchange_code_for_tokens')
    def test_oauth_callback_success(self, mock_exchange, mock_fetch):
        """Test successful LinkedIn OAuth callback"""
        # Mock token exchange
        mock_exchange.return_value = {
            'access_token': 'test_access_token',
            'expires_in': 5184000
        }
        
        # Mock profile fetch
        mock_fetch.return_value = {
            'linkedin_id': 'linkedin123',
            'first_name': 'John',
            'last_name': 'Doe',
            'headline': 'Software Engineer at Tech Corp',
            'profile_picture_url': 'http://example.com/photo.jpg',
            'email': 'john@example.com'
        }
        
        # Set state token in cache (not session)
        from django.core.cache import cache
        cache_key = f'linkedin_oauth_state_{self.user.id}'
        cache.set(cache_key, 'test_state_token', timeout=600)
        
        # Make callback request
        response = self.client.post('/api/auth/oauth/linkedin/callback', {
            'code': 'test_auth_code',
            'state': 'test_state_token'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertIn('profile', response.data)
        
        # Verify profile was updated
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.headline, 'Software Engineer at Tech Corp')
        self.assertTrue(self.profile.linkedin_imported)
        self.assertIsNotNone(self.profile.linkedin_import_date)
        
        # Verify LinkedIn integration was created
        integration = LinkedInIntegration.objects.get(user=self.user)
        self.assertEqual(integration.linkedin_id, 'linkedin123')
        self.assertEqual(integration.import_status, 'synced')
    
    def test_oauth_callback_invalid_state(self):
        """Test OAuth callback with invalid state token"""
        # Set state token in session
        session = self.client.session
        session['linkedin_oauth_state'] = 'correct_state'
        session.save()
        
        # Try with wrong state
        response = self.client.post('/api/auth/oauth/linkedin/callback', {
            'code': 'test_code',
            'state': 'wrong_state'
        })
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_oauth_callback_missing_params(self):
        """Test OAuth callback with missing parameters"""
        response = self.client.post('/api/auth/oauth/linkedin/callback', {})
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)


class LinkedInIntegrationStatusTests(APITestCase):
    """Test LinkedIn integration status endpoint"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
    
    def test_status_not_connected(self):
        """Test status when LinkedIn is not connected"""
        response = self.client.get('/api/linkedin/integration-status')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['connected'])
        self.assertEqual(response.data['status'], 'not_connected')
    
    def test_status_connected(self):
        """Test status when LinkedIn is connected"""
        # Create integration
        integration = LinkedInIntegration.objects.create(
            user=self.user,
            linkedin_id='test123',
            linkedin_profile_url='https://linkedin.com/in/test123',
            import_status='synced',
            last_sync_date=timezone.now()
        )
        
        response = self.client.get('/api/linkedin/integration-status')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['connected'])
        self.assertEqual(response.data['status'], 'synced')
        self.assertEqual(response.data['linkedin_id'], 'test123')


class LinkedInAITests(APITestCase):
    """Test LinkedIn AI guidance features"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(
            user=self.user,
            headline='Software Engineer',
            summary='Experienced developer'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_profile_optimization(self):
        """Test profile optimization suggestions endpoint"""
        response = self.client.post('/api/linkedin/profile-optimization')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('suggestions', response.data)
        self.assertIn('generated_by', response.data)
    
    def test_networking_message_generation(self):
        """Test networking message generation"""
        payload = {
            'recipient_name': 'Jane Doe',
            'recipient_title': 'Engineering Manager',
            'company_name': 'Tech Corp',
            'purpose': 'connection_request',
            'tone': 'professional'
        }
        
        response = self.client.post('/api/linkedin/networking-message', payload)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertIn('character_count', response.data)
        self.assertEqual(response.data['purpose'], 'connection_request')
    
    def test_networking_message_missing_recipient(self):
        """Test networking message generation without recipient name"""
        payload = {
            'purpose': 'connection_request'
        }
        
        response = self.client.post('/api/linkedin/networking-message', payload)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_content_strategy(self):
        """Test content strategy generation"""
        response = self.client.get('/api/linkedin/content-strategy')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('strategy', response.data)
        self.assertIn('key_tips', response.data)
        self.assertIsInstance(response.data['key_tips'], list)


class LinkedInIntegrationModelTests(TestCase):
    """Test LinkedInIntegration model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com'
        )
    
    def test_create_integration(self):
        """Test creating LinkedIn integration"""
        integration = LinkedInIntegration.objects.create(
            user=self.user,
            linkedin_id='test123',
            linkedin_profile_url='https://linkedin.com/in/test123'
        )
        
        self.assertEqual(integration.user, self.user)
        self.assertEqual(integration.import_status, 'not_connected')
        self.assertIsNotNone(integration.created_at)
    
    def test_mark_connected(self):
        """Test marking integration as connected"""
        integration = LinkedInIntegration.objects.create(user=self.user)
        
        expires_at = timezone.now() + timedelta(days=60)
        integration.mark_connected(
            access_token='test_token',
            refresh_token='refresh_token',
            expires_at=expires_at,
            linkedin_id='test123',
            profile_url='https://linkedin.com/in/test123'
        )
        
        integration.refresh_from_db()
        self.assertEqual(integration.import_status, 'connected')
        self.assertEqual(integration.access_token, 'test_token')
        self.assertEqual(integration.linkedin_id, 'test123')
    
    def test_mark_synced(self):
        """Test marking integration as synced"""
        integration = LinkedInIntegration.objects.create(user=self.user)
        integration.mark_synced()
        
        integration.refresh_from_db()
        self.assertEqual(integration.import_status, 'synced')
        self.assertIsNotNone(integration.last_sync_date)
    
    def test_mark_error(self):
        """Test marking integration with error"""
        integration = LinkedInIntegration.objects.create(user=self.user)
        integration.mark_error('Connection failed')
        
        integration.refresh_from_db()
        self.assertEqual(integration.import_status, 'error')
        self.assertEqual(integration.last_error, 'Connection failed')
    
    def test_disconnect(self):
        """Test disconnecting integration"""
        integration = LinkedInIntegration.objects.create(
            user=self.user,
            access_token='test_token',
            linkedin_id='test123'
        )
        
        integration.disconnect()
        
        integration.refresh_from_db()
        self.assertEqual(integration.import_status, 'not_connected')
        self.assertEqual(integration.access_token, '')
        self.assertIsNone(integration.token_expires_at)


class CandidateProfileLinkedInFieldsTests(TestCase):
    """Test LinkedIn fields on CandidateProfile"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
    
    def test_linkedin_fields_default(self):
        """Test LinkedIn fields have correct defaults"""
        self.assertEqual(self.profile.linkedin_url, '')
        self.assertFalse(self.profile.linkedin_imported)
        self.assertIsNone(self.profile.linkedin_import_date)
    
    def test_set_linkedin_fields(self):
        """Test setting LinkedIn fields"""
        self.profile.linkedin_url = 'https://linkedin.com/in/testuser'
        self.profile.linkedin_imported = True
        self.profile.linkedin_import_date = timezone.now()
        self.profile.save()
        
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.linkedin_url, 'https://linkedin.com/in/testuser')
        self.assertTrue(self.profile.linkedin_imported)
        self.assertIsNotNone(self.profile.linkedin_import_date)
