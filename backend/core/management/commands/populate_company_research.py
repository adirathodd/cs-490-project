from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Company, CompanyResearch
from core import resume_ai

logger = logging.getLogger(__name__)


def _strip_code_fence(text: str) -> str:
    s = (text or '').strip()
    if s.startswith('```'):
        # Remove starting fence
        parts = s.split('\n')
        if parts and parts[0].startswith('```'):
            parts = parts[1:]
        if parts and parts[-1].strip().startswith('```'):
            parts = parts[:-1]
        s = '\n'.join(parts).strip()
    return s


def _build_prompt(company: Company) -> str:
    """
    Build a single prompt that instructs Gemini to return EVERY research field
    except recent_news (which is managed by a separate script).
    """
    name = company.name or ''
    domain = company.domain or ''
    existing = ''
    try:
        if getattr(company, 'research', None) and company.research.description:
            existing = company.research.description[:800]
    except Exception:
        existing = ''

    prompt = f"""
You are an analyst building structured interview research for a company.

Return ONLY a valid JSON object (no prose, no markdown fences) with these keys:
  "profile_overview": "2 sentence summary focused on mission + differentiation",
  "company_history": "1-3 sentences referencing founding year and key milestones",
  "description": "short description (1-3 sentences)",
  "mission_statement": "explicit mission",
  "company_values": ["clear values", ... up to 8],
  "executives": [{{"name": "...", "title": "...", "linkedin_url": "https://..."}}, ... up to 8] using only publicly documented leaders,
  "competitors": {{"industry": "...", "companies": ["Name (descriptor)"], "market_position": "concise positioning"}},
  "competitive_landscape": "1-2 sentences summarizing positioning vs competitors",
  "funding_info": {{"market_cap": number or null, "price_to_earnings": number or null, "beta": number or null, "notes": "optional context"}},
  "tech_stack": ["technologies"... up to 12],
  "employee_count": integer or null,
  "growth_rate": percentage number or null,
  "glassdoor_rating": number 0-5 or null,
  "social_media": {{"linkedin": "...", "twitter": "...", "youtube": "..."}},
  "recent_developments": [
     {{"title":"", "summary":"", "category":"funding|product|market|culture|partnership|hiring|other", "date":"YYYY-MM", "source":"Publication"}}
     ... up to 5
  ],
  "strategic_initiatives": [
     {{"title":"", "summary":"", "impact":"", "timeline":"current|short-term|long-term"}}
     ... up to 5
  ],
  "talking_points": ["Specific fact to mention in interviews", ... up to 6],
  "interview_questions": ["Insightful, company-specific questions referencing facts above", ... up to 6],
  "export_summary": "Markdown-style multi-section summary referencing only confirmed facts."

Strict accuracy rules:
  * Use only verifiable public information (official site, investor materials, Wikipedia, news articles).
  * If you are unsure about a field, return an empty string, null, or [] for that specific field.
  * NEVER invent or guess dates, product names, or people.
  * Do NOT include a "recent_news" key. News is fetched separately.

Context:
  company_name: {name}
  company_domain: {domain}
  existing_description_excerpt: {existing}
""".strip()
    return prompt


def _clean_text(value: Any) -> str:
    if value is None:
        return ''
    return str(value).strip()


def _clean_string_list(items: Any, limit: Optional[int] = None) -> List[str]:
    if not isinstance(items, list):
        return []
    cleaned: List[str] = []
    for entry in items:
        text = _clean_text(entry)
        if text:
            cleaned.append(text)
        if limit and len(cleaned) >= limit:
            break
    return cleaned


def _clean_people(items: Any, limit: int = 8) -> List[Dict[str, str]]:
    if not isinstance(items, list):
        return []
    cleaned: List[Dict[str, str]] = []
    for entry in items:
        if not isinstance(entry, dict):
            continue
        name = _clean_text(entry.get('name'))
        if not name:
            continue
        record = {
            'name': name,
            'title': _clean_text(entry.get('title')),
        }
        record['linkedin_url'] = _clean_text(entry.get('linkedin_url'))
        cleaned.append(record)
        if len(cleaned) >= limit:
            break
    return cleaned


_CATEGORY_WHITELIST = {'funding', 'product', 'market', 'culture', 'partnership', 'hiring', 'other'}


def _clean_category(value: str) -> str:
    val = _clean_text(value).lower()
    if val in _CATEGORY_WHITELIST:
        return val
    # map some synonyms
    if val in {'finance', 'investment'}:
        return 'funding'
    if val in {'people', 'talent'}:
        return 'hiring'
    if val in {'alliance', 'integration'}:
        return 'partnership'
    if val in {'expansion'}:
        return 'market'
    return 'other'


def _clean_recent_developments(items: Any, limit: int = 5) -> List[Dict[str, Any]]:
    if not isinstance(items, list):
        return []
    cleaned: List[Dict[str, Any]] = []
    for entry in items:
        if not isinstance(entry, dict):
            continue
        title = _clean_text(entry.get('title')) or _clean_text(entry.get('headline'))
        summary = _clean_text(entry.get('summary'))
        category = _clean_category(entry.get('category', 'other'))
        date = _clean_text(entry.get('date'))
        source = _clean_text(entry.get('source'))
        if not (title or summary):
            continue
        cleaned.append({
            'title': title or summary,
            'summary': summary,
            'category': category,
            'date': date,
            'source': source,
        })
        if len(cleaned) >= limit:
            break
    return cleaned


def _clean_initiatives(items: Any, limit: int = 5) -> List[Dict[str, Any]]:
    if not isinstance(items, list):
        return []
    cleaned: List[Dict[str, Any]] = []
    for entry in items:
        if not isinstance(entry, dict):
            continue
        title = _clean_text(entry.get('title'))
        summary = _clean_text(entry.get('summary'))
        if not title:
            continue
        cleaned.append({
            'title': title,
            'summary': summary,
            'impact': _clean_text(entry.get('impact')),
            'timeline': _clean_text(entry.get('timeline')),
        })
        if len(cleaned) >= limit:
            break
    return cleaned


def _clean_social_media(data: Any) -> Dict[str, str]:
    if not isinstance(data, dict):
        return {}
    cleaned: Dict[str, str] = {}
    for key, value in data.items():
        text = _clean_text(value)
        if text:
            cleaned[key] = text
    return cleaned


class Command(BaseCommand):
    help = 'Populate CompanyResearch records using Gemini when fields are missing.'

    def add_arguments(self, parser):
        parser.add_argument('--company-id', type=int, help='Only process a single Company id')
        parser.add_argument('--limit', type=int, default=None, help='Maximum number of companies to process (default: all)')
        parser.add_argument('--dry-run', action='store_true', help='Do not write changes to the DB')
        parser.add_argument('--force', action='store_true', help='Force regeneration even if research exists')

    def handle(self, *args, **options):
        api_key = getattr(settings, 'GEMINI_API_KEY', None)
        model = getattr(settings, 'GEMINI_MODEL', None)
        if not api_key:
            self.stderr.write('GEMINI_API_KEY not configured in settings; aborting.')
            return

        company_id = options.get('company_id')
        limit = options.get('limit') or 100
        dry_run = options.get('dry_run')
        force = options.get('force')

        qs = Company.objects.all().order_by('id')
        if company_id:
            qs = qs.filter(id=company_id)
        elif limit:
            qs = qs[:limit]

        processed = 0
        for company in qs:
            try:
                research = getattr(company, 'research', None)
                # Determine which fields are missing on the existing CompanyResearch
                required_fields = [
                    'profile_overview',
                    'company_history',
                    'description',
                    'mission_statement',
                    'company_values',
                    'culture_keywords',
                    'executives',
                    'products',
                    'competitors',
                    'competitive_landscape',
                    'funding_info',
                    'tech_stack',
                    'employee_count',
                    'growth_rate',
                    'glassdoor_rating',
                    'social_media',
                    'recent_developments',
                    'strategic_initiatives',
                    'talking_points',
                    'interview_questions',
                    'export_summary',
                ]

                missing = []
                if not research:
                    missing = required_fields.copy()
                else:
                    for f in required_fields:
                        val = getattr(research, f, None)
                        empty_list = isinstance(val, (list, dict)) and len(val) == 0
                        if val in (None, '', []) or empty_list:
                            missing.append(f)

                if not missing and not force:
                    self.stdout.write(f"Skipping company {company.id} ({company.name}) - research already complete")
                    continue

                self.stdout.write(f"Processing Company {company.id}: {company.name} — missing: {', '.join(missing) if missing else 'all fields (force)'}")
                # Request all fields; we'll selectively update only missing ones unless --force is provided
                prompt = _build_prompt(company)
                raw = resume_ai.call_gemini_api(prompt, api_key, model=model)
                text = _strip_code_fence(raw)
                try:
                    payload = json.loads(text)
                except json.JSONDecodeError:
                    self.stderr.write(f"Failed to parse JSON for company {company.id} - raw response saved to log")
                    logger.debug('Raw Gemini response for company %s: %s', company.id, raw)
                    continue

                # Map payload keys to CompanyResearch fields conservatively
                mapped: Dict[str, Any] = {}

                for field in ['profile_overview', 'company_history', 'description', 'mission_statement', 'competitive_landscape', 'export_summary']:
                    value = _clean_text(payload.get(field))
                    if value:
                        mapped[field] = value

                values = _clean_string_list(payload.get('company_values'), limit=8)
                if values:
                    mapped['company_values'] = values

                culture_keywords = _clean_string_list(payload.get('culture_keywords'), limit=20)
                if culture_keywords:
                    mapped['culture_keywords'] = culture_keywords

                tech_stack = _clean_string_list(payload.get('tech_stack'), limit=40)
                if tech_stack:
                    mapped['tech_stack'] = tech_stack

                talking_points = _clean_string_list(payload.get('talking_points'), limit=6)
                if talking_points:
                    mapped['talking_points'] = talking_points

                interview_questions = _clean_string_list(payload.get('interview_questions'), limit=6)
                if interview_questions:
                    mapped['interview_questions'] = interview_questions

                if 'employee_count' in payload:
                    try:
                        mapped['employee_count'] = int(payload['employee_count']) if payload['employee_count'] not in (None, '') else None
                    except Exception:
                        pass
                if 'growth_rate' in payload:
                    try:
                        mapped['growth_rate'] = float(payload['growth_rate']) if payload['growth_rate'] not in (None, '') else None
                    except Exception:
                        pass
                if 'glassdoor_rating' in payload:
                    try:
                        mapped['glassdoor_rating'] = float(payload['glassdoor_rating']) if payload['glassdoor_rating'] not in (None, '') else None
                    except Exception:
                        pass

                funding_info = payload.get('funding_info')
                if isinstance(funding_info, dict) and any(funding_info.values()):
                    mapped['funding_info'] = funding_info

                social_media = _clean_social_media(payload.get('social_media'))
                if social_media:
                    mapped['social_media'] = social_media

                executives = _clean_people(payload.get('executives'), limit=8)
                if executives:
                    mapped['executives'] = executives

                if 'products' in payload and isinstance(payload['products'], list):
                    products: List[Dict[str, str]] = []
                    for product in payload['products'][:10]:
                        if not isinstance(product, dict):
                            continue
                        name = _clean_text(product.get('name'))
                        description = _clean_text(product.get('description'))
                        if name:
                            products.append({'name': name, 'description': description})
                    if products:
                        mapped['products'] = products

                competitors = payload.get('competitors')
                if isinstance(competitors, dict) and any(competitors.values()):
                    mapped['competitors'] = competitors

                developments = _clean_recent_developments(payload.get('recent_developments'), limit=5)
                if developments:
                    mapped['recent_developments'] = developments

                initiatives = _clean_initiatives(payload.get('strategic_initiatives'), limit=5)
                if initiatives:
                    mapped['strategic_initiatives'] = initiatives

                # We intentionally do NOT map or update `recent_news` here.

                if not mapped:
                    self.stdout.write(f"Gemini returned no usable fields for {company.name}; skipping")
                    continue

                if dry_run:
                    self.stdout.write(f"Dry-run: would update CompanyResearch for {company.name} with: {list(mapped.keys())}")
                else:
                    with transaction.atomic():
                        research_obj, created = CompanyResearch.objects.get_or_create(company=company)
                        # Update only fields that were provided by Gemini and are missing or when force=True
                        for k, v in mapped.items():
                            existing_val = getattr(research_obj, k, None)
                            existing_empty = existing_val in (None, '', []) or (isinstance(existing_val, (list, dict)) and len(existing_val) == 0)
                            if force or existing_empty:
                                setattr(research_obj, k, v)
                        research_obj.save()
                    self.stdout.write(f"Updated CompanyResearch for {company.name} ({'created' if created else 'updated'})")

                processed += 1
            except Exception as exc:
                logger.exception('Error processing company %s: %s', getattr(company, 'id', None), exc)
                self.stderr.write(f'Error processing company {company.id}: {exc}')

        self.stdout.write(f'Done. Processed {processed} companies.')
