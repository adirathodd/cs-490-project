"""Background tasks for contact imports and reminders.
This file provides a Celery task wrapper if Celery is configured. If Celery
is not installed, functions can be called synchronously.
"""
import logging
from django.db import models
from django.db.models import F
from django.utils import timezone
from core.models import (
    ImportJob,
    Contact,
    TechnicalPrepCache,
    TechnicalPrepGeneration,
)
from core.google_import import fetch_and_normalize, GooglePeopleAPIError
from core.technical_prep import build_technical_prep

logger = logging.getLogger(__name__)

try:
    from celery import shared_task
    CELERY_AVAILABLE = True
except Exception:
    CELERY_AVAILABLE = False


def _process_import_job_sync(job_id, access_token):
    job = ImportJob.objects.get(id=job_id)
    # Clear previous errors for a fresh run and mark processing
    job.status = 'processing'
    job.started_at = timezone.now()
    job.errors = []
    job.save(update_fields=['status', 'started_at', 'errors'])

    try:
        entries = fetch_and_normalize(access_token)
        imported = 0
        per_contact_errors = []
        for e in entries:
            emails = [em.get('value') for em in e.get('emails', []) if em.get('value')]
            primary_email = emails[0] if emails else None
            normalized_email = primary_email or ''
            # Normalize phone value to avoid inserting NULL into non-nullable DB fields
            phone_value = ''
            phones = e.get('phones') or []
            for p in phones:
                if p and p.get('value'):
                    phone_value = p.get('value')
                    break
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

            try:
                if existing:
                    # update some fields
                    existing.first_name = first or existing.first_name
                    existing.last_name = last or existing.last_name
                    existing.display_name = existing.display_name or display
                    existing.email = existing.email or normalized_email
                    existing.phone = existing.phone or phone_value
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
                        email=normalized_email,
                        phone=phone_value,
                        company_name=(e.get('organizations') or [{}])[0].get('name') if e.get('organizations') else '',
                        photo_url=e.get('photo') or '',
                        external_id=e.get('resourceName') or '',
                        metadata={'imported_at': timezone.now().isoformat()},
                    )
                    imported += 1
            except Exception as exc:
                # Record per-contact errors as structured objects but continue
                ident = e.get('resourceName') or primary_email or '<unknown>'
                msg = str(exc) or 'Unknown error'
                logger.exception('Error importing %s: %s', ident, msg)
                per_contact_errors.append({'id': ident, 'message': msg})

        job.status = 'completed'
        job.completed_at = timezone.now()
        job.result_summary = {'imported': imported, 'total_found': len(entries)}
        # Attach any per-contact errors to the job record
        if per_contact_errors:
            # store structured error objects: {id, message}
            job.errors = per_contact_errors
            job.save(update_fields=['status', 'completed_at', 'result_summary', 'errors'])
        else:
            job.save(update_fields=['status', 'completed_at', 'result_summary'])
        logger.info('Import job %s completed: %s', job_id, job.result_summary)
    except GooglePeopleAPIError as exc:
        logger.warning('Import job failed due to Google People API error: %s', exc)
        job.status = 'failed'
        msg = str(exc) or 'Google People API rejected the request.'
        job.errors = [{'id': 'google_people_api', 'message': msg}]
        job.save(update_fields=['status', 'errors'])
    except Exception as exc:
        logger.exception('Import job failed: %s', exc)
        job.status = 'failed'
        # store a fatal-level structured error
        msg = str(exc) or 'Unknown fatal error during import'
        job.errors = [{'id': '<fatal>', 'message': msg}]
        job.save(update_fields=['status', 'errors'])


if CELERY_AVAILABLE:
    @shared_task(bind=True)
    def process_import_job(self, job_id, access_token):
        return _process_import_job_sync(job_id, access_token)
else:
    def process_import_job(job_id, access_token):
        return _process_import_job_sync(job_id, access_token)


def _process_technical_prep_generation_sync(generation_id):
    generation = TechnicalPrepGeneration.objects.select_related('job', 'profile').get(id=generation_id)
    if generation.status in (TechnicalPrepGeneration.STATUS_RUNNING, TechnicalPrepGeneration.STATUS_SUCCEEDED):
        logger.info('Technical prep generation %s already %s', generation_id, generation.status)
        return generation.status

    now = timezone.now()
    TechnicalPrepGeneration.objects.filter(id=generation_id).update(
        status=TechnicalPrepGeneration.STATUS_RUNNING,
        started_at=now,
        last_progress_at=now,
        attempt_count=F('attempt_count') + 1,
    )
    generation.refresh_from_db()
    logger.info(
        'Technical prep generation %s started (job_id=%s, profile_id=%s, attempt=%s)',
        generation_id,
        generation.job_id,
        generation.profile_id,
        generation.attempt_count,
    )

    try:
        payload = build_technical_prep(generation.job, generation.profile)
        logger.info(
            'Technical prep generation %s built payload via %s source with %d keys',
            generation_id,
            payload.get('source', 'ai'),
            len(payload or {}),
        )
        TechnicalPrepCache.objects.filter(job=generation.job).update(is_valid=False)
        cache = TechnicalPrepCache.objects.create(
            job=generation.job,
            prep_data=payload,
            source=payload.get('source', 'ai'),
            generated_at=timezone.now(),
            is_valid=True,
        )
        logger.info(
            'Technical prep generation %s cached result (cache_id=%s)',
            generation_id,
            cache.id,
        )
        TechnicalPrepGeneration.objects.filter(id=generation_id).update(
            status=TechnicalPrepGeneration.STATUS_SUCCEEDED,
            cache_id=cache.id,
            finished_at=timezone.now(),
            last_progress_at=timezone.now(),
            error_code='',
            error_message='',
        )
        logger.info('Technical prep generation %s succeeded', generation_id)
        return TechnicalPrepGeneration.STATUS_SUCCEEDED
    except Exception as exc:  # pragma: no cover - surfaces in task logs
        logger.exception('Technical prep generation %s failed: %s', generation_id, exc)
        TechnicalPrepGeneration.objects.filter(id=generation_id).update(
            status=TechnicalPrepGeneration.STATUS_FAILED,
            finished_at=timezone.now(),
            last_progress_at=timezone.now(),
            error_code=getattr(exc, 'code', 'generation_failed'),
            error_message=str(exc)[:2000],
        )
        raise


if CELERY_AVAILABLE:
    @shared_task(bind=True)
    def process_technical_prep_generation(self, generation_id):
        return _process_technical_prep_generation_sync(generation_id)
else:
    def process_technical_prep_generation(generation_id):
        return _process_technical_prep_generation_sync(generation_id)


def enqueue_technical_prep_generation(generation_id):
    if CELERY_AVAILABLE:
        process_technical_prep_generation.delay(generation_id)
    else:
        process_technical_prep_generation(generation_id)
