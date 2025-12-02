# backend/core/interview_performance_tracking.py
"""
UC-098: Interview Performance Tracking
Analytics service for tracking interview performance and improvement over time.
"""

from django.db.models import Count, Avg, Q, F, Sum, Case, When, FloatField
from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
from django.utils import timezone
from datetime import timedelta
from collections import defaultdict
from typing import Dict, List, Any

from core.models import (
    InterviewSchedule,
    JobEntry,
    MockInterviewSession,
)

POSITIVE_OUTCOMES = {'excellent', 'good'}
NEGATIVE_OUTCOMES = {'rejected', 'poor'}


def _confidence_from_outcome(outcome: str) -> float:
    """Map interview outcomes to a 1-5 confidence score."""
    normalized = (outcome or '').lower()
    mapping = {
        'excellent': 5,
        'good': 4,
        'average': 3,
        'poor': 2,
        'rejected': 1,
        'withdrew': 2,
    }
    return mapping.get(normalized, 3)


class InterviewPerformanceTracker:
    """Tracks and analyzes interview performance over time."""
    
    def __init__(self, candidate_profile):
        self.candidate = candidate_profile
        self.interviews = InterviewSchedule.objects.filter(
            candidate=candidate_profile
        ).select_related('job')
        self.mock_sessions = MockInterviewSession.objects.filter(
            user=candidate_profile.user
        )
    
    def get_conversion_rates_over_time(self, period='month'):
        """Calculate interview-to-offer conversion rates over time."""
        if period == 'week':
            trunc_func = TruncWeek
        elif period == 'month':
            trunc_func = TruncMonth
        else:
            trunc_func = TruncDate
        
        # Get interview outcomes by period
        interview_data = self.interviews.annotate(
            period=trunc_func('scheduled_at')
        ).values('period').annotate(
            total_interviews=Count('id'),
            offers=Count(Case(
                # Map excellent/good outcomes to offers
                When(outcome__in=list(POSITIVE_OUTCOMES), then=1),
            )),
            rejections=Count(Case(
                When(outcome__in=list(NEGATIVE_OUTCOMES), then=1),
            )),
            pending=Count(Case(
                When(outcome='', then=1),
            ))
        ).order_by('period')
        
        results = []
        for data in interview_data:
            total = data['total_interviews']
            offers = data['offers']
            conversion_rate = round((offers / total * 100), 2) if total > 0 else 0
            rejection_rate = round((data['rejections'] / total * 100), 2) if total > 0 else 0
            
            results.append({
                'period': data['period'].isoformat() if data['period'] else None,
                'total_interviews': total,
                'offers': offers,
                'rejections': data['rejections'],
                'pending': data['pending'],
                'conversion_rate': conversion_rate,
                'rejection_rate': rejection_rate,
            })
        
        return results
    
    def analyze_by_interview_format(self):
        """Analyze performance by interview format."""
        # Use actual InterviewSchedule INTERVIEW_TYPES choices
        formats = ['phone', 'video', 'in_person', 'assessment', 'group']
        results = []
        
        for format_type in formats:
            interviews = self.interviews.filter(interview_type=format_type)
            total = interviews.count()
            
            if total == 0:
                continue
            
            # Map excellent/good to offers
            offers = interviews.filter(outcome__in=POSITIVE_OUTCOMES).count()
            rejections = interviews.filter(outcome__in=NEGATIVE_OUTCOMES).count()
            confidence_scores = [
                _confidence_from_outcome(outcome)
                for outcome in interviews.values_list('outcome', flat=True)
            ]
            avg_confidence = round(
                sum(confidence_scores) / len(confidence_scores),
                1
            ) if confidence_scores else 0
            
            results.append({
                'format': format_type,
                'format_label': format_type.replace('_', ' ').title(),
                'total_interviews': total,
                'offers': offers,
                'rejections': rejections,
                'avg_confidence': avg_confidence,
                'conversion_rate': round((offers / total * 100), 2) if total > 0 else 0,
            })
        
        results.sort(key=lambda x: x['conversion_rate'], reverse=True)
        return results
    
    def track_mock_to_real_improvement(self):
        """Monitor improvement trends from mock practice to real interviews."""
        # Get mock interview scores over time
        mock_sessions = self.mock_sessions.filter(
            status='completed'
        ).order_by('started_at')
        
        mock_progress = []
        for session in mock_sessions[:20]:  # Last 20 sessions
            mock_progress.append({
                'date': session.started_at.date().isoformat() if session.started_at else None,
                'score': session.overall_score or 0,
                'type': 'mock',
                'interview_type': session.interview_type,
            })
        
        # Get real interview outcomes
        real_interviews = self.interviews.order_by('scheduled_at')
        
        real_progress = []
        for interview in real_interviews[:20]:  # Last 20 interviews
            # Map outcome to score (using actual InterviewSchedule choices)
            outcome_scores = {
                'excellent': 100,
                'good': 85,
                'average': 70,
                'poor': 40,
                'rejected': 20,
                'withdrew': 10,
                '': 50,  # No outcome yet
            }
            score = outcome_scores.get(interview.outcome, 50)
            
            real_progress.append({
                'date': interview.scheduled_at.date().isoformat(),
                'score': score,
                'type': 'real',
                'interview_type': interview.interview_type,
                'outcome': interview.outcome,
            })
        
        # Calculate improvement metrics
        mock_avg = sum(p['score'] for p in mock_progress) / len(mock_progress) if mock_progress else 0
        real_avg = sum(p['score'] for p in real_progress) / len(real_progress) if real_progress else 0
        
        # Get trend (last 5 vs first 5)
        mock_trend = 0
        if len(mock_progress) >= 10:
            first_5 = sum(p['score'] for p in mock_progress[:5]) / 5
            last_5 = sum(p['score'] for p in mock_progress[-5:]) / 5
            mock_trend = round(((last_5 - first_5) / first_5 * 100) if first_5 > 0 else 0, 1)
        
        return {
            'mock_sessions': mock_progress,
            'real_interviews': real_progress,
            'mock_average_score': round(mock_avg, 1),
            'real_average_score': round(real_avg, 1),
            'improvement_trend': mock_trend,
            'total_mock_sessions': self.mock_sessions.filter(status='completed').count(),
            'total_real_interviews': self.interviews.count(),
        }
    
    def analyze_by_industry(self):
        """Compare performance across different industries."""
        industries = self.interviews.exclude(
            job__industry=''
        ).values_list('job__industry', flat=True).distinct()
        
        results = []
        for industry in industries:
            interviews = self.interviews.filter(job__industry=industry)
            total = interviews.count()
            
            if total == 0:
                continue
            
            offers = interviews.filter(outcome__in=POSITIVE_OUTCOMES).count()
            confidence_scores = [
                _confidence_from_outcome(outcome)
                for outcome in interviews.values_list('outcome', flat=True)
            ]
            avg_confidence = round(
                sum(confidence_scores) / len(confidence_scores),
                1
            ) if confidence_scores else 0
            
            results.append({
                'industry': industry,
                'total_interviews': total,
                'offers': offers,
                'conversion_rate': round((offers / total * 100), 2) if total > 0 else 0,
                'avg_confidence': avg_confidence,
            })
        
        results.sort(key=lambda x: x['conversion_rate'], reverse=True)
        return results
    
    def track_feedback_themes(self):
        """Track feedback themes and common improvement areas."""
        # Analyze feedback notes from interviews
        interviews_with_feedback = self.interviews.exclude(
            feedback_notes=''
        ).values_list('feedback_notes', flat=True)[:50]
        
        # Count common keywords in feedback
        improvement_areas = {
            'technical_skills': 0,
            'communication': 0,
            'problem_solving': 0,
            'leadership': 0,
            'cultural_fit': 0,
        }
        
        positive_themes = {
            'strong_technical': 0,
            'good_communication': 0,
            'team_player': 0,
            'enthusiastic': 0,
        }
        
        for feedback in interviews_with_feedback:
            feedback_lower = feedback.lower()
            # Simple keyword matching
            if 'technical' in feedback_lower:
                if 'strong' in feedback_lower or 'good' in feedback_lower:
                    positive_themes['strong_technical'] += 1
                else:
                    improvement_areas['technical_skills'] += 1
            if 'communication' in feedback_lower:
                if 'good' in feedback_lower or 'clear' in feedback_lower:
                    positive_themes['good_communication'] += 1
                else:
                    improvement_areas['communication'] += 1
        
        total_improvement_mentions = sum(improvement_areas.values())
        improvement_list = []
        for key, count in sorted(improvement_areas.items(), key=lambda x: x[1], reverse=True):
            if count <= 0:
                continue
            percentage = round(
                (count / total_improvement_mentions * 100),
                1
            ) if total_improvement_mentions else 0
            improvement_list.append({
                'area': key.replace('_', ' ').title(),
                'count': count,
                'percentage': percentage,
            })
        positive_list = [
            {'theme': key.replace('_', ' ').title(), 'count': count}
            for key, count in sorted(positive_themes.items(), key=lambda x: x[1], reverse=True)
            if count > 0
        ]
        return {
            'improvement_areas': improvement_list,
            'positive_themes': positive_list,
            'total_feedback_analyzed': len(interviews_with_feedback),
        }
    
    def monitor_confidence_progression(self):
        """Monitor confidence progression over time."""
        thirty_days_ago = timezone.now() - timedelta(days=30)
        sixty_days_ago = timezone.now() - timedelta(days=60)

        def _confidence_values(queryset):
            return [
                _confidence_from_outcome(outcome)
                for outcome in queryset.values_list('outcome', flat=True)
            ]

        current_values = _confidence_values(
            self.interviews.filter(scheduled_at__gte=thirty_days_ago)
        )
        previous_values = _confidence_values(
            self.interviews.filter(
                scheduled_at__gte=sixty_days_ago,
                scheduled_at__lt=thirty_days_ago,
            )
        )

        current_avg = round(sum(current_values) / len(current_values), 1) if current_values else 0
        previous_avg = round(sum(previous_values) / len(previous_values), 1) if previous_values else 0

        change_percent = 0
        if previous_avg > 0:
            change_percent = round(((current_avg - previous_avg) / previous_avg) * 100, 1)

        timeline = []
        interviews = self.interviews.exclude(scheduled_at__isnull=True).order_by('scheduled_at')[:30]
        for interview in interviews:
            timeline.append({
                'date': interview.scheduled_at.date().isoformat(),
                'interview_type': interview.interview_type or 'unknown',
                'confidence_level': _confidence_from_outcome(interview.outcome),
                'outcome': (interview.outcome or 'pending'),
            })

        return {
            'current_avg_confidence': current_avg,
            'previous_avg_confidence': previous_avg,
            'trend_percentage': change_percent,
            'confidence_progression': timeline,
        }
    
    def generate_coaching_recommendations(self):
        """Generate personalized coaching recommendations."""
        recommendations = []
        
        # Check conversion rate
        total_interviews = self.interviews.count()
        if total_interviews > 0:
            offers = self.interviews.filter(outcome__in=POSITIVE_OUTCOMES).count()
            conversion_rate = (offers / total_interviews * 100)
            
            if conversion_rate < 20:
                recommendations.append({
                    'priority': 'high',
                    'area': 'Interview Skills',
                    'recommendation': 'Your interview conversion rate is below average. Consider practicing more mock interviews and working on common interview questions.',
                    'action_items': [
                        'Complete 3-5 mock interviews per week',
                        'Review and learn from past interview feedback',
                        'Research the STAR method for behavioral questions',
                    ]
                })
            
        # Check mock interview performance
        mock_avg = self.mock_sessions.filter(status='completed').aggregate(
            avg=Avg('overall_score')
        )['avg'] or 0
        
        if mock_avg < 60:
            recommendations.append({
                'priority': 'medium',
                'area': 'Practice Sessions',
                'recommendation': 'Your mock interview scores suggest room for improvement. Focus on specific weak areas.',
                'action_items': [
                    'Identify 2-3 specific areas to improve',
                    'Practice with a partner or mentor',
                    'Record yourself answering questions',
                ]
            })
        
        # Check interview activity
        recent_interviews = self.interviews.filter(
            scheduled_at__gte=timezone.now() - timedelta(days=30)
        ).count()
        
        if recent_interviews == 0:
            recommendations.append({
                'priority': 'low',
                'area': 'Interview Activity',
                'recommendation': 'Stay interview-ready by maintaining regular practice, even when not actively interviewing.',
                'action_items': [
                    'Schedule weekly mock interviews',
                    'Keep your interview skills sharp',
                    'Review industry trends and common questions',
                ]
            })
        
        return recommendations
    
    def benchmark_against_patterns(self):
        """Benchmark performance against successful patterns."""
        # Calculate user's metrics
        total_interviews = self.interviews.count()
        offers = self.interviews.filter(outcome__in=POSITIVE_OUTCOMES).count()
        conversion_rate = (offers / total_interviews * 100) if total_interviews > 0 else 0
        
        mock_count = self.mock_sessions.filter(status='completed').count()
        mock_avg = self.mock_sessions.filter(status='completed').aggregate(
            avg=Avg('overall_score')
        )['avg'] or 0
        
        # Industry benchmarks (hypothetical averages)
        benchmarks = {
            'conversion_rate': {
                'user': round(conversion_rate, 1),
                'average': 25.0,
                'top_performers': 40.0,
            },
            'mock_sessions_completed': {
                'user': mock_count,
                'average': 8,
                'top_performers': 15,
            },
            'mock_average_score': {
                'user': round(mock_avg, 1),
                'average': 65.0,
                'top_performers': 80.0,
            },
        }
        
        return benchmarks
    
    def get_complete_analysis(self):
        """Get complete interview performance analysis."""
        return {
            'conversion_rates_over_time': self.get_conversion_rates_over_time(),
            'performance_by_format': self.analyze_by_interview_format(),
            'mock_to_real_improvement': self.track_mock_to_real_improvement(),
            'performance_by_industry': self.analyze_by_industry(),
            'feedback_themes': self.track_feedback_themes(),
            'confidence_progression': self.monitor_confidence_progression(),
            'coaching_recommendations': self.generate_coaching_recommendations(),
            'benchmark_comparison': self.benchmark_against_patterns(),
        }


def build_interview_performance_analytics(tracker: InterviewPerformanceTracker) -> Dict[str, Any]:
    """High-level analytics snapshot for UC-080."""
    conversion_trend = tracker.get_conversion_rates_over_time()
    format_performance = tracker.analyze_by_interview_format()
    industry_performance = tracker.analyze_by_industry()
    practice_insights = tracker.track_mock_to_real_improvement()
    feedback = tracker.track_feedback_themes()
    recommendations = tracker.generate_coaching_recommendations()
    benchmark = tracker.benchmark_against_patterns()

    total_interviews = tracker.interviews.count()
    total_offers = tracker.interviews.filter(outcome__in=POSITIVE_OUTCOMES).count()
    conversion_rate = round((total_offers / total_interviews * 100), 1) if total_interviews else 0

    best_period = conversion_trend[-1] if conversion_trend else None
    first_period = conversion_trend[0] if conversion_trend else None
    trend_delta = 0
    if best_period and first_period and len(conversion_trend) > 1:
        trend_delta = round(best_period['conversion_rate'] - first_period['conversion_rate'], 1)

    most_effective_format = format_performance[0] if format_performance else None
    weakest_format = format_performance[-1] if len(format_performance) > 1 else most_effective_format

    strongest_industry = industry_performance[0] if industry_performance else None
    weakest_industry = industry_performance[-1] if len(industry_performance) > 1 else strongest_industry

    summary = {
        'total_interviews': total_interviews,
        'offers': total_offers,
        'conversion_rate': conversion_rate,
        'trend_delta': trend_delta,
        'most_effective_format': most_effective_format,
        'least_effective_format': weakest_format,
        'strongest_industry': strongest_industry,
        'weakest_industry': weakest_industry,
    }

    strengths = []
    if most_effective_format:
        strengths.append({
            'type': 'format',
            'label': most_effective_format['format_label'],
            'value': most_effective_format['conversion_rate'],
        })
    if feedback['positive_themes']:
        strengths.extend([
            {'type': 'feedback', 'label': theme['theme'], 'value': theme['count']}
            for theme in feedback['positive_themes'][:3]
        ])

    improvement_areas = []
    if weakest_format and weakest_format is not most_effective_format:
        improvement_areas.append({
            'type': 'format',
            'label': weakest_format['format_label'],
            'value': weakest_format['conversion_rate'],
        })
    if feedback['improvement_areas']:
        improvement_areas.extend([
            {'type': 'feedback', 'label': area['area'], 'value': area['percentage']}
            for area in feedback['improvement_areas'][:3]
        ])

    insights = []
    if trend_delta > 0:
        insights.append(f'Interview conversion rate improved by {trend_delta} points over the observed period.')
    elif trend_delta < 0:
        insights.append('Interview conversion rate is trending downward. Review practice cadence and preparation routines.')

    if practice_insights.get('improvement_trend', 0) > 0:
        insights.append('Mock interview performance is trending upward—keep the current practice cadence.')
    elif practice_insights.get('improvement_trend', 0) < 0:
        insights.append('Mock interview scores decreased recently. Revisit feedback items before next sessions.')

    if most_effective_format and weakest_format and most_effective_format != weakest_format:
        diff = most_effective_format['conversion_rate'] - weakest_format['conversion_rate']
        if diff >= 10:
            insights.append(
                f"{most_effective_format['format_label']} interviews outperform {weakest_format['format_label']} by {round(diff, 1)} points."
            )

    return {
        'summary': summary,
        'conversion_trend': conversion_trend,
        'format_performance': format_performance,
        'industry_performance': industry_performance,
        'practice_insights': practice_insights,
        'feedback_themes': feedback,
        'strengths_and_gaps': {
            'strengths': strengths,
            'improvement_opportunities': improvement_areas,
        },
        'recommendations': recommendations,
        'benchmark_comparison': benchmark,
        'insights': insights,
    }
