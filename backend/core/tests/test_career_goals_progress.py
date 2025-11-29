import pytest
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import CareerGoal

User = get_user_model()


@pytest.mark.django_db
class TestCareerGoalProgressAPI:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='goaluser',
            email='goaluser@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.goal = CareerGoal.objects.create(
            user=self.user,
            title='Increase interviews',
            description='Get more interviews each month',
            target_metric='Interviews',
            target_date=timezone.localdate(),
            target_value=Decimal('100')
        )

    def test_update_progress_accepts_decimal_input(self):
        url = reverse('core:update-goal-progress', kwargs={'pk': self.goal.id})

        resp = self.client.post(url, {'current_value': '25.5'}, format='json')

        assert resp.status_code == 200
        self.goal.refresh_from_db()
        assert self.goal.current_value == Decimal('25.50')
        assert self.goal.progress_percentage == Decimal('25.50')

        data = resp.json()
        assert float(data['progress_percentage']) == pytest.approx(25.5, rel=1e-3)
        assert float(data['current_value']) == pytest.approx(25.5, rel=1e-3)

    def test_update_progress_rejects_invalid_values(self):
        url = reverse('core:update-goal-progress', kwargs={'pk': self.goal.id})

        resp = self.client.post(url, {'current_value': 'abc'}, format='json')
        assert resp.status_code == 400
        assert resp.json().get('error') == 'current_value must be a valid number'

        resp = self.client.post(url, {'current_value': '-5'}, format='json')
        assert resp.status_code == 400
        assert resp.json().get('error') == 'current_value must be non-negative'
