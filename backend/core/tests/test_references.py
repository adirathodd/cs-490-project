"""Test cases for UC-095: Professional Reference Management"""
import pytest
from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from core.models import (
    ProfessionalReference, ReferenceRequest, ReferenceTemplate, 
    ReferenceAppreciation, ReferencePortfolio, Application, JobOpportunity
)

User = get_user_model()


@pytest.fixture
def api_client():
    """Create API client"""
    return APIClient()


@pytest.fixture
def test_user(db):
    """Create a test user"""
    user = User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
    )
    return user


@pytest.fixture
def authenticated_client(api_client, test_user):
    """Create authenticated API client"""
    api_client.force_authenticate(user=test_user)
    return api_client


@pytest.fixture
def sample_reference(test_user):
    """Create a sample professional reference"""
    return ProfessionalReference.objects.create(
        user=test_user,
        name='John Doe',
        title='Senior Manager',
        company='Tech Corp',
        email='john.doe@techcorp.com',
        phone='555-1234',
        linkedin_url='https://linkedin.com/in/johndoe',
        relationship_type='supervisor',
        relationship_description='Direct manager for 2 years',
        years_known=3,
        availability_status='available',
        preferred_contact_method='email',
        best_for_roles=['software_engineer', 'tech_lead'],
        best_for_industries=['technology', 'fintech'],
        key_strengths_to_highlight='Leadership, technical skills, problem solving',
        projects_worked_together='Mobile app redesign, API migration',
        talking_points=['Great team player', 'Fast learner'],
        is_active=True
    )


@pytest.fixture
def sample_template(test_user):
    """Create a sample reference template"""
    return ReferenceTemplate.objects.create(
        user=test_user,
        name='Standard Request Email',
        template_type='request_email',
        subject_line='Reference Request for {position_title}',
        content='Dear {reference_name},\n\nI hope this email finds you well. I am applying for {position_title} at {company_name}...',
        is_default=True
    )


@pytest.mark.django_db
class TestProfessionalReferenceModel:
    """Test ProfessionalReference model"""
    
    def test_create_reference(self, test_user):
        """Test creating a professional reference"""
        reference = ProfessionalReference.objects.create(
            user=test_user,
            name='Jane Smith',
            title='VP of Engineering',
            company='Startup Inc',
            email='jane@startup.com',
            relationship_type='mentor',
            availability_status='available'
        )
        
        assert reference.id is not None
        assert reference.name == 'Jane Smith'
        assert reference.user == test_user
        assert reference.times_used == 0
        assert reference.is_active is True
        assert str(reference) == 'Jane Smith - mentor at Startup Inc'
    
    def test_reference_defaults(self, test_user):
        """Test default values for reference"""
        reference = ProfessionalReference.objects.create(
            user=test_user,
            name='Test Person',
            title='Manager',
            company='Company',
            email='test@test.com',
            relationship_type='colleague'
        )
        
        assert reference.years_known == 0
        assert reference.availability_status == 'pending_permission'
        assert reference.preferred_contact_method == 'email'
        assert reference.best_for_roles == []
        assert reference.best_for_industries == []
        assert reference.talking_points == []
        assert reference.times_used == 0
        assert reference.is_active is True
    
    def test_reference_json_fields(self, sample_reference):
        """Test JSON fields work correctly"""
        assert isinstance(sample_reference.best_for_roles, list)
        assert 'software_engineer' in sample_reference.best_for_roles
        assert isinstance(sample_reference.talking_points, list)
        assert len(sample_reference.talking_points) == 2


@pytest.mark.django_db
class TestReferenceRequestModel:
    """Test ReferenceRequest model"""
    
    def test_create_request(self, test_user, sample_reference):
        """Test creating a reference request"""
        request = ReferenceRequest.objects.create(
            user=test_user,
            reference=sample_reference,
            company_name='Big Tech Co',
            position_title='Senior Developer',
            request_status='pending',
            due_date=date.today() + timedelta(days=14)
        )
        
        assert request.id is not None
        assert request.reference == sample_reference
        assert request.request_status == 'pending'
        assert str(request) == 'Reference request for Senior Developer at Big Tech Co'
    
    def test_request_with_application(self, test_user, sample_reference):
        """Test request linked to application"""
        from core.models import Company, CandidateProfile
        
        # Create CandidateProfile first
        candidate_profile = CandidateProfile.objects.create(
            user=test_user,
            phone='123-456-7890',
            city='San Francisco',
            state='CA'
        )
        
        company = Company.objects.create(
            name='Tech Startup',
            domain='techstartup.com'
        )
        
        job = JobOpportunity.objects.create(
            company=company,
            title='Software Engineer'
        )
        
        app = Application.objects.create(
            candidate=candidate_profile,
            job=job,
            status='applied'
        )
        
        request = ReferenceRequest.objects.create(
            user=test_user,
            reference=sample_reference,
            application=app,
            job_opportunity=job,
            company_name='Tech Startup',
            position_title='Software Engineer',
            request_status='sent'
        )
        
        assert request.application == app
        assert request.job_opportunity == job


@pytest.mark.django_db
class TestReferenceTemplateModel:
    """Test ReferenceTemplate model"""
    
    def test_create_template(self, test_user):
        """Test creating a reference template"""
        template = ReferenceTemplate.objects.create(
            user=test_user,
            name='Thank You Template',
            template_type='thank_you',
            subject_line='Thank You for Your Reference',
            content='Dear {reference_name}, Thank you for providing a reference...'
        )
        
        assert template.id is not None
        assert template.template_type == 'thank_you'
        assert template.times_used == 0
        assert str(template) == 'Thank You Template (Thank You Note)'
    
    def test_template_with_preferences(self, test_user):
        """Test template with role/relationship preferences"""
        template = ReferenceTemplate.objects.create(
            user=test_user,
            name='Manager Request',
            template_type='request_email',
            content='Template content',
            for_relationship_types=['manager', 'supervisor'],
            for_role_types=['engineering', 'technical']
        )
        
        assert 'manager' in template.for_relationship_types
        assert 'engineering' in template.for_role_types


@pytest.mark.django_db
class TestReferenceAppreciationModel:
    """Test ReferenceAppreciation model"""
    
    def test_create_appreciation(self, test_user, sample_reference):
        """Test creating appreciation record"""
        appreciation = ReferenceAppreciation.objects.create(
            user=test_user,
            reference=sample_reference,
            appreciation_type='thank_you_note',
            date=date.today(),
            description='Sent thank you card for recent reference'
        )
        
        assert appreciation.id is not None
        assert appreciation.reference == sample_reference
        assert str(appreciation) == f'Thank You Note for {sample_reference.name}'


@pytest.mark.django_db
class TestReferencePortfolioModel:
    """Test ReferencePortfolio model"""
    
    def test_create_portfolio(self, test_user, sample_reference):
        """Test creating reference portfolio"""
        portfolio = ReferencePortfolio.objects.create(
            user=test_user,
            name='Engineering Roles',
            description='References for software engineering positions',
            is_default=True
        )
        portfolio.references.add(sample_reference)
        
        assert portfolio.id is not None
        assert portfolio.references.count() == 1
        assert sample_reference in portfolio.references.all()
        assert str(portfolio) == 'Engineering Roles'
    
    def test_portfolio_targets(self, test_user):
        """Test portfolio target fields"""
        portfolio = ReferencePortfolio.objects.create(
            user=test_user,
            name='Tech Leadership',
            target_role_types=['tech_lead', 'engineering_manager'],
            target_industries=['technology', 'saas'],
            target_companies=['Google', 'Microsoft']
        )
        
        assert len(portfolio.target_role_types) == 2
        assert 'Google' in portfolio.target_companies


@pytest.mark.django_db
class TestReferenceEndpoints:
    """Test Reference API endpoints"""
    
    def test_list_references(self, authenticated_client, sample_reference):
        """Test listing references"""
        url = reverse('references-list-create')
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['name'] == 'John Doe'
    
    def test_list_references_filtered(self, authenticated_client, test_user):
        """Test filtering references by status"""
        ProfessionalReference.objects.create(
            user=test_user, name='Active Ref', title='Title', 
            company='Co', email='a@b.com', relationship_type='mentor',
            is_active=True
        )
        ProfessionalReference.objects.create(
            user=test_user, name='Inactive Ref', title='Title', 
            company='Co', email='b@b.com', relationship_type='mentor',
            is_active=False
        )
        
        url = reverse('references-list-create')
        response = authenticated_client.get(url, {'is_active': 'true'})
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['name'] == 'Active Ref'
    
    def test_create_reference(self, authenticated_client):
        """Test creating a new reference"""
        url = reverse('references-list-create')
        data = {
            'name': 'New Reference',
            'title': 'Director',
            'company': 'New Company',
            'email': 'new@company.com',
            'relationship_type': 'supervisor',
            'availability_status': 'available'
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'New Reference'
        assert ProfessionalReference.objects.filter(name='New Reference').exists()
    
    def test_get_reference_detail(self, authenticated_client, sample_reference):
        """Test retrieving reference detail"""
        url = reverse('reference-detail', kwargs={'reference_id': sample_reference.id})
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'John Doe'
        assert response.data['company'] == 'Tech Corp'
    
    def test_update_reference(self, authenticated_client, sample_reference):
        """Test updating a reference"""
        url = reverse('reference-detail', kwargs={'reference_id': sample_reference.id})
        data = {'title': 'VP of Engineering'}
        
        response = authenticated_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['title'] == 'VP of Engineering'
        
        sample_reference.refresh_from_db()
        assert sample_reference.title == 'VP of Engineering'
    
    def test_delete_reference(self, authenticated_client, sample_reference):
        """Test deleting a reference"""
        url = reverse('reference-detail', kwargs={'reference_id': sample_reference.id})
        response = authenticated_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ProfessionalReference.objects.filter(id=sample_reference.id).exists()
    
    def test_check_in_reference(self, authenticated_client, sample_reference):
        """Test checking in with a reference"""
        url = reverse('reference-check-in', kwargs={'reference_id': sample_reference.id})
        response = authenticated_client.post(url, {'months_ahead': 3}, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        
        sample_reference.refresh_from_db()
        assert sample_reference.last_contacted_date == timezone.now().date()
        assert sample_reference.next_check_in_date is not None


@pytest.mark.django_db
class TestReferenceRequestEndpoints:
    """Test ReferenceRequest API endpoints"""
    
    def test_list_requests(self, authenticated_client, test_user, sample_reference):
        """Test listing reference requests"""
        ReferenceRequest.objects.create(
            user=test_user,
            reference=sample_reference,
            company_name='Test Co',
            position_title='Developer',
            request_status='pending'
        )
        
        url = reverse('reference-requests-list-create')
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
    
    def test_create_request(self, authenticated_client, sample_reference):
        """Test creating a reference request"""
        url = reverse('reference-requests-list-create')
        data = {
            'reference': str(sample_reference.id),
            'company_name': 'New Tech Co',
            'position_title': 'Senior Engineer',
            'due_date': str(date.today() + timedelta(days=14))
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['company_name'] == 'New Tech Co'
        
        # Check that reference times_used was incremented
        sample_reference.refresh_from_db()
        assert sample_reference.times_used == 1
    
    def test_create_request_with_template(self, authenticated_client, sample_reference, sample_template):
        """Test creating request with template"""
        url = reverse('reference-requests-list-create')
        data = {
            'reference': str(sample_reference.id),
            'company_name': 'Template Co',
            'position_title': 'Engineer',
            'use_template': str(sample_template.id)
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert 'Template Co' in response.data['custom_message']
        assert sample_reference.name in response.data['custom_message']
    
    def test_mark_request_sent(self, authenticated_client, test_user, sample_reference):
        """Test marking request as sent"""
        request = ReferenceRequest.objects.create(
            user=test_user,
            reference=sample_reference,
            company_name='Test',
            position_title='Dev',
            request_status='pending'
        )
        
        url = reverse('reference-request-mark-sent', kwargs={'request_id': request.id})
        response = authenticated_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        
        request.refresh_from_db()
        assert request.request_status == 'sent'
        assert request.request_sent_date == timezone.now().date()
    
    def test_mark_request_completed(self, authenticated_client, test_user, sample_reference):
        """Test marking request as completed with feedback"""
        request = ReferenceRequest.objects.create(
            user=test_user,
            reference=sample_reference,
            company_name='Test',
            position_title='Dev',
            request_status='sent'
        )
        
        url = reverse('reference-request-mark-completed', kwargs={'request_id': request.id})
        data = {
            'feedback_received': 'Great feedback received',
            'reference_rating': 5
        }
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        
        request.refresh_from_db()
        assert request.request_status == 'completed'
        assert request.feedback_received == 'Great feedback received'
        assert request.reference_rating == 5


@pytest.mark.django_db
class TestReferenceTemplateEndpoints:
    """Test ReferenceTemplate API endpoints"""
    
    def test_list_templates(self, authenticated_client, sample_template):
        """Test listing templates"""
        url = reverse('reference-templates-list-create')
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
    
    def test_create_template(self, authenticated_client):
        """Test creating a template"""
        url = reverse('reference-templates-list-create')
        data = {
            'name': 'New Template',
            'template_type': 'preparation_guide',
            'content': 'Guide content with {reference_name}'
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'New Template'


@pytest.mark.django_db
class TestReferenceAppreciationEndpoints:
    """Test ReferenceAppreciation API endpoints"""
    
    def test_list_appreciations(self, authenticated_client, test_user, sample_reference):
        """Test listing appreciations"""
        ReferenceAppreciation.objects.create(
            user=test_user,
            reference=sample_reference,
            appreciation_type='thank_you_note',
            date=date.today()
        )
        
        url = reverse('reference-appreciations-list-create')
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
    
    def test_create_appreciation(self, authenticated_client, sample_reference):
        """Test creating appreciation"""
        url = reverse('reference-appreciations-list-create')
        data = {
            'reference': str(sample_reference.id),
            'appreciation_type': 'coffee_meetup',
            'date': str(date.today()),
            'description': 'Had coffee to catch up'
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        
        # Check that reference last_contacted_date was updated
        sample_reference.refresh_from_db()
        assert sample_reference.last_contacted_date == date.today()


@pytest.mark.django_db
class TestReferencePortfolioEndpoints:
    """Test ReferencePortfolio API endpoints"""
    
    def test_list_portfolios(self, authenticated_client, test_user, sample_reference):
        """Test listing portfolios"""
        portfolio = ReferencePortfolio.objects.create(
            user=test_user,
            name='Test Portfolio'
        )
        portfolio.references.add(sample_reference)
        
        url = reverse('reference-portfolios-list-create')
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
    
    def test_create_portfolio(self, authenticated_client, sample_reference):
        """Test creating portfolio"""
        url = reverse('reference-portfolios-list-create')
        data = {
            'name': 'New Portfolio',
            'description': 'For tech roles',
            'references': [str(sample_reference.id)],
            'target_role_types': ['engineer']
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'New Portfolio'


@pytest.mark.django_db
class TestReferenceAnalytics:
    """Test Reference Analytics endpoint"""
    
    def test_analytics_basic(self, authenticated_client, test_user, sample_reference):
        """Test basic analytics"""
        url = reverse('reference-analytics')
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert 'total_references' in response.data
        assert 'active_references' in response.data
        assert 'success_rate' in response.data
        assert response.data['total_references'] == 1
    
    def test_analytics_with_requests(self, authenticated_client, test_user, sample_reference):
        """Test analytics with requests"""
        # Create completed request
        ReferenceRequest.objects.create(
            user=test_user,
            reference=sample_reference,
            company_name='Test',
            position_title='Dev',
            request_status='completed',
            contributed_to_success=True
        )
        
        # Create pending request
        ReferenceRequest.objects.create(
            user=test_user,
            reference=sample_reference,
            company_name='Test2',
            position_title='Dev2',
            request_status='pending'
        )
        
        url = reverse('reference-analytics')
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_requests'] == 2
        assert response.data['pending_requests'] == 1
        assert response.data['completed_requests'] == 1
        assert response.data['success_rate'] == 100.0


@pytest.mark.django_db
class TestPreparationGuide:
    """Test Preparation Guide generation"""
    
    def test_generate_preparation_guide(self, authenticated_client, sample_reference):
        """Test generating preparation guide"""
        url = reverse('reference-preparation-guide')
        data = {
            'reference_id': str(sample_reference.id),
            'company_name': 'Tech Startup',
            'position_title': 'Senior Engineer',
            'job_description': 'Looking for experienced engineer'
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert 'reference_name' in response.data
        assert 'key_talking_points' in response.data
        assert response.data['reference_name'] == 'John Doe'
    
    def test_preparation_guide_missing_reference(self, authenticated_client):
        """Test preparation guide with missing reference"""
        url = reverse('reference-preparation-guide')
        data = {
            'reference_id': '00000000-0000-0000-0000-000000000000',
            'company_name': 'Test',
            'position_title': 'Dev'
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestAuthenticationRequired:
    """Test that endpoints require authentication"""
    
    def test_list_references_unauthenticated(self, api_client):
        """Test that unauthenticated requests are rejected"""
        url = reverse('references-list-create')
        response = api_client.get(url)
        
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]
    
    def test_analytics_unauthenticated(self, api_client):
        """Test analytics requires authentication"""
        url = reverse('reference-analytics')
        response = api_client.get(url)
        
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]


@pytest.mark.django_db
class TestUserIsolation:
    """Test that users can only access their own data"""
    
    def test_user_cannot_see_other_references(self, api_client, db):
        """Test user isolation for references"""
        user1 = User.objects.create_user(username='user1', email='user1@test.com', password='pass')
        user2 = User.objects.create_user(username='user2', email='user2@test.com', password='pass')
        
        ref1 = ProfessionalReference.objects.create(
            user=user1, name='User1 Ref', title='Title', 
            company='Co', email='a@b.com', relationship_type='mentor'
        )
        
        ref2 = ProfessionalReference.objects.create(
            user=user2, name='User2 Ref', title='Title',
            company='Co', email='b@b.com', relationship_type='mentor'
        )
        
        # User1 should only see their reference
        api_client.force_authenticate(user=user1)
        url = reverse('references-list-create')
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['name'] == 'User1 Ref'
