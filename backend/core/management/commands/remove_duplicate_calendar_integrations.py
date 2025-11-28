from django.core.management.base import BaseCommand
from django.db.models import Count, Q

from core.models import CalendarIntegration

STATUS_PRIORITY = {
    'connected': 4,
    'pending': 3,
    'error': 2,
    'disconnected': 1,
}


class Command(BaseCommand):
    help = "Remove duplicate calendar integrations per candidate/provider/account while keeping the best record."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='List duplicates without deleting anything.',
        )
        parser.add_argument(
            '--provider',
            help='Limit cleanup to a specific provider (e.g. "google").',
        )
        parser.add_argument(
            '--candidate-id',
            type=int,
            help='Limit cleanup to a specific candidate id.',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Print every deletion for audit purposes.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        provider = options.get('provider')
        candidate_id = options.get('candidate_id')
        verbose = options['verbose']

        base_qs = CalendarIntegration.objects.all()
        if provider:
            base_qs = base_qs.filter(provider=provider)
        if candidate_id:
            base_qs = base_qs.filter(candidate_id=candidate_id)

        total_removed = 0
        total_groups = 0

        groups, removed = self._dedupe_by_field(
            base_qs.exclude(external_account_id=''),
            field_name='external_account_id',
            label='account id',
            dry_run=dry_run,
            verbose=verbose,
        )
        total_groups += groups
        total_removed += removed

        groups, removed = self._dedupe_by_field(
            base_qs.filter(external_account_id='').exclude(external_email=''),
            field_name='external_email',
            label='email fallback',
            dry_run=dry_run,
            verbose=verbose,
        )
        total_groups += groups
        total_removed += removed

        if total_groups == 0:
            self.stdout.write(self.style.SUCCESS('No duplicate calendar integrations found.'))
            return

        action = 'would remove' if dry_run else 'removed'
        summary = f"{action} {total_removed} duplicate integration(s) across {total_groups} account grouping(s)."
        if dry_run:
            self.stdout.write(self.style.WARNING(summary))
        else:
            self.stdout.write(self.style.SUCCESS(summary))

    def _dedupe_by_field(self, queryset, *, field_name, label, dry_run, verbose):
        groups = (
            queryset.values('candidate_id', 'provider', field_name)
            .annotate(total=Count('id'))
            .filter(total__gt=1)
        )
        group_count = 0
        removed = 0
        for group in groups:
            group_count += 1
            candidate_id = group['candidate_id']
            provider = group['provider']
            field_value = group[field_name]
            records = list(
                CalendarIntegration.objects.filter(
                    candidate_id=candidate_id,
                    provider=provider,
                    **{field_name: field_value},
                )
            )
            keep, to_remove = self._split_records(records)
            if not to_remove:
                continue

            self.stdout.write(
                f"{label}: candidate={candidate_id} provider={provider} value={field_value} -> keeping {keep.id}, removing {[r.id for r in to_remove]}"
            )
            ids = [record.id for record in to_remove]
            removed += len(ids)
            if dry_run:
                continue
            CalendarIntegration.objects.filter(id__in=ids).delete()
            if verbose:
                for record_id in ids:
                    self.stdout.write(f"  deleted CalendarIntegration id={record_id}")

        return group_count, removed

    def _split_records(self, records):
        if not records:
            return None, []
        sorted_records = sorted(
            records,
            key=lambda r: (
                STATUS_PRIORITY.get(r.status, 0),
                1 if r.sync_enabled else 0,
                r.updated_at or r.created_at,
                r.id,
            ),
            reverse=True,
        )
        keep = sorted_records[0]
        return keep, sorted_records[1:]
