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
    InterviewEvent,
    JobEntry,
    MockInterviewSession,
    QuestionResponseCoaching,
)


class InterviewPerformanceTracker:
    """Tracks and analyzes interview performance over time."""
    
    def __init__(self, candidate_profile):
        self.candidate = candidate_profile
        self.interviews = InterviewEvent.objects.filter(
            job__candidate=candidate_profile
        ).select_related('job')
        self.mock_sessions = MockInterviewSession.objects.filter(
            candidate=candidate_profile
        )
    
    def get_conversion_rates_over_time(self, period='month'):
        """Calculate interview-to-offer conversion rates over time."""
        # Group interviews by time period
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
                When(outcome='offer_received', then=1),
            )),
            rejections=Count(Case(
                When(outcome__in=['rejected', 'no_response'], then=1),
            )),
            pending=Count(Case(
                When(outcome='pending', then=1),
            ))
        ).order_by('period')
        
        results = []
        for data in interview_data:
            total = data['total_interviews']
            if total > 0:
                results.append({
                    'period': data['period'].isoformat(),
                    'total_interviews': total,
                    'offers': data['offers'],
                    'rejections': data['rejections'],
                    'pending': data['pending'],
                    'conversion_rate': round((data['offers'] / total * 100), 2),
                    'rejection_rate': round((data['rejections'] / total * 100), 2),
                })
        
        return results
    
    def analyze_by_interview_format(self):
        """Analyze performance across different interview formats."""
        formats = ['phone', 'video', 'in_person', 'panel', 'technical', 'behavioral']
        results = []
        
        for format_type in formats:
            interviews = self.interviews.filter(interview_type=format_type)
            total = interviews.count()
            
            if total == 0:
                continue
            
            offers = interviews.filter(outcome='offer_received').count()
            rejections = interviews.filter(outcome__in=['rejected', 'no_response']).count()
            avg_confidence = interviews.filter(
                confidence_level__isnull=False
            ).aggregate(avg=Avg('confidence_level'))['avg'] or 0
            
            results.append({
                'format': format_type,
                'format_label': format_type.replace('_', ' ').title(),
                'total_interviews': total,
                'offers': offers,
                'rejections': rejections,
                'conversion_rate': round((offers / total * 100), 2) if total > 0 else 0,
                'avg_confidence': round(avg_confidence, 1),
            })
        
        # Sort by conversion rate
        results.sort(key=lambda x: x['conversion_rate'], reverse=True)
        return results
    
    def track_mock_to_real_improvement(self):
        """Monitor improvement trends from mock practice to real interviews."""
        # Get mock interview scores over time
        mock_sessions = self.mock_sessions.filter(
            status='completed'
        ).order_by('created_at')
        
        mock_progress = []
        for session in mock_sessions[:20]:  # Last 20 sessions
            mock_progress.append({
                'date': session.created_at.date().isoformat(),
                'score': session.overall_score or 0,
                'type': 'mock',
                'interview_type': session.interview_type,
            })
        
        # Get real interview confidence levels
        real_interviews = self.interviews.filter(
            confidence_level__isnull=False
        ).order_by('scheduled_at')
        
        real_progress = []
        for interview in real_interviews[:20]:  # Last 20 interviews
            # Map confidence (1-5) to percentage
            score = (interview.confidence_level / 5.0) * 100
            real_progress.append({
                'date': interview.scheduled_at.date().isoformat(),
                'score': round(score, 1),
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
            avg_confidence = interviews.filter(
                confidence_level__isnull=False
            ).aggregate(avg=Avg('confidence_level'))['avg'] or 0
            
            results.append({
                'industry': industry,
                'total_interviews': total,
                'offers': offers,
                'conversion_rate': round((offers / total * 100), 2),
                'avg_confidence': round(avg_confidence, 1),
            })
        
        results.sort(key=lambda x: x['conversion_rate'], reverse=True)
        return results
    
    def track_feedback_themes(self):
        """Track feedback themes and common improvement areas."""
        # Analyze coaching feedback from mock interviews
        coaching_sessions = QuestionResponseCoaching.objects.filter(
            job__candidate=self.candidate
        ).order_by('-created_at')[:50]
        
        # Common improvement areas from feedback
        improvement_areas = defaultdict(int)
        positive_themes = defaultdict(int)
        
        for session in coaching_sessions:
            feedback = session.feedback_text.lower() if session.feedback_text else ''
            
            # Track improvement areas
            if 'unclear' in feedback or 'vague' in feedback:
                improvement_areas['clarity'] += 1
            if 'length' in feedback or 'too long' in feedback or 'too short' in feedback:
                improvement_areas['response_length'] += 1
            if 'specific' in feedback or 'concrete' in feedback:
                improvement_areas['specificity'] += 1
            if 'star' in feedback.lower() or 'structure' in feedback:
                improvement_areas['structure'] += 1
            if 'confident' in feedback or 'hesitant' in feedback:
                improvement_areas['confidence'] += 1
            
            # Track positive themes
            if 'good' in feedback or 'excellent' in feedback or 'strong' in feedback:
                positive_themes['strong_response'] += 1
            if 'clear' in feedback and 'unclear' not in feedback:
                positive_themes['clarity'] += 1
            if 'detailed' in feedback or 'thorough' in feedback:
                positive_themes['detail'] += 1
        
        # Convert to list format
        improvement_list = [
            {
                'area': area.replace('_', ' ').title(),
                'frequency': count,
                'percentage': round((count / len(coaching_sessions) * 100), 1) if coaching_sessions else 0
            }
            for area, count in sorted(improvement_areas.items(), key=lambda x: x[1], reverse=True)
        ]
        
        positive_list = [
            {
                'theme': theme.replace('_', ' ').title(),
                'frequency': count,
            }
            for theme, count in sorted(positive_themes.items(), key=lambda x: x[1], reverse=True)
        ]
        
        return {
            'improvement_areas': improvement_list[:5],
            'positive_themes': positive_list[:5],
            'total_feedback_sessions': coaching_sessions.count(),
        }
    
    def monitor_confidence_progression(self):
        """Monitor confidence levels and anxiety management over time."""
        # Get confidence levels over time
        confidence_data = self.interviews.filter(
            confidence_level__isnull=False
        ).order_by('scheduled_at').values(
            'scheduled_at', 'confidence_level', 'outcome', 'interview_type'
        )
        
        confidence_progression = []
        for interview in confidence_data:
            confidence_progression.append({
                'date': interview['scheduled_at'].date().isoformat(),
                'confidence_level': interview['confidence_level'],
                'outcome': interview['outcome'],
                'interview_type': interview['interview_type'],
            })
        
        # Calculate averages by time period
        now = timezone.now()
        last_30_days = self.interviews.filter(
            scheduled_at__gte=now - timedelta(days=30),
            confidence_level__isnull=False
        )
        
        previous_30_days = self.interviews.filter(
            scheduled_at__gte=now - timedelta(days=60),
            scheduled_at__lt=now - timedelta(days=30),
            confidence_level__isnull=False
        )
        
        current_avg = last_30_days.aggregate(avg=Avg('confidence_level'))['avg'] or 0
        previous_avg = previous_30_days.aggregate(avg=Avg('confidence_level'))['avg'] or 0
        
        trend = 0
        if previous_avg > 0:
            trend = round(((current_avg - previous_avg) / previous_avg * 100), 1)
        
        return {
            'confidence_progression': confidence_progression,
            'current_avg_confidence': round(current_avg, 1),
            'previous_avg_confidence': round(previous_avg, 1),
            'trend_percentage': trend,
            'total_interviews_tracked': len(confidence_progression),
        }
    
    def generate_coaching_recommendations(self):
        """Generate personalized interview coaching recommendations."""
        recommendations = []
        
        # Analyze recent performance
        recent_interviews = self.interviews.filter(
            scheduled_at__gte=timezone.now() - timedelta(days=90)
        )
        
        total_recent = recent_interviews.count()
        if total_recent == 0:
            return [{
                'category': 'practice',
                'priority': 'high',
                'recommendation': 'Start scheduling practice interviews to build your skills',
                'action': 'Complete at least 3 mock interview sessions this month',
            }]
        
        # Check conversion rate
        offers = recent_interviews.filter(outcome='offer_received').count()
        conversion_rate = (offers / total_recent * 100) if total_recent > 0 else 0
        
        if conversion_rate < 20:
            recommendations.append({
                'category': 'conversion',
                'priority': 'high',
                'recommendation': f'Your interview-to-offer rate is {conversion_rate:.1f}%, below the 20-30% benchmark',
                'action': 'Focus on practicing common interview questions and refining your STAR method responses',
            })
        
        # Check confidence levels
        avg_confidence = recent_interviews.filter(
            confidence_level__isnull=False
        ).aggregate(avg=Avg('confidence_level'))['avg'] or 0
        
        if avg_confidence < 3.5:
            recommendations.append({
                'category': 'confidence',
                'priority': 'high',
                'recommendation': f'Your average confidence level is {avg_confidence:.1f}/5, indicating room for improvement',
                'action': 'Complete more mock interviews and practice with our question bank to build confidence',
            })
        
        # Check format performance
        format_analysis = self.analyze_by_interview_format()
        if format_analysis:
            weakest_format = min(format_analysis, key=lambda x: x['conversion_rate'])
            if weakest_format['conversion_rate'] < 15 and weakest_format['total_interviews'] >= 3:
                recommendations.append({
                    'category': 'format_specific',
                    'priority': 'medium',
                    'recommendation': f'{weakest_format["format_label"]} interviews show lower success rate ({weakest_format["conversion_rate"]}%)',
                    'action': f'Practice {weakest_format["format_label"]} interview scenarios to improve performance',
                })
        
        # Check practice frequency
        mock_count = self.mock_sessions.filter(
            created_at__gte=timezone.now() - timedelta(days=30)
        ).count()
        
        if mock_count < 2:
            recommendations.append({
                'category': 'practice',
                'priority': 'medium',
                'recommendation': f'Only {mock_count} mock interview(s) completed in the last 30 days',
                'action': 'Aim for 2-3 mock interviews per week to maintain sharp skills',
            })
        
        # Check feedback incorporation
        feedback_themes = self.track_feedback_themes()
        if feedback_themes['improvement_areas']:
            top_area = feedback_themes['improvement_areas'][0]
            recommendations.append({
                'category': 'skill_development',
                'priority': 'medium',
                'recommendation': f'{top_area["area"]} appears in {top_area["percentage"]}% of your feedback',
                'action': f'Focus on improving {top_area["area"].lower()} in your next practice sessions',
            })
        
        # Sort by priority
        priority_order = {'high': 0, 'medium': 1, 'low': 2}
        recommendations.sort(key=lambda x: priority_order.get(x['priority'], 3))
        
        return recommendations[:5]  # Return top 5
    
    def benchmark_against_patterns(self):
        """Benchmark performance against successful interview patterns."""
        # Calculate user's metrics
        total_interviews = self.interviews.count()
        if total_interviews == 0:
            return {
                'user_metrics': {},
                'benchmark_metrics': {},
                'comparison': {},
            }
        
        offers = self.interviews.filter(outcome='offer_received').count()
        user_conversion = (offers / total_interviews * 100) if total_interviews > 0 else 0
        
        avg_confidence = self.interviews.filter(
            confidence_level__isnull=False
        ).aggregate(avg=Avg('confidence_level'))['avg'] or 0
        
        mock_sessions_count = self.mock_sessions.filter(status='completed').count()
        
        # Industry benchmarks (typical ranges)
        benchmarks = {
            'conversion_rate': {'min': 20, 'max': 30, 'optimal': 25},
            'avg_confidence': {'min': 3.5, 'max': 4.5, 'optimal': 4.0},
            'mock_practice': {'min': 10, 'max': 20, 'optimal': 15},
            'interviews_per_month': {'min': 4, 'max': 8, 'optimal': 6},
        }
        
        # Calculate user's interviews per month
        first_interview = self.interviews.order_by('scheduled_at').first()
        if first_interview:
            days_active = (timezone.now() - first_interview.scheduled_at).days
            months_active = max(days_active / 30, 1)
            interviews_per_month = total_interviews / months_active
        else:
            interviews_per_month = 0
        
        user_metrics = {
            'conversion_rate': round(user_conversion, 1),
            'avg_confidence': round(avg_confidence, 1),
            'mock_sessions': mock_sessions_count,
            'interviews_per_month': round(interviews_per_month, 1),
        }
        
        # Compare against benchmarks
        comparison = {}
        for metric, values in benchmarks.items():
            user_value = user_metrics.get(metric, 0)
            optimal = values['optimal']
            
            if user_value >= values['max']:
                status = 'excellent'
                message = f'Exceeds benchmark ({user_value} vs {optimal} optimal)'
            elif user_value >= optimal:
                status = 'good'
                message = f'Meets benchmark ({user_value} vs {optimal} optimal)'
            elif user_value >= values['min']:
                status = 'fair'
                message = f'Below optimal ({user_value} vs {optimal} optimal)'
            else:
                status = 'needs_improvement'
                message = f'Below benchmark ({user_value} vs {values["min"]} minimum)'
            
            comparison[metric] = {
                'status': status,
                'message': message,
                'user_value': user_value,
                'benchmark_range': f'{values["min"]}-{values["max"]}',
                'optimal': optimal,
            }
        
        return {
            'user_metrics': user_metrics,
            'benchmark_metrics': benchmarks,
            'comparison': comparison,
        }
    
    def get_complete_analysis(self):
        """Get comprehensive interview performance analysis."""
        return {
            'conversion_rates_over_time': self.get_conversion_rates_over_time(period='month'),
            'performance_by_format': self.analyze_by_interview_format(),
            'mock_to_real_improvement': self.track_mock_to_real_improvement(),
            'performance_by_industry': self.analyze_by_industry(),
            'feedback_themes': self.track_feedback_themes(),
            'confidence_progression': self.monitor_confidence_progression(),
            'coaching_recommendations': self.generate_coaching_recommendations(),
            'benchmark_comparison': self.benchmark_against_patterns(),
        }
