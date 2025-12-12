"""Background tasks for contact imports and reminders.
This file provides a Celery task wrapper if Celery is configured. If Celery
is not installed, functions can be called synchronously.

⚠️  UC-117: All Celery tasks calling external APIs must use track_api_call()
from core.api_monitoring. See examples in this file.
"""
import logging
from datetime import timedelta
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
from core import gmail_utils

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


# UC-117: API Monitoring Weekly Report Generation
def _generate_weekly_api_report_sync():
    """
    Generate weekly API usage report and email to admin.
    This should be called weekly (e.g., every Monday morning).
    """
    from datetime import date, timedelta
    from django.core.mail import send_mail
    from django.conf import settings
    from django.db.models import Count, Avg, Sum, Q
    from core.models import (
        APIService, APIUsageLog, APIQuotaUsage, APIError, APIAlert, APIWeeklyReport
    )
    
    logger.info("Starting weekly API monitoring report generation")
    
    # Calculate last week's date range
    today = timezone.now().date()
    week_end = today - timedelta(days=today.weekday())  # Last Sunday
    week_start = week_end - timedelta(days=7)  # Previous Monday
    
    week_start_dt = timezone.make_aware(
        timezone.datetime.combine(week_start, timezone.datetime.min.time())
    )
    week_end_dt = timezone.make_aware(
        timezone.datetime.combine(week_end, timezone.datetime.min.time())
    )
    
    # Check if report already exists
    existing = APIWeeklyReport.objects.filter(
        week_start=week_start,
        week_end=week_end
    ).first()
    
    if existing:
        logger.info(f"Weekly report for {week_start} already exists")
        return existing
    
    # Gather statistics for the week
    logs = APIUsageLog.objects.filter(
        request_at__gte=week_start_dt,
        request_at__lt=week_end_dt
    )
    
    overall_stats = logs.aggregate(
        total=Count('id'),
        errors=Count('id', filter=Q(success=False)),
        avg_time=Avg('response_time_ms')
    )
    
    total_requests = overall_stats['total'] or 0
    total_errors = overall_stats['errors'] or 0
    error_rate = (total_errors / total_requests * 100) if total_requests else 0
    avg_response_time = overall_stats['avg_time'] or 0
    
    # Per-service statistics
    services = APIService.objects.filter(is_active=True)
    service_stats = {}
    
    for service in services:
        service_logs = logs.filter(service=service)
        service_agg = service_logs.aggregate(
            total=Count('id'),
            successful=Count('id', filter=Q(success=True)),
            failed=Count('id', filter=Q(success=False)),
            avg_time=Avg('response_time_ms')
        )
        
        service_stats[service.name] = {
            'total_requests': service_agg['total'] or 0,
            'successful_requests': service_agg['successful'] or 0,
            'failed_requests': service_agg['failed'] or 0,
            'avg_response_time_ms': round(service_agg['avg_time'] or 0, 2),
            'success_rate': (service_agg['successful'] / service_agg['total'] * 100) 
                           if service_agg['total'] else 0
        }
    
    # Top errors
    top_errors_qs = APIError.objects.filter(
        occurred_at__gte=week_start_dt,
        occurred_at__lt=week_end_dt
    ).values('error_type', 'service__name').annotate(
        count=Count('id')
    ).order_by('-count')[:10]
    
    top_errors = [
        {
            'error_type': e['error_type'],
            'service': e['service__name'],
            'count': e['count']
        }
        for e in top_errors_qs
    ]
    
    # Services approaching limits
    approaching_limit_qs = APIQuotaUsage.objects.filter(
        period_start__gte=week_start_dt,
        period_start__lt=week_end_dt,
        quota_percentage_used__gte=75
    ).select_related('service').order_by('-quota_percentage_used')[:10]
    
    services_approaching_limit = [
        {
            'service_name': q.service.name,
            'percentage_used': q.quota_percentage_used,
            'period_type': q.period_type
        }
        for q in approaching_limit_qs
    ]
    
    # Alert summary
    alerts_week = APIAlert.objects.filter(
        triggered_at__gte=week_start_dt,
        triggered_at__lt=week_end_dt
    )
    
    total_alerts = alerts_week.count()
    critical_alerts = alerts_week.filter(severity='critical').count()
    
    # Generate HTML content
    html_content = _generate_report_html(
        week_start=week_start,
        week_end=week_end,
        total_requests=total_requests,
        total_errors=total_errors,
        error_rate=error_rate,
        avg_response_time=avg_response_time,
        service_stats=service_stats,
        top_errors=top_errors,
        services_approaching_limit=services_approaching_limit,
        total_alerts=total_alerts,
        critical_alerts=critical_alerts
    )
    
    # Generate text summary
    summary_text = _generate_report_summary(
        week_start=week_start,
        week_end=week_end,
        total_requests=total_requests,
        total_errors=total_errors,
        error_rate=error_rate,
        service_stats=service_stats,
        critical_alerts=critical_alerts
    )
    
    # Create report record
    report = APIWeeklyReport.objects.create(
        week_start=week_start,
        week_end=week_end,
        total_requests=total_requests,
        total_errors=total_errors,
        error_rate=error_rate,
        avg_response_time_ms=avg_response_time,
        service_stats=service_stats,
        top_errors=top_errors,
        services_approaching_limit=services_approaching_limit,
        total_alerts=total_alerts,
        critical_alerts=critical_alerts,
        html_content=html_content,
        summary_text=summary_text
    )
    
    logger.info(f"Weekly report created: {report.id}")
    
    # Send email
    try:
        admin_email = 'rocketresume@gmail.com'
        subject = f'RocketResume API Monitoring Weekly Report - {week_start.strftime("%B %d, %Y")}'
        
        send_mail(
            subject=subject,
            message=summary_text,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[admin_email],
            html_message=html_content,
            fail_silently=False
        )
        
        report.email_sent = True
        report.email_sent_at = timezone.now()
        report.save(update_fields=['email_sent', 'email_sent_at'])
        
        logger.info(f"Weekly report email sent to {admin_email}")
        
    except Exception as e:
        logger.error(f"Failed to send weekly report email: {e}", exc_info=True)
    
    return report


def _generate_report_html(
    week_start, week_end, total_requests, total_errors, error_rate,
    avg_response_time, service_stats, top_errors, services_approaching_limit,
    total_alerts, critical_alerts
):
    """Generate HTML email content for weekly report."""
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 800px; margin: 0 auto; padding: 20px; }}
            h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }}
            h2 {{ color: #34495e; margin-top: 30px; }}
            .summary {{ background: #ecf0f1; padding: 20px; border-radius: 5px; margin: 20px 0; }}
            .stat {{ display: inline-block; margin: 10px 20px 10px 0; }}
            .stat-label {{ font-weight: bold; color: #7f8c8d; }}
            .stat-value {{ font-size: 1.5em; color: #2c3e50; }}
            table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
            th {{ background: #3498db; color: white; padding: 12px; text-align: left; }}
            td {{ padding: 10px; border-bottom: 1px solid #ddd; }}
            tr:hover {{ background: #f5f5f5; }}
            .alert {{ background: #e74c3c; color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }}
            .warning {{ background: #f39c12; color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }}
            .success {{ background: #27ae60; color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }}
            .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #7f8c8d; font-size: 0.9em; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 RocketResume API Monitoring Weekly Report</h1>
            <p><strong>Report Period:</strong> {week_start.strftime("%B %d, %Y")} - {week_end.strftime("%B %d, %Y")}</p>
            
            <div class="summary">
                <h2>📊 Overall Statistics</h2>
                <div class="stat">
                    <div class="stat-label">Total Requests</div>
                    <div class="stat-value">{total_requests:,}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Total Errors</div>
                    <div class="stat-value">{total_errors:,}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Error Rate</div>
                    <div class="stat-value">{error_rate:.2f}%</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Avg Response Time</div>
                    <div class="stat-value">{avg_response_time:.0f}ms</div>
                </div>
            </div>
            
            {f'<div class="alert">⚠️ <strong>{critical_alerts} Critical Alerts</strong> triggered this week!</div>' if critical_alerts > 0 else ''}
            {f'<div class="warning">⚡ {total_alerts} alerts triggered this week</div>' if total_alerts > 0 else '<div class="success">✅ No alerts triggered this week</div>'}
    """
    
    # Service breakdown
    if service_stats:
        html += """
            <h2>🔧 Per-Service Statistics</h2>
            <table>
                <tr>
                    <th>Service</th>
                    <th>Total Requests</th>
                    <th>Success Rate</th>
                    <th>Avg Response Time</th>
                </tr>
        """
        
        for service_name, stats in sorted(service_stats.items(), key=lambda x: x[1]['total_requests'], reverse=True):
            if stats['total_requests'] > 0:
                html += f"""
                <tr>
                    <td><strong>{service_name}</strong></td>
                    <td>{stats['total_requests']:,}</td>
                    <td>{stats['success_rate']:.1f}%</td>
                    <td>{stats['avg_response_time_ms']:.0f}ms</td>
                </tr>
                """
        
        html += "</table>"
    
    # Top errors
    if top_errors:
        html += """
            <h2>🐛 Top Errors</h2>
            <table>
                <tr>
                    <th>Error Type</th>
                    <th>Service</th>
                    <th>Count</th>
                </tr>
        """
        
        for error in top_errors:
            html += f"""
            <tr>
                <td>{error['error_type']}</td>
                <td>{error['service']}</td>
                <td>{error['count']}</td>
            </tr>
            """
        
        html += "</table>"
    
    # Services approaching limits
    if services_approaching_limit:
        html += """
            <h2>⚡ Services Approaching Rate Limits</h2>
            <table>
                <tr>
                    <th>Service</th>
                    <th>Usage %</th>
                    <th>Period</th>
                </tr>
        """
        
        for service in services_approaching_limit:
            html += f"""
            <tr>
                <td>{service['service_name']}</td>
                <td><strong>{service['percentage_used']:.1f}%</strong></td>
                <td>{service['period_type']}</td>
            </tr>
            """
        
        html += "</table>"
    
    html += """
            <div class="footer">
                <p>This is an automated weekly report from RocketResume API Monitoring System.</p>
                <p>For more details, please access the admin dashboard in the application.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return html


def _generate_report_summary(
    week_start, week_end, total_requests, total_errors,
    error_rate, service_stats, critical_alerts
):
    """Generate plain text summary for weekly report."""
    
    summary = f"""
RocketResume API Monitoring Weekly Report
==========================================

Report Period: {week_start.strftime("%B %d, %Y")} - {week_end.strftime("%B %d, %Y")}

Overall Statistics
------------------
- Total Requests: {total_requests:,}
- Total Errors: {total_errors:,}
- Error Rate: {error_rate:.2f}%
- Critical Alerts: {critical_alerts}

Service Breakdown
-----------------
"""
    
    for service_name, stats in sorted(service_stats.items(), key=lambda x: x[1]['total_requests'], reverse=True):
        if stats['total_requests'] > 0:
            summary += f"\n{service_name}:\n"
            summary += f"  - Requests: {stats['total_requests']:,}\n"
            summary += f"  - Success Rate: {stats['success_rate']:.1f}%\n"
            summary += f"  - Avg Response Time: {stats['avg_response_time_ms']:.0f}ms\n"
    
    summary += """
==========================================
Access the admin dashboard for more details.
"""
    
    return summary


# Celery task wrapper for weekly report
if CELERY_AVAILABLE:
    @shared_task
    def generate_weekly_api_report():
        """Generate and email weekly API monitoring report."""
        return _generate_weekly_api_report_sync()
else:
    def generate_weekly_api_report():
        return _generate_weekly_api_report_sync()


# ========================================
# UC-124: Job Application Timing Optimizer Tasks
# ========================================

def _process_scheduled_submissions_sync():
    """
    Process scheduled submissions that are due.
    This should be called periodically (e.g., every 15 minutes).
    """
    from core.models import ScheduledSubmission
    from django.core.mail import send_mail, EmailMessage
    from django.conf import settings
    
    now = timezone.now()
    
    # Get submissions that are due
    due_submissions = ScheduledSubmission.objects.filter(
        status='scheduled',
        scheduled_datetime__lte=now
    ).select_related('job', 'candidate', 'application_package')
    
    processed_count = 0
    failed_count = 0
    
    for submission in due_submissions:
        try:
            logger.info(f"Processing scheduled submission {submission.id} for job {submission.job.id}")
            
            # Perform actual submission based on method
            if submission.submission_method == 'email':
                _send_application_email(submission)
            elif submission.submission_method == 'portal':
                # For portal submissions, just mark as submitted
                # User would have to manually submit through the portal
                logger.info(f"Portal submission {submission.id} marked for manual completion")
            else:
                logger.info(f"Other submission method for {submission.id}, marking as submitted")
            
            # Mark as submitted
            submission.mark_submitted()
            processed_count += 1
            
            logger.info(f"Successfully processed submission {submission.id}")
            
        except Exception as e:
            logger.error(f"Failed to process submission {submission.id}: {str(e)}")
            submission.status = 'failed'
            submission.error_message = str(e)
            submission.retry_count += 1
            
            # Retry if under max retries
            if submission.retry_count < submission.max_retries:
                submission.status = 'scheduled'
                submission.scheduled_datetime = now + timedelta(minutes=15)
                logger.info(f"Rescheduling submission {submission.id} for retry")
            
            submission.save()
            failed_count += 1
    
    logger.info(f"Processed {processed_count} submissions, {failed_count} failed")
    return {'processed': processed_count, 'failed': failed_count}


def _send_application_email(submission):
    """
    Send application email with resume and cover letter attachments.
    """
    from django.core.mail import EmailMessage
    from django.conf import settings
    import os
    
    job = submission.job
    candidate = submission.candidate
    package = submission.application_package
    user = candidate.user
    
    # Build email subject
    subject = f"Application for {job.title} - {user.get_full_name() or user.email}"
    
    # Build email body
    body = f"""Dear Hiring Manager,

I am writing to express my interest in the {job.title} position at {job.company_name}.

{candidate.summary or 'I am excited about this opportunity and believe my skills and experience make me a strong candidate for this role.'}

Please find attached my resume and cover letter for your consideration.

Thank you for your time and consideration.

Best regards,
{user.get_full_name() or user.first_name or 'Applicant'}
{candidate.phone or ''}
{user.email}
"""
    
    # Get recipient email
    # Try to get from job metadata
    to_email = None
    if hasattr(job, 'metadata') and job.metadata:
        if isinstance(job.metadata, dict):
            to_email = job.metadata.get('contact_email') or job.metadata.get('recruiter_email')
    
    # If no email found, we can't send - mark for manual submission
    if not to_email:
        raise ValueError(f"No recipient email found for job {job.id}. Please add contact email to job metadata or submit manually.")
    
    # Create email message
    email = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
        reply_to=[user.email]
    )
    
    # Attach resume and cover letter if available
    if package:
        # Attach resume
        if package.resume_doc:
            resume_path = package.resume_doc.file_path.path if hasattr(package.resume_doc.file_path, 'path') else None
            if resume_path and os.path.exists(resume_path):
                email.attach_file(resume_path)
            else:
                logger.warning(f"Resume file not found at {resume_path}")
        
        # Attach cover letter
        if package.cover_letter_doc:
            cover_letter_path = package.cover_letter_doc.file_path.path if hasattr(package.cover_letter_doc.file_path, 'path') else None
            if cover_letter_path and os.path.exists(cover_letter_path):
                email.attach_file(cover_letter_path)
            else:
                logger.warning(f"Cover letter file not found at {cover_letter_path}")
    
    # Send email
    try:
        email.send(fail_silently=False)
        logger.info(f"Application email sent to {to_email} for submission {submission.id}")
    except Exception as e:
        logger.error(f"Failed to send application email: {str(e)}")
        raise


def _send_due_reminders_sync():
    """
    Send reminders that are due.
    This should be called periodically (e.g., every 15 minutes).
    """
    from core.models import FollowUpReminder
    from django.core.mail import send_mail
    from django.conf import settings
    
    now = timezone.now()
    
    # Get reminders that are due
    due_reminders = FollowUpReminder.objects.filter(
        status='pending',
        scheduled_datetime__lte=now
    ).select_related('job', 'candidate__user')
    
    sent_count = 0
    failed_count = 0
    
    for reminder in due_reminders:
        try:
            user = reminder.candidate.user
            if not user.email:
                logger.warning(f"No email for reminder {reminder.id}, skipping")
                reminder.status = 'failed'
                reminder.save()
                continue
            
            logger.info(f"Sending reminder {reminder.id} to {user.email}")
            
            # Format the message
            message = reminder.message_template
            message = message.replace('{job_title}', reminder.job.title)
            message = message.replace('{company_name}', reminder.job.company_name)
            message = message.replace('{user_name}', user.get_full_name() or user.email)
            
            # Send email
            send_mail(
                subject=reminder.subject,
                message=message,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com'),
                recipient_list=[user.email],
                fail_silently=False
            )
            
            # Mark as sent and potentially create next occurrence
            reminder.mark_sent()
            sent_count += 1
            
            logger.info(f"Successfully sent reminder {reminder.id}")
            
        except Exception as e:
            logger.error(f"Failed to send reminder {reminder.id}: {str(e)}")
            reminder.status = 'failed'
            reminder.save()
            failed_count += 1
    
    logger.info(f"Sent {sent_count} reminders, {failed_count} failed")
    return {'sent': sent_count, 'failed': failed_count}


def _check_upcoming_deadlines_sync():
    """
    Check for upcoming application deadlines and create reminders.
    This should be called daily.
    """
    from core.models import JobEntry, FollowUpReminder, CandidateProfile
    from datetime import date
    
    today = date.today()
    three_days_from_now = today + timedelta(days=3)
    
    # Find jobs with deadlines in 3 days that don't have reminders
    jobs_with_deadlines = JobEntry.objects.filter(
        application_deadline=three_days_from_now,
        status='interested'
    ).select_related('candidate')
    
    reminder_count = 0
    
    for job in jobs_with_deadlines:
        # Check if reminder already exists
        existing = FollowUpReminder.objects.filter(
            candidate=job.candidate,
            job=job,
            reminder_type='application_deadline',
            status='pending'
        ).exists()
        
        if not existing:
            # Create reminder
            reminder = FollowUpReminder.objects.create(
                candidate=job.candidate,
                job=job,
                reminder_type='application_deadline',
                subject=f"Deadline in 3 days: {job.title} at {job.company_name}",
                message_template=f"Hi {{user_name}},\n\nThis is a reminder that the application deadline for {job.title} at {job.company_name} is in 3 days ({job.application_deadline}).\n\nDon't forget to submit your application!",
                scheduled_datetime=timezone.now() + timedelta(hours=9)  # 9 AM next day
            )
            reminder_count += 1
            logger.info(f"Created deadline reminder {reminder.id} for job {job.id}")
    
    logger.info(f"Created {reminder_count} deadline reminders")
    return {'reminders_created': reminder_count}


# Celery task wrappers
if CELERY_AVAILABLE:
    @shared_task
    def process_scheduled_submissions():
        """Process scheduled submissions that are due."""
        return _process_scheduled_submissions_sync()
    
    @shared_task
    def send_due_reminders():
        """Send reminders that are due."""
        return _send_due_reminders_sync()
    
    @shared_task
    def check_upcoming_deadlines():
        """Check for upcoming deadlines and create reminders."""
        return _check_upcoming_deadlines_sync()
else:
    def process_scheduled_submissions():
        return _process_scheduled_submissions_sync()
    
    def send_due_reminders():
        return _send_due_reminders_sync()
    
    def check_upcoming_deadlines():
        return _check_upcoming_deadlines_sync()

