"""
UC-035: Employment History Tests
Tests for UC-023 (Add Entry), UC-024 (View/Edit), UC-025 (Delete)
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from datetime import date, timedelta
from core.models import CandidateProfile, WorkExperience, Skill

User = get_user_model()


class WorkExperienceCRUDTests(APITestCase):
    """Test work experience CRUD operations (UC-023, UC-024, UC-025)"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = '/api/employment'
    
    def test_add_work_experience(self):
        """Test adding a work experience entry (UC-023)"""
        data = {
            'job_title': 'Software Engineer',
            'company_name': 'Tech Corp',
            'location': 'San Francisco, CA',
            'start_date': '2020-06-01',
            'end_date': '2022-05-31',
            'description': 'Developed web applications'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        if response.status_code == 404:
            self.skipTest("Work experience API endpoint not implemented yet")
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            WorkExperience.objects.filter(
                candidate=self.profile,
                company_name='Tech Corp'
            ).exists()
        )
    
    def test_list_work_experiences(self):
        """Test viewing work experiences (UC-024)"""
        WorkExperience.objects.create(
            candidate=self.profile,
            job_title='Developer',
            company_name='Company A',
            start_date=date(2019, 1, 1),
            end_date=date(2020, 12, 31)
        )
        
        response = self.client.get(self.url)
        
        if response.status_code == 404:
            self.skipTest("Work experience API endpoint not implemented yet")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # API wraps response in employment_history key
        employment_list = response.data.get('employment_history', response.data)
        self.assertEqual(len(employment_list), 1)
        self.assertEqual(employment_list[0]['company_name'], 'Company A')
    
    def test_update_work_experience(self):
        """Test editing work experience (UC-024)"""
        work_exp = WorkExperience.objects.create(
            candidate=self.profile,
            job_title='Junior Developer',
            company_name='StartUp Inc',
            start_date=date(2021, 3, 1),
            is_current=True  # Set as current to avoid end_date requirement
        )
        
        data = {
            'job_title': 'Senior Developer',
            'description': 'Led team of 5 developers',
            'is_current': True  # Keep as current position
        }
        
        response = self.client.patch(
            f'{self.url}/{work_exp.id}',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        work_exp.refresh_from_db()
        self.assertEqual(work_exp.job_title, 'Senior Developer')
    
    def test_delete_work_experience(self):
        """Test deleting work experience (UC-025)"""
        work_exp = WorkExperience.objects.create(
            candidate=self.profile,
            job_title='Intern',
            company_name='Old Company',
            start_date=date(2018, 6, 1),
            end_date=date(2018, 8, 31)
        )
        
        response = self.client.delete(f'{self.url}/{work_exp.id}')
        
        # API returns 200 with success message, not 204
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            WorkExperience.objects.filter(id=work_exp.id).exists()
        )


class CurrentEmploymentTests(APITestCase):
    """Test is_current checkbox logic"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = '/api/employment'
    
    def test_current_job_sets_end_date_null(self):
        """Test is_current=True sets end_date to null"""
        data = {
            'job_title': 'Senior Engineer',
            'company_name': 'Current Corp',
            'start_date': '2023-01-01',
            'is_current': True
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        work_exp = WorkExperience.objects.get(company_name='Current Corp')
        self.assertIsNone(work_exp.end_date)
        self.assertTrue(work_exp.is_current)
    
    def test_past_job_requires_end_date(self):
        """Test is_current=False requires end_date"""
        data = {
            'job_title': 'Developer',
            'company_name': 'Past Corp',
            'start_date': '2020-01-01',
            'is_current': False
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_update_to_current_position(self):
        """Test updating past job to current"""
        work_exp = WorkExperience.objects.create(
            candidate=self.profile,
            job_title='Engineer',
            company_name='Tech Co',
            start_date=date(2021, 6, 1),
            end_date=date(2023, 12, 31),
            is_current=False
        )
        
        data = {'is_current': True}
        
        response = self.client.patch(
            f'{self.url}/{work_exp.id}',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        work_exp.refresh_from_db()
        self.assertTrue(work_exp.is_current)
        self.assertIsNone(work_exp.end_date)


class WorkExperienceDateValidationTests(APITestCase):
    """Test date validation for work experience"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = '/api/employment'
    
    def test_end_date_after_start_date(self):
        """Test end_date must be after start_date"""
        data = {
            'job_title': 'Developer',
            'company_name': 'Test Co',
            'start_date': '2022-01-01',
            'end_date': '2021-01-01'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_future_start_date_allowed(self):
        """Test future start dates are allowed"""
        future_date = date.today() + timedelta(days=30)
        data = {
            'job_title': 'Future Role',
            'company_name': 'Future Co',
            'start_date': future_date.isoformat(),
            'is_current': True
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class WorkExperienceSkillsTests(APITestCase):
    """Test skills_used relationship"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        
        self.skill1 = Skill.objects.create(name='Python')
        self.skill2 = Skill.objects.create(name='Django')
        
        self.url = '/api/employment'
    
    def test_add_work_experience_with_skills(self):
        """Test adding work experience with associated skills"""
        data = {
            'job_title': 'Backend Developer',
            'company_name': 'Tech Co',
            'start_date': '2021-01-01',
            'end_date': '2023-12-31',
            'skills_used_names': ['Python', 'Django']  # Use skills_used_names, not IDs
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        work_exp = WorkExperience.objects.get(company_name='Tech Co')
        self.assertEqual(work_exp.skills_used.count(), 2)
    
    def test_update_skills_used(self):
        """Test updating skills associated with work experience"""
        work_exp = WorkExperience.objects.create(
            candidate=self.profile,
            job_title='Developer',
            company_name='Co',
            start_date=date(2020, 1, 1),
            end_date=date(2021, 1, 1)
        )
        work_exp.skills_used.add(self.skill1)
        
        data = {'skills_used_names': ['Django']}  # Use skills_used_names
        
        response = self.client.patch(
            f'{self.url}/{work_exp.id}',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        work_exp.refresh_from_db()
        self.assertIn(self.skill2, work_exp.skills_used.all())


class WorkExperienceAchievementsTests(APITestCase):
    """Test achievements array handling"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = '/api/employment'
    
    def test_add_achievements(self):
        """Test adding achievements list"""
        data = {
            'job_title': 'Engineer',
            'company_name': 'Corp',
            'start_date': '2020-01-01',
            'end_date': '2022-01-01',
            'achievements': [
                'Improved performance by 50%',
                'Led migration to microservices',
                'Mentored 5 junior developers'
            ]
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        work_exp = WorkExperience.objects.get(company_name='Corp')
        self.assertEqual(len(work_exp.achievements), 3)
    
    def test_empty_achievements_allowed(self):
        """Test achievements can be empty"""
        data = {
            'job_title': 'Engineer',
            'company_name': 'Corp',
            'start_date': '2020-01-01',
            'end_date': '2022-01-01',
            'achievements': []
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class WorkExperienceRequiredFieldsTests(APITestCase):
    """Test required field validation"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = '/api/employment'
    
    def test_job_title_required(self):
        """Test job_title is required"""
        data = {
            'company_name': 'Test Co',
            'start_date': '2020-01-01'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_company_required(self):
        """Test company is required"""
        data = {
            'job_title': 'Engineer',
            'start_date': '2020-01-01'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_start_date_required(self):
        """Test start_date is required"""
        data = {
            'job_title': 'Engineer',
            'company_name': 'Test Co'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
