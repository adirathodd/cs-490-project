# backend/core/application_analytics.py
"""
UC-097: Application Success Rate Analysis
Analytics service for analyzing job application success patterns
"""

from django.db.models import Count, Avg, Q, F, ExpressionWrapper, fields
from django.db.models.functions import TruncDate, Coalesce, TruncMonth
import os, json, logging, requests
from django.utils import timezone
from datetime import timedelta, date
from collections import defaultdict
from core.api_monitoring import track_api_call, get_or_create_service, SERVICE_GEMINI

logger = logging.getLogger(__name__)


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
        # Get applications with submission dates (fallback to created_at)
        apps_with_dates = (
            self.applications.annotate(submitted_at=Coalesce('application_submitted_at', 'created_at'))
            .filter(submitted_at__isnull=False)
            .exclude(status='interested')
        )
        
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
            day = app.submitted_at.weekday()
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
        best_day = max(by_day, key=lambda x: (x['offer_rate'], x['response_rate'], x['total_applications'])) if by_day else None
        
        # Analyze by time of day (4-hour buckets)
        time_stats = defaultdict(lambda: {'total': 0, 'responded': 0, 'interviewed': 0, 'offers': 0})
        slot_labels = ['overnight', 'early_morning', 'morning', 'midday', 'afternoon', 'evening']

        for app in apps_with_dates:
            hour = app.submitted_at.hour
            slot_idx = min(hour // 4, len(slot_labels) - 1)
            time_slot = slot_labels[slot_idx]
            time_stats[time_slot]['total'] += 1
            
            if app.status not in ['interested', 'applied']:
                time_stats[time_slot]['responded'] += 1
            if app.status in ['phone_screen', 'interview', 'offer']:
                time_stats[time_slot]['interviewed'] += 1
            if app.status == 'offer':
                time_stats[time_slot]['offers'] += 1
        
        by_time = []
        for time_slot in slot_labels:
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
        best_time = max(by_time, key=lambda x: (x['offer_rate'], x['response_rate'], x['total_applications'])) if by_time else None
        
        return {
            'by_day_of_week': by_day,
            'by_time_of_day': by_time,
            'best_day': best_day,
            'best_time': best_time,
            'apply_speed': [],
            'response_speed': [],
            'medians': {},
        }

    def analyze_apply_and_response_speed(self):
        """Buckets for apply speed (interestedâ†’applied) and response speed (appliedâ†’response)."""
        apply_buckets = defaultdict(lambda: {'count': 0, 'success': 0})
        response_buckets = defaultdict(lambda: {'count': 0, 'success': 0})
        response_durations = []

        for app in self.applications:
            if getattr(app, 'interested_at', None) and getattr(app, 'applied_at', None):
                delta_days = (app.applied_at.date() - app.interested_at.date()).days
                if delta_days <= 1:
                    bucket = '0-1 days'
                elif delta_days <= 3:
                    bucket = '2-3 days'
                elif delta_days <= 7:
                    bucket = '4-7 days'
                else:
                    bucket = '8+ days'
                apply_buckets[bucket]['count'] += 1
                if app.status in ['phone_screen', 'interview', 'offer']:
                    apply_buckets[bucket]['success'] += 1

            if getattr(app, 'applied_at', None) and getattr(app, 'response_at', None):
                delta_days = (app.response_at.date() - app.applied_at.date()).days
                response_durations.append(delta_days)
                if delta_days <= 3:
                    bucket = '0-3 days'
                elif delta_days <= 7:
                    bucket = '4-7 days'
                elif delta_days <= 14:
                    bucket = '8-14 days'
                else:
                    bucket = '15+ days'
                response_buckets[bucket]['count'] += 1
                if app.status in ['phone_screen', 'interview', 'offer']:
                    response_buckets[bucket]['success'] += 1

        def format_bucket(b):
            out = []
            for bucket, vals in b.items():
                total = vals['count']
                success_rate = (vals['success'] / total) if total else 0
                out.append({'bucket': bucket, 'count': total, 'success_rate': round(success_rate, 3)})
            return out

        median_resp = None
        if response_durations:
            arr = sorted(response_durations)
            mid = len(arr) // 2
            median_resp = arr[mid] if len(arr) % 2 else round((arr[mid - 1] + arr[mid]) / 2, 1)

        return {
            'apply_speed': format_bucket(apply_buckets),
            'response_speed': format_bucket(response_buckets),
            'medians': {'apply_to_response_days': median_resp} if median_resp is not None else {},
        }

    def analyze_industry_success(self):
        """Alias for UI naming."""
        return self.analyze_by_industry()

    def analyze_keyword_signals(self):
        """
        Keyword/skill signals weighted by outcome.
        Uses required_skills/skills/keywords (first available).
        Weights: offer=3, interview=2, phone_screen=1.
        """
        from collections import defaultdict

        # candidate skill fields to consider on JobEntry
        job_skill_fields = ('required_skills', 'skills', 'skill_requirements', 'keywords')

        # candidate skills set (must exist to report signals)
        candidate_skills = set()
        # 1) CandidateSkill relation (preferred, uses related_name="skills")
        try:
            if hasattr(self.candidate, 'skills'):
                related = self.candidate.skills.all()
                if related is not None:
                    candidate_skills.update({getattr(cs.skill, 'name', str(cs.skill)) for cs in related if getattr(cs, 'skill', None)})
        except Exception:
            candidate_skills = set()

        # 2) Fallback to other fields if still empty
        if not candidate_skills:
            for cand_field in ('skills', 'required_skills', 'keywords'):
                if hasattr(self.candidate, cand_field):
                    val = getattr(self.candidate, cand_field)
                    try:
                        if hasattr(val, 'all'):
                            candidate_skills = {getattr(s, 'name', str(s)) for s in val.all()}
                        elif isinstance(val, str):
                            candidate_skills = {s.strip() for s in val.split(',') if s.strip()}
                        else:
                            candidate_skills = set(val or [])
                    except Exception:
                        candidate_skills = set()
                    break
        # If the candidate has no recorded skills, we cannot determine â€œkey skillsâ€
        if not candidate_skills:
            return []

        weights = {'offer': 3, 'interview': 2, 'phone_screen': 1}
        signals = defaultdict(lambda: {'count': 0, 'score': 0})

        for app in self.applications:
            if app.status not in ['phone_screen', 'interview', 'offer']:
                continue
            # pull skills from the first available field on the job
            raw_skills = []
            for field in job_skill_fields:
                if hasattr(app, field):
                    raw_skills = getattr(app, field, []) or []
                    if raw_skills:
                        break

            # Normalize skills to a list of strings
            skills = []
            if isinstance(raw_skills, str):
                skills = [s.strip() for s in raw_skills.split(',') if s.strip()]
            else:
                for s in list(raw_skills):
                    if isinstance(s, dict) and 'name' in s:
                        skills.append(s['name'])
                    else:
                        skills.append(str(s))

            # If still empty, fall back to parsing job requirements/description via SkillsGapAnalyzer
            if not skills:
                try:
                    from core.skills_gap_analysis import SkillsGapAnalyzer

                    parsed = SkillsGapAnalyzer._extract_job_requirements(app)
                    skills = [req.get('name') for req in parsed if req.get('name')]
                except Exception:
                    skills = []

            # Only keep overlaps with candidate skills
            skills = [s for s in skills if s in candidate_skills]
            if not skills:
                continue

            weight = weights.get(app.status, 1)
            for kw in skills:
                signals[kw]['count'] += 1
                signals[kw]['score'] += weight

        result = []
        for kw, vals in signals.items():
            count = vals['count']
            score = vals['score']
            result.append({
                'keyword': kw,
                'count': count,
                'success_score': score,
                'success_rate': round(score / count, 3) if count else 0,
                'uplift': 0,
            })

        # Sort by weighted score descending
        result.sort(key=lambda x: x['success_score'], reverse=True)
        # Return only the fields needed by the UI (keyword + rate + count)
        simplified = []
        for r in result:
            simplified.append({
                'keyword': r['keyword'],
                'count': r['count'],
                'success_rate': r['success_rate'],
            })
        return simplified

    def analyze_prep_correlations(self):
        """
        Correlate practice activity with interview success.
        Currently uses JobQuestionPractice logs as a proxy for prep.
        """
        from core.models import JobQuestionPractice

        prep = []
        qs = JobQuestionPractice.objects.filter(job__candidate=self.candidate)
        total_logs = qs.count()
        if total_logs == 0:
            return prep

        success_logs = qs.filter(job__status__in=['phone_screen', 'interview', 'offer']).count()
        rate = success_logs / total_logs if total_logs else 0
        # baseline: overall interview rate for this candidate
        applied_count = self.applications.exclude(status='interested').count() or 1
        overall_interview = self.applications.filter(status__in=['phone_screen', 'interview', 'offer']).count() / applied_count

        prep.append({
            'prep_type': 'question_practice',
            'count': total_logs,
            'interview_rate': round(rate, 3),
            'uplift': round(rate - overall_interview, 3),
        })

        return prep

    def analyze_practice_history(self):
        """
        Weekly practice history using JobQuestionPractice logs.
        Uses practice_count as a proxy for score per week.
        """
        from core.models import JobQuestionPractice

        history = defaultdict(lambda: {'sessions': 0})
        logs = JobQuestionPractice.objects.filter(job__candidate=self.candidate)
        for log in logs:
            dt = getattr(log, 'last_practiced_at', None) or getattr(log, 'first_practiced_at', None)
            if not dt:
                continue
            iso_year, iso_week, _ = dt.isocalendar()
            key = f"{iso_year}-W{iso_week:02d}"
            history[key]['sessions'] += (log.practice_count or 1)

        result = []
        for key, vals in sorted(history.items()):
            _, week = key.split('-W')
            result.append({
                'week': int(week),
                'week_label': key,
                'avg_score': vals['sessions'],
            })
        return result

    def analyze_success_trend(self, months_back=6):
        """Monthly trend of response/offer rates (unique months) for the last N months."""
        end_date = timezone.now().date().replace(day=1)
        start_date = (end_date - timedelta(days=months_back * 31)).replace(day=1)
        qs = self.applications.filter(created_at__date__gte=start_date)
        month_counts = (
            qs.annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(
                total=Count('id'),
                applied=Count('id', filter=~Q(status='interested')),
                responded=Count('id', filter=~Q(status__in=['interested', 'applied'])),
                offers=Count('id', filter=Q(status='offer')),
            )
            .order_by('month')
        )
        trend = []
        seen = set()
        for row in month_counts:
            month_key = row['month'].strftime('%Y-%m') if row['month'] else ''
            if month_key in seen:
                continue
            seen.add(month_key)
            applied = row['applied'] or 0
            responded = row['responded'] or 0
            offers = row['offers'] or 0
            trend.append({
                'month': month_key + '-01',  # normalize to first of month ISO
                'response_rate': round((responded / applied * 100), 2) if applied else 0,
                'offer_rate': round((offers / applied * 100), 2) if applied else 0,
                'total': row['total'] or 0,
            })
        return trend

    def analyze_interview_conversion(self):
        """Estimate match-based conversion chances for in-progress interviews."""
        chances = []
        prediction = self.predict_success()
        base_score = prediction['score']
        stage_fields = ['phone_screen', 'interview', 'offer']
        jobs = self.applications.filter(status__in=stage_fields)
        for job in jobs:
            match = getattr(job, 'match_percentage', None)
            if match is None:
                match = getattr(job, 'match_score', None) or 0
            chance = max(15, min(80, int((match or 0) * 0.6 + base_score * 0.15)))
            chances.append({
                'job_id': job.id,
                'status': job.status,
                'match': match,
                'chance': chance,
                'title': getattr(job, 'title', 'Job'),
            })
        return chances

    def forecast_timeline(self, success_trend):
        """Estimate weeks to next offer from recent offer rates."""
        offer_rates = [row.get('offer_rate') or 0 for row in success_trend]
        avg_offer = sum(offer_rates) / len(offer_rates) if offer_rates else 0
        weeks = max(4, int(100 / max(avg_offer, 5)))
        return {
            'weeks_to_offer': weeks,
            'confidence': 'medium' if avg_offer > 0 else 'low',
        }

    def forecast_salary(self):
        offers = self.applications.filter(status='offer')
        salary_vals = []
        for job in offers:
            lower = getattr(job, 'salary_lower', None)
            upper = getattr(job, 'salary_upper', None)
            if lower:
                salary_vals.append(lower)
            elif upper:
                salary_vals.append(upper)
        if not salary_vals:
            return None
        avg_salary = sum(salary_vals) / len(salary_vals)
        return {
            'salary_target': round(avg_salary, 0),
            'message': 'Based on recent offers and market data',
        }

    def prediction_accuracy_trend(self, success_trend, predicted):
        trend = []
        for row in success_trend:
            offer = row.get('offer_rate') or 0
            error = abs(predicted['score'] - offer) / 100
            trend.append({
                'month': row.get('month', ''),
                'error': round(error * 100, 2),
                'offer_rate': offer,
            })
        return trend

    def scenario_planning(self):
        """Generate conservative/best-case scenario narratives."""
        predicted = self.predict_success()
        score = predicted['score']
        scenarios = []
        scenarios.append({
            'title': 'Current trajectory',
            'score': score,
            'description': f"Maintaining current pace gives ~{score}% predicted success.",
        })
        improved = min(100, score + 8)
        scenarios.append({
            'title': 'Optimized prep',
            'score': improved,
            'description': 'Focus on practice + industry fit to push the score higher.',
        })
        conservative = max(10, score - 8)
        scenarios.append({
            'title': 'Conservative pace',
            'score': conservative,
            'description': 'If you slow down and focus, expect around this level.',
        })
        return scenarios

    def analyze_pattern_factors(self):
        """Summarize top personal factors."""
        factors = {}
        industries = self.analyze_by_industry()
        if industries:
            factors['best_industries'] = industries[:2]

        timing = self.analyze_timing_patterns()
        if timing:
            factors['best_timing'] = {
                'day': timing.get('best_day'),
                'time': timing.get('best_time'),
            }

        key_skills = self.analyze_keyword_signals()
        if key_skills:
            factors['key_skills'] = key_skills[:5]
        return factors

    def predict_success(self):
        """
        Conservative heuristic score curved to 0-100 (original 0-80)
        based on offer rate, industry fit, and prep uplift.
        """
        overall = self.get_overall_metrics()
        base = min((overall.get('offer_rate') or 0) * 1.2, 65)

        boost = 0
        drivers = []

        industries = self.analyze_by_industry()
        if industries:
            top = industries[0]
            boost += min((top.get('offer_rate') or 0) * 0.1, 10)
            drivers.append(f"Strong results in {top['industry']} ({top['offer_rate']}% offer rate)")

        prep = self.analyze_prep_correlations()
        if prep:
            uplift = prep[0].get('uplift', 0) or 0
            boost += min(max(uplift, 0) * 50, 5)
            drivers.append(f"Prep uplift: +{round(uplift * 100)}% interview rate")

        score_0_80 = max(10, min(80, round(base + boost)))
        # Curve to 0-100 by simple multiplier as requested
        score = min(100, round(score_0_80 * 1.25))
        if not drivers:
            drivers.append("Based on recent offer/interview history")

        return {
            'score': score,
            'drivers': drivers[:3],
            'caveats': ["Heuristic only; not a guarantee"],
        }

    def get_pattern_recommendations(self, factors):
        """Return up to 3 pattern-based recommendations.

        Attempts Gemini AI generation if configured; falls back to deterministic rules.
        AI response expected as JSON array of objects: [{title, body, type}].
        """
        api_key = getattr(__import__('django.conf').conf.settings, 'GEMINI_API_KEY', '')
        # Skip AI when running tests for determinism
        if api_key and not os.getenv('PYTEST_CURRENT_TEST'):
            try:
                prompt = self._build_recommendations_prompt(factors)
                model = 'gemini-1.5-flash-latest'
                url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
                payload = {
                    'contents': [{'parts': [{'text': prompt}]}],
                    'generationConfig': {
                        'temperature': 0.35,
                        'topK': 40,
                        'topP': 0.9,
                        'maxOutputTokens': 2048,
                        'responseMimeType': 'application/json'
                    }
                }
                resp = requests.post(url, json=payload, timeout=25)
                resp.raise_for_status()
                data = resp.json()
                if data.get('candidates'):
                    content = data['candidates'][0]['content']['parts'][0]['text'].strip()
                    if content.startswith('```json'):
                        content = content[7:]
                    if content.startswith('```'):
                        content = content[3:]
                    if content.endswith('```'):
                        content = content[:-3]
                    parsed = json.loads(content)
                    # Accept either {'recommendations': [...]} or list directly
                    if isinstance(parsed, dict) and 'recommendations' in parsed:
                        rec_list = parsed['recommendations']
                    else:
                        rec_list = parsed
                    cleaned = []
                    if isinstance(rec_list, list):
                        for r in rec_list[:3]:
                            if isinstance(r, dict) and r.get('title') and r.get('body'):
                                cleaned.append({
                                    'title': r['title'][:120],
                                    'body': r['body'][:500],
                                    'type': (r.get('type') or 'general')[:30],
                                })
                    if cleaned:
                        return cleaned
            except Exception as e:
                logger.warning(f"AI pattern recommendations failed; falling back to rules: {e}")

        # Deterministic fallback
        recs = []
        best_inds = factors.get('best_industries') or []
        if best_inds:
            top = best_inds[0]
            recs.append({
                'title': 'Double down on high-yield industry',
                'body': f"Focus more applications in {top['industry']} where your offer rate is {top['offer_rate']}%.",
                'type': 'industry',
            })
        key_sk = factors.get('key_skills') or []
        if key_sk:
            names = ', '.join(ks['keyword'] for ks in key_sk[:3])
            recs.append({
                'title': 'Lead with strongest skills',
                'body': f"Highlight {names} in your resume and outreach; they appear in your successful outcomes.",
                'type': 'skills',
            })
        timing = factors.get('best_timing') or {}
        day = timing.get('day')
        if isinstance(day, dict):
            day = day.get('day')
        if day:
            recs.append({
                'title': 'Apply at your best time',
                'body': f"Batch applications on {day} when possible to mirror your best results.",
                'type': 'timing',
            })
        if not recs:
            recs.append({
                'title': 'Stay consistent',
                'body': 'Maintain steady applications and iterate on what worked in past offers.',
                'type': 'general',
            })
        return recs[:3]

    def get_prediction_recommendations(self, factors, predicted):
        api_key = getattr(__import__('django.conf').conf.settings, 'GEMINI_API_KEY', '')
        if api_key and not os.getenv('PYTEST_CURRENT_TEST'):
            try:
                prompt = self._build_prediction_prompt(factors, predicted)
                model = 'gemini-1.5-flash-latest'
                url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
                payload = {
                    'contents': [{'parts': [{'text': prompt}]}],
                    'generationConfig': {
                        'temperature': 0.2,
                        'topK': 40,
                        'topP': 0.95,
                        'maxOutputTokens': 1024,
                        'responseMimeType': 'text/plain'
                    }
                }
                service = get_or_create_service(SERVICE_GEMINI, 'Google Gemini AI')
                with track_api_call(service, endpoint=f'/models/{model}:generateContent', method='POST'):
                    resp = requests.post(url, json=payload, timeout=25)
                    resp.raise_for_status()
                data = resp.json()
                text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                sentences = [s.strip() for s in text.strip().splitlines() if s.strip()]
                if not sentences:
                    sentences = [s.strip() for s in text.replace('\n', ' ').split('.') if s.strip()]
                # ensure two sentences per recommendation
                formatted = []
                for sent in sentences:
                    if len(sent.split('.')) > 1:
                        formatted.append(sent.replace('\n', ' ').strip())
                    else:
                        formatted.append(sent.strip())
                    if len(formatted) >= 3:
                        break
                return formatted[:3]
            except Exception as e:
                logger.warning(f'Prediction recommendations via Gemini failed: {e}')
        # fallback deterministic sentences
        industry = (factors.get('best_industries') or [{}])[0].get('industry')
        lines = []
        if industry:
            lines.append(f"Lean into {industry} roles where your offer rate is already strong—tailor applications there first.")
        key_skills = (factors.get('key_skills') or [])[:2]
        if key_skills:
            skill_line = ', '.join(ks['keyword'] for ks in key_skills)
            lines.append(f"Highlight {skill_line} at the top of your resume to emphasize what has proven success.")
        lines.append("Apply when your best day/time aligns with new openings and treat each practice session as preparation for that target.")
        return lines[:3]

    def _build_recommendations_prompt(self, factors):
        predicted = self.predict_success()
        best_inds = factors.get('best_industries') or []
        key_skills = factors.get('key_skills') or []
        timing = factors.get('best_timing') or {}
        inds_text = ', '.join(f"{i['industry']} ({i['offer_rate']}%)" for i in best_inds) or 'None'
        skills_text = ', '.join(s.get('keyword') for s in key_skills) or 'None'
        day = timing.get('day')
        if isinstance(day, dict):
            day = day.get('day')
        day_text = day or 'None'
        return (
            "You are a career coach. Based on the candidate's application pattern factors and predicted success, "
            "generate exactly 3 concise, actionable recommendations as a JSON array only (no wrapper object). "
            "Each object must have keys: title, body, type (one of industry, skills, timing, general). Avoid duplication. "
            f"Predicted Score: {predicted['score']} (drivers: {', '.join(predicted['drivers'])}). "
            f"Best Industries: {inds_text}. Key Skills: {skills_text}. Best Application Day: {day_text}. "
            "Focus on actions the candidate can take this week."
        )
    
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
        pattern_factors = self.analyze_pattern_factors()
        success_trend = self.analyze_success_trend()
        predicted = self.predict_success()
        return {
            'overall_metrics': self.get_overall_metrics(),
            'by_industry': self.analyze_by_industry(),
            'by_company_size': self.analyze_by_company_size(),
            'by_application_source': self.analyze_by_application_source(),
            'by_application_method': self.analyze_by_application_method(),
            'customization_impact': self.analyze_customization_impact(),
            'timing_patterns': self.analyze_timing_patterns(),
            'apply_response_patterns': self.analyze_apply_and_response_speed(),
            'prep_correlations': self.analyze_prep_correlations(),
            'practice_history': self.analyze_practice_history(),
            'industry_success': self.analyze_industry_success(),
            'keyword_signals': self.analyze_keyword_signals(),
            'recommendations': self.get_recommendations(),
            'pattern_factors': pattern_factors,
            'predicted_success': predicted,
            'pattern_recommendations': self.get_pattern_recommendations(pattern_factors),
            'prediction_recommendations': self.get_prediction_recommendations(pattern_factors, predicted),
            'success_trend': success_trend,
            'timeline_forecast': self.forecast_timeline(success_trend),
            'salary_forecast': self.forecast_salary(),
            'prediction_accuracy': self.prediction_accuracy_trend(success_trend, predicted),
            'scenario_planning': self.scenario_planning(),
            'interview_conversion': self.analyze_interview_conversion(),
        }
