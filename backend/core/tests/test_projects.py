import io
import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from core.models import CandidateProfile, Project, ProjectMedia, Skill

User = get_user_model()


def make_image_file(name='test.png', size=(50, 50), color=(255, 0, 0)):
    buf = io.BytesIO()
    image = Image.new('RGB', size, color)
    image.save(buf, format='PNG')
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type='image/png')


@pytest.mark.django_db
class TestProjectsAPI:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='projuid', email='proj@example.com', password='pass')
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def test_crud_flow_and_validation(self):
        # List initially empty
        list_url = reverse('core:projects-list-create')
        resp = self.client.get(list_url)
        assert resp.status_code == 200
        assert resp.json() == []

        # Create invalid (dates)
        bad_payload = {
            'name': 'Bad Dates',
            'start_date': '2025-12-31',
            'end_date': '2025-01-01',
            'status': 'completed',
        }
        resp = self.client.post(list_url, bad_payload, format='json')
        assert resp.status_code == 400
        assert 'start_date' in (resp.json().get('error', {}).get('details') or {})

        # Create valid with technologies list
        payload = {
            'name': 'Portfolio Site',
            'description': 'Personal portfolio website',
            'role': 'Full-Stack Developer',
            'start_date': '2025-01-01',
            'end_date': '2025-02-01',
            'project_url': 'https://example.com',
            'team_size': 1,
            'collaboration_details': 'Solo project',
            'outcomes': 'Showcased projects and blogs',
            'industry': 'Software',
            'category': 'Web App',
            'status': 'completed',
            'technologies': ['React', 'Django'],
        }
        resp = self.client.post(list_url, payload, format='json')
        assert resp.status_code == 201
        data = resp.json()
        assert data['name'] == 'Portfolio Site'
        assert set(data['technologies']) == {'React', 'Django'}
        proj_id = data['id']

        # Ensure skills were created and linked
        assert Skill.objects.filter(name__iexact='React').exists()
        assert Skill.objects.filter(name__iexact='Django').exists()
        p = Project.objects.get(id=proj_id)
        assert p.skills_used.count() == 2

        # List returns the created project
        resp = self.client.get(list_url)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

        # Update status and technologies and append media
        detail_url = reverse('core:project-detail', kwargs={'project_id': proj_id})
        img = make_image_file()
        update_payload = {
            'status': 'ongoing',
            # For multipart, send technologies as JSON string to match view parsing behavior
            'technologies': '["React","Django","PostgreSQL"]',
        }
        # multipart for media
        resp = self.client.patch(detail_url, data={**update_payload, 'media': [img]}, format='multipart')
        assert resp.status_code == 200
        data = resp.json()
        assert data['status'] == 'ongoing'
        assert set(data['technologies']) == {'React', 'Django', 'PostgreSQL'}
        # media saved
        p.refresh_from_db()
        assert p.media.count() == 1
        assert ProjectMedia.objects.filter(project=p).count() == 1

        # Delete
        resp = self.client.delete(detail_url)
        assert resp.status_code == 200
        assert Project.objects.filter(id=proj_id).count() == 0
