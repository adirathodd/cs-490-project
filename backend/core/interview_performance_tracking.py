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
                When(outcome__in=['excellent', 'good'], then=1),
            )),
            rejections=Count(Case(
                When(outcome__in=['rejected', 'poor'], then=1),
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
            
            results.append({
                'period': data['period'].isoformat() if data['period'] else None,
                'total_interviews': total,
                'offers': offers,
                'rejections': data['rejections'],
                'pending': data['pending'],
                'conversion_rate': conversion_rate,
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
            offers = interviews.filter(outcome__in=['excellent', 'good']).count()
            rejections = interviews.filter(outcome__in=['rejected', 'poor']).count()
            
            results.append({
                'format': format_type,
                'format_label': format_type.replace('_', ' ').title(),
                'total_interviews': total,
                'offers': offers,
                'rejections': rejections,
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
            
            offers = interviews.filter(outcome='offer_received').count()
            
            results.append({
                'industry': industry,
                'total_interviews': total,
                'offers': offers,
                'conversion_rate': round((offers / total * 100), 2),
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
        
        return {
            'improvement_areas': [
                {'theme': k.replace('_', ' ').title(), 'count': v}
                for k, v in sorted(improvement_areas.items(), key=lambda x: x[1], reverse=True)
                if v > 0
            ],
            'positive_themes': [
                {'theme': k.replace('_', ' ').title(), 'count': v}
                for k, v in sorted(positive_themes.items(), key=lambda x: x[1], reverse=True)
                if v > 0
            ],
            'total_feedback_analyzed': len(interviews_with_feedback),
        }
    
    def monitor_confidence_progression(self):
        """Monitor confidence progression over time."""
        # Since InterviewSchedule doesn't have confidence_level,
        # we'll use mock session scores as a proxy
        thirty_days_ago = timezone.now() - timedelta(days=30)
        sixty_days_ago = timezone.now() - timedelta(days=60)
        
        last_30_days = self.mock_sessions.filter(
            started_at__gte=thirty_days_ago,
            status='completed'
        )
        
        previous_30_days = self.mock_sessions.filter(
            started_at__gte=sixty_days_ago,
            started_at__lt=thirty_days_ago,
            status='completed'
        )
        
        current_avg = last_30_days.aggregate(avg=Avg('overall_score'))['avg'] or 0
        previous_avg = previous_30_days.aggregate(avg=Avg('overall_score'))['avg'] or 0
        
        # Calculate trend
        trend = 'stable'
        change_percent = 0
        if previous_avg > 0:
            change_percent = round(((current_avg - previous_avg) / previous_avg * 100), 1)
            if change_percent > 10:
                trend = 'improving'
            elif change_percent < -10:
                trend = 'declining'
        
        # Get progression data points
        progression_data = []
        for session in self.mock_sessions.filter(status='completed').order_by('started_at')[:30]:
            progression_data.append({
                'date': session.started_at.date().isoformat() if session.started_at else None,
                'score': session.overall_score or 0,
            })
        
        return {
            'current_period_average': round(current_avg, 1),
            'previous_period_average': round(previous_avg, 1),
            'change_percent': change_percent,
            'trend': trend,
            'progression_data': progression_data,
        }
    
    def generate_coaching_recommendations(self):
        """Generate personalized coaching recommendations."""
        recommendations = []
        
        # Check conversion rate
        total_interviews = self.interviews.count()
        if total_interviews > 0:
            offers = self.interviews.filter(outcome__in=['excellent', 'good']).count()
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
        offers = self.interviews.filter(outcome__in=['excellent', 'good']).count()
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
