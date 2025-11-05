"""
Tests for job import from URL functionality (SCRUM-39).
"""
import pytest
from unittest.mock import patch, Mock
from core.job_import_utils import (
    import_job_from_url,
    detect_job_board,
    JobImportResult,
    clean_text
)


class TestJobImportUtils:
    """Test job import utility functions"""
    
    def test_clean_text(self):
        """Test text cleaning function"""
        assert clean_text('  Hello   World  ') == 'Hello World'
        assert clean_text('Line1\n\nLine2') == 'Line1 Line2'
        assert clean_text('') == ''
        assert clean_text(None) == ''
    
    def test_detect_job_board_linkedin(self):
        """Test LinkedIn URL detection"""
        url = 'https://www.linkedin.com/jobs/view/123456'
        assert detect_job_board(url) == 'linkedin'
        
        url = 'https://linkedin.com/jobs/view/123456'
        assert detect_job_board(url) == 'linkedin'
    
    def test_detect_job_board_indeed(self):
        """Test Indeed URL detection"""
        url = 'https://www.indeed.com/viewjob?jk=123456'
        assert detect_job_board(url) == 'indeed'
        
        url = 'https://indeed.com/viewjob?jk=123456'
        assert detect_job_board(url) == 'indeed'
    
    def test_detect_job_board_glassdoor(self):
        """Test Glassdoor URL detection"""
        url = 'https://www.glassdoor.com/job-listing/details.htm'
        assert detect_job_board(url) == 'glassdoor'
        
        url = 'https://glassdoor.com/job-listing/details.htm'
        assert detect_job_board(url) == 'glassdoor'
    
    def test_detect_job_board_unsupported(self):
        """Test unsupported URL"""
        url = 'https://www.example.com/jobs/123'
        assert detect_job_board(url) is None
    
    def test_import_invalid_url(self):
        """Test import with invalid URL"""
        result = import_job_from_url('')
        assert result.status == JobImportResult.STATUS_FAILED
        assert 'Invalid URL' in result.error
        
        result = import_job_from_url('not-a-url')
        assert result.status == JobImportResult.STATUS_FAILED
    
    def test_import_unsupported_job_board(self):
        """Test import with unsupported job board"""
        result = import_job_from_url('https://www.example.com/jobs/123')
        assert result.status == JobImportResult.STATUS_FAILED
        assert 'Unsupported' in result.error
    
    @patch('core.job_import_utils.requests.get')
    def test_import_linkedin_success(self, mock_get):
        """Test successful LinkedIn job import"""
        # Mock HTML response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b'''
        <html>
            <body>
                <h1 class="top-card-layout__title">Software Engineer</h1>
                <a class="topcard__org-name-link">Acme Inc</a>
                <span class="topcard__flavor--bullet">New York, NY</span>
                <div class="show-more-less-html__markup">
                    <p>This is a job description.</p>
                </div>
            </body>
        </html>
        '''
        mock_get.return_value = mock_response
        
        url = 'https://www.linkedin.com/jobs/view/123456'
        result = import_job_from_url(url)
        
        assert result.status in [JobImportResult.STATUS_SUCCESS, JobImportResult.STATUS_PARTIAL]
        assert 'title' in result.data
        assert 'company_name' in result.data
        assert result.data['posting_url'] == url
    
    @patch('core.job_import_utils.requests.get')
    def test_import_request_failure(self, mock_get):
        """Test import with network failure"""
        mock_get.side_effect = Exception('Network error')
        
        url = 'https://www.linkedin.com/jobs/view/123456'
        result = import_job_from_url(url)
        
        assert result.status == JobImportResult.STATUS_FAILED
        assert 'Failed to' in result.error
    
    def test_job_import_result_to_dict(self):
        """Test JobImportResult serialization"""
        result = JobImportResult(
            status=JobImportResult.STATUS_SUCCESS,
            data={'title': 'Test Job', 'company_name': 'Test Co'},
            fields_extracted=['title', 'company_name']
        )
        
        data = result.to_dict()
        assert data['status'] == 'success'
        assert data['data']['title'] == 'Test Job'
        assert 'title' in data['fields_extracted']


@pytest.mark.django_db
class TestJobImportAPI:
    """Test job import API endpoint"""
    
    def setup_method(self):
        """Set up test client and authenticated user"""
        from rest_framework.test import APIClient
        from django.contrib.auth import get_user_model
        from core.models import CandidateProfile
        
        User = get_user_model()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testimportuid',
            email='import@example.com',
            password='testpass123'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
    
    def test_import_endpoint_requires_authentication(self):
        """Test that import endpoint requires authentication"""
        from rest_framework.test import APIClient
        
        unauthenticated_client = APIClient()
        response = unauthenticated_client.post('/api/jobs/import-from-url', {'url': 'https://example.com'})
        assert response.status_code == 401
    
    def test_import_endpoint_requires_url(self):
        """Test that import endpoint requires URL parameter"""
        response = self.client.post('/api/jobs/import-from-url', {})
        assert response.status_code == 400
        data = response.json()
        error_msg = str(data).lower()
        assert 'url' in error_msg or 'required' in error_msg
    
    @patch('core.job_import_utils.import_job_from_url')
    def test_import_endpoint_success(self, mock_import):
        """Test successful import via API"""
        from core.job_import_utils import JobImportResult
        
        mock_import.return_value = JobImportResult(
            status=JobImportResult.STATUS_SUCCESS,
            data={
                'title': 'Software Engineer',
                'company_name': 'Acme Inc',
                'location': 'New York, NY',
                'description': 'Great opportunity',
                'posting_url': 'https://www.linkedin.com/jobs/view/123456'
            },
            fields_extracted=['title', 'company_name', 'location', 'description']
        )
        
        response = self.client.post(
            '/api/jobs/import-from-url',
            {'url': 'https://www.linkedin.com/jobs/view/123456'},
            format='json'
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'success'
        assert data['data']['title'] == 'Software Engineer'
        assert 'title' in data['fields_extracted']
    
    @patch('core.job_import_utils.import_job_from_url')
    def test_import_endpoint_failure(self, mock_import):
        """Test failed import via API"""
        from core.job_import_utils import JobImportResult
        
        mock_import.return_value = JobImportResult(
            status=JobImportResult.STATUS_FAILED,
            error='Unsupported job board'
        )
        
        response = self.client.post(
            '/api/jobs/import-from-url',
            {'url': 'https://www.example.com/jobs/123'},
            format='json'
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data['status'] == 'failed'
        assert 'error' in data
