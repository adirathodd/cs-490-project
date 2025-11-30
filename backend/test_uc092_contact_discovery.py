"""
Tests for UC-092: Industry Contact Discovery
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from core.models import ContactSuggestion, DiscoverySearch, Contact, Education, JobOpportunity

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
def other_user(db):
    return User.objects.create_user(
        username='otheruser',
        email='other@example.com',
        password='testpass456'
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

    def test_filter_suggestions_by_type(self, authenticated_client, test_user):
        """Test filtering suggestions by type"""
        ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="Alumni Contact",
            suggestion_type="alumni",
            relevance_score=0.75,
            reason="Fellow alumnus"
        )
        ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="Company Contact",
            suggestion_type="target_company",
            relevance_score=0.85,
            reason="Works at target"
        )
        
        response = authenticated_client.get('/api/contact-suggestions', {'type': 'alumni'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['suggestion_type'] == 'alumni'

    def test_filter_suggestions_by_status(self, authenticated_client, test_user):
        """Test filtering suggestions by status"""
        ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="Suggested Contact",
            status="suggested",
            suggestion_type="target_company",
            relevance_score=0.8,
            reason="Test"
        )
        ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="Contacted Person",
            status="contacted",
            suggestion_type="alumni",
            relevance_score=0.7,
            reason="Test"
        )
        
        response = authenticated_client.get('/api/contact-suggestions', {'status': 'contacted'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['status'] == 'contacted'

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
        
        # Verify contacted_at timestamp was set
        suggestion.refresh_from_db()
        assert suggestion.status == 'contacted'
        assert suggestion.contacted_at is not None

    def test_delete_suggestion(self, authenticated_client, test_user):
        """Test deleting a suggestion"""
        suggestion = ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="John Doe",
            suggestion_type="target_company",
            relevance_score=0.8,
            reason="Test"
        )
        
        response = authenticated_client.delete(f'/api/contact-suggestions/{suggestion.id}')
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ContactSuggestion.objects.filter(id=suggestion.id).exists()

    def test_convert_suggestion_to_contact(self, authenticated_client, test_user):
        """Test converting a suggestion into an actual contact"""
        suggestion = ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="Jane Smith",
            suggested_title="Product Manager",
            suggested_company="Innovation Inc",
            suggested_linkedin_url="https://linkedin.com/in/janesmith",
            suggested_location="New York",
            suggested_industry="Technology",
            suggestion_type="alumni",
            relevance_score=0.90,
            reason="Fellow alumnus from MIT"
        )
        
        response = authenticated_client.post(f'/api/contact-suggestions/{suggestion.id}/convert')
        assert response.status_code == status.HTTP_201_CREATED
        assert 'contact' in response.data
        assert 'suggestion' in response.data
        
        # Verify contact was created with correct data
        contact = Contact.objects.get(id=response.data['contact']['id'])
        assert contact.display_name == "Jane Smith"
        assert contact.title == "Product Manager"
        assert contact.company_name == "Innovation Inc"
        assert contact.linkedin_url == "https://linkedin.com/in/janesmith"
        assert contact.owner == test_user
        
        # Verify suggestion was updated
        suggestion.refresh_from_db()
        assert suggestion.status == 'connected'
        assert suggestion.connected_contact == contact

    def test_cannot_access_other_user_suggestions(self, authenticated_client, other_user):
        """Test that users cannot access other users' suggestions"""
        suggestion = ContactSuggestion.objects.create(
            user=other_user,
            suggested_name="Private Contact",
            suggestion_type="alumni",
            relevance_score=0.7,
            reason="Test"
        )
        
        response = authenticated_client.get(f'/api/contact-suggestions/{suggestion.id}')
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_suggestions_ordered_by_relevance(self, authenticated_client, test_user):
        """Test that suggestions are ordered by relevance score"""
        ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="Low Score",
            suggestion_type="alumni",
            relevance_score=0.5,
            reason="Test"
        )
        ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="High Score",
            suggestion_type="target_company",
            relevance_score=0.95,
            reason="Test"
        )
        ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="Medium Score",
            suggestion_type="mutual_connection",
            relevance_score=0.75,
            reason="Test"
        )
        
        response = authenticated_client.get('/api/contact-suggestions')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3
        # Should be ordered by relevance (descending)
        assert response.data[0]['suggested_name'] == "High Score"
        assert response.data[1]['suggested_name'] == "Medium Score"
        assert response.data[2]['suggested_name'] == "Low Score"


@pytest.mark.django_db
class TestDiscoverySearchEndpoints:
    """Test discovery search API endpoints"""

    def test_list_searches_empty(self, authenticated_client):
        """Test listing searches when none exist"""
        response = authenticated_client.get('/api/discovery-searches')
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_create_discovery_search(self, authenticated_client, test_user):
        """Test creating a new discovery search"""
        search_data = {
            'target_companies': ['Google', 'Microsoft'],
            'target_roles': ['Software Engineer'],
            'target_industries': ['Technology'],
            'target_locations': ['San Francisco'],
            'include_alumni': True,
            'include_mutual_connections': False,
            'include_industry_leaders': True
        }
        
        response = authenticated_client.post('/api/discovery-searches', search_data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert 'search' in response.data
        assert 'suggestions' in response.data
        
        # Verify search was created
        search = DiscoverySearch.objects.get(id=response.data['search']['id'])
        assert search.user == test_user
        assert search.target_companies == ['Google', 'Microsoft']
        assert search.target_roles == ['Software Engineer']
        assert search.include_alumni is True

    def test_get_search_detail(self, authenticated_client, test_user):
        """Test retrieving search details"""
        search = DiscoverySearch.objects.create(
            user=test_user,
            target_companies=['Google'],
            target_roles=['Engineer'],
            results_count=5
        )
        
        response = authenticated_client.get(f'/api/discovery-searches/{search.id}')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['search']['id'] == str(search.id)
        assert 'suggestions' in response.data


@pytest.mark.django_db
class TestDiscoveryAnalytics:
    """Test discovery analytics endpoint"""

    def test_get_analytics_empty(self, authenticated_client):
        """Test analytics with no data"""
        response = authenticated_client.get('/api/discovery/analytics')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['overview']['total_suggestions'] == 0

    def test_get_analytics_with_data(self, authenticated_client, test_user):
        """Test retrieving discovery analytics"""
        ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="Contact 1",
            suggestion_type="target_company",
            status="suggested",
            relevance_score=0.8,
            reason="Test"
        )
        ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="Contact 2",
            suggestion_type="alumni",
            status="connected",
            relevance_score=0.75,
            reason="Test"
        )
        ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="Contact 3",
            suggestion_type="target_company",
            status="contacted",
            relevance_score=0.85,
            reason="Test"
        )
        
        response = authenticated_client.get('/api/discovery/analytics')
        assert response.status_code == status.HTTP_200_OK
        assert 'overview' in response.data
        assert 'by_type' in response.data
        assert response.data['overview']['total_suggestions'] == 3
        assert response.data['overview']['connected'] == 1
        assert response.data['overview']['contacted'] == 1
        
        # Check type breakdown
        assert 'target_company' in response.data['by_type']
        assert 'alumni' in response.data['by_type']

    def test_analytics_conversion_rates(self, authenticated_client, test_user):
        """Test that conversion rates are calculated correctly"""
        # Create 10 suggestions, 3 connected
        for i in range(7):
            ContactSuggestion.objects.create(
                user=test_user,
                suggested_name=f"Contact {i}",
                suggestion_type="target_company",
                status="suggested",
                relevance_score=0.8,
                reason="Test"
            )
        for i in range(3):
            ContactSuggestion.objects.create(
                user=test_user,
                suggested_name=f"Connected {i}",
                suggestion_type="alumni",
                status="connected",
                relevance_score=0.9,
                reason="Test"
            )
        
        response = authenticated_client.get('/api/discovery/analytics')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['overview']['total_suggestions'] == 10
        assert response.data['overview']['connected'] == 3
        assert response.data['overview']['connection_rate'] == 30.0  # 3/10 * 100


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
        assert suggestion.status == "suggested"
        assert suggestion.created_at is not None

    def test_suggestion_defaults(self, test_user):
        """Test default values for suggestion"""
        suggestion = ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="Test",
            suggestion_type="alumni",
            relevance_score=0.7,
            reason="Test"
        )
        
        assert suggestion.status == "suggested"
        assert suggestion.mutual_connections == []

    def test_suggestion_with_alumni_fields(self, test_user):
        """Test suggestion with alumni-specific fields"""
        suggestion = ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="Alumni Contact",
            suggestion_type="alumni",
            shared_institution="MIT",
            shared_degree="Computer Science",
            relevance_score=0.9,
            reason="Fellow MIT grad"
        )
        
        assert suggestion.shared_institution == "MIT"
        assert suggestion.shared_degree == "Computer Science"

    def test_suggestion_with_mutual_connections(self, test_user):
        """Test suggestion with mutual connections"""
        suggestion = ContactSuggestion.objects.create(
            user=test_user,
            suggested_name="Mutual Contact",
            suggestion_type="mutual_connection",
            mutual_connections=["Alice Smith", "Bob Jones"],
            relevance_score=0.85,
            reason="2 mutual connections"
        )
        
        assert len(suggestion.mutual_connections) == 2
        assert "Alice Smith" in suggestion.mutual_connections


@pytest.mark.django_db
class TestDiscoverySearchModel:
    """Test DiscoverySearch model"""

    def test_create_search(self, test_user):
        """Test creating a discovery search"""
        search = DiscoverySearch.objects.create(
            user=test_user,
            target_companies=['Google', 'Microsoft'],
            target_roles=['Software Engineer'],
            target_industries=['Technology'],
            target_locations=['San Francisco'],
            include_alumni=True,
            include_mutual_connections=False,
            include_industry_leaders=True
        )
        
        assert search.id is not None
        assert search.user == test_user
        assert len(search.target_companies) == 2
        assert search.include_alumni is True

    def test_search_defaults(self, test_user):
        """Test default values for search"""
        search = DiscoverySearch.objects.create(
            user=test_user
        )
        
        assert search.target_companies == []
        assert search.results_count == 0
        assert search.contacted_count == 0
        assert search.connected_count == 0

    def test_search_results_tracking(self, test_user):
        """Test that search tracks results metrics"""
        search = DiscoverySearch.objects.create(
            user=test_user,
            target_companies=['Apple'],
            results_count=10
        )
        
        assert search.results_count == 10
        
        # Update metrics
        search.contacted_count = 3
        search.connected_count = 1
        search.save()
        
        search.refresh_from_db()
        assert search.contacted_count == 3
        assert search.connected_count == 1

