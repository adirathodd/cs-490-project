"""
UC-117: API Rate Limiting and Error Handling Dashboard Views
REST API endpoints for admin dashboard to monitor API usage and errors.

These views provide:
- Overall API usage statistics
- Per-service quota and usage information  
- Error logs with filtering
- Active alerts
- Performance metrics
"""

import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Count, Avg, Sum, Q, F
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
import pytz
from core.models import (
    APIService, APIUsageLog, APIQuotaUsage, APIError, APIAlert, APIWeeklyReport
)
from core.api_monitoring import get_service_stats

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def api_monitoring_dashboard(request):
    """
    Get comprehensive API monitoring dashboard data.
    
    GET /api/admin/api-monitoring/dashboard/
    
    Query params:
        - days: Number of days to look back (default: 7)
        - tz_offset: Client timezone offset in minutes from UTC (e.g., -300 for EST)
    """
    try:
        days = int(request.query_params.get('days', 7))
        
        # Get client timezone offset (default to UTC if not provided)
        tz_offset_minutes = int(request.query_params.get('tz_offset', 0))
        client_tz = timezone.get_fixed_timezone(tz_offset_minutes)
        
        # Get current time in client timezone
        now_client = timezone.now().astimezone(client_tz)
        start_date = timezone.now() - timedelta(days=days)
        
        # Overall statistics
        all_logs = APIUsageLog.objects.filter(request_at__gte=start_date)
        overall_stats = all_logs.aggregate(
            total_requests=Count('id'),
            successful_requests=Count('id', filter=Q(success=True)),
            failed_requests=Count('id', filter=Q(success=False)),
            avg_response_time=Avg('response_time_ms')
        )
        
        success_rate = 0
        if overall_stats['total_requests']:
            success_rate = (overall_stats['successful_requests'] / overall_stats['total_requests']) * 100
        
        # Per-service statistics
        services = APIService.objects.filter(is_active=True)
        service_stats = []
        
        for service in services:
            stats = get_service_stats(service, days=days)
            
            # Add daily usage data for trends (grouped by client timezone)
            daily_usage = []
            for i in range(days):
                # Calculate day boundaries in client timezone
                day_date = (now_client - timedelta(days=days-1-i)).date()
                
                # Create timezone-aware datetime for day start/end
                day_start_naive = datetime.combine(day_date, datetime.min.time())
                day_start_local = day_start_naive.replace(tzinfo=client_tz)
                day_end_local = day_start_local + timedelta(days=1)
                
                # Convert to UTC for database query
                day_start_utc = day_start_local.astimezone(pytz.UTC)
                day_end_utc = day_end_local.astimezone(pytz.UTC)
                
                day_logs = APIUsageLog.objects.filter(
                    service=service,
                    request_at__gte=day_start_utc,
                    request_at__lt=day_end_utc
                )
                
                day_stats = day_logs.aggregate(
                    total=Count('id'),
                    successful=Count('id', filter=Q(success=True)),
                    failed=Count('id', filter=Q(success=False))
                )
                
                daily_usage.append({
                    'date': day_date.isoformat(),
                    'total_requests': day_stats['total'] or 0,
                    'successful_requests': day_stats['successful'] or 0,
                    'failed_requests': day_stats['failed'] or 0
                })
            
            stats['daily_usage'] = daily_usage
            
            # Get current quota status
            latest_quota = APIQuotaUsage.objects.filter(
                service=service,
                period_type='day'
            ).order_by('-period_start').first()
            
            if latest_quota:
                stats['quota'] = {
                    'total_requests': latest_quota.total_requests,
                    'quota_limit': latest_quota.quota_limit,
                    'quota_remaining': latest_quota.quota_remaining,
                    'percentage_used': latest_quota.quota_percentage_used,
                    'alert_level': latest_quota.alert_level
                }
            else:
                stats['quota'] = None
            
            service_stats.append(stats)
        
        # Active alerts
        active_alerts = APIAlert.objects.filter(
            is_resolved=False
        ).select_related('service').order_by('-triggered_at')[:20]
        
        alerts_data = [
            {
                'id': alert.id,
                'service_name': alert.service.name,
                'alert_type': alert.get_alert_type_display(),
                'severity': alert.severity,
                'message': alert.message,
                'details': alert.details,
                'triggered_at': alert.triggered_at.isoformat(),
                'is_acknowledged': alert.is_acknowledged
            }
            for alert in active_alerts
        ]
        
        # Recent errors
        recent_errors = APIError.objects.filter(
            occurred_at__gte=start_date,
            is_resolved=False
        ).select_related('service').order_by('-occurred_at')[:50]
        
        errors_data = [
            {
                'id': error.id,
                'service_name': error.service.name,
                'error_type': error.error_type,
                'error_message': error.error_message[:500],
                'endpoint': error.endpoint,
                'occurred_at': error.occurred_at.isoformat(),
                'status_code': error.status_code,
                'retry_count': error.retry_count
            }
            for error in recent_errors
        ]
        
        # Services approaching limits
        approaching_limit = APIQuotaUsage.objects.filter(
            period_type='day',
            quota_percentage_used__gte=75,
            period_start__gte=start_date
        ).select_related('service').order_by('-quota_percentage_used')[:10]
        
        approaching_limit_data = [
            {
                'service_name': quota.service.name,
                'percentage_used': quota.quota_percentage_used,
                'total_requests': quota.total_requests,
                'quota_limit': quota.quota_limit,
                'alert_level': quota.alert_level
            }
            for quota in approaching_limit
        ]
        
        return Response({
            'overall': {
                'total_requests': overall_stats['total_requests'] or 0,
                'successful_requests': overall_stats['successful_requests'] or 0,
                'failed_requests': overall_stats['failed_requests'] or 0,
                'success_rate': round(success_rate, 2),
                'avg_response_time_ms': round(overall_stats['avg_response_time'] or 0, 2),
                'time_period_days': days
            },
            'services': service_stats,
            'active_alerts': alerts_data,
            'recent_errors': errors_data,
            'approaching_limit': approaching_limit_data
        })
        
    except Exception as e:
        logger.error(f"Error fetching API monitoring dashboard: {e}", exc_info=True)
        return Response(
            {'error': {'message': 'Failed to load dashboard data'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def api_service_list(request):
    """
    Get list of all API services.
    
    GET /api/admin/api-monitoring/services/
    """
    try:
        services = APIService.objects.all().order_by('name')
        
        data = [
            {
                'id': service.id,
                'name': service.name,
                'service_type': service.get_service_type_display(),
                'is_active': service.is_active,
                'rate_limit_enabled': service.rate_limit_enabled,
                'requests_per_minute': service.requests_per_minute,
                'requests_per_hour': service.requests_per_hour,
                'requests_per_day': service.requests_per_day,
                'last_error_at': service.last_error_at.isoformat() if service.last_error_at else None
            }
            for service in services
        ]
        
        return Response({'services': data})
        
    except Exception as e:
        logger.error(f"Error fetching API services: {e}", exc_info=True)
        return Response(
            {'error': {'message': 'Failed to load services'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def api_service_detail(request, service_id):
    """
    Get detailed statistics for a specific API service.
    
    GET /api/admin/api-monitoring/services/<id>/
    
    Query params:
        - days: Number of days to look back (default: 7)
    """
    try:
        service = APIService.objects.get(id=service_id)
        days = int(request.query_params.get('days', 7))
        
        stats = get_service_stats(service, days=days)
        
        # Get usage trend data (daily aggregation)
        start_date = timezone.now() - timedelta(days=days)
        daily_usage = []
        
        for i in range(days):
            day_start = (timezone.now() - timedelta(days=days-i)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            day_end = day_start + timedelta(days=1)
            
            day_logs = APIUsageLog.objects.filter(
                service=service,
                request_at__gte=day_start,
                request_at__lt=day_end
            )
            
            day_stats = day_logs.aggregate(
                total=Count('id'),
                successful=Count('id', filter=Q(success=True)),
                failed=Count('id', filter=Q(success=False)),
                avg_time=Avg('response_time_ms')
            )
            
            daily_usage.append({
                'date': day_start.date().isoformat(),
                'total_requests': day_stats['total'] or 0,
                'successful_requests': day_stats['successful'] or 0,
                'failed_requests': day_stats['failed'] or 0,
                'avg_response_time_ms': round(day_stats['avg_time'] or 0, 2)
            })
        
        stats['daily_usage'] = daily_usage
        
        return Response(stats)
        
    except APIService.DoesNotExist:
        return Response(
            {'error': {'message': 'Service not found'}},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error fetching service detail: {e}", exc_info=True)
        return Response(
            {'error': {'message': 'Failed to load service details'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def api_usage_logs(request):
    """
    Get paginated API usage logs with filtering.
    
    GET /api/admin/api-monitoring/usage-logs/
    
    Query params:
        - service_id: Filter by service
        - success: Filter by success status (true/false)
        - days: Number of days to look back (default: 1)
        - page: Page number (default: 1)
        - page_size: Items per page (default: 50, max: 200)
    """
    try:
        # Parse query params
        service_id = request.query_params.get('service_id')
        success_filter = request.query_params.get('success')
        days = int(request.query_params.get('days', 1))
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 50)), 200)
        
        start_date = timezone.now() - timedelta(days=days)
        
        # Build query
        logs = APIUsageLog.objects.filter(
            request_at__gte=start_date
        ).select_related('service', 'user')
        
        if service_id:
            logs = logs.filter(service_id=service_id)
        
        if success_filter is not None:
            success_bool = success_filter.lower() == 'true'
            logs = logs.filter(success=success_bool)
        
        # Pagination
        total = logs.count()
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        logs_page = logs.order_by('-request_at')[start_idx:end_idx]
        
        data = [
            {
                'id': log.id,
                'service_name': log.service.name,
                'endpoint': log.endpoint,
                'method': log.method,
                'request_at': log.request_at.isoformat(),
                'response_time_ms': log.response_time_ms,
                'status_code': log.status_code,
                'success': log.success,
                'error_message': log.error_message[:200] if log.error_message else None,
                'error_type': log.error_type,
                'user_id': log.user_id
            }
            for log in logs_page
        ]
        
        return Response({
            'logs': data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'total_pages': (total + page_size - 1) // page_size
            }
        })
        
    except Exception as e:
        logger.error(f"Error fetching usage logs: {e}", exc_info=True)
        return Response(
            {'error': {'message': 'Failed to load usage logs'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def api_error_logs(request):
    """
    Get paginated API error logs with filtering.
    
    GET /api/admin/api-monitoring/errors/
    
    Query params:
        - service_id: Filter by service
        - error_type: Filter by error type
        - is_resolved: Filter by resolution status
        - days: Number of days to look back (default: 7)
        - page: Page number (default: 1)
        - page_size: Items per page (default: 50, max: 200)
    """
    try:
        # Parse query params
        service_id = request.query_params.get('service_id')
        error_type = request.query_params.get('error_type')
        is_resolved = request.query_params.get('is_resolved')
        days = int(request.query_params.get('days', 7))
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 50)), 200)
        
        start_date = timezone.now() - timedelta(days=days)
        
        # Build query
        errors = APIError.objects.filter(
            occurred_at__gte=start_date
        ).select_related('service')
        
        if service_id:
            errors = errors.filter(service_id=service_id)
        
        if error_type:
            errors = errors.filter(error_type=error_type)
        
        if is_resolved is not None:
            resolved_bool = is_resolved.lower() == 'true'
            errors = errors.filter(is_resolved=resolved_bool)
        
        # Pagination
        total = errors.count()
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        errors_page = errors.order_by('-occurred_at')[start_idx:end_idx]
        
        data = [
            {
                'id': error.id,
                'service_name': error.service.name,
                'error_type': error.error_type,
                'error_message': error.error_message,
                'error_code': error.error_code,
                'endpoint': error.endpoint,
                'request_method': error.request_method,
                'status_code': error.status_code,
                'occurred_at': error.occurred_at.isoformat(),
                'is_resolved': error.is_resolved,
                'resolved_at': error.resolved_at.isoformat() if error.resolved_at else None,
                'retry_count': error.retry_count,
                'affected_users_count': error.affected_users_count
            }
            for error in errors_page
        ]
        
        # Get error type distribution
        error_types = APIError.objects.filter(
            occurred_at__gte=start_date
        ).values('error_type').annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        
        return Response({
            'errors': data,
            'error_types': list(error_types),
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'total_pages': (total + page_size - 1) // page_size
            }
        })
        
    except Exception as e:
        logger.error(f"Error fetching error logs: {e}", exc_info=True)
        return Response(
            {'error': {'message': 'Failed to load error logs'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def api_alerts(request):
    """
    Get API alerts with filtering.
    
    GET /api/admin/api-monitoring/alerts/
    
    Query params:
        - service_id: Filter by service
        - alert_type: Filter by alert type
        - severity: Filter by severity
        - is_resolved: Filter by resolution status
        - days: Number of days to look back (default: 7)
    """
    try:
        service_id = request.query_params.get('service_id')
        alert_type = request.query_params.get('alert_type')
        severity = request.query_params.get('severity')
        is_resolved = request.query_params.get('is_resolved')
        days = int(request.query_params.get('days', 7))
        
        start_date = timezone.now() - timedelta(days=days)
        
        alerts = APIAlert.objects.filter(
            triggered_at__gte=start_date
        ).select_related('service')
        
        if service_id:
            alerts = alerts.filter(service_id=service_id)
        
        if alert_type:
            alerts = alerts.filter(alert_type=alert_type)
        
        if severity:
            alerts = alerts.filter(severity=severity)
        
        if is_resolved is not None:
            resolved_bool = is_resolved.lower() == 'true'
            alerts = alerts.filter(is_resolved=resolved_bool)
        
        alerts = alerts.order_by('-triggered_at')[:100]
        
        data = [
            {
                'id': alert.id,
                'service_name': alert.service.name,
                'alert_type': alert.get_alert_type_display(),
                'alert_type_code': alert.alert_type,
                'severity': alert.severity,
                'message': alert.message,
                'details': alert.details,
                'triggered_at': alert.triggered_at.isoformat(),
                'is_acknowledged': alert.is_acknowledged,
                'acknowledged_at': alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
                'is_resolved': alert.is_resolved,
                'resolved_at': alert.resolved_at.isoformat() if alert.resolved_at else None,
                'email_sent': alert.email_sent
            }
            for alert in alerts
        ]
        
        return Response({'alerts': data})
        
    except Exception as e:
        logger.error(f"Error fetching alerts: {e}", exc_info=True)
        return Response(
            {'error': {'message': 'Failed to load alerts'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def acknowledge_alert(request, alert_id):
    """
    Acknowledge an alert.
    
    POST /api/admin/api-monitoring/alerts/<id>/acknowledge/
    """
    try:
        alert = APIAlert.objects.get(id=alert_id)
        
        if not alert.is_acknowledged:
            alert.is_acknowledged = True
            alert.acknowledged_at = timezone.now()
            alert.acknowledged_by = request.user
            alert.save()
        
        return Response({
            'success': True,
            'message': 'Alert acknowledged'
        })
        
    except APIAlert.DoesNotExist:
        return Response(
            {'error': {'message': 'Alert not found'}},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error acknowledging alert: {e}", exc_info=True)
        return Response(
            {'error': {'message': 'Failed to acknowledge alert'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def resolve_alert(request, alert_id):
    """
    Resolve an alert.
    
    POST /api/admin/api-monitoring/alerts/<id>/resolve/
    """
    try:
        alert = APIAlert.objects.get(id=alert_id)
        
        if not alert.is_resolved:
            alert.is_resolved = True
            alert.resolved_at = timezone.now()
            alert.save()
        
        return Response({
            'success': True,
            'message': 'Alert resolved'
        })
        
    except APIAlert.DoesNotExist:
        return Response(
            {'error': {'message': 'Alert not found'}},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error resolving alert: {e}", exc_info=True)
        return Response(
            {'error': {'message': 'Failed to resolve alert'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def api_weekly_reports(request):
    """
    Get list of weekly API usage reports.
    
    GET /api/admin/api-monitoring/weekly-reports/
    
    Query params:
        - limit: Number of reports to return (default: 10)
    """
    try:
        limit = int(request.query_params.get('limit', 10))
        
        reports = APIWeeklyReport.objects.all().order_by('-week_start')[:limit]
        
        data = [
            {
                'id': report.id,
                'week_start': report.week_start.isoformat(),
                'week_end': report.week_end.isoformat(),
                'total_requests': report.total_requests,
                'total_errors': report.total_errors,
                'error_rate': report.error_rate,
                'avg_response_time_ms': report.avg_response_time_ms,
                'total_alerts': report.total_alerts,
                'critical_alerts': report.critical_alerts,
                'generated_at': report.generated_at.isoformat(),
                'email_sent': report.email_sent,
                'email_sent_at': report.email_sent_at.isoformat() if report.email_sent_at else None
            }
            for report in reports
        ]
        
        return Response({'reports': data})
        
    except Exception as e:
        logger.error(f"Error fetching weekly reports: {e}", exc_info=True)
        return Response(
            {'error': {'message': 'Failed to load reports'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def api_weekly_report_detail(request, report_id):
    """
    Get detailed weekly report.
    
    GET /api/admin/api-monitoring/weekly-reports/<id>/
    """
    try:
        report = APIWeeklyReport.objects.get(id=report_id)
        
        data = {
            'id': report.id,
            'week_start': report.week_start.isoformat(),
            'week_end': report.week_end.isoformat(),
            'total_requests': report.total_requests,
            'total_errors': report.total_errors,
            'error_rate': report.error_rate,
            'avg_response_time_ms': report.avg_response_time_ms,
            'service_stats': report.service_stats,
            'top_errors': report.top_errors,
            'services_approaching_limit': report.services_approaching_limit,
            'total_alerts': report.total_alerts,
            'critical_alerts': report.critical_alerts,
            'generated_at': report.generated_at.isoformat(),
            'email_sent': report.email_sent,
            'email_sent_at': report.email_sent_at.isoformat() if report.email_sent_at else None,
            'summary_text': report.summary_text,
            'html_content': report.html_content
        }
        
        return Response(data)
        
    except APIWeeklyReport.DoesNotExist:
        return Response(
            {'error': {'message': 'Report not found'}},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error fetching report detail: {e}", exc_info=True)
        return Response(
            {'error': {'message': 'Failed to load report'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
