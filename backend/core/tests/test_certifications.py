from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from core.models import CandidateProfile, Certification

User = get_user_model()


class CertificationCRUDTests(APITestCase):
    """Test certification CRUD operations (UC-030)"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = '/api/certifications'
    
    def test_add_certification(self):
        """Test adding certification (UC-030)"""
        data = {
            'name': 'AWS Certified Solutions Architect',
            'issuing_organization': 'Amazon Web Services',
            'issue_date': str(date.today()),
            'expiry_date': str(date.today() + timedelta(days=365)),
            'credential_id': 'AWS-123456',
            'category': 'Cloud'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Certification.objects.filter(
            candidate=self.profile,
            name='AWS Certified Solutions Architect'
        ).exists())

    def test_add_certification_with_assessment_details(self):
        """Ensure manual assessment metadata is persisted"""
        data = {
            'name': 'HackerRank SQL',
            'issuing_organization': 'HackerRank',
            'issue_date': str(date.today()),
            'category': 'Coding & Practice',
            'assessment_score': '95',
            'assessment_max_score': '100',
            'assessment_units': 'percentile',
            'achievement_highlights': 'Top 5% worldwide',
            'description': '<p>Advanced SQL challenge</p>',
        }

        response = self.client.post(self.url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        cert = Certification.objects.get(candidate=self.profile, name='HackerRank SQL')
        self.assertEqual(cert.assessment_score, Decimal('95'))
        self.assertEqual(cert.assessment_max_score, Decimal('100'))
        self.assertEqual(cert.assessment_units, 'percentile')
        self.assertEqual(cert.achievement_highlights, 'Top 5% worldwide')
        self.assertEqual(cert.description, '<p>Advanced SQL challenge</p>')
    
    def test_list_certifications(self):
        """Test viewing certifications"""
        Certification.objects.create(
            candidate=self.profile,
            name='PMP',
            issuing_organization='PMI',
            issue_date=date(2020, 1, 1),
            expiry_date=date(2023, 1, 1)
        )
        
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
    
    def test_update_certification(self):
        """Test editing certification"""
        cert = Certification.objects.create(
            candidate=self.profile,
            name='Old Cert',
            issuing_organization='Org',
            issue_date=date(2020, 1, 1)
        )
        
        data = {'never_expires': True}  # Field is never_expires not does_not_expire
        
        response = self.client.patch(
            f'{self.url}/{cert.id}',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cert.refresh_from_db()
        self.assertTrue(cert.never_expires)
    
    def test_delete_certification(self):
        """Test deleting certification"""
        cert = Certification.objects.create(
            candidate=self.profile,
            name='Test Cert',
            issuing_organization='Test Org',
            issue_date=date(2020, 1, 1)
        )
        
        response = self.client.delete(f'{self.url}/{cert.id}')
        
        # API returns 200 (not 204)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Certification.objects.filter(id=cert.id).exists())


class CertificationExpirationTests(APITestCase):
    """Test certification expiration logic"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = '/api/certifications'
    
    def test_expired_certification(self):
        """Test expired certification is marked correctly"""
        cert = Certification.objects.create(
            candidate=self.profile,
            name='Expired Cert',
            issuing_organization='Org',
            issue_date=date(2019, 1, 1),
            expiry_date=date.today() - timedelta(days=1)
        )
        
        response = self.client.get(f'{self.url}/{cert.id}')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('is_expired', False))
    
    def test_does_not_expire(self):
        """Test certification that doesn't expire"""
        data = {
            'name': 'Lifetime Cert',
            'issuing_organization': 'Org',
            'issue_date': str(date.today()),
            'does_not_expire': True
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data.get('is_expired', False))


class CertificationRenewalTests(APITestCase):
    """Test certification renewal reminder logic"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_user',
            email='test@example.com'
        )
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = '/api/certifications'
    
    def test_renewal_reminder(self):
        """Test renewal reminder configuration"""
        data = {
            'name': 'Renewal Cert',
            'issuing_organization': 'Org',
            'issue_date': str(date.today()),
            'expiry_date': str(date.today() + timedelta(days=90)),
            'renewal_reminder_enabled': True,
            'reminder_days_before': 30
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data.get('renewal_reminder_enabled'))
        self.assertEqual(response.data.get('reminder_days_before'), 30)
