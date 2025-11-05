from datetime import date
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from core.models import CandidateProfile, Education

User = get_user_model()


class EducationCRUDTests(APITestCase):
    """Test education CRUD operations (UC-028, UC-029)"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com',
            password='testpass123'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = '/api/education'
    
    def test_add_education(self):
        """Test adding education entry (UC-028)"""
        data = {
            'institution': 'State University',
            'degree_type': 'bachelor',
            'field_of_study': 'Computer Science',
            'start_date': '2016-09-01',
            'graduation_date': '2020-05-15',  # Serializer accepts this
            'gpa': 3.8,
            'currently_enrolled': False
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Education.objects.filter(
            candidate=self.profile,
            institution='State University'
        ).exists())
    
    def test_list_education(self):
        """Test viewing education entries (UC-029)"""
        Education.objects.create(
            candidate=self.profile,
            institution='Tech College',
            degree_type='associate',
            field_of_study='Information Technology',
            start_date=date(2014, 9, 1),
            end_date=date(2016, 5, 15)  # Model uses end_date not graduation_date
        )
        
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
    
    def test_update_education(self):
        """Test editing education entry (UC-029)"""
        education = Education.objects.create(
            candidate=self.profile,
            institution='Old University',
            degree_type='bachelor',
            field_of_study='Engineering',
            start_date=date(2016, 9, 1),
            end_date=date(2020, 5, 15)  # Model uses end_date
        )
        
        data = {
            'gpa': 3.9
        }
        
        response = self.client.patch(
            f'{self.url}/{education.id}',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        education.refresh_from_db()
        self.assertEqual(float(education.gpa), 3.9)
    
    def test_delete_education(self):
        """Test deleting education entry"""
        education = Education.objects.create(
            candidate=self.profile,
            institution='Test College',
            degree_type='certificate',
            field_of_study='Web Development',
            start_date=date(2019, 1, 1),
            end_date=date(2019, 6, 1)  # Model uses end_date
        )
        
        response = self.client.delete(f'{self.url}/{education.id}')
        
        # API returns 200 (not 204)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Education.objects.filter(id=education.id).exists())
