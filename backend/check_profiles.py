"""
Script to check all candidate profiles in the database.
Run with: docker compose exec backend python check_profiles.py
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, '/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import CandidateProfile
from django.contrib.auth import get_user_model

User = get_user_model()

print("\n" + "="*60)
print("CANDIDATE PROFILES SUMMARY")
print("="*60)

print(f"\nTotal Users: {User.objects.count()}")
print(f"Total Profiles: {CandidateProfile.objects.count()}")

print("\n" + "-"*60)
print("ALL CANDIDATE PROFILES:")
print("-"*60)

profiles = CandidateProfile.objects.select_related('user').all()

if not profiles:
    print("\nNo profiles found in the database.")
else:
    for i, profile in enumerate(profiles, 1):
        print(f"\n--- Profile #{i} ---")
        print(f"User ID: {profile.user.id}")
        print(f"Username: {profile.user.username}")
        print(f"Email: {profile.user.email}")
        print(f"Name: {profile.user.first_name} {profile.user.last_name}")
        print(f"Phone: {profile.phone or 'Not set'}")
        print(f"Location: {profile.get_full_location() or 'Not set'}")
        print(f"  - City: {profile.city or 'Not set'}")
        print(f"  - State: {profile.state or 'Not set'}")
        print(f"Headline: {profile.headline or 'Not set'}")
        summary_display = profile.summary[:100] + '...' if profile.summary and len(profile.summary) > 100 else profile.summary or 'Not set'
        print(f"Summary: {summary_display}")
        print(f"Industry: {profile.industry or 'Not set'}")
        print(f"Experience Level: {profile.experience_level or 'Not set'}")

print("\n" + "="*60)
print("\nDatabase Table Structure:")
print("-"*60)

from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT column_name, data_type, character_maximum_length 
        FROM information_schema.columns 
        WHERE table_name='core_candidateprofile' 
        ORDER BY ordinal_position;
    """)
    print(f"\n{'Column Name':<30} {'Data Type':<20} {'Max Length'}")
    print("-"*60)
    for row in cursor.fetchall():
        max_len = row[2] if row[2] else 'N/A'
        print(f"{row[0]:<30} {row[1]:<20} {max_len}")

print("\n" + "="*60)
