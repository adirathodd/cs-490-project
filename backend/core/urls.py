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
    
    # Profile endpoints (UC-021)
    path('profile/basic', views.update_basic_profile, name='basic-profile'),
    
    # Profile Picture endpoints (UC-022)
    path('profile/picture', views.get_profile_picture, name='get-profile-picture'),
    path('profile/picture/upload', views.upload_profile_picture, name='upload-profile-picture'),
    path('profile/picture/delete', views.delete_profile_picture, name='delete-profile-picture'),
]
