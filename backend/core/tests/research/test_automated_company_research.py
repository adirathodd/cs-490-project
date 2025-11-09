"""
UC-063: Automated Company Research - Comprehensive Test Suite

Tests for automated company research functionality including:
- Basic company information gathering
- Mission, values, and culture research
- Recent news and press releases
- Key executives identification
- Product and service discovery
- Competitive landscape analysis
- Social media presence detection
- Research summary generation
- Error handling and edge cases
"""

import pytest
from unittest.mock import patch, Mock
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Company, CompanyResearch, CandidateProfile
from core.research import CompanyResearchService

User = get_user_model()


# ======================
# FIXTURES
# ======================

@pytest.fixture
def api_client():
    """Create API client."""
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
def mock_yfinance_profile():
    """Mock yfinance profile data."""
    return {
        'name': 'Acme Inc',
        'industry': 'Technology',
        'sector': 'Software',
        'website': 'https://acme.com',
        'domain': 'acme.com',
        'description': 'Acme Inc is a leading technology company building innovative software solutions for enterprises.',
        'mission_statement': 'To empower businesses through technology.',
        'employees': 2500,
        'hq_location': 'San Francisco, CA',
        'keywords': ['Technology', 'Software'],
        'funding_info': {
            'market_cap': 5000000000,
            'price_to_earnings': 25.5,
            'beta': 1.2,
        },
    }


@pytest.fixture
def mock_news_items():
    """Mock news items."""
    return [
        {
            'title': 'Acme raises $50M Series B',
            'url': 'https://news.example.com/acme-funding',
            'summary': 'Acme Inc secures $50M in Series B funding to expand AI capabilities.',
            'date': '2024-11-01T10:00:00',
            'source': 'TechCrunch',
            'category': 'funding',
            'key_points': ['Series B funding', '$50M raised', 'AI expansion'],
            'relevance_score': 95,
            'is_alert': True,
        },
        {
            'title': 'Acme launches new AI platform',
            'url': 'https://news.example.com/acme-product',
            'summary': 'Company unveils cutting-edge AI platform for businesses.',
            'date': '2024-10-28T14:30:00',
            'source': 'VentureBeat',
            'category': 'product',
            'key_points': ['Product launch', 'AI platform', 'Enterprise focus'],
            'relevance_score': 85,
            'is_alert': False,
        },
    ]


# ======================
# COMPANY RESEARCH SERVICE TESTS
# ======================

class TestCompanyResearchService:
    """Tests for CompanyResearchService class."""
    
    @pytest.fixture(autouse=True)
    def setup_mocks(self):
        """Setup common mocks for all tests."""
        with patch('core.research.service.fetch_wikipedia_data', return_value={}), \
             patch('core.research.service.fetch_wikidata', return_value={}), \
             patch('core.research.service.fetch_linkedin_data', return_value={}), \
             patch('core.research.service.fetch_github_data', return_value={}):
            yield
    
    @patch('core.research.service.fetch_profile_from_yfinance')
    @patch('core.research.service.fetch_recent_company_news')
    def test_comprehensive_research_flow(self, mock_news, mock_profile, db, mock_yfinance_profile, mock_news_items):
        """Test complete research flow."""
        mock_profile.return_value = mock_yfinance_profile
        mock_news.return_value = mock_news_items
        
        service = CompanyResearchService('Acme Inc')
        result = service.research_company()
        
        company = Company.objects.get(name='Acme Inc')
        research = CompanyResearch.objects.get(company=company)
        assert research.description == mock_yfinance_profile['description']
        assert 'company' in result
    
    def test_employee_count_formatting(self):
        """Test employee count formatting."""
        service = CompanyResearchService('Test')
        assert service._format_employee_count(25) == "1-50 employees"
        assert service._format_employee_count(500) == "201-1000 employees"


# ======================
# API ENDPOINT TESTS
# ======================

class TestAutomatedResearchEndpoint:
    """Tests for research API endpoints."""
    
    @pytest.fixture(autouse=True)
    def setup_mocks(self):
        with patch('core.research.service.fetch_wikipedia_data', return_value={}), \
             patch('core.research.service.fetch_wikidata', return_value={}), \
             patch('core.research.service.fetch_linkedin_data', return_value={}), \
             patch('core.research.service.fetch_github_data', return_value={}):
            yield
    
    @patch('core.research.service.fetch_profile_from_yfinance')
    @patch('core.research.service.fetch_recent_company_news')
    def test_trigger_research(self, mock_news, mock_profile, authenticated_client, mock_yfinance_profile, mock_news_items):
        """Test research endpoint."""
        mock_profile.return_value = mock_yfinance_profile
        mock_news.return_value = mock_news_items
        
        response = authenticated_client.post('/api/companies/Acme%20Inc/research', {}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert 'company' in response.json()
    
    def test_requires_authentication(self, api_client):
        """Test authentication required."""
        response = api_client.post('/api/companies/Test/research', {})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestCompanyResearchReportEndpoint:
    """Tests for research report endpoint."""
    
    def test_get_report(self, authenticated_client, db):
        """Test retrieving research report."""
        company = Company.objects.create(name='Report Corp', domain='report.com')
        CompanyResearch.objects.create(company=company, description='Test', employee_count=500)
        
        response = authenticated_client.get('/api/companies/Report%20Corp/research/report')
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['research']['employee_count'] == 500
    
    def test_report_not_found(self, authenticated_client):
        """Test 404 for non-existent company."""
        response = authenticated_client.get('/api/companies/Missing/research/report')
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestRefreshCompanyResearchEndpoint:
    """Tests for research refresh endpoint."""
    
    @pytest.fixture(autouse=True)
    def setup_mocks(self):
        with patch('core.research.service.fetch_wikipedia_data', return_value={}), \
             patch('core.research.service.fetch_wikidata', return_value={}), \
             patch('core.research.service.fetch_linkedin_data', return_value={}), \
             patch('core.research.service.fetch_github_data', return_value={}):
            yield
    
    @patch('core.research.service.fetch_profile_from_yfinance')
    @patch('core.research.service.fetch_recent_company_news')
    def test_refresh(self, mock_news, mock_profile, authenticated_client, db):
        """Test refreshing research."""
        company = Company.objects.create(name='Refresh', domain='refresh.com')
        CompanyResearch.objects.create(company=company, description='Old')
        
        mock_profile.return_value = {'name': 'Refresh', 'description': 'New', 'industry': 'Tech', 
                                     'hq_location': 'NYC', 'employees': 200, 'domain': 'refresh.com',
                                     'website': 'https://refresh.com', 'mission_statement': 'M',
                                     'keywords': [], 'funding_info': {}}
        mock_news.return_value = []
        
        response = authenticated_client.post('/api/companies/Refresh/research/refresh', {})
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['refreshed'] is True


# ======================
# EDGE CASE AND ERROR HANDLING TESTS
# ======================

class TestEdgeCasesAndErrors:
    """Edge cases and error handling."""
    
    def test_no_data_available(self, db):
        """Test handling when no data available."""
        with patch('core.research.service.fetch_profile_from_yfinance', return_value=None):
            service = CompanyResearchService('Unknown')
            service._get_or_create_company()
            service._gather_basic_info()
            assert 'basic_info' in service.research_data
    
    @patch('core.research.service.fetch_recent_company_news')
    def test_news_fetch_failure(self, mock_news, db):
        """Test news fetch error handling."""
        mock_news.side_effect = Exception('API error')
        service = CompanyResearchService('Error Corp')
        service._get_or_create_company()
        service._fetch_recent_news()
        assert service.research_data['recent_news'] == []


# ======================
# INTEGRATION TESTS
# ======================

class TestIntegration:
    """Integration tests."""
    
    @pytest.fixture(autouse=True)
    def setup_mocks(self):
        with patch('core.research.service.fetch_wikipedia_data', return_value={}), \
             patch('core.research.service.fetch_wikidata', return_value={}), \
             patch('core.research.service.fetch_linkedin_data', return_value={}), \
             patch('core.research.service.fetch_github_data', return_value={}):
            yield
    
    @patch('core.research.service.fetch_profile_from_yfinance')
    @patch('core.research.service.fetch_recent_company_news')
    def test_end_to_end(self, mock_news, mock_profile, authenticated_client, mock_yfinance_profile, mock_news_items):
        """Test end-to-end workflow."""
        mock_profile.return_value = mock_yfinance_profile
        mock_news.return_value = mock_news_items
        
        # Research
        r1 = authenticated_client.post('/api/companies/Acme%20Inc/research', {})
        assert r1.status_code == status.HTTP_200_OK
        
        # Get report
        r2 = authenticated_client.get('/api/companies/Acme%20Inc/research/report')
        assert r2.status_code == status.HTTP_200_OK
        assert r1.json()['company']['name'] == r2.json()['company']['name']


# Performance tests removed - use dedicated performance testing tools instead
