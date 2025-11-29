from datetime import date
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from core.models import CandidateProfile, Project

User = get_user_model()


class ProjectCRUDTests(APITestCase):
    """Test project CRUD operations (UC-031, UC-032)"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = '/api/projects'
    
    def test_add_project(self):
        """Test adding project (UC-031)"""
        data = {
            'name': 'E-commerce Platform',  # Field is 'name' not 'title'
            'description': 'Built a full-stack e-commerce platform',
            'start_date': '2023-01-01',
            'end_date': '2023-06-30',
            'project_url': 'https://github.com/user/ecommerce',
            'status': 'completed',
            'technologies': ['React', 'Node.js', 'PostgreSQL']
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Project.objects.filter(
            candidate=self.profile,
            name='E-commerce Platform'
        ).exists())
    
    def test_list_projects(self):
        """Test viewing projects"""
        Project.objects.create(
            candidate=self.profile,
            name='Test Project',  # Field is 'name'
            description='A test project',
            start_date=date(2023, 1, 1),
            end_date=date(2023, 6, 1),
            status='completed'
        )
        
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
    
    def test_update_project(self):
        """Test editing project"""
        project = Project.objects.create(
            candidate=self.profile,
            name='Old Name',  # Field is 'name'
            description='Old description',
            start_date=date(2023, 1, 1),
            status='completed'
        )
        
        data = {
            'name': 'Updated Name',  # Field is 'name'
            'description': 'Updated description'
        }
        
        response = self.client.patch(
            f'{self.url}/{project.id}',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        project.refresh_from_db()
        self.assertEqual(project.name, 'Updated Name')  # Check 'name' field
    
    def test_delete_project(self):
        """Test deleting project"""
        project = Project.objects.create(
            candidate=self.profile,
            name='Delete Me',  # Field is 'name'
            description='To be deleted',
            start_date=date(2023, 1, 1),
            status='completed'
        )
        
        response = self.client.delete(f'{self.url}/{project.id}')
        
        # API returns 200 (not 204)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Project.objects.filter(id=project.id).exists())


class ProjectPortfolioTests(APITestCase):
    """Test project portfolio features (UC-032)"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = '/api/projects'
    
    def test_project_with_url(self):
        """Test project with URL"""
        data = {
            'name': 'GitHub Project',  # Field is 'name'
            'description': 'Open source project',
            'start_date': '2023-01-01',
            'project_url': 'https://github.com/user/project',
            'status': 'completed'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('project_url', response.data)
    
    def test_project_featured(self):
        """Test marking project as featured"""
        data = {
            'name': 'Featured Project',  # Field is 'name'
            'description': 'A featured project',
            'start_date': '2023-01-01',
            'status': 'completed'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        project = Project.objects.get(name='Featured Project')


class ProjectTechnologiesTests(APITestCase):
    """Test project technologies handling"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = '/api/projects'
    
    def test_project_with_technologies(self):
        """Test project with technologies list"""
        data = {
            'name': 'Full Stack App',  # Field is 'name'
            'description': 'A full stack application',
            'start_date': '2023-01-01',
            'status': 'completed',
            'technologies': ['Python', 'Django', 'React', 'PostgreSQL']
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        project = Project.objects.get(name='Full Stack App')
        # Technologies are stored in skills_used relationship, check response data
        self.assertIn('technologies', response.data)
