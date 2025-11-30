"""
Market intelligence helpers for UC-102.

Provides deterministic, location-aware market data generation that blends
lightweight heuristics with job postings from public providers.
"""
import math
from collections import Counter
from typing import Dict, Iterable, List


LOCATION_COST_INDEX = {
    "san francisco": 1.28,
    "sf": 1.28,
    "bay area": 1.28,
    "new york": 1.2,
    "nyc": 1.2,
    "seattle": 1.12,
    "los angeles": 1.08,
    "la": 1.08,
    "boston": 1.07,
    "austin": 1.04,
    "chicago": 1.03,
    "washington": 1.05,
    "dc": 1.05,
    "remote": 0.96,
}

INDUSTRY_PROFILES: Dict[str, Dict] = {
    "tech": {
        "base_salary": 115000,
        "default_role": "Software Engineer",
        "skills": ["Python", "React", "AWS", "System Design", "Kubernetes", "SQL"],
        "demand_score": 86,
        "growth_trend": "rising",
        "yoy_growth": 9.5,
        "hiring_velocity": 32,
        "remote_share_base": 0.46,
        "companies": {
            "san francisco": ["Google", "Meta", "Airbnb", "Uber", "Stripe", "OpenAI"],
            "new york": ["Google", "Amazon", "Spotify", "Datadog", "Etsy", "Bloomberg"],
            "seattle": ["Amazon", "Microsoft", "Expedia", "Snowflake", "Tableau"],
            "default": ["Microsoft", "Apple", "Nvidia", "Snowflake", "Adobe", "ServiceNow"],
        },
    },
    "finance": {
        "base_salary": 102000,
        "default_role": "Financial Analyst",
        "skills": ["Financial Modeling", "Excel", "SQL", "Risk Management", "Python"],
        "demand_score": 74,
        "growth_trend": "steady",
        "yoy_growth": 4.1,
        "hiring_velocity": 38,
        "remote_share_base": 0.18,
        "companies": {
            "new york": ["J.P. Morgan", "Goldman Sachs", "Citigroup", "Morgan Stanley", "BlackRock"],
            "chicago": ["CME Group", "Northern Trust", "Morningstar", "CBOE"],
            "san francisco": ["Wells Fargo", "Charles Schwab", "SoFi", "Visa"],
            "default": ["Bank of America", "J.P. Morgan", "Visa", "Mastercard", "Fidelity"],
        },
    },
    "healthcare": {
        "base_salary": 94000,
        "default_role": "Healthcare Analyst",
        "skills": ["Clinical Data", "EMR", "Public Health", "SQL", "Python"],
        "demand_score": 78,
        "growth_trend": "rising",
        "yoy_growth": 6.8,
        "hiring_velocity": 36,
        "remote_share_base": 0.14,
        "companies": {
            "boston": ["Mass General Brigham", "Biogen", "Moderna", "Vertex"],
            "austin": ["Baylor Scott & White", "HCA Healthcare", "Ascension"],
            "default": ["UnitedHealth Group", "CVS Health", "HCA Healthcare", "Kaiser Permanente"],
        },
    },
    "pharma": {
        "base_salary": 98000,
        "default_role": "Clinical Research",
        "skills": ["Clinical Trials", "Regulatory", "Biostatistics", "R", "Data Management"],
        "demand_score": 72,
        "growth_trend": "steady",
        "yoy_growth": 5.3,
        "hiring_velocity": 42,
        "remote_share_base": 0.16,
        "companies": {
            "boston": ["Pfizer", "Moderna", "Takeda", "Sanofi", "Novartis"],
            "new york": ["Pfizer", "Bristol Myers Squibb", "Johnson & Johnson"],
            "default": ["Pfizer", "Merck", "AbbVie", "Roche", "GSK"],
        },
    },
    "law": {
        "base_salary": 108000,
        "default_role": "Associate Counsel",
        "skills": ["Contract Drafting", "Corporate Law", "Compliance", "Litigation", "Research"],
        "demand_score": 68,
        "growth_trend": "steady",
        "yoy_growth": 2.9,
        "hiring_velocity": 46,
        "remote_share_base": 0.12,
        "companies": {
            "new york": ["Skadden", "Kirkland & Ellis", "Sullivan & Cromwell", "Debevoise"],
            "san francisco": ["Orrick", "Wilson Sonsini", "Cooley", "Latham & Watkins"],
            "default": ["Latham & Watkins", "Baker McKenzie", "DLA Piper", "Jones Day"],
        },
    },
    "education": {
        "base_salary": 72000,
        "default_role": "Learning Designer",
        "skills": ["Curriculum Design", "Instructional Design", "Assessment", "Online Learning", "Research"],
        "demand_score": 58,
        "growth_trend": "stable",
        "yoy_growth": 1.8,
        "hiring_velocity": 48,
        "remote_share_base": 0.27,
        "companies": {
            "default": ["Khan Academy", "Coursera", "Duolingo", "Chegg", "Pearson"],
        },
    },
    "manufacturing": {
        "base_salary": 84000,
        "default_role": "Operations Manager",
        "skills": ["Lean Manufacturing", "Six Sigma", "Supply Chain", "Quality Assurance", "Process Improvement"],
        "demand_score": 65,
        "growth_trend": "steady",
        "yoy_growth": 3.2,
        "hiring_velocity": 40,
        "remote_share_base": 0.11,
        "companies": {
            "chicago": ["Caterpillar", "Boeing", "Abbott", "3M"],
            "default": ["GE", "Honeywell", "Siemens", "3M", "Caterpillar"],
        },
    },
    "retail": {
        "base_salary": 67000,
        "default_role": "Merchandising Manager",
        "skills": ["Merchandising", "Inventory Management", "SQL", "Category Strategy", "Vendor Management"],
        "demand_score": 55,
        "growth_trend": "stable",
        "yoy_growth": 2.1,
        "hiring_velocity": 45,
        "remote_share_base": 0.09,
        "companies": {
            "seattle": ["Amazon", "Starbucks", "REI"],
            "new york": ["Walmart", "Target", "Nike", "LVMH"],
            "default": ["Walmart", "Target", "Costco", "Nike", "Home Depot"],
        },
    },
    "consulting": {
        "base_salary": 99000,
        "default_role": "Strategy Consultant",
        "skills": ["Management Consulting", "Excel", "Financial Modeling", "PowerPoint", "Data Analysis"],
        "demand_score": 76,
        "growth_trend": "rising",
        "yoy_growth": 6.1,
        "hiring_velocity": 34,
        "remote_share_base": 0.33,
        "companies": {
            "boston": ["Boston Consulting Group", "McKinsey", "Bain & Company"],
            "new york": ["McKinsey", "Bain & Company", "PwC", "Deloitte"],
            "san francisco": ["Accenture", "Slalom", "ZS Associates"],
            "default": ["McKinsey", "BCG", "Bain", "Deloitte", "Accenture"],
        },
    },
    "media": {
        "base_salary": 82000,
        "default_role": "Content Strategist",
        "skills": ["Content Strategy", "SEO", "Analytics", "Copywriting", "Audience Development"],
        "demand_score": 62,
        "growth_trend": "stable",
        "yoy_growth": 2.4,
        "hiring_velocity": 41,
        "remote_share_base": 0.28,
        "companies": {
            "new york": ["The New York Times", "NBCUniversal", "Bloomberg", "Spotify"],
            "los angeles": ["Netflix", "Disney", "Warner Bros. Discovery", "Snap"],
            "default": ["Netflix", "Disney", "Spotify", "Comcast", "Paramount"],
        },
    },
}

DEFAULT_PROFILE = {
    "base_salary": 88000,
    "default_role": "Professional",
    "skills": ["Project Management", "Analysis", "Communication", "Stakeholder Management"],
    "demand_score": 60,
    "growth_trend": "stable",
    "yoy_growth": 3.0,
    "hiring_velocity": 40,
    "remote_share_base": 0.2,
    "companies": {"default": ["Accenture", "Deloitte", "EY", "PwC", "KPMG"]},
}


def _normalize_location(location: str) -> str:
    return (location or "").lower()


def _location_multiplier(location: str) -> float:
    normalized = _normalize_location(location)
    for key, multiplier in LOCATION_COST_INDEX.items():
        if key in normalized:
            return multiplier
    return 1.0


def _pick_profile(industry: str) -> Dict:
    return INDUSTRY_PROFILES.get((industry or "").lower(), DEFAULT_PROFILE)


def _salary_band(base: int, multiplier: float) -> Dict[str, int]:
    median = int(base * multiplier)
    return {
        "min": int(median * 0.86),
        "max": int(median * 1.15),
        "median": median,
    }


def build_salary_bands(base_salary: int, multiplier: float) -> Dict[str, Dict[str, int]]:
    entry_base = int(base_salary * 0.8)
    mid_base = int(base_salary * 1.05)
    senior_base = int(base_salary * 1.3)
    lead_base = int(base_salary * 1.55)

    return {
        "entry": _salary_band(entry_base, multiplier),
        "mid": _salary_band(mid_base, multiplier),
        "senior": _salary_band(senior_base, multiplier),
        "lead": _salary_band(lead_base, multiplier),
    }


def analyze_postings(jobs: Iterable[Dict]) -> Dict:
    company_counts: Counter = Counter()
    skill_counts: Counter = Counter()
    remote_roles = 0
    job_list = list(jobs or [])

    for job in job_list:
        company = job.get("company_name") or job.get("company") or job.get("company_slug")
        if company:
            company_counts[company.strip()] += 1

        tags = job.get("tags") or job.get("job_tags") or job.get("categories") or job.get("category")
        if isinstance(tags, (list, tuple)):
            for tag in tags:
                if isinstance(tag, str):
                    skill_counts[tag.strip()] += 1
        elif isinstance(tags, str):
            for part in tags.split(","):
                skill_counts[part.strip()] += 1

        location_text = (job.get("candidate_required_location") or job.get("location") or "").lower()
        if "remote" in location_text:
            remote_roles += 1

    top_companies = [c for c, _ in company_counts.most_common(8)]
    top_skills = [s for s, _ in skill_counts.most_common(12)]
    total = len(job_list)
    remote_share = (remote_roles / total) if total else 0.0
    demand_from_density = min(100, int(math.log(total + 1, 2) * 9)) if total else 0

    return {
        "sample_size": total,
        "top_companies": top_companies,
        "top_skills": top_skills,
        "remote_share": round(remote_share, 2),
        "demand_score_adjustment": demand_from_density,
    }


def _demand_label(score: int) -> str:
    if score >= 85:
        return "Very High"
    if score >= 70:
        return "High"
    if score >= 55:
        return "Moderate"
    return "Emerging"


def _growth_label(trend: str, demand_score: int) -> str:
    if trend == "rising" or demand_score >= 80:
        return "Strong Upward"
    if trend == "steady":
        return "Stable"
    if demand_score < 55:
        return "Cooling"
    return "Gradual Upward"


def _choose_companies(profile: Dict, location: str, observed: List[str]) -> List[str]:
    if observed:
        return observed

    normalized_location = _normalize_location(location)
    for loc_key, companies in profile.get("companies", {}).items():
        if loc_key != "default" and loc_key in normalized_location:
            return companies
    return profile.get("companies", {}).get("default", DEFAULT_PROFILE["companies"]["default"])


def _blend_skills(profile_skills: List[str], observed_skills: List[str]) -> List[str]:
    if observed_skills:
        merged = []
        seen = set()
        for skill in observed_skills + profile_skills:
            if skill and skill not in seen:
                seen.add(skill)
                merged.append(skill)
            if len(merged) >= 10:
                break
        return merged
    return profile_skills[:8]


def _skill_signals(skills: List[str], demand_score: int) -> List[Dict]:
    growth = "rising" if demand_score >= 75 else "steady" if demand_score >= 60 else "cooling"
    result = []
    for idx, skill in enumerate(skills):
        signal = {
            "skill": skill,
            "demand_score": min(100, demand_score - idx * 3),
            "trend": growth if idx < 4 else ("steady" if growth == "rising" else growth),
        }
        result.append(signal)
    return result


def _estimate_remote_share(profile: Dict, location: str, postings_summary: Dict) -> float:
    if postings_summary.get("sample_size", 0) >= 5:
        return postings_summary.get("remote_share", 0.0)

    base = profile.get("remote_share_base", DEFAULT_PROFILE["remote_share_base"])
    loc_normalized = _normalize_location(location)
    if "remote" in loc_normalized:
        base += 0.12

    multiplier = _location_multiplier(location)
    if multiplier >= 1.2:
        base += 0.06
    elif multiplier <= 0.98:
        base += 0.02

    observed = postings_summary.get("remote_share")
    if observed:
        base = (base * 0.6) + (observed * 0.4)

    return max(0.05, min(base, 0.75))


def generate_snapshot(industry: str, location: str, role: str, jobs: Iterable[Dict]) -> Dict:
    profile = _pick_profile(industry)
    multiplier = _location_multiplier(location)
    postings_summary = analyze_postings(jobs)

    salary = build_salary_bands(profile["base_salary"], multiplier)
    skills = _blend_skills(profile.get("skills", []), postings_summary.get("top_skills", []))
    demand_score = min(
        100,
        max(
            45,
            profile.get("demand_score", DEFAULT_PROFILE["demand_score"])
            + postings_summary.get("demand_score_adjustment", 0)
            + int((multiplier - 1.0) * 12),
        ),
    )

    yoy_growth = round(
        profile.get("yoy_growth", DEFAULT_PROFILE["yoy_growth"])
        + min(4.0, postings_summary.get("sample_size", 0) / 60.0),
        1,
    )
    hiring_velocity = max(
        18,
        int(
            profile.get("hiring_velocity", DEFAULT_PROFILE["hiring_velocity"])
            - (multiplier - 1.0) * 6
            - min(3, postings_summary.get("sample_size", 0) // 80),
        ),
    )

    companies = _choose_companies(profile, location, postings_summary.get("top_companies"))
    remote_share = _estimate_remote_share(profile, location, postings_summary)

    return {
        "industry": industry or "",
        "location": location or "",
        "role": role or profile.get("default_role"),
        "salary": salary,
        "skills": skills,
        "skill_signals": _skill_signals(skills, demand_score),
        "demandScore": demand_score,
        "demandLabel": _demand_label(demand_score),
        "growth": _growth_label(profile.get("growth_trend", "steady"), demand_score),
        "marketTrends": {
            "yoyGrowth": yoy_growth,
            "hiringVelocityDays": hiring_velocity,
            "remoteShare": remote_share,
            "openingsMomentum": "accelerating" if demand_score >= 80 else "steady" if demand_score >= 60 else "softening",
        },
        "topCompanies": companies,
        "postings_sample_count": postings_summary.get("sample_size", 0),
    }
