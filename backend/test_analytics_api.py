#!/usr/bin/env python
"""Quick test of the analytics API endpoint"""

import os
import django
import sys
import json
from django.test import Client
from django.contrib.auth import get_user_model

# Add the parent directory to the sys.path to enable imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import CandidateProfile

def test_analytics_api():
    """Test the analytics API endpoint with authentication."""
    try:
        # Get user with test data (candidate 5)
        profile = CandidateProfile.objects.get(id=5)
        user = profile.user
        
        print(f"Testing analytics API for user {user.username} (profile ID: {profile.id})")
        
        # Create a test client
        client = Client()
        
        # Log in the user
        client.force_login(user)
        
        # Test the analytics endpoint
        response = client.get('/api/jobs/analytics')
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("\n✅ Analytics API working! Here's the response:")
            print(json.dumps(data, indent=2))
            
            # Check specifically for cover letter performance
            if 'cover_letter_performance' in data:
                print("\n🎉 Cover letter performance data found!")
                cl_data = data['cover_letter_performance']
                print(f"Total cover letters: {cl_data.get('total_cover_letters', 0)}")
                print(f"Best tone: {cl_data.get('best_performing_tone', 'None')}")
                print(f"Tones tracked: {list(cl_data.get('performance_by_tone', {}).keys())}")
            else:
                print("\n❌ Cover letter performance data missing")
                
        else:
            print(f"❌ API Error: {response.status_code}")
            print(response.content.decode())
            
    except Exception as e:
        print(f"❌ Error during API test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_analytics_api()