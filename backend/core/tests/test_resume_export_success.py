import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_resume_export_txt_success(django_user_model):
    user = django_user_model.objects.create_user(username="ruser", email="ruser@example.com", password="pass")
    # Create minimal CandidateProfile linked to user
    from core.models import CandidateProfile
    CandidateProfile.objects.create(user=user)

    client = APIClient()
    client.force_authenticate(user=user)

    url = reverse("resume-export") + "?format=txt"
    resp = client.get(url)
    assert resp.status_code == 200
    # Content should be plain text
    ct = resp.get('Content-Type') or resp.get('content-type')
    assert ct and 'text/plain' in ct
    assert resp.content
