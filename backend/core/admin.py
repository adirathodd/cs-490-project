from django.contrib import admin
from .models import (
    # Profile models
    CandidateProfile, Skill, CandidateSkill, WorkExperience, Education,
    Certification, Achievement,
    # Company & Job models
    Company, CompanyResearch, JobOpportunity, JobRequirement, SalaryData,
    # Document models
    Document,
    # Application models
    Application, ApplicationStage, Interview, InterviewPrepSession, MockInterview,
    # Interview prep
    InterviewQuestion,
    # Network models
    Contact, Referral, TeamMember, SharedNote,
    # Analytics models
    UserActivity, PerformanceMetric, SuccessPattern, MarketIntelligence,
    # AI & Automation
    AIGenerationLog, AutomationRule,
    # Notifications
    Reminder, Notification,
)


# Profile models
@admin.register(CandidateProfile)
class CandidateProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'headline', 'location', 'years_experience', 'visibility']
    list_filter = ['visibility', 'years_experience']
    search_fields = ['user__email', 'user__username', 'headline', 'location']


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ['name', 'category']
    list_filter = ['category']
    search_fields = ['name', 'category']


@admin.register(CandidateSkill)
class CandidateSkillAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'skill', 'level', 'years']
    list_filter = ['level']
    search_fields = ['candidate__user__username', 'skill__name']


@admin.register(WorkExperience)
class WorkExperienceAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'job_title', 'company_name', 'start_date', 'end_date', 'is_current']
    list_filter = ['is_current', 'start_date']
    search_fields = ['candidate__user__username', 'job_title', 'company_name']


@admin.register(Education)
class EducationAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'degree_type', 'field_of_study', 'institution', 'end_date']
    list_filter = ['degree_type']
    search_fields = ['candidate__user__username', 'institution', 'field_of_study']


@admin.register(Certification)
class CertificationAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'name', 'issuing_organization', 'issue_date', 'expiry_date']
    list_filter = ['issue_date']
    search_fields = ['candidate__user__username', 'name', 'issuing_organization']


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'type', 'title', 'date']
    list_filter = ['type', 'date']
    search_fields = ['candidate__user__username', 'title']


# Company & Job models
@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ['name', 'domain', 'industry', 'size', 'hq_location']
    list_filter = ['industry', 'size']
    search_fields = ['name', 'domain', 'industry']


@admin.register(CompanyResearch)
class CompanyResearchAdmin(admin.ModelAdmin):
    list_display = ['company', 'employee_count', 'glassdoor_rating', 'last_updated']
    search_fields = ['company__name']


@admin.register(JobOpportunity)
class JobOpportunityAdmin(admin.ModelAdmin):
    list_display = ['title', 'company', 'location', 'employment_type', 'seniority', 'active', 'posted_at']
    list_filter = ['employment_type', 'active', 'seniority', 'posted_at']
    search_fields = ['title', 'company__name', 'location']


@admin.register(JobRequirement)
class JobRequirementAdmin(admin.ModelAdmin):
    list_display = ['job', 'category', 'is_required', 'priority']
    list_filter = ['category', 'is_required']
    search_fields = ['job__title', 'description']


@admin.register(SalaryData)
class SalaryDataAdmin(admin.ModelAdmin):
    list_display = ['job', 'min_salary', 'max_salary', 'currency', 'salary_period']
    list_filter = ['currency', 'salary_period']
    search_fields = ['job__title']


# Document models
@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'doc_type', 'version', 'generated_by_ai', 'created_at']
    list_filter = ['doc_type', 'generated_by_ai', 'created_at']
    search_fields = ['candidate__user__username']


# Application models
@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'job', 'status', 'applied_via', 'created_at', 'updated_at']
    list_filter = ['status', 'created_at', 'updated_at']
    search_fields = ['candidate__user__username', 'job__title', 'job__company__name']


@admin.register(ApplicationStage)
class ApplicationStageAdmin(admin.ModelAdmin):
    list_display = ['application', 'stage', 'at']
    list_filter = ['stage', 'at']
    search_fields = ['application__job__title']


@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    list_display = ['application', 'type', 'scheduled_start', 'scheduled_end', 'result']
    list_filter = ['type', 'result', 'scheduled_start']
    search_fields = ['application__job__title', 'application__candidate__user__username']


@admin.register(InterviewQuestion)
class InterviewQuestionAdmin(admin.ModelAdmin):
    list_display = ['type', 'category', 'difficulty', 'question_text']
    list_filter = ['type', 'category', 'difficulty']
    search_fields = ['question_text', 'category']


@admin.register(InterviewPrepSession)
class InterviewPrepSessionAdmin(admin.ModelAdmin):
    list_display = ['application', 'session_date', 'duration_minutes', 'confidence_level']
    list_filter = ['session_date', 'confidence_level']
    search_fields = ['application__job__title']


@admin.register(MockInterview)
class MockInterviewAdmin(admin.ModelAdmin):
    list_display = ['prep_session', 'score', 'created_at']
    list_filter = ['score', 'created_at']


# Network models
@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'name', 'relationship_type', 'company', 'job_title', 'last_contacted']
    list_filter = ['relationship_type', 'last_contacted']
    search_fields = ['candidate__user__username', 'name', 'email', 'company__name']


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ['application', 'contact', 'status', 'requested_date', 'completed_date']
    list_filter = ['status', 'requested_date']
    search_fields = ['application__job__title', 'contact__name']


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'user', 'role', 'permission_level', 'is_active']
    list_filter = ['role', 'permission_level', 'is_active']
    search_fields = ['candidate__user__username', 'user__username']


@admin.register(SharedNote)
class SharedNoteAdmin(admin.ModelAdmin):
    list_display = ['application', 'author', 'is_private', 'created_at']
    list_filter = ['is_private', 'created_at']
    search_fields = ['application__job__title', 'author__username', 'content']


# Analytics models
@admin.register(UserActivity)
class UserActivityAdmin(admin.ModelAdmin):
    list_display = ['user', 'action_type', 'resource_type', 'timestamp']
    list_filter = ['action_type', 'resource_type', 'timestamp']
    search_fields = ['user__username', 'action_type']


@admin.register(PerformanceMetric)
class PerformanceMetricAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'metric_date', 'total_applications', 'phone_screens', 'offers_received']
    list_filter = ['metric_date']
    search_fields = ['candidate__user__username']


@admin.register(SuccessPattern)
class SuccessPatternAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'pattern_type', 'pattern_value', 'success_rate', 'sample_size']
    list_filter = ['pattern_type', 'identified_at']
    search_fields = ['candidate__user__username', 'pattern_value']


@admin.register(MarketIntelligence)
class MarketIntelligenceAdmin(admin.ModelAdmin):
    list_display = ['job_title', 'location', 'experience_level', 'median_salary', 'demand_score']
    list_filter = ['experience_level', 'industry', 'growth_trend']
    search_fields = ['job_title', 'location', 'industry']


# AI & Automation
@admin.register(AIGenerationLog)
class AIGenerationLogAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'content_type', 'model_version', 'user_rating', 'created_at']
    list_filter = ['content_type', 'user_edited', 'created_at']
    search_fields = ['candidate__user__username', 'content_type']


@admin.register(AutomationRule)
class AutomationRuleAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'rule_name', 'trigger_event', 'action_type', 'is_active', 'times_triggered']
    list_filter = ['trigger_event', 'action_type', 'is_active']
    search_fields = ['candidate__user__username', 'rule_name']


# Notifications
@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'reminder_type', 'title', 'due_date', 'is_completed', 'priority']
    list_filter = ['reminder_type', 'is_completed', 'priority', 'due_date']
    search_fields = ['candidate__user__username', 'title']


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'notification_type', 'title', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
    search_fields = ['user__username', 'title', 'message']
