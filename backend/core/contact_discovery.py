"""
UC-092: Industry Contact Discovery - Suggestion Generation Logic
"""
from django.db.models import Q, Count
from .models import (
    ContactSuggestion, Contact, Education, Company, 
    JobOpportunity, DiscoverySearch
)


def generate_contact_suggestions(user, search_criteria):
    """
    Generate contact suggestions based on user's search criteria
    
    Args:
        user: The user requesting suggestions
        search_criteria: Dict with target_companies, target_roles, target_industries, etc.
    
    Returns:
        List of ContactSuggestion objects
    """
    suggestions = []
    
    target_companies = search_criteria.get('target_companies', [])
    target_roles = search_criteria.get('target_roles', [])
    target_industries = search_criteria.get('target_industries', [])
    target_locations = search_criteria.get('target_locations', [])
    
    include_alumni = search_criteria.get('include_alumni', False)
    include_mutual_connections = search_criteria.get('include_mutual_connections', False)
    include_industry_leaders = search_criteria.get('include_industry_leaders', False)
    
    # Get user's education for alumni matching
    try:
        candidate_profile = user.profile
        user_education = Education.objects.filter(candidate=candidate_profile)
        user_institutions = set(user_education.values_list('institution', flat=True))
        user_degrees = set(user_education.values_list('field_of_study', flat=True))
    except:
        # User has no profile or education
        user_institutions = set()
        user_degrees = set()
    
    # Get user's existing contacts to avoid duplicates
    existing_contacts = set(
        Contact.objects.filter(owner=user).values_list('linkedin_url', flat=True)
    )
    existing_suggestions = set(
        ContactSuggestion.objects.filter(user=user, status='suggested')
        .values_list('suggested_linkedin_url', flat=True)
    )
    
    # 1. Target Company Connections
    if target_companies:
        company_suggestions = _generate_target_company_suggestions(
            user, target_companies, existing_contacts, existing_suggestions
        )
        suggestions.extend(company_suggestions)
    
    # 2. Alumni Connections
    if include_alumni and user_institutions:
        alumni_suggestions = _generate_alumni_suggestions(
            user, user_institutions, user_degrees, target_companies,
            existing_contacts, existing_suggestions
        )
        suggestions.extend(alumni_suggestions)
    
    # 3. Industry Leader Suggestions
    if include_industry_leaders and target_industries:
        leader_suggestions = _generate_industry_leader_suggestions(
            user, target_industries, existing_contacts, existing_suggestions
        )
        suggestions.extend(leader_suggestions)
    
    # 4. Mutual Connection Suggestions
    if include_mutual_connections:
        mutual_suggestions = _generate_mutual_connection_suggestions(
            user, existing_contacts, existing_suggestions
        )
        suggestions.extend(mutual_suggestions)
    
    # Bulk create all suggestions
    if suggestions:
        ContactSuggestion.objects.bulk_create(suggestions)
    
    return suggestions


def _generate_target_company_suggestions(user, target_companies, existing_contacts, existing_suggestions):
    """Generate suggestions for people at target companies"""
    suggestions = []
    
    # In a real implementation, this would:
    # 1. Query LinkedIn API for employees at target companies
    # 2. Filter by relevance criteria (role, seniority, etc.)
    # 3. Check for existing contacts to avoid duplicates
    # For now, return empty list - actual implementation would require external API
    
    return suggestions


def _generate_alumni_suggestions(user, user_institutions, user_degrees, target_companies, existing_contacts, existing_suggestions):
    """Generate suggestions for alumni connections"""
    suggestions = []
    
    if not user_institutions:
        return suggestions
    
    # Find education records from same institutions (excluding user's own profile)
    try:
        candidate_profile = user.profile
        alumni_education = Education.objects.filter(
            institution__in=user_institutions
        ).exclude(candidate=candidate_profile).select_related('candidate')
    except:
        return suggestions
    
    for edu in alumni_education[:20]:  # Limit search
        # Check if this person has contact info we can suggest
        # In a real implementation, this would connect to a LinkedIn API or database
        # For now, create placeholder suggestions
        linkedin_url = f"https://linkedin.com/in/{edu.candidate.email.split('@')[0]}" if hasattr(edu, 'candidate') and hasattr(edu.candidate, 'email') else None
        
        if linkedin_url and linkedin_url not in existing_contacts and linkedin_url not in existing_suggestions:
            suggestion = ContactSuggestion(
                user=user,
                suggested_name=f"Alumni from {edu.institution}",
                suggested_title="Alumni",
                suggested_company="Unknown",
                suggested_linkedin_url=linkedin_url,
                suggested_industry=None,
                suggestion_type='alumni',
                relevance_score=0.75,
                reason=f"Fellow alumnus from {edu.institution}. Degree: {edu.field_of_study or 'Unknown'}",
                shared_institution=edu.institution,
                shared_degree=edu.field_of_study if edu.field_of_study in user_degrees else None,
            )
            suggestions.append(suggestion)
    
    return suggestions[:15]  # Limit to top 15


def _generate_industry_leader_suggestions(user, target_industries, existing_contacts, existing_suggestions):
    """Generate suggestions for industry leaders"""
    suggestions = []
    
    # In a real implementation, this would query a database of industry leaders
    # or use LinkedIn API to find influential people in target industries
    # For now, create placeholder logic
    
    for industry in target_industries[:5]:
        # Create generic industry leader suggestion
        linkedin_url = f"https://linkedin.com/search/results/people/?industry={industry.lower().replace(' ', '-')}"
        
        if linkedin_url not in existing_contacts and linkedin_url not in existing_suggestions:
            suggestion = ContactSuggestion(
                user=user,
                suggested_name=f"Leader in {industry}",
                suggested_title="Industry Leader",
                suggested_company="Various",
                suggested_linkedin_url=linkedin_url,
                suggested_industry=industry,
                suggestion_type='industry_leader',
                relevance_score=0.70,
                reason=f"Influential professional in {industry} industry",
            )
            suggestions.append(suggestion)
    
    return suggestions[:5]  # Limit to top 5


def _generate_mutual_connection_suggestions(user, existing_contacts, existing_suggestions):
    """Generate suggestions based on mutual connections"""
    suggestions = []
    
    # Get user's contacts
    user_contacts = Contact.objects.filter(owner=user)
    
    # In a real implementation, this would:
    # 1. Query LinkedIn API for mutual connections
    # 2. Analyze connection paths between user and potential contacts
    # 3. Calculate connection strength based on mutual connections
    
    # For now, create placeholder logic
    # Look for contacts who might know other people (based on same company)
    companies = user_contacts.filter(company_name__isnull=False).values_list('company_name', flat=True).distinct()
    
    for company in companies[:10]:
        if company:
            linkedin_url = f"https://linkedin.com/search/results/people/?company={company.lower().replace(' ', '-')}"
            
            if linkedin_url not in existing_contacts and linkedin_url not in existing_suggestions:
                # Find a contact at this company to use as mutual connection
                mutual_contact = user_contacts.filter(company_name=company).first()
                
                suggestion = ContactSuggestion(
                    user=user,
                    suggested_name=f"Connection at {company}",
                    suggested_title="Employee",
                    suggested_company=company,
                    suggested_linkedin_url=linkedin_url,
                    suggestion_type='mutual_connection',
                    relevance_score=0.80,
                    reason=f"Potential mutual connection through {mutual_contact.display_name if mutual_contact else 'your network'} at {company}",
                    mutual_connections=[mutual_contact.display_name] if mutual_contact else [],
                    connection_path={
                        'intermediary': mutual_contact.display_name if mutual_contact else None,
                        'company': company
                    }
                )
                suggestions.append(suggestion)
    
    return suggestions[:10]  # Limit to top 10


def calculate_suggestion_relevance(suggestion, user):
    """
    Calculate relevance score for a contact suggestion
    
    Factors:
    - Mutual connections (high weight)
    - Alumni status (medium weight)
    - Target company match (high weight)
    - Industry match (medium weight)
    - Recent activity (low weight)
    
    Returns:
        Float between 0.0 and 1.0
    """
    score = 0.5  # Base score
    
    # Boost for mutual connections
    if suggestion.mutual_connections:
        score += 0.2
    
    # Boost for alumni
    if suggestion.shared_institution:
        score += 0.15
        if suggestion.shared_degree:
            score += 0.05
    
    # Boost for target company
    if suggestion.suggestion_type == 'target_company':
        score += 0.25
    
    # Boost for industry match
    user_jobs = JobOpportunity.objects.filter(user=user)
    user_industries = set(user_jobs.values_list('industry', flat=True))
    if suggestion.suggested_industry in user_industries:
        score += 0.1
    
    return min(score, 1.0)  # Cap at 1.0
