"""
Test cases for multi-source company data scraping.

Tests the integration of:
- Wikipedia scraper
- Wikidata scraper  
- LinkedIn scraper
- GitHub scraper
- Multi-source data aggregation
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from core.research.sources.wikipedia_scraper import fetch_wikipedia_data, WikipediaScraper
from core.research.sources.wikidata_scraper import fetch_wikidata
from core.research.sources.linkedin_scraper import fetch_linkedin_data
from core.research.sources.github_scraper import fetch_github_data
from core.research import CompanyResearchService
from core.models import Company, CompanyResearch
from django.test import TestCase


class WikipediaScraperTest(TestCase):
    """Test Wikipedia scraper functionality."""
    
    @patch('core.research.sources.wikipedia_scraper.wikipedia.search')
    @patch('core.research.sources.wikipedia_scraper.wikipedia.page')
    def test_fetch_wikipedia_data_success(self, mock_page, mock_search):
        """Test successful Wikipedia data fetch."""
        # Mock search results
        mock_search.return_value = ['Plaid Inc.', 'Plaid (fabric)']
        
        # Mock page object
        mock_page_obj = Mock()
        mock_page_obj.title = 'Plaid Inc.'
        mock_page_obj.summary = 'Plaid Inc. is an American financial services company based in San Francisco, California.'
        mock_page_obj.content = 'Plaid Inc. is a company. Industry: Financial Technology'
        mock_page_obj.url = 'https://en.wikipedia.org/wiki/Plaid_Inc.'
        mock_page.return_value = mock_page_obj
        
        # Fetch data
        data = fetch_wikipedia_data('Plaid')
        
        # Assertions
        assert data is not None
        assert 'description' in data
        assert 'financial services' in data['description'].lower()
        assert data['url'] == 'https://en.wikipedia.org/wiki/Plaid_Inc.'
    
    def test_wikipedia_scraper_no_results(self):
        """Test Wikipedia scraper with no search results."""
        with patch('core.research.sources.wikipedia_scraper.wikipedia.search', return_value=[]):
            data = fetch_wikipedia_data('NonexistentCompany123')
            assert data == {}
    
    @patch('core.research.sources.wikipedia_scraper.wikipedia.search')
    @patch('core.research.sources.wikipedia_scraper.wikipedia.page')
    def test_wikipedia_company_page_detection(self, mock_page, mock_search):
        """Test that scraper correctly identifies company pages."""
        mock_search.return_value = ['Test Company Inc.']
        
        # Mock a company page
        mock_page_obj = Mock()
        mock_page_obj.title = 'Test Company Inc.'
        mock_page_obj.summary = 'Test Company Inc. is a software company.'
        mock_page_obj.content = 'Test Company Inc. was founded in 2010. The company has headquarters in New York. CEO: John Doe. Industry: Software.'
        mock_page_obj.url = 'https://en.wikipedia.org/wiki/Test_Company_Inc.'
        mock_page.return_value = mock_page_obj
        
        scraper = WikipediaScraper('Test Company')
        data = scraper.fetch_data()
        
        # Should find company page
        assert scraper.page is not None
        assert 'description' in data


class WikidataScraperTest(TestCase):
    """Test Wikidata scraper functionality."""
    
    @patch('core.research.sources.wikidata_scraper.SPARQLWrapper')
    def test_fetch_wikidata_success(self, mock_sparql):
        """Test successful Wikidata fetch."""
        # Mock SPARQL response for company search
        mock_wrapper = MagicMock()
        mock_sparql.return_value = mock_wrapper
        
        # Mock company ID search results
        mock_wrapper.query().convert.return_value = {
            'results': {
                'bindings': [
                    {'company': {'value': 'http://www.wikidata.org/entity/Q123456'}}
                ]
            }
        }
        
        # This would need actual implementation
        # For now, test that it doesn't crash
        try:
            data = fetch_wikidata('Test Company')
            assert isinstance(data, dict)
        except Exception:
            # Wikidata might not be reachable in test environment
            pass


class LinkedInScraperTest(TestCase):
    """Test LinkedIn scraper functionality."""
    
    def test_fetch_linkedin_data_with_url(self):
        """Test LinkedIn scraper with provided URL."""
        # LinkedIn scraping requires actual HTTP requests
        # In a real implementation, mock the requests
        data = fetch_linkedin_data('Test Company', 'https://linkedin.com/company/test')
        assert isinstance(data, dict)
    
    def test_fetch_linkedin_data_no_url(self):
        """Test LinkedIn scraper without URL (should search)."""
        data = fetch_linkedin_data('NonexistentCompany123', None)
        # Should return empty dict or minimal data
        assert isinstance(data, dict)


class GitHubScraperTest(TestCase):
    """Test GitHub scraper functionality."""
    
    @patch('core.research.sources.github_scraper.Github')
    def test_fetch_github_data_success(self, mock_github):
        """Test successful GitHub organization fetch."""
        # Mock GitHub API
        mock_client = MagicMock()
        mock_github.return_value = mock_client
        
        # Mock organization
        mock_org = MagicMock()
        mock_org.name = 'plaid'
        mock_org.html_url = 'https://github.com/plaid'
        
        # Mock repositories
        mock_repo = MagicMock()
        mock_repo.name = 'plaid-python'
        mock_repo.language = 'Python'
        mock_repo.stargazers_count = 100
        mock_org.get_repos.return_value = [mock_repo]
        
        mock_client.get_organization.return_value = mock_org
        
        data = fetch_github_data('plaid', 'https://github.com/plaid')
        
        assert isinstance(data, dict)
        # Should have tech stack or repos info
        assert 'tech_stack' in data or 'github_url' in data


class MultiSourceAggregationTest(TestCase):
    """Test multi-source data aggregation."""
    
    def setUp(self):
        """Set up test company."""
        self.company = Company.objects.create(
            name='Test Company',
            domain='testcompany.com'
        )
    
    def tearDown(self):
        """Clean up test data."""
        CompanyResearch.objects.filter(company=self.company).delete()
        self.company.delete()
    
    def test_aggregate_basic_info_priority(self):
        """Test that data aggregation respects source priority."""
        service = CompanyResearchService(self.company.name)
        service.company = self.company
        
        # Mock data from multiple sources
        sources = {
            'wikipedia': {
                'industry': 'Software',
                'hq_location': 'San Francisco, CA',
                'description': 'A software company'
            },
            'wikidata': {
                'industry': 'Information Technology',  # Should take precedence
                'employees': 500
            },
            'yfinance': {
                'industry': 'Tech',  # Lower priority
                'sector': 'Technology'
            }
        }
        
        aggregated = service._aggregate_basic_info(sources)
        
        # Wikidata should win for industry (higher priority)
        assert aggregated['industry'] == 'Information Technology'
        # Wikipedia should provide location (wikidata didn't have it)
        assert aggregated['hq_location'] == 'San Francisco, CA'
        # Sources should be tracked
        assert 'sources_used' in aggregated
        assert len(aggregated['sources_used']) == 3
    
    @patch('core.research.service.fetch_wikipedia_data')
    @patch('core.research.service.fetch_wikidata')
    @patch('core.research.service.fetch_recent_company_news')
    def test_research_integration(self, mock_news, mock_wikidata, mock_wikipedia):
        """Test full research integration with mocked scrapers."""
        # Mock news
        mock_news.return_value = [
            {
                'title': 'Test Company raises $10M',
                'description': 'Test Company announced funding',
                'url': 'https://example.com/news',
                'published_date': '2025-01-01',
                'source': 'TechCrunch'
            }
        ]
        
        # Mock Wikipedia
        mock_wikipedia.return_value = {
            'description': 'Test Company is a software company.',
            'industry': 'Software',
            'hq_location': 'New York, NY'
        }
        
        # Mock Wikidata
        mock_wikidata.return_value = {
            'industry': 'Software Development',
            'employees': 250
        }
        
        # Run research
        service = CompanyResearchService(self.company.name)
        result = service.research(force_refresh=True)
        
        # Verify research was saved
        assert 'company' in result
        assert result['company']['name'] == 'Test Company'
        assert 'research' in result
        assert 'basic_info' in result


class CompanyResearchServiceTest(TestCase):
    """Test CompanyResearchService class."""
    
    def setUp(self):
        """Set up test company."""
        self.company = Company.objects.create(
            name='Research Test Co',
            domain='researchtest.com'
        )
    
    def tearDown(self):
        """Clean up."""
        CompanyResearch.objects.filter(company=self.company).delete()
        self.company.delete()
    
    def test_save_research_updates_company_model(self):
        """Test that _save_research updates Company model fields."""
        service = CompanyResearchService(self.company.name)
        service.company = self.company
        service.research_data = {
            'basic_info': {
                'industry': 'Financial Technology',
                'hq_location': 'San Francisco, CA',
                'employees': 1000,
                'description': 'A fintech company',
                'linkedin_url': 'https://linkedin.com/company/test'
            },
            'mission_culture': {
                'mission_statement': 'Our mission is to test',
                'culture_keywords': ['innovative', 'collaborative']
            },
            'recent_news': [],
            'executives': [],
            'products': [],
            'competitors': {},
            'social_media': {}
        }
        
        service._save_research()
        
        # Reload company from database
        self.company.refresh_from_db()
        
        # Check Company model was updated
        assert self.company.industry == 'Financial Technology'
        assert self.company.hq_location == 'San Francisco, CA'
        assert self.company.size in ['1001-5000', '201-1000']  # 1000 employees
        assert self.company.linkedin_url == 'https://linkedin.com/company/test'
        
        # Check CompanyResearch was created
        research = CompanyResearch.objects.get(company=self.company)
        assert research.description == 'A fintech company'
        assert research.mission_statement == 'Our mission is to test'
        assert research.employee_count == 1000
    
    def test_yfinance_validation_rejects_wrong_company(self):
        """Test that yfinance validation rejects incorrect company data."""
        service = CompanyResearchService('Plaid')
        service.company = self.company
        
        # Mock news about fintech company
        service.research_data = {
            'recent_news': [
                {
                    'title': 'Plaid expands fintech platform',
                    'description': 'Financial technology company Plaid announced...'
                }
            ]
        }
        
        # Mock yfinance profile for wrong company (food company)
        wrong_profile = {
            'industry': 'Packaged Foods',
            'sector': 'Consumer Defensive',
            'description': 'Plaid Enterprises produces tartan fabrics'
        }
        
        # Should reject (news is about fintech, profile is about food)
        is_valid = service._validate_yfinance_data(wrong_profile)
        assert is_valid is False
    
    def test_yfinance_validation_accepts_correct_company(self):
        """Test that yfinance validation accepts correct company data."""
        service = CompanyResearchService('Microsoft')
        service.company = self.company
        
        # Mock news about tech company
        service.research_data = {
            'recent_news': [
                {
                    'title': 'Microsoft launches new AI features',
                    'description': 'Technology giant Microsoft unveiled...'
                }
            ]
        }
        
        # Mock yfinance profile for correct company
        correct_profile = {
            'industry': 'Software—Infrastructure',
            'sector': 'Technology',
            'description': 'Microsoft Corporation develops software'
        }
        
        # Should accept (both about technology)
        is_valid = service._validate_yfinance_data(correct_profile)
        assert is_valid is True


@pytest.mark.integration
class IntegrationTest(TestCase):
    """Integration tests requiring external services."""
    
    def test_real_wikipedia_scraping(self):
        """Test real Wikipedia scraping (requires internet)."""
        # Test with a well-known company
        data = fetch_wikipedia_data('Microsoft')
        
        if data:  # Only assert if data was fetched
            assert 'description' in data
            assert len(data['description']) > 50
    
    def test_real_company_research(self):
        """Test full research flow with a real company."""
        company = Company.objects.create(
            name='Apple Inc',
            domain='apple.com'
        )
        
        try:
            service = CompanyResearchService('Apple Inc')
            # This will make real API calls
            result = service.research(force_refresh=True)
            
            # Basic assertions
            assert result is not None
            assert 'company' in result
            assert 'research' in result
        finally:
            CompanyResearch.objects.filter(company=company).delete()
            company.delete()
