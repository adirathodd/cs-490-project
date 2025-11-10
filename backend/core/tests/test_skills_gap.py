"""
Tests for UC-066: Skills Gap Analysis

Tests skill extraction, comparison, gap computation, caching, and API endpoints.
"""
import pytest
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status as http_status
from decimal import Decimal

from core.models import (
    CandidateProfile,
    Skill,
    CandidateSkill,
    JobEntry,
    LearningResource,
    SkillGapAnalysisCache,
    SkillDevelopmentProgress,
)
from core.skills_gap_analysis import SkillsGapAnalyzer

User = get_user_model()


class SkillsGapAnalyzerTestCase(TestCase):
    """Test the skills gap analysis logic."""
    
    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        
        # Create some skills
        self.python_skill = Skill.objects.create(name='Python', category='Technical')
        self.js_skill = Skill.objects.create(name='JavaScript', category='Technical')
        self.react_skill = Skill.objects.create(name='React', category='Technical')
        self.sql_skill = Skill.objects.create(name='SQL', category='Technical')
        
        # Give user some skills
        CandidateSkill.objects.create(
            candidate=self.profile,
            skill=self.python_skill,
            level='intermediate',
            years=Decimal('2.0')
        )
        CandidateSkill.objects.create(
            candidate=self.profile,
            skill=self.js_skill,
            level='beginner',
            years=Decimal('0.5')
        )
        
        # Create a job entry
        self.job = JobEntry.objects.create(
            candidate=self.profile,
            title='Full Stack Developer',
            company_name='TechCorp',
            description='Looking for a developer with Python, JavaScript, React, and SQL experience.',
            industry='Software',
            job_type='ft'
        )
    
    def test_skill_extraction_from_description(self):
        """Test that skills are extracted from job description."""
        required_skills = SkillsGapAnalyzer._extract_job_requirements(self.job)
        
        # Should find Python, JavaScript, React, SQL in description
        skill_names = [s['name'] for s in required_skills]
        self.assertIn('Python', skill_names)
        self.assertIn('JavaScript', skill_names)
        self.assertIn('React', skill_names)
        self.assertIn('SQL', skill_names)
    
    def test_skill_extraction_from_title(self):
        """Test that skills are inferred from job title if description parsing fails."""
        job_no_desc = JobEntry.objects.create(
            candidate=self.profile,
            title='Data Scientist',
            company_name='DataCo',
            description='',  # Empty description
        )
        
        required_skills = SkillsGapAnalyzer._extract_job_requirements(job_no_desc)
        
        # Should infer skills for Data Scientist role
        skill_names = [s['name'] for s in required_skills]
        self.assertTrue(len(skill_names) > 0, "Should infer skills from title")
    
    def test_gap_severity_computation_missing_skill(self):
        """Test gap severity when candidate doesn't have the skill."""
        severity = SkillsGapAnalyzer._compute_gap_severity(
            required=True,
            required_level='intermediate',
            candidate_level=None,
            candidate_years=None,
            job_priority=50
        )
        
        # Missing required skill should have high severity
        self.assertGreater(severity, 80)
    
    def test_gap_severity_computation_level_gap(self):
        """Test gap severity based on skill level difference."""
        # Beginner vs Advanced requirement
        severity_high = SkillsGapAnalyzer._compute_gap_severity(
            required=True,
            required_level='advanced',
            candidate_level='beginner',
            candidate_years=Decimal('0.5'),
            job_priority=50
        )
        
        # Intermediate vs Advanced requirement
        severity_low = SkillsGapAnalyzer._compute_gap_severity(
            required=True,
            required_level='advanced',
            candidate_level='intermediate',
            candidate_years=Decimal('2.0'),
            job_priority=50
        )
        
        self.assertGreater(severity_high, severity_low)
    
    def test_full_analysis(self):
        """Test complete analysis generation."""
        analysis = SkillsGapAnalyzer.analyze_job(
            job=self.job,
            candidate_profile=self.profile,
            include_similar_trends=False
        )
        
        # Check structure
        self.assertIn('job_id', analysis)
        self.assertIn('skills', analysis)
        self.assertIn('summary', analysis)
        
        # Check skills data
        skills = analysis['skills']
        self.assertTrue(len(skills) > 0)
        
        # Check first skill has required fields
        first_skill = skills[0]
        self.assertIn('skill_id', first_skill)
        self.assertIn('name', first_skill)
        self.assertIn('gap_severity', first_skill)
        self.assertIn('candidate_level', first_skill)
        self.assertIn('recommended_resources', first_skill)
        self.assertIn('suggested_learning_path', first_skill)
        
        # Check summary
        summary = analysis['summary']
        self.assertIn('top_gaps', summary)
        self.assertIn('total_skills_required', summary)
        self.assertIn('recommended_time_weeks', summary)
    
    def test_analysis_with_trends(self):
        """Test analysis with similar job trends."""
        # Create another similar job
        JobEntry.objects.create(
            candidate=self.profile,
            title='Full Stack Engineer',
            company_name='OtherCo',
            description='Need Python and Docker skills',
        )
        
        analysis = SkillsGapAnalyzer.analyze_job(
            job=self.job,
            candidate_profile=self.profile,
            include_similar_trends=True
        )
        
        self.assertIn('trends', analysis)
        self.assertIn('similar_jobs_count', analysis['trends'])
        self.assertIn('common_missing_skills', analysis['trends'])
    
    def test_auto_create_missing_skills(self):
        """Test that skills not in user's profile are auto-created and included."""
        # Create job with skills that don't exist yet
        initial_skill_count = Skill.objects.count()
        
        job_with_new_skills = JobEntry.objects.create(
            candidate=self.profile,
            title='DevOps Engineer',
            company_name='CloudCo',
            description='Looking for experience with Docker, Kubernetes, and Terraform for cloud infrastructure.',
        )
        
        analysis = SkillsGapAnalyzer.analyze_job(
            job=job_with_new_skills,
            candidate_profile=self.profile,
            include_similar_trends=False
        )
        
        # Should have created new skills
        new_skill_count = Skill.objects.count()
        self.assertGreater(new_skill_count, initial_skill_count)
        
        # Check that Docker, Kubernetes, Terraform are in analysis
        skill_names = [s['name'] for s in analysis['skills']]
        self.assertIn('Docker', skill_names)
        self.assertIn('Kubernetes', skill_names)
        self.assertIn('Terraform', skill_names)
        
        # All should be marked as missing (candidate_level is None)
        docker_skill = next(s for s in analysis['skills'] if s['name'] == 'Docker')
        self.assertIsNone(docker_skill['candidate_level'])
        self.assertGreater(docker_skill['gap_severity'], 80)  # High severity for missing


class SkillsGapAPITestCase(TestCase):
    """Test the skills gap API endpoints."""
    
    def setUp(self):
        """Set up test data and API client."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        
        # Create skills
        self.python_skill = Skill.objects.create(name='Python', category='Technical')
        CandidateSkill.objects.create(
            candidate=self.profile,
            skill=self.python_skill,
            level='intermediate',
            years=Decimal('2.0')
        )
        
        # Create learning resource
        self.resource = LearningResource.objects.create(
            skill=self.python_skill,
            title='Python for Everybody',
            provider='Coursera',
            url='https://example.com/python',
            resource_type='course',
            cost_type='free',
            duration_hours=Decimal('40.0'),
            difficulty_level='beginner',
            credibility_score=90
        )
        
        # Create job
        self.job = JobEntry.objects.create(
            candidate=self.profile,
            title='Python Developer',
            company_name='PyCo',
            description='Looking for Python developer',
        )
        
        # Authenticate
        self.client.force_authenticate(user=self.user)
    
    def test_get_skills_gap_unauthenticated(self):
        """Test that unauthenticated requests are rejected."""
        self.client.force_authenticate(user=None)
        response = self.client.get(f'/api/jobs/{self.job.id}/skills-gap/')
        self.assertEqual(response.status_code, http_status.HTTP_401_UNAUTHORIZED)
    
    def test_get_skills_gap_not_owned(self):
        """Test that users can't access other users' job analyses."""
        other_user = User.objects.create_user(
            username='other',
            email='other@example.com',
            password='testpass'
        )
        other_profile = CandidateProfile.objects.create(user=other_user)
        other_job = JobEntry.objects.create(
            candidate=other_profile,
            title='Test Job',
            company_name='TestCo'
        )
        
        response = self.client.get(f'/api/jobs/{other_job.id}/skills-gap/')
        self.assertEqual(response.status_code, http_status.HTTP_404_NOT_FOUND)
    
    def test_get_skills_gap_success(self):
        """Test successful skills gap analysis."""
        response = self.client.get(f'/api/jobs/{self.job.id}/skills-gap/')
        
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        data = response.json()
        
        # Check structure
        self.assertIn('job_id', data)
        self.assertIn('skills', data)
        self.assertIn('summary', data)
        self.assertEqual(data['job_id'], self.job.id)
    
    def test_skills_gap_caching(self):
        """Test that analysis results are cached."""
        # First call - should generate and cache
        response1 = self.client.get(f'/api/jobs/{self.job.id}/skills-gap/')
        self.assertEqual(response1.status_code, http_status.HTTP_200_OK)
        
        # Check cache was created
        cache_entry = SkillGapAnalysisCache.objects.filter(job=self.job, is_valid=True).first()
        self.assertIsNotNone(cache_entry)
        
        # Second call - should use cache
        response2 = self.client.get(f'/api/jobs/{self.job.id}/skills-gap/')
        self.assertEqual(response2.status_code, http_status.HTTP_200_OK)
        
        # Results should be identical
        self.assertEqual(response1.json(), response2.json())
    
    def test_skills_gap_refresh(self):
        """Test forced refresh of analysis."""
        # Generate initial cache
        self.client.get(f'/api/jobs/{self.job.id}/skills-gap/')
        
        # Modify job description
        self.job.description = 'Now requires advanced Python and Docker'
        self.job.save()
        
        # Refresh analysis
        response = self.client.get(f'/api/jobs/{self.job.id}/skills-gap/?refresh=true')
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        
        # Should have invalidated old cache
        old_cache = SkillGapAnalysisCache.objects.filter(job=self.job, is_valid=False)
        self.assertTrue(old_cache.exists())
    
    def test_skills_gap_with_similar_trends(self):
        """Test including trends across similar jobs."""
        response = self.client.get(f'/api/jobs/{self.job.id}/skills-gap/?include_similar=true')
        
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        data = response.json()
        
        self.assertIn('trends', data)
        self.assertIn('similar_jobs_count', data['trends'])


class SkillProgressAPITestCase(TestCase):
    """Test the skill progress tracking API."""
    
    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.skill = Skill.objects.create(name='Python', category='Technical')
        self.client.force_authenticate(user=self.user)
    
    def test_log_skill_progress(self):
        """Test logging practice/learning activity."""
        data = {
            'activity_type': 'practice',
            'hours_spent': 2.5,
            'progress_percent': 50,
            'notes': 'Completed tutorial exercises',
        }
        
        response = self.client.post(f'/api/skills/{self.skill.id}/progress/', data)
        
        self.assertEqual(response.status_code, http_status.HTTP_201_CREATED)
        result = response.json()
        self.assertEqual(result['hours_spent'], 2.5)
        self.assertEqual(result['progress_percent'], 50)
        
        # Verify record was created
        progress = SkillDevelopmentProgress.objects.filter(
            candidate=self.profile,
            skill=self.skill
        ).first()
        self.assertIsNotNone(progress)
        self.assertEqual(float(progress.hours_spent), 2.5)
    
    def test_get_skill_progress(self):
        """Test retrieving progress history for a skill."""
        # Create some progress records
        SkillDevelopmentProgress.objects.create(
            candidate=self.profile,
            skill=self.skill,
            activity_type='practice',
            hours_spent=Decimal('1.5'),
            progress_percent=30
        )
        SkillDevelopmentProgress.objects.create(
            candidate=self.profile,
            skill=self.skill,
            activity_type='course',
            hours_spent=Decimal('3.0'),
            progress_percent=60
        )
        
        response = self.client.get(f'/api/skills/{self.skill.id}/progress/')
        
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        data = response.json()
        
        self.assertIn('skill', data)
        self.assertIn('total_hours', data)
        self.assertIn('current_progress_percent', data)
        self.assertIn('activities', data)
        
        self.assertEqual(data['total_hours'], 4.5)
        self.assertEqual(data['current_progress_percent'], 60)
        self.assertEqual(len(data['activities']), 2)
    
    def test_invalid_progress_percent(self):
        """Test validation of progress percentage."""
        data = {
            'activity_type': 'practice',
            'hours_spent': 1.0,
            'progress_percent': 150,  # Invalid
        }
        
        response = self.client.post(f'/api/skills/{self.skill.id}/progress/', data)
        self.assertEqual(response.status_code, http_status.HTTP_400_BAD_REQUEST)


class LearningResourceTestCase(TestCase):
    """Test learning resource model and recommendations."""
    
    def setUp(self):
        """Set up test data."""
        self.skill = Skill.objects.create(name='Python', category='Technical')
    
    def test_create_learning_resource(self):
        """Test creating a learning resource."""
        resource = LearningResource.objects.create(
            skill=self.skill,
            title='Python Crash Course',
            provider='Udemy',
            url='https://example.com/course',
            resource_type='course',
            cost_type='paid',
            duration_hours=Decimal('20.0'),
            difficulty_level='beginner',
            rating=Decimal('4.5'),
            credibility_score=85
        )
        
        self.assertEqual(resource.title, 'Python Crash Course')
        self.assertEqual(resource.skill, self.skill)
        self.assertEqual(float(resource.rating), 4.5)
    
    def test_resource_ordering(self):
        """Test that resources are ordered by credibility and rating."""
        # Create resources with different scores
        r1 = LearningResource.objects.create(
            skill=self.skill,
            title='Resource 1',
            provider='Provider A',
            url='https://example.com/1',
            credibility_score=70,
            rating=Decimal('4.0')
        )
        r2 = LearningResource.objects.create(
            skill=self.skill,
            title='Resource 2',
            provider='Provider B',
            url='https://example.com/2',
            credibility_score=90,
            rating=Decimal('4.5')
        )
        r3 = LearningResource.objects.create(
            skill=self.skill,
            title='Resource 3',
            provider='Provider C',
            url='https://example.com/3',
            credibility_score=90,
            rating=Decimal('4.8')
        )
        
        # Query in default order
        resources = list(LearningResource.objects.filter(skill=self.skill))
        
        # Should be ordered by credibility_score desc, then rating desc
        self.assertEqual(resources[0].id, r3.id)  # Highest credibility and rating
        self.assertEqual(resources[1].id, r2.id)
        self.assertEqual(resources[2].id, r1.id)
