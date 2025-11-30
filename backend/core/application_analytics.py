# backend/core/application_analytics.py
"""
UC-097: Application Success Rate Analysis
Analytics service for analyzing job application success patterns
"""

from django.db.models import Count, Avg, Q, F, ExpressionWrapper, fields
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta
from collections import defaultdict

from core.models import JobEntry


class ApplicationSuccessAnalyzer:
    """Analyzes application success rates and patterns."""
    
    def __init__(self, candidate_profile):
        self.candidate = candidate_profile
        self.applications = JobEntry.objects.filter(candidate=candidate_profile, is_archived=False)
    
    def get_overall_metrics(self):
        """Get overall application success metrics."""
        total = self.applications.count()
        
        if total == 0:
            return {
                'total_applications': 0,
                'response_rate': 0,
                'interview_rate': 0,
                'offer_rate': 0,
                'avg_days_to_response': 0,
                'success_stages': {
                    'interested': 0,
                    'applied': 0,
                    'phone_screen': 0,
                    'interview': 0,
                    'offer': 0,
                    'rejected': 0,
                }
            }
        
        # Count applications that got responses (moved beyond 'applied' status)
        responded = self.applications.exclude(status__in=['interested', 'applied']).count()
        
        # Count by stage
        stage_counts = self.applications.values('status').annotate(count=Count('id'))
        stages = {stage['status']: stage['count'] for stage in stage_counts}
        
        # Calculate rates
        applied_count = self.applications.exclude(status='interested').count()
        interview_count = self.applications.filter(
            status__in=['phone_screen', 'interview', 'offer']
        ).count()
        offer_count = self.applications.filter(status='offer').count()
        
        # Average days to response
        avg_days = self.applications.filter(
            days_to_response__isnull=False
        ).aggregate(avg=Avg('days_to_response'))['avg'] or 0
        
        return {
            'total_applications': total,
            'applied_count': applied_count,
            'response_rate': round((responded / applied_count * 100) if applied_count > 0 else 0, 2),
            'interview_rate': round((interview_count / applied_count * 100) if applied_count > 0 else 0, 2),
            'offer_rate': round((offer_count / applied_count * 100) if applied_count > 0 else 0, 2),
            'avg_days_to_response': round(avg_days, 1),
            'success_stages': {
                'interested': stages.get('interested', 0),
                'applied': stages.get('applied', 0),
                'phone_screen': stages.get('phone_screen', 0),
                'interview': stages.get('interview', 0),
                'offer': stages.get('offer', 0),
                'rejected': stages.get('rejected', 0),
            }
        }
    
    def analyze_by_industry(self):
        """Analyze success rates by industry."""
        industries = self.applications.exclude(industry='').values('industry').distinct()
        results = []
        
        for industry_obj in industries:
            industry = industry_obj['industry']
            apps = self.applications.filter(industry=industry)
            total = apps.count()
            
            if total == 0:
                continue
            
            applied = apps.exclude(status='interested').count()
            if applied == 0:
                continue
                
            responded = apps.exclude(status__in=['interested', 'applied']).count()
            interviews = apps.filter(status__in=['phone_screen', 'interview', 'offer']).count()
            offers = apps.filter(status='offer').count()
            
            results.append({
                'industry': industry,
                'total_applications': total,
                'applied_count': applied,
                'response_rate': round((responded / applied * 100), 2),
                'interview_rate': round((interviews / applied * 100), 2),
                'offer_rate': round((offers / applied * 100), 2),
                'avg_days_to_response': round(
                    apps.filter(days_to_response__isnull=False).aggregate(
                        avg=Avg('days_to_response')
                    )['avg'] or 0, 1
                ),
            })
        
        # Sort by success (offer rate)
        results.sort(key=lambda x: x['offer_rate'], reverse=True)
        return results
    
    def analyze_by_company_size(self):
        """Analyze success rates by company size."""
        results = []
        
        for size_code, size_label in JobEntry.COMPANY_SIZES:
            apps = self.applications.filter(company_size=size_code)
            total = apps.count()
            
            if total == 0:
                continue
            
            applied = apps.exclude(status='interested').count()
            if applied == 0:
                continue
                
            responded = apps.exclude(status__in=['interested', 'applied']).count()
            interviews = apps.filter(status__in=['phone_screen', 'interview', 'offer']).count()
            offers = apps.filter(status='offer').count()
            
            results.append({
                'company_size': size_label,
                'company_size_code': size_code,
                'total_applications': total,
                'applied_count': applied,
                'response_rate': round((responded / applied * 100), 2),
                'interview_rate': round((interviews / applied * 100), 2),
                'offer_rate': round((offers / applied * 100), 2),
                'avg_days_to_response': round(
                    apps.filter(days_to_response__isnull=False).aggregate(
                        avg=Avg('days_to_response')
                    )['avg'] or 0, 1
                ),
            })
        
        # Sort by offer rate
        results.sort(key=lambda x: x['offer_rate'], reverse=True)
        return results
    
    def analyze_by_application_source(self):
        """Analyze success rates by application source."""
        results = []
        
        for source_code, source_label in JobEntry.APPLICATION_SOURCES:
            apps = self.applications.filter(application_source=source_code)
            total = apps.count()
            
            if total == 0:
                continue
            
            applied = apps.exclude(status='interested').count()
            if applied == 0:
                continue
                
            responded = apps.exclude(status__in=['interested', 'applied']).count()
            interviews = apps.filter(status__in=['phone_screen', 'interview', 'offer']).count()
            offers = apps.filter(status='offer').count()
            
            results.append({
                'source': source_label,
                'source_code': source_code,
                'total_applications': total,
                'applied_count': applied,
                'response_rate': round((responded / applied * 100), 2),
                'interview_rate': round((interviews / applied * 100), 2),
                'offer_rate': round((offers / applied * 100), 2),
                'avg_days_to_response': round(
                    apps.filter(days_to_response__isnull=False).aggregate(
                        avg=Avg('days_to_response')
                    )['avg'] or 0, 1
                ),
            })
        
        # Sort by offer rate
        results.sort(key=lambda x: x['offer_rate'], reverse=True)
        return results
    
    def analyze_by_application_method(self):
        """Analyze success rates by application method."""
        results = []
        
        for method_code, method_label in JobEntry.APPLICATION_METHODS:
            apps = self.applications.filter(application_method=method_code)
            total = apps.count()
            
            if total == 0:
                continue
            
            applied = apps.exclude(status='interested').count()
            if applied == 0:
                continue
                
            responded = apps.exclude(status__in=['interested', 'applied']).count()
            interviews = apps.filter(status__in=['phone_screen', 'interview', 'offer']).count()
            offers = apps.filter(status='offer').count()
            
            results.append({
                'method': method_label,
                'method_code': method_code,
                'total_applications': total,
                'applied_count': applied,
                'response_rate': round((responded / applied * 100), 2),
                'interview_rate': round((interviews / applied * 100), 2),
                'offer_rate': round((offers / applied * 100), 2),
                'avg_days_to_response': round(
                    apps.filter(days_to_response__isnull=False).aggregate(
                        avg=Avg('days_to_response')
                    )['avg'] or 0, 1
                ),
            })
        
        # Sort by offer rate
        results.sort(key=lambda x: x['offer_rate'], reverse=True)
        return results
    
    def analyze_customization_impact(self):
        """Analyze impact of resume/cover letter customization."""
        results = {
            'resume_customization': {},
            'cover_letter_customization': {},
            'both_customized': {},
        }
        
        # Analyze resume customization
        for customized in [True, False]:
            apps = self.applications.filter(resume_customized=customized)
            applied = apps.exclude(status='interested').count()
            
            if applied > 0:
                responded = apps.exclude(status__in=['interested', 'applied']).count()
                interviews = apps.filter(status__in=['phone_screen', 'interview', 'offer']).count()
                offers = apps.filter(status='offer').count()
                
                key = 'customized' if customized else 'not_customized'
                results['resume_customization'][key] = {
                    'total_applications': applied,
                    'response_rate': round((responded / applied * 100), 2),
                    'interview_rate': round((interviews / applied * 100), 2),
                    'offer_rate': round((offers / applied * 100), 2),
                }
        
        # Analyze cover letter customization
        for customized in [True, False]:
            apps = self.applications.filter(cover_letter_customized=customized)
            applied = apps.exclude(status='interested').count()
            
            if applied > 0:
                responded = apps.exclude(status__in=['interested', 'applied']).count()
                interviews = apps.filter(status__in=['phone_screen', 'interview', 'offer']).count()
                offers = apps.filter(status='offer').count()
                
                key = 'customized' if customized else 'not_customized'
                results['cover_letter_customization'][key] = {
                    'total_applications': applied,
                    'response_rate': round((responded / applied * 100), 2),
                    'interview_rate': round((interviews / applied * 100), 2),
                    'offer_rate': round((offers / applied * 100), 2),
                }
        
        # Analyze both customized
        both_customized = self.applications.filter(resume_customized=True, cover_letter_customized=True)
        neither_customized = self.applications.filter(resume_customized=False, cover_letter_customized=False)
        
        for apps, key in [(both_customized, 'both_customized'), (neither_customized, 'neither_customized')]:
            applied = apps.exclude(status='interested').count()
            
            if applied > 0:
                responded = apps.exclude(status__in=['interested', 'applied']).count()
                interviews = apps.filter(status__in=['phone_screen', 'interview', 'offer']).count()
                offers = apps.filter(status='offer').count()
                
                results['both_customized'][key] = {
                    'total_applications': applied,
                    'response_rate': round((responded / applied * 100), 2),
                    'interview_rate': round((interviews / applied * 100), 2),
                    'offer_rate': round((offers / applied * 100), 2),
                }
        
        return results
    
    def analyze_timing_patterns(self):
        """Analyze optimal application submission timing."""
        # Get applications with submission dates
        apps_with_dates = self.applications.filter(
            application_submitted_at__isnull=False
        ).exclude(status='interested')
        
        if apps_with_dates.count() == 0:
            return {
                'by_day_of_week': [],
                'by_time_of_day': [],
                'best_day': None,
                'best_time': None,
            }
        
        # Analyze by day of week (0=Monday, 6=Sunday)
        day_stats = defaultdict(lambda: {'total': 0, 'responded': 0, 'interviewed': 0, 'offers': 0})
        
        for app in apps_with_dates:
            day = app.application_submitted_at.weekday()
            day_stats[day]['total'] += 1
            
            if app.status not in ['interested', 'applied']:
                day_stats[day]['responded'] += 1
            if app.status in ['phone_screen', 'interview', 'offer']:
                day_stats[day]['interviewed'] += 1
            if app.status == 'offer':
                day_stats[day]['offers'] += 1
        
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        by_day = []
        
        for day_num in range(7):
            if day_stats[day_num]['total'] > 0:
                total = day_stats[day_num]['total']
                by_day.append({
                    'day': day_names[day_num],
                    'day_num': day_num,
                    'total_applications': total,
                    'response_rate': round((day_stats[day_num]['responded'] / total * 100), 2),
                    'interview_rate': round((day_stats[day_num]['interviewed'] / total * 100), 2),
                    'offer_rate': round((day_stats[day_num]['offers'] / total * 100), 2),
                })
        
        # Find best day
        best_day = max(by_day, key=lambda x: x['offer_rate']) if by_day else None
        
        # Analyze by time of day (morning, afternoon, evening)
        time_stats = defaultdict(lambda: {'total': 0, 'responded': 0, 'interviewed': 0, 'offers': 0})
        
        for app in apps_with_dates:
            hour = app.application_submitted_at.hour
            if 6 <= hour < 12:
                time_slot = 'morning'
            elif 12 <= hour < 18:
                time_slot = 'afternoon'
            else:
                time_slot = 'evening'
            
            time_stats[time_slot]['total'] += 1
            
            if app.status not in ['interested', 'applied']:
                time_stats[time_slot]['responded'] += 1
            if app.status in ['phone_screen', 'interview', 'offer']:
                time_stats[time_slot]['interviewed'] += 1
            if app.status == 'offer':
                time_stats[time_slot]['offers'] += 1
        
        by_time = []
        for time_slot in ['morning', 'afternoon', 'evening']:
            if time_stats[time_slot]['total'] > 0:
                total = time_stats[time_slot]['total']
                by_time.append({
                    'time_slot': time_slot,
                    'total_applications': total,
                    'response_rate': round((time_stats[time_slot]['responded'] / total * 100), 2),
                    'interview_rate': round((time_stats[time_slot]['interviewed'] / total * 100), 2),
                    'offer_rate': round((time_stats[time_slot]['offers'] / total * 100), 2),
                })
        
        # Find best time
        best_time = max(by_time, key=lambda x: x['offer_rate']) if by_time else None
        
        return {
            'by_day_of_week': by_day,
            'by_time_of_day': by_time,
            'best_day': best_day,
            'best_time': best_time,
        }
    
    def get_recommendations(self):
        """Generate actionable recommendations based on analysis."""
        recommendations = []
        
        # Analyze customization impact
        customization = self.analyze_customization_impact()
        
        if customization['resume_customization']:
            custom = customization['resume_customization'].get('customized', {})
            not_custom = customization['resume_customization'].get('not_customized', {})
            
            if custom and not_custom:
                if custom['offer_rate'] > not_custom['offer_rate'] * 1.5:
                    recommendations.append({
                        'type': 'high_impact',
                        'category': 'customization',
                        'message': f"Customized resumes have {custom['offer_rate']}% offer rate vs {not_custom['offer_rate']}% for generic resumes. Always customize your resume!",
                        'impact_score': custom['offer_rate'] - not_custom['offer_rate'],
                    })
        
        # Analyze application source
        sources = self.analyze_by_application_source()
        if len(sources) >= 2:
            best_source = sources[0]
            if best_source['offer_rate'] > 0:
                recommendations.append({
                    'type': 'medium_impact',
                    'category': 'source',
                    'message': f"{best_source['source']} has your highest success rate at {best_source['offer_rate']}% offer rate. Focus more applications here.",
                    'impact_score': best_source['offer_rate'],
                })
        
        # Analyze timing
        timing = self.analyze_timing_patterns()
        if timing['best_day']:
            recommendations.append({
                'type': 'low_impact',
                'category': 'timing',
                'message': f"You have the best success rate when applying on {timing['best_day']['day']}s ({timing['best_day']['offer_rate']}% offer rate).",
                'impact_score': timing['best_day']['offer_rate'],
            })
        
        # Overall response rate check
        overall = self.get_overall_metrics()
        if overall['response_rate'] < 20:
            recommendations.append({
                'type': 'high_impact',
                'category': 'general',
                'message': f"Your response rate is {overall['response_rate']}%, which is below average (30-40%). Consider improving your resume and targeting more suitable positions.",
                'impact_score': 20 - overall['response_rate'],
            })
        
        # Sort by impact
        recommendations.sort(key=lambda x: x['impact_score'], reverse=True)
        
        return recommendations
    
    def get_complete_analysis(self):
        """Get comprehensive success rate analysis."""
        return {
            'overall_metrics': self.get_overall_metrics(),
            'by_industry': self.analyze_by_industry(),
            'by_company_size': self.analyze_by_company_size(),
            'by_application_source': self.analyze_by_application_source(),
            'by_application_method': self.analyze_by_application_method(),
            'customization_impact': self.analyze_customization_impact(),
            'timing_patterns': self.analyze_timing_patterns(),
            'recommendations': self.get_recommendations(),
        }
