import pytest
import datetime as _dt
from datetime import date, timedelta

from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import CandidateProfile, JobEntry

User = get_user_model()


@pytest.mark.django_db
class TestJobsStatsEndpoint:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='statuid', email='stats@example.com', password='pass')
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def test_daily_breakdown_for_month(self):
        # Create jobs on several days in November 2025 and some outside
        # Note: JobEntry.created_at uses auto_now_add, so we create then update the timestamp
        j1 = JobEntry.objects.create(candidate=self.profile, title='J1', company_name='A')
        JobEntry.objects.filter(pk=j1.pk).update(created_at=_dt.datetime(2025, 11, 1, 9, 0, 0, tzinfo=_dt.timezone.utc))
        j2 = JobEntry.objects.create(candidate=self.profile, title='J2', company_name='B')
        JobEntry.objects.filter(pk=j2.pk).update(created_at=_dt.datetime(2025, 11, 2, 10, 0, 0, tzinfo=_dt.timezone.utc))
        j3 = JobEntry.objects.create(candidate=self.profile, title='J3', company_name='C')
        JobEntry.objects.filter(pk=j3.pk).update(created_at=_dt.datetime(2025, 11, 15, 11, 0, 0, tzinfo=_dt.timezone.utc))
        # one in October
        jp = JobEntry.objects.create(candidate=self.profile, title='Prev', company_name='P')
        JobEntry.objects.filter(pk=jp.pk).update(created_at=_dt.datetime(2025, 10, 31, 23, 0, 0, tzinfo=_dt.timezone.utc))

        stats_url = reverse('jobs-stats')
        resp = self.client.get(stats_url, {'month': '2025-11'})
        assert resp.status_code == 200
        payload = resp.json()
        assert 'daily_applications' in payload
        daily = payload['daily_applications']
        # should contain all days of November (30 days)
        assert len(daily) == 30
        # find counts for specific days
        d1 = next((d for d in daily if d['date'].startswith('2025-11-01')), None)
        d2 = next((d for d in daily if d['date'].startswith('2025-11-02')), None)
        d15 = next((d for d in daily if d['date'].startswith('2025-11-15')), None)
        assert d1 and d1['count'] == 1
        assert d2 and d2['count'] == 1
        assert d15 and d15['count'] == 1

    def test_csv_export_scoped_to_month(self):
        # Create two jobs in November and one in December
        n1 = JobEntry.objects.create(candidate=self.profile, title='Nov1', company_name='A')
        JobEntry.objects.filter(pk=n1.pk).update(created_at=_dt.datetime(2025, 11, 5, 9, 0, 0, tzinfo=_dt.timezone.utc))
        n2 = JobEntry.objects.create(candidate=self.profile, title='Nov2', company_name='B')
        JobEntry.objects.filter(pk=n2.pk).update(created_at=_dt.datetime(2025, 11, 20, 9, 0, 0, tzinfo=_dt.timezone.utc))
        d1 = JobEntry.objects.create(candidate=self.profile, title='Dec1', company_name='C')
        JobEntry.objects.filter(pk=d1.pk).update(created_at=_dt.datetime(2025, 12, 1, 9, 0, 0, tzinfo=_dt.timezone.utc))

        stats_url = reverse('jobs-stats')
        resp = self.client.get(stats_url, {'export': 'csv', 'month': '2025-11'})
        assert resp.status_code == 200
        content = resp.content.decode('utf-8')
        # CSV header present
        assert 'id,title,company_name,status,created_at' in content
        # Should include Nov entries
        assert 'Nov1' in content
        assert 'Nov2' in content
        # Should NOT include Dec entry when month scoped
        assert 'Dec1' not in content
