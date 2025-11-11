#!/usr/bin/env python
"""Quick test script to diagnose resume export issues"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

print("=" * 60)
print("RESUME EXPORT DIAGNOSTIC TEST")
print("=" * 60)

# Test 1: Import resume_export module
print("\n1. Testing import of resume_export module...")
try:
    from core import resume_export
    print("   ✓ SUCCESS: resume_export module imported")
except Exception as e:
    print(f"   ✗ FAILED: {e}")
    sys.exit(1)

# Test 2: Check functions exist
print("\n2. Checking required functions exist...")
required_functions = [
    'get_available_themes',
    'export_plain_text',
    'export_html',
    'export_docx',
    'export_resume',
    'collect_profile_data'
]
for func_name in required_functions:
    if hasattr(resume_export, func_name):
        print(f"   ✓ {func_name} exists")
    else:
        print(f"   ✗ {func_name} MISSING")

# Test 3: Get themes
print("\n3. Testing get_available_themes()...")
try:
    themes = resume_export.get_available_themes()
    print(f"   ✓ SUCCESS: Found {len(themes)} themes")
    for theme in themes:
        print(f"      - {theme['id']}: {theme['name']}")
except Exception as e:
    print(f"   ✗ FAILED: {e}")

# Test 4: Check dependencies
print("\n4. Checking required dependencies...")
dependencies = {
    'docx': 'python-docx',
    'jinja2': 'Jinja2',
    'django': 'Django'
}
for module, package in dependencies.items():
    try:
        __import__(module)
        print(f"   ✓ {package} installed")
    except ImportError:
        print(f"   ✗ {package} MISSING - install with: pip install {package}")

# Test 5: Check if user has a profile
print("\n5. Checking for test user profile...")
try:
    from core.models import CandidateProfile, User
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    users = User.objects.all()[:5]
    print(f"   Found {User.objects.count()} users in database")
    
    for user in users:
        try:
            profile = CandidateProfile.objects.get(user=user)
            print(f"   ✓ User '{user.email}' has profile (ID: {profile.id})")
        except CandidateProfile.DoesNotExist:
            print(f"   ✗ User '{user.email}' has NO profile")
except Exception as e:
    print(f"   ✗ FAILED: {e}")

# Test 6: Test export with dummy data
print("\n6. Testing export_plain_text with dummy data...")
try:
    dummy_data = {
        'name': 'Test User',
        'email': 'test@example.com',
        'phone': '555-1234',
        'location': 'Test City, TS',
        'headline': 'Test Professional',
        'summary': 'Test summary',
        'portfolio_url': '',
        'skills': {'Technical': [{'name': 'Python', 'level': 'Advanced', 'years': 3}]},
        'experience': [],
        'education': [],
        'certifications': [],
        'projects': []
    }
    content = resume_export.export_plain_text(dummy_data)
    print(f"   ✓ SUCCESS: Generated {len(content)} characters")
    print(f"   Preview: {content[:100]}...")
except Exception as e:
    print(f"   ✗ FAILED: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("DIAGNOSTIC COMPLETE")
print("=" * 60)
