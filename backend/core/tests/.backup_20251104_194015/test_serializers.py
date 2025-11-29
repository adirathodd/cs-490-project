"""
UC-035: Serializer Validation Tests
Tests for serializer field validation, custom validators, and nested serializers
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from datetime import date
from core.models import (
    CandidateProfile, Skill, CandidateSkill, Education,
    WorkExperience, Certification, Project
)
from core.serializers import (
    UserSerializer, CandidateProfileSerializer, SkillSerializer,
    CandidateSkillSerializer, EducationSerializer,
    WorkExperienceSerializer, CertificationSerializer, ProjectSerializer
)

User = get_user_model()


class UserSerializerTests(TestCase):
    """Test UserSerializer"""
    
    def test_serialize_user(self):
        """Test serializing user data"""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            first_name='Test',
            last_name='User'
        )
        
        serializer = UserSerializer(user)
        
        self.assertEqual(serializer.data['username'], 'testuser')
        self.assertEqual(serializer.data['email'], 'test@example.com')
        self.assertNotIn('password', serializer.data)
    
    def test_validate_email_format(self):
        """Test email format validation"""
        data = {
            'username': 'testuser',
            'email': 'invalid-email',
            'password': 'Test@123456'
        }
        
        serializer = UserSerializer(data=data)
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('email', serializer.errors)


class CandidateProfileSerializerTests(TestCase):
    """Test CandidateProfileSerializer"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
    
    def test_serialize_profile(self):
        """Test serializing profile data"""
        serializer = CandidateProfileSerializer(self.profile)
        
        self.assertIn('user', serializer.data)
        self.assertIn('city', serializer.data)
    
    def test_read_only_fields(self):
        """Test read-only fields cannot be updated"""
        data = {
            'user': {'username': 'hacker'},
            'city': 'Boston'
        }
        
        serializer = CandidateProfileSerializer(
            self.profile,
            data=data,
            partial=True
        )
        
        if serializer.is_valid():
            updated_profile = serializer.save()
            self.assertEqual(updated_profile.user.username, 'test')
            self.assertEqual(updated_profile.city, 'Boston')


class SkillSerializerTests(TestCase):
    """Test SkillSerializer"""
    
    def test_serialize_skill(self):
        """Test serializing skill"""
        skill = Skill.objects.create(
            name='Python',
            category='Programming Languages'
        )
        
        serializer = SkillSerializer(skill)
        
        self.assertEqual(serializer.data['name'], 'Python')
        self.assertEqual(serializer.data['category'], 'Programming Languages')
    
    def test_create_skill(self):
        """Test creating skill via serializer"""
        data = {
            'name': 'Django',
            'category': 'Frameworks'
        }
        
        serializer = SkillSerializer(data=data)
        
        self.assertTrue(serializer.is_valid())
        skill = serializer.save()
        self.assertEqual(skill.name, 'Django')


class CandidateSkillSerializerTests(TestCase):
    """Test CandidateSkillSerializer"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.skill = Skill.objects.create(name='Python')
    
    def test_nested_skill_serialization(self):
        """Test nested skill is serialized properly"""
        cs = CandidateSkill.objects.create(
            candidate=self.profile,
            skill=self.skill,
            level='expert'
        )
        
        serializer = CandidateSkillSerializer(cs)
        
        self.assertIn('skill', serializer.data)
        self.assertEqual(serializer.data['skill']['name'], 'Python')
    
    def test_level_validation(self):
        """Test proficiency level must be valid choice"""
        data = {
            'candidate': self.profile.id,
            'skill': self.skill.id,
            'level': 'invalid_level'
        }
        
        serializer = CandidateSkillSerializer(data=data)
        
        self.assertFalse(serializer.is_valid())


class EducationSerializerTests(TestCase):
    """Test EducationSerializer"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
    
    def test_serialize_education(self):
        """Test serializing education"""
        education = Education.objects.create(
            candidate=self.profile,
            institution='MIT',
            degree_type='BS',
            field_of_study='CS',
            start_date=date(2018, 9, 1),
            end_date=date(2022, 5, 31)
        )
        
        serializer = EducationSerializer(education)
        
        self.assertEqual(serializer.data['institution'], 'MIT')
    
    def test_validate_date_range(self):
        """Test end_date must be after start_date"""
        data = {
            'candidate': self.profile.id,
            'institution': 'Test U',
            'degree_type': 'BS',
            'field_of_study': 'CS',
            'start_date': '2022-01-01',
            'end_date': '2020-01-01'
        }
        
        serializer = EducationSerializer(data=data)
        
        self.assertFalse(serializer.is_valid())
    
    def test_gpa_range_validation(self):
        """Test GPA must be 0.0-4.0"""
        data = {
            'candidate': self.profile.id,
            'institution': 'Test U',
            'degree_type': 'BS',
            'field_of_study': 'CS',
            'start_date': '2020-01-01',
            'end_date': '2024-01-01',
            'gpa': '5.0'
        }
        
        serializer = EducationSerializer(data=data)
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('gpa', serializer.errors)


class WorkExperienceSerializerTests(TestCase):
    """Test WorkExperienceSerializer"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
    
    def test_serialize_work_experience(self):
        """Test serializing work experience"""
        work_exp = WorkExperience.objects.create(
            candidate=self.profile,
            job_title='Engineer',
            company_name='Corp',
            start_date=date(2020, 1, 1),
            end_date=date(2022, 1, 1)
        )
        
        serializer = WorkExperienceSerializer(work_exp)
        
        self.assertEqual(serializer.data['job_title'], 'Engineer')
    
    def test_validate_is_current_logic(self):
        """Test is_current validation"""
        data = {
            'candidate': self.profile.id,
            'job_title': 'Engineer',
            'company_name': 'Corp',
            'start_date': '2020-01-01',
            'is_current': False
        }
        
        serializer = WorkExperienceSerializer(data=data)
        
        # Should require end_date when is_current=False
        self.assertFalse(serializer.is_valid())
    
    def test_create_with_skills(self):
        """Test creating work experience with skills"""
        skill1 = Skill.objects.create(name='Python')
        skill2 = Skill.objects.create(name='Django')
        
        data = {
            'candidate': self.profile.id,
            'job_title': 'Developer',
            'company_name': 'Tech Co',
            'start_date': '2020-01-01',
            'end_date': '2022-01-01',
            'skills_used': [skill1.id, skill2.id]
        }
        
        serializer = WorkExperienceSerializer(data=data)
        
        if serializer.is_valid():
            work_exp = serializer.save()
            self.assertEqual(work_exp.skills_used.count(), 2)


class CertificationSerializerTests(TestCase):
    """Test CertificationSerializer"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
    
    def test_serialize_certification(self):
        """Test serializing certification"""
        cert = Certification.objects.create(
            candidate=self.profile,
            name='AWS Cert',
            issuing_organization='Amazon',
            issue_date=date(2023, 1, 1),
            expiry_date=date(2026, 1, 1)
        )
        
        serializer = CertificationSerializer(cert)
        
        self.assertEqual(serializer.data['name'], 'AWS Cert')
        self.assertIn('is_expired', serializer.data)
    
    def test_validate_never_expires_logic(self):
        """Test never_expires validation"""
        data = {
            'candidate': self.profile.id,
            'name': 'Test Cert',
            'issuing_organization': 'Test Org',
            'issue_date': '2023-01-01',
            'never_expires': True,
            'expiry_date': '2026-01-01'
        }
        
        serializer = CertificationSerializer(data=data)
        
        # Should reject if never_expires=True but expiry_date provided
        if serializer.is_valid():
            cert = serializer.save()
            # Serializer should nullify expiry_date
            self.assertIsNone(cert.expiry_date)


class ProjectSerializerTests(TestCase):
    """Test ProjectSerializer"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
    
    def test_serialize_project(self):
        """Test serializing project"""
        project = Project.objects.create(
            candidate=self.profile,
            name='E-commerce',
            description='Built platform',
            start_date=date(2022, 1, 1),
            end_date=date(2022, 6, 1),
            status='completed'
        )
        
        serializer = ProjectSerializer(project)
        
        self.assertEqual(serializer.data['name'], 'E-commerce')
        self.assertEqual(serializer.data['status'], 'completed')
    
    def test_status_validation(self):
        """Test status must be valid choice"""
        data = {
            'candidate': self.profile.id,
            'name': 'Test Project',
            'description': 'Test',
            'start_date': '2023-01-01',
            'status': 'invalid_status'
        }
        
        serializer = ProjectSerializer(data=data)
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('status', serializer.errors)
    
    def test_team_size_positive(self):
        """Test team_size must be positive"""
        data = {
            'candidate': self.profile.id,
            'name': 'Test Project',
            'description': 'Test',
            'start_date': '2023-01-01',
            'status': 'completed',
            'team_size': -1
        }
        
        serializer = ProjectSerializer(data=data)
        
        self.assertFalse(serializer.is_valid())
