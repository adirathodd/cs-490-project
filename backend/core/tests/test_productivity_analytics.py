import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from datetime import timedelta
from core.models import (
    CandidateProfile,
    JobEntry,
    MockInterviewSession,
    Skill,
    SkillDevelopmentProgress,
    ApplicationGoal,
    InterviewPreparationTask,
    Interaction,
    NetworkingEvent
)
from core.productivity_analytics import ProductivityAnalyzer

User = get_user_model()


@pytest.mark.django_db
class TestProductivityAnalytics:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='productivity', email='prod@example.com', password='pass')
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def test_productivity_analytics_shapes_response(self):
        skill = Skill.objects.create(name='Python')
        SkillDevelopmentProgress.objects.create(
            candidate=self.profile,
            skill=skill,
            hours_spent=1.5,
        )

        job = JobEntry.objects.create(candidate=self.profile, title='Engineer', company_name='ACME', status='applied')
        job.application_history = [{'action': 'Applied', 'timestamp': timezone.now().isoformat()}]
        job.save(update_fields=['application_history'])

        MockInterviewSession.objects.create(
            user=self.user,
            interview_type='behavioral',
            status='completed',
            total_duration_seconds=900,
        )

        url = reverse('productivity-analytics')
        resp = self.client.get(url)
        assert resp.status_code == 200

        payload = resp.json()
        assert 'time_investment' in payload
        assert payload['time_investment']['total_hours'] > 0
        assert 'patterns' in payload
        assert isinstance(payload['patterns'].get('by_time_block', []), list)
        assert 'recommendations' in payload

    def test_time_tracking_accuracy(self):
        """Test that time is correctly aggregated from different sources."""
        # 1. Skill Development: 2 hours
        skill = Skill.objects.create(name='Django')
        SkillDevelopmentProgress.objects.create(
            candidate=self.profile,
            skill=skill,
            hours_spent=2.0,
            activity_date=timezone.now()
        )

        # 2. Mock Interview: 30 mins (1800 seconds)
        MockInterviewSession.objects.create(
            user=self.user,
            interview_type='technical',
            status='completed',
            total_duration_seconds=1800,
            started_at=timezone.now()
        )

        # 3. Networking: 1 hour (60 mins)
        from core.models import Contact
        contact = Contact.objects.create(owner=self.user, first_name="Recruiter")
        Interaction.objects.create(
            owner=self.user,
            contact=contact,
            type="call",
            date=timezone.now(),
            duration_minutes=60
        )

        analyzer = ProductivityAnalyzer(self.profile)
        data = analyzer.build()
        
        time_inv = data['time_investment']
        activities = time_inv['activities']

        # Check Skill Development
        assert activities['skill_development']['hours'] == 2.0
        
        # Check Interview Prep (Mock Interview)
        # 30 mins = 0.5 hours
        assert activities['interview_preparation']['hours'] == 0.5

        # Check Networking
        assert activities['networking']['hours'] == 1.0

        # Total should be 3.5 hours
        assert time_inv['total_hours'] == 3.5

    def test_burnout_risk_detection(self):
        """Test that late night sessions trigger burnout risk."""
        # Create 3 late night sessions (after 10 PM / 22:00)
        late_night = timezone.now().replace(hour=23, minute=0)
        
        from core.models import Contact
        contact = Contact.objects.create(owner=self.user, first_name="Late Contact")
        
        for i in range(3):
            Interaction.objects.create(
                owner=self.user,
                contact=contact,
                type="email",
                date=late_night - timedelta(days=i),
                duration_minutes=30
            )

        analyzer = ProductivityAnalyzer(self.profile)
        data = analyzer.build()
        
        balance = data['balance']
        assert balance['late_sessions'] >= 3
        assert balance['burnout_risk'] is True
        
        recommendations = data['recommendations']
        assert any("burnout" in r.lower() or "late-night" in r.lower() for r in recommendations)

    def test_completion_metrics(self):
        """Test goal and task completion rates."""
        today = timezone.now().date()
        next_week = today + timedelta(days=7)
        
        ApplicationGoal.objects.create(
            candidate=self.profile, 
            goal_type="weekly_applications", 
            target_value=10, 
            is_completed=True,
            start_date=today,
            end_date=next_week
        )
        ApplicationGoal.objects.create(
            candidate=self.profile, 
            goal_type="interviews_per_month", 
            target_value=5, 
            is_completed=False,
            start_date=today,
            end_date=next_week
        )

        analyzer = ProductivityAnalyzer(self.profile)
        data = analyzer.build()
        
        completion = data['completion']
        assert completion['counts']['goals'] == 2
        assert completion['counts']['completed_goals'] == 1
        assert completion['goal_completion_rate'] == 50.0

    def test_outcome_links_and_efficiency(self):
        """Test efficiency metrics like responses per hour."""
        JobEntry.objects.create(candidate=self.profile, title='Job 1', status='applied')
        JobEntry.objects.create(candidate=self.profile, title='Job 2', status='interview')
        
        analyzer = ProductivityAnalyzer(self.profile)
        data = analyzer.build()
        
        outcomes = data['outcomes']
        assert outcomes['applications'] == 2
        assert outcomes['responses'] == 1
        assert outcomes['interviews'] == 1
        
        assert outcomes['responses_per_hour'] >= 0
        assert outcomes['interviews_per_hour'] >= 0

    def test_recommendations_generation(self):
        """Test that specific scenarios trigger recommendations."""
        # Scenario: Low networking (no events created)
        analyzer = ProductivityAnalyzer(self.profile)
        data = analyzer.build()
        
        recs = data['recommendations']
        assert any("networking" in r.lower() for r in recs)
