"""
Gemini-powered interview follow-up email generation for UC-082.

This module generates personalized follow-up email templates for interviews
using Gemini's API. It supports various types of follow-ups including
thank-you notes, status inquiries, and feedback requests.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List

from django.conf import settings
from django.utils import timezone
from django.utils.text import slugify

from core import resume_ai

logger = logging.getLogger(__name__)

FOLLOWUP_TYPES = {
    'thank_you': 'Express gratitude and reiterate interest after an interview.',
    'status_inquiry': 'Politely ask for an update on the hiring decision.',
    'feedback_request': 'Ask for constructive feedback after a rejection.',
    'networking': 'Connect with the interviewer for future opportunities.',
    'general_followup': 'General touchpoint to maintain the relationship.',
}

TONE_STYLES = {
    'professional': 'Polished, formal, and respectful.',
    'enthusiastic': 'Energetic, positive, and eager.',
    'appreciative': 'Warm, grateful, and sincere.',
    'concise': 'Short, direct, and to the point.',
    'confident': 'Assertive but polite, highlighting value.',
}

SCHEMA_BLOCK = """
{
    "templates": [
        {
            "type": "thank_you",
            "subject": "Thank you - [Role Name] Interview - [Candidate Name]",
            "body": "Dear [Interviewer Name],\\n\\nThank you for...",
            "timing_suggestion": "Send within 24 hours of the interview.",
            "personalization_notes": "Mention the discussion about [Topic]."
        }
    ]
}
""".strip()

class InterviewFollowUpError(Exception):
    """Raised when we cannot return AI-generated follow-up content."""

def build_followup_prompt(
    interview_details: Dict[str, Any],
    followup_type: str,
    tone: str,
    custom_instructions: str | None = None,
) -> str:
    tone_descriptor = TONE_STYLES.get(tone, TONE_STYLES['professional'])
    type_descriptor = FOLLOWUP_TYPES.get(followup_type, FOLLOWUP_TYPES['thank_you'])
    
    details_json = json.dumps(interview_details, indent=2, ensure_ascii=False)
    
    prompt = f"""
You are ResumeRocket AI. Generate a personalized interview follow-up email template.

Type: {followup_type} → {type_descriptor}
Tone: {tone} → {tone_descriptor}

Instructions:
- Create a subject line and email body.
- Use placeholders like [Interviewer Name], [Company Name], etc., where specific details are needed but not provided.
- If specific details are provided in the input, use them directly.
- Provide a suggestion for when to send this email.
- Output JSON only, no markdown fences.

Input Details:
{details_json}

Custom Instructions:
{custom_instructions or "None"}

Schema:
{SCHEMA_BLOCK}
""".strip()
    return prompt

def parse_followup_payload(raw_text: str) -> Dict[str, Any]:
    try:
        # Strip markdown code fences if present
        cleaned = raw_text.strip()
        if cleaned.startswith('```'):
            cleaned = re.sub(r'^```(?:json)?', '', cleaned, count=1, flags=re.IGNORECASE).strip()
            if cleaned.endswith('```'):
                cleaned = cleaned[:-3].strip()
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.error('Failed to parse Gemini follow-up JSON: %s', exc)
        raise InterviewFollowUpError('Gemini returned an unreadable response.') from exc

def run_followup_generation(
    interview_details: Dict[str, Any],
    followup_type: str = 'thank_you',
    tone: str = 'professional',
    api_key: str | None = None,
    model: str | None = None,
    custom_instructions: str | None = None,
) -> Dict[str, Any]:
    """
    Generate interview follow-up templates.
    
    Args:
        interview_details: Dict containing interview context (company, role, interviewer, etc.)
        followup_type: Type of follow-up (thank_you, status_inquiry, etc.)
        tone: Desired tone of the email
        api_key: Gemini API key
        model: Gemini model to use
        custom_instructions: Additional user instructions
        
    Returns:
        Dict containing generated templates
    """
    if not api_key:
        api_key = getattr(settings, 'GEMINI_API_KEY', '')
        
    logger.info(f"Starting follow-up generation: type={followup_type}, tone={tone}")
    
    prompt = build_followup_prompt(
        interview_details,
        followup_type,
        tone,
        custom_instructions
    )
    
    try:
        raw_text = resume_ai.call_gemini_api(prompt, api_key, model=model)
        parsed = parse_followup_payload(raw_text)
        
        # Add metadata
        parsed['generated_at'] = timezone.now().isoformat()
        parsed['meta'] = {
            'type': followup_type,
            'tone': tone
        }
        
        return parsed
        
    except Exception as e:
        logger.error(f"Error generating follow-up: {str(e)}")
        # Return a fallback template if AI fails
        return _generate_fallback_template(interview_details, followup_type)

def _generate_fallback_template(details: Dict[str, Any], followup_type: str) -> Dict[str, Any]:
    """Generate a basic fallback template without AI."""
    role = details.get('role', '[Role]')
    company = details.get('company', '[Company]')
    interviewer = details.get('interviewer_name', '[Interviewer Name]')
    
    if followup_type == 'thank_you':
        subject = f"Thank you - {role} Interview - {details.get('candidate_name', '[Your Name]')}"
        body = f"""Dear {interviewer},

Thank you for taking the time to speak with me today about the {role} position at {company}. I enjoyed learning more about the team and the projects you are working on.

I am very interested in this opportunity and believe my skills would be a great fit. Please let me know if there is any additional information I can provide.

Best regards,
{details.get('candidate_name', '[Your Name]')}"""
        timing = "Send within 24 hours of the interview."
        
    elif followup_type == 'status_inquiry':
        subject = f"Follow up on {role} application - {details.get('candidate_name', '[Your Name]')}"
        body = f"""Dear {interviewer},

I hope you are having a good week.

I am writing to follow up on my interview for the {role} position at {company}. I remain very interested in the role and would love to know if there are any updates regarding the hiring process.

Thank you for your time and consideration.

Best regards,
{details.get('candidate_name', '[Your Name]')}"""
        timing = "Send 1-2 weeks after the interview if you haven't heard back."
        
    else:
        subject = f"Following up - {role} - {details.get('candidate_name', '[Your Name]')}"
        body = f"Dear {interviewer},\n\n[Content placeholder]\n\nBest,\n{details.get('candidate_name', '[Your Name]')}"
        timing = "Timing depends on context."

    return {
        "templates": [
            {
                "type": followup_type,
                "subject": subject,
                "body": body,
                "timing_suggestion": timing,
                "personalization_notes": "This is a fallback template. AI generation failed."
            }
        ]
    }
