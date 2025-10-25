import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import CandidateProfile, Education

User = get_user_model()


@pytest.mark.django_db
class TestEducation:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='edu_uid', email='edu@example.com', password='pass12345')
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def test_list_empty_education(self):
        url = reverse('core:education-list-create')
        resp = self.client.get(url)
        assert resp.status_code == 200
        assert resp.data == []

    def test_create_education_requires_minimum_fields(self):
        url = reverse('core:education-list-create')
        payload = {
            'institution': 'State University',
            'degree_type': 'ba',
            'field_of_study': 'Computer Science',
            'graduation_date': '2024-05-15',
            'currently_enrolled': False,
        }
        resp = self.client.post(url, payload, format='json')
        assert resp.status_code == 201
        data = resp.data
        assert data['institution'] == 'State University'
        assert data['degree_type'] == 'ba'
        assert data['field_of_study'] == 'Computer Science'
        assert data['graduation_date'] == '2024-05-15'
        # entry exists
        assert Education.objects.filter(candidate=self.profile).count() == 1

    def test_validation_requires_grad_date_or_currently_enrolled(self):
        url = reverse('core:education-list-create')
        payload = {
            'institution': 'Tech College',
            'degree_type': 'aa',
            'field_of_study': 'IT',
            'currently_enrolled': False,
        }
        resp = self.client.post(url, payload, format='json')
        assert resp.status_code == 400
        assert 'graduation_date' in resp.data['error']['details']

    def test_currently_enrolled_allows_no_grad_date(self):
        url = reverse('core:education-list-create')
        payload = {
            'institution': 'City College',
            'degree_type': 'aa',
            'field_of_study': 'Math',
            'currently_enrolled': True,
        }
        resp = self.client.post(url, payload, format='json')
        assert resp.status_code == 201
        assert resp.data['currently_enrolled'] is True
        assert resp.data['graduation_date'] is None

    def test_update_and_delete_education(self):
        # create one
        edu = Education.objects.create(
            candidate=self.profile,
            institution='Uni',
            degree_type='ba',
            field_of_study='CS',
            end_date='2020-06-01'
        )
        detail_url = reverse('core:education-detail', args=[edu.id])
        # GET
        resp = self.client.get(detail_url)
        assert resp.status_code == 200
        # PATCH update GPA with privacy
        resp = self.client.patch(detail_url, {'gpa': 3.8, 'gpa_private': True}, format='json')
        assert resp.status_code == 200
        assert float(resp.data['gpa']) == 3.8
        assert resp.data['gpa_private'] is True
        # DELETE
        resp = self.client.delete(detail_url)
        assert resp.status_code == 200
        assert Education.objects.filter(id=edu.id).count() == 0
