#!/usr/bin/env python
import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import Document, JobEntry
from django.db.models import Count

print('=== DOCUMENTS ===')
docs = Document.objects.filter(ai_generation_tone__isnull=False)
print(f'Cover letters with tone tracking: {docs.count()}')
for doc in docs.order_by('-created_at')[:10]:
    job_entry_id = doc.ai_generation_params.get('job_entry_id') if doc.ai_generation_params else 'None'
    print(f'  Doc {doc.id}: tone={doc.ai_generation_tone}, created={doc.created_at.strftime("%Y-%m-%d %H:%M")}, job_entry_id={job_entry_id}')

print('\n=== JOB ENTRIES ===')
jobs = JobEntry.objects.all().order_by('-created_at')[:10]
print(f'Recent job entries: {jobs.count()}')
for job in jobs:
    print(f'  Job {job.id}: {job.company_name} - {job.title}, status={job.status}, created={job.created_at.strftime("%Y-%m-%d %H:%M")}')

print('\n=== PIPELINE DATA ===')
status_counts = JobEntry.objects.values('status').annotate(count=Count('id'))
print('Job status distribution:')
for item in status_counts:
    print(f'  {item["status"]}: {item["count"]} jobs')

print('\n=== COVER LETTER LINKAGE ===')
# Check how many cover letters are linked to actual job entries
linked_covers = Document.objects.filter(
    doc_type='cover_letter',
    ai_generation_params__job_entry_id__isnull=False
)
print(f'Cover letters linked to job entries: {linked_covers.count()}')

total_covers = Document.objects.filter(doc_type='cover_letter').count()
print(f'Total cover letters: {total_covers}')