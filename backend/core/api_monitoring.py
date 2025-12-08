"""
UC-117: API Rate Limiting and Error Handling Dashboard
Utilities for tracking API usage, errors, and quota management.

⚠️  CRITICAL REQUIREMENT FOR ALL DEVELOPERS ⚠️
================================================
ALL external API calls in this codebase MUST use track_api_call() context manager.
This is MANDATORY for: Gemini AI, LinkedIn, Gmail, and ANY future API integrations.

Copilot users: When implementing features that call external APIs, you MUST:
1. Import: from core.api_monitoring import track_api_call, get_or_create_service
2. Create or get service: service = get_or_create_service('name', 'type')
3. Wrap API calls: with track_api_call(service, endpoint, method, user=request.user):
4. See examples in: gmail_utils.py, cover_letter_ai.py, linkedin_integration.py

This ensures rate limiting, error tracking, quota monitoring, and weekly reports.

Usage Example:
    from core.api_monitoring import track_api_call, get_or_create_service
    
    # Register API service
    service = get_or_create_service('gemini', 'Google Gemini AI')
    
    # Track API call
    with track_api_call(service, endpoint='/v1/generate', method='POST', user=request.user):
        response = requests.post(api_url, json=data)
        # Response time and errors are automatically tracked
"""

import time
import logging
import traceback
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from django.utils import timezone
from django.db.models import Count, Avg, Max, Min, Sum, Q, F
from django.core.cache import cache
from django.conf import settings
from core.models import (
    APIService, APIUsageLog, APIQuotaUsage, APIError, APIAlert
)

logger = logging.getLogger(__name__)


# Service name constants for consistency
SERVICE_GEMINI = 'gemini'
SERVICE_GMAIL = 'gmail'
SERVICE_GOOGLE_CALENDAR = 'google_calendar'
SERVICE_GOOGLE_CONTACTS = 'google_contacts'
SERVICE_LINKEDIN = 'linkedin'
SERVICE_GITHUB = 'github'
SERVICE_OPENAI = 'openai'
SERVICE_MARKET_DATA = 'market_data'


def get_or_create_service(service_name: str, service_type: str, **kwargs) -> APIService:
    """
    Get or create an API service configuration.
    
    Args:
        service_name: Unique name for the service
        service_type: Type from APIService.SERVICE_TYPES choices
        **kwargs: Additional service configuration
        
    Returns:
        APIService instance
    """
    service, created = APIService.objects.get_or_create(
        name=service_name,
        defaults={
            'service_type': service_type,
            'is_active': True,
            **kwargs
        }
    )
    if created:
        logger.info(f"Created new API service: {service_name}")
    return service


def check_rate_limit(service: APIService, user=None) -> tuple[bool, Optional[str]]:
    """
    Check if rate limit allows making a request.
    
    Args:
        service: APIService instance
        user: Optional user making the request
        
    Returns:
        Tuple of (allowed: bool, message: Optional[str])
    """
    if not service.rate_limit_enabled:
        return True, None
    
    now = timezone.now()
    
    # Check minute limit
    if service.requests_per_minute:
        minute_ago = now - timedelta(minutes=1)
        count = APIUsageLog.objects.filter(
            service=service,
            request_at__gte=minute_ago
        ).count()
        
        if count >= service.requests_per_minute:
            return False, f"Rate limit exceeded: {service.requests_per_minute} requests/minute"
    
    # Check hour limit
    if service.requests_per_hour:
        hour_ago = now - timedelta(hours=1)
        count = APIUsageLog.objects.filter(
            service=service,
            request_at__gte=hour_ago
        ).count()
        
        if count >= service.requests_per_hour:
            return False, f"Rate limit exceeded: {service.requests_per_hour} requests/hour"
    
    # Check day limit
    if service.requests_per_day:
        day_ago = now - timedelta(days=1)
        count = APIUsageLog.objects.filter(
            service=service,
            request_at__gte=day_ago
        ).count()
        
        if count >= service.requests_per_day:
            return False, f"Rate limit exceeded: {service.requests_per_day} requests/day"
    
    return True, None


@contextmanager
def track_api_call(
    service: APIService,
    endpoint: str,
    method: str = 'GET',
    user=None,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Context manager to track API call timing and errors.
    
    Usage:
        service = get_or_create_service('gemini', 'gemini')
        with track_api_call(service, '/v1/generate', 'POST', user=request.user):
            response = requests.post(url, json=data)
            
    Args:
        service: APIService instance
        endpoint: API endpoint being called
        method: HTTP method (GET, POST, etc.)
        user: User making the request
        metadata: Additional tracking data
    """
    start_time = time.time()
    usage_log = None
    
    try:
        # Check rate limit before making request
        allowed, message = check_rate_limit(service, user)
        if not allowed:
            logger.warning(f"Rate limit check failed for {service.name}: {message}")
            # Still track the attempt
            usage_log = APIUsageLog.objects.create(
                service=service,
                user=user,
                endpoint=endpoint,
                method=method,
                success=False,
                error_message=message,
                error_type='RateLimitExceeded',
                metadata=metadata or {}
            )
            raise RateLimitException(message)
        
        yield  # Execute the API call
        
        # Success path
        response_time_ms = int((time.time() - start_time) * 1000)
        usage_log = APIUsageLog.objects.create(
            service=service,
            user=user,
            endpoint=endpoint,
            method=method,
            response_time_ms=response_time_ms,
            success=True,
            status_code=200,
            metadata=metadata or {}
        )
        
        # Update quota usage
        update_quota_usage(service)
        
    except RateLimitException:
        raise  # Re-raise rate limit exceptions
        
    except Exception as e:
        # Error path
        response_time_ms = int((time.time() - start_time) * 1000)
        error_type = type(e).__name__
        error_message = str(e)
        
        usage_log = APIUsageLog.objects.create(
            service=service,
            user=user,
            endpoint=endpoint,
            method=method,
            response_time_ms=response_time_ms,
            success=False,
            error_message=error_message[:5000],
            error_type=error_type,
            metadata=metadata or {}
        )
        
        # Log detailed error
        log_api_error(
            service=service,
            usage_log=usage_log,
            error_type=error_type,
            error_message=error_message,
            endpoint=endpoint,
            method=method,
            stack_trace=traceback.format_exc()
        )
        
        # Update service last error
        service.last_error_at = timezone.now()
        service.save(update_fields=['last_error_at'])
        
        # Check if we should create an alert
        check_and_create_alerts(service)
        
        raise  # Re-raise the original exception


def log_api_error(
    service: APIService,
    usage_log: Optional[APIUsageLog],
    error_type: str,
    error_message: str,
    endpoint: str,
    method: str,
    status_code: Optional[int] = None,
    stack_trace: str = '',
    request_data: Optional[Dict] = None,
    response_data: Optional[Dict] = None
) -> APIError:
    """
    Log an API error with full details.
    
    Returns:
        APIError instance
    """
    error = APIError.objects.create(
        service=service,
        usage_log=usage_log,
        error_type=error_type,
        error_message=error_message[:5000],
        endpoint=endpoint,
        request_method=method,
        status_code=status_code,
        stack_trace=stack_trace[:10000],
        request_data=sanitize_data(request_data or {}),
        response_data=sanitize_data(response_data or {})
    )
    
    logger.error(
        f"API Error logged: {service.name} - {error_type} - {error_message[:100]}"
    )
    
    return error


def update_quota_usage(service: APIService):
    """
    Update quota usage aggregations for a service.
    This should be called after successful API calls.
    """
    now = timezone.now()
    
    # Update hourly quota
    hour_start = now.replace(minute=0, second=0, microsecond=0)
    hour_end = hour_start + timedelta(hours=1)
    
    _update_quota_period(service, 'hour', hour_start, hour_end)
    
    # Update daily quota
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    
    _update_quota_period(service, 'day', day_start, day_end)


def _update_quota_period(service: APIService, period_type: str, period_start, period_end):
    """Update quota usage for a specific period."""
    
    # Get or create quota usage record
    quota_usage, created = APIQuotaUsage.objects.get_or_create(
        service=service,
        period_type=period_type,
        period_start=period_start,
        defaults={'period_end': period_end}
    )
    
    # Aggregate statistics from usage logs
    logs = APIUsageLog.objects.filter(
        service=service,
        request_at__gte=period_start,
        request_at__lt=period_end
    )
    
    stats = logs.aggregate(
        total=Count('id'),
        successful=Count('id', filter=Q(success=True)),
        failed=Count('id', filter=Q(success=False)),
        avg_time=Avg('response_time_ms', filter=Q(response_time_ms__isnull=False)),
        max_time=Max('response_time_ms'),
        min_time=Min('response_time_ms')
    )
    
    quota_usage.total_requests = stats['total'] or 0
    quota_usage.successful_requests = stats['successful'] or 0
    quota_usage.failed_requests = stats['failed'] or 0
    quota_usage.avg_response_time_ms = stats['avg_time']
    quota_usage.max_response_time_ms = stats['max_time']
    quota_usage.min_response_time_ms = stats['min_time']
    
    # Calculate quota percentage if limit is configured
    if period_type == 'minute' and service.requests_per_minute:
        quota_usage.quota_limit = service.requests_per_minute
        quota_usage.quota_remaining = max(0, service.requests_per_minute - quota_usage.total_requests)
        quota_usage.quota_percentage_used = (quota_usage.total_requests / service.requests_per_minute) * 100
    elif period_type == 'hour' and service.requests_per_hour:
        quota_usage.quota_limit = service.requests_per_hour
        quota_usage.quota_remaining = max(0, service.requests_per_hour - quota_usage.total_requests)
        quota_usage.quota_percentage_used = (quota_usage.total_requests / service.requests_per_hour) * 100
    elif period_type == 'day' and service.requests_per_day:
        quota_usage.quota_limit = service.requests_per_day
        quota_usage.quota_remaining = max(0, service.requests_per_day - quota_usage.total_requests)
        quota_usage.quota_percentage_used = (quota_usage.total_requests / service.requests_per_day) * 100
    
    # Set alert level based on quota percentage
    if quota_usage.quota_percentage_used:
        if quota_usage.quota_percentage_used >= 100:
            quota_usage.alert_level = 'exceeded'
        elif quota_usage.quota_percentage_used >= service.alert_threshold_critical:
            quota_usage.alert_level = 'critical'
        elif quota_usage.quota_percentage_used >= service.alert_threshold_warning:
            quota_usage.alert_level = 'warning'
        else:
            quota_usage.alert_level = 'normal'
    
    quota_usage.save()
    
    # Check for alerts
    if quota_usage.alert_level in ['warning', 'critical', 'exceeded']:
        _create_quota_alert(service, quota_usage)


def _create_quota_alert(service: APIService, quota_usage: APIQuotaUsage):
    """Create alert for quota threshold."""
    
    # Check if we already have a recent alert for this
    cache_key = f"api_alert_{service.id}_{quota_usage.period_type}_{quota_usage.alert_level}"
    if cache.get(cache_key):
        return  # Already alerted recently
    
    alert_type_map = {
        'warning': 'quota_warning',
        'critical': 'quota_critical',
        'exceeded': 'quota_exceeded'
    }
    
    alert_type = alert_type_map.get(quota_usage.alert_level, 'quota_warning')
    severity = quota_usage.alert_level if quota_usage.alert_level != 'exceeded' else 'critical'
    
    message = (
        f"{service.name} has reached {quota_usage.quota_percentage_used:.1f}% of "
        f"its {quota_usage.period_type}ly quota "
        f"({quota_usage.total_requests}/{quota_usage.quota_limit} requests)"
    )
    
    alert = APIAlert.objects.create(
        service=service,
        alert_type=alert_type,
        severity=severity,
        message=message,
        details={
            'period_type': quota_usage.period_type,
            'total_requests': quota_usage.total_requests,
            'quota_limit': quota_usage.quota_limit,
            'quota_remaining': quota_usage.quota_remaining,
            'percentage_used': quota_usage.quota_percentage_used
        }
    )
    
    logger.warning(f"API Alert created: {alert}")
    
    # Cache to prevent duplicate alerts (5 minute cooldown)
    cache.set(cache_key, True, 300)
    
    return alert


def check_and_create_alerts(service: APIService):
    """
    Check service health and create alerts if needed.
    Called after API errors.
    """
    now = timezone.now()
    
    # Check error rate in last hour
    hour_ago = now - timedelta(hours=1)
    hour_logs = APIUsageLog.objects.filter(
        service=service,
        request_at__gte=hour_ago
    )
    
    total = hour_logs.count()
    if total < 10:  # Need at least 10 requests to assess
        return
    
    errors = hour_logs.filter(success=False).count()
    error_rate = (errors / total) * 100
    
    # Create alert if error rate is high
    if error_rate >= 50:  # 50% error rate threshold
        cache_key = f"api_alert_error_rate_{service.id}"
        if not cache.get(cache_key):
            alert = APIAlert.objects.create(
                service=service,
                alert_type='high_error_rate',
                severity='critical',
                message=f"{service.name} has {error_rate:.1f}% error rate in the last hour",
                details={
                    'total_requests': total,
                    'failed_requests': errors,
                    'error_rate': error_rate,
                    'time_period': 'last_hour'
                }
            )
            logger.critical(f"High error rate alert: {alert}")
            cache.set(cache_key, True, 600)  # 10 minute cooldown


def sanitize_data(data: Dict) -> Dict:
    """
    Remove sensitive information from request/response data.
    
    Args:
        data: Dictionary potentially containing sensitive data
        
    Returns:
        Sanitized dictionary
    """
    if not isinstance(data, dict):
        return {}
    
    sensitive_keys = [
        'password', 'token', 'secret', 'api_key', 'apikey',
        'authorization', 'auth', 'credentials', 'private_key'
    ]
    
    sanitized = {}
    for key, value in data.items():
        key_lower = key.lower()
        if any(sensitive in key_lower for sensitive in sensitive_keys):
            sanitized[key] = '[REDACTED]'
        elif isinstance(value, dict):
            sanitized[key] = sanitize_data(value)
        elif isinstance(value, list):
            sanitized[key] = [sanitize_data(item) if isinstance(item, dict) else item for item in value]
        else:
            sanitized[key] = value
    
    return sanitized


def get_service_stats(service: APIService, days: int = 7) -> Dict[str, Any]:
    """
    Get comprehensive statistics for a service.
    
    Args:
        service: APIService instance
        days: Number of days to look back
        
    Returns:
        Dictionary of statistics
    """
    start_date = timezone.now() - timedelta(days=days)
    
    logs = APIUsageLog.objects.filter(
        service=service,
        request_at__gte=start_date
    )
    
    stats = logs.aggregate(
        total_requests=Count('id'),
        successful_requests=Count('id', filter=Q(success=True)),
        failed_requests=Count('id', filter=Q(success=False)),
        avg_response_time=Avg('response_time_ms'),
        max_response_time=Max('response_time_ms'),
        min_response_time=Min('response_time_ms')
    )
    
    # Get recent errors
    recent_errors = APIError.objects.filter(
        service=service,
        occurred_at__gte=start_date
    ).order_by('-occurred_at')[:10]
    
    # Get active alerts
    active_alerts = APIAlert.objects.filter(
        service=service,
        is_resolved=False
    ).order_by('-triggered_at')
    
    return {
        'service_name': service.name,
        'service_type': service.get_service_type_display(),
        'is_active': service.is_active,
        'total_requests': stats['total_requests'] or 0,
        'successful_requests': stats['successful_requests'] or 0,
        'failed_requests': stats['failed_requests'] or 0,
        'success_rate': (stats['successful_requests'] / stats['total_requests'] * 100) 
                       if stats['total_requests'] else 0,
        'avg_response_time_ms': round(stats['avg_response_time'] or 0, 2),
        'max_response_time_ms': stats['max_response_time'],
        'min_response_time_ms': stats['min_response_time'],
        'recent_errors': [
            {
                'error_type': err.error_type,
                'message': err.error_message[:200],
                'occurred_at': err.occurred_at.isoformat()
            }
            for err in recent_errors
        ],
        'active_alerts': [
            {
                'alert_type': alert.get_alert_type_display(),
                'severity': alert.severity,
                'message': alert.message,
                'triggered_at': alert.triggered_at.isoformat()
            }
            for alert in active_alerts
        ]
    }


class RateLimitException(Exception):
    """Exception raised when rate limit is exceeded."""
    pass


class APIMonitoringError(Exception):
    """Base exception for API monitoring errors."""
    pass
