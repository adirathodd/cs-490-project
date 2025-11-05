"""
UC-035: Model Validation Tests
Tests for model validators, custom methods, and constraints
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from datetime import date, timedelta
from core.models import (
    CandidateProfile, Skill, CandidateSkill, Education,
    WorkExperience, Certification, Project
)

User = get_user_model()


class UserModelTests(TestCase):
    """Test User model"""
    
    def test_create_user(self):
        """Test creating a user"""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        self.assertEqual(user.username, 'testuser')
        self.assertEqual(user.email, 'test@example.com')
        self.assertTrue(user.check_password('testpass123'))
    
    def test_user_string_representation(self):
        """Test __str__ method"""
        user = User.objects.create_user(
            username='john_doe',
            email='john@example.com'
        )
        
        self.assertEqual(str(user), 'john_doe')


class CandidateProfileModelTests(TestCase):
    """Test CandidateProfile model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com',
            first_name='John',
            last_name='Doe'
        )
    
    def test_get_full_name(self):
        """Test get_full_name method"""
        profile = CandidateProfile.objects.create(user=self.user)
        
        self.assertEqual(profile.get_full_name(), 'John Doe')
    
    def test_get_full_location(self):
        """Test get_full_location method"""
        profile = CandidateProfile.objects.create(
            user=self.user,
            city='Boston',
            state='MA'
        )
        
        self.assertEqual(profile.get_full_location(), 'Boston, MA')
    
    def test_get_full_location_city_only(self):
        """Test location with only city"""
        profile = CandidateProfile.objects.create(
            user=self.user,
            city='Boston'
        )
        
        self.assertEqual(profile.get_full_location(), 'Boston')
    
    def test_default_visibility_private(self):
        """Test default visibility is private"""
        profile = CandidateProfile.objects.create(user=self.user)
        
        self.assertEqual(profile.visibility, 'private')
    
    def test_phone_validation(self):
        """Test phone number validation"""
        profile = CandidateProfile.objects.create(
            user=self.user,
            phone='+15551234567'
        )
        
        self.assertEqual(profile.phone, '+15551234567')


class SkillModelTests(TestCase):
    """Test Skill model"""
    
    def test_create_skill(self):
        """Test creating a skill"""
        skill = Skill.objects.create(
            name='Python',
            category='Programming Languages'
        )
        
        self.assertEqual(skill.name, 'Python')
        self.assertEqual(skill.category, 'Programming Languages')
    
    def test_skill_string_representation(self):
        """Test __str__ method"""
        skill = Skill.objects.create(name='Django')
        
        self.assertEqual(str(skill), 'Django')
    
    def test_skill_name_unique(self):
        """Test skill names are unique"""
        Skill.objects.create(name='Python')
        
        with self.assertRaises(IntegrityError):
            Skill.objects.create(name='Python')


class CandidateSkillModelTests(TestCase):
    """Test CandidateSkill model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.skill = Skill.objects.create(name='Python')
    
    def test_create_candidate_skill(self):
        """Test creating candidate skill relationship"""
        cs = CandidateSkill.objects.create(
            candidate=self.profile,
            skill=self.skill,
            level='expert',
            years=5
        )
        
        self.assertEqual(cs.level, 'expert')
        self.assertEqual(cs.years, 5)
    
    def test_unique_profile_skill_combination(self):
        """Test profile-skill combination is unique"""
        CandidateSkill.objects.create(
            candidate=self.profile,
            skill=self.skill
        )
        
        with self.assertRaises(IntegrityError):
            CandidateSkill.objects.create(
                candidate=self.profile,
                skill=self.skill
            )
    
    def test_cascade_delete_on_profile_delete(self):
        """Test candidate skills deleted when profile deleted"""
        CandidateSkill.objects.create(
            candidate=self.profile,
            skill=self.skill
        )
        
        self.profile.delete()
        
        self.assertEqual(CandidateSkill.objects.count(), 0)


class EducationModelTests(TestCase):
    """Test Education model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
    
    def test_create_education(self):
        """Test creating education entry"""
        education = Education.objects.create(
            candidate=self.profile,
            institution='MIT',
            degree_type='BS',
            field_of_study='Computer Science',
            start_date=date(2018, 9, 1),
            end_date=date(2022, 5, 31),
            gpa=3.8
        )
        
        self.assertEqual(education.institution, 'MIT')
        self.assertEqual(float(education.gpa), 3.8)
    
    def test_currently_enrolled_no_end_date(self):
        """Test currently enrolled logic"""
        education = Education.objects.create(
            candidate=self.profile,
            institution='Harvard',
            degree_type='MS',
            field_of_study='AI',
            start_date=date(2023, 9, 1),
            currently_enrolled=True
        )
        
        self.assertTrue(education.currently_enrolled)
        self.assertIsNone(education.end_date)
    
    def test_education_string_representation(self):
        """Test __str__ method"""
        education = Education.objects.create(
            candidate=self.profile,
            institution='Stanford',
            degree_type='PhD',
            field_of_study='ML',
            start_date=date(2020, 9, 1)
        )
        
        expected = 'PhD in ML - Stanford'
        self.assertEqual(str(education), expected)


class WorkExperienceModelTests(TestCase):
    """Test WorkExperience model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
    
    def test_create_work_experience(self):
        """Test creating work experience"""
        work_exp = WorkExperience.objects.create(
            candidate=self.profile,
            job_title='Software Engineer',
            company_name='Tech Corp',
            location='San Francisco, CA',
            start_date=date(2020, 1, 1),
            end_date=date(2022, 12, 31),
            description='Developed applications'
        )
        
        self.assertEqual(work_exp.job_title, 'Software Engineer')
        self.assertEqual(work_exp.company_name, 'Tech Corp')
    
    def test_is_current_no_end_date(self):
        """Test current job has no end date"""
        work_exp = WorkExperience.objects.create(
            candidate=self.profile,
            job_title='Senior Engineer',
            company_name='Current Corp',
            start_date=date(2023, 1, 1),
            is_current=True
        )
        
        self.assertTrue(work_exp.is_current)
        self.assertIsNone(work_exp.end_date)
    
    def test_work_experience_string_representation(self):
        """Test __str__ method"""
        work_exp = WorkExperience.objects.create(
            candidate=self.profile,
            job_title='Developer',
            company_name='Startup Inc',
            start_date=date(2021, 6, 1),
            end_date=date(2023, 6, 1)
        )
        
        expected = 'Developer at Startup Inc'
        self.assertEqual(str(work_exp), expected)


class CertificationModelTests(TestCase):
    """Test Certification model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
    
    def test_create_certification(self):
        """Test creating certification"""
        cert = Certification.objects.create(
            candidate=self.profile,
            name='AWS Solutions Architect',
            issuing_organization='Amazon',
            issue_date=date(2023, 6, 1),
            expiry_date=date(2026, 6, 1)
        )
        
        self.assertEqual(cert.name, 'AWS Solutions Architect')
        self.assertFalse(cert.is_expired)
    
    def test_never_expires_no_expiry_date(self):
        """Test never_expires logic"""
        cert = Certification.objects.create(
            candidate=self.profile,
            name='Scrum Master',
            issuing_organization='Scrum Alliance',
            issue_date=date(2022, 1, 1),
            never_expires=True
        )
        
        self.assertTrue(cert.never_expires)
        self.assertIsNone(cert.expiry_date)
        self.assertFalse(cert.is_expired)
    
    def test_is_expired_method(self):
        """Test is_expired method"""
        past_cert = Certification.objects.create(
            candidate=self.profile,
            name='Old Cert',
            issuing_organization='Org',
            issue_date=date(2019, 1, 1),
            expiry_date=date(2020, 1, 1)
        )
        
        self.assertTrue(past_cert.is_expired)
    
    def test_days_until_expiration(self):
        """Test days_until_expiration method"""
        future_expiry = date.today() + timedelta(days=30)
        cert = Certification.objects.create(
            candidate=self.profile,
            name='Test Cert',
            issuing_organization='Test Org',
            issue_date=date.today() - timedelta(days=365),
            expiry_date=future_expiry
        )
        
        days = cert.days_until_expiration
        self.assertIsNotNone(days)
        self.assertGreater(days, 0)


class ProjectModelTests(TestCase):
    """Test Project model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
    
    def test_create_project(self):
        """Test creating project"""
        project = Project.objects.create(
            candidate=self.profile,
            name='E-commerce Platform',
            description='Built scalable platform',
            start_date=date(2022, 1, 1),
            end_date=date(2022, 6, 1),
            status='completed',
            project_url='https://example.com',
            team_size=5
        )
        
        self.assertEqual(project.name, 'E-commerce Platform')
        self.assertEqual(project.team_size, 5)
    
    def test_project_status_choices(self):
        """Test project status validation"""
        project = Project.objects.create(
            candidate=self.profile,
            name='Test Project',
            description='Test',
            start_date=date(2023, 1, 1),
            status='in_progress'
        )
        
        self.assertEqual(project.status, 'in_progress')
    
    def test_project_string_representation(self):
        """Test __str__ method"""
        project = Project.objects.create(
            candidate=self.profile,
            name='Portfolio Website',
            description='Personal portfolio',
            start_date=date(2023, 1, 1),
            status='completed'
        )
        
        self.assertEqual(str(project), 'Portfolio Website')
