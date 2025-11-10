"""
UC-051: Resume Export Tests
Test suite for resume export functionality in multiple formats
"""
import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient
from core.models import (
    CandidateProfile, Skill, CandidateSkill, WorkExperience,
    Education, Certification, Project
)
from core import resume_export
from datetime import date
import io

User = get_user_model()


@pytest.fixture
def user(db):
    """Create test user"""
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123',
        first_name='John',
        last_name='Doe'
    )


@pytest.fixture
def profile(user):
    """Create test profile with comprehensive data"""
    profile = CandidateProfile.objects.create(
        user=user,
        phone='555-1234',
        city='New York',
        state='NY',
        headline='Senior Software Engineer',
        summary='Experienced software engineer with 10+ years in web development',
        portfolio_url='https://johndoe.dev'
    )
    
    # Add skills
    python_skill = Skill.objects.create(name='Python', category='Programming')
    js_skill = Skill.objects.create(name='JavaScript', category='Programming')
    CandidateSkill.objects.create(candidate=profile, skill=python_skill, level='expert', years=10)
    CandidateSkill.objects.create(candidate=profile, skill=js_skill, level='advanced', years=8)
    
    # Add work experience
    exp = WorkExperience.objects.create(
        candidate=profile,
        company_name='Tech Corp',
        job_title='Senior Engineer',
        location='New York, NY',
        start_date=date(2020, 1, 1),
        end_date=None,
        is_current=True,
        description='Leading development of core platform',
        achievements=['Improved performance by 40%', 'Led team of 5 engineers']
    )
    exp.skills_used.add(python_skill)
    
    # Add education
    Education.objects.create(
        candidate=profile,
        institution='MIT',
        degree_type='ba',
        field_of_study='Computer Science',
        start_date=date(2008, 9, 1),
        end_date=date(2012, 5, 31),
        gpa=3.8,
        honors='Summa Cum Laude'
    )
    
    # Add certification
    Certification.objects.create(
        candidate=profile,
        name='AWS Solutions Architect',
        issuing_organization='Amazon Web Services',
        issue_date=date(2021, 6, 1),
        expiry_date=date(2024, 6, 1),
        credential_id='AWS-12345'
    )
    
    # Add project
    proj = Project.objects.create(
        candidate=profile,
        name='E-commerce Platform',
        role='Lead Developer',
        description='Built scalable e-commerce system',
        start_date=date(2019, 1, 1),
        end_date=date(2020, 12, 31),
        project_url='https://github.com/johndoe/ecommerce'
    )
    proj.skills_used.add(python_skill, js_skill)
    
    return profile


@pytest.fixture
def api_client(user):
    """Create authenticated API client"""
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class TestResumeExportService:
    """Test resume export service functions"""
    
    def test_get_available_themes(self):
        """Test getting available themes"""
        themes = resume_export.get_available_themes()
        
        assert len(themes) == 4
        assert any(t['id'] == 'professional' for t in themes)
        assert any(t['id'] == 'modern' for t in themes)
        assert any(t['id'] == 'minimal' for t in themes)
        assert any(t['id'] == 'creative' for t in themes)
        
        for theme in themes:
            assert 'id' in theme
            assert 'name' in theme
            assert 'description' in theme
    
    def test_collect_profile_data(self, profile):
        """Test collecting profile data"""
        data = resume_export.collect_profile_data(profile)
        
        # Basic info
        assert data['name'] == 'John Doe'
        assert data['email'] == 'test@example.com'
        assert data['phone'] == '555-1234'
        assert data['location'] == 'New York, NY'
        assert data['headline'] == 'Senior Software Engineer'
        assert data['summary'] == 'Experienced software engineer with 10+ years in web development'
        
        # Skills
        assert 'Programming' in data['skills']
        assert len(data['skills']['Programming']) == 2
        skill_names = [s['name'] for s in data['skills']['Programming']]
        assert 'Python' in skill_names
        assert 'JavaScript' in skill_names
        
        # Experience
        assert len(data['experiences']) == 1
        exp = data['experiences'][0]
        assert exp['company_name'] == 'Tech Corp'
        assert exp['job_title'] == 'Senior Engineer'
        assert 'Present' in exp['date_range']
        
        # Education
        assert len(data['education']) == 1
        edu = data['education'][0]
        assert edu['institution'] == 'MIT'
        assert edu['degree_type'] == 'Bachelor'
        
        # Certifications
        assert len(data['certifications']) == 1
        cert = data['certifications'][0]
        assert cert['name'] == 'AWS Solutions Architect'
        
        # Projects
        assert len(data['projects']) == 1
        proj = data['projects'][0]
        assert proj['name'] == 'E-commerce Platform'
    
    def test_export_plain_text(self, profile):
        """Test plain text export"""
        data = resume_export.collect_profile_data(profile)
        text = resume_export.export_plain_text(data)
        
        assert 'JOHN DOE' in text
        assert 'test@example.com' in text
        assert '555-1234' in text
        assert 'Senior Software Engineer' in text
        assert 'PROFESSIONAL SUMMARY' in text
        assert 'SKILLS' in text
        assert 'Programming: Python, JavaScript' in text
        assert 'PROFESSIONAL EXPERIENCE' in text
        assert 'Tech Corp' in text
        assert 'EDUCATION' in text
        assert 'MIT' in text
        assert 'CERTIFICATIONS' in text
        assert 'AWS Solutions Architect' in text
        assert 'PROJECTS' in text
        assert 'E-commerce Platform' in text
    
    def test_export_html(self, profile):
        """Test HTML export"""
        data = resume_export.collect_profile_data(profile)
        html = resume_export.export_html(data, theme='professional')
        
        assert '<!DOCTYPE html>' in html
        assert '<html' in html
        assert 'John Doe' in html
        assert 'test@example.com' in html
        assert 'Senior Software Engineer' in html
        assert 'Tech Corp' in html
        assert 'MIT' in html
        assert 'AWS Solutions Architect' in html
        assert 'E-commerce Platform' in html
        
        # Check CSS is included
        assert '<style>' in html
        assert 'font-family' in html
    
    def test_export_html_with_watermark(self, profile):
        """Test HTML export with watermark"""
        data = resume_export.collect_profile_data(profile)
        html = resume_export.export_html(data, theme='modern', watermark='DRAFT')
        
        assert 'DRAFT' in html
    
    def test_export_docx(self, profile):
        """Test DOCX export"""
        data = resume_export.collect_profile_data(profile)
        docx_bytes = resume_export.export_docx(data, theme='professional')
        
        assert isinstance(docx_bytes, bytes)
        assert len(docx_bytes) > 0
        
        # Verify it's a valid ZIP file (DOCX is a ZIP)
        import zipfile
        docx_io = io.BytesIO(docx_bytes)
        assert zipfile.is_zipfile(docx_io)
    
    def test_export_resume_invalid_format(self, profile):
        """Test export with invalid format"""
        with pytest.raises(resume_export.ResumeExportError) as exc_info:
            resume_export.export_resume(profile, 'invalid_format')
        
        assert 'Invalid format' in str(exc_info.value)
    
    def test_export_resume_txt(self, profile):
        """Test main export function for txt"""
        result = resume_export.export_resume(profile, 'txt')
        
        assert result['format'] == 'txt'
        assert result['content_type'] == 'text/plain'
        assert result['filename'].endswith('.txt')
        assert 'JOHN DOE' in result['content']
    
    def test_export_resume_html(self, profile):
        """Test main export function for html"""
        result = resume_export.export_resume(profile, 'html', theme='modern')
        
        assert result['format'] == 'html'
        assert result['content_type'] == 'text/html'
        assert result['filename'].endswith('.html')
        assert '<!DOCTYPE html>' in result['content']
    
    def test_export_resume_docx(self, profile):
        """Test main export function for docx"""
        result = resume_export.export_resume(profile, 'docx', theme='minimal')
        
        assert result['format'] == 'docx'
        assert result['content_type'] == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        assert result['filename'].endswith('.docx')
        assert isinstance(result['content'], bytes)
    
    def test_export_resume_custom_filename(self, profile):
        """Test export with custom filename"""
        result = resume_export.export_resume(profile, 'txt', filename='MyCustomResume')
        
        assert result['filename'] == 'MyCustomResume.txt'


class TestResumeExportAPI:
    """Test resume export API endpoints"""
    
    def test_get_themes(self, api_client):
        """Test GET /api/resume/export/themes"""
        response = api_client.get('/api/resume/export/themes')
        
        assert response.status_code == 200
        data = response.json()
        assert 'themes' in data
        assert len(data['themes']) == 4
        
        theme_ids = [t['id'] for t in data['themes']]
        assert 'professional' in theme_ids
        assert 'modern' in theme_ids
    
    def test_export_without_format(self, api_client, profile):
        """Test export without format parameter"""
        response = api_client.get('/api/resume/export')
        
        assert response.status_code == 400
        data = response.json()
        assert 'error' in data
        assert 'format' in data['error']['message'].lower()
    
    def test_export_invalid_format(self, api_client, profile):
        """Test export with invalid format"""
        response = api_client.get('/api/resume/export?format=invalid')
        
        assert response.status_code == 400
        data = response.json()
        assert 'error' in data
        assert 'invalid format' in data['error']['message'].lower()
    
    def test_export_txt(self, api_client, profile):
        """Test export as plain text"""
        response = api_client.get('/api/resume/export?format=txt')
        
        assert response.status_code == 200
        assert response['Content-Type'] == 'text/plain'
        assert 'attachment' in response['Content-Disposition']
        assert '.txt' in response['Content-Disposition']
        
        content = response.content.decode('utf-8')
        assert 'JOHN DOE' in content
    
    def test_export_html(self, api_client, profile):
        """Test export as HTML"""
        response = api_client.get('/api/resume/export?format=html&theme=modern')
        
        assert response.status_code == 200
        assert response['Content-Type'] == 'text/html'
        assert 'attachment' in response['Content-Disposition']
        assert '.html' in response['Content-Disposition']
        
        content = response.content.decode('utf-8')
        assert '<!DOCTYPE html>' in content
        assert 'John Doe' in content
    
    def test_export_docx(self, api_client, profile):
        """Test export as Word document"""
        response = api_client.get('/api/resume/export?format=docx&theme=professional')
        
        assert response.status_code == 200
        assert 'openxmlformats' in response['Content-Type']
        assert 'attachment' in response['Content-Disposition']
        assert '.docx' in response['Content-Disposition']
        
        # Verify it's valid ZIP
        import zipfile
        docx_io = io.BytesIO(response.content)
        assert zipfile.is_zipfile(docx_io)
    
    def test_export_with_watermark(self, api_client, profile):
        """Test export with watermark"""
        response = api_client.get('/api/resume/export?format=html&watermark=DRAFT')
        
        assert response.status_code == 200
        content = response.content.decode('utf-8')
        assert 'DRAFT' in content
    
    def test_export_with_custom_filename(self, api_client, profile):
        """Test export with custom filename"""
        response = api_client.get('/api/resume/export?format=txt&filename=CustomResume')
        
        assert response.status_code == 200
        assert 'CustomResume.txt' in response['Content-Disposition']
    
    def test_export_unauthenticated(self):
        """Test export requires authentication"""
        client = APIClient()
        response = client.get('/api/resume/export?format=txt')
        
        assert response.status_code in [401, 403]
    
    def test_export_without_profile(self, user):
        """Test export when profile doesn't exist"""
        # Delete the profile
        CandidateProfile.objects.filter(user=user).delete()
        
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get('/api/resume/export?format=txt')
        
        assert response.status_code == 404


class TestResumeExportEdgeCases:
    """Test edge cases and error handling"""
    
    def test_export_empty_profile(self, user):
        """Test export with minimal profile data"""
        profile = CandidateProfile.objects.create(
            user=user,
            phone='',
            headline='',
            summary=''
        )
        
        data = resume_export.collect_profile_data(profile)
        text = resume_export.export_plain_text(data)
        
        # Should still generate valid output
        assert text
        assert user.get_full_name() in text or user.email in text
    
    def test_export_html_special_characters(self, profile):
        """Test HTML export escapes special characters"""
        profile.summary = 'Test <script>alert("xss")</script> & special chars'
        profile.save()
        
        data = resume_export.collect_profile_data(profile)
        html = resume_export.export_html(data)
        
        # Should escape HTML special characters
        assert '<script>' not in html
        assert '&lt;' in html or 'alert' not in html
    
    def test_export_all_themes(self, profile):
        """Test export works with all available themes"""
        themes = ['professional', 'modern', 'minimal', 'creative']
        
        for theme in themes:
            result = resume_export.export_resume(profile, 'docx', theme=theme)
            assert result['format'] == 'docx'
            assert len(result['content']) > 0
    
    def test_export_long_content(self, profile):
        """Test export handles long content correctly"""
        # Add long description
        long_desc = 'A' * 5000
        exp = WorkExperience.objects.filter(candidate=profile).first()
        exp.description = long_desc
        exp.save()
        
        data = resume_export.collect_profile_data(profile)
        text = resume_export.export_plain_text(data)
        
        assert long_desc in text
    
    def test_export_unicode_characters(self, profile):
        """Test export handles unicode characters"""
        profile.summary = 'Testing unicode: 你好 мир 🚀 café résumé'
        profile.save()
        
        data = resume_export.collect_profile_data(profile)
        
        # All formats should handle unicode
        text = resume_export.export_plain_text(data)
        assert '你好' in text
        
        html = resume_export.export_html(data)
        assert '你好' in html
        
        # DOCX should also handle it
        docx_bytes = resume_export.export_docx(data)
        assert len(docx_bytes) > 0
