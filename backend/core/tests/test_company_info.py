"""
UC-043: Company Information Display - Backend Tests
Tests for company information retrieval and display functionality.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from core.models import CandidateProfile, Company, CompanyResearch, JobEntry
from unittest.mock import patch, MagicMock

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def test_user(db):
    """Create a test user."""
    user = User.objects.create_user(
        username='testuser123',
        email='test@example.com',
        first_name='Test',
        last_name='User'
    )
    return user


@pytest.fixture
def test_profile(test_user):
    """Create a candidate profile."""
    profile, _ = CandidateProfile.objects.get_or_create(user=test_user)
    return profile


@pytest.fixture
def authenticated_client(api_client, test_user):
    """Return an authenticated API client."""
    api_client.force_authenticate(user=test_user)
    return api_client


@pytest.fixture
def sample_company(db):
    """Create a sample company with research data."""
    company = Company.objects.create(
        name='Acme Inc',
        domain='acme.com',
        linkedin_url='https://linkedin.com/company/acme',
        industry='Technology',
        size='1001-5000 employees',
        hq_location='San Francisco, CA'
    )
    
    CompanyResearch.objects.create(
        company=company,
        description='Leading software company building innovative solutions',
        mission_statement='To revolutionize how people work',
        culture_keywords=['innovation', 'collaboration', 'impact'],
        recent_news=[
            {
                'title': 'Acme raises $50M Series B',
                'url': 'https://news.example.com/acme-funding',
                'date': '2024-10-15',
                'summary': 'Company secures major funding round'
            }
        ],
        funding_info={'stage': 'Series B', 'amount': 50000000},
        tech_stack=['Python', 'React', 'PostgreSQL'],
        employee_count=2500,
        growth_rate=25.5,
        glassdoor_rating=4.2
    )
    
    return company


@pytest.fixture
def sample_job(test_profile, sample_company):
    """Create a sample job entry."""
    job = JobEntry.objects.create(
        candidate=test_profile,
        title='Senior Software Engineer',
        company_name=sample_company.name,
        location='San Francisco, CA',
        salary_min=120000,
        salary_max=180000,
        description='Great opportunity to work on cutting-edge technology',
        industry='Technology',
        job_type='ft'
    )
    return job


class TestCompanyInfoEndpoint:
    """Tests for the /api/companies/<name> endpoint."""
    
    def test_get_existing_company_info(self, authenticated_client, sample_company):
        """Test retrieving information for an existing company."""
        url = f'/api/companies/{sample_company.name}'
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Basic company info
        assert data['name'] == 'Acme Inc'
        assert data['domain'] == 'acme.com'
        assert data['industry'] == 'Technology'
        assert data['size'] == '1001-5000 employees'
        assert data['hq_location'] == 'San Francisco, CA'
        
        # Research data
        assert data['description'] == 'Leading software company building innovative solutions'
        assert data['mission_statement'] == 'To revolutionize how people work'
        assert data['employee_count'] == 2500
        assert data['glassdoor_rating'] == 4.2
        assert len(data['recent_news']) == 1
        assert data['recent_news'][0]['title'] == 'Acme raises $50M Series B'
    
    def test_get_company_case_insensitive(self, authenticated_client, sample_company):
        """Test that company lookup is case-insensitive."""
        url = '/api/companies/acme%20inc'
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['name'] == 'Acme Inc'
    
    def test_create_new_company_on_first_lookup(self, authenticated_client):
        """Test that a new company is created if it doesn't exist."""
        url = '/api/companies/NewCorp%20Inc'
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Verify new company was created
        assert data['name'] == 'NewCorp Inc'
        assert data['domain']  # Should have generated a domain
        
        # Verify it's saved in database
        assert Company.objects.filter(name='NewCorp Inc').exists()
    
    def test_company_info_requires_authentication(self, api_client):
        """Test that unauthenticated requests are rejected."""
        url = '/api/companies/Acme%20Inc'
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestJobCompanyInfoEndpoint:
    """Tests for the /api/jobs/<id>/company endpoint."""
    
    def test_get_company_info_for_job(self, authenticated_client, sample_job, sample_company):
        """Test retrieving company information for a specific job."""
        url = f'/api/jobs/{sample_job.id}/company'
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data['name'] == sample_company.name
        assert data['industry'] == 'Technology'
        assert data['glassdoor_rating'] == 4.2
    
    def test_job_company_info_creates_company_if_missing(self, authenticated_client, test_profile):
        """Test that company is created if job references non-existent company."""
        job = JobEntry.objects.create(
            candidate=test_profile,
            title='Developer',
            company_name='New Startup Inc',
            location='Remote'
        )
        
        url = f'/api/jobs/{job.id}/company'
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['name'] == 'New Startup Inc'
        
        # Verify company was created
        assert Company.objects.filter(name='New Startup Inc').exists()
    
    def test_job_company_info_handles_missing_company_name(self, authenticated_client, test_profile):
        """Test endpoint handles jobs with no company name gracefully."""
        job = JobEntry.objects.create(
            candidate=test_profile,
            title='Generic Position',
            company_name='',
            location='Somewhere'
        )
        
        url = f'/api/jobs/{job.id}/company'
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['name'] == ''
    
    def test_job_company_info_requires_job_ownership(self, authenticated_client, api_client, test_profile):
        """Test that users can only access company info for their own jobs."""
        # Create another user
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com'
        )
        other_profile = CandidateProfile.objects.create(user=other_user)
        
        # Create job for other user
        other_job = JobEntry.objects.create(
            candidate=other_profile,
            title='Secret Job',
            company_name='Secret Corp',
            location='Remote'
        )
        
        # Try to access with authenticated client (different user)
        url = f'/api/jobs/{other_job.id}/company'
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestJobDetailWithCompanyInfo:
    """Tests for company info inclusion in job detail endpoint."""
    
    def test_job_detail_includes_company_info(self, authenticated_client, sample_job, sample_company):
        """Test that job detail response includes company information."""
        url = f'/api/jobs/{sample_job.id}'
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Verify company_info is included
        assert 'company_info' in data
        assert data['company_info'] is not None
        assert data['company_info']['name'] == sample_company.name
        assert data['company_info']['glassdoor_rating'] == 4.2
    
    def test_job_update_includes_company_info_in_response(self, authenticated_client, sample_job):
        """Test that updating a job also returns company info."""
        url = f'/api/jobs/{sample_job.id}'
        update_data = {
            'title': 'Lead Software Engineer',
            'company_name': sample_job.company_name
        }
        
        response = authenticated_client.patch(url, update_data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data['title'] == 'Lead Software Engineer'
        assert 'company_info' in data
        assert data['company_info'] is not None


class TestCompanySerializer:
    """Tests for CompanySerializer."""
    
    def test_serialize_company_with_research(self, sample_company):
        """Test serializing a company with complete research data."""
        from core.serializers import CompanySerializer
        
        serializer = CompanySerializer(sample_company)
        data = serializer.data
        
        # Basic fields
        assert data['name'] == 'Acme Inc'
        assert data['domain'] == 'acme.com'
        assert data['industry'] == 'Technology'
        assert data['size'] == '1001-5000 employees'
        assert data['hq_location'] == 'San Francisco, CA'
        
        # Convenience fields from research
        assert data['description'] == 'Leading software company building innovative solutions'
        assert data['mission_statement'] == 'To revolutionize how people work'
        assert data['employee_count'] == 2500
        assert data['glassdoor_rating'] == 4.2
        assert len(data['recent_news']) == 1
    
    def test_serialize_company_without_research(self, db):
        """Test serializing a company without research data."""
        from core.serializers import CompanySerializer
        
        company = Company.objects.create(
            name='Basic Corp',
            domain='basiccorp.com',
            industry='Finance'
        )
        
        serializer = CompanySerializer(company)
        data = serializer.data
        
        assert data['name'] == 'Basic Corp'
        assert data['domain'] == 'basiccorp.com'
        assert data['industry'] == 'Finance'
        assert data['description'] == ''
        assert data['mission_statement'] == ''
        assert data['employee_count'] is None
        assert data['glassdoor_rating'] is None
        assert data['recent_news'] == []
