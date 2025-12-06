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


# 
# 
# =
# EMAIL SCANNING TASKS (UC-113)
# 
# 
# =


def auto_link_email_to_job(email_obj):
    """Attempt to automatically link email to a job based on content"""
    from core.models import JobEntry
    
    # Skip if already linked
    if email_obj.job:
        return False
    
    # Skip if user has no profile
    if not hasattr(email_obj.user, 'profile'):
        return False
    
    # Extract company names and job titles from email
    # Match against user's JobEntry records
    subject_words = email_obj.subject.lower().split()
    body_words = email_obj.body_text[:1000].lower().split()  # First 1000 chars
    
    jobs = JobEntry.objects.filter(
        candidate=email_obj.user.profile,
        status__in=['interested', 'applied', 'phone', 'onsite']
    )[:50]  # Limit to recent 50 jobs
    
    for job in jobs:
        company_name = job.company_name.lower() if job.company_name else ''
        job_title = job.title.lower() if job.title else ''
        
        # Simple matching logic - check if company name appears in email
        if company_name and len(company_name) > 3 and company_name in email_obj.body_text.lower():
            email_obj.job = job
            email_obj.is_linked = True
            email_obj.save(update_fields=['job', 'is_linked', 'updated_at'])
            logger.info(f'Auto-linked email {email_obj.id} to job {job.id}')
            return True
    
    return False


def _scan_gmail_sync(integration_id):
    """Synchronous Gmail scan implementation"""
    from core.models import GmailIntegration, ApplicationEmail, JobEntry, EmailScanLog
    from core import gmail_utils
    
    integration = GmailIntegration.objects.get(id=integration_id)
    
    # Skip if scanning is disabled
    if not integration.scan_enabled:
        logger.info(f'Scanning disabled for integration {integration_id}')
        return
    
    # Check if we're currently rate limited
    if integration.rate_limit_reset_at and integration.rate_limit_reset_at > timezone.now():
        wait_seconds = (integration.rate_limit_reset_at - timezone.now()).total_seconds()
        logger.info(f'Integration {integration_id} is rate limited. Will retry in {wait_seconds:.0f}s')
        raise gmail_utils.GmailRateLimitError(
            f'Rate limit active. Retry after {wait_seconds:.0f} seconds',
            retry_after=int(wait_seconds)
        )
    
    scan_log = EmailScanLog.objects.create(integration=integration, status='running')
    
    try:
        integration.status = 'scanning'
        integration.save(update_fields=['status', 'updated_at'])
        
        access_token = gmail_utils.ensure_valid_token(integration)
        
        # Search query for job-related emails from last 90 days
        query = 'subject:(job OR application OR interview OR offer OR recruiter OR hiring) newer_than:90d'
        
        messages_data = gmail_utils.fetch_messages(access_token, query=query, max_results=100)
        message_ids = [m['id'] for m in messages_data.get('messages', [])]
        
        emails_processed = 0
        emails_matched = 0
        emails_linked = 0
        
        for msg_id in message_ids:
            try:
                # Skip if already processed
                if ApplicationEmail.objects.filter(gmail_message_id=msg_id).exists():
                    continue
                
                msg_detail = gmail_utils.get_message_detail(access_token, msg_id)
                
                headers = gmail_utils.parse_email_headers(msg_detail)
                body = gmail_utils.extract_email_body(msg_detail)
                snippet = msg_detail.get('snippet', '')
                
                # Parse sender
                from_header = headers.get('from', '')
                sender_email = gmail_utils.extract_email_from_header(from_header)
                sender_name = gmail_utils.extract_name_from_header(from_header)
                
                # Classify email
                email_type, confidence, suggested_status = gmail_utils.classify_email_type(
                    headers.get('subject', ''),
                    body,
                    sender_email
                )
                
                # Create email record
                email_obj = ApplicationEmail.objects.create(
                    user=integration.user,
                    gmail_message_id=msg_id,
                    thread_id=msg_detail.get('threadId', ''),
                    subject=headers.get('subject', '')[:500],
                    sender_email=sender_email[:254],  # Max email field length
                    sender_name=sender_name[:255],
                    received_at=gmail_utils.parse_gmail_date(headers.get('date')),
                    snippet=snippet[:1000],
                    body_text=body[:10000],  # Limit size
                    email_type=email_type,
                    confidence_score=confidence,
                    is_application_related=confidence > 0.5,
                    suggested_job_status=suggested_status,
                    labels=msg_detail.get('labelIds', []),
                )
                
                emails_processed += 1
                if email_obj.is_application_related:
                    emails_matched += 1
                
                # Try to auto-link to job
                if auto_link_email_to_job(email_obj):
                    emails_linked += 1
                
            except Exception as e:
                logger.warning(f'Error processing message {msg_id}: {e}')
        
        scan_log.emails_processed = emails_processed
        scan_log.emails_matched = emails_matched
        scan_log.emails_linked = emails_linked
        scan_log.completed_at = timezone.now()
        scan_log.status = 'success'
        scan_log.save()
        
        integration.status = 'connected'
        integration.last_scan_at = timezone.now()
        integration.emails_scanned_count = integration.emails_scanned_count + emails_processed
        integration.rate_limit_reset_at = None  # Clear any rate limit tracking on success
        integration.save(update_fields=['status', 'last_scan_at', 'emails_scanned_count', 'rate_limit_reset_at', 'updated_at'])
        
        logger.info(f'Gmail scan completed: {emails_processed} processed, {emails_matched} matched, {emails_linked} linked')
    
    except gmail_utils.GmailAuthError as e:
        logger.error(f'Gmail authentication failed: {e}')
        scan_log.status = 'error'
        scan_log.error_message = f'Authentication error: {str(e)}'[:1000]
        scan_log.completed_at = timezone.now()
        scan_log.save()
        
        integration.status = 'error'
        integration.last_error = 'Authentication failed. Please reconnect Gmail.'
        integration.save(update_fields=['status', 'last_error', 'updated_at'])
        raise
    
    except gmail_utils.GmailRateLimitError as e:
        logger.warning(f'Gmail rate limit hit: {e}')
        scan_log.status = 'error'
        scan_log.error_message = f'Rate limit exceeded: {str(e)}'[:1000]
        scan_log.completed_at = timezone.now()
        scan_log.save()
        
        # Set rate limit reset time
        retry_after = getattr(e, 'retry_after', 60)
        integration.rate_limit_reset_at = timezone.now() + timedelta(seconds=retry_after)
        integration.status = 'connected'  # Keep connected, just rate limited
        integration.last_error = f'Rate limit hit. Will retry in {retry_after} seconds.'
        integration.save(update_fields=['status', 'last_error', 'rate_limit_reset_at', 'updated_at'])
        # Don't raise - let the task retry naturally
        logger.info(f'Rate limit tracked, will reset at {integration.rate_limit_reset_at}')
        
    except Exception as e:
        logger.error(f'Gmail scan failed: {e}', exc_info=True)
        scan_log.status = 'error'
        scan_log.error_message = str(e)[:1000]
        scan_log.completed_at = timezone.now()
        scan_log.save()
        
        integration.status = 'error'
        integration.last_error = str(e)[:500]
        integration.save(update_fields=['status', 'last_error', 'updated_at'])
        raise


# Celery task wrapper
if CELERY_AVAILABLE:
    @shared_task(bind=True, max_retries=3, default_retry_delay=300)
    def scan_gmail_emails(self, integration_id):
        """Scan Gmail for application-related emails with retry logic"""
        try:
            _scan_gmail_sync(integration_id)
        except gmail_utils.GmailRateLimitError as exc:
            # For rate limits, retry with longer delay
            retry_after = getattr(exc, 'retry_after', 300)
            logger.info(f'Retrying after rate limit in {retry_after} seconds')
            raise self.retry(exc=exc, countdown=retry_after)
        except gmail_utils.GmailAuthError as exc:
            # Don't retry auth errors - user needs to reconnect
            logger.error(f'Authentication error, not retrying: {exc}')
            raise
        except Exception as exc:
            # Retry other errors with exponential backoff
            logger.error(f'Celery task failed, will retry: {exc}')
            retry_countdown = 60 * (2 ** self.request.retries)  # 60s, 120s, 240s
            raise self.retry(exc=exc, countdown=retry_countdown)
else:
    def scan_gmail_emails(integration_id):
        return _scan_gmail_sync(integration_id)

