"""
Gemini-powered resume generation helpers for UC-047.

This module prepares candidate/job context, builds a structured prompt for
Gemini's free-tier API, parses the JSON response, and renders Jake's Resume
LaTeX template for every variation returned.
"""
from __future__ import annotations

import base64
import json
import logging
import re
import textwrap
from collections import Counter
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Sequence

import requests
from django.conf import settings
from django.utils import timezone
from django.utils.text import slugify
from shutil import which
import subprocess
import tempfile
import os

from core.models import (
    CandidateSkill,
    Certification,
    Education,
    Project,
    WorkExperience,
)

logger = logging.getLogger(__name__)

# Data collection limits to keep prompts lean enough for the free tier and single-page layout
MAX_EXPERIENCES = 5
MAX_PROJECTS = 2
MAX_SKILLS = 15
MAX_EDUCATION = 3
MAX_CERTIFICATIONS = 2
MAX_ACHIEVEMENTS = 10
MAX_BULLETS_PER_EXP = 3
MAX_PROJECT_BULLETS = 3
MAX_KEYWORDS = 15

STOPWORDS = {
    'and', 'the', 'with', 'that', 'from', 'this', 'have', 'will', 'your',
    'about', 'such', 'into', 'their', 'they', 'them', 'work', 'team', 'role',
    'you', 'are', 'for', 'our', 'who', 'able', 'must', 'skills', 'experience'
}

DEGREE_LABELS = {
    'hs': 'High School Diploma',
    'aa': 'Associate of Arts',
    'as': 'Associate of Science',
    'ba': 'Bachelor of Arts',
    'bs': 'Bachelor of Science',
    'ma': 'Master of Arts',
    'ms': 'Master of Science',
    'mba': 'Master of Business Administration',
    'phd': 'Doctor of Philosophy',
    'cert': 'Certificate',
    'boot': 'Bootcamp',
}

SCHEMA_BLOCK = textwrap.dedent(
    """{
  "shared_analysis": {
    "job_focus_summary": "Concise explanation of what the hiring team cares about most.",
    "skill_match_notes": "How the candidate maps to that focus (max 3 sentences).",
    "keyword_strategy": ["ATS keyword 1", "keyword 2", "..."],
    "skill_gaps": ["Optional honest gaps to consider."]
  },
  "variations": [
    {
      "label": "Impact Driven",
      "tone": "impact",
      "summary_headline": "Impact-focused Software Developer",
      "summary": "2-3 sentence summary aligned to the job.",
      "skills_to_highlight": ["Python", "Cloud"], 
      "ats_keywords": ["microservices", "GCP"],
      "experience_sections": [
        {
          "source_experience_id": 42,
          "role": "Senior Software Engineer",
          "company": "Acme",
          "location": "Remote",
          "dates": "Jan 2021 – Present",
          "bullets": [
            "Reduced infrastructure costs by 18% through optimized cloud resource allocation.",
            "Led team of 4 engineers to deliver microservices architecture ahead of schedule."
          ]
        },
        {
          "source_experience_id": 38,
          "role": "Software Engineer",
          "company": "TechCorp",
          "location": "New York, NY",
          "dates": "Jun 2019 – Dec 2020",
          "bullets": [
            "Developed RESTful APIs serving 500K+ daily requests with 99.9% uptime.",
            "Reduced database query time by 40% through index optimization and caching strategies."
          ]
        },
        {
          "source_experience_id": 35,
          "role": "Junior Developer",
          "company": "StartupXYZ",
          "location": "San Francisco, CA",
          "dates": "Jan 2018 – May 2019",
          "bullets": [
            "Built responsive web applications using React and Node.js for 50K+ monthly users.",
            "Collaborated with design team to implement A/B testing framework, improving conversion by 15%."
          ]
        }
      ],
      "project_sections": [
        {
          "source_project_id": 7,
          "name": "Project Atlas",
          "bullets": [
            "Built scalable data pipeline processing 1M+ events daily.",
            "Improved query performance by 60% through database optimization."
          ]
        }
      ],
      "education_highlights": [
        {
          "source_education_id": 5,
          "notes": "BS Computer Science, Rutgers — 2019"
        }
      ]
    }
  ]
}"""
)

TONE_DESCRIPTORS = {
    'impact': 'Crisp, metric-heavy bullets spotlighting measurable wins.',
    'leadership': 'Highlights stakeholder management, collaboration, and ownership.',
    'technical': 'Deep dives on architecture, tooling, and complex problem solving.',
    'balanced': 'Blends measurable impact with cross-functional collaboration.',
}


class ResumeAIError(Exception):
    """Raised when we cannot return AI-generated resume content."""


def _format_date_value(value: Any) -> str | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _month_year(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return value
    return parsed.strftime('%b %Y')


def _format_date_range(item: Dict[str, Any]) -> str:
    start = _month_year(item.get('start_date'))
    if not start:
        return ''
    end_val = item.get('end_date')
    end = _month_year(end_val) if end_val else None
    if not end:
        end = 'Present' if item.get('is_current') else ''
    return f"{start} – {end}".strip(' –')


def _fallback_bullets_from_text(text: str | None, limit: int) -> List[str]:
    if not text:
        return []
    chunks = re.split(r'(?:[\n\r]+|•|-\s|\u2022|(?<=[.!?])\s+)', text)
    bullets = []
    for chunk in chunks:
        chunk = (chunk or '').strip(' -•\n\r\t')
        if chunk:
            bullets.append(chunk)
        if len(bullets) >= limit:
            break
    return bullets


def _format_degree_label(education: Dict[str, Any]) -> str:
    degree_code = education.get('degree_type', '').lower()
    base = DEGREE_LABELS.get(degree_code, education.get('degree_type', '')).strip()
    field = education.get('field_of_study') or ''
    if base and field:
        return f'{base} in {field}'
    return base or field or 'Coursework'


def _dedupe(seq: Sequence[str]) -> List[str]:
    seen = set()
    output = []
    for item in seq:
        if not item:
            continue
        lowered = item.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        output.append(item)
    return output


def _beautify_keyword(token: str) -> str:
    if not token:
        return token
    if len(token) <= 3:
        return token.upper()
    return token.title()


def _extract_keywords(text: str, limit: int = MAX_KEYWORDS) -> List[str]:
    if not text:
        return []
    tokens = re.findall(r'[a-zA-Z][a-zA-Z0-9\+\#\/]{2,}', text.lower())
    filtered = [t for t in tokens if t not in STOPWORDS]
    counts = Counter(filtered)
    ordered = [word for word, _ in counts.most_common(limit * 2)]
    prettified = [_beautify_keyword(word) for word in ordered]
    return _dedupe(prettified)[:limit]


def collect_candidate_snapshot(profile) -> Dict[str, Any]:
    """Serialize the candidate profile into a compact resume-friendly payload."""
    contact_location = profile.get_full_location()
    contact = {
        'location': contact_location,
        'city': profile.city or '',
        'state': profile.state or '',
        'phone': profile.phone or '',
        'email': profile.user.email or '',
        'portfolio_url': profile.portfolio_url or '',
    }

    skills_qs = (
        CandidateSkill.objects.filter(candidate=profile)
        .select_related('skill')
        .order_by('order', 'id')[:MAX_SKILLS]
    )
    skills = []
    for item in skills_qs:
        skills.append({
            'id': item.id,
            'name': item.skill.name,
            'category': item.skill.category,
            'level': item.level,
            'years': float(item.years) if item.years is not None else None,
        })

    experiences_qs = (
        WorkExperience.objects.filter(candidate=profile)
        .prefetch_related('skills_used')
        .order_by('-start_date', '-id')[:MAX_EXPERIENCES]
    )
    experiences = []
    for exp in experiences_qs:
        achievements = list((exp.achievements or [])[:MAX_ACHIEVEMENTS])
        if not achievements and exp.description:
            achievements = _fallback_bullets_from_text(exp.description, MAX_ACHIEVEMENTS)
        experiences.append({
            'id': exp.id,
            'company': exp.company_name,
            'title': exp.job_title,
            'location': exp.location,
            'start_date': _format_date_value(exp.start_date),
            'end_date': _format_date_value(exp.end_date),
            'is_current': exp.is_current,
            'description': (exp.description or '')[:500],
            'achievements': achievements,
            'skills_used': list(exp.skills_used.values_list('name', flat=True)[:6]),
        })

    projects_qs = (
        Project.objects.filter(candidate=profile)
        .prefetch_related('skills_used')
        .order_by('-start_date', '-id')[:MAX_PROJECTS]
    )
    projects = []
    for project in projects_qs:
        impact = _fallback_bullets_from_text(project.outcomes or project.description, MAX_PROJECT_BULLETS)
        projects.append({
            'id': project.id,
            'name': project.name,
            'role': project.role,
            'description': (project.description or '')[:400],
            'impact': impact,
            'start_date': _format_date_value(project.start_date),
            'end_date': _format_date_value(project.end_date),
            'skills_used': list(project.skills_used.values_list('name', flat=True)[:6]),
            'timeline': _format_date_range({
                'start_date': _format_date_value(project.start_date),
                'end_date': _format_date_value(project.end_date),
                'is_current': project.status == 'ongoing'
            }),
        })

    educations_qs = (
        Education.objects.filter(candidate=profile)
        .order_by('-end_date', '-start_date')[:MAX_EDUCATION]
    )
    educations = []
    for edu in educations_qs:
        educations.append({
            'id': edu.id,
            'institution': edu.institution,
            'degree_type': edu.degree_type,
            'field_of_study': edu.field_of_study,
            'start_date': _format_date_value(edu.start_date),
            'end_date': _format_date_value(edu.end_date),
            'currently_enrolled': edu.currently_enrolled,
            'gpa': float(edu.gpa) if edu.gpa is not None else None,
        })

    certs_qs = Certification.objects.filter(candidate=profile).order_by('-issue_date')[:MAX_CERTIFICATIONS]
    certifications = []
    for cert in certs_qs:
        certifications.append({
            'id': cert.id,
            'name': cert.name,
            'organization': cert.issuing_organization,
            'issue_date': _format_date_value(cert.issue_date),
        })

    return {
        'name': profile.get_full_name(),
        'headline': profile.headline or '',
        'summary': profile.summary or '',
        'industry': profile.industry or '',
        'experience_level': profile.experience_level or '',
        'years_experience': profile.years_experience,
        'contact': contact,
        'skills': skills,
        'experiences': experiences,
        'projects': projects,
        'education': educations,
        'certifications': certifications,
    }


def build_profile_preview(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'name': snapshot.get('name'),
        'headline': snapshot.get('headline'),
        'summary': snapshot.get('summary'),
        'location': snapshot.get('contact', {}).get('location'),
        'years_experience': snapshot.get('years_experience'),
        'top_skills': [skill.get('name') for skill in snapshot.get('skills', [])[:6]],
        'contact': snapshot.get('contact', {}),
    }


def build_job_snapshot(job) -> Dict[str, Any]:
    description_excerpt = (job.description or '').strip()
    if len(description_excerpt) > 1800:
        description_excerpt = description_excerpt[:1800].rsplit(' ', 1)[0] + '…'
    snapshot = {
        'id': job.id,
        'title': job.title,
        'company_name': job.company_name,
        'location': job.location,
        'job_type': job.job_type,
        'industry': job.industry,
        'posting_url': job.posting_url,
        'application_deadline': _format_date_value(job.application_deadline),
        'description_excerpt': description_excerpt,
        'status': job.status,
    }
    snapshot['derived_keywords'] = _extract_keywords(description_excerpt)
    return snapshot


def build_generation_prompt(
    candidate_snapshot: Dict[str, Any],
    job_snapshot: Dict[str, Any],
    tone: str,
    variation_count: int,
) -> str:
    tone_descriptor = TONE_DESCRIPTORS.get(tone, TONE_DESCRIPTORS['balanced'])
    candidate_json = json.dumps(candidate_snapshot, indent=2, ensure_ascii=False)
    job_json = json.dumps(job_snapshot, indent=2, ensure_ascii=False)
    prompt = f"""
You are ResumeRocket AI. Generate {variation_count} resume variations in JSON format.

Tone: {tone} → {tone_descriptor}

CRITICAL RULES:
- Use ONLY data from candidate_snapshot and job_snapshot - NO fabrication or assumptions
- Use company names, job titles, locations, dates EXACTLY as provided - NO modifications
- Include up to 5 most relevant experiences, prioritizing recent and job-aligned roles
- Provide EXACTLY 3 bullets per experience (use all available space)
- NEVER include source_experience_id or source_project_id in bullet text
- Keep bullets under 24 words with metrics when possible
- Output JSON only, no markdown fences

Schema:
{SCHEMA_BLOCK}

Candidate:
{candidate_json}

Job:
{job_json}
""".strip()
    return prompt


def call_gemini_api(prompt: str, api_key: str, *, model: str | None = None, timeout: int = 40) -> str:
    if not api_key:
        raise ResumeAIError('Gemini API key is not configured.')
    model_name = model or getattr(settings, 'GEMINI_MODEL', 'gemini-1.5-flash-latest')
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
    payload = {
        'contents': [
            {
                'role': 'user',
                'parts': [{'text': prompt}],
            }
        ],
        'generationConfig': {
            'temperature': 0.65,
            'topP': 0.9,
            'topK': 40,
            'maxOutputTokens': 8192,  # Increased to handle multiple variations with full content
        },
    }
    try:
        response = requests.post(endpoint, params={'key': api_key}, json=payload, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.error('Gemini API request failed: %s', exc)
        raise ResumeAIError('Unable to reach Gemini API. Please try again.') from exc

    data = response.json()
    
    # Check for content filtering or blocking
    if 'promptFeedback' in data:
        feedback = data['promptFeedback']
        block_reason = feedback.get('blockReason')
        if block_reason:
            logger.error('Gemini blocked request. Reason: %s, Feedback: %s', block_reason, feedback)
            raise ResumeAIError(f'Content was blocked by Gemini: {block_reason}. Please try with different job or profile data.')
    
    candidates = data.get('candidates') or []
    if not candidates:
        logger.error('Gemini returned empty candidates. Full response: %s', data)
        raise ResumeAIError('Gemini returned an empty result. This may be due to content filtering or API limits.')
    
    # Check if candidate was blocked
    first_candidate = candidates[0]
    finish_reason = first_candidate.get('finishReason')
    if finish_reason and finish_reason not in ['STOP', 'MAX_TOKENS']:
        logger.error('Gemini stopped with reason: %s. Candidate: %s', finish_reason, first_candidate)
        raise ResumeAIError(f'Generation stopped: {finish_reason}. Try simplifying the request.')
    
    parts = first_candidate.get('content', {}).get('parts', [])
    texts = [part.get('text') for part in parts if part.get('text')]
    if not texts:
        logger.error('Gemini response has no text. Candidate: %s', first_candidate)
        raise ResumeAIError('Gemini response did not include text output. Try reducing variation count or simplifying profile data.')
    return texts[0]


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith('```'):
        stripped = re.sub(r'^```(?:json)?', '', stripped, count=1, flags=re.IGNORECASE).strip()
        if stripped.endswith('```'):
            stripped = stripped[:-3].strip()
    return stripped


def parse_resume_payload(raw_text: str) -> Dict[str, Any]:
    try:
        cleaned = _strip_code_fence(raw_text)
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.error('Failed to parse Gemini resume JSON: %s', exc)
        raise ResumeAIError('Gemini returned an unreadable response.') from exc


def _build_experience_lookup(snapshot: Dict[str, Any]) -> Dict[int, Dict[str, Any]]:
    lookup = {}
    for item in snapshot.get('experiences', []):
        if item.get('id'):
            lookup[item['id']] = item
    return lookup


def _build_project_lookup(snapshot: Dict[str, Any]) -> Dict[int, Dict[str, Any]]:
    lookup = {}
    for item in snapshot.get('projects', []):
        if item.get('id'):
            lookup[item['id']] = item
    return lookup


def _build_education_lookup(snapshot: Dict[str, Any]) -> Dict[int, Dict[str, Any]]:
    lookup = {}
    for item in snapshot.get('education', []):
        if item.get('id'):
            lookup[item['id']] = item
    return lookup


def _clean_bullets(bullets: Sequence[str], limit: int) -> List[str]:
    """Clean and normalize bullet points, removing any source ID references."""
    cleaned = []
    for bullet in bullets:
        bullet = (bullet or '').strip()
        if bullet:
            # Remove any source ID references like "(source_experience_id: 42)" or "(source_project_id: 7)"
            bullet = re.sub(r'\s*\(source_(?:experience|project|education)_id:\s*\d+\)\s*\.?', '', bullet)
            # Clean up any double periods or trailing/leading whitespace
            bullet = re.sub(r'\.{2,}', '.', bullet).strip()
            if bullet:
                cleaned.append(bullet)
        if len(cleaned) >= limit:
            break
    return cleaned


def _stringify_list(items: Sequence[Any]) -> List[str]:
    output = []
    for item in items or []:
        if item is None:
            continue
        output.append(str(item))
    return output


def _build_fallback_variation(
    candidate_snapshot: Dict[str, Any],
    job_snapshot: Dict[str, Any],
    tone: str,
    keywords: List[str],
    skills: List[str],
) -> Dict[str, Any]:
    experiences = candidate_snapshot.get('experiences', [])
    projects = candidate_snapshot.get('projects', [])
    educations = candidate_snapshot.get('education', [])
    experience_sections = []
    for exp in experiences:
        bullets = _clean_bullets(exp.get('achievements', []), MAX_BULLETS_PER_EXP)
        experience_sections.append({
            'source_experience_id': exp.get('id'),
            'role': exp.get('title'),
            'company': exp.get('company'),
            'location': exp.get('location'),
            'dates': _format_date_range(exp),
            'bullets': bullets,
        })
    project_sections = []
    for proj in projects:
        project_sections.append({
            'source_project_id': proj.get('id'),
            'name': proj.get('name'),
            'notes': _format_date_range(proj),
            'bullets': _clean_bullets(proj.get('impact', []), MAX_PROJECT_BULLETS),
        })
    education_highlights = []
    for edu in educations:
        note = f"{edu.get('degree_type', '').upper()} {edu.get('field_of_study', '')}".strip()
        institution = edu.get('institution')
        date_range = _format_date_range(edu)
        parts = [part for part in [note, institution, date_range] if part]
        education_highlights.append({
            'source_education_id': edu.get('id'),
            'notes': ' — '.join(parts),
        })

    summary_headline = f"{job_snapshot.get('title') or 'Candidate'} | {job_snapshot.get('company_name') or 'Target Role'}"
    years = candidate_snapshot.get('years_experience')
    years_phrase = f"{years}+ years" if isinstance(years, (int, float)) and years else "strong"
    summary = candidate_snapshot.get('summary') or (
        f"{candidate_snapshot.get('name')} brings {years_phrase} of experience aligned to "
        f"{job_snapshot.get('title')} requirements."
    )
    skill_highlights = skills[:10]
    if not skill_highlights:
        skill_highlights = [skill.get('name') for skill in candidate_snapshot.get('skills', [])[:10]]
    return {
        'id': 'fallback',
        'label': f"{tone.title()} Focus",
        'tone': tone,
        'summary_headline': summary_headline,
        'summary': summary,
        'skills_to_highlight': skill_highlights,
        'ats_keywords': keywords,
        'experience_sections': experience_sections,
        'project_sections': project_sections,
        'education_highlights': education_highlights,
    }


def _derive_keywords(job_snapshot: Dict[str, Any], shared_analysis: Dict[str, Any]) -> List[str]:
    keywords = []
    keywords.extend(shared_analysis.get('keyword_strategy', []))
    keywords.extend(shared_analysis.get('target_keywords', []))
    keywords.extend(job_snapshot.get('derived_keywords', []))
    return _dedupe(keywords)[:MAX_KEYWORDS]


def _escape_tex(value: str | None) -> str:
    if not value:
        return ''
    replacements = {
        '&': r'\&',
        '%': r'\%',
        '$': r'\$',
        '#': r'\#',
        '_': r'\_',
        '{': r'\{',
        '}': r'\}',
        '~': r'\textasciitilde{}',
        '^': r'\textasciicircum{}',
        '\\': r'\textbackslash{}',
    }
    escaped = ''.join(replacements.get(char, char) for char in value)
    return escaped


JAKE_TEMPLATE_HEADER = r"""
\documentclass[letterpaper,11pt]{article}
\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}

%----------FONT OPTIONS----------
% \usepackage[sfdefault]{FiraSans}
% \usepackage[sfdefault]{roboto}
% \usepackage[sfdefault]{noto-sans}
% \usepackage[default]{sourcesanspro}

% \usepackage{CormorantGaramond}
% \usepackage{charter}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-2pt}}
  }
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubSubheading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \textit{\small#1} & \textit{\small #2} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & #2 \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}
\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

\begin{document}
"""


def render_jake_resume(
    candidate_snapshot: Dict[str, Any],
    job_snapshot: Dict[str, Any],
    variation: Dict[str, Any],
) -> str:
    """Render a full LaTeX document following Jake's Resume template."""
    lines = [JAKE_TEMPLATE_HEADER.strip()]
    name = _escape_tex(candidate_snapshot.get('name') or 'Candidate')
    contact_bits = []
    contact = candidate_snapshot.get('contact', {})
    if contact.get('phone'):
        contact_bits.append(_escape_tex(contact['phone']))
    if contact.get('email'):
        display_email = _escape_tex(contact['email'])
        contact_bits.append(rf'\href{{mailto:{contact["email"]}}}{{\underline{{{display_email}}}}}')
    if contact.get('portfolio_url'):
        url = contact['portfolio_url']
        contact_bits.append(rf'\href{{{url}}}{{\underline{{Portfolio}}}}')
    location = contact.get('location')
    if location:
        contact_bits.insert(0, _escape_tex(location))

    lines.append(r'\begin{center}')
    lines.append(rf'    \textbf{{\Huge \scshape {name}}} \\ \vspace{{1pt}}')
    if contact_bits:
        lines.append(f'    {{\\small {" $|$ ".join(contact_bits)} }}')
    lines.append(r'\end{center}')
    lines.append('')

    summary = variation.get('summary')
    if summary:
        lines.append(r'\section{Summary}')
        lines.append(r'\resumeSubHeadingListStart')
        summary_headline = variation.get('summary_headline')
        summary_body = _escape_tex(summary)
        if summary_headline:
            summary_body = r'\textbf{' + _escape_tex(summary_headline) + '} -- ' + summary_body
        lines.append(rf'\resumeItem{{{summary_body}}}')
        lines.append(r'\resumeSubHeadingListEnd')
        lines.append('')

    education_entries = candidate_snapshot.get('education') or []
    if education_entries:
        lines.append(r'\section{Education}')
        lines.append(r'\resumeSubHeadingListStart')
        for edu in education_entries[:MAX_EDUCATION]:
            timeline = _format_date_range(edu)
            degree = _format_degree_label(edu)
            institution = _escape_tex(edu.get('institution') or '')
            city = _escape_tex(contact.get('location') or '')
            lines.append(
                r'\resumeSubheading{' +
                institution + '}{' +
                _escape_tex(timeline) + '}{' +
                _escape_tex(degree) + '}{' +
                city + '}'
            )
        lines.append(r'\resumeSubHeadingListEnd')
        lines.append('')

    experiences = variation.get('experience_sections') or []
    if experiences:
        lines.append(r'\section{Experience}')
        lines.append(r'\resumeSubHeadingListStart')
        for exp in experiences[:MAX_EXPERIENCES]:
            lines.append(
                r'\resumeSubheading{' +
                _escape_tex(exp.get('role') or '') + '}{' +
                _escape_tex(exp.get('dates') or '') + '}{' +
                _escape_tex(exp.get('company') or '') + '}{' +
                _escape_tex(exp.get('location') or '') + '}'
            )
            bullets = exp.get('bullets') or []
            if bullets:
                lines.append(r'\resumeItemListStart')
                for bullet in bullets[:MAX_BULLETS_PER_EXP]:
                    lines.append(rf'\resumeItem{{{_escape_tex(bullet)}}}')
                lines.append(r'\resumeItemListEnd')
        lines.append(r'\resumeSubHeadingListEnd')
        lines.append('')

    projects = variation.get('project_sections') or []
    if projects:
        lines.append(r'\section{Projects}')
        lines.append(r'\resumeSubHeadingListStart')
        for proj in projects[:MAX_PROJECTS]:
            name_block = r'\textbf{' + _escape_tex(proj.get('name') or '') + '}'
            if proj.get('notes'):
                name_block += r' $|$ \emph{' + _escape_tex(proj['notes']) + '}'
            lines.append(
                r'\resumeProjectHeading{' +
                name_block + '}{' +
                _escape_tex(proj.get('timeline') or '') + '}'
            )
            bullets = proj.get('bullets') or []
            if bullets:
                lines.append(r'\resumeItemListStart')
                for bullet in bullets[:MAX_PROJECT_BULLETS]:
                    lines.append(rf'\resumeItem{{{_escape_tex(bullet)}}}')
                lines.append(r'\resumeItemListEnd')
        lines.append(r'\resumeSubHeadingListEnd')
        lines.append('')

    skills = variation.get('skills_to_highlight') or [skill.get('name') for skill in candidate_snapshot.get('skills', [])]
    if skills:
        lines.append(r'\section{Technical Skills}')
        lines.append(r'\begin{itemize}[leftmargin=0.15in, label={}]')
        lines.append(
            r'\small{\item{ \textbf{Highlighted}{: ' +
            ', '.join(_escape_tex(skill) for skill in skills[:15]) +
            r'} }}'
        )
        lines.append(r'\end{itemize}')

    lines.append(r'\vspace*{\fill}')
    lines.append(r'\end{document}')
    return '\n'.join(lines)


def compile_latex_pdf(latex_document: str) -> str:
    """Compile LaTeX to PDF via Tectonic and return base64 payload."""
    binary = getattr(settings, 'TECTONIC_BINARY', 'tectonic')
    binary_path = binary if os.path.sep in binary else which(binary)
    if not binary_path or not Path(binary_path).exists():
        raise ResumeAIError(
            'Tectonic LaTeX engine not found. Install it and set TECTONIC_BINARY or add it to PATH.'
        )

    with tempfile.TemporaryDirectory(prefix='resumerocket-tex-') as tmpdir:
        tex_path = Path(tmpdir) / 'resume.tex'
        tex_path.write_text(latex_document, encoding='utf-8')
        cmd = [
            binary_path,
            '--chatter',
            'minimal',
            '--outdir',
            tmpdir,
            tex_path.name,
        ]
        try:
            result = subprocess.run(
                cmd,
                cwd=tmpdir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
                text=True,
            )
            logger.debug('Tectonic output: %s', result.stdout.strip())
        except subprocess.CalledProcessError as exc:
            log_excerpt = _read_latex_log_excerpt(tmpdir, tex_path.stem)
            message = log_excerpt or exc.stderr or 'Unknown LaTeX compilation error.'
            raise ResumeAIError(f'Failed to compile LaTeX resume: {message}') from exc

        pdf_path = tex_path.with_suffix('.pdf')
        if not pdf_path.exists():
            raise ResumeAIError('Latex compilation completed without producing a PDF.')
        pdf_bytes = pdf_path.read_bytes()
    return base64.b64encode(pdf_bytes).decode('ascii')


def _read_latex_log_excerpt(tmpdir: str, stem: str) -> str | None:
    log_path = Path(tmpdir) / f'{stem}.log'
    if not log_path.exists():
        return None
    try:
        lines = log_path.read_text(encoding='utf-8', errors='ignore').splitlines()
    except Exception:
        return None
    tail = '\n'.join(lines[-25:])
    return tail.strip() or None


def run_resume_generation(
    candidate_snapshot: Dict[str, Any],
    job_snapshot: Dict[str, Any],
    *,
    tone: str,
    variation_count: int,
    api_key: str,
    model: str | None = None,
) -> Dict[str, Any]:
    logger.info(f'Starting resume generation with variation_count={variation_count}, tone={tone}')
    prompt = build_generation_prompt(candidate_snapshot, job_snapshot, tone, variation_count)
    logger.debug(f'Prompt length: {len(prompt)} characters')
    raw_text = call_gemini_api(prompt, api_key, model=model)
    logger.debug(f'Received raw response length: {len(raw_text)} characters')
    parsed = parse_resume_payload(raw_text)
    shared_analysis = parsed.get('shared_analysis') or {}
    raw_variations = parsed.get('variations') or []
    logger.info(f'Gemini returned {len(raw_variations)} raw variations')

    experience_lookup = _build_experience_lookup(candidate_snapshot)
    project_lookup = _build_project_lookup(candidate_snapshot)
    education_lookup = _build_education_lookup(candidate_snapshot)

    keywords_fallback = _derive_keywords(job_snapshot, shared_analysis)
    skill_fallback = [skill.get('name') for skill in candidate_snapshot.get('skills', [])]

    normalized_variations = []
    for idx, raw in enumerate(raw_variations):
        label = raw.get('label') or f'Variation {idx + 1}'
        var_id = slugify(label) or f'variation-{idx + 1}'
        summary = raw.get('summary') or candidate_snapshot.get('summary')
        summary_headline = raw.get('summary_headline') or f"{job_snapshot.get('title')} Alignment"

        exp_sections = []
        for entry in raw.get('experience_sections') or []:
            source_id = entry.get('source_experience_id')
            source = experience_lookup.get(source_id) or {}
            bullets = entry.get('bullets') or source.get('achievements') or []
            
            # Ensure critical fields match source data exactly - no AI modifications
            role = source.get('title') if source else entry.get('role')
            company = source.get('company') if source else entry.get('company')
            location = source.get('location') if source else entry.get('location')
            dates = _format_date_range(source) if source else entry.get('dates')
            
            exp_sections.append({
                'source_experience_id': source_id,
                'role': role,
                'company': company,
                'location': location,
                'dates': dates,
                'bullets': _clean_bullets(bullets, MAX_BULLETS_PER_EXP),
            })
        if not exp_sections:
            exp_sections = _build_fallback_variation(
                candidate_snapshot, job_snapshot, tone, keywords_fallback, skill_fallback
            )['experience_sections']

        proj_sections = []
        for entry in raw.get('project_sections') or []:
            source_id = entry.get('source_project_id')
            source = project_lookup.get(source_id) or {}
            
            # Ensure project name matches source data exactly
            name = source.get('name') if source else entry.get('name')
            notes = entry.get('notes') or source.get('role')
            timeline = source.get('timeline') or _format_date_range(source) if source else entry.get('timeline')
            
            proj_sections.append({
                'source_project_id': source_id,
                'name': name,
                'notes': notes,
                'bullets': _clean_bullets(entry.get('bullets') or source.get('impact') or [], MAX_PROJECT_BULLETS),
                'timeline': timeline,
            })
        if not proj_sections:
            proj_sections = _build_fallback_variation(
                candidate_snapshot, job_snapshot, tone, keywords_fallback, skill_fallback
            )['project_sections']

        education_sections = []
        for entry in raw.get('education_highlights') or []:
            source_id = entry.get('source_education_id')
            source = education_lookup.get(source_id) or {}
            note = entry.get('notes')
            if not note and source:
                degree = source.get('degree_type', '').upper()
                field = source.get('field_of_study', '')
                inst = source.get('institution', '')
                date_range = _format_date_range(source)
                note = ' — '.join(part for part in [f"{degree} {field}".strip(), inst, date_range] if part)
            education_sections.append({
                'source_education_id': source_id,
                'notes': note,
            })
        if not education_sections:
            education_sections = _build_fallback_variation(
                candidate_snapshot, job_snapshot, tone, keywords_fallback, skill_fallback
            )['education_highlights']

        skills_to_highlight = _stringify_list(raw.get('skills_to_highlight') or skill_fallback[:10])
        if not skills_to_highlight:
            skills_to_highlight = skill_fallback[:10]
        ats_keywords = _stringify_list(raw.get('ats_keywords') or keywords_fallback)
        if not ats_keywords:
            ats_keywords = keywords_fallback

        variation_payload = {
            'id': var_id if var_id not in {v.get('id') for v in normalized_variations} else f'{var_id}-{idx}',
            'label': label,
            'tone': raw.get('tone') or tone,
            'summary_headline': summary_headline,
            'summary': summary,
            'skills_to_highlight': _dedupe(skills_to_highlight)[:12],
            'ats_keywords': _dedupe(ats_keywords)[:MAX_KEYWORDS],
            'experience_sections': exp_sections,
            'project_sections': proj_sections,
            'education_highlights': education_sections,
            'generated_at': timezone.now().isoformat(),
        }
        variation_payload['latex_document'] = render_jake_resume(candidate_snapshot, job_snapshot, variation_payload)
        variation_payload['pdf_document'] = compile_latex_pdf(variation_payload['latex_document'])
        base_filename = slugify(job_snapshot.get('title') or 'resume') or 'resume'
        variation_payload['download_filename'] = f"{base_filename}-{variation_payload['id']}.tex"
        normalized_variations.append(variation_payload)

    if not normalized_variations:
        logger.warning('No variations were normalized, creating fallback')
        fallback = _build_fallback_variation(candidate_snapshot, job_snapshot, tone, keywords_fallback, skill_fallback)
        fallback['generated_at'] = timezone.now().isoformat()
        fallback['latex_document'] = render_jake_resume(candidate_snapshot, job_snapshot, fallback)
        fallback['pdf_document'] = compile_latex_pdf(fallback['latex_document'])
        fallback['download_filename'] = f"{slugify(job_snapshot.get('title') or 'resume') or 'resume'}-{fallback['id']}.tex"
        normalized_variations.append(fallback)

    logger.info(f'Returning {len(normalized_variations)} normalized variations')
    return {
        'shared_analysis': shared_analysis,
        'variations': normalized_variations,
        'variation_count': len(normalized_variations),
        'raw_text': raw_text,
    }
