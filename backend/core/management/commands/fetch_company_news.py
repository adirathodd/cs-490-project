import logging
import time

from django.core.management.base import BaseCommand
from django.db.models import Q

from core.models import Company, CompanyResearch
from core.research import fetch_recent_company_news

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Fetch recent company news via free RSS feeds and store in CompanyResearch."

    def add_arguments(self, parser):
        parser.add_argument(
            "--company",
            help="Only update companies matching this (case-insensitive) substring.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Maximum number of companies to process.",
        )
        parser.add_argument(
            "--max-news",
            type=int,
            default=5,
            help="Maximum news items per company (default: 5).",
        )
        parser.add_argument(
            "--sleep",
            type=float,
            default=0.5,
            help="Seconds to sleep between companies to avoid rate limits.",
        )
        parser.add_argument(
            "--missing-only",
            action="store_true",
            help="Only fetch news for companies missing research or news.",
        )

    def handle(self, *args, **options):
        company_filter = options.get("company")
        limit = options.get("limit")
        max_news = options.get("max_news")
        sleep_seconds = options.get("sleep")
        missing_only = options.get("missing_only")

        qs = Company.objects.all().order_by("name")
        if company_filter:
            qs = qs.filter(name__icontains=company_filter)

        if missing_only:
            qs = qs.filter(
                Q(research__isnull=True)
                | Q(research__recent_news__isnull=True)
                | Q(research__recent_news=[])
            )

        if limit:
            qs = qs[:limit]

        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.WARNING("No companies matched criteria."))
            return

        self.stdout.write(
            self.style.NOTICE(
                f"Fetching news for {total} compan{'y' if total == 1 else 'ies'} "
                f"(max {max_news} articles each)..."
            )
        )

        updated = 0
        for idx, company in enumerate(qs, start=1):
            news_items = fetch_recent_company_news(company.name, max_results=max_news)
            if not news_items:
                logger.info("No news found for %s", company.name)
            else:
                research, _ = CompanyResearch.objects.get_or_create(company=company)
                research.recent_news = news_items
                research.save(update_fields=["recent_news", "last_updated"])
                updated += 1
                logger.info("Updated news for %s (%d items)", company.name, len(news_items))

            if sleep_seconds:
                time.sleep(sleep_seconds)

            self._print_progress(idx, total)

        self.stdout.write(
            self.style.SUCCESS(f"Company news refresh complete. Updated {updated} companies.")
        )

    def _print_progress(self, current, total):
        pct = (current / total) * 100
        self.stdout.write(f"[{current}/{total}] {pct:.1f}% complete", ending="\r")
