#!/usr/bin/env python
"""Create test data for cover letter analytics"""

import os
import django
import sys

# Add the parent directory to the sys.path to enable imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import Document, JobEntry
import random

def create_test_data():
    # Get some cover letter documents and job entries  
    docs = Document.objects.filter(doc_type='cover_letter')[:6]
    jobs = JobEntry.objects.all()[:6]
    tones = ['formal', 'analytical', 'warm', 'balanced', 'creative', 'technical']

    print(f'Found {len(docs)} cover letter documents and {len(jobs)} job entries')
    print(f'Updating {min(len(docs), len(jobs))} documents with tones and linking to jobs...')

    count = 0
    for i, (doc, job) in enumerate(zip(docs, jobs)):
        tone = tones[i] if i < len(tones) else 'balanced'
        doc.ai_generation_tone = tone
        doc.ai_generation_params = {'style': tone, 'test_data': True}
        doc.save()
        
        # Link the cover letter to the job
        job.cover_letter_doc = doc
        job.save()
        
        print(f'Updated doc {doc.id} with tone "{tone}" and linked to job {job.id} (status: {job.status})')
        count += 1

    print(f'Test data creation complete! Updated {count} records.')
    
    # Verify the data
    print('\nVerifying test data:')
    jobs_with_cover_letters = JobEntry.objects.filter(cover_letter_doc__isnull=False)
    print(f'Jobs with cover letters: {jobs_with_cover_letters.count()}')
    
    for job in jobs_with_cover_letters:
        tone = job.cover_letter_doc.ai_generation_tone if job.cover_letter_doc else 'None'
        print(f'Job {job.id}: status={job.status}, tone={tone}')

if __name__ == '__main__':
    create_test_data()