"""
Tests for UC-092: Industry Contact Discovery
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from core.models import ContactSuggestion, DiscoverySearch, Contact

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def test_user(db):
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
    )


@pytest.fixture
def authenticated_client(api_client, test_user):
    api_client.force_authenticate(user=test_user)
    return api_client


@pytest.mark.django_db
class TestContactSuggestionEndpoints:
    """Test contact suggestion API endpoints"""

    def test_list_suggestions_empty(self, authenticated_client):
        """Test listing suggestions when none exist"""
        response = authenticated_client.get('/api/contact-suggestions')
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_list_suggestions_with_data(self, authenticated_client, test_user):
        """Test listing suggestions with existing data"""
        ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="John Doe",
            suggested_title="Software Engineer",
            suggested_company="Tech Corp",
            suggestion_type="target_company",
            relevance_score=0.85,
            reason="Works at target company"
        )
        
        response = authenticated_client.get('/api/contact-suggestions')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['suggested_name'] == "John Doe"

    def test_get_suggestion_detail(self, authenticated_client, test_user):
        """Test retrieving a specific suggestion"""
        suggestion = ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="John Doe",
            suggested_title="Engineer",
            suggested_company="Tech Corp",
            suggestion_type="target_company",
            relevance_score=0.85,
            reason="Test"
        )
        
        response = authenticated_client.get(f'/api/contact-suggestions/{suggestion.id}')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['suggested_name'] == "John Doe"

    def test_update_suggestion_status(self, authenticated_client, test_user):
        """Test updating a suggestion's status"""
        suggestion = ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="John Doe",
            suggestion_type="target_company",
            status="suggested",
            relevance_score=0.8,
            reason="Test"
        )
        
        response = authenticated_client.patch(f'/api/contact-suggestions/{suggestion.id}', {'status': 'contacted'})
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'contacted'


@pytest.mark.django_db
class TestContactSuggestionModel:
    """Test ContactSuggestion model"""

    def test_create_suggestion(self, test_user):
        """Test creating a contact suggestion"""
        suggestion = ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="John Doe",
            suggested_title="Software Engineer",
            suggested_company="Tech Corp",
            suggestion_type="target_company",
            relevance_score=0.85,
            reason="Works at target company"
        )
        
        assert suggestion.id is not None
        assert suggestion.user == test_user
        assert suggestion.suggested_name == "John Doe"
