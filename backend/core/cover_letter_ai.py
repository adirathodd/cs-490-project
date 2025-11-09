"""
Gemini-powered cover letter content generation for UC-056.

This module reuses candidate/job snapshot helpers from resume_ai, enriches with
company research context, and generates multiple structured cover letter
variations in JSON via Gemini's API.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Sequence

from django.conf import settings
from django.utils import timezone
from django.utils.text import slugify

from core.models import CandidateProfile, JobEntry, Company, CompanyResearch
from core import resume_ai

logger = logging.getLogger(__name__)

# Soft limits to keep prompts suitable for free-tier generation
MAX_ACHIEVEMENTS = 12
MAX_NEWS = 3
MAX_PARAGRAPHS = 3
MAX_VARIATIONS = 3


class CoverLetterAIError(Exception):
    """Raised when we cannot return AI-generated cover letter content."""


TONE_STYLES = {
    'professional': 'Polished, concise, and formal with clear impact statements.',
    'warm': 'Approachable, collaborative, people-first tone with empathy.',
    'innovative': 'Forward-looking, curious, and product/impact oriented.',
    'customer_centric': 'Customer-obsessed voice focusing on outcomes and value.',
    'data_driven': 'Analytical tone weaving metrics and experimentation.',
    'concise': 'Short, crisp sentences with no fluff.',
    'balanced': 'Professional tone blending warmth and measurable results.',
}


def _dedupe(seq: Sequence[str]) -> List[str]:
    seen = set(); out = []
    for item in seq or []:
        if not item:
            continue
        lowered = str(item).strip().lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        out.append(str(item).strip())
    return out


def _collect_achievements(candidate_snapshot: Dict[str, Any], limit: int = MAX_ACHIEVEMENTS) -> List[str]:
    achievements: List[str] = []
    for exp in candidate_snapshot.get('experiences', []) or []:
        for a in (exp.get('achievements') or []):
            txt = (a or '').strip()
            if txt:
                achievements.append(txt)
            if len(achievements) >= limit:
                break
        if len(achievements) >= limit:
            break
    return achievements[:limit]


def build_company_research_snapshot(company_name: str | None) -> Dict[str, Any]:
    """Return compact research info for a company if available; create stubs if missing.

    Structure:
    {
      "company_name": "Acme",
      "culture_keywords": ["ownership", "innovation"],
      "recent_news": [{"title": "...", "url": "...", "date": "YYYY-MM-DD"}],
      "mission_statement": "..."
    }
    """
    if not company_name:
        return {"company_name": "", "culture_keywords": [], "recent_news": [], "mission_statement": ""}
    try:
        company = Company.objects.filter(name__iexact=company_name).first()
        if not company:
            # Create with minimal data to allow later enrichment
            domain = company_name.lower().replace(' ', '').replace(',', '').replace('.', '') + '.com'
            company = Company.objects.create(name=company_name, domain=domain)
            CompanyResearch.objects.create(company=company)
        # Try to fetch research
        research = getattr(company, 'research', None)
        snapshot = {
            'company_name': company.name,
            'culture_keywords': list(research.culture_keywords) if getattr(research, 'culture_keywords', None) else [],
            'recent_news': list(research.recent_news)[:MAX_NEWS] if getattr(research, 'recent_news', None) else [],
            'mission_statement': getattr(research, 'mission_statement', '') or '',
            'description': getattr(research, 'description', '') or '',
        }
        return snapshot
    except Exception as e:
        logger.warning("Failed to build company research snapshot for %s: %s", company_name, e)
        return {"company_name": company_name, "culture_keywords": [], "recent_news": [], "mission_statement": ""}


def build_generation_prompt(
    candidate_snapshot: Dict[str, Any],
    job_snapshot: Dict[str, Any],
    research_snapshot: Dict[str, Any],
    tone: str,
    variation_count: int,
) -> str:
    tone_descriptor = TONE_STYLES.get(tone, TONE_STYLES['balanced'])
    candidate_json = json.dumps(candidate_snapshot, indent=2, ensure_ascii=False)
    job_json = json.dumps(job_snapshot, indent=2, ensure_ascii=False)
    research_json = json.dumps(research_snapshot, indent=2, ensure_ascii=False)

    schema = """
{
  "shared_analysis": {
    "personalization_strategy": "How to tailor to role and company culture.",
    "key_achievements": ["List of most relevant achievements from candidate"],
    "news_to_reference": ["Optional news headline strings used"],
    "tone_rationale": "Why this tone matches the culture"
  },
  "variations": [
    {
      "label": "Warm and Data-Driven",
      "tone": "warm",
      "opening_paragraph": "Personalized intro referencing company, role, and motivation.",
      "body_paragraphs": [
        "Paragraph focused on relevant experience and quantified results.",
        "Optional second para tying achievements to job requirements and culture."
      ],
      "closing_paragraph": "Confident, polite CTA with availability and thanks.",
      "achievements_referenced": ["achievement 1", "achievement 2"],
      "keywords_used": ["Python", "APIs", "Cloud"],
      "news_citations": [
        {"title": "Acme announces new product", "url": "https://...", "date": "2025-10-10"}
      ]
    }
  ]
}
""".strip()

    rules = f"""
You are ResumeRocket AI. Generate {variation_count} cover letter variations as JSON ONLY (no markdown fences).

Tone style: {tone} → {tone_descriptor}

STRICT RULES:
- Use ONLY facts from candidate_snapshot, job_snapshot, and research_snapshot. Do NOT invent companies, dates, titles, or achievements.
- Refer to the company and role EXACTLY as provided.
- Opening paragraph must be personalized to the company/role and can briefly reference mission or recent news if available.
- Body paragraphs must highlight specific achievements with metrics where possible and map to job requirements.
- Closing paragraph must include a polite call-to-action and availability.
- Match tone cues to culture_keywords when provided.
- Keep each paragraph under 140 words. Use professional writing style.
- Provide 1-2 body paragraphs total.
- Output valid JSON matching the schema below. No comments or extra text.

Schema:
{schema}

candidate_snapshot:
{candidate_json}

job_snapshot:
{job_json}

research_snapshot:
{research_json}
""".strip()
    return rules


def _strip_code_fence(text: str) -> str:
    s = text.strip()
    if s.startswith('```'):
        s = re.sub(r'^```(?:json)?', '', s, count=1, flags=re.IGNORECASE).strip()
        if s.endswith('```'):
            s = s[:-3].strip()
    return s


def parse_payload(raw_text: str) -> Dict[str, Any]:
    try:
        return json.loads(_strip_code_fence(raw_text))
    except json.JSONDecodeError as exc:
        logger.error('Failed to parse Gemini cover letter JSON: %s', exc)
        raise CoverLetterAIError('Gemini returned an unreadable response.') from exc


def _normalize_variations(
    parsed: Dict[str, Any],
    candidate_snapshot: Dict[str, Any],
    job_snapshot: Dict[str, Any],
) -> List[Dict[str, Any]]:
    variations = parsed.get('variations') or []
    if not isinstance(variations, list):
        variations = []
    achievements_pool = _collect_achievements(candidate_snapshot)
    news_pool = job_snapshot.get('company_name') and [] or []  # retained for potential future constraints

    normalized: List[Dict[str, Any]] = []
    for idx, raw in enumerate(variations):
        label = raw.get('label') or f'Variation {idx + 1}'
        var_id = slugify(label) or f'variation-{idx + 1}'
        tone = raw.get('tone') or 'balanced'

        opening = (raw.get('opening_paragraph') or '').strip()
        bodies = [
            (p or '').strip() for p in (raw.get('body_paragraphs') or []) if (p or '').strip()
        ][:MAX_PARAGRAPHS]
        closing = (raw.get('closing_paragraph') or '').strip()

        # Ensure we don't leak fabricated company or role names by lightly enforcing mentions
        # If company name is present, ensure it appears in opening paragraph
        company = job_snapshot.get('company_name') or ''
        title = job_snapshot.get('title') or ''
        if company and company.lower() not in opening.lower():
            # Soft prepend a reference
            opening = f"{company} — {opening}" if opening else company

        ach_ref = _dedupe(raw.get('achievements_referenced') or achievements_pool[:5])
        kw_used = _dedupe(raw.get('keywords_used') or job_snapshot.get('derived_keywords', []))
        news_refs = raw.get('news_citations') or []
        if not isinstance(news_refs, list):
            news_refs = []

        full_text = '\n\n'.join([p for p in [opening, *bodies, closing] if p])

        normalized.append({
            'id': var_id if var_id not in {v.get('id') for v in normalized} else f'{var_id}-{idx}',
            'label': label,
            'tone': tone,
            'opening_paragraph': opening,
            'body_paragraphs': bodies,
            'closing_paragraph': closing,
            'full_text': full_text,
            'highlights': {
                'achievements': ach_ref[:8],
                'keywords_used': kw_used[:12],
                'news_citations': news_refs[:MAX_NEWS],
            },
            'generated_at': timezone.now().isoformat(),
        })

    return normalized


def run_cover_letter_generation(
    candidate_snapshot: Dict[str, Any],
    job_snapshot: Dict[str, Any],
    research_snapshot: Dict[str, Any],
    *,
    tone: str,
    variation_count: int,
    api_key: str,
    model: str | None = None,
) -> Dict[str, Any]:
    logger.info("Starting cover letter generation with variation_count=%s, tone=%s", variation_count, tone)
    prompt = build_generation_prompt(candidate_snapshot, job_snapshot, research_snapshot, tone, variation_count)
    raw_text = resume_ai.call_gemini_api(prompt, api_key, model=model)
    parsed = parse_payload(raw_text)
    shared_analysis = parsed.get('shared_analysis') or {}
    variations = _normalize_variations(parsed, candidate_snapshot, job_snapshot)
    if not variations:
        # Minimal fallback: synthesize a tiny generic letter using candidate and job info
        name = candidate_snapshot.get('name') or 'Candidate'
        company = job_snapshot.get('company_name') or 'the company'
        title = job_snapshot.get('title') or 'the role'
        opening = f"I’m excited to apply for the {title} role at {company}."
        bodies = [
            "My background aligns closely with your needs, and I’ve delivered measurable results in similar contexts.",
        ]
        closing = "I’d welcome the chance to discuss how I can contribute. Thank you for your time."
        variations = _normalize_variations(
            {
                'variations': [{
                    'label': 'Balanced',
                    'tone': tone,
                    'opening_paragraph': opening,
                    'body_paragraphs': bodies,
                    'closing_paragraph': closing,
                }]
            },
            candidate_snapshot,
            job_snapshot,
        )
    return {
        'shared_analysis': shared_analysis,
        'variations': variations,
        'variation_count': len(variations),
        'raw_text': raw_text,
    }
