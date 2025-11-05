"""
Additional tests to boost Sprint 1 coverage to 90%+
Targets specific uncovered lines in serializers
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from datetime import date
from core.models import CandidateProfile, Skill, WorkExperience
from core.serializers import UserProfileSerializer, WorkExperienceSerializer

User = get_user_model()


class UserProfileSerializerCoverageTests(TestCase):
    """Target uncovered lines in UserProfileSerializer"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com',
            first_name='Old',
            last_name='Name'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
    
    def test_update_with_user_data_path(self):
        """Test update method with user data - lines 134-137"""
        serializer = UserProfileSerializer(self.profile)
        
        # Manually call update with user_data
        updated = serializer.update(self.profile, {
            'user': {
                'first_name': 'New',
                'last_name': 'Name'
            },
            'location': 'NYC'
        })
        
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'New')
        self.assertEqual(updated.location, 'NYC')
    
    def test_validate_summary_too_long(self):
        """Test summary > 500 chars - line 116"""
        long_summary = 'x' * 501
        serializer = UserProfileSerializer(self.profile, data={'summary': long_summary}, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn('summary', serializer.errors)
    
    def test_validate_phone_invalid(self):
        """Test invalid phone - line 125"""
        serializer = UserProfileSerializer(self.profile, data={'phone': '123'}, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn('phone', serializer.errors)


class WorkExperienceSerializerCoverageTests(TestCase):
    """Target uncovered lines in WorkExperienceSerializer"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='test',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.skill1 = Skill.objects.create(name='Python', category='Programming')
        self.skill2 = Skill.objects.create(name='Django', category='Framework')
    
    def test_validate_end_before_start(self):
        """Test end_date < start_date validation - lines 320-321"""
        # Use actual serializer validation flow
        from core.serializers import WorkExperienceSerializer as WES
        
        # Create instance of serializer
        serializer = WES(data={
            'candidate': self.profile.id,
            'company_name': 'Corp',
            'job_title': 'Dev',
            'start_date': '2023-12-01',
            'end_date': '2023-01-01',  # Before start
            'is_current': False
        })
        
        # This should trigger the validate() method
        is_valid = serializer.is_valid()
        self.assertFalse(is_valid)
        # Should have validation error
        self.assertTrue(len(serializer.errors) > 0)
    
    def test_create_method_with_skills(self):
        """Test create with skills_used - lines 325-328"""
        serializer = WorkExperienceSerializer()
        
        # Call the create method directly (it pops skills_used first)
        validated_data = {
            'candidate': self.profile,
            'company_name': 'Tech Co',
            'job_title': 'Engineer',
            'start_date': date(2023, 1, 1),
            'end_date': date(2023, 12, 31),
            'is_current': False,
            'skills_used': []  # Empty list
        }
        
        work_exp = serializer.create(validated_data)
        
        self.assertEqual(work_exp.company_name, 'Tech Co')
    
    def test_update_method_with_skills_set(self):
        """Test update with skills provided - lines 331-337"""
        work_exp = WorkExperience.objects.create(
            candidate=self.profile,
            company_name='Old Co',
            job_title='Dev',
            start_date=date(2022, 1, 1),
            end_date=date(2022, 12, 31)
        )
        
        serializer = WorkExperienceSerializer()
        
        # Update with skills_used key present (will be popped)
        validated_data = {
            'company_name': 'New Co',
            'job_title': 'Engineer',
            'skills_used': []  # Empty list
        }
        
        updated = serializer.update(work_exp, validated_data)
        
        self.assertEqual(updated.company_name, 'New Co')
    
    def test_update_method_without_skills(self):
        """Test update without skills_used param - lines 333-335"""
        work_exp = WorkExperience.objects.create(
            candidate=self.profile,
            company_name='Old Co',
            job_title='Dev',
            start_date=date(2022, 1, 1),
            end_date=date(2022, 12, 31)
        )
        
        serializer = WorkExperienceSerializer()
        
        # Update without skills_used key
        updated = serializer.update(work_exp, {
            'company_name': 'Updated Co'
        })
        
        self.assertEqual(updated.company_name, 'Updated Co')
