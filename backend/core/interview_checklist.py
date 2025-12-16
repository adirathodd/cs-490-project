"""Shared logic for interview preparation checklist (UC-081)."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List
import hashlib

import requests
from django.conf import settings
from core.api_monitoring import track_api_call, get_or_create_service, SERVICE_GEMINI

logger = logging.getLogger(__name__)


def _compute_task_id(category: str, task_text: str) -> str:
    label = (category or 'General').strip()
    text = (task_text or '').strip() or 'Task'
    return hashlib.sha1(f"{label}:{text}".encode('utf-8')).hexdigest()[:16]


def _build_task(category: str, task_text: str, task_id: str | None = None) -> Dict[str, str]:
    identifier = task_id or _compute_task_id(category, task_text)
    return {'task_id': identifier, 'category': category, 'task': task_text}


def generate_ai_role_tasks(job_title: str, company_name: str) -> List[Dict[str, str]]:
    """Generate role-specific checklist tasks via Gemini (best-effort)."""
    api_key = getattr(settings, 'GEMINI_API_KEY', '')
    if not api_key:
        return []

    model = getattr(settings, 'GEMINI_MODEL', 'gemini-2.5-flash')
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    prompt = f"""Generate 3-4 specific, actionable preparation tasks for a {job_title} interview at {company_name}.
Requirements:
- Focus on role-specific preparation (NOT general interview advice)
- Tasks should be relevant to the {job_title} profession
- Include industry knowledge, technical skills, or domain expertise needed
- Make tasks specific and actionable
- Keep each task under 100 characters
Return ONLY a JSON array of objects with this format:
[
  {{"task_id": "ai_task_1", "task": "Task description here"}},
  {{"task_id": "ai_task_2", "task": "Task description here"}}
]
Now generate for {job_title} at {company_name}."""

    payload = {
        'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
        'generationConfig': {
            'temperature': 0.7,
            'topP': 0.9,
            'topK': 40,
            'maxOutputTokens': 512,
        },
    }

    try:
        service = get_or_create_service(SERVICE_GEMINI, 'Google Gemini AI')
        with track_api_call(service, endpoint=f'/models/{model}:generateContent', method='POST'):
            response = requests.post(endpoint, params={'key': api_key}, json=payload, timeout=20)
            response.raise_for_status()
        data = response.json()
        text = data['candidates'][0]['content']['parts'][0]['text'].strip()
        if text.startswith('```'):
            sections = text.split('```')
            if len(sections) >= 2:
                text = sections[1]
                if text.lower().startswith('json'):
                    text = text[4:]
            text = text.strip()
        tasks = json.loads(text)
        for task in tasks:
            task['category'] = 'Role Preparation'
        return tasks[:4]
    except Exception as exc:  # pragma: no cover - external dependency
        logger.warning('AI role task generation failed: %s', exc)
        return [
            {
                'task_id': 'ai_generic_1',
                'category': 'Role Preparation',
                'task': f"Research thought leadership topics for {job_title}",
            }
        ]


def build_checklist_tasks(interview, include_ai: bool = True) -> List[Dict[str, Any]]:
    job_title = (interview.job.title or '').lower()
    company_name = interview.job.company_name
    interview_type = interview.interview_type

    is_technical = any(keyword in job_title for keyword in ['engineer', 'developer', 'programmer', 'software', 'data', 'analyst'])
    is_management = any(keyword in job_title for keyword in ['manager', 'director', 'lead', 'head', 'vp', 'chief'])
    is_creative = any(keyword in job_title for keyword in ['designer', 'creative', 'artist', 'writer', 'content'])
    is_sales = any(keyword in job_title for keyword in ['sales', 'account', 'business development', 'bd'])
    use_ai_for_role = not (is_technical or is_management or is_creative or is_sales)

    tasks: List[Dict[str, Any]] = []

    # Company Research
    tasks.extend([
        _build_task('Company Research', f"Research {company_name}'s mission, values, and culture", 'research_mission'),
        _build_task('Company Research', f"Read recent news and press releases about {company_name}", 'research_news'),
        _build_task('Company Research', f"Identify {company_name}'s main competitors and market position", 'research_competitors'),
        _build_task('Company Research', f"Familiarize yourself with {company_name}'s products/services", 'research_products'),
    ])

    # Role prep
    general_role_tasks = [
        _build_task('Role Preparation', f"Re-read and understand the {interview.job.title} job description"),
        _build_task('Role Preparation', 'Identify how your skills match the job requirements'),
    ]
    tasks.extend(general_role_tasks)

    if is_technical:
        tasks.extend([
            _build_task('Role Preparation', 'Review relevant technical concepts and technologies'),
            _build_task('Role Preparation', 'Practice coding problems or system design drills'),
        ])
    elif is_management:
        tasks.extend([
            _build_task('Role Preparation', 'Prepare examples of leadership and team management'),
            _build_task('Role Preparation', 'Prepare metrics showing your impact on previous teams'),
        ])
    elif is_creative:
        tasks.extend([
            _build_task('Role Preparation', 'Review and update your portfolio with best work'),
            _build_task('Role Preparation', 'Prepare to explain your creative process and approach'),
        ])
    elif is_sales:
        tasks.extend([
            _build_task('Role Preparation', 'Prepare specific sales numbers and achievements'),
            _build_task('Role Preparation', 'Think about sales strategies for their product/service'),
        ])
    elif use_ai_for_role:
        if include_ai:
            ai_tasks = generate_ai_role_tasks(interview.job.title, company_name)
            for task in ai_tasks:
                category = task.get('category', 'Role Preparation')
                description = task.get('task', '')
                identifier = task.get('task_id') or _compute_task_id(category, description)
                tasks.append({
                    'task_id': identifier,
                    'category': category,
                    'task': description,
                })
        else:
            tasks.extend([
                _build_task('Role Preparation', f'Research key success stories for {interview.job.title}'),
                _build_task('Role Preparation', f'Outline how your experience maps to {company_name}'),
            ])

    tasks.append(_build_task('Role Preparation', 'Prepare 3-5 STAR method examples (Situation, Task, Action, Result)'))

    tasks.extend([
        _build_task('Questions to Ask', 'Prepare questions about the role and daily responsibilities'),
        _build_task('Questions to Ask', 'Prepare questions about team structure and collaboration'),
        _build_task('Questions to Ask', 'Prepare questions about growth opportunities and career path'),
        _build_task('Questions to Ask', 'Prepare questions about company culture and work environment'),
    ])

    if interview_type in ['in_person', 'video']:
        attire_task_id = 'attire_casual' if 'startup' in company_name.lower() or 'tech' in company_name.lower() else 'attire_professional'
        attire_text = 'Choose business casual attire (tech/startup environment)' if attire_task_id == 'attire_casual' else 'Choose professional business attire'
        tasks.append(_build_task('Attire & Presentation', attire_text))
        if interview_type == 'video':
            tasks.extend([
                _build_task('Attire & Presentation', 'Ensure clean, professional background for video call'),
                _build_task('Attire & Presentation', 'Test lighting - face should be well-lit and visible'),
            ])
    tasks.extend([
        _build_task('Logistics', 'Test camera, microphone, and internet connection') if interview_type == 'video' else None,
        _build_task('Logistics', 'Install and test video conferencing platform') if interview_type == 'video' else None,
        _build_task('Logistics', 'Have backup device ready in case of technical issues') if interview_type == 'video' else None,
        _build_task('Logistics', f"Plan route to {interview.location or f'{company_name} office'} and check travel time") if interview_type == 'in_person' else None,
        _build_task('Logistics', 'Plan to arrive 10-15 minutes early') if interview_type == 'in_person' else None,
        _build_task('Logistics', 'Check parking/public transit options') if interview_type == 'in_person' else None,
        _build_task('Logistics', 'Find a quiet space with good cell reception') if interview_type == 'phone' else None,
        _build_task('Logistics', 'Ensure phone is fully charged') if interview_type == 'phone' else None,
    ])

    tasks = [task for task in tasks if task]

    tasks.extend([
        _build_task('Logistics', 'Research your interviewer on LinkedIn'),
        _build_task('Logistics', f"Confirm interview time: {interview.scheduled_at.strftime('%B %d at %I:%M %p')}"),
    ])

    tasks.extend([
        _build_task('Confidence Building', 'Practice answering common interview questions out loud'),
        _build_task('Confidence Building', 'Review your accomplishments and strengths'),
        _build_task('Confidence Building', 'Do a mock interview with a friend or mentor (optional)'),
        _build_task('Confidence Building', 'Visualize a successful interview and positive outcome'),
    ])

    tasks.extend([
        _build_task('Materials & Portfolio', 'Print 3-5 copies of your resume (if in-person)'),
        _build_task('Materials & Portfolio', 'Have list of references ready'),
        _build_task('Materials & Portfolio', 'Prepare notepad and pen for taking notes'),
    ])
    if is_technical or is_creative:
        tasks.append(_build_task('Materials & Portfolio', 'Have portfolio or work samples accessible to share'))

    tasks.extend([
        _build_task('Post-Interview Follow-up', 'Plan to send thank-you email within 24 hours'),
        _build_task('Post-Interview Follow-up', 'Prepare to take notes immediately after interview'),
        _build_task('Post-Interview Follow-up', 'Ask about next steps and timeline at end of interview'),
    ])

    return tasks
