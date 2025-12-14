from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import JobEntry, CandidateProfile
import requests
import os

NOMINATIM_BASE_URL = os.environ.get('NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org')
NOMINATIM_USER_AGENT = os.environ.get('NOMINATIM_USER_AGENT', 'cs-490-project/1.0 (local-dev)')

class Command(BaseCommand):
    help = "Geocode JobEntry locations and store lat/lon to avoid runtime lookups"

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=200, help='Max jobs to process')
        parser.add_argument('--force', action='store_true', help='Re-geocode even if lat/lon exists')

    def handle(self, *args, **options):
        limit = options['limit']
        force = options['force']
        headers = {'User-Agent': NOMINATIM_USER_AGENT}
        qs = JobEntry.objects.all().order_by('-id')
        if not force:
            qs = qs.filter(location_lat__isnull=True, location_lon__isnull=True)
        count = 0
        for job in qs[:limit]:
            loc = (job.location or '').strip()
            if not loc:
                # fallback to candidate profile city/state
                profile = job.candidate
                loc = profile.get_full_location() if profile else ''
            if not loc:
                continue
            try:
                resp = requests.get(f"{NOMINATIM_BASE_URL}/search", params={'q': loc, 'format': 'json', 'limit': '1'}, headers=headers, timeout=8)
                resp.raise_for_status()
                data = resp.json() or []
                if data:
                    job.location_lat = float(data[0].get('lat'))
                    job.location_lon = float(data[0].get('lon'))
                    job.location_geo_precision = 'city'
                    job.location_geo_updated_at = timezone.now()
                    job.save(update_fields=['location_lat','location_lon','location_geo_precision','location_geo_updated_at'])
                    count += 1
            except Exception:
                # skip on error, continue
                continue
        self.stdout.write(self.style.SUCCESS(f"Geocoded {count} job entries"))