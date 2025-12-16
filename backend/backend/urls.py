"""
URL configuration for backend project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


def trigger_error(request):
    """Sentry debug endpoint - triggers a test error to verify Sentry is working."""
    division_by_zero = 1 / 0


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('sentry-debug/', trigger_error),  # Test Sentry: visit /sentry-debug/ to trigger error
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
