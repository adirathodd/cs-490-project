"""
Enhanced analytics view with cover letter performance tracking
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from core.models import CandidateProfile, JobEntry, Document
from django.db import models
from django.db.models import Count, Q, F, Case, When, Value, IntegerField, Avg
from django.db.models.functions import TruncMonth, TruncDate, Coalesce
from django.utils import timezone
import logging
import statistics
from datetime import datetime, timedelta, date

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated]) 
def cover_letter_analytics_view(request):
    """Enhanced analytics endpoint with comprehensive job analytics AND cover letter performance."""
    try:
        profile = CandidateProfile.objects.get(user=request.user)
        qs = JobEntry.objects.filter(candidate=profile)
        
        # 
# 
# =
        # 1. GENERAL ANALYTICS (from original jobs_stats)
        # 
# 
# =
        funnel_stats = _calculate_funnel_analytics(qs)
        industry_benchmarks = _calculate_industry_benchmarks(qs)
        response_trends = _calculate_response_trends(qs)
        volume_patterns = _calculate_volume_patterns(qs)
        goal_progress = _calculate_goal_progress(qs)
        insights_recommendations = _calculate_insights_recommendations(qs)
        
        # 
# 
# =
        # 2. COVER LETTER ANALYTICS (new)
        # 
# 
# =
        cover_letter_performance = _calculate_cover_letter_analytics(qs)
        
        # Return comprehensive response
        return Response({
            'funnel_analytics': funnel_stats,
            'industry_benchmarks': industry_benchmarks,
            'response_trends': response_trends,
            'volume_patterns': volume_patterns,
            'goal_progress': goal_progress,
            'insights_recommendations': insights_recommendations,
            'cover_letter_performance': cover_letter_performance
        })
        
    except CandidateProfile.DoesNotExist:
        return Response({
            'funnel_analytics': _empty_funnel_stats(),
            'industry_benchmarks': _empty_industry_benchmarks(),
            'response_trends': _empty_response_trends(),
            'volume_patterns': _empty_volume_patterns(),
            'goal_progress': _empty_goal_progress(),
            'insights_recommendations': [],
            'cover_letter_performance': _empty_cover_letter_analytics()
        })
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        return Response(
            {'error': {'code': 'analytics_error', 'message': 'Failed to load analytics data'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


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
    
    # Weekly goal (example: 5 applications per week)
    weekly_target = 5
    weekly_current = qs.filter(created_at__date__gte=week_start).count()
    weekly_progress = round((weekly_current / weekly_target) * 100, 1)
    
    # Monthly goal (example: 20 applications per month)
    monthly_target = 20
    monthly_current = qs.filter(created_at__date__gte=month_start).count()
    monthly_progress = round((monthly_current / monthly_target) * 100, 1)
    
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


# Empty state functions
def _empty_cover_letter_analytics():
    return {
        'total_cover_letters': 0,
        'tone_performance': {},
        'best_performing_tone': None,
        'worst_performing_tone': None,
        'insights': ['No cover letters with analytics data found']
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