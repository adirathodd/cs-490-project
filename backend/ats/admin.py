from django.contrib import admin

from . import models


@admin.register(models.CandidateProfile)
class CandidateProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "headline", "location", "job_search_status")
    search_fields = ("user__username", "user__email", "headline", "location")
    list_filter = ("job_search_status",)


@admin.register(models.Skill)
class SkillAdmin(admin.ModelAdmin):
    search_fields = ("name",)


@admin.register(models.CandidateSkill)
class CandidateSkillAdmin(admin.ModelAdmin):
    list_display = ("profile", "skill", "proficiency", "years_used")
    list_filter = ("proficiency",)
    search_fields = ("profile__user__username", "skill__name")


@admin.register(models.CandidateExperience)
class CandidateExperienceAdmin(admin.ModelAdmin):
    list_display = ("profile", "title", "company", "start_date", "end_date", "is_current")
    list_filter = ("is_current", "company")
    search_fields = ("profile__user__username", "title", "company")


@admin.register(models.CandidatePreference)
class CandidatePreferenceAdmin(admin.ModelAdmin):
    list_display = ("profile", "desired_role", "desired_location", "remote")
    list_filter = ("remote",)
    search_fields = ("profile__user__username", "desired_role", "desired_location")


@admin.register(models.JobOpportunity)
class JobOpportunityAdmin(admin.ModelAdmin):
    list_display = ("title", "company", "location", "source", "posted_at")
    search_fields = ("title", "company", "location", "source")
    list_filter = ("source", "posted_at")


@admin.register(models.Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("profile", "job", "status", "applied_at", "last_updated")
    list_filter = ("status",)
    search_fields = ("profile__user__username", "job__title", "job__company")


@admin.register(models.ApplicationStatusHistory)
class ApplicationStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("application", "from_status", "to_status", "changed_at")
    list_filter = ("from_status", "to_status")
    search_fields = ("application__profile__user__username", "application__job__title")


@admin.register(models.Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("profile", "name", "document_type", "version", "uploaded_at")
    list_filter = ("document_type",)
    search_fields = ("profile__user__username", "name")


@admin.register(models.DocumentUsage)
class DocumentUsageAdmin(admin.ModelAdmin):
    list_display = ("document", "application", "used_at")
    search_fields = ("document__name", "application__profile__user__username")


@admin.register(models.AnalyticsSnapshot)
class AnalyticsSnapshotAdmin(admin.ModelAdmin):
    list_display = ("profile", "metric", "value", "period_start", "period_end")
    search_fields = ("profile__user__username", "metric")
    list_filter = ("metric", "period_end")

