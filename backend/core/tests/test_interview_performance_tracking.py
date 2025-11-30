"""
UC-098: Interview Performance Tracking - Backend Tests
Tests for InterviewPerformanceTracker analytics service and API endpoint
"""
import pytest
from datetime import datetime, timedelta
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from core.models import (
    CandidateProfile,
    InterviewEvent,
    MockInterviewSession,
    QuestionResponseCoaching,
    JobEntry,
)
from core.interview_performance_tracking import InterviewPerformanceTracker


@pytest.fixture
def user(db):
    """Create a test user with profile"""
    user = User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
    )
    # Create profile if it doesn't exist (signals may not fire in tests)
    if not hasattr(user, 'profile'):
        CandidateProfile.objects.create(user=user)
    return user


@pytest.fixture
def job_entry(user):
    """Create a test job entry"""
    return JobEntry.objects.create(
        candidate_profile=user.profile,
        company_name='TechCorp',
        job_title='Software Engineer',
        industry='Technology'
    )


@pytest.fixture
def interviews(user, job_entry):
    """Create test interviews with various outcomes"""
    base_date = timezone.now() - timedelta(days=90)
    interviews = []
    
    # Create 10 interviews: 3 offers, 5 rejections, 2 pending
    outcomes = ['offer_received'] * 3 + ['rejected'] * 5 + ['pending'] * 2
    formats = ['phone_screen', 'video', 'in_person', 'panel', 'technical', 'behavioral'] * 2
    
    for i, (outcome, format_type) in enumerate(zip(outcomes, formats[:10])):
        interview = InterviewEvent.objects.create(
            candidate_profile=user.profile,
            job_entry=job_entry,
            interview_type=format_type,
            scheduled_at=base_date + timedelta(days=i*10),
            outcome=outcome,
            confidence_level=3 + (i % 3),  # 3, 4, or 5
            notes=f'Test interview {i+1}'
        )
        interviews.append(interview)
    
    return interviews


@pytest.fixture
def mock_sessions(user):
    """Create test mock interview sessions"""
    sessions = []
    base_date = timezone.now() - timedelta(days=60)
    
    for i in range(5):
        session = MockInterviewSession.objects.create(
            candidate_profile=user.profile,
            interview_type='technical' if i % 2 == 0 else 'behavioral',
            overall_score=70 + i*5,  # 70, 75, 80, 85, 90
            communication_score=75,
            technical_score=80,
            confidence_score=70 + i*5,
            notes=f'Mock session {i+1}',
            date=base_date + timedelta(days=i*10)
        )
        sessions.append(session)
    
    return sessions


@pytest.fixture
def coaching_feedback(user):
    """Create test coaching feedback"""
    feedback_list = []
    
    for i in range(5):
        feedback = QuestionResponseCoaching.objects.create(
            candidate_profile=user.profile,
            question='Tell me about yourself',
            user_response=f'Test response {i+1}',
            clarity_score=70 + i*5,
            relevance_score=75,
            specificity_score=80,
            structure_score=70 + i*5,
            confidence_score=75,
            feedback=f'Good response, but could improve on clarity' if i % 2 == 0 else 'Strong answer',
            created_at=timezone.now() - timedelta(days=30-i*5)
        )
        feedback_list.append(feedback)
    
    return feedback_list


@pytest.mark.django_db
class TestInterviewPerformanceTracker:
    """Tests for InterviewPerformanceTracker analytics service"""
    
    def test_tracker_initialization(self, user):
        """Test tracker can be initialized with a candidate profile"""
        tracker = InterviewPerformanceTracker(user.profile)
        assert tracker.candidate == user.profile
    
    def test_conversion_rates_over_time_empty(self, user):
        """Test conversion rates with no data"""
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.get_conversion_rates_over_time()
        assert isinstance(result, list)
        assert len(result) == 0
    
    def test_conversion_rates_over_time_with_data(self, user, interviews):
        """Test conversion rates calculation with data"""
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.get_conversion_rates_over_time(period='month')
        
        assert isinstance(result, list)
        assert len(result) > 0
        
        # Check structure of each item
        for item in result:
            assert 'period' in item
            assert 'conversion_rate' in item
            assert 'rejection_rate' in item
            assert 'total_interviews' in item
            assert 0 <= item['conversion_rate'] <= 100
            assert 0 <= item['rejection_rate'] <= 100
    
    def test_analyze_by_interview_format(self, user, interviews):
        """Test performance breakdown by interview format"""
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.analyze_by_interview_format()
        
        assert isinstance(result, list)
        assert len(result) > 0
        
        # Check structure
        for item in result:
            assert 'format' in item
            assert 'format_label' in item
            assert 'total_interviews' in item
            assert 'conversion_rate' in item
            assert 'avg_confidence' in item
    
    def test_track_mock_to_real_improvement(self, user, interviews, mock_sessions):
        """Test mock to real improvement tracking"""
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.track_mock_to_real_improvement()
        
        assert isinstance(result, dict)
        assert result['total_mock_sessions'] == 5
        assert result['total_real_interviews'] > 0
        assert 'mock_average_score' in result
        assert 'real_average_score' in result
        assert 'improvement_trend' in result
    
    def test_analyze_by_industry(self, user, interviews):
        """Test performance analysis by industry"""
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.analyze_by_industry()
        
        assert isinstance(result, list)
        if len(result) > 0:
            for item in result:
                assert 'industry' in item
                assert 'total_interviews' in item
                assert 'conversion_rate' in item
                assert 'avg_confidence' in item
    
    def test_track_feedback_themes(self, user, coaching_feedback):
        """Test feedback themes analysis"""
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.track_feedback_themes()
        
        assert isinstance(result, dict)
        assert 'improvement_areas' in result
        assert 'positive_themes' in result
        assert isinstance(result['improvement_areas'], list)
    
    def test_monitor_confidence_progression(self, user, interviews):
        """Test confidence progression tracking"""
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.monitor_confidence_progression()
        
        assert isinstance(result, dict)
        assert 'current_avg_confidence' in result
        assert 'previous_avg_confidence' in result
        assert 'trend_percentage' in result
        assert 'confidence_progression' in result
        assert isinstance(result['confidence_progression'], list)
    
    def test_generate_coaching_recommendations(self, user, interviews, mock_sessions):
        """Test coaching recommendations generation"""
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.generate_coaching_recommendations()
        
        assert isinstance(result, list)
        
        # Check structure of recommendations
        for rec in result:
            assert 'category' in rec
            assert 'priority' in rec
            assert 'recommendation' in rec
            assert 'action' in rec
            assert rec['priority'] in ['high', 'medium', 'low']
    
    def test_benchmark_against_patterns(self, user, interviews, mock_sessions):
        """Test benchmarking against industry patterns"""
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.benchmark_against_patterns()
        
        assert isinstance(result, dict)
        assert 'user_metrics' in result
        assert 'comparison' in result
        
        # Check comparison structure
        comparison = result['comparison']
        for metric, data in comparison.items():
            assert 'user_value' in data
            assert 'benchmark_range' in data
            assert 'status' in data
            assert 'message' in data
            assert data['status'] in ['excellent', 'good', 'fair', 'needs_improvement']
    
    def test_get_complete_analysis(self, user, interviews, mock_sessions, coaching_feedback):
        """Test complete analysis returns all dimensions"""
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.get_complete_analysis()
        
        assert isinstance(result, dict)
        
        # Check all 8 dimensions are present
        assert 'conversion_rates_over_time' in result
        assert 'performance_by_format' in result
        assert 'mock_to_real_improvement' in result
        assert 'performance_by_industry' in result
        assert 'feedback_themes' in result
        assert 'confidence_progression' in result
        assert 'coaching_recommendations' in result
        assert 'benchmark_comparison' in result
    
    def test_high_conversion_rate_benchmark(self, user, job_entry):
        """Test benchmark status with high conversion rate"""
        # Create 5 interviews, all offers
        for i in range(5):
            InterviewEvent.objects.create(
                candidate_profile=user.profile,
                job_entry=job_entry,
                interview_type='phone_screen',
                scheduled_at=timezone.now() - timedelta(days=30-i*5),
                outcome='offer_received',
                confidence_level=5
            )
        
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.benchmark_against_patterns()
        
        # 100% conversion rate should be "excellent"
        assert result['comparison']['conversion_rate']['status'] == 'excellent'
    
    def test_low_conversion_rate_benchmark(self, user, job_entry):
        """Test benchmark status with low conversion rate"""
        # Create 10 interviews, all rejections
        for i in range(10):
            InterviewEvent.objects.create(
                candidate_profile=user.profile,
                job_entry=job_entry,
                interview_type='phone_screen',
                scheduled_at=timezone.now() - timedelta(days=60-i*5),
                outcome='rejected',
                confidence_level=2
            )
        
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.benchmark_against_patterns()
        
        # 0% conversion rate should be "needs_improvement"
        assert result['comparison']['conversion_rate']['status'] == 'needs_improvement'


@pytest.mark.django_db
class TestInterviewPerformanceTrackingAPI:
    """Tests for the API endpoint"""
    
    def test_unauthenticated_access_denied(self):
        """Test that unauthenticated requests are rejected"""
        client = APIClient()
        response = client.get('/api/interviews/performance-tracking/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_authenticated_access_no_data(self, user):
        """Test authenticated access with no interview data"""
        client = APIClient()
        client.force_authenticate(user=user)
        
        response = client.get('/api/interviews/performance-tracking/')
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert isinstance(data, dict)
        assert 'conversion_rates_over_time' in data
        assert 'performance_by_format' in data
    
    def test_authenticated_access_with_data(self, user, interviews, mock_sessions, coaching_feedback):
        """Test authenticated access with complete data"""
        client = APIClient()
        client.force_authenticate(user=user)
        
        response = client.get('/api/interviews/performance-tracking/')
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        
        # Check all 8 dimensions are present
        assert 'conversion_rates_over_time' in data
        assert 'performance_by_format' in data
        assert 'mock_to_real_improvement' in data
        assert 'performance_by_industry' in data
        assert 'feedback_themes' in data
        assert 'confidence_progression' in data
        assert 'coaching_recommendations' in data
        assert 'benchmark_comparison' in data
        
        # Verify data structure
        assert isinstance(data['conversion_rates_over_time'], list)
        assert isinstance(data['performance_by_format'], list)
        assert isinstance(data['mock_to_real_improvement'], dict)
        assert isinstance(data['coaching_recommendations'], list)
    
    def test_response_structure_validation(self, user, interviews):
        """Test that response structure matches expected format"""
        client = APIClient()
        client.force_authenticate(user=user)
        
        response = client.get('/api/interviews/performance-tracking/')
        data = response.json()
        
        # Validate conversion rates structure
        if len(data['conversion_rates_over_time']) > 0:
            item = data['conversion_rates_over_time'][0]
            assert 'period' in item
            assert 'conversion_rate' in item
            assert 'rejection_rate' in item
        
        # Validate performance by format structure
        if len(data['performance_by_format']) > 0:
            item = data['performance_by_format'][0]
            assert 'format' in item
            assert 'format_label' in item
            assert 'total_interviews' in item
            assert 'conversion_rate' in item
        
        # Validate mock to real improvement structure
        mock_data = data['mock_to_real_improvement']
        assert 'total_mock_sessions' in mock_data
        assert 'total_real_interviews' in mock_data
        
        # Validate coaching recommendations structure
        if len(data['coaching_recommendations']) > 0:
            rec = data['coaching_recommendations'][0]
            assert 'category' in rec
            assert 'priority' in rec
            assert 'recommendation' in rec
            assert 'action' in rec
        
        # Validate benchmark comparison structure
        assert 'user_metrics' in data['benchmark_comparison']
        assert 'comparison' in data['benchmark_comparison']


@pytest.mark.django_db
class TestEdgeCases:
    """Test edge cases and boundary conditions"""
    
    def test_single_interview_conversion_rate(self, user, job_entry):
        """Test conversion rate with only one interview"""
        InterviewEvent.objects.create(
            candidate_profile=user.profile,
            job_entry=job_entry,
            interview_type='phone_screen',
            scheduled_at=timezone.now(),
            outcome='offer_received',
            confidence_level=4
        )
        
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.get_conversion_rates_over_time()
        
        assert len(result) > 0
        assert result[0]['conversion_rate'] == 100.0
    
    def test_all_pending_interviews(self, user, job_entry):
        """Test with all interviews in pending status"""
        for i in range(5):
            InterviewEvent.objects.create(
                candidate_profile=user.profile,
                job_entry=job_entry,
                interview_type='phone_screen',
                scheduled_at=timezone.now() + timedelta(days=i),
                outcome='pending',
                confidence_level=3
            )
        
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.get_conversion_rates_over_time()
        
        # Pending interviews should not affect conversion rate
        assert len(result) == 0 or all(item['total_interviews'] == 0 for item in result)
    
    def test_single_format_only(self, user, job_entry):
        """Test with all interviews being the same format"""
        for i in range(5):
            InterviewEvent.objects.create(
                candidate_profile=user.profile,
                job_entry=job_entry,
                interview_type='phone_screen',
                scheduled_at=timezone.now() - timedelta(days=30-i*5),
                outcome='offer_received' if i % 2 == 0 else 'rejected',
                confidence_level=4
            )
        
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.analyze_by_interview_format()
        
        # Should still return valid data for that one format
        assert len(result) == 1
        assert result[0]['format'] == 'phone_screen'
    
    def test_very_old_data_filtering(self, user, job_entry):
        """Test that very old data is handled correctly"""
        # Create interview from 2 years ago
        InterviewEvent.objects.create(
            candidate_profile=user.profile,
            job_entry=job_entry,
            interview_type='phone_screen',
            scheduled_at=timezone.now() - timedelta(days=730),
            outcome='offer_received',
            confidence_level=4
        )
        
        tracker = InterviewPerformanceTracker(user.profile)
        result = tracker.get_complete_analysis()
        
        # Should not crash, should return valid structure
        assert isinstance(result, dict)
        assert 'conversion_rates_over_time' in result
