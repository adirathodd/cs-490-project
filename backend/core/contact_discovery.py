"""
UC-092: Industry Contact Discovery - Suggestion Generation Logic
"""
from django.db.models import Q, Count
from .models import (
    ContactSuggestion, Contact, Education, Company, 
    JobOpportunity, DiscoverySearch
)


def generate_contact_suggestions(user, search_criteria, search_instance=None):
    """
    Generate contact suggestions based on user's search criteria
    
    Args:
        user: The user requesting suggestions
        search_criteria: Dict with target_companies, target_roles, target_industries, etc.
        search_instance: Optional DiscoverySearch instance to link suggestions to
    
    Returns:
        List of ContactSuggestion objects
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"=== GENERATING SUGGESTIONS ===")
    logger.info(f"User: {user.email}")
    logger.info(f"Search criteria: {search_criteria}")
    
    suggestions = []
    
    target_companies = search_criteria.get('target_companies', [])
    target_roles = search_criteria.get('target_roles', [])
    target_industries = search_criteria.get('target_industries', [])
    target_locations = search_criteria.get('target_locations', [])
    
    logger.info(f"Target companies: {target_companies}")
    logger.info(f"Target roles: {target_roles}")
    logger.info(f"Target industries: {target_industries}")
    
    include_alumni = search_criteria.get('include_alumni', False)
    include_mutual_connections = search_criteria.get('include_mutual_connections', False)
    include_industry_leaders = search_criteria.get('include_industry_leaders', False)
    
    # Get user's education for alumni matching
    user_institutions = set()
    try:
        candidate_profile = user.profile
        user_education = Education.objects.filter(candidate=candidate_profile)
        user_institutions = set(user_education.values_list('institution', flat=True))
    except:
        pass
    
    # Get user's existing contacts
    user_contacts = Contact.objects.filter(owner=user)
    
    # 1. Create search cards for each company + role combination
    if target_companies:
        logger.info(f"Generating search cards for companies")
        company_search_suggestions = _generate_company_search_cards(
            user, target_companies, target_roles, target_locations
        )
        logger.info(f"Generated {len(company_search_suggestions)} company search cards")
        suggestions.extend(company_search_suggestions)
    
    # 2. Create personalized cards for real contacts at target companies
    if target_companies and include_mutual_connections:
        logger.info(f"Generating cards for existing contacts")
        contact_suggestions = _generate_existing_contact_cards(
            user, target_companies, user_contacts
        )
        logger.info(f"Generated {len(contact_suggestions)} contact cards")
        suggestions.extend(contact_suggestions)
    
    # 3. Create alumni search cards if user has education data
    if include_alumni:
        if user_institutions:
            logger.info(f"Generating alumni search cards")
            alumni_suggestions = _generate_alumni_search_cards(
                user, user_institutions, target_companies
            )
            logger.info(f"Generated {len(alumni_suggestions)} alumni search cards")
            suggestions.extend(alumni_suggestions)
        else:
            logger.info(f"No education data, generating prompt card")
            # Create a card prompting user to add education
            prompt_suggestion = _generate_education_prompt_card(user)
            suggestions.append(prompt_suggestion)
    
    # Link suggestions to search instance via metadata
    if search_instance:
        for suggestion in suggestions:
            # Ensure metadata dict exists and add search_id
            if not hasattr(suggestion, 'metadata') or suggestion.metadata is None:
                suggestion.metadata = {}
            suggestion.metadata['discovery_search_id'] = str(search_instance.id)
    
    # Bulk create all suggestions and return created objects with IDs
    if suggestions:
        logger.info(f"Bulk creating {len(suggestions)} suggestions")
        created = ContactSuggestion.objects.bulk_create(suggestions)
        # Re-query to get the objects with all fields properly populated
        result = list(ContactSuggestion.objects.filter(
            id__in=[s.id for s in created]
        ).order_by('-relevance_score'))
        logger.info(f"Returning {len(result)} suggestions with IDs")
        return result
    
    logger.warning("No suggestions generated!")
    return []


def _generate_company_search_cards(user, target_companies, target_roles, target_locations):
    """Generate LinkedIn search cards for company + role combinations"""
    import hashlib
    suggestions = []
    
    for company in target_companies[:5]:
        # If user specified roles, create one card per role per company
        if target_roles:
            for role in target_roles[:3]:
                # Build search query
                keywords = f"{company} {role}"
                if target_locations:
                    keywords += f" {target_locations[0]}"
                
                search_url = f"https://linkedin.com/search/results/people/?keywords={keywords.replace(' ', '%20')}"
                
                # Create unique ID for this search
                card_id = hashlib.md5(f"{company}{role}".encode()).hexdigest()[:8]
                
                suggestion = ContactSuggestion(
                    user=user,
                    suggested_name=f"Find {role}s at {company}",
                    suggested_title=role,
                    suggested_company=company,
                    suggested_linkedin_url=search_url,
                    suggestion_type='target_company',
                    relevance_score=0.85,
                    reason=f"Search LinkedIn for {role}s at {company}. Use filters for location, experience level, and connections to narrow results.",
                    metadata={'search_type': 'company_role', 'card_id': card_id}
                )
                suggestions.append(suggestion)
        else:
            # No roles specified, create general company search
            keywords = company
            if target_locations:
                keywords += f" {target_locations[0]}"
            
            search_url = f"https://linkedin.com/search/results/people/?keywords={keywords.replace(' ', '%20')}"
            card_id = hashlib.md5(company.encode()).hexdigest()[:8]
            
            suggestion = ContactSuggestion(
                user=user,
                suggested_name=f"Find people at {company}",
                suggested_title="Various Roles",
                suggested_company=company,
                suggested_linkedin_url=search_url,
                suggestion_type='target_company',
                relevance_score=0.80,
                reason=f"Search LinkedIn for professionals at {company}. Filter by role, location, and connection level.",
                metadata={'search_type': 'company_general', 'card_id': card_id}
            )
            suggestions.append(suggestion)
    
    return suggestions


def _generate_existing_contact_cards(user, target_companies, user_contacts):
    """Generate cards for user's existing contacts at target companies"""
    suggestions = []
    
    for company in target_companies:
        # Find contacts at this company
        contacts_at_company = user_contacts.filter(company_name=company)
        
        for contact in contacts_at_company[:3]:  # Max 3 per company
            suggestion = ContactSuggestion(
                user=user,
                suggested_name=contact.display_name,
                suggested_title=contact.title or "Contact",
                suggested_company=company,
                suggested_linkedin_url=contact.linkedin_url or f"https://linkedin.com/search/results/people/?keywords={contact.display_name.replace(' ', '%20')}",
                suggestion_type='mutual_connection',
                relevance_score=0.95,  # Highest priority - these are real contacts!
                reason=f"You already know {contact.display_name} at {company}! Reach out to ask about opportunities, get referrals, or request an informational interview.",
                metadata={'contact_id': str(contact.id), 'is_existing_contact': True}
            )
            suggestions.append(suggestion)
    
    return suggestions


def _generate_alumni_search_cards(user, user_institutions, target_companies):
    """Generate LinkedIn search cards for alumni"""
    import hashlib
    suggestions = []
    
    for institution in list(user_institutions)[:3]:  # Max 3 schools
        if target_companies:
            # Alumni at target companies
            for company in target_companies[:2]:  # Max 2 companies per school
                keywords = f"{institution} alumni {company}"
                search_url = f"https://linkedin.com/search/results/people/?keywords={keywords.replace(' ', '%20')}"
                card_id = hashlib.md5(f"{institution}{company}".encode()).hexdigest()[:8]
                
                suggestion = ContactSuggestion(
                    user=user,
                    suggested_name=f"Find {institution} alumni at {company}",
                    suggested_title="Alumni",
                    suggested_company=company,
                    suggested_linkedin_url=search_url,
                    suggestion_type='alumni',
                    relevance_score=0.90,
                    reason=f"Fellow {institution} alumni at {company}. Alumni connections have higher response rates and are often willing to help.",
                    shared_institution=institution,
                    metadata={'search_type': 'alumni_company', 'card_id': card_id}
                )
                suggestions.append(suggestion)
        else:
            # General alumni search
            keywords = f"{institution} alumni"
            search_url = f"https://linkedin.com/search/results/people/?keywords={keywords.replace(' ', '%20')}"
            card_id = hashlib.md5(institution.encode()).hexdigest()[:8]
            
            suggestion = ContactSuggestion(
                user=user,
                suggested_name=f"Find {institution} alumni",
                suggested_title="Alumni Network",
                suggested_company="Various",
                suggested_linkedin_url=search_url,
                suggestion_type='alumni',
                relevance_score=0.85,
                reason=f"Connect with fellow {institution} alumni. Filter by industry, company, or location to find relevant connections.",
                shared_institution=institution,
                metadata={'search_type': 'alumni_general', 'card_id': card_id}
            )
            suggestions.append(suggestion)
    
    return suggestions


def _generate_education_prompt_card(user):
    """Generate a prompt card encouraging user to add education data"""
    return ContactSuggestion(
        user=user,
        suggested_name="Add your education to unlock alumni connections",
        suggested_title="Action Needed",
        suggested_company="Your Profile",
        suggested_linkedin_url="/profile",  # Link to profile page
        suggestion_type='alumni',
        relevance_score=0.70,
        reason="Add your educational background to discover alumni connections. Alumni networks are one of the most powerful resources for job searching and career growth.",
        metadata={'action_type': 'add_education', 'is_prompt': True}
    )
