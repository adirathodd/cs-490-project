import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from core.models import ProfessionalReference, CandidateProfile
from datetime import date, timedelta

User = get_user_model()

# REPLACE THESE WITH YOUR ACTUAL VALUES
FIREBASE_UID = "dwgRiCXP0EUZxpPXcbX0x8zUjHx2"  # Get from browser console
EMAIL = "your-email@example.com"  # Your actual email

# Create or update user
user, created = User.objects.update_or_create(
    username=FIREBASE_UID,
    defaults={'email': EMAIL}
)
action = 'Created' if created else 'Updated'
print(f'{action} user: {EMAIL} with Firebase UID: {FIREBASE_UID}')

# Ensure profile exists
profile, _ = CandidateProfile.objects.get_or_create(user=user)

# Create sample references
references = [
    {
        'email': 'sarah.johnson@techinnovations.com',
        'name': 'Dr. Sarah Johnson',
        'title': 'Senior Engineering Manager',
        'company': 'Tech Innovations Inc.',
        'phone': '+1-555-0101',
        'relationship_type': 'supervisor',
        'relationship_description': 'Reported directly to Sarah for 2 years',
        'years_known': 3,
        'availability_status': 'available',
        'permission_granted_date': date.today() - timedelta(days=30),
        'preferred_contact_method': 'email',
        'key_strengths_to_highlight': 'Technical leadership, mentoring',
        'projects_worked_together': 'Cloud migration project and API redesign',
        'notes': 'Very supportive, responds quickly'
    },
    {
        'email': 'm.chen@startupco.io',
        'name': 'Michael Chen',
        'title': 'Product Director',
        'company': 'StartupCo',
        'phone': '+1-555-0202',
        'relationship_type': 'colleague',
        'relationship_description': 'Collaborated on product development',
        'years_known': 4,
        'availability_status': 'available',
        'permission_granted_date': date.today() - timedelta(days=60),
        'preferred_contact_method': 'either',
        'key_strengths_to_highlight': 'Product strategy, stakeholder management',
        'projects_worked_together': 'Launched 3 major product features',
        'notes': 'Great for product-focused roles'
    },
    {
        'email': 'e.rodriguez@stateuniversity.edu',
        'name': 'Prof. Emily Rodriguez',
        'title': 'Computer Science Professor',
        'company': 'State University',
        'relationship_type': 'professor',
        'relationship_description': 'Academic advisor',
        'years_known': 5,
        'availability_status': 'limited',
        'preferred_contact_method': 'email',
        'key_strengths_to_highlight': 'Research capabilities, academic excellence',
        'projects_worked_together': "Master's thesis on distributed systems",
        'notes': 'Best for research positions'
    }
]

for ref_data in references:
    ref, created = ProfessionalReference.objects.get_or_create(
        user=user,
        email=ref_data['email'],
        defaults=ref_data
    )
    status = 'Created' if created else 'Exists'
    print(f'  {status}: {ref.name}')

total = ProfessionalReference.objects.filter(user=user).count()
print(f'\nTotal references: {total}')
print(f'\nYou can now log in with your Firebase account and see the references!')
