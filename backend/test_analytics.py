#!/usr/bin/env python
"""Test the cover letter analytics endpoint"""

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

def test_analytics():
    User = get_user_model()
    
    # Get the first user with a profile for testing
    try:
        user = User.objects.first()
        if not user:
            print("No users found in database")
            return
            
        profile = CandidateProfile.objects.filter(user=user).first()
        if not profile:
            print(f"No candidate profile found for user {user.username}")
            return
            
        print(f"Testing analytics for user {user.username} (profile ID: {profile.id})")
        
        # Create a test client
        client = Client()
        
        # Log in the user (simulate authentication)
        client.force_login(user)
        
        # Call the analytics endpoint
        response = client.get('/api/jobs/analytics')
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Analytics Response:")
            print(json.dumps(data, indent=2))
            
            # Check if our cover letter performance data is included
            if 'cover_letter_performance' in data:
                print("\n✅ Cover letter performance analytics found!")
                cl_data = data['cover_letter_performance']
                print(f"Total cover letters: {cl_data.get('total_cover_letters', 0)}")
                print(f"Best performing tone: {cl_data.get('best_performing_tone', 'None')}")
                
                if 'performance_by_tone' in cl_data:
                    print("\nPerformance by tone:")
                    for tone, stats in cl_data['performance_by_tone'].items():
                        print(f"  {tone}: {stats['response_rate']}% response rate ({stats['total_applications']} apps)")
            else:
                print("\n❌ Cover letter performance analytics not found in response")
        else:
            print(f"Error: {response.content.decode()}")
            
    except Exception as e:
        print(f"Error during testing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_analytics()