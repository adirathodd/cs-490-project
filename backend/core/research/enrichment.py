import logging
from urllib.parse import urlparse

import requests
import yfinance as yf
from django.utils.text import slugify

logger = logging.getLogger(__name__)

YAHOO_SEARCH_URL = "https://query2.finance.yahoo.com/v1/finance/search"
HEADERS = {"User-Agent": "ResumeRocketBot/1.0 (+https://github.com/)"}


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
