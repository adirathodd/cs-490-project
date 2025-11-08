import logging
from urllib.parse import urlparse

import requests
import yfinance as yf
from django.utils.text import slugify

logger = logging.getLogger(__name__)

YAHOO_SEARCH_URL = "https://query2.finance.yahoo.com/v1/finance/search"
HEADERS = {"User-Agent": "ResumeRocketBot/1.0 (+https://github.com/)"}


def ensure_company_profile(company_name):
    """Ensure we have a Company + CompanyResearch populated for the given name."""
    if company_name == "Other":
        return None
    if not company_name:
        return None

    from core.models import Company, CompanyResearch  # late import to avoid circular

    company = Company.objects.filter(name__iexact=company_name).first()

    enriched = enrich_company_from_yfinance(company_name, existing=company)
    if enriched:
        return enriched

    if company:
        CompanyResearch.objects.get_or_create(company=company)
        return company

    domain = fallback_domain(company_name)
    company = Company.objects.create(name=company_name, domain=domain)
    CompanyResearch.objects.create(company=company)
    return company


def enrich_company_from_yfinance(company_name, existing=None):
    """Fetch data from yfinance and persist it. Returns Company or None."""
    profile = fetch_profile_from_yfinance(company_name)
    if not profile:
        return None

    from core.models import Company, CompanyResearch

    company = existing
    if company is None:
        company = Company.objects.filter(domain=profile["domain"]).first()

    if company is None:
        company = Company.objects.create(
            name=profile["name"],
            domain=profile["domain"],
            industry=profile["industry"],
            size=str(profile["employees"] or ""),
            hq_location=profile["hq_location"],
        )
    else:
        company.name = profile["name"]
        company.industry = profile["industry"]
        company.size = str(profile["employees"] or "")
        company.hq_location = profile["hq_location"]
        if not company.domain or company.domain.endswith(".com"):
            company.domain = profile["domain"] or company.domain
        company.save()

    research, _ = CompanyResearch.objects.get_or_create(company=company)
    research.description = profile["description"]
    research.mission_statement = profile["mission_statement"]
    research.culture_keywords = [kw for kw in profile["keywords"] if kw]
    research.employee_count = profile["employees"]
    research.funding_info = profile["funding_info"]
    research.recent_news = []  # yfinance-only source for now
    research.save()

    return company


def fetch_profile_from_yfinance(company_name):
    """Use Yahoo's search endpoint + yfinance to fetch a company's fundamentals."""
    symbol = search_symbol(company_name)
    if not symbol:
        return None

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.get_info()
    except Exception as exc:  # noqa: BLE001
        logger.warning("yfinance lookup failed for %s (%s): %s", company_name, symbol, exc)
        return None

    if not info:
        return None

    website = info.get("website") or ""
    domain = extract_domain(website) or fallback_domain(info.get("longName") or company_name)
    description = info.get("longBusinessSummary") or ""
    employees = info.get("fullTimeEmployees")
    industry = info.get("industry") or ""
    sector = info.get("sector") or ""
    hq_location = ", ".join(part for part in [info.get("city"), info.get("state"), info.get("country")] if part)

    return {
        "name": info.get("longName") or info.get("shortName") or company_name,
        "industry": industry,
        "sector": sector,
        "website": website,
        "domain": domain,
        "description": description,
        "mission_statement": first_sentence(description),
        "employees": employees,
        "hq_location": hq_location,
        "keywords": [industry, sector],
        "funding_info": {
            "market_cap": info.get("marketCap"),
            "price_to_earnings": info.get("trailingPE"),
            "beta": info.get("beta"),
        },
    }


def search_symbol(company_name):
    try:
        response = requests.get(
            YAHOO_SEARCH_URL,
            params={"q": company_name, "lang": "en-US", "region": "US"},
            headers=HEADERS,
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        logger.warning("Yahoo search failed for %s: %s", company_name, exc)
        return None

    for quote in data.get("quotes", []):
        symbol = quote.get("symbol")
        if symbol:
            return symbol
    return None


def extract_domain(website: str):
    if not website:
        return ""
    parsed = urlparse(website if website.startswith("http") else f"https://{website}")
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def fallback_domain(company_name: str):
    slug = slugify(company_name) or "company"
    slug = slug.replace("-", "")
    return f"{slug}.com"


def first_sentence(text: str):
    if not text:
        return ""
    return text.split(". ")[0].strip()
