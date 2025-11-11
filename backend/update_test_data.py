#!/usr/bin/env python
"""Update job statuses for cover letter analytics testing"""

import os
import django
import sys

# Add the parent directory to the sys.path to enable imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import JobEntry

def update_job_statuses():
    # Update some job statuses to create varied test data
    jobs = JobEntry.objects.filter(cover_letter_doc__isnull=False)
    updates = [
        ('applied', 45),  # formal tone
        ('phone_screen', 50),  # analytical tone  
        ('interview', 48),  # warm tone
        ('offer', 47),  # balanced tone
        ('applied', 46),  # creative tone
        ('interested', 34),  # technical tone
    ]

    for status, job_id in updates:
        try:
            job = JobEntry.objects.get(id=job_id)
            job.status = status
            job.save()
            tone = job.cover_letter_doc.ai_generation_tone if job.cover_letter_doc else 'None'
            print(f'Updated job {job_id} to status "{status}" (tone: {tone})')
        except JobEntry.DoesNotExist:
            print(f'Job {job_id} not found')

    print('Status updates complete!')
    
    # Show final data
    print('\nFinal test data:')
    jobs_with_cover_letters = JobEntry.objects.filter(cover_letter_doc__isnull=False)
    for job in jobs_with_cover_letters:
        tone = job.cover_letter_doc.ai_generation_tone if job.cover_letter_doc else 'None'
        print(f'Job {job.id}: status={job.status}, tone={tone}')

if __name__ == '__main__':
    update_job_statuses()