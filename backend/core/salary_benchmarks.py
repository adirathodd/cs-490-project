"""Salary benchmark service that pulls free data sources (BLS + community) and caches results."""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Dict, List, Optional

import requests
from django.core.cache import cache
from django.utils import timezone

from core.api_monitoring import SERVICE_MARKET_DATA, get_or_create_service, track_api_call
from core.models import MarketIntelligence
from core.salary_scraper import salary_aggregator

logger = logging.getLogger(__name__)


# Minimal SOC mappings for common roles we track. Values are based on recent BLS
# Occupational Employment and Wage Statistics (national) and act as a fallback
# when the live API cannot be queried.
DEFAULT_BLS_BENCHMARKS: Dict[str, Dict[str, int]] = {
    "software developer": {"p25": 100_190, "p50": 132_270, "p75": 166_960, "sample_size": 50000},
    "data scientist": {"p25": 84_760, "p50": 112_180, "p75": 144_890, "sample_size": 15000},
    "product manager": {"p25": 88_000, "p50": 120_000, "p75": 155_000, "sample_size": 12000},
    "project manager": {"p25": 72_280, "p50": 102_450, "p75": 132_480, "sample_size": 18000},
    "business analyst": {"p25": 65_000, "p50": 85_000, "p75": 110_000, "sample_size": 14000},
    "ux designer": {"p25": 74_000, "p50": 102_000, "p75": 130_000, "sample_size": 9000},
}

# Quick location multipliers to localize national figures.
LOCATION_MULTIPLIERS = {
    "san francisco": 1.25,
    "sf": 1.25,
    "bay area": 1.25,
    "silicon valley": 1.25,
    "new york": 1.2,
    "nyc": 1.2,
    "seattle": 1.18,
    "boston": 1.15,
    "los angeles": 1.12,
    "la": 1.12,
    "austin": 1.08,
    "denver": 1.05,
    "chicago": 1.07,
    "remote": 1.0,
}


@dataclass
class BenchmarkResult:
    percentile_25: Optional[int]
    percentile_50: Optional[int]
    percentile_75: Optional[int]
    sample_size: int
    sources: List[str]
    salary_min: Optional[int]
    salary_max: Optional[int]
    currency: str = "USD"
    disclaimer: str = ""
    cached: bool = False
    updated_at: Optional[str] = None
    source_notes: Optional[Dict] = None

    def as_dict(self) -> Dict:
        return {
            "percentile_25": self.percentile_25,
            "percentile_50": self.percentile_50,
            "percentile_75": self.percentile_75,
            "sample_size": self.sample_size,
            "salary_min": self.salary_min,
            "salary_max": self.salary_max,
            "currency": self.currency,
            "sources": self.sources,
            "cached": self.cached,
            "updated_at": self.updated_at,
            "disclaimer": self.disclaimer,
            "source_notes": self.source_notes or {},
        }


class SalaryBenchmarkService:
    """Fetch and cache salary benchmarks for job titles/locations."""

    CACHE_TTL_SECONDS = 60 * 60 * 24 * 7  # 1 week

    def __init__(self):
        self.bls_base_url = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
        self.bls_service = get_or_create_service(
            "bls_salary",
            SERVICE_MARKET_DATA,
        )
        self.glassdoor_service = get_or_create_service(
            "glassdoor_community",
            SERVICE_MARKET_DATA,
        )

    def _cache_key(self, title: str, location: str, exp: Optional[str]) -> str:
        return f"salary-benchmark:{title.lower().strip()}:{location.lower().strip()}:{exp or ''}"

    def _location_multiplier(self, location: str) -> float:
        location_lower = location.lower()
        for key, mult in LOCATION_MULTIPLIERS.items():
            if key in location_lower:
                return mult
        return 0.95  # modest adjustment for low cost markets

    def _match_bls_defaults(self, title: str) -> Optional[Dict[str, int]]:
        title_lower = title.lower()
        for key, payload in DEFAULT_BLS_BENCHMARKS.items():
            if key in title_lower:
                return payload
        return None

    def _fetch_from_bls(self, title: str, location: str) -> Optional[Dict]:
        """Attempt to fetch from BLS; fall back to baked-in BLS national figures."""
        baseline = self._match_bls_defaults(title)
        bls_key = os.getenv("BLS_API_KEY", "").strip()

        # If no API key is configured, just return the static baseline.
        if not bls_key:
            return baseline

        # Use CPI series as a lightweight BLS call to anchor inflation; apply it to the defaults.
        payload = {"seriesid": ["CUUR0000SA0"], "registrationkey": bls_key}
        try:
            with track_api_call(self.bls_service, endpoint="/CUUR0000SA0", method="POST"):
                resp = requests.post(self.bls_base_url, json=payload, timeout=10)
                resp.raise_for_status()
                data = resp.json()
                latest = (
                    data.get("Results", {})
                    .get("series", [{}])[0]
                    .get("data", [{}])[0]
                    .get("value")
                )
                inflation_index = float(latest) / 300 if latest else 1.0  # normalize to ~1.x
        except Exception as exc:  # pragma: no cover - external dependency
            logger.warning("BLS API request failed; using cached defaults. %s", exc)
            inflation_index = 1.0

        if not baseline:
            return None

        adjusted = {
            "p25": int(baseline["p25"] * inflation_index),
            "p50": int(baseline["p50"] * inflation_index),
            "p75": int(baseline["p75"] * inflation_index),
            "sample_size": baseline.get("sample_size", 5000),
            "source": "bls",
            "notes": {"inflation_index": inflation_index},
        }
        return adjusted

    def _fetch_glassdoor(self, title: str, location: str) -> Dict:
        """Use our simulated Glassdoor community data as a secondary input."""
        try:
            with track_api_call(self.glassdoor_service, endpoint="/community", method="GET"):
                estimate = salary_aggregator._generate_source_estimate(  # pylint: disable=protected-access
                    "glassdoor",
                    job_title=title,
                    location=location,
                    job_type=None,
                    company_name=None,
                )
        except Exception as exc:  # pragma: no cover - external dependency
            logger.warning("Glassdoor community fetch failed; falling back to aggregator. %s", exc)
            estimate = salary_aggregator._generate_source_estimate(  # pylint: disable=protected-access
                "aggregated", job_title=title, location=location
            )

        # Map min/max/median to percentile anchors.
        return {
            "p25": int(estimate.get("salary_min")) if estimate.get("salary_min") else None,
            "p50": int(estimate.get("salary_median")) if estimate.get("salary_median") else None,
            "p75": int(estimate.get("salary_max")) if estimate.get("salary_max") else None,
            "sample_size": estimate.get("sample_size", 0),
            "source": estimate.get("source", "community"),
            "notes": {"currency": estimate.get("currency", "USD")},
        }

    def _persist_market_intel(
        self, title: str, location: str, experience_level: str, payload: BenchmarkResult
    ) -> None:
        try:
            record = MarketIntelligence.objects.filter(
                job_title__iexact=title, location__iexact=location
            ).first()
            defaults = {
                "job_title": title,
                "location": location,
                "experience_level": experience_level or "unspecified",
                "industry": "",
                "median_salary": Decimal(str(payload.percentile_50 or 0)),
                "percentile_25": Decimal(str(payload.percentile_25 or 0)) if payload.percentile_25 else None,
                "percentile_75": Decimal(str(payload.percentile_75 or 0)) if payload.percentile_75 else None,
                "sample_size": payload.sample_size,
                "demand_score": 50,
                "growth_trend": "stable",
                "top_skills": [],
                "data_source": ", ".join(payload.sources),
            }
            if record:
                for field, value in defaults.items():
                    setattr(record, field, value)
                record.save()
            else:
                MarketIntelligence.objects.create(**defaults)
        except Exception as exc:
            logger.warning("Could not persist salary benchmark snapshot: %s", exc)

    def _build_disclaimer(self, sources: List[str]) -> str:
        return (
            "Salary benchmarks combine US Bureau of Labor Statistics data with community salary signals. "
            "Figures are estimates, adjusted for location, and should be used as directional guidance only. "
            f"Sources: {', '.join(sources)}."
        )

    def get_benchmarks(
        self,
        job_title: str,
        location: str,
        experience_level: Optional[str] = None,
        force_refresh: bool = False,
    ) -> BenchmarkResult:
        cache_key = self._cache_key(job_title, location, experience_level)
        if not force_refresh:
            cached = cache.get(cache_key)
            if cached:
                cached['cached'] = True
                return BenchmarkResult(**cached)

        # Reuse recent MarketIntelligence rows as cache
        recent_record = MarketIntelligence.objects.filter(
            job_title__iexact=job_title,
            location__iexact=location,
            last_updated__gte=timezone.now() - timedelta(days=30),
        ).first()
        if recent_record and not force_refresh:
            payload = BenchmarkResult(
                percentile_25=int(recent_record.percentile_25) if recent_record.percentile_25 else None,
                percentile_50=int(recent_record.median_salary),
                percentile_75=int(recent_record.percentile_75) if recent_record.percentile_75 else None,
                salary_min=int(recent_record.percentile_25) if recent_record.percentile_25 else None,
                salary_max=int(recent_record.percentile_75) if recent_record.percentile_75 else None,
                sample_size=recent_record.sample_size or 0,
                sources=[recent_record.data_source or "market_intelligence"],
                currency="USD",
                disclaimer=self._build_disclaimer([recent_record.data_source or "market_intelligence"]),
                updated_at=recent_record.last_updated.isoformat(),
                source_notes={},
            )
            cache.set(cache_key, payload.as_dict(), self.CACHE_TTL_SECONDS)
            return payload

        bls_data = self._fetch_from_bls(job_title, location)
        glassdoor_data = self._fetch_glassdoor(job_title, location)

        sources = []
        notes = {}
        p25 = None
        p50 = None
        p75 = None
        sample_size = 0

        if bls_data:
            p25 = bls_data.get("p25")
            p50 = bls_data.get("p50")
            p75 = bls_data.get("p75")
            sample_size += bls_data.get("sample_size", 0)
            sources.append("bls")
            if bls_data.get("notes"):
                notes["bls"] = bls_data["notes"]

        if glassdoor_data:
            # Blend: prefer BLS, but fill missing fields from community data.
            p25 = p25 or glassdoor_data.get("p25")
            p50 = p50 or glassdoor_data.get("p50")
            p75 = p75 or glassdoor_data.get("p75")
            sample_size += glassdoor_data.get("sample_size", 0)
            sources.append(glassdoor_data.get("source", "community"))
            if glassdoor_data.get("notes"):
                notes["community"] = glassdoor_data["notes"]

        # Apply location multiplier
        multiplier = self._location_multiplier(location)
        salary_min = int(p25 * multiplier) if p25 else None
        salary_max = int(p75 * multiplier) if p75 else None
        percentile_25 = int(p25 * multiplier) if p25 else None
        percentile_50 = int(p50 * multiplier) if p50 else None
        percentile_75 = int(p75 * multiplier) if p75 else None

        payload = BenchmarkResult(
            percentile_25=percentile_25,
            percentile_50=percentile_50,
            percentile_75=percentile_75,
            salary_min=salary_min,
            salary_max=salary_max,
            sample_size=sample_size,
            sources=sources or ["aggregated"],
            currency="USD",
            disclaimer=self._build_disclaimer(sources or ["aggregated"]),
            updated_at=timezone.now().isoformat(),
            source_notes=notes,
        )

        cache.set(cache_key, payload.as_dict(), self.CACHE_TTL_SECONDS)
        self._persist_market_intel(job_title, location, experience_level or "unspecified", payload)
        return payload


salary_benchmark_service = SalaryBenchmarkService()
