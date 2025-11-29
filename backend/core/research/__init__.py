"""
Research package centralizing automated company intelligence workflows.

Exposes the high-level service along with helper utilities so callers can use
`core.research` as the single import surface rather than reaching into
individual modules.
"""

from .service import CompanyResearchService, automated_company_research
from .enrichment import fetch_profile_from_yfinance, fallback_domain
from .news import fetch_recent_company_news

__all__ = [
    "CompanyResearchService",
    "automated_company_research",
    "fetch_profile_from_yfinance",
    "fallback_domain",
    "fetch_recent_company_news",
]
