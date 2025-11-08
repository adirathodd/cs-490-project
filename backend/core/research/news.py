import logging
import re
from datetime import datetime
from email.utils import parsedate_to_datetime
from html import unescape
from typing import List, Dict, Optional
from urllib.parse import quote, urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

GOOGLE_NEWS_SEARCH = "https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
USER_AGENT = "ResumeRocketNewsBot/1.0 (+https://github.com)"
DEFAULT_HEADERS = {"User-Agent": USER_AGENT}

CATEGORY_KEYWORDS = [
    ("funding", ["series", "raise", "funding", "investment", "ipo", "acquisition"]),
    ("product", ["launch", "product", "feature", "platform", "release", "roadmap"]),
    ("hiring", ["hiring", "recruit", "expands team", "headcount", "talent"]),
    ("partnership", ["partner", "partnership", "alliance", "collaborat"]),
    ("market", ["market share", "expansion", "opens new", "global", "geographic"]),
    ("culture", ["culture", "diversity", "inclusion", "employee experience", "benefits"]),
]


def fetch_recent_company_news(
    company_name: str,
    max_results: int = 5,
    session: Optional[requests.Session] = None,
) -> List[Dict]:
    """
    Fetch recent company news using Google News RSS (free, no key required).

    Returns list of dicts matching CompanyResearch.recent_news expectations.
    """
    if not company_name:
        return []

    query = quote(f'"{company_name}" company news')
    url = GOOGLE_NEWS_SEARCH.format(query=query)
    sess = session or requests.Session()

    try:
        response = sess.get(url, timeout=15, headers=DEFAULT_HEADERS)
    except requests.RequestException as exc:
        logger.error("News fetch failed for %s: %s", company_name, exc)
        return []

    if response.status_code != 200:
        logger.warning("News fetch returned %s for %s", response.status_code, company_name)
        return []

    soup = BeautifulSoup(response.text, "xml")
    items = []
    for item in soup.find_all("item")[:max_results]:
        parsed = _parse_rss_item(item, company_name)
        if parsed:
            items.append(parsed)

    return items


def _parse_rss_item(item, company_name: str) -> Optional[Dict]:
    title = item.title.text.strip() if item.title else None
    if not title:
        return None

    link = item.link.text.strip() if item.link else ""
    pub_date_raw = item.pubDate.text.strip() if item.pubDate else ""
    summary_html = item.description.text if item.description else ""
    summary = _clean_summary(summary_html) or title

    source_text = None
    if item.source:
        source_text = item.source.text.strip()
    if not source_text:
        source_text = _domain_from_url(link)

    category = _infer_category(title, summary)
    key_points = _extract_key_points(summary, title)
    relevance_score = _score_relevance(category, summary, company_name)
    published_at = _parse_datetime(pub_date_raw) or datetime.utcnow()

    return {
        "title": title,
        "url": link,
        "summary": summary,
        "date": published_at.isoformat(),
        "source": source_text or "Company Newsroom",
        "category": category,
        "key_points": key_points,
        "relevance_score": relevance_score,
        "is_alert": relevance_score >= 80 or category in {"funding", "hiring"},
    }


def _clean_summary(description: str) -> str:
    if not description:
        return ""
    decoded = unescape(description)
    soup = BeautifulSoup(decoded, "html.parser")
    text = soup.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text)


def _domain_from_url(url: str) -> str:
    if not url:
        return "Company Newsroom"
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ""
        if host.startswith("www."):
            host = host[4:]
        return host or "Company Newsroom"
    except Exception:
        return "Company Newsroom"


def _parse_datetime(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = parsedate_to_datetime(value)
        if dt and not dt.tzinfo:
            return dt
        return dt.astimezone(tz=None) if dt else None
    except Exception:
        try:
            return datetime.fromisoformat(value)
        except Exception:
            return None


def _infer_category(title: str, summary: str) -> str:
    text = f"{title} {summary}".lower()
    for category, keywords in CATEGORY_KEYWORDS:
        if any(keyword in text for keyword in keywords):
            return category
    return "update"


def _extract_key_points(summary: str, fallback: str) -> List[str]:
    if not summary:
        return [fallback]
    sentences = re.split(r"(?<=[.!?])\s+", summary)
    points = [s.strip() for s in sentences if s.strip()]
    if not points:
        return [fallback]
    return points[:3]


def _score_relevance(category: str, summary: str, company_name: str) -> int:
    base = 55
    category_weight = {
        "funding": 25,
        "hiring": 20,
        "product": 15,
        "partnership": 15,
        "market": 10,
        "culture": 10,
    }.get(category, 5)
    summary_lower = summary.lower()
    company_bonus = 10 if company_name and company_name.lower().split()[0] in summary_lower else 0
    sentiment_penalty = -15 if any(kw in summary_lower for kw in ["layoff", "cuts", "lawsuit"]) else 0
    score = base + category_weight + company_bonus + sentiment_penalty
    return max(10, min(100, int(score)))
