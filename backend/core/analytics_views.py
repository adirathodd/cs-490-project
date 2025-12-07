"""
Enhanced analytics view with cover letter performance tracking
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from core.models import CandidateProfile, JobEntry, Document, JobStatusChange
from core.models import CandidateSkill, Skill
from core.productivity_analytics import ProductivityAnalyzer
from django.db import models
from django.db.models import Count, Q, F, Case, When, Value, IntegerField, Avg, FloatField, ExpressionWrapper
from django.db.models.functions import TruncMonth, TruncDate, Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date
import logging
import statistics
from datetime import datetime, timedelta, date
from django.conf import settings
import requests
from core.api_monitoring import track_api_call, get_or_create_service, SERVICE_GEMINI

logger = logging.getLogger(__name__)

JOB_TYPE_PARAM_MAP = {
    'ft': 'ft',
    'full_time': 'ft',
    'full-time': 'ft',
    'pt': 'pt',
    'part_time': 'pt',
    'part-time': 'pt',
    'contract': 'contract',
    'contractor': 'contract',
    'intern': 'intern',
    'internship': 'intern',
    'temp': 'temp',
    'temporary': 'temp',
}


@api_view(['GET'])
@permission_classes([IsAuthenticated]) 
def cover_letter_analytics_view(request):
    """Enhanced analytics endpoint with comprehensive job analytics AND cover letter performance."""
    try:
        profile = CandidateProfile.objects.get(user=request.user)
        qs, filters_applied = _build_filtered_queryset(profile, request.query_params)

        # 1. GENERAL ANALYTICS
        funnel_stats = _calculate_funnel_analytics(qs)
        industry_benchmarks = _calculate_industry_benchmarks(qs)
        response_trends = _calculate_response_trends(qs)
        volume_patterns = _calculate_volume_patterns(qs)
        goal_progress = _calculate_goal_progress(profile)
        insights_recommendations = _calculate_insights_recommendations(qs)
        time_to_response = _calculate_time_to_response(profile, qs)
        salary_insights = _calculate_salary_insights(qs)

        # 2. COVER LETTER ANALYTICS
        cover_letter_performance = _calculate_cover_letter_analytics(qs)

        return Response({
            'funnel_analytics': funnel_stats,
            'industry_benchmarks': industry_benchmarks,
            'response_trends': response_trends,
            'volume_patterns': volume_patterns,
            'goal_progress': goal_progress,
            'insights_recommendations': insights_recommendations,
            'cover_letter_performance': cover_letter_performance,
            'time_to_response': time_to_response,
            'salary_insights': salary_insights,
            'filters': filters_applied,
        })

    except CandidateProfile.DoesNotExist:
        return Response({
            'funnel_analytics': _empty_funnel_stats(),
            'industry_benchmarks': _empty_industry_benchmarks(),
            'response_trends': _empty_response_trends(),
            'volume_patterns': _empty_volume_patterns(),
            'goal_progress': _empty_goal_progress(),
            'insights_recommendations': [],
            'cover_letter_performance': _empty_cover_letter_analytics(),
            'time_to_response': _empty_time_to_response(),
            'salary_insights': _empty_salary_insights(),
            'filters': {},
        })
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        return Response(
            {'error': {'code': 'analytics_error', 'message': 'Failed to load analytics data'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def productivity_analytics_view(request):
    """Time investment, balance, and productivity insights for job search activity."""
    try:
        profile = CandidateProfile.objects.get(user=request.user)
    except CandidateProfile.DoesNotExist:
        return Response({'error': {'message': 'Profile not found'}}, status=status.HTTP_404_NOT_FOUND)

    try:
        analyzer = ProductivityAnalyzer(profile)
        return Response(analyzer.build())
    except Exception as exc:
        logger.error(f"Productivity analytics error: {exc}")
        return Response(
            {'error': {'code': 'analytics_error', 'message': 'Unable to build productivity analytics'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def competitive_analysis_view(request):
    """Peer benchmarking and positioning analysis for the current user."""
    try:
        profile = CandidateProfile.objects.get(user=request.user)
    except CandidateProfile.DoesNotExist:
        return Response({'error': {'message': 'Profile not found'}}, status=status.HTTP_404_NOT_FOUND)

    try:
        params = request.query_params
        user_qs, filters_applied = _build_filtered_queryset(profile, params)

        # Peer cohort for benchmarks: same industry + same experience level
        peer_same_level = CandidateProfile.objects.filter(
            industry=profile.industry,
            experience_level=profile.experience_level,
        ).exclude(id=profile.id)
        peer_same_ids = list(peer_same_level.values_list('id', flat=True))

        peer_qs = JobEntry.objects.filter(candidate_id__in=peer_same_ids)
        peer_qs, _ = _build_filtered_queryset_for_peers(peer_qs, params)

        # Progression cohort: same industry, higher experience level than current user
        progression_profiles = CandidateProfile.objects.filter(industry=profile.industry).exclude(id=profile.id)

        analysis = _calculate_competitive_analysis(profile, user_qs, peer_qs, peer_same_level, progression_profiles)
        analysis['filters'] = filters_applied
        return Response(analysis)
    except Exception as e:
        logger.error(f"Competitive analysis error: {e}")
        return Response({'error': {'message': 'Failed to load competitive analysis'}}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_application_targets_view(request):
    """Allow users to customize weekly/monthly application targets used in analytics."""
    try:
        profile = CandidateProfile.objects.get(user=request.user)
    except CandidateProfile.DoesNotExist:
        return Response(
            {'error': {'code': 'profile_not_found', 'message': 'Candidate profile not found'}},
            status=status.HTTP_404_NOT_FOUND,
        )

    weekly_target = request.data.get('weekly_target')
    monthly_target = request.data.get('monthly_target')
    if weekly_target is None and monthly_target is None:
        return Response(
            {'error': {'message': 'Provide at least one target to update.'}},
            status=status.HTTP_400_BAD_REQUEST,
        )

    errors = {}
    update_fields = []

    if weekly_target is not None:
        try:
            weekly_value = int(weekly_target)
            if weekly_value <= 0:
                raise ValueError
            profile.weekly_application_target = weekly_value
            update_fields.append('weekly_application_target')
        except (TypeError, ValueError):
            errors['weekly_target'] = 'Weekly target must be a positive integer.'

    if monthly_target is not None:
        try:
            monthly_value = int(monthly_target)
            if monthly_value <= 0:
                raise ValueError
            profile.monthly_application_target = monthly_value
            update_fields.append('monthly_application_target')
        except (TypeError, ValueError):
            errors['monthly_target'] = 'Monthly target must be a positive integer.'

    if errors:
        return Response({'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

    if update_fields:
        profile.save(update_fields=update_fields)

    return Response({
        'weekly_target': profile.weekly_application_target,
        'monthly_target': profile.monthly_application_target,
    })


def _calculate_cover_letter_analytics(qs):
    """Calculate cover letter performance analytics."""
    try:
        # Get jobs with cover letters that have tone tracking
        jobs_with_cover_letters = qs.filter(
            cover_letter_doc__isnull=False,
            cover_letter_doc__ai_generation_tone__isnull=False
        ).select_related('cover_letter_doc')
        
        if not jobs_with_cover_letters.exists():
            return _empty_cover_letter_analytics()
        
        # Group jobs by cover letter tone
        tone_performance = {}
        total_cover_letters = jobs_with_cover_letters.count()
        
        # Get unique tones
        tones = jobs_with_cover_letters.values_list('cover_letter_doc__ai_generation_tone', flat=True).distinct()
        
        for tone in tones:
            if not tone:
                continue
                
            tone_jobs = jobs_with_cover_letters.filter(cover_letter_doc__ai_generation_tone=tone)
            total_jobs = tone_jobs.count()
            
            if total_jobs == 0:
                continue
            
            # Calculate progression rates
            applied_count = tone_jobs.filter(status__in=['applied', 'phone_screen', 'interview', 'offer']).count()
            phone_screen_count = tone_jobs.filter(status__in=['phone_screen', 'interview', 'offer']).count()
            interview_count = tone_jobs.filter(status__in=['interview', 'offer']).count()
            offer_count = tone_jobs.filter(status='offer').count()
            
            # Calculate rates
            response_rate = round((phone_screen_count / applied_count) * 100, 1) if applied_count > 0 else 0
            interview_rate = round((interview_count / applied_count) * 100, 1) if applied_count > 0 else 0
            offer_rate = round((offer_count / applied_count) * 100, 1) if applied_count > 0 else 0
            
            tone_performance[tone] = {
                'total_jobs': total_jobs,
                'applied_count': applied_count,
                'response_rate': response_rate,
                'interview_rate': interview_rate,
                'offer_rate': offer_rate,
                'conversion_funnel': {
                    'applied': applied_count,
                    'phone_screen': phone_screen_count,
                    'interview': interview_count,
                    'offer': offer_count
                }
            }
        
        # Find best and worst performing tones
        best_tone = max(tone_performance.items(), key=lambda x: x[1]['response_rate']) if tone_performance else None
        worst_tone = min(tone_performance.items(), key=lambda x: x[1]['response_rate']) if tone_performance else None
        
        # Generate insights
        insights = []
        if best_tone:
            insights.append(f"'{best_tone[0]}' tone has the highest response rate at {best_tone[1]['response_rate']}%")
        if worst_tone and len(tone_performance) > 1:
            insights.append(f"Consider avoiding '{worst_tone[0]}' tone (only {worst_tone[1]['response_rate']}% response rate)")
        if total_cover_letters >= 10:
            avg_response = sum(perf['response_rate'] for perf in tone_performance.values()) / len(tone_performance)
            insights.append(f"Overall cover letter response rate: {avg_response:.1f}%")
        
        return {
            'total_cover_letters': total_cover_letters,
            'tone_performance': tone_performance,
            'best_performing_tone': best_tone[0] if best_tone else None,
            'worst_performing_tone': worst_tone[0] if worst_tone else None,
            'insights': insights
        }
        
    except Exception as e:
        logger.error(f"Error calculating cover letter analytics: {e}")
        return _empty_cover_letter_analytics()


def _calculate_time_to_response(profile, qs):
    """Calculate average time between stages using status change history."""
    job_ids = list(qs.values_list('id', flat=True))
    if not job_ids:
        return _empty_time_to_response()

    changes = (
        JobStatusChange.objects.filter(job_id__in=job_ids)
        .values('job_id', 'new_status', 'changed_at')
        .order_by('job_id', 'changed_at')
    )

    job_map = {}
    for job_id in job_ids:
        job_map[job_id] = {'application': qs.filter(id=job_id).values_list('created_at', flat=True).first()}

    for change in changes:
        info = job_map.get(change['job_id'])
        if not info:
            continue
        ts = change['changed_at']
        status = change['new_status']
        if status == 'applied' and 'applied' not in info:
            info['applied'] = ts
        elif status == 'phone_screen' and 'phone_screen' not in info:
            info['phone_screen'] = ts
        elif status == 'interview' and 'interview' not in info:
            info['interview'] = ts
        elif status == 'offer' and 'offer' not in info:
            info['offer'] = ts

    app_to_response = []
    app_to_interview = []
    interview_to_offer = []

    for info in job_map.values():
        applied_time = info.get('applied', info.get('application'))
        first_response = info.get('phone_screen') or info.get('interview') or info.get('offer')
        if applied_time and first_response:
            app_to_response.append((first_response - applied_time).total_seconds() / 86400.0)

        if applied_time and info.get('interview'):
            app_to_interview.append((info['interview'] - applied_time).total_seconds() / 86400.0)

        if info.get('interview') and info.get('offer'):
            interview_to_offer.append((info['offer'] - info['interview']).total_seconds() / 86400.0)

    def _avg(values):
        return round(sum(values) / len(values), 1) if values else None

    return {
        'avg_application_to_response_days': _avg(app_to_response),
        'avg_application_to_interview_days': _avg(app_to_interview),
        'avg_interview_to_offer_days': _avg(interview_to_offer),
        'samples': {
            'application_to_response': len(app_to_response),
            'application_to_interview': len(app_to_interview),
            'interview_to_offer': len(interview_to_offer),
        },
    }


def _calculate_funnel_analytics(qs):
    """Calculate application funnel statistics."""
    total_applications = qs.count()
    
    # Status counts
    status_counts = {
        'interested': qs.filter(status='interested').count(),
        'applied': qs.filter(status='applied').count(),
        'phone_screen': qs.filter(status='phone_screen').count(),
        'interview': qs.filter(status='interview').count(),
        'offer': qs.filter(status='offer').count(),
        'rejected': qs.filter(status='rejected').count()
    }
    
    # Calculate conversion rates
    applied_plus = status_counts['applied'] + status_counts['phone_screen'] + status_counts['interview'] + status_counts['offer']
    responded = status_counts['phone_screen'] + status_counts['interview'] + status_counts['offer']
    
    response_rate = round((responded / applied_plus) * 100, 1) if applied_plus > 0 else 0
    interview_rate = round(((status_counts['interview'] + status_counts['offer']) / applied_plus) * 100, 1) if applied_plus > 0 else 0
    offer_rate = round((status_counts['offer'] / applied_plus) * 100, 1) if applied_plus > 0 else 0
    
    success_rate = round((status_counts['offer'] / total_applications) * 100, 1) if total_applications > 0 else 0
    
    return {
        'total_applications': total_applications,
        'status_breakdown': status_counts,
        'response_rate': response_rate,
        'interview_rate': interview_rate,
        'offer_rate': offer_rate,
        'success_rate': success_rate
    }


def _calculate_industry_benchmarks(qs):
    """Calculate industry benchmark comparisons (placeholder)."""
    return {
        'industry_avg_response_rate': 12.0,
        'industry_avg_interview_rate': 8.0,
        'industry_avg_offer_rate': 2.5,
        'user_vs_benchmark': 'above_average'  # Can be enhanced with real industry data
    }


def _calculate_response_trends(qs):
    """Calculate response rate trends over time."""
    # Group by month and calculate response rates
    from django.db.models.functions import TruncMonth
    
    monthly_data = []
    today = timezone.now().date()
    
    for i in range(11, -1, -1):
        month_start = (today.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
        month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        
        month_jobs = qs.filter(created_at__date__gte=month_start, created_at__date__lte=month_end)
        applied = month_jobs.filter(status__in=['applied', 'phone_screen', 'interview', 'offer']).count()
        responded = month_jobs.filter(status__in=['phone_screen', 'interview', 'offer']).count()
        
        response_rate = round((responded / applied) * 100, 1) if applied > 0 else 0
        
        monthly_data.append({
            'month': month_start.strftime('%Y-%m'),
            'applications': applied,
            'responses': responded,
            'response_rate': response_rate
        })
    
    return {'monthly_trends': monthly_data}


def _calculate_volume_patterns(qs):
    """Calculate application volume patterns."""
    total = qs.count()
    
    # Weekly volume (last 8 weeks)
    weekly_data = []
    today = timezone.now().date()
    
    for i in range(7, -1, -1):
        week_start = today - timedelta(days=today.weekday() + 7 * i)
        week_end = week_start + timedelta(days=6)
        
        week_count = qs.filter(created_at__date__gte=week_start, created_at__date__lte=week_end).count()
        weekly_data.append({
            'week': week_start.strftime('%Y-%m-%d'),
            'count': week_count
        })
    
    return {
        'total_applications': total,
        'weekly_volume': weekly_data,
        'avg_weekly': round(sum(w['count'] for w in weekly_data) / len(weekly_data), 1)
    }


def _calculate_goal_progress(qs):
    """Calculate goal progress tracking."""
    today = timezone.now().date()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    # qs may be queryset or profile; handle both
    entries = qs.job_entries.all() if hasattr(qs, 'job_entries') else qs
    weekly_target = getattr(qs, 'weekly_application_target', None) or 5
    monthly_target = getattr(qs, 'monthly_application_target', None) or 20

    weekly_current = entries.filter(created_at__date__gte=week_start).count()
    weekly_progress = round((weekly_current / weekly_target) * 100, 1) if weekly_target else 0

    monthly_current = entries.filter(created_at__date__gte=month_start).count()
    monthly_progress = round((monthly_current / monthly_target) * 100, 1) if monthly_target else 0

    return {
        'weekly_goal': {
            'target': weekly_target,
            'current': weekly_current,
            'progress_percent': weekly_progress
        },
        'monthly_goal': {
            'target': monthly_target,
            'current': monthly_current,
            'progress_percent': monthly_progress
        }
    }


def _calculate_insights_recommendations(qs):
    """Generate insights and recommendations."""
    insights = []
    recommendations = []
    
    total = qs.count()
    if total == 0:
        return {
            'insights': ['Start adding job applications to see insights and recommendations'],
            'recommendations': ['Apply to at least 5 jobs per week to build momentum']
        }
    
    # Response rate insights
    applied_count = qs.filter(status__in=['applied', 'phone_screen', 'interview', 'offer']).count()
    response_count = qs.filter(status__in=['phone_screen', 'interview', 'offer']).count()
    
    if applied_count > 0:
        response_rate = (response_count / applied_count) * 100
        if response_rate < 5:
            insights.append('Your response rate is below average ({}%). Industry average is ~12%.'.format(round(response_rate, 1)))
            recommendations.append('Review and improve your resume and cover letters')
            recommendations.append('Tailor each application to the specific role and company')
        elif response_rate > 15:
            insights.append('Great response rate ({}%)! Your applications are standing out.'.format(round(response_rate, 1)))
            recommendations.append('Continue your current application strategy')
        else:
            insights.append('Your response rate is {}%, which is close to industry average (12%).'.format(round(response_rate, 1)))
            recommendations.append('Consider A/B testing different cover letter approaches')
    
    # Application volume insights
    recent_week = qs.filter(created_at__date__gte=timezone.now().date() - timedelta(days=7)).count()
    if recent_week == 0:
        insights.append('No applications submitted this week')
        recommendations.append('Set a goal of 5-10 applications per week')
    elif recent_week >= 10:
        insights.append('High application volume this week ({} applications)'.format(recent_week))
        recommendations.append('Follow up on your recent applications')
    
    # Cover letter tone analysis
    # Get cover letters that are linked to job entries through the used_as_cover_letter_in relationship
    cover_letter_documents = Document.objects.filter(
        candidate=qs.first().candidate if qs.exists() else None,
        doc_type='cover_letter',
        ai_generation_tone__isnull=False,
        used_as_cover_letter_in__isnull=False
    )
    
    if cover_letter_documents.exists():
        # Analyze which tones are most successful
        from collections import defaultdict
        tone_stats = defaultdict(lambda: {'total': 0, 'responded': 0})
        
        for doc in cover_letter_documents:
            tone = doc.ai_generation_tone
            tone_stats[tone]['total'] += 1
            # Get the job status through the reverse relationship
            job_entries = doc.used_as_cover_letter_in.all()
            for job_entry in job_entries:
                if job_entry.status in ['phone_screen', 'interview', 'offer']:
                    tone_stats[tone]['responded'] += 1
                    break  # Count only once per document
        
        # Find best performing tone
        best_tone = None
        best_rate = 0
        for tone, stats in tone_stats.items():
            if stats['total'] >= 2:  # Only consider tones with at least 2 samples
                rate = (stats['responded'] / stats['total']) * 100
                if rate > best_rate:
                    best_rate = rate
                    best_tone = tone
        
        if best_tone:
            insights.append('Your {} cover letters have the highest response rate ({}%)'.format(best_tone, round(best_rate, 1)))
            recommendations.append('Consider using the {} tone more frequently'.format(best_tone))
    
    return {
        'insights': insights,
        'recommendations': recommendations
    }


def _calculate_salary_insights(qs):
    annotated_qs = qs.annotate(avg_salary=_avg_salary_expression()).filter(avg_salary__isnull=False)
    total = annotated_qs.count()
    if not total:
        return _empty_salary_insights()

    average_salary = annotated_qs.aggregate(avg=Avg('avg_salary'))['avg'] or 0
    interviews = annotated_qs.filter(status__in=['interview', 'offer']).count()
    offers = annotated_qs.filter(status='offer').count()
    interview_rate = round((interviews / total) * 100, 1) if total else 0
    offer_rate = round((offers / total) * 100, 1) if total else 0

    return {
        'average_salary': round(average_salary, 2) if average_salary else 0,
        'applications': total,
        'interview_rate': interview_rate,
        'offer_rate': offer_rate,
    }


def _build_filtered_queryset(profile, params):
    qs = JobEntry.objects.filter(candidate=profile)
    filters_applied = {}
    params = params or {}

    start_date = _parse_date_param(params.get('start_date'))
    if start_date:
        qs = qs.filter(created_at__date__gte=start_date)
        filters_applied['start_date'] = start_date.isoformat()

    end_date = _parse_date_param(params.get('end_date'))
    if end_date:
        qs = qs.filter(created_at__date__lte=end_date)
        filters_applied['end_date'] = end_date.isoformat()

    job_type_codes = _normalize_job_type_filters(params)
    if job_type_codes:
        qs = qs.filter(job_type__in=job_type_codes)
        filters_applied['job_types'] = job_type_codes

    salary_min = _parse_float_param(params.get('salary_min'))
    salary_max = _parse_float_param(params.get('salary_max'))
    avg_salary_expr = _avg_salary_expression()

    if salary_min is not None or salary_max is not None:
        qs = qs.annotate(avg_salary=avg_salary_expr)
        if salary_min is not None:
            qs = qs.filter(avg_salary__gte=salary_min)
            filters_applied['salary_min'] = salary_min
        if salary_max is not None:
            qs = qs.filter(avg_salary__lte=salary_max)
            filters_applied['salary_max'] = salary_max

    return qs, filters_applied


def _build_filtered_queryset_for_peers(qs, params):
    """Apply the same filters as _build_filtered_queryset but without candidate scoping."""
    filters_applied = {}
    params = params or {}

    start_date = _parse_date_param(params.get('start_date'))
    if start_date:
        qs = qs.filter(created_at__date__gte=start_date)
        filters_applied['start_date'] = start_date.isoformat()

    end_date = _parse_date_param(params.get('end_date'))
    if end_date:
        qs = qs.filter(created_at__date__lte=end_date)
        filters_applied['end_date'] = end_date.isoformat()

    job_type_codes = _normalize_job_type_filters(params)
    if job_type_codes:
        qs = qs.filter(job_type__in=job_type_codes)
        filters_applied['job_types'] = job_type_codes

    salary_min = _parse_float_param(params.get('salary_min'))
    salary_max = _parse_float_param(params.get('salary_max'))
    avg_salary_expr = _avg_salary_expression()

    if salary_min is not None or salary_max is not None:
        qs = qs.annotate(avg_salary=avg_salary_expr)
        if salary_min is not None:
            qs = qs.filter(avg_salary__gte=salary_min)
            filters_applied['salary_min'] = salary_min
        if salary_max is not None:
            qs = qs.filter(avg_salary__lte=salary_max)
            filters_applied['salary_max'] = salary_max

    return qs, filters_applied


def _parse_date_param(value):
    if not value:
        return None
    parsed = parse_date(value)
    if parsed:
        return parsed
    try:
        value = value.replace('Z', '+00:00')
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def _parse_float_param(value):
    if value in (None, ''):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_job_type_filters(params):
    raw_values = []
    if hasattr(params, 'getlist'):
        raw_values = params.getlist('job_types')
    if not raw_values:
        single_value = params.get('job_types') if hasattr(params, 'get') else None
        if isinstance(single_value, (list, tuple)):
            raw_values = list(single_value)
        elif isinstance(single_value, str):
            raw_values = [v.strip() for v in single_value.split(',') if v.strip()]
    normalized = []
    for value in raw_values:
        key = value.lower()
        code = JOB_TYPE_PARAM_MAP.get(key)
        if code:
            normalized.append(code)
    return list(dict.fromkeys(normalized))


def _avg_salary_expression():
    return Case(
        When(
            salary_min__isnull=False,
            salary_max__isnull=False,
            then=ExpressionWrapper((F('salary_min') + F('salary_max')) / 2.0, output_field=FloatField()),
        ),
        When(
            salary_min__isnull=False,
            salary_max__isnull=True,
            then=ExpressionWrapper(F('salary_min'), output_field=FloatField()),
        ),
        When(
            salary_max__isnull=False,
            salary_min__isnull=True,
            then=ExpressionWrapper(F('salary_max'), output_field=FloatField()),
        ),
        default=Value(None),
        output_field=FloatField(),
    )


# Empty state functions
def _empty_cover_letter_analytics():
    return {
        'total_cover_letters': 0,
        'tone_performance': {},
        'best_performing_tone': None,
        'worst_performing_tone': None,
        'insights': ['No cover letters with analytics data found']
    }

def _empty_time_to_response():
    return {
        'avg_application_to_response_days': None,
        'avg_application_to_interview_days': None,
        'avg_interview_to_offer_days': None,
        'samples': {
            'application_to_response': 0,
            'application_to_interview': 0,
            'interview_to_offer': 0,
        },
    }

def _empty_salary_insights():
    return {
        'average_salary': 0,
        'applications': 0,
        'interview_rate': 0,
        'offer_rate': 0,
    }

def _empty_funnel_stats():
    return {
        'total_applications': 0,
        'status_breakdown': {'interested': 0, 'applied': 0, 'phone_screen': 0, 'interview': 0, 'offer': 0, 'rejected': 0},
        'response_rate': 0,
        'interview_rate': 0,
        'offer_rate': 0,
        'success_rate': 0
    }

def _empty_industry_benchmarks():
    return {
        'industry_avg_response_rate': 12.0,
        'industry_avg_interview_rate': 8.0,
        'industry_avg_offer_rate': 2.5,
        'user_vs_benchmark': 'no_data'
    }


def _calculate_competitive_analysis(profile, user_qs, peer_qs, peer_profiles_same_level, progression_profiles_all):
    """Compute user vs peer benchmarks, skill gaps, and recommendations."""
    level_order = ['entry', 'mid', 'senior', 'executive']
    def _is_higher_level(level):
        if not profile.experience_level or level not in level_order or profile.experience_level not in level_order:
            return False
        return level_order.index(level) > level_order.index(profile.experience_level)

    def _metrics(qs):
        total = qs.count()
        phone = qs.filter(status__in=['phone_screen', 'interview', 'offer']).count()
        interview = qs.filter(status__in=['interview', 'offer']).count()
        offer = qs.filter(status='offer').count()
        apps_per_week = 0
        if total:
            earliest = qs.order_by('created_at').first().created_at
            latest = qs.order_by('-created_at').first().created_at
            days = max((latest - earliest).days + 1, 7)
            apps_per_week = round(total / (days / 7), 1)
        # Employment stats for this cohort
        return {
            'applications': total,
            'response_rate': round((phone / total) * 100, 1) if total else 0,
            'interview_rate': round((interview / total) * 100, 1) if total else 0,
            'offer_rate': round((offer / total) * 100, 1) if total else 0,
            'apps_per_week': apps_per_week,
            'funnel': {
                'interested': qs.filter(status='interested').count(),
                'applied': qs.filter(status='applied').count(),
                'phone_screen': qs.filter(status='phone_screen').count(),
                'interview': qs.filter(status='interview').count(),
                'offer': offer,
                'rejected': qs.filter(status='rejected').count(),
            }
        }

    user_metrics = _metrics(user_qs)
    peer_metrics = _metrics(peer_qs)

    # Employment comparison (positions held, total years) for peers at same level
    def _employment_stats(profiles):
        """Compute average positions and years for a list of CandidateProfile instances."""
        if not profiles:
            return {'avg_positions': 0, 'avg_years': 0}
        position_counts = []
        years_list = []
        for p in profiles:
            emps = getattr(p, 'work_experiences', None)
            if not emps:
                continue
            emp_qs = emps.all()
            position_counts.append(emp_qs.count())
            years_total = 0
            for job in emp_qs:
                start = job.start_date or None
                end = job.end_date or timezone.now().date()
                if start:
                    years_total += max((end - start).days, 0) / 365.0
            years_list.append(years_total)
        avg_positions = round(sum(position_counts) / len(position_counts), 1) if position_counts else 0
        avg_years = round(sum(years_list) / len(years_list), 1) if years_list else 0
        return {'avg_positions': avg_positions, 'avg_years': avg_years}

    user_positions = _employment_stats([profile])
    peer_positions = _employment_stats(peer_profiles_same_level)

    # Skill gap analysis
    user_skills = set(profile.skills.select_related('skill').values_list('skill__name', flat=True))
    peer_ids = list(peer_profiles_same_level.values_list('id', flat=True))
    peer_skill_rows = CandidateSkill.objects.filter(candidate_id__in=peer_ids).select_related('skill')
    freq = {}
    for row in peer_skill_rows:
        name = row.skill.name
        freq[name] = freq.get(name, 0) + 1
    peer_count = max(len(set(peer_ids)), 1)
    peer_skill_freq = [{ 'name': k, 'prevalence': round((v / peer_count) * 100, 1) } for k, v in freq.items()]
    peer_skill_freq.sort(key=lambda x: x['prevalence'], reverse=True)
    top_peer_skills = [s for s in peer_skill_freq if s['prevalence'] >= 10][:10]
    gaps = [s for s in top_peer_skills if s['name'] not in user_skills]
    differentiators = [{'name': s, 'note': 'Less common peer skill to highlight'} for s in user_skills if freq.get(s, 0) < max(1, peer_count * 0.2)]

    deterministic_recs = []
    if user_metrics['apps_per_week'] < peer_metrics['apps_per_week']:
        deterministic_recs.append(f"Peers average {peer_metrics['apps_per_week']} applications/week; increase your pace from {user_metrics['apps_per_week']}.")
    if user_metrics['response_rate'] < peer_metrics['response_rate']:
        deterministic_recs.append("Improve response rate with tighter targeting and refreshed outreach.")
    if gaps:
        gap_names = ', '.join([g['name'] for g in gaps[:3]])
        deterministic_recs.append(f"Add or strengthen skills commonly seen in peers: {gap_names}.")
    if differentiators:
        diff_names = ', '.join([d['name'] for d in differentiators[:2]])
        deterministic_recs.append(f"Highlight differentiators in your profile: {diff_names}.")

    # Progression cohort: same industry, higher experience levels
    progression_profiles = [p for p in progression_profiles_all if _is_higher_level(p.experience_level)]
    progression_ids = [p.id for p in progression_profiles]
    progression_qs = JobEntry.objects.filter(candidate_id__in=progression_ids) if progression_ids else JobEntry.objects.none()
    progression_metrics = _metrics(progression_qs) if progression_ids else None
    progression_gaps = []
    if progression_ids:
        freq_prog = {}
        for row in CandidateSkill.objects.filter(candidate_id__in=progression_ids).select_related('skill'):
            name = row.skill.name
            freq_prog[name] = freq_prog.get(name, 0) + 1
        prog_count = max(len(set(progression_ids)), 1)
        prog_skill_freq = [{ 'name': k, 'prevalence': round((v / prog_count) * 100, 1) } for k, v in freq_prog.items()]
        prog_skill_freq.sort(key=lambda x: x['prevalence'], reverse=True)
        top_prog_skills = [s for s in prog_skill_freq if s['prevalence'] >= 10][:10]
        progression_gaps = [s for s in top_prog_skills if s['name'] not in user_skills]

    ai_recs = _generate_competitive_ai_recs(profile, user_metrics, peer_metrics, gaps, differentiators)

    return {
        'cohort': {
            'industry': profile.industry or 'unspecified',
            'experience_level': profile.experience_level or 'unspecified',
            'sample_size': len(set(peer_ids)),
        },
        'user_metrics': user_metrics,
        'peer_benchmarks': peer_metrics,
        'employment': {
            'user': user_positions,
            'peers': peer_positions,
        },
        'skill_gaps': gaps,
        'differentiators': differentiators[:5],
        'progression': {
          'sample_size': len(set(progression_ids)),
          'metrics': progression_metrics,
          'skill_gaps': progression_gaps,
        },
        'recommendations': {
            'deterministic': deterministic_recs,
            'ai': ai_recs,
        },
    }


def _generate_competitive_ai_recs(profile, user_metrics, peer_metrics, gaps, differentiators):
    api_key = getattr(settings, 'GEMINI_API_KEY', None)
    model = getattr(settings, 'GEMINI_MODEL', 'gemini-1.5-flash')
    if not api_key:
        return []

    snapshot = {
        'industry': profile.industry,
        'experience_level': profile.experience_level,
        'user_metrics': user_metrics,
        'peer_metrics': peer_metrics,
        'skill_gaps': [g['name'] for g in gaps],
        'differentiators': [d['name'] for d in differentiators],
    }
    prompt = (
        "You are a career coach generating competitive positioning tips. "
        "Return 3 concise bullet sentences. Include:\n"
        "1) Competitive advantage actions (skills/projects) suited to the user's experience level.\n"
        "2) Differentiation strategies and unique value propositions.\n"
        "3) Market positioning suggestions (roles/titles/companies to target).\n"
        f"User snapshot: {snapshot}"
    )
    try:
        service = get_or_create_service(SERVICE_GEMINI, 'Google Gemini AI')
        with track_api_call(service, endpoint=f'/models/{model}:generateContent', method='POST'):
            resp = requests.post(
                "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent".format(model=model),
                params={'key': api_key},
                json={'contents': [{'parts': [{'text': prompt}]}]},
                timeout=10,
            )
        data = resp.json()
        parts = data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
        text = ' '.join([p.get('text', '') for p in parts]).strip()
        tips = []
        for raw in text.split('\n'):
            if not raw.strip():
                continue
            cleaned = raw.lstrip('*•- ').strip()
            cleaned = cleaned.replace('**', '')
            tips.append(cleaned.strip())
        return tips[:3]
    except Exception as exc:
        logger.warning("Gemini recommendations failed: %s", exc)
        return []

def _empty_response_trends():
    return {'monthly_trends': []}

def _empty_volume_patterns():
    return {
        'total_applications': 0,
        'weekly_volume': [],
        'avg_weekly': 0
    }

def _empty_goal_progress():
    return {
        'weekly_goal': {'target': 5, 'current': 0, 'progress_percent': 0},
        'monthly_goal': {'target': 20, 'current': 0, 'progress_percent': 0}
    }
