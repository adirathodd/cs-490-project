"""
UC-117: Tests for API Monitoring and Rate Limiting
"""

import pytest
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import (
    APIService, APIUsageLog, APIQuotaUsage, APIError, APIAlert, APIWeeklyReport
)
from core.api_monitoring import (
    get_or_create_service, track_api_call, check_rate_limit,
    RateLimitException, get_service_stats, SERVICE_GEMINI
)

User = get_user_model()


@pytest.fixture
def admin_user(db):
    """Create admin user for testing."""
    user = User.objects.create_user(
        username='admin_test',
        email='admin@test.com',
        password='testpass123',
        is_staff=True,
        is_superuser=True
    )
    return user


@pytest.fixture
def regular_user(db):
    """Create regular user for testing."""
    user = User.objects.create_user(
        username='user_test',
        email='user@test.com',
        password='testpass123'
    )
    return user


@pytest.fixture
def api_service(db):
    """Create test API service."""
    return APIService.objects.create(
        name='test_service',
        service_type='other',
        rate_limit_enabled=True,
        requests_per_minute=10,
        requests_per_hour=100,
        requests_per_day=1000
    )


@pytest.mark.django_db
class TestAPIServiceModel:
    """Test APIService model."""
    
    def test_create_service(self):
        """Test creating an API service."""
        service = APIService.objects.create(
            name='gemini',
            service_type='gemini',
            description='Google Gemini AI API',
            requests_per_day=1500
        )
        assert service.name == 'gemini'
        assert service.service_type == 'gemini'
        assert service.is_active
        assert service.requests_per_day == 1500
    
    def test_service_str(self):
        """Test service string representation."""
        service = APIService.objects.create(
            name='test',
            service_type='gemini'
        )
        assert 'test' in str(service)
        assert 'Gemini' in str(service)


@pytest.mark.django_db
class TestAPIMonitoringUtilities:
    """Test API monitoring utility functions."""
    
    def test_get_or_create_service(self):
        """Test service creation via utility function."""
        service = get_or_create_service('gemini', SERVICE_GEMINI)
        assert service.name == 'gemini'
        assert service.service_type == SERVICE_GEMINI
        
        # Should return existing service
        service2 = get_or_create_service('gemini', SERVICE_GEMINI)
        assert service.id == service2.id
    
    def test_check_rate_limit_no_limit(self):
        """Test rate limit check when limits not set."""
        service = APIService.objects.create(
            name='test',
            service_type='other',
            rate_limit_enabled=False
        )
        allowed, message = check_rate_limit(service)
        assert allowed
        assert message is None
    
    def test_check_rate_limit_within_limit(self, api_service):
        """Test rate limit check when within limits."""
        # Create 5 logs (under the 10/minute limit)
        for i in range(5):
            APIUsageLog.objects.create(
                service=api_service,
                endpoint='/test',
                method='GET',
                success=True
            )
        
        allowed, message = check_rate_limit(api_service)
        assert allowed
        assert message is None
    
    def test_check_rate_limit_exceeded(self, api_service):
        """Test rate limit check when limit exceeded."""
        # Create 11 logs (exceeds 10/minute limit)
        for i in range(11):
            APIUsageLog.objects.create(
                service=api_service,
                endpoint='/test',
                method='GET',
                success=True
            )
        
        allowed, message = check_rate_limit(api_service)
        assert not allowed
        assert 'Rate limit exceeded' in message
        assert '10' in message
        assert 'minute' in message
    
    def test_track_api_call_success(self, api_service, regular_user):
        """Test tracking successful API call."""
        with track_api_call(api_service, '/test', 'GET', user=regular_user):
            # Simulate API call
            pass
        
        # Check log was created
        logs = APIUsageLog.objects.filter(service=api_service)
        assert logs.count() == 1
        
        log = logs.first()
        assert log.endpoint == '/test'
        assert log.method == 'GET'
        assert log.success
        assert log.user == regular_user
        assert log.response_time_ms is not None
    
    def test_track_api_call_error(self, api_service):
        """Test tracking failed API call."""
        with pytest.raises(ValueError):
            with track_api_call(api_service, '/test', 'POST'):
                raise ValueError('Test error')
        
        # Check error log was created
        logs = APIUsageLog.objects.filter(service=api_service)
        assert logs.count() == 1
        
        log = logs.first()
        assert not log.success
        assert log.error_type == 'ValueError'
        assert 'Test error' in log.error_message
        
        # Check APIError was created
        errors = APIError.objects.filter(service=api_service)
        assert errors.count() == 1
    
    def test_track_api_call_rate_limit(self, api_service):
        """Test tracking when rate limit exceeded."""
        # Fill up the rate limit
        for i in range(11):
            APIUsageLog.objects.create(
                service=api_service,
                endpoint='/test',
                method='GET'
            )
        
        # Should raise RateLimitException
        with pytest.raises(RateLimitException):
            with track_api_call(api_service, '/test', 'GET'):
                pass
        
        # Should still log the attempt
        logs = APIUsageLog.objects.filter(
            service=api_service,
            error_type='RateLimitExceeded'
        )
        assert logs.count() == 1
    
    def test_get_service_stats(self, api_service):
        """Test getting service statistics."""
        # Create some logs
        for i in range(10):
            APIUsageLog.objects.create(
                service=api_service,
                endpoint='/test',
                method='GET',
                success=i < 8,  # 8 successful, 2 failed
                response_time_ms=100 + i * 10
            )
        
        stats = get_service_stats(api_service, days=1)
        
        assert stats['service_name'] == 'test_service'
        assert stats['total_requests'] == 10
        assert stats['successful_requests'] == 8
        assert stats['failed_requests'] == 2
        assert stats['success_rate'] == 80.0
        assert stats['avg_response_time_ms'] > 0


@pytest.mark.django_db
class TestAPIMonitoringViews:
    """Test API monitoring REST endpoints."""
    
    def test_dashboard_requires_admin(self, regular_user):
        """Test dashboard endpoint requires admin access."""
        client = APIClient()
        client.force_authenticate(user=regular_user)
        
        response = client.get('/api/admin/api-monitoring/dashboard/')
        assert response.status_code == 403
    
    def test_dashboard_success(self, admin_user, api_service):
        """Test dashboard endpoint returns data."""
        # Create some test data
        for i in range(5):
            APIUsageLog.objects.create(
                service=api_service,
                endpoint='/test',
                method='GET',
                success=True,
                response_time_ms=100
            )
        
        client = APIClient()
        client.force_authenticate(user=admin_user)
        
        response = client.get('/api/admin/api-monitoring/dashboard/')
        assert response.status_code == 200
        
        data = response.json()
        assert 'overall' in data
        assert 'services' in data
        assert 'active_alerts' in data
        
        assert data['overall']['total_requests'] == 5
        assert data['overall']['success_rate'] == 100.0
    
    def test_service_list(self, admin_user, api_service):
        """Test service list endpoint."""
        client = APIClient()
        client.force_authenticate(user=admin_user)
        
        response = client.get('/api/admin/api-monitoring/services/')
        assert response.status_code == 200
        
        data = response.json()
        assert 'services' in data
        assert len(data['services']) == 1
        assert data['services'][0]['name'] == 'test_service'
    
    def test_usage_logs_endpoint(self, admin_user, api_service):
        """Test usage logs endpoint with pagination."""
        # Create 30 logs
        for i in range(30):
            APIUsageLog.objects.create(
                service=api_service,
                endpoint=f'/test/{i}',
                method='GET',
                success=True
            )
        
        client = APIClient()
        client.force_authenticate(user=admin_user)
        
        response = client.get('/api/admin/api-monitoring/usage-logs/?page_size=10')
        assert response.status_code == 200
        
        data = response.json()
        assert len(data['logs']) == 10
        assert data['pagination']['total'] == 30
        assert data['pagination']['total_pages'] == 3
    
    def test_error_logs_endpoint(self, admin_user, api_service):
        """Test error logs endpoint."""
        # Create error
        error = APIError.objects.create(
            service=api_service,
            error_type='TestError',
            error_message='Test error message',
            endpoint='/test',
            request_method='GET'
        )
        
        client = APIClient()
        client.force_authenticate(user=admin_user)
        
        response = client.get('/api/admin/api-monitoring/errors/')
        assert response.status_code == 200
        
        data = response.json()
        assert len(data['errors']) == 1
        assert data['errors'][0]['error_type'] == 'TestError'
    
    def test_alerts_endpoint(self, admin_user, api_service):
        """Test alerts endpoint."""
        # Create alert
        alert = APIAlert.objects.create(
            service=api_service,
            alert_type='quota_warning',
            severity='warning',
            message='Approaching quota limit'
        )
        
        client = APIClient()
        client.force_authenticate(user=admin_user)
        
        response = client.get('/api/admin/api-monitoring/alerts/')
        assert response.status_code == 200
        
        data = response.json()
        assert len(data['alerts']) == 1
        assert data['alerts'][0]['alert_type'] == 'Quota Warning'
    
    def test_acknowledge_alert(self, admin_user, api_service):
        """Test acknowledging an alert."""
        alert = APIAlert.objects.create(
            service=api_service,
            alert_type='quota_warning',
            severity='warning',
            message='Test alert'
        )
        
        client = APIClient()
        client.force_authenticate(user=admin_user)
        
        response = client.post(f'/api/admin/api-monitoring/alerts/{alert.id}/acknowledge/')
        assert response.status_code == 200
        
        alert.refresh_from_db()
        assert alert.is_acknowledged
        assert alert.acknowledged_by == admin_user
    
    def test_resolve_alert(self, admin_user, api_service):
        """Test resolving an alert."""
        alert = APIAlert.objects.create(
            service=api_service,
            alert_type='quota_warning',
            severity='warning',
            message='Test alert'
        )
        
        client = APIClient()
        client.force_authenticate(user=admin_user)
        
        response = client.post(f'/api/admin/api-monitoring/alerts/{alert.id}/resolve/')
        assert response.status_code == 200
        
        alert.refresh_from_db()
        assert alert.is_resolved
        assert alert.resolved_at is not None
    
    def test_weekly_reports_endpoint(self, admin_user):
        """Test weekly reports endpoint."""
        # Create a report
        report = APIWeeklyReport.objects.create(
            week_start=timezone.now().date() - timedelta(days=7),
            week_end=timezone.now().date(),
            total_requests=1000,
            total_errors=50,
            error_rate=5.0
        )
        
        client = APIClient()
        client.force_authenticate(user=admin_user)
        
        response = client.get('/api/admin/api-monitoring/weekly-reports/')
        assert response.status_code == 200
        
        data = response.json()
        assert len(data['reports']) == 1
        assert data['reports'][0]['total_requests'] == 1000


@pytest.mark.django_db
class TestWeeklyReportGeneration:
    """Test weekly report generation."""
    
    def test_generate_report_basic(self):
        """Test basic weekly report generation without data."""
        from core.tasks import _generate_weekly_api_report_sync
        
        # Generate report (should work even with no data)
        report = _generate_weekly_api_report_sync()
        
        assert report is not None
        assert report.week_start is not None
        assert report.week_end is not None
        assert report.total_requests >= 0
        assert report.email_sent is True
        assert report.html_content is not None
        assert report.summary_text is not None


@pytest.mark.django_db
class TestAPIQuotaAggregation:
    """Test quota usage aggregation."""
    
    def test_quota_usage_creation(self, api_service):
        """Test quota usage record creation."""
        from core.api_monitoring import update_quota_usage
        from unittest.mock import patch
        
        # Create some logs
        for i in range(50):
            APIUsageLog.objects.create(
                service=api_service,
                endpoint='/test',
                method='GET',
                success=True,
                response_time_ms=100
            )
        
        # Mock cache to avoid Redis dependency in tests
        with patch('core.api_monitoring.cache') as mock_cache:
            mock_cache.get.return_value = None
            mock_cache.set.return_value = True
            
            # Update quota
            update_quota_usage(api_service)
        
        # Check quota record was created
        quota = APIQuotaUsage.objects.filter(
            service=api_service,
            period_type='day'
        ).first()
        
        assert quota is not None
        assert quota.total_requests == 50
        assert quota.successful_requests == 50
        assert quota.quota_limit == 1000
        assert quota.quota_percentage_used == 5.0
        assert quota.alert_level == 'normal'
    
    def test_quota_warning_alert(self, api_service):
        """Test alert creation when approaching quota."""
        from core.api_monitoring import update_quota_usage
        from unittest.mock import patch
        
        # Create 800 logs (80% of 1000 daily limit - above warning threshold)
        for i in range(800):
            APIUsageLog.objects.create(
                service=api_service,
                endpoint='/test',
                method='GET',
                success=True
            )
        
        # Mock cache to avoid Redis dependency in tests
        with patch('core.api_monitoring.cache') as mock_cache:
            mock_cache.get.return_value = None
            mock_cache.set.return_value = True
            
            # Update quota
            update_quota_usage(api_service)
        
        # Check quota status
        quota = APIQuotaUsage.objects.filter(
            service=api_service,
            period_type='day'
        ).first()
        
        assert quota.alert_level == 'warning'
        
        # Check alert was created
        alerts = APIAlert.objects.filter(
            service=api_service,
            alert_type='quota_warning'
        )
        assert alerts.exists()
