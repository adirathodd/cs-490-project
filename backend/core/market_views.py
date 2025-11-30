from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from core.models import MarketIntelligence
from core.serializers import MarketIntelligenceSerializer

from core import market_intel, market_providers


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

    jobs = market_providers.aggregate_job_providers(search=role, category=industry, location=location, limit=300)
    payload = market_intel.generate_snapshot(industry, location, role, jobs)

    # Optionally return existing MarketIntelligence rows if present (useful for salary data)
    queryset = MarketIntelligence.objects.all()
    if industry:
        queryset = queryset.filter(industry__iexact=industry)
    if location:
        queryset = queryset.filter(location__icontains=location)

    serializer = MarketIntelligenceSerializer(queryset, many=True)
    payload['salaryBenchmarks'] = serializer.data

    return Response(payload)
