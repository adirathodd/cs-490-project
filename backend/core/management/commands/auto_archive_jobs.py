"""
Management command to auto-archive old jobs (UC-045).

Usage:
    python manage.py auto_archive_jobs --days=90

Archives jobs that are:
- In 'rejected' status and older than X days
- Have expired deadlines older than X days
- In 'offer' status and older than X days (assumed accepted/declined)
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import models
from datetime import timedelta
from core.models import JobEntry
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Auto-archive old job entries based on status and age'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Number of days after which to archive jobs (default: 90)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be archived without actually archiving'
        )

    def handle(self, *args, **options):
        days = options['days']
        dry_run = options['dry_run']
        cutoff_date = timezone.now() - timedelta(days=days)

        self.stdout.write(f"Auto-archiving jobs older than {days} days (cutoff: {cutoff_date.date()})")
        
        # Find jobs to auto-archive
        candidates = JobEntry.objects.filter(
            is_archived=False,
            updated_at__lt=cutoff_date
        ).filter(
            # Auto-archive criteria:
            # 1. Rejected jobs
            # 2. Jobs with expired deadlines
            # 3. Jobs in 'offer' status (assumed accepted/declined)
            models.Q(status='rejected') |
            models.Q(application_deadline__lt=cutoff_date.date()) |
            models.Q(status='offer')
        )

        count = candidates.count()
        
        if dry_run:
            self.stdout.write(self.style.WARNING(f"DRY RUN: Would archive {count} jobs"))
            for job in candidates[:10]:  # Show first 10
                self.stdout.write(f"  - [{job.id}] {job.title} at {job.company_name} (status: {job.status}, updated: {job.updated_at.date()})")
            if count > 10:
                self.stdout.write(f"  ... and {count - 10} more")
        else:
            # Actually archive
            updated = candidates.update(
                is_archived=True,
                archived_at=timezone.now(),
                archive_reason='auto'
            )
            self.stdout.write(self.style.SUCCESS(f"Successfully auto-archived {updated} jobs"))
            logger.info(f"Auto-archived {updated} jobs older than {days} days")

        return
