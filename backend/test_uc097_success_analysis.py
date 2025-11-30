"""
Test script for UC-097: Application Success Rate Analysis
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import CandidateProfile
from core.application_analytics import ApplicationSuccessAnalyzer

def test_success_analysis():
    """Test the success analysis for all candidates."""
    print("🔍 Testing UC-097: Application Success Rate Analysis\n")
    
    # Get all candidate profiles
    profiles = CandidateProfile.objects.all()
    print(f"Found {profiles.count()} candidate profiles\n")
    
    for profile in profiles[:3]:  # Test first 3 profiles
        print(f"\n{'='*60}")
        print(f"Profile: {profile.user.email if profile.user else 'Unknown'}")
        print(f"{'='*60}\n")
        
        try:
            analyzer = ApplicationSuccessAnalyzer(profile)
            analysis = analyzer.get_complete_analysis()
            
            # Display overall metrics
            overall = analysis['overall_metrics']
            print(f"📊 Overall Metrics:")
            print(f"   Total Applications: {overall['total_applications']}")
            print(f"   Response Rate: {overall['response_rate']}%")
            print(f"   Interview Rate: {overall['interview_rate']}%")
            print(f"   Offer Rate: {overall['offer_rate']}%")
            print(f"   Avg Days to Response: {overall['avg_days_to_response']}")
            
            # Display recommendations
            if analysis['recommendations']:
                print(f"\n💡 Recommendations ({len(analysis['recommendations'])}):")
                for i, rec in enumerate(analysis['recommendations'][:3], 1):
                    print(f"   {i}. [{rec['type'].upper()}] {rec['message']}")
            else:
                print(f"\n💡 No recommendations available (not enough data)")
            
            # Display industry analysis
            if analysis['by_industry']:
                print(f"\n🏢 Top Industry by Success Rate:")
                top = analysis['by_industry'][0]
                print(f"   {top['industry']}: {top['offer_rate']}% offer rate")
            
            # Display customization impact
            if analysis['customization_impact']['resume_customization']:
                resume_custom = analysis['customization_impact']['resume_customization']
                if 'customized' in resume_custom and 'not_customized' in resume_custom:
                    print(f"\n📝 Resume Customization Impact:")
                    print(f"   Customized: {resume_custom['customized']['offer_rate']}% offer rate")
                    print(f"   Not Customized: {resume_custom['not_customized']['offer_rate']}% offer rate")
            
            print(f"\n✅ Analysis completed successfully!")
            
        except Exception as e:
            print(f"❌ Error analyzing profile: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    test_success_analysis()
