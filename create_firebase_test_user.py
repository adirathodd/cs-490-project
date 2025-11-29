import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from core.models import ProfessionalReference, CandidateProfile
from datetime import datetime, timedelta

User = get_user_model()

# Instructions:
# 1. Log in to your app using Firebase (any method: email/password, Google, etc.)
# 2. Open browser DevTools Console
# 3. Run: JSON.parse(atob(localStorage.getItem('firebaseToken').split('.')[1]))
# 4. Copy the 'user_id' or 'sub' field value (your Firebase UID)
# 5. Replace YOUR_FIREBASE_UID_HERE below with that value
# 6. Run this script: python create_firebase_test_user.py

FIREBASE_UID = "YOUR_FIREBASE_UID_HERE"  # Replace this!
EMAIL = "your-email@example.com"  # Replace with your actual email used in Firebase

# Create or get user
user, created = User.objects.get_or_create(
    username=FIREBASE_UID,
    defaults={'email': EMAIL}
)

if created:
    print(f"✅ Created new user: {EMAIL}")
else:
    print(f"✅ User already exists: {EMAIL}")
    # Update email if needed
    if user.email != EMAIL:
        user.email = EMAIL
        user.save()
        print(f"   Updated email to: {EMAIL}")

# Ensure profile exists
profile, profile_created = CandidateProfile.objects.get_or_create(user=user)
if profile_created:
    print(f"✅ Created CandidateProfile for user")

# Create sample references
references_data = [
    {
        'name': 'Dr. Sarah Johnson',
        'title': 'Senior Engineering Manager',
        'company': 'Tech Innovations Inc.',
        'email': 'sarah.johnson@techinnovations.com',
        'phone': '+1-555-0101',
        'relationship': 'direct_supervisor',
        'worked_from': datetime.now() - timedelta(days=730),
        'worked_to': datetime.now() - timedelta(days=90),
        'permission_status': 'granted',
        'notes': 'Excellent technical leader, great at mentoring junior developers'
    },
    {
        'name': 'Michael Chen',
        'title': 'Product Director',
        'company': 'StartupCo',
        'email': 'm.chen@startupco.io',
        'phone': '+1-555-0202',
        'relationship': 'colleague',
        'worked_from': datetime.now() - timedelta(days=1095),
        'worked_to': datetime.now() - timedelta(days=730),
        'permission_status': 'granted',
        'notes': 'Collaborated on multiple successful product launches'
    },
    {
        'name': 'Prof. Emily Rodriguez',
        'title': 'Computer Science Professor',
        'company': 'State University',
        'email': 'e.rodriguez@stateuniversity.edu',
        'relationship': 'academic',
        'permission_status': 'pending',
        'notes': 'Academic advisor and thesis supervisor'
    }
]

created_refs = []
for ref_data in references_data:
    ref, ref_created = ProfessionalReference.objects.get_or_create(
        user=user,
        email=ref_data['email'],
        defaults=ref_data
    )
    if ref_created:
        created_refs.append(ref.name)
        print(f"✅ Created reference: {ref.name} - {ref.title}")
    else:
        print(f"   Reference already exists: {ref.name}")

print(f"\n🎉 Setup complete!")
print(f"   User: {user.email} (Firebase UID: {user.username})")
print(f"   Total references: {ProfessionalReference.objects.filter(user=user).count()}")
