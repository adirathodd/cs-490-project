#!/usr/bin/env python
"""
UC-117: Setup initial API service configurations
Run this script to create the API service records for monitoring.
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import APIService

def setup_api_services():
    """Create initial API service configurations."""
    services = [
        {
            'name': 'gemini',
            'service_type': 'gemini',
            'description': 'Google Gemini AI for cover letters, job insights, and technical prep',
            'requests_per_minute': 60,
            'requests_per_hour': 1000,
            'requests_per_day': 10000,
            'is_active': True
        },
        {
            'name': 'linkedin',
            'service_type': 'linkedin',
            'description': 'LinkedIn API for profile sync and networking',
            'requests_per_minute': 10,
            'requests_per_hour': 100,
            'requests_per_day': 1000,
            'is_active': True
        },
        {
            'name': 'gmail',
            'service_type': 'gmail',
            'description': 'Gmail API for email scanning and job tracking',
            'requests_per_minute': 25,
            'requests_per_hour': 250,
            'requests_per_day': 2000,
            'is_active': True
        }
    ]

    created_count = 0
    updated_count = 0
    
    for service_data in services:
        service, created = APIService.objects.get_or_create(
            service_type=service_data['service_type'],
            defaults=service_data
        )
        if created:
            created_count += 1
            print(f"✅ Created service: {service.name}")
        else:
            # Update existing service with new data
            for key, value in service_data.items():
                setattr(service, key, value)
            service.save()
            updated_count += 1
            print(f"ℹ️  Updated service: {service.name}")

    print(f"\n🎉 Setup complete!")
    print(f"   - {created_count} new services created")
    print(f"   - {updated_count} services updated")
    print(f"   - Total services: {APIService.objects.count()}")

if __name__ == '__main__':
    setup_api_services()
