"""
Cover letter performance analytics module
"""
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


def calculate_cover_letter_performance(qs):
    """Calculate cover letter performance analytics by tone/style."""
    
    # Get all jobs with cover letters, grouped by tone
    jobs_with_cover_letters = qs.filter(
        cover_letter_doc__isnull=False,
        cover_letter_doc__ai_generation_tone__isnull=False
    ).select_related('cover_letter_doc')
    
    if not jobs_with_cover_letters.exists():
        return {
            'total_cover_letters': 0,
            'performance_by_tone': {},
            'best_performing_tone': None,
            'insights': ['No cover letters with analytics data found']
        }
    
    # Group jobs by cover letter tone
    tone_performance = {}
    total_cover_letters = jobs_with_cover_letters.count()
    
    # Get unique tones from the data
    tones = jobs_with_cover_letters.values_list('cover_letter_doc__ai_generation_tone', flat=True).distinct()
    
    for tone in tones:
        if not tone:
            continue
            
        tone_jobs = jobs_with_cover_letters.filter(cover_letter_doc__ai_generation_tone=tone)
        total_jobs = tone_jobs.count()
        
        if total_jobs == 0:
            continue
        
        # Calculate response rate (moved from interested to applied or beyond)
        responded_jobs = tone_jobs.filter(
            status__in=['applied', 'phone_screen', 'interview', 'offer', 'hired']
        ).count()
        
        # Calculate interview rate (reached interview stage)
        interview_jobs = tone_jobs.filter(
            status__in=['interview', 'offer', 'hired']
        ).count()
        
        # Calculate offer rate (received offer)
        offer_jobs = tone_jobs.filter(
            status__in=['offer', 'hired']
        ).count()
        
        tone_performance[tone] = {
            'total_applications': total_jobs,
            'response_rate': round((responded_jobs / total_jobs) * 100, 1),
            'interview_rate': round((interview_jobs / total_jobs) * 100, 1),
            'offer_rate': round((offer_jobs / total_jobs) * 100, 1),
            'responses': responded_jobs,
            'interviews': interview_jobs,
            'offers': offer_jobs
        }
    
    # Find best performing tone (by response rate)
    best_tone = None
    best_response_rate = 0
    
    for tone, stats in tone_performance.items():
        if stats['response_rate'] > best_response_rate and stats['total_applications'] >= 3:  # Minimum sample size
            best_response_rate = stats['response_rate']
            best_tone = tone
    
    # Generate insights
    insights = []
    if best_tone:
        best_stats = tone_performance[best_tone]
        insights.append(f"'{best_tone}' tone performs best with {best_stats['response_rate']}% response rate")
        
        if len(tone_performance) > 1:
            # Compare tones
            sorted_tones = sorted(tone_performance.items(), key=lambda x: x[1]['response_rate'], reverse=True)
            worst_tone, worst_stats = sorted_tones[-1]
            if worst_stats['total_applications'] >= 3:
                insights.append(f"'{worst_tone}' tone has lowest response rate at {worst_stats['response_rate']}%")
    
    # Add recommendation based on data
    if len(tone_performance) >= 2:
        insights.append("Consider using the best performing tone for future applications")
    else:
        insights.append("Try different cover letter tones to find what works best for your field")
    
    return {
        'total_cover_letters': total_cover_letters,
        'performance_by_tone': tone_performance,
        'best_performing_tone': best_tone,
        'insights': insights
    }


def test_cover_letter_analytics():
    """Test the cover letter analytics function."""
    try:
        # Get test data - use candidate with the most cover letter data
        profile = CandidateProfile.objects.get(id=5)  # This candidate has most test data
        qs = JobEntry.objects.filter(candidate=profile)
        
        print(f"Found {qs.count()} jobs for testing")
        
        # Test the function
        result = calculate_cover_letter_performance(qs)
        print("✅ Function executed successfully!")
        
        print("\nCover Letter Performance Analytics Results:")
        print("=" * 50)
        print(f"Total cover letters: {result.get('total_cover_letters', 0)}")
        print(f"Best performing tone: {result.get('best_performing_tone', 'None')}")
        
        if 'performance_by_tone' in result:
            print("\nPerformance by tone:")
            for tone, stats in result['performance_by_tone'].items():
                print(f"  📝 {tone.capitalize()}: {stats['response_rate']}% response rate")
                print(f"     Applications: {stats['total_applications']}")
                print(f"     Responses: {stats['responses']}")
                print(f"     Interviews: {stats['interviews']}")  
                print(f"     Offers: {stats['offers']}")
                print()
        
        print("Insights:")
        for insight in result.get('insights', []):
            print(f"  💡 {insight}")
        
        return result
        
    except Exception as e:
        print(f"❌ Error testing function: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == '__main__':
    test_cover_letter_analytics()