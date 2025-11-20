"""
UC-076: AI-powered interview response coaching helpers.

This module prepares context for Gemini, defines the JSON schema we expect,
parses the response, and provides a deterministic fallback coach when the API
is unavailable. It keeps prompts lightweight by reusing resume snapshots.
"""
from __future__ import annotations

import json
import logging
import math
import re
from typing import Any, Dict, List, Sequence

from django.conf import settings

from core import resume_ai

logger = logging.getLogger(__name__)

SCHEMA = """{
  "summary": "One or two sentences summarizing what worked and what to improve.",
  "scores": {
    "relevance": 0-100,
    "specificity": 0-100,
    "impact": 0-100,
    "clarity": 0-100,
    "overall": 0-100
  },
  "length_analysis": {
    "word_count": 0,
    "spoken_time_seconds": 0,
    "recommended_window": "Target seconds range such as 90-120 seconds.",
    "recommendation": "Actionable guidance on trimming or expanding response."
  },
  "feedback": {
    "content": ["Bullet feedback on substance."],
    "structure": ["Bullet feedback on storytelling and sequencing."],
    "clarity": ["Bullet feedback on language and delivery."]
  },
  "weak_language": {
    "patterns": [
      {
        "phrase": "Exact weak phrase found in response",
        "issue": "Why it weakens the answer",
        "replacement": "Stronger alternative wording"
      }
    ],
    "summary": "One sentence on tone improvement."
  },
  "star_adherence": {
    "situation": {"status": "covered|light|missing", "feedback": "Coaching for this letter."},
    "task": {"status": "covered|light|missing", "feedback": "Coaching for this letter."},
    "action": {"status": "covered|light|missing", "feedback": "Coaching for this letter."},
    "result": {"status": "covered|light|missing", "feedback": "Coaching for this letter."},
    "overall_feedback": "Overall STAR summary."
  },
  "alternative_approaches": [
    {
      "label": "Name of alternative framing",
      "description": "When to use it",
      "sample_opening": "One sentence starter that demonstrates the new approach."
    }
  ],
  "improvement_focus": ["Short list of next practice goals."],
  "history_callout": "How this compares to prior sessions (if provided)."
}"""

TARGET_WINDOW_SECONDS = (90, 120)
WEAK_LANGUAGE_PATTERNS = [
    (re.compile(r'\bI think\b', re.IGNORECASE), 'Hedging language reduces confidence.', 'Lead with conviction such as "I recommended" or "I decided".'),
    (re.compile(r'\bmaybe\b', re.IGNORECASE), 'Signals uncertainty.', 'State the insight plainly or support it with data.'),
    (re.compile(r'\btry(?:ing)? to\b', re.IGNORECASE), 'Sounds tentative instead of action-oriented.', 'Use decisive verbs like "implemented" or "executed".'),
    (re.compile(r'\bhopefully\b', re.IGNORECASE), 'Suggests the outcome was luck instead of influence.', 'Describe the outcome and your ownership.'),
    (re.compile(r'\bhelped\b', re.IGNORECASE), 'Downplays leadership.', 'Use verbs that show ownership (e.g., "led", "drove", "owned").'),
]


class ResponseCoachingError(Exception):
    """Raised when we cannot return coaching guidance."""


def count_words(text: str | None) -> int:
    if not text:
        return 0
    tokens = re.findall(r"[A-Za-z0-9']+", text)
    return len(tokens)


def _estimate_spoken_seconds(word_count: int) -> int:
    # 150 wpm ≈ 2.5 wps
    if word_count <= 0:
        return TARGET_WINDOW_SECONDS[0]
    seconds = max(30, math.ceil(word_count / 2.5))
    return int(seconds)


def _strip_code_fence(text: str) -> str:
    cleaned = (text or '').strip()
    if cleaned.startswith('```'):
        cleaned = re.sub(r'^```(?:json)?', '', cleaned).strip()
        if cleaned.endswith('```'):
            cleaned = cleaned[:-3].strip()
    return cleaned


def _load_json(payload: str) -> Dict[str, Any] | None:
    if not payload:
        return None
    cleaned = _strip_code_fence(payload)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Unable to parse Gemini response as JSON")
        return None


def _score_value(value: float, *, low: int = 40, high: int = 96) -> int:
    return max(low, min(high, int(round(value))))


def _detect_weak_language(text: str) -> List[Dict[str, str]]:
    findings: List[Dict[str, str]] = []
    if not text:
        return findings
    for pattern, issue, replacement in WEAK_LANGUAGE_PATTERNS:
        match = pattern.search(text)
        if match:
            findings.append(
                {
                    'phrase': match.group(0),
                    'issue': issue,
                    'replacement': replacement,
                }
            )
    return findings[:4]


def _star_feedback_section(label: str, text: str) -> Dict[str, str]:
    wc = count_words(text)
    if wc == 0:
        return {'status': 'missing', 'feedback': f'Add a concise {label} detail.'}
    if wc < 12:
        return {'status': 'light', 'feedback': f'Include a bit more context for the {label} step.'}
    return {'status': 'covered', 'feedback': f'{label} step is solid—consider tightening wording.'}


def _compose_previous_summary(previous_sessions: Sequence[Dict[str, Any]] | None) -> str:
    if not previous_sessions:
        return "[]"
    limited = previous_sessions[:3]
    return json.dumps(limited, indent=2, ensure_ascii=False)


def _build_prompt(
    candidate_snapshot: Dict[str, Any],
    job_snapshot: Dict[str, Any],
    question_text: str,
    response_text: str,
    star_response: Dict[str, Any],
    previous_sessions: Sequence[Dict[str, Any]] | None,
) -> str:
    candidate_json = json.dumps(candidate_snapshot, indent=2, ensure_ascii=False)
    job_json = json.dumps(job_snapshot, indent=2, ensure_ascii=False)
    star_json = json.dumps(star_response or {}, indent=2, ensure_ascii=False)
    history_json = _compose_previous_summary(previous_sessions)
    prompt = f"""
You are an executive interview coach. Evaluate the candidate's written response to an interview question.
Return STRICT JSON matching the schema below. Do NOT add commentary or markdown fences.

Responsibilities:
- Score relevance, specificity, impact, clarity (0-100) and calculate overall as the rounded average.
- Analyze response length vs. the target spoken window ({TARGET_WINDOW_SECONDS[0]}-{TARGET_WINDOW_SECONDS[1]} seconds) and recommend how to adjust.
- Provide targeted bullet feedback on content, structure, and clarity.
- Highlight weak or hedging language and suggest stronger phrases.
- Evaluate STAR adherence (situation, task, action, result) and flag any missing pieces.
- Recommend at least 2 alternative response approaches (different framing or focus).
- Suggest 2-3 improvement focus areas for the next practice.
- If history is provided, include how this iteration compares to the prior session in `history_callout`.

Schema:
{SCHEMA}

Interview question:
{question_text}

Candidate response summary:
{response_text or 'No written summary provided.'}

STAR breakdown:
{star_json}

Recent coaching history:
{history_json}

Candidate snapshot:
{candidate_json}

Job snapshot:
{job_json}
""".strip()
    return prompt


def _baseline_payload(
    question_text: str,
    response_text: str,
    star_response: Dict[str, Any],
    previous_sessions: Sequence[Dict[str, Any]] | None,
) -> Dict[str, Any]:
    combined_text = response_text.strip()
    if not combined_text:
        combined_text = " ".join(
            [star_response.get('situation', ''), star_response.get('task', ''), star_response.get('action', ''), star_response.get('result', '')]
        ).strip()
    word_count = count_words(combined_text)
    spoken_seconds = _estimate_spoken_seconds(word_count)
    has_metrics = any(char.isdigit() for char in (star_response.get('result') or '') + combined_text)
    action_depth = count_words(star_response.get('action', ''))
    result_depth = count_words(star_response.get('result', ''))

    relevance = 70 + min(count_words(question_text) // 40, 10)
    specificity = 62 + (8 if has_metrics else 0) + min(action_depth // 20, 6)
    impact = 60 + (10 if has_metrics else 0) + min(result_depth // 15, 6)
    clarity = 68 - (5 if word_count > 260 else 0) - (4 if word_count < 90 else 0)

    scores = {
        'relevance': _score_value(relevance),
        'specificity': _score_value(specificity),
        'impact': _score_value(impact),
        'clarity': _score_value(clarity),
    }
    scores['overall'] = _score_value(sum(scores.values()) / max(len(scores), 1))

    weak_language = _detect_weak_language(combined_text)
    star_sections = {
        'situation': _star_feedback_section('Situation', star_response.get('situation', '')),
        'task': _star_feedback_section('Task', star_response.get('task', '')),
        'action': _star_feedback_section('Action', star_response.get('action', '')),
        'result': _star_feedback_section('Result', star_response.get('result', '')),
    }
    star_sections['overall_feedback'] = (
        "Solid STAR coverage—focus on highlighting quantifiable results."
        if has_metrics
        else "Clarify the result with measurable impact to complete STAR."
    )

    improvement_focus: List[str] = []
    if not has_metrics:
        improvement_focus.append("Add quantifiable metrics in the RESULT to prove impact.")
    if word_count > TARGET_WINDOW_SECONDS[1] * 2:
        improvement_focus.append("Trim supporting detail to keep delivery under two minutes.")
    if weak_language:
        improvement_focus.append("Replace hedging language with decisive leadership verbs.")
    if action_depth < 25:
        improvement_focus.append("Expand ACTION with tools, collaborators, or scale.")
    if not improvement_focus:
        improvement_focus.append("Rehearse out loud to tighten pacing and emphasis.")

    history_callout = ""
    if previous_sessions:
        prev_scores = previous_sessions[0].get('scores') or {}
        prev_overall = prev_scores.get('overall')
        if isinstance(prev_overall, (int, float)):
            change = scores['overall'] - float(prev_overall)
            direction = "up" if change > 0 else "down" if change < 0 else "flat"
            history_callout = f"Overall score moved {direction} to {scores['overall']} ({change:+.1f} vs. last session)."

    payload = {
        'summary': "Grounded response with clear progression; tighten the ending with sharper metrics.",
        'scores': scores,
        'length_analysis': {
            'word_count': word_count,
            'spoken_time_seconds': spoken_seconds,
            'recommended_window': f"{TARGET_WINDOW_SECONDS[0]}-{TARGET_WINDOW_SECONDS[1]} seconds",
            'recommendation': "Trim redundant context to stay within the recommended window." if spoken_seconds > TARGET_WINDOW_SECONDS[1] else "Add a vivid result and closing tie-back.",
        },
        'feedback': {
            'content': [
                "Connect the challenge directly to the employer's priorities.",
                "Reference the most relevant skills/tools for this role.",
            ],
            'structure': [
                "Open with the stakes, then summarize the resolution before diving into STAR.",
            ],
            'clarity': [
                "Favor confident verbs and short sentences when conveying impact.",
            ],
        },
        'weak_language': {
            'patterns': weak_language,
            'summary': "Swap tentative wording for decisive leadership statements." if weak_language else "Tone is confident; continue anchoring statements with evidence.",
        },
        'star_adherence': star_sections,
        'alternative_approaches': [
            {
                'label': 'Impact-first framing',
                'description': 'Start with the measurable win, then backfill context for a punchier hook.',
                'sample_opening': '“I cut onboarding time by 35% by redesigning our training, which started when…”',
            },
            {
                'label': 'Collaboration emphasis',
                'description': 'Highlight stakeholder alignment to show cross-functional leadership.',
                'sample_opening': '“To align engineering and product on a breaking outage, I…”',
            },
        ],
        'improvement_focus': improvement_focus[:3],
        'history_callout': history_callout,
        'metadata': {
            'generated_by': 'fallback',
            'model': 'heuristic',
        },
    }
    return payload


def _merge_payload(
    baseline: Dict[str, Any],
    ai_payload: Dict[str, Any] | None,
    *,
    model_name: str,
) -> Dict[str, Any]:
    if not ai_payload:
        return baseline

    merged = baseline.copy()
    for key, value in ai_payload.items():
        if value is None:
            continue
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = {**merged[key], **value}
        else:
            merged[key] = value

    # Ensure structural fields exist
    merged.setdefault('feedback', baseline.get('feedback', {}))
    merged.setdefault('weak_language', baseline.get('weak_language', {}))
    merged.setdefault('star_adherence', baseline.get('star_adherence', {}))
    merged.setdefault('length_analysis', baseline.get('length_analysis', {}))
    merged.setdefault('scores', baseline.get('scores', {}))
    merged.setdefault('alternative_approaches', baseline.get('alternative_approaches', []))
    merged.setdefault('improvement_focus', baseline.get('improvement_focus', []))
    merged.setdefault('history_callout', baseline.get('history_callout', ''))

    merged['metadata'] = {
        'generated_by': 'ai',
        'model': model_name,
    }
    if 'length_analysis' in merged and 'word_count' not in merged['length_analysis']:
        merged['length_analysis']['word_count'] = baseline['length_analysis']['word_count']
    if 'length_analysis' in merged and 'spoken_time_seconds' not in merged['length_analysis']:
        merged['length_analysis']['spoken_time_seconds'] = baseline['length_analysis']['spoken_time_seconds']

    return merged


def generate_coaching_feedback(
    profile,
    job,
    question_text: str,
    response_text: str,
    star_response: Dict[str, Any],
    previous_sessions: Sequence[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    """
    Generate AI coaching guidance for a written interview response.

    Falls back to deterministic heuristics if Gemini is not configured or fails.
    """
    baseline = _baseline_payload(question_text, response_text or '', star_response or {}, previous_sessions)

    api_key = getattr(settings, 'GEMINI_API_KEY', '')
    if not api_key:
        return baseline

    try:
        candidate_snapshot = resume_ai.collect_candidate_snapshot(profile)
        job_snapshot = resume_ai.build_job_snapshot(job)
    except Exception as exc:
        logger.warning("Failed to build snapshots for coaching prompt: %s", exc)
        return baseline

    prompt = _build_prompt(
        candidate_snapshot,
        job_snapshot,
        question_text,
        response_text or '',
        star_response or {},
        previous_sessions,
    )

    model_name = getattr(settings, 'GEMINI_MODEL', 'gemini-2.5-flash')
    try:
        raw = resume_ai.call_gemini_api(prompt, api_key, model=model_name, timeout=45)
        ai_payload = _load_json(raw)
    except Exception as exc:
        logger.warning("Gemini response coaching request failed: %s", exc)
        ai_payload = None

    if not isinstance(ai_payload, dict):
        return baseline

    merged = _merge_payload(baseline, ai_payload, model_name=model_name)
    return merged
