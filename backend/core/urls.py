"""
URL configuration for core app authentication endpoints.
"""
from django.urls import path
from core import views

app_name = 'core'

urlpatterns = [
    # Authentication endpoints
    path('auth/register', views.register_user, name='register'),
    path('auth/login', views.login_user, name='login'),
    path('auth/verify-token', views.verify_token, name='verify-token'),
    path('auth/oauth/link', views.oauth_link_via_provider, name='oauth-link-provider'),
    # Back-compat route expected by tests
    path('auth/oauth/github', views.oauth_github, name='oauth-github'),
    path('auth/logout', views.logout_user, name='logout'),
    path('users/me', views.get_current_user, name='current-user'),
    path('users/me/delete-request', views.request_account_deletion, name='request-account-deletion'),
    path('users/profile', views.user_profile, name='user-profile'),
    path('users/<str:user_id>/profile', views.user_profile, name='user-profile-detail'),
    

    # Employment (Work Experience) endpoints
    path('profile/employment', views.employment_list_create, name='employment-list-create'),
    path('profile/employment/<int:pk>', views.employment_detail, name='employment-detail'),

    # Skills endpoints
    path('profile/skills', views.skills_list_create, name='skills-list-create'),
    path('profile/skills/<int:pk>', views.skills_detail, name='skills-detail'),

    # Profile endpoints (UC-021)
    path('profile/basic', views.update_basic_profile, name='basic-profile'),

    # Education endpoints
    path('profile/education', views.education_list_create, name='education-list-create'),
    path('profile/education/<int:education_id>', views.education_detail, name='education-detail'),

    # Projects endpoints
    path('profile/projects', views.projects_list_create, name='projects-list-create'),
    path('profile/projects/<int:pk>', views.projects_detail, name='projects-detail'),

    # Profile Picture endpoints (UC-022)
    path('profile/picture', views.get_profile_picture, name='get-profile-picture'),
    path('profile/picture/upload', views.upload_profile_picture, name='upload-profile-picture'),
    path('profile/picture/delete', views.delete_profile_picture, name='delete-profile-picture'),
    
    # Skills endpoints (UC-026)
    path('skills', views.skills_list_create, name='skills-list-create'),
    path('skills/<int:skill_id>', views.skill_detail, name='skill-detail'),
    path('skills/autocomplete', views.skills_autocomplete, name='skills-autocomplete'),
    path('skills/categories', views.skills_categories, name='skills-categories'),
    
    # Skills Category Organization endpoints (UC-027)
    path('skills/by-category', views.skills_by_category, name='skills-by-category'),
    path('skills/reorder', views.skills_reorder, name='skills-reorder'),
    path('skills/bulk-reorder', views.skills_bulk_reorder, name='skills-bulk-reorder'),
    path('skills/export', views.skills_export, name='skills-export'),

    # Education endpoints
    path('education/levels', views.education_levels, name='education-levels'),
    path('education', views.education_list_create, name='education-list-create'),
    path('education/<int:education_id>', views.education_detail, name='education-detail'),

    # Certifications endpoints (UC-030)
    path('certifications/categories', views.certification_categories, name='certification-categories'),
    path('certifications/orgs', views.certification_org_search, name='certification-org-search'),
    path('certifications', views.certifications_list_create, name='certifications-list-create'),
    path('certifications/<int:certification_id>', views.certification_detail, name='certification-detail'),

    # Projects endpoints (UC-031)
    path('projects', views.projects_list_create, name='projects-list-create'),
    path('projects/<int:project_id>', views.project_detail, name='project-detail'),
    path('projects/<int:project_id>/media', views.project_media_upload, name='project-media-upload'),
    path('projects/<int:project_id>/media/<int:media_id>', views.project_media_delete, name='project-media-delete'),

    # Employment History endpoints (UC-023, UC-024, UC-025)
    path('employment', views.employment_list_create, name='employment-list-create'),
    path('employment/<int:employment_id>', views.employment_detail, name='employment-detail'),
    path('employment/timeline', views.employment_timeline, name='employment-timeline'),

    # Account Deletion confirmation (email link landing)
    path('auth/delete/confirm/<str:token>', views.confirm_account_deletion, name='confirm-account-deletion'),

    # UC-036: Jobs endpoints
    path('jobs', views.jobs_list_create, name='jobs-list-create'),
    path('jobs/<int:job_id>', views.job_detail, name='job-detail'),
    path('jobs/stats', views.jobs_stats, name='jobs-stats'),
    path('jobs/bulk-status', views.jobs_bulk_status, name='jobs-bulk-status'),
    path('jobs/bulk-deadline', views.jobs_bulk_deadline, name='jobs-bulk-deadline'),
    path('jobs/upcoming-deadlines', views.jobs_upcoming_deadlines, name='jobs-upcoming-deadlines'),
    # SCRUM-39: Job import from URL
    path('jobs/import-from-url', views.import_job_from_url, name='import-job-from-url'),
]
