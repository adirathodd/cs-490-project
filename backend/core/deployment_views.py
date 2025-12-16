"""
Deployment tracking views for CI/CD pipeline monitoring.
Provides API endpoints for recording and querying deployment history.
"""

from datetime import timedelta
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from core.models import Deployment, DeploymentLog
from core.serializers import (
    DeploymentSerializer,
    DeploymentCreateSerializer,
    DeploymentListSerializer,
    DeploymentStatsSerializer,
    DeploymentMetricsSerializer,
    DeploymentLogSerializer,
)


class DeploymentAPIKeyPermission:
    """
    Custom permission to allow access via API key for CI/CD pipelines.
    """
    def has_permission(self, request, view):
        # Check for API key in header
        api_key = request.headers.get('Authorization', '').replace('Bearer ', '')
        
        # In production, validate against stored API key
        # For now, allow if key is present or user is authenticated admin
        if api_key:
            from django.conf import settings
            valid_key = getattr(settings, 'DEPLOYMENT_API_KEY', None)
            if valid_key and api_key == valid_key:
                return True
        
        # Fall back to admin authentication
        return request.user and request.user.is_staff


class DeploymentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing deployment records.
    
    Endpoints:
    - GET /api/deployments/ - List all deployments
    - POST /api/deployments/ - Create a new deployment record
    - GET /api/deployments/{id}/ - Get deployment details
    - GET /api/deployments/stats/ - Get deployment statistics
    - GET /api/deployments/metrics/ - Get deployment metrics dashboard
    - GET /api/deployments/recent/ - Get recent deployments
    """
    queryset = Deployment.objects.all()
    permission_classes = [AllowAny]  # Will be restricted by custom logic
    
    def get_serializer_class(self):
        if self.action == 'create':
            return DeploymentCreateSerializer
        if self.action == 'list':
            return DeploymentListSerializer
        return DeploymentSerializer
    
    def get_permissions(self):
        """
        Allow anyone to create deployments (with API key validation in create).
        Restrict read access to authenticated users.
        """
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]
    
    def get_queryset(self):
        """Filter deployments based on query params."""
        queryset = Deployment.objects.all()
        
        # Filter by environment
        environment = self.request.query_params.get('environment')
        if environment:
            queryset = queryset.filter(environment=environment)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by date range
        days = self.request.query_params.get('days')
        if days:
            try:
                since = timezone.now() - timedelta(days=int(days))
                queryset = queryset.filter(started_at__gte=since)
            except ValueError:
                pass
        
        # Filter by branch
        branch = self.request.query_params.get('branch')
        if branch:
            queryset = queryset.filter(branch=branch)
        
        return queryset.order_by('-started_at')
    
    def create(self, request, *args, **kwargs):
        """
        Create a new deployment record.
        Validates API key for CI/CD pipeline access.
        """
        # Validate API key
        api_key = request.headers.get('Authorization', '').replace('Bearer ', '')
        from django.conf import settings
        valid_key = getattr(settings, 'DEPLOYMENT_API_KEY', None)
        
        # Allow if valid API key or admin user
        if not (api_key and valid_key and api_key == valid_key):
            if not (request.user and request.user.is_staff):
                return Response(
                    {'error': 'Invalid API key or insufficient permissions'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        deployment = serializer.save()
        
        # Log the deployment creation
        DeploymentLog.objects.create(
            deployment=deployment,
            level='info',
            message=f'Deployment created via API',
            step='api_create'
        )
        
        return Response(
            DeploymentSerializer(deployment).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Get deployment statistics.
        
        Query params:
        - environment: Filter by environment (staging/production)
        - days: Number of days to include (default: 30)
        """
        environment = request.query_params.get('environment')
        days = int(request.query_params.get('days', 30))
        
        stats = Deployment.get_deployment_stats(environment=environment, days=days)
        stats['environment'] = environment or 'all'
        stats['period_days'] = days
        
        if stats['total'] > 0:
            stats['deployments_per_day'] = round(stats['total'] / days, 2)
        else:
            stats['deployments_per_day'] = 0
        
        # Get last deployment
        last_deployment = Deployment.objects.all()
        if environment:
            last_deployment = last_deployment.filter(environment=environment)
        last_deployment = last_deployment.first()
        stats['last_deployment'] = DeploymentListSerializer(last_deployment).data if last_deployment else None
        
        return Response(stats)
    
    @action(detail=False, methods=['get'])
    def metrics(self, request):
        """
        Get comprehensive deployment metrics for dashboard.
        """
        days = int(request.query_params.get('days', 30))
        
        # Get stats for each environment
        production_stats = Deployment.get_deployment_stats(environment='production', days=days)
        staging_stats = Deployment.get_deployment_stats(environment='staging', days=days)
        
        # Get recent deployments
        recent_deployments = Deployment.objects.all()[:10]
        
        # Get last deployment for each environment
        last_production = Deployment.objects.filter(environment='production').first()
        last_staging = Deployment.objects.filter(environment='staging').first()
        
        # Calculate daily deployment counts for trend
        since = timezone.now() - timedelta(days=days)
        daily_data = []
        for i in range(days):
            day = since + timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            count = Deployment.objects.filter(
                started_at__gte=day_start,
                started_at__lt=day_end
            ).count()
            
            daily_data.append({
                'date': day_start.strftime('%Y-%m-%d'),
                'count': count
            })
        
        metrics = {
            'production_stats': production_stats,
            'staging_stats': staging_stats,
            'recent_deployments': DeploymentListSerializer(recent_deployments, many=True).data,
            'daily_deployments': daily_data,
            'current_production_status': last_production.status if last_production else 'unknown',
            'current_staging_status': last_staging.status if last_staging else 'unknown',
            'last_production_deployment': DeploymentListSerializer(last_production).data if last_production else None,
            'last_staging_deployment': DeploymentListSerializer(last_staging).data if last_staging else None,
        }
        
        return Response(metrics)
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """
        Get recent deployments.
        
        Query params:
        - environment: Filter by environment
        - limit: Number of deployments to return (default: 10)
        """
        environment = request.query_params.get('environment')
        limit = int(request.query_params.get('limit', 10))
        
        deployments = Deployment.get_recent_deployments(
            environment=environment,
            limit=limit
        )
        
        return Response(DeploymentListSerializer(deployments, many=True).data)
    
    @action(detail=True, methods=['post'])
    def add_log(self, request, pk=None):
        """Add a log entry to a deployment."""
        deployment = self.get_object()
        
        log = DeploymentLog.objects.create(
            deployment=deployment,
            level=request.data.get('level', 'info'),
            message=request.data.get('message', ''),
            step=request.data.get('step', '')
        )
        
        return Response(DeploymentLogSerializer(log).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def mark_complete(self, request, pk=None):
        """Mark a deployment as complete."""
        deployment = self.get_object()
        
        deployment.status = request.data.get('status', 'success')
        deployment.completed_at = timezone.now()
        
        if deployment.started_at:
            delta = deployment.completed_at - deployment.started_at
            deployment.duration_seconds = int(delta.total_seconds())
        
        deployment.health_check_passed = request.data.get('health_check_passed')
        deployment.save()
        
        DeploymentLog.objects.create(
            deployment=deployment,
            level='info',
            message=f'Deployment marked as {deployment.status}',
            step='complete'
        )
        
        return Response(DeploymentSerializer(deployment).data)
    
    @action(detail=True, methods=['post'])
    def rollback(self, request, pk=None):
        """
        Create a rollback deployment from this deployment.
        """
        original = self.get_object()
        
        # Create rollback deployment
        rollback = Deployment.objects.create(
            environment=original.environment,
            status='in_progress',
            commit_sha=request.data.get('target_sha', ''),
            commit_message=f"Rollback: {request.data.get('reason', 'No reason provided')}",
            branch='rollback',
            deployed_by=request.user.username if request.user.is_authenticated else 'system',
            is_rollback=True,
            rollback_from_sha=original.commit_sha,
            rollback_reason=request.data.get('reason', ''),
        )
        
        # Mark original as rolled back
        original.status = 'rolled_back'
        original.rolled_back_by = rollback
        original.save()
        
        DeploymentLog.objects.create(
            deployment=original,
            level='warning',
            message=f'Deployment rolled back to {rollback.commit_sha}',
            step='rollback'
        )
        
        return Response(DeploymentSerializer(rollback).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Simple health check endpoint for deployment verification.
    """
    return Response({
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'environment': getattr(__import__('django.conf', fromlist=['settings']).settings, 'ENVIRONMENT', 'unknown'),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def deployment_summary(request):
    """
    Get a quick summary of deployment status for the dashboard widget.
    """
    # Last successful deployment per environment
    last_prod = Deployment.objects.filter(
        environment='production',
        status='success'
    ).first()
    
    last_staging = Deployment.objects.filter(
        environment='staging',
        status='success'
    ).first()
    
    # Recent failures
    recent_failures = Deployment.objects.filter(
        status='failed',
        started_at__gte=timezone.now() - timedelta(days=7)
    ).count()
    
    # Stats for last 24 hours
    last_24h = Deployment.objects.filter(
        started_at__gte=timezone.now() - timedelta(hours=24)
    ).aggregate(
        total=Count('id'),
        successful=Count('id', filter=Q(status='success')),
        failed=Count('id', filter=Q(status='failed'))
    )
    
    return Response({
        'last_production': {
            'commit': last_prod.commit_sha[:7] if last_prod else None,
            'time': last_prod.completed_at.isoformat() if last_prod and last_prod.completed_at else None,
            'deployed_by': last_prod.deployed_by if last_prod else None,
        } if last_prod else None,
        'last_staging': {
            'commit': last_staging.commit_sha[:7] if last_staging else None,
            'time': last_staging.completed_at.isoformat() if last_staging and last_staging.completed_at else None,
            'deployed_by': last_staging.deployed_by if last_staging else None,
        } if last_staging else None,
        'recent_failures': recent_failures,
        'last_24h': last_24h,
    })
