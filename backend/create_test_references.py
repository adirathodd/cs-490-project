import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from core.models import ProfessionalReference
from datetime import datetime, timedelta, date

User = get_user_model()
user = User.objects.first()
print(f'Creating references for: {user.email} (username: {user.username})')

# Create sample references with correct field names
ref1, created1 = ProfessionalReference.objects.get_or_create(
    user=user,
    email='sarah.johnson@techinnovations.com',
    defaults={
        'name': 'Dr. Sarah Johnson',
        'title': 'Senior Engineering Manager',
        'company': 'Tech Innovations Inc.',
        'phone': '+1-555-0101',
        'relationship_type': 'supervisor',
        'relationship_description': 'Reported directly to Sarah for 2 years on the platform engineering team',
        'years_known': 3,
        'availability_status': 'available',
        'permission_granted_date': date.today() - timedelta(days=30),
        'preferred_contact_method': 'email',
        'key_strengths_to_highlight': 'Technical leadership, mentoring junior developers, cross-team collaboration',
        'projects_worked_together': 'Led the cloud migration project and API redesign initiative',
        'notes': 'Very supportive reference, always responds quickly'
    }
)
status1 = 'Created' if created1 else 'Already exists'
print(f'{status1}: {ref1.name}')

ref2, created2 = ProfessionalReference.objects.get_or_create(
    user=user,
    email='m.chen@startupco.io',
    defaults={
        'name': 'Michael Chen',
        'title': 'Product Director',
        'company': 'StartupCo',
        'phone': '+1-555-0202',
        'relationship_type': 'colleague',
        'relationship_description': 'Collaborated closely on product development and go-to-market strategy',
        'years_known': 4,
        'availability_status': 'available',
        'permission_granted_date': date.today() - timedelta(days=60),
        'preferred_contact_method': 'either',
        'key_strengths_to_highlight': 'Product strategy, stakeholder management, data-driven decision making',
        'projects_worked_together': 'Launched 3 major product features together, including the analytics dashboard',
        'notes': 'Great for product-focused roles'
    }
)
status2 = 'Created' if created2 else 'Already exists'
print(f'{status2}: {ref2.name}')

ref3, created3 = ProfessionalReference.objects.get_or_create(
    user=user,
    email='e.rodriguez@stateuniversity.edu',
    defaults={
        'name': 'Prof. Emily Rodriguez',
        'title': 'Computer Science Professor',
        'company': 'State University',
        'relationship_type': 'professor',
        'relationship_description': 'Academic advisor and thesis supervisor',
        'years_known': 5,
        'availability_status': 'limited',
        'preferred_contact_method': 'email',
        'key_strengths_to_highlight': 'Research capabilities, theoretical knowledge, academic excellence',
        'projects_worked_together': "Master's thesis on distributed systems",
        'notes': 'Best for research-oriented positions, prefers email contact'
    }
)
status3 = 'Created' if created3 else 'Already exists'
print(f'{status3}: {ref3.name}')

total = ProfessionalReference.objects.filter(user=user).count()
print(f'\nTotal references: {total}')
print(f'User username (Firebase UID): {user.username}')
