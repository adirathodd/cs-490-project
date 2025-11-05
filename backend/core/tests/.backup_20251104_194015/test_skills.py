"""
UC-035: Skills Management Tests
Tests for UC-026 (Add and Manage Skills) and UC-027 (Category Organization)
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from core.models import CandidateProfile, Skill, CandidateSkill

User = get_user_model()


class SkillCRUDTests(APITestCase):
    """Test skill CRUD operations (UC-026)"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        
        # Create some skills
        self.skill1 = Skill.objects.create(
            name='Python',
            category='Programming Languages'
        )
        self.skill2 = Skill.objects.create(
            name='Django',
            category='Frameworks'
        )
        self.url = '/api/skills'
    
    def test_add_skill_to_profile(self):
        """Test adding a skill to candidate profile"""
        data = {
            'skill_id': self.skill1.id,
            'level': 'expert',
            'years': 5
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            CandidateSkill.objects.filter(
                candidate=self.profile,
                skill=self.skill1
            ).exists()
        )
    
    def test_list_candidate_skills(self):
        """Test retrieving all skills for a candidate"""
        CandidateSkill.objects.create(
            candidate=self.profile,
            skill=self.skill1,
            level='expert'
        )
        
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['skill']['name'], 'Python')
    
    def test_update_skill_proficiency(self):
        """Test updating skill proficiency level"""
        candidate_skill = CandidateSkill.objects.create(
            candidate=self.profile,
            skill=self.skill1,
            level='intermediate'
        )
        
        data = {
            'level': 'expert',
            'years': 8
        }
        
        response = self.client.put(
            f'{self.url}/{candidate_skill.id}',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        candidate_skill.refresh_from_db()
        self.assertEqual(candidate_skill.level, 'expert')
        self.assertEqual(candidate_skill.years, 8)
    
    def test_delete_skill(self):
        """Test removing a skill from profile"""
        candidate_skill = CandidateSkill.objects.create(
            candidate=self.profile,
            skill=self.skill1
        )
        
        response = self.client.delete(f'{self.url}/{candidate_skill.id}')
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            CandidateSkill.objects.filter(id=candidate_skill.id).exists()
        )
    
    def test_prevent_duplicate_skills(self):
        """Test preventing duplicate skills"""
        CandidateSkill.objects.create(
            candidate=self.profile,
            skill=self.skill1
        )
        
        data = {'skill_id': self.skill1.id}
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class SkillSearchAndAutocompleteTests(APITestCase):
    """Test skill search and autocomplete (UC-026)"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.client.force_authenticate(user=self.user)
        
        # Create skills for search
        Skill.objects.create(name='Python', category='Programming Languages')
        Skill.objects.create(name='PyTorch', category='Frameworks')
        Skill.objects.create(name='Java', category='Programming Languages')
        
        self.url = '/api/skills/search'
    
    def test_search_skills_by_prefix(self):
        """Test autocomplete search by skill name prefix"""
        response = self.client.get(self.url, {'q': 'Py'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        skill_names = [skill['name'] for skill in response.data]
        self.assertIn('Python', skill_names)
        self.assertIn('PyTorch', skill_names)
    
    def test_search_returns_empty_for_no_match(self):
        """Test search returns empty list for no matches"""
        response = self.client.get(self.url, {'q': 'Ruby'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
    
    def test_search_case_insensitive(self):
        """Test search is case insensitive"""
        response = self.client.get(self.url, {'q': 'python'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data), 0)


class SkillCategoryOrganizationTests(APITestCase):
    """Test skill category organization (UC-027)"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        
        # Create skills in different categories
        self.lang_skill = Skill.objects.create(
            name='Python',
            category='Programming Languages'
        )
        self.framework_skill = Skill.objects.create(
            name='Django',
            category='Frameworks'
        )
        self.tool_skill = Skill.objects.create(
            name='Docker',
            category='Tools'
        )
        
        # Add to profile
        CandidateSkill.objects.create(
            candidate=self.profile,
            skill=self.lang_skill
        )
        CandidateSkill.objects.create(
            candidate=self.profile,
            skill=self.framework_skill
        )
        
        self.url = '/api/skills'
    
    def test_filter_skills_by_category(self):
        """Test filtering skills by category"""
        response = self.client.get(
            self.url,
            {'category': 'Programming Languages'}
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['skill']['category'], 'Programming Languages')
    
    def test_get_skills_grouped_by_category(self):
        """Test retrieving skills grouped by category"""
        response = self.client.get(f'{self.url}/grouped')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('Programming Languages', response.data)
        self.assertIn('Frameworks', response.data)


class SkillReorderingTests(APITestCase):
    """Test skill reordering (UC-026)"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        
        skill1 = Skill.objects.create(name='Python')
        skill2 = Skill.objects.create(name='Java')
        skill3 = Skill.objects.create(name='JavaScript')
        
        self.cs1 = CandidateSkill.objects.create(
            candidate=self.profile,
            skill=skill1,
            display_order=1
        )
        self.cs2 = CandidateSkill.objects.create(
            candidate=self.profile,
            skill=skill2,
            display_order=2
        )
        self.cs3 = CandidateSkill.objects.create(
            candidate=self.profile,
            skill=skill3,
            display_order=3
        )
        
        self.url = '/api/skills/reorder'
    
    def test_reorder_skills(self):
        """Test reordering skills"""
        new_order = [
            {'id': self.cs3.id, 'display_order': 1},
            {'id': self.cs1.id, 'display_order': 2},
            {'id': self.cs2.id, 'display_order': 3},
        ]
        
        response = self.client.post(
            self.url,
            {'skills': new_order},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.cs1.refresh_from_db()
        self.cs2.refresh_from_db()
        self.cs3.refresh_from_db()
        self.assertEqual(self.cs3.display_order, 1)
        self.assertEqual(self.cs1.display_order, 2)


class SkillValidationTests(TestCase):
    """Test skill validation"""
    
    def test_skill_name_required(self):
        """Test skill name is required"""
        with self.assertRaises(Exception):
            Skill.objects.create(name='', category='Test')
    
    def test_level_choices(self):
        """Test proficiency level is limited to valid choices"""
        user = User.objects.create_user(username='test', email='test@example.com')
        profile = CandidateProfile.objects.create(user=user)
        skill = Skill.objects.create(name='Python')
        
        # Valid proficiency levels
        valid_levels = ['beginner', 'intermediate', 'advanced', 'expert']
        for level in valid_levels:
            cs = CandidateSkill.objects.create(
                candidate=profile,
                skill=skill,
                level=level
            )
            self.assertEqual(cs.level, level)
            cs.delete()
