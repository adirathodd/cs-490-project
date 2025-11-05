"""
UC-035: Serializer Validation Tests
Tests for serializer field validation, custom validators, and nested serializers
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from datetime import date
from io import BytesIO
from PIL import Image
from core.models import (
    CandidateProfile, Skill, CandidateSkill, Education,
    WorkExperience, Certification, Project
)
from core.serializers import (
    UserSerializer, SkillSerializer, UserProfileSerializer, ProfilePictureUploadSerializer,
    EducationSerializer, CertificationSerializer, ProjectSerializer, WorkExperienceSerializer
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
        
        serializer = ProjectSerializer(data=data)
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('team_size', serializer.errors)


class ProfileSerializerTests(TestCase):
    """Test UserProfileSerializer validation methods"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com',
            first_name='Test',
            last_name='User'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
    
    def test_validate_summary_max_length(self):
        """Test summary validation with > 500 chars"""
        long_summary = 'A' * 501
        data = {
            'summary': long_summary
        }
        
        serializer = UserProfileSerializer(self.profile, data=data, partial=True)
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('summary', serializer.errors)
    
    def test_validate_phone_format_valid(self):
        """Test valid phone number formats"""
        valid_phones = [
            '+1-555-123-4567',
            '(555) 123-4567',
            '555.123.4567',
            '+14155551234',
            '5551234567'
        ]
        
        for phone in valid_phones:
            data = {'phone': phone}
            serializer = UserProfileSerializer(self.profile, data=data, partial=True)
            self.assertTrue(serializer.is_valid(), f"Phone {phone} should be valid")
    
    def test_validate_phone_format_invalid(self):
        """Test invalid phone number format"""
        data = {'phone': '123'}  # Too short
        
        serializer = UserProfileSerializer(self.profile, data=data, partial=True)
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('phone', serializer.errors)
    
    def test_update_method_with_user_data(self):
        """Test update method updates both user and profile"""
        data = {
            'user': {
                'first_name': 'Updated',
                'last_name': 'Name'
            },
            'location': 'New York'
        }
        
        serializer = UserProfileSerializer(self.profile, data=data, partial=True)
        self.assertTrue(serializer.is_valid())
        updated_profile = serializer.save()
        
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Updated')
        self.assertEqual(self.user.last_name, 'Name')
        self.assertEqual(updated_profile.location, 'New York')


class ProfilePictureUploadSerializerTests(TestCase):
    """Test ProfilePictureUploadSerializer validation"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
    
    def _create_test_image(self, size=(100, 100), format='PNG'):
        """Helper to create a test image file"""
        image = Image.new('RGB', size, color='red')
        image_file = BytesIO()
        image.save(image_file, format=format)
        image_file.seek(0)
        return SimpleUploadedFile(
            f'test.{format.lower()}',
            image_file.read(),
            content_type=f'image/{format.lower()}'
        )
    
    def test_validate_profile_picture_size_too_large(self):
        """Test file size validation > 5MB"""
        # Create a large file (simulate > 5MB)
        large_image = Image.new('RGB', (5000, 5000), color='red')
        image_file = BytesIO()
        large_image.save(image_file, format='PNG')
        image_file.seek(0)
        
        large_file = SimpleUploadedFile(
            'large.png',
            image_file.read(),
            content_type='image/png'
        )
        
        data = {'profile_picture': large_file}
        serializer = ProfilePictureUploadSerializer(data=data)
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('profile_picture', serializer.errors)
        self.assertIn('5MB', str(serializer.errors['profile_picture']))
    
    def test_validate_profile_picture_invalid_extension(self):
        """Test invalid file extension"""
        invalid_file = SimpleUploadedFile(
            'test.txt',
            b'not an image',
            content_type='text/plain'
        )
        
        data = {'profile_picture': invalid_file}
        serializer = ProfilePictureUploadSerializer(data=data)
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('profile_picture', serializer.errors)
        self.assertIn('Invalid file type', str(serializer.errors['profile_picture']))
    
    def test_validate_profile_picture_corrupted_image(self):
        """Test corrupted image file"""
        corrupted_file = SimpleUploadedFile(
            'corrupted.jpg',
            b'fake image data that is not valid',
            content_type='image/jpeg'
        )
        
        data = {'profile_picture': corrupted_file}
        serializer = ProfilePictureUploadSerializer(data=data)
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('profile_picture', serializer.errors)
        self.assertIn('Invalid or corrupted', str(serializer.errors['profile_picture']))
    
    def test_validate_profile_picture_valid_formats(self):
        """Test all valid image formats"""
        valid_formats = ['PNG', 'JPEG']
        
        for fmt in valid_formats:
            image_file = self._create_test_image(format=fmt)
            data = {'profile_picture': image_file}
            serializer = ProfilePictureUploadSerializer(data=data)
            
            self.assertTrue(serializer.is_valid(), f"Format {fmt} should be valid")


class WorkExperienceSerializerTests(TestCase):
    """Test WorkExperienceSerializer validation"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.skill = Skill.objects.create(name='Python', category='Programming')
    
    def test_validate_end_date_before_start_date(self):
        """Test validation: end_date cannot be before start_date"""
        data = {
            'candidate': self.profile.id,
            'company_name': 'Tech Corp',
            'job_title': 'Engineer',
            'start_date': '2023-06-01',
            'end_date': '2023-01-01',  # Before start_date
            'is_current': False
        }
        
        serializer = WorkExperienceSerializer(data=data)
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)
        self.assertIn('before start date', str(serializer.errors))
    
    def test_create_with_skills(self):
        """Test create method with skills_used"""
        data = {
            'candidate': self.profile.id,
            'company_name': 'Tech Corp',
            'job_title': 'Engineer',
            'start_date': '2023-01-01',
            'end_date': '2023-12-31',
            'is_current': False,
            'skills_used': [self.skill.id]
        }
        
        serializer = WorkExperienceSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        
        work_exp = serializer.save()
        self.assertEqual(work_exp.skills_used.count(), 1)
        self.assertEqual(work_exp.skills_used.first(), self.skill)
    
    def test_update_with_skills(self):
        """Test update method with skills_used"""
        work_exp = WorkExperience.objects.create(
            candidate=self.profile,
            company_name='Old Corp',
            job_title='Dev',
            start_date=date(2022, 1, 1),
            end_date=date(2022, 12, 31)
        )
        
        new_skill = Skill.objects.create(name='Django', category='Framework')
        data = {
            'company_name': 'New Corp',
            'skills_used': [new_skill.id]
        }
        
        serializer = WorkExperienceSerializer(work_exp, data=data, partial=True)
        self.assertTrue(serializer.is_valid())
        
        updated = serializer.save()
        self.assertEqual(updated.company_name, 'New Corp')
        self.assertEqual(updated.skills_used.count(), 1)
        self.assertEqual(updated.skills_used.first(), new_skill)


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
            'degree_type': 'ba',
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
            'degree_type': 'ba',
            'field_of_study': 'CS',
            'start_date': '2020-01-01',
            'end_date': '2024-01-01',
            'gpa': '5.0'
        }
        
        serializer = EducationSerializer(data=data)
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('gpa', serializer.errors)


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
            'never_expires': True
        }
        
        serializer = CertificationSerializer(data=data)
        
        # Should accept never_expires without expiry_date
        if serializer.is_valid():
            cert = serializer.save()
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
