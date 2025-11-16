"""Background tasks for contact imports and reminders.
This file provides a Celery task wrapper if Celery is configured. If Celery
is not installed, functions can be called synchronously.
"""
import logging
from django.utils import timezone
from core.models import ImportJob, Contact
from core.google_import import fetch_and_normalize

logger = logging.getLogger(__name__)

try:
    from celery import shared_task
    CELERY_AVAILABLE = True
except Exception:
    CELERY_AVAILABLE = False


def _process_import_job_sync(job_id, access_token):
    job = ImportJob.objects.get(id=job_id)
    job.status = 'processing'
    job.started_at = timezone.now()
    job.save(update_fields=['status', 'started_at'])

    try:
        entries = fetch_and_normalize(access_token)
        imported = 0
        for e in entries:
            emails = [em.get('value') for em in e.get('emails', []) if em.get('value')]
            primary_email = emails[0] if emails else None
            # Deduplicate by owner+email if available, otherwise by resourceName
            existing = None
            if primary_email:
                existing = Contact.objects.filter(owner=job.owner, email__iexact=primary_email).first()
            if not existing and e.get('resourceName'):
                existing = Contact.objects.filter(owner=job.owner, external_id=e.get('resourceName')).first()

            name = (e.get('names') or [{}])[0]
            first = name.get('givenName') or ''
            last = name.get('familyName') or ''
            display = name.get('displayName') or f"{first} {last}".strip()

            if existing:
                # update some fields
                existing.first_name = first or existing.first_name
                existing.last_name = last or existing.last_name
                existing.display_name = existing.display_name or display
                existing.email = existing.email or primary_email
                existing.phone = existing.phone or (e.get('phones') or [{}])[0].get('value')
                existing.photo_url = existing.photo_url or e.get('photo')
                existing.external_id = existing.external_id or e.get('resourceName')
                existing.metadata = {**existing.metadata, 'last_imported': timezone.now().isoformat()}
                existing.save()
            else:
                c = Contact.objects.create(
                    owner=job.owner,
                    first_name=first,
                    last_name=last,
                    display_name=display,
                    email=primary_email,
                    phone=(e.get('phones') or [{}])[0].get('value'),
                    company_name=(e.get('organizations') or [{}])[0].get('name') if e.get('organizations') else '',
                    photo_url=e.get('photo') or '',
                    external_id=e.get('resourceName') or '',
                    metadata={'imported_at': timezone.now().isoformat()},
                )
                imported += 1

        job.status = 'completed'
        job.completed_at = timezone.now()
        job.result_summary = {'imported': imported, 'total_found': len(entries)}
        job.save(update_fields=['status', 'completed_at', 'result_summary'])
        logger.info('Import job %s completed: %s', job_id, job.result_summary)
    except Exception as exc:
        logger.exception('Import job failed: %s', exc)
        job.status = 'failed'
        job.errors = [str(exc)]
        job.save(update_fields=['status', 'errors'])


if CELERY_AVAILABLE:
    @shared_task(bind=True)
    def process_import_job(self, job_id, access_token):
        return _process_import_job_sync(job_id, access_token)
else:
    def process_import_job(job_id, access_token):
        return _process_import_job_sync(job_id, access_token)
