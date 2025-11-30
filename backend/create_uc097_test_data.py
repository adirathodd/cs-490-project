"""
Create test data for UC-097: Application Success Rate Analysis
This script creates realistic job application data to demonstrate the analytics features.
"""
import os
import django
from datetime import datetime, timedelta
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.utils import timezone
from django.contrib.auth import get_user_model
from core.models import JobEntry, CandidateProfile

User = get_user_model()

def create_test_applications():
    """Create realistic test applications with UC-097 tracking data."""
    
    # Get or create test user
    user, created = User.objects.get_or_create(
        email='test@example.com',
        defaults={'username': 'test@example.com'}
    )
    
    # Get or create profile
    profile, created = CandidateProfile.objects.get_or_create(
        user=user,
        defaults={
            'headline': 'Software Engineer',
            'summary': 'Experienced software engineer looking for new opportunities',
            'industry': 'Technology'
        }
    )
    
    print(f"Using profile: {profile.user.email}")
    
    # Define realistic test data patterns
    industries = [
        'Technology', 'Finance', 'Healthcare', 'Education', 
        'E-commerce', 'Consulting', 'Media'
    ]
    
    job_titles = {
        'Technology': ['Software Engineer', 'Full Stack Developer', 'DevOps Engineer', 'Data Scientist'],
        'Finance': ['Financial Analyst', 'Investment Banker', 'Risk Manager', 'Accountant'],
        'Healthcare': ['Data Analyst', 'Project Manager', 'IT Specialist', 'Operations Manager'],
        'Education': ['Instructional Designer', 'EdTech Specialist', 'Curriculum Developer'],
        'E-commerce': ['Product Manager', 'UX Designer', 'Marketing Manager', 'Data Analyst'],
        'Consulting': ['Business Analyst', 'Strategy Consultant', 'Management Consultant'],
        'Media': ['Content Manager', 'Digital Marketing Manager', 'Social Media Strategist']
    }
    
    companies = {
        'startup': ['TechStartup Inc', 'InnovateLab', 'FastGrow', 'NextGen Solutions'],
        'small': ['LocalTech Co', 'Regional Services', 'SmallCorp', 'Boutique Consulting'],
        'medium': ['MidSize Tech', 'GrowthCo', 'Regional Leader', 'Expanding Corp'],
        'large': ['BigTech Corp', 'Major Enterprise', 'National Leader', 'Corporate Giant'],
        'enterprise': ['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix']
    }
    
    # Success rate patterns (realistic)
    # Referrals and recruiters have higher success rates
    source_success_rates = {
        'referral': 0.35,
        'recruiter': 0.30,
        'company_website': 0.15,
        'linkedin': 0.12,
        'indeed': 0.10,
        'glassdoor': 0.08,
        'job_board': 0.07,
        'networking': 0.25,
    }
    
    method_success_rates = {
        'referral': 0.40,
        'recruiter': 0.35,
        'direct_contact': 0.20,
        'email': 0.12,
        'online_form': 0.08,
    }
    
    # Customization impact (customized materials have 2x success rate)
    customization_boost = 2.0
    
    print("\nCreating 60 test applications with realistic success patterns...\n")
    
    created_count = 0
    now = timezone.now()
    
    for i in range(60):
        # Select industry and related job
        industry = random.choice(industries)
        title = random.choice(job_titles[industry])
        
        # Select company size and company
        company_size = random.choice(['startup', 'small', 'medium', 'large', 'enterprise'])
        company = random.choice(companies[company_size])
        
        # Select application source and method
        source = random.choice(list(source_success_rates.keys()))
        method = random.choice(list(method_success_rates.keys()))
        
        # Customization (60% chance of customizing)
        resume_customized = random.random() < 0.6
        cover_letter_customized = random.random() < 0.5
        
        # Calculate success probability based on factors
        base_success_rate = source_success_rates[source] * method_success_rates[method]
        if resume_customized and cover_letter_customized:
            success_rate = min(base_success_rate * customization_boost, 0.5)
        elif resume_customized or cover_letter_customized:
            success_rate = min(base_success_rate * 1.5, 0.4)
        else:
            success_rate = base_success_rate
        
        # Determine status based on success rate
        rand = random.random()
        if rand < success_rate * 0.2:
            status = 'offer'
        elif rand < success_rate * 0.5:
            status = 'interview'
        elif rand < success_rate * 0.8:
            status = 'phone_screen'
        elif rand < success_rate + 0.2:
            status = 'rejected'
        else:
            status = random.choice(['interested', 'applied'])
        
        # Application timing (spread over last 90 days)
        days_ago = random.randint(1, 90)
        # Better success rates on Tue-Thu, 9am-12pm
        day_of_week = random.randint(0, 6)  # 0=Mon, 6=Sun
        hour = random.randint(8, 18)
        
        application_date = now - timedelta(days=days_ago, hours=random.randint(0, 23))
        application_date = application_date.replace(hour=hour, minute=random.randint(0, 59))
        
        # Response timing (if got response)
        first_response = None
        days_to_response = None
        if status not in ['interested', 'applied']:
            days_to_response = random.randint(3, 21)
            first_response = application_date + timedelta(days=days_to_response)
        
        # Create job entry
        salary_amount = random.randint(80, 200) * 1000 if random.random() < 0.7 else None
        
        job = JobEntry.objects.create(
            candidate=profile,
            title=title,
            company_name=company,
            industry=industry,
            location=random.choice(['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA', 'Remote']),
            job_type=random.choice(['full_time', 'contract', 'part_time']),
            status=status,
            application_source=source,
            application_method=method,
            company_size=company_size,
            resume_customized=resume_customized,
            cover_letter_customized=cover_letter_customized,
            application_submitted_at=application_date,
            first_response_at=first_response,
            days_to_response=days_to_response,
            salary_min=salary_amount * 0.9 if salary_amount else None,
            salary_max=salary_amount * 1.1 if salary_amount else None,
            description=f"Great opportunity for {title} at {company}. We're looking for talented individuals to join our team.",
        )
        
        created_count += 1
        
        # Print progress
        if created_count % 10 == 0:
            print(f"✓ Created {created_count} applications...")
    
    print(f"\n✅ Successfully created {created_count} test applications!")
    print(f"\nBreakdown:")
    print(f"  • Industries: {len(industries)} different industries")
    print(f"  • Company Sizes: All 5 tiers (startup to enterprise)")
    print(f"  • Application Sources: {len(source_success_rates)} sources")
    print(f"  • Application Methods: {len(method_success_rates)} methods")
    print(f"  • Customization: ~60% with customized resumes")
    print(f"  • Time Range: Last 90 days")
    print(f"\nNow test the analytics at: http://localhost:3000/analytics")
    print("Navigate to the 'Success Analysis' tab to see the results!")

if __name__ == '__main__':
    create_test_applications()
