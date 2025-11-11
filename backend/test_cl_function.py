#!/usr/bin/env python
"""Direct test of the cover letter analytics function"""

import os
import django
import sys

# Add the parent directory to the sys.path to enable imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import JobEntry, CandidateProfile
from django.contrib.auth import get_user_model

def test_cover_letter_function():
    """Test our cover letter analytics function directly."""
    
    try:
        # Import the function directly
        from core.views import _calculate_cover_letter_performance
        print("✅ Successfully imported _calculate_cover_letter_performance function")
        
        # Get test data
        User = get_user_model()
        user = User.objects.first()
        profile = CandidateProfile.objects.filter(user=user).first()
        qs = JobEntry.objects.filter(candidate=profile)
        
        print(f"Found {qs.count()} jobs for testing")
        
        # Test the function
        result = _calculate_cover_letter_performance(qs)
        print("✅ Function executed successfully!")
        
        print("\nResults:")
        print(f"Total cover letters: {result.get('total_cover_letters', 0)}")
        print(f"Best performing tone: {result.get('best_performing_tone', 'None')}")
        
        if 'performance_by_tone' in result:
            print("\nPerformance by tone:")
            for tone, stats in result['performance_by_tone'].items():
                print(f"  {tone}: {stats['response_rate']}% response rate ({stats['total_applications']} apps)")
        
        print(f"\nInsights: {result.get('insights', [])}")
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
    except Exception as e:
        print(f"❌ Error testing function: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_cover_letter_function()