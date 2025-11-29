import pytest
from django.core.management import call_command

from core.models import Company, CompanyResearch


class DummyTicker:
    def __init__(self, info):
        self._info = info

    def get_info(self):
        return self._info


@pytest.mark.django_db
def test_fetch_company_data_uses_yfinance(monkeypatch):
    sample_info = {
        "longName": "Acme Corporation",
        "industry": "Technology",
        "website": "https://www.acme.com",
        "longBusinessSummary": "Acme Corporation builds rockets and gadgets.",
        "city": "New York",
        "state": "NY",
        "country": "USA",
        "fullTimeEmployees": 12345,
        "sector": "Industrials",
        "marketCap": 1000000000,
        "trailingPE": 15.2,
    }

    def fake_ticker(symbol):
        assert symbol == "ACME"
        return DummyTicker(sample_info)

    monkeypatch.setattr("core.management.commands.fetch_company_data.yf.Ticker", fake_ticker)

    call_command("fetch_company_data", limit=1, tickers="ACME")

    company = Company.objects.get(domain="acme.com")
    assert company.name == "Acme Corporation"
    assert company.industry == "Technology"
    assert company.hq_location == "New York, NY, USA"

    research = CompanyResearch.objects.get(company=company)
    assert research.description.startswith("Acme Corporation builds rockets")
    assert research.employee_count == 12345
    assert research.recent_news == []
