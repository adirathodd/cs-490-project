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

    def test_filter_sort_search_portfolio(self):
        list_url = reverse('core:projects-list-create')
        # Create sample skills
        react = Skill.objects.create(name='React')
        django = Skill.objects.create(name='Django')
        airflow = Skill.objects.create(name='Airflow')

        # Helper to create project
        def mk(name, industry, status, start, techs, display_order=0):
            p = Project.objects.create(
                candidate=self.profile,
                name=name,
                description='Desc for ' + name,
                industry=industry,
                status=status,
                start_date=start,
                display_order=display_order,
            )
            p.skills_used.set(techs)
            return p

        p1 = mk('Portfolio Site', 'Software', 'completed', '2025-01-01', [react, django], 2)
        p2 = mk('Data Pipeline', 'Finance', 'ongoing', '2025-06-01', [airflow, django], 1)
        p3 = mk('Clinic App', 'Healthcare', 'planned', '2024-09-15', [react], 3)

        # No filters returns all
        resp = self.client.get(list_url)
        assert resp.status_code == 200
        assert len(resp.json()) == 3

        # Filter by industry
        resp = self.client.get(list_url + '?industry=Finance')
        data = resp.json()
        assert len(data) == 1 and data[0]['name'] == 'Data Pipeline'

        # Filter by technology any
        resp = self.client.get(list_url + '?tech=React')
        names = [r['name'] for r in resp.json()]
        assert set(names) == {'Portfolio Site', 'Clinic App'}

        # Filter by technology all
        resp = self.client.get(list_url + '?tech=React,Django&match=all')
        names = [r['name'] for r in resp.json()]
        assert names == ['Portfolio Site']

        # Search by keyword (name/desc/tech)
        resp = self.client.get(list_url + '?q=pipeline&sort=relevance')
        names = [r['name'] for r in resp.json()]
        assert names[0] == 'Data Pipeline'

        # Date range
        resp = self.client.get(list_url + '?date_from=2025-01-01&date_to=2025-12-31')
        names = {r['name'] for r in resp.json()}
        assert names == {'Portfolio Site', 'Data Pipeline'}

        # Custom sort by display_order
        resp = self.client.get(list_url + '?sort=custom')
        names = [r['name'] for r in resp.json()]
        # display_order: 1 -> p2, 2 -> p1, 3 -> p3
        assert names[:3] == ['Data Pipeline', 'Portfolio Site', 'Clinic App']
