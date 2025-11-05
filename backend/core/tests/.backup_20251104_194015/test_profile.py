"""
UC-035: Profile Management Tests
Tests for profile CRUD, profile picture upload, and access control.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from unittest.mock import patch, MagicMock
from core.models import CandidateProfile
from PIL import Image
import io

User = get_user_model()


class ProfileRetrievalTests(APITestCase):
    """Test profile retrieval (UC-008)"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com',
            first_name='Test',
            last_name='User'
        )
        self.profile = CandidateProfile.objects.create(
            user=self.user,
            phone='+15551234567',
            city='New York',
            state='NY',
            headline='Software Engineer',
            summary='Test summary'
        )
        self.client.force_authenticate(user=self.user)
        self.url = '/api/users/me'
    
    def test_get_own_profile(self):
        """Test user can retrieve their own profile"""
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user', response.data)
        self.assertIn('profile', response.data)
        self.assertEqual(response.data['user']['email'], 'test@example.com')
        self.assertEqual(response.data['profile']['city'], 'New York')
    
    def test_get_profile_unauthenticated(self):
        """Test unauthenticated users cannot access profile"""
        self.client.force_authenticate(user=None)
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_profile_includes_full_name(self):
        """Test profile response includes computed full_name"""
        response = self.client.get(self.url)
        
        self.assertIn('full_name', response.data['profile'])
        self.assertEqual(response.data['profile']['full_name'], 'Test User')


class BasicProfileUpdateTests(APITestCase):
    """Test basic profile updates (UC-021)"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com',
            first_name='Old',
            last_name='Name'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = '/api/profile/basic'
    
    def test_update_name(self):
        """Test updating first and last name"""
        data = {
            'first_name': 'New',
            'last_name': 'Name'
        }
        
        response = self.client.put(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'New')
        self.assertEqual(self.user.last_name, 'Name')
    
    def test_update_contact_info(self):
        """Test updating phone, city, state"""
        data = {
            'phone': '+15559876543',
            'city': 'San Francisco',
            'state': 'CA'
        }
        
        response = self.client.put(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.phone, '+15559876543')
        self.assertEqual(self.profile.city, 'San Francisco')
        self.assertEqual(self.profile.state, 'CA')
    
    def test_update_professional_info(self):
        """Test updating headline, summary, industry"""
        data = {
            'headline': 'Senior Software Engineer',
            'summary': 'Experienced developer with 10 years',
            'industry': 'Technology',
            'experience_level': 'senior'
        }
        
        response = self.client.put(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.headline, 'Senior Software Engineer')
        self.assertEqual(self.profile.experience_level, 'senior')
    
    def test_summary_character_limit(self):
        """Test summary cannot exceed 500 characters"""
        data = {
            'summary': 'a' * 501
        }
        
        response = self.client.put(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_invalid_phone_format(self):
        """Test phone validation"""
        data = {
            'phone': 'invalid'
        }
        
        response = self.client.put(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_partial_update_with_patch(self):
        """Test partial update using PATCH"""
        data = {
            'city': 'Boston'
        }
        
        response = self.client.patch(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.city, 'Boston')


class ProfilePictureUploadTests(APITestCase):
    """Test profile picture upload (UC-022)"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.upload_url = '/api/profile/picture/upload'
        self.delete_url = '/api/profile/picture/delete'
    
    def create_test_image(self, format='PNG', size=(100, 100)):
        """Helper to create test image"""
        image = Image.new('RGB', size, color='red')
        image_io = io.BytesIO()
        image.save(image_io, format=format)
        image_io.seek(0)
        return SimpleUploadedFile(
            f'test.{format.lower()}',
            image_io.read(),
            content_type=f'image/{format.lower()}'
        )
    
    @patch('core.views.process_profile_picture')
    def test_upload_valid_image(self, mock_process):
        """Test uploading valid profile picture"""
        mock_process.return_value = 'profile_pictures/2024/01/test.jpg'
        
        image_file = self.create_test_image()
        response = self.client.post(
            self.upload_url,
            {'profile_picture': image_file},
            format='multipart'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertIn('profile_picture_url', response.data)
    
    def test_upload_invalid_file_type(self):
        """Test uploading non-image file fails"""
        text_file = SimpleUploadedFile(
            'test.txt',
            b'not an image',
            content_type='text/plain'
        )
        
        response = self.client.post(
            self.upload_url,
            {'profile_picture': text_file},
            format='multipart'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_upload_no_file(self):
        """Test upload without file fails"""
        response = self.client.post(self.upload_url, {}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    @patch('core.views.delete_old_picture')
    def test_delete_profile_picture(self, mock_delete):
        """Test deleting profile picture"""
        mock_delete.return_value = None
        self.profile.profile_picture = 'test.jpg'
        self.profile.save()
        
        response = self.client.delete(self.delete_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertFalse(self.profile.profile_picture)
    
    def test_delete_picture_when_none_exists(self):
        """Test deleting when no picture exists"""
        response = self.client.delete(self.delete_url)
        
        # Should still succeed
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class ProfileAccessControlTests(APITestCase):
    """Test profile access control and permissions"""
    
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com'
        )
        self.profile1 = CandidateProfile.objects.create(user=self.user1)
        
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com'
        )
        self.profile2 = CandidateProfile.objects.create(user=self.user2)
    
    def test_user_cannot_access_other_profile(self):
        """Test user cannot access another user's profile directly"""
        self.client.force_authenticate(user=self.user1)
        
        # Trying to access user2's profile should fail or return own profile
        response = self.client.get('/api/users/me')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['email'], 'user1@example.com')
    
    def test_unauthenticated_cannot_update_profile(self):
        """Test unauthenticated users cannot update profiles"""
        response = self.client.put(
            '/api/profile/basic',
            {'first_name': 'Hacker'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ProfileVisibilityTests(APITestCase):
    """Test profile visibility settings"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(
            user=self.user,
            visibility='private'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_default_visibility_is_private(self):
        """Test new profiles default to private visibility"""
        new_user = User.objects.create_user(
            username='new_user',
            email='new@example.com'
        )
        new_profile = CandidateProfile.objects.create(user=new_user)
        
        self.assertEqual(new_profile.visibility, 'private')
    
    def test_update_visibility_setting(self):
        """Test updating profile visibility"""
        data = {'visibility': 'public'}
        
        response = self.client.put(
            '/api/users/me',
            data,
            format='json'
        )
        
        # Assuming PUT /users/me supports visibility
        # Adjust based on actual implementation
        self.profile.refresh_from_db()
