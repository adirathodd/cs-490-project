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
    path('users/me', views.get_current_user, name='current-user'),
    path('users/me/delete-request', views.request_account_deletion, name='request-account-deletion'),
    path('users/profile', views.user_profile, name='user-profile'),
    path('users/<str:user_id>/profile', views.user_profile, name='user-profile-detail'),
    
    # Profile endpoints (UC-021)
    path('profile/basic', views.update_basic_profile, name='basic-profile'),
    
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

    # Account Deletion confirmation (email link landing)
    path('auth/delete/confirm/<str:token>', views.confirm_account_deletion, name='confirm-account-deletion'),
]
