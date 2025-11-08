import pytest
from django.core.management import call_command

from core.models import Company, CompanyResearch
from core.news_scraper import fetch_recent_company_news


class FakeResponse:
    status_code = 200

    def __init__(self, text):
        self.text = text


class FakeSession:
    def __init__(self, text):
        self._text = text

    def get(self, *args, **kwargs):
        return FakeResponse(self._text)


SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>News</title>
    <item>
      <title>Acme raises $10M to grow AI team</title>
      <link>https://example.com/acme-funding</link>
      <pubDate>Tue, 05 Nov 2024 12:00:00 GMT</pubDate>
      <source url="https://example.com">Example News</source>
      <description><![CDATA[<p>Acme continues hiring to scale its AI division.</p>]]></description>
    </item>
    <item>
      <title>Acme launches new developer platform</title>
      <link>https://example.com/acme-product</link>
      <pubDate>Mon, 04 Nov 2024 09:30:00 GMT</pubDate>
      <description><![CDATA[Acme announced a major product release.</p>]]></description>
    </item>
  </channel>
</rss>
"""


def test_fetch_recent_company_news_parses_items():
    session = FakeSession(SAMPLE_RSS)
    results = fetch_recent_company_news("Acme Inc", max_results=2, session=session)

    assert len(results) == 2
    assert results[0]["title"].startswith("Acme raises")
    assert results[0]["category"] in {"funding", "hiring", "product", "update"}
    assert isinstance(results[0]["relevance_score"], int)
    assert "key_points" in results[0]


@pytest.mark.django_db
def test_fetch_company_news_command(monkeypatch):
    company = Company.objects.create(
        name="Acme Inc",
        domain="acme.com",
        industry="Technology",
    )

    sample_payload = [
        {
            "title": "Acme raises $10M",
            "url": "https://example.com",
            "summary": "Acme raises $10M to expand.",
            "date": "2024-11-05T12:00:00",
            "source": "Example",
            "category": "funding",
            "key_points": ["Raises funding"],
            "relevance_score": 90,
            "is_alert": True,
        }
    ]

    monkeypatch.setattr(
        "core.management.commands.fetch_company_news.fetch_recent_company_news",
        lambda *args, **kwargs: sample_payload,
    )

    call_command("fetch_company_news", limit=1, max_news=1, sleep=0)

    research = CompanyResearch.objects.get(company=company)
    assert len(research.recent_news) == 1
    assert research.recent_news[0]["title"] == "Acme raises $10M"
