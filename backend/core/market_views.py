from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from core.models import MarketIntelligence
from core.serializers import MarketIntelligenceSerializer
from django.db.models import Q

from core import market_providers
from collections import Counter
import math


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def market_intelligence_view(request):
    """
    Aggregated market intelligence endpoint.

    Query params:
    - industry: str (optional)
    - location: str (optional)
    - role / search: str (optional)
    """
    industry = request.query_params.get('industry')
    location = request.query_params.get('location')
    role = request.query_params.get('role') or request.query_params.get('search')

    # Use public job provider APIs to fetch a set of recent job postings
    jobs = market_providers.aggregate_job_providers(search=role, category=industry, location=location, limit=300)

    # Derive top companies
    company_names = []
    skills = []
    for j in jobs:
        # job structures vary between providers
        company = j.get('company_name') or j.get('company') or j.get('company_name') or j.get('company_slug') or ''
        title = j.get('title') or j.get('job_title') or ''
        # append company if present
        if company:
            company_names.append(company.strip())
        # attempt to extract tags/skills
        tags = j.get('tags') or j.get('job_tags') or j.get('categories') or j.get('category')
        if isinstance(tags, (list, tuple)):
            skills.extend([t for t in tags if isinstance(t, str)])
        elif isinstance(tags, str):
            for part in tags.split(','):
                skills.append(part.strip())

    company_counts = Counter([c for c in company_names if c])
    top_companies = [c for c, _ in company_counts.most_common(8)]

    # Top skills
    skill_counts = Counter([s for s in skills if s])
    top_skills = [s for s, _ in skill_counts.most_common(10)]

    # Demand score (0-100) approximated from posting density
    posting_count = max(1, len(jobs))
    demand_score = min(100, int(math.log(posting_count + 1) / math.log(2) * 10))

    payload = {
        'industry': industry or '',
        'location': location or '',
        'role': role or '',
        'postings_sample_count': len(jobs),
        'topCompanies': top_companies or ['No hiring companies found'],
        'skills': top_skills,
        'demandScore': demand_score,
        'growth': 'growing' if demand_score > 60 else ('stable' if demand_score > 30 else 'declining'),
    }

    # Optionally return existing MarketIntelligence rows if present (useful for salary data)
    queryset = MarketIntelligence.objects.all()
    if industry:
        queryset = queryset.filter(industry__iexact=industry)
    if location:
        queryset = queryset.filter(location__icontains=location)

    serializer = MarketIntelligenceSerializer(queryset, many=True)
    payload['salaryBenchmarks'] = serializer.data

    return Response(payload)
