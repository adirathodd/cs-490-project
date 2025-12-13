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
    InterviewSuccessPrediction,
    # Interview prep
    InterviewQuestion,
    # Network models
    Contact, Referral, TeamMember, TeamAccount, TeamMembership, TeamInvitation, TeamCandidateAccess, TeamMessage,
    SupporterInvite, SupporterEncouragement, SupporterChatMessage, SharedNote, MentorshipRequest,
    MentorshipSharingPreference, MentorshipSharedApplication, MentorshipGoal,
    MentorshipMessage,
    # Analytics models
    UserActivity, PerformanceMetric, SuccessPattern, MarketIntelligence,
    # AI & Automation
    AIGenerationLog,
    # UC-069: Automation models
    ApplicationAutomationRule, ApplicationPackage,
    # Notifications
    Reminder, Notification,
    # Projects
    Project, ProjectMedia,
    # UC-095: Reference Management models
    ProfessionalReference, ReferenceRequest, ReferenceTemplate, 
    ReferenceAppreciation, ReferencePortfolio,
    # UC-126: Interview Response Library models
    InterviewResponseLibrary, ResponseVersion,

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


# Projects
class ProjectMediaInline(admin.TabularInline):
    model = ProjectMedia
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'name', 'status', 'start_date', 'end_date', 'team_size']
    list_filter = ['status', 'industry', 'category']
    search_fields = ['candidate__user__username', 'name', 'role', 'industry', 'category']
    inlines = [ProjectMediaInline]


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


@admin.register(InterviewSuccessPrediction)
class InterviewSuccessPredictionAdmin(admin.ModelAdmin):
    list_display = ['interview', 'candidate', 'predicted_probability', 'confidence_score', 'actual_outcome', 'is_latest']
    list_filter = ['is_latest', 'actual_outcome']
    search_fields = ['candidate__user__username', 'interview__job__title', 'interview__job__company_name']


# Network models
@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    # Adapted for new Contact model (owner-based)
    list_display = ['owner', 'display_name', 'relationship_type', 'company', 'title', 'last_interaction']
    list_filter = ['relationship_type', 'last_interaction']
    search_fields = ['owner__username', 'display_name', 'email', 'company__name']


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


@admin.register(TeamAccount)
class TeamAccountAdmin(admin.ModelAdmin):
    list_display = ['name', 'owner', 'subscription_plan', 'subscription_status', 'seat_limit', 'created_at']
    list_filter = ['subscription_plan', 'subscription_status']
    search_fields = ['name', 'owner__username', 'billing_email']


@admin.register(TeamMembership)
class TeamMembershipAdmin(admin.ModelAdmin):
    list_display = ['team', 'user', 'role', 'permission_level', 'is_active', 'candidate_profile']
    list_filter = ['role', 'permission_level', 'is_active']
    search_fields = ['team__name', 'user__username', 'user__email']


@admin.register(TeamInvitation)
class TeamInvitationAdmin(admin.ModelAdmin):
    list_display = ['team', 'email', 'role', 'permission_level', 'status', 'expires_at', 'accepted_at']
    list_filter = ['role', 'permission_level', 'status']
    search_fields = ['team__name', 'email', 'token']


@admin.register(TeamCandidateAccess)
class TeamCandidateAccessAdmin(admin.ModelAdmin):
    list_display = ['team', 'candidate', 'granted_to', 'permission_level', 'can_view_profile', 'can_view_progress', 'can_edit_goals']
    list_filter = ['permission_level', 'can_view_profile', 'can_view_progress', 'can_edit_goals']
    search_fields = ['team__name', 'candidate__user__email', 'granted_to__user__email']


@admin.register(TeamMessage)
class TeamMessageAdmin(admin.ModelAdmin):
    list_display = ['team', 'author', 'message_type', 'pinned', 'created_at']
    list_filter = ['message_type', 'pinned']
    search_fields = ['team__name', 'author__username', 'message']


@admin.register(MentorshipRequest)
class MentorshipRequestAdmin(admin.ModelAdmin):
    list_display = ['requester', 'receiver', 'role_for_requester', 'status', 'created_at']
    list_filter = ['role_for_requester', 'status', 'created_at']
    search_fields = [
        'requester__user__username',
        'receiver__user__username',
        'requester__user__email',
        'receiver__user__email',
    ]


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


@admin.register(ApplicationAutomationRule)
class ApplicationAutomationRuleAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'name', 'trigger_type', 'action_type', 'is_active', 'trigger_count']
    list_filter = ['trigger_type', 'action_type', 'is_active']
    search_fields = ['candidate__user__username', 'name', 'description']
    readonly_fields = ['trigger_count', 'last_triggered_at', 'created_at', 'updated_at']


# Notifications
@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    # Adapt to Reminder model fields
    list_display = ['owner', 'contact', 'message', 'due_date', 'completed']
    list_filter = ['completed', 'due_date']
    search_fields = ['owner__username', 'contact__display_name', 'message']


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'notification_type', 'title', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
    search_fields = ['user__username', 'title', 'message']


# 
# 
# =
# UC-069: AUTOMATION ADMIN CONFIGURATIONS
# 
# 
# =

@admin.register(ApplicationPackage)
class ApplicationPackageAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'job', 'status', 'generation_method', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['candidate__user__username', 'job__title', 'job__company_name']
    readonly_fields = ['created_at', 'updated_at']


# 

# 
# 
# =
# UC-095: REFERENCE MANAGEMENT ADMIN CONFIGURATIONS
# 
# 
# =

@admin.register(ProfessionalReference)
class ProfessionalReferenceAdmin(admin.ModelAdmin):
    list_display = ['name', 'title', 'company', 'user', 'relationship_type', 'availability_status', 'times_used', 'is_active']
    list_filter = ['relationship_type', 'availability_status', 'is_active', 'created_at']
    search_fields = ['name', 'title', 'company', 'email', 'user__username', 'user__email']
    readonly_fields = ['id', 'created_at', 'updated_at', 'times_used']
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'user', 'name', 'title', 'company', 'email', 'phone', 'linkedin_url')
        }),
        ('Relationship', {
            'fields': ('relationship_type', 'relationship_description', 'years_known')
        }),
        ('Availability', {
            'fields': ('availability_status', 'permission_granted_date', 'last_used_date', 'preferred_contact_method')
        }),
        ('Details', {
            'fields': ('best_for_roles', 'best_for_industries', 'key_strengths_to_highlight', 
                      'projects_worked_together', 'talking_points')
        }),
        ('Maintenance', {
            'fields': ('last_contacted_date', 'next_check_in_date', 'notes')
        }),
        ('Tracking', {
            'fields': ('times_used', 'is_active', 'created_at', 'updated_at')
        }),
    )


@admin.register(ReferenceRequest)
class ReferenceRequestAdmin(admin.ModelAdmin):
    list_display = ['user', 'reference', 'company_name', 'position_title', 'request_status', 'due_date', 'created_at']
    list_filter = ['request_status', 'contributed_to_success', 'created_at']
    search_fields = ['user__username', 'reference__name', 'company_name', 'position_title']
    readonly_fields = ['id', 'created_at', 'updated_at']
    raw_id_fields = ['user', 'reference', 'application', 'job_opportunity']


@admin.register(ReferenceTemplate)
class ReferenceTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'template_type', 'is_default', 'times_used', 'created_at']
    list_filter = ['template_type', 'is_default', 'created_at']
    search_fields = ['name', 'user__username', 'content']
    readonly_fields = ['id', 'created_at', 'updated_at', 'times_used']


@admin.register(ReferenceAppreciation)
class ReferenceAppreciationAdmin(admin.ModelAdmin):
    list_display = ['user', 'reference', 'appreciation_type', 'date', 'created_at']
    list_filter = ['appreciation_type', 'date']
    search_fields = ['user__username', 'reference__name', 'description']
    readonly_fields = ['id', 'created_at']
    raw_id_fields = ['user', 'reference']


@admin.register(ReferencePortfolio)
class ReferencePortfolioAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'is_default', 'times_used', 'created_at']
    list_filter = ['is_default', 'created_at']
    search_fields = ['name', 'user__username', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at', 'times_used']
    filter_horizontal = ['references']




@admin.register(MentorshipSharingPreference)
class MentorshipSharingPreferenceAdmin(admin.ModelAdmin):
    list_display = ['team_member', 'share_profile_basics', 'share_skills', 'share_job_applications', 'updated_at']
    list_filter = ['share_profile_basics', 'share_skills', 'share_job_applications']
    search_fields = ['team_member__candidate__user__email', 'team_member__user__email']


@admin.register(MentorshipSharedApplication)
class MentorshipSharedApplicationAdmin(admin.ModelAdmin):
    list_display = ['team_member', 'job', 'include_documents', 'shared_at']
    list_filter = ['include_documents', 'shared_at']
    search_fields = ['team_member__candidate__user__email', 'job__title', 'job__company_name']


@admin.register(MentorshipGoal)
class MentorshipGoalAdmin(admin.ModelAdmin):
    list_display = ['team_member', 'goal_type', 'title', 'target_value', 'status', 'due_date', 'created_at']
    list_filter = ['goal_type', 'status']
    search_fields = [
        'team_member__candidate__user__email',
        'team_member__user__email',
        'title',
        'custom_skill_name',
    ]


@admin.register(MentorshipMessage)
class MentorshipMessageAdmin(admin.ModelAdmin):
    list_display = ['team_member', 'sender', 'short_message', 'created_at', 'is_read_by_mentor', 'is_read_by_mentee']
    list_filter = ['is_read_by_mentor', 'is_read_by_mentee', 'created_at']
    search_fields = [
        'team_member__candidate__user__email',
        'team_member__user__email',
        'sender__email',
        'message',
    ]

    def short_message(self, obj):
        text = obj.message or ''
        return text if len(text) <= 60 else f"{text[:57]}..."
    short_message.short_description = 'Message'


@admin.register(SupporterInvite)
class SupporterInviteAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'email', 'name', 'is_active', 'expires_at', 'accepted_at', 'last_access_at']
    list_filter = ['is_active']
    search_fields = ['email', 'candidate__user__email', 'candidate__user__username']


@admin.register(SupporterEncouragement)
class SupporterEncouragementAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'supporter', 'supporter_name', 'created_at']
    search_fields = ['supporter_name', 'supporter__email', 'candidate__user__email', 'message']


@admin.register(SupporterChatMessage)
class SupporterChatMessageAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'supporter', 'sender_role', 'sender_name', 'created_at']
    search_fields = ['sender_name', 'supporter__email', 'candidate__user__email', 'message']


# UC-117: API Monitoring Admin
from .models import APIService, APIUsageLog, APIQuotaUsage, APIError, APIAlert, APIWeeklyReport


@admin.register(APIService)
class APIServiceAdmin(admin.ModelAdmin):
    list_display = ['name', 'service_type', 'is_active', 'rate_limit_enabled', 
                   'requests_per_day', 'last_error_at']
    list_filter = ['service_type', 'is_active', 'rate_limit_enabled']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at', 'last_error_at']


@admin.register(APIUsageLog)
class APIUsageLogAdmin(admin.ModelAdmin):
    list_display = ['service', 'endpoint', 'method', 'request_at', 'response_time_ms', 
                   'status_code', 'success', 'user']
    list_filter = ['success', 'service', 'method', 'request_at']
    search_fields = ['endpoint', 'error_message', 'error_type']
    readonly_fields = ['request_at']
    date_hierarchy = 'request_at'


@admin.register(APIQuotaUsage)
class APIQuotaUsageAdmin(admin.ModelAdmin):
    list_display = ['service', 'period_type', 'period_start', 'total_requests', 
                   'quota_percentage_used', 'alert_level']
    list_filter = ['period_type', 'alert_level', 'service']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'period_start'


@admin.register(APIError)
class APIErrorAdmin(admin.ModelAdmin):
    list_display = ['service', 'error_type', 'endpoint', 'occurred_at', 'is_resolved', 
                   'retry_count', 'affected_users_count']
    list_filter = ['is_resolved', 'error_type', 'service', 'occurred_at']
    search_fields = ['error_message', 'error_type', 'endpoint']
    readonly_fields = ['occurred_at', 'resolved_at']
    date_hierarchy = 'occurred_at'


@admin.register(APIAlert)
class APIAlertAdmin(admin.ModelAdmin):
    list_display = ['service', 'alert_type', 'severity', 'triggered_at', 
                   'is_acknowledged', 'is_resolved', 'email_sent']
    list_filter = ['alert_type', 'severity', 'is_acknowledged', 'is_resolved', 'service']
    search_fields = ['message']
    readonly_fields = ['triggered_at', 'acknowledged_at', 'resolved_at', 'email_sent_at']
    date_hierarchy = 'triggered_at'


@admin.register(APIWeeklyReport)
class APIWeeklyReportAdmin(admin.ModelAdmin):
    list_display = ['week_start', 'week_end', 'total_requests', 'total_errors', 
                   'error_rate', 'total_alerts', 'email_sent', 'generated_at']
    list_filter = ['email_sent', 'week_start']
    readonly_fields = ['generated_at', 'email_sent_at']
    date_hierarchy = 'week_start'


# UC-126: Interview Response Library models
@admin.register(InterviewResponseLibrary)
class InterviewResponseLibraryAdmin(admin.ModelAdmin):
    list_display = ['user', 'question_type', 'question_text_short', 'times_used', 
                   'success_rate', 'led_to_offer', 'updated_at']
    list_filter = ['question_type', 'led_to_offer', 'led_to_next_round', 'created_at']
    search_fields = ['user__username', 'user__email', 'question_text', 'tags']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'
    
    def question_text_short(self, obj):
        return obj.question_text[:50] + '...' if len(obj.question_text) > 50 else obj.question_text
    question_text_short.short_description = 'Question'


@admin.register(ResponseVersion)
class ResponseVersionAdmin(admin.ModelAdmin):
    list_display = ['response_library', 'version_number', 'coaching_score', 'created_at']
    list_filter = ['created_at']
    search_fields = ['response_library__question_text', 'change_notes']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
