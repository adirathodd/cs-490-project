"""
Helpers for intelligent follow-up reminders.

These utilities centralize the logic for stage-aware scheduling,
template generation, and responsiveness-based cadence adjustments.
"""
from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict, Optional, Tuple

from django.utils import timezone

from core.models import FollowUpReminder, JobEntry

# Default etiquette guidance shown with recommendations
GENERAL_ETIQUETTE_TIPS = [
    "Be concise and specific about the role you applied for.",
    "Reference one concrete value-add or interview moment instead of generic praise.",
    "Space follow-ups to avoid appearing pushy; offer new information when possible.",
    "Always include a clear next step or question to make it easy to respond.",
]

# Stage presets for subject/body scaffolding and timing defaults
STAGE_PRESETS: Dict[str, Dict[str, Any]] = {
    "applied": {
        "reminder_type": "application_followup",
        "delay_days": 7,
        "interval_days": 7,
        "max_occurrences": 2,
        "subject": "Following up on my application for {job_title}",
        "body": (
            "Hi {company_name} team,\n\n"
            "I hope you’re well. I applied for the {job_title} role and wanted to reiterate my interest. "
            "I’m excited about contributing to your team and would welcome the chance to discuss how my experience "
            "can help.\n\n"
            "Thank you for your time,\n{user_name}"
        ),
        "tips": [
            "Wait a full week after applying before nudging.",
            "Mention one aligned skill or achievement to justify the follow-up.",
        ],
    },
    "phone_screen": {
        "reminder_type": "status_inquiry",
        "delay_days": 4,
        "interval_days": 6,
        "max_occurrences": 2,
        "subject": "Checking in on next steps for {job_title}",
        "body": (
            "Hi {company_name} team,\n\n"
            "Thank you for the phone screen for {job_title}. "
            "I enjoyed learning more about the role and would love to stay aligned on next steps. "
            "Please let me know if there’s anything else I can provide.\n\n"
            "Thanks again,\n{user_name}"
        ),
        "tips": [
            "Acknowledge their time and keep the ask lightweight.",
            "Offer to provide an additional example or reference if helpful.",
        ],
    },
    "interview": {
        "reminder_type": "interview_followup",
        "delay_days": 3,
        "interval_days": 7,
        "max_occurrences": 2,
        "subject": "Thank you for the {job_title} interview",
        "body": (
            "Hi {company_name} team,\n\n"
            "Thank you for the recent interview for the {job_title} role. "
            "I appreciated the discussion about the team’s priorities and am eager to contribute. "
            "Please let me know if there are any materials I can share to support the decision process.\n\n"
            "Best,\n{user_name}"
        ),
        "tips": [
            "Send within three days; sooner (24–48h) is courteous if you’re thanking the interviewer.",
            "Reference a specific conversation topic to show attentiveness.",
        ],
    },
    "offer": {
        "reminder_type": "offer_response",
        "delay_days": 2,
        "interval_days": 4,
        "max_occurrences": 1,
        "subject": "Next steps regarding the {job_title} offer",
        "body": (
            "Hi {company_name} team,\n\n"
            "I’m excited about the {job_title} offer and wanted to confirm the next steps and timeline. "
            "If there are documents or details you need from me, I’m happy to provide them.\n\n"
            "Thank you,\n{user_name}"
        ),
        "tips": [
            "Be clear about your decision timeline to avoid unnecessary reminders.",
            "Confirm any outstanding documents or approvals.",
        ],
    },
    "default": {
        "reminder_type": "application_followup",
        "delay_days": 5,
        "interval_days": 7,
        "max_occurrences": 2,
        "subject": "Following up about {job_title} at {company_name}",
        "body": (
            "Hi {company_name} team,\n\n"
            "I wanted to follow up regarding the {job_title} role. "
            "Please let me know if there’s any additional information I can share.\n\n"
            "Thank you,\n{user_name}"
        ),
        "tips": [
            "Always provide a light nudge rather than multiple asks in one email.",
        ],
    },
}


def _responsiveness_days(job: JobEntry) -> Optional[float]:
    """Return historical days-to-response for the job if available."""
    if getattr(job, "days_to_response", None) is not None:
        return job.days_to_response
    try:
        if job.first_response_at and job.application_submitted_at:
            delta = job.first_response_at - job.application_submitted_at
            return max(delta.total_seconds() / 86400.0, 0)
    except Exception:
        return None
    return None


def _anchor_datetime(job: JobEntry, stage: str) -> timezone.datetime:
    """Pick a sensible start datetime for scheduling."""
    if stage == "applied" and getattr(job, "application_submitted_at", None):
        return job.application_submitted_at
    if getattr(job, "last_status_change", None):
        return job.last_status_change
    return timezone.now()


def _apply_responsiveness_adjustment(
    base_delay: int, base_interval: int, responsiveness: Optional[float]
) -> Tuple[int, int, str]:
    """
    Tweak cadence based on how quickly the company responded in the past.

    Fast responders → space reminders out a bit more.
    Slow responders → shorten the cadence to keep momentum.
    """
    reason = "Standard cadence applied (no responsiveness history)."
    if responsiveness is None:
        return base_delay, base_interval, reason

    if responsiveness <= 3:
        # They respond quickly, so avoid being pushy
        delay = max(base_delay, int(responsiveness) + 3)
        interval = max(base_interval + 2, delay)
        reason = "Company responds quickly (~{:.1f} days); spacing reminders to stay polite.".format(responsiveness)
        return delay, interval, reason

    if responsiveness >= 10:
        delay = max(2, base_delay - 2)
        interval = max(3, base_interval - 2)
        reason = "Company is slow to reply (~{:.1f} days); tightening cadence to stay on their radar.".format(
            responsiveness
        )
        return delay, interval, reason

    reason = "Using balanced cadence based on ~{:.1f} day response history.".format(responsiveness)
    return base_delay, base_interval, reason


def build_followup_plan(job: JobEntry, stage: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Build a stage-aware follow-up plan with recommended timing, template, and tips.

    Returns None when reminders should be disabled (e.g., rejected applications).
    """
    stage = stage or getattr(job, "status", None) or "applied"
    if stage == "rejected":
        return None

    preset = STAGE_PRESETS.get(stage, STAGE_PRESETS["default"])
    responsiveness = _responsiveness_days(job)
    base_delay = preset["delay_days"]
    base_interval = preset["interval_days"]
    delay_days, interval_days, reason = _apply_responsiveness_adjustment(base_delay, base_interval, responsiveness)

    anchor = _anchor_datetime(job, stage)
    scheduled_at = anchor + timedelta(days=delay_days)
    if scheduled_at < timezone.now():
        # Never schedule in the past; bump to near-future
        scheduled_at = timezone.now() + timedelta(hours=2)

    subject = preset["subject"].format(job_title=job.title, company_name=job.company_name)
    body = preset["body"]

    tips = list(preset.get("tips", [])) + GENERAL_ETIQUETTE_TIPS

    return {
        "stage": stage,
        "reminder_type": preset["reminder_type"],
        "scheduled_datetime": scheduled_at,
        "interval_days": interval_days,
        "max_occurrences": preset["max_occurrences"],
        "is_recurring": preset["max_occurrences"] > 1,
        "subject": subject,
        "message_template": body,
        "etiquette_tips": tips,
        "recommendation_reason": reason,
        "responsiveness_days": responsiveness,
        "anchor_datetime": anchor,
    }


def create_stage_followup(job: JobEntry, stage: Optional[str] = None, auto: bool = True) -> Tuple[Optional[FollowUpReminder], bool]:
    """
    Create a reminder for the given job/stage if one doesn't already exist.

    Returns (reminder, created_flag).
    """
    plan = build_followup_plan(job, stage)
    if plan is None:
        return None, False

    stage = plan["stage"]
    candidate = job.candidate
    existing = (
        FollowUpReminder.objects.filter(
            job=job,
            candidate=candidate,
            status="pending",
            followup_stage=stage,
            reminder_type=plan["reminder_type"],
        )
        .order_by("scheduled_datetime")
        .first()
    )
    if existing:
        return existing, False

    reminder = FollowUpReminder.objects.create(
        candidate=candidate,
        job=job,
        reminder_type=plan["reminder_type"],
        subject=plan["subject"],
        message_template=plan["message_template"],
        scheduled_datetime=plan["scheduled_datetime"],
        interval_days=plan["interval_days"],
        is_recurring=plan["is_recurring"],
        max_occurrences=plan["max_occurrences"],
        followup_stage=stage,
        auto_scheduled=auto,
        recommendation_reason=plan["recommendation_reason"],
    )
    return reminder, True


def dismiss_pending_for_job(job: JobEntry) -> int:
    """Dismiss active reminders when the application is rejected/closed."""
    qs = FollowUpReminder.objects.filter(job=job, status="pending")
    return qs.update(status="dismissed", completed_at=timezone.now())


def serialize_plan(plan: Dict[str, Any]) -> Dict[str, Any]:
    """Make a plan JSON-friendly for API responses."""
    if plan is None:
        return {}
    serialized = dict(plan)
    for key in ["scheduled_datetime", "anchor_datetime"]:
        if key in serialized and serialized[key] is not None:
            try:
                serialized[key] = serialized[key].isoformat()
            except Exception:
                serialized[key] = None
    return serialized
