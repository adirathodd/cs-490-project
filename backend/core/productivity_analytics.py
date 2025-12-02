"""Productivity and time investment analytics for job search activities."""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List

from django.db.models import Count, Sum
from django.utils import timezone

from core.models import (
    ApplicationGoal,
    CandidateProfile,
    EventFollowUp,
    Interaction,
    InterviewPreparationTask,
    InterviewPrepSession,
    JobEntry,
    JobQuestionPractice,
    MockInterviewSession,
    NetworkingEvent,
    SkillDevelopmentProgress,
)


def _safe_dt(dt):
    """Normalize datetimes so downstream calculations don't choke on naive values."""
    if not dt:
        return None
    if timezone.is_naive(dt):
        try:
            return timezone.make_aware(dt, timezone=timezone.get_current_timezone())
        except Exception:
            return timezone.now()
    return dt


def _time_block(dt):
    hour = dt.hour
    if 5 <= hour < 9:
        return "05-09"
    if 9 <= hour < 12:
        return "09-12"
    if 12 <= hour < 16:
        return "12-16"
    if 16 <= hour < 20:
        return "16-20"
    if 20 <= hour < 23:
        return "20-23"
    return "late-night"


class ProductivityAnalyzer:
    """Aggregate time usage, cadence patterns, and balance metrics for a candidate."""

    def __init__(self, candidate: CandidateProfile):
        self.candidate = candidate
        self.user = candidate.user

    def build(self) -> Dict:
        time_data = self._build_time_investment()
        entries = time_data.pop("entries", [])
        patterns = self._build_patterns(entries)
        completion = self._build_completion_metrics()
        outcomes = self._build_outcome_links(time_data)
        balance = self._build_balance(entries)
        energy = self._build_energy_patterns()
        recommendations = self._build_recommendations(time_data, patterns, completion, balance, outcomes, energy)

        return {
            "time_investment": time_data,
            "patterns": patterns,
            "completion": completion,
            "outcomes": outcomes,
            "balance": balance,
            "energy": energy,
            "recommendations": recommendations,
        }

    # ----------------------------
    # Time tracking
    # ----------------------------
    def _collect_time_entries(self) -> List[Dict]:
        entries: List[Dict] = []

        # Skill development / learning time
        for record in SkillDevelopmentProgress.objects.filter(candidate=self.candidate):
            minutes = float(record.hours_spent or 0) * 60
            if minutes <= 0:
                minutes = 30  # fallback estimate
            entries.append({"dt": _safe_dt(record.activity_date), "minutes": minutes, "activity": "skill_development"})

        # Interview prep and practice
        for prep in InterviewPrepSession.objects.filter(application__candidate=self.candidate):
            minutes = prep.duration_minutes or 30
            entries.append({"dt": _safe_dt(prep.session_date), "minutes": minutes, "activity": "interview_preparation"})

        for practice in JobQuestionPractice.objects.filter(job__candidate=self.candidate):
            minutes = (practice.total_duration_seconds or 0) / 60.0
            if minutes <= 0:
                minutes = 15
            entries.append({"dt": _safe_dt(practice.last_practiced_at), "minutes": minutes, "activity": "interview_preparation"})

        for session in MockInterviewSession.objects.filter(user=self.user):
            minutes = (session.total_duration_seconds or 0) / 60.0
            if minutes <= 0 and session.started_at and session.completed_at:
                minutes = max(0, (session.completed_at - session.started_at).total_seconds() / 60.0)
            if minutes <= 0:
                minutes = 20
            entries.append({"dt": _safe_dt(session.started_at), "minutes": minutes, "activity": "interview_preparation"})

        # Networking and outreach
        for interaction in Interaction.objects.filter(owner=self.user):
            minutes = interaction.duration_minutes or 15
            entries.append({"dt": _safe_dt(interaction.date), "minutes": minutes, "activity": "networking"})

        for event in NetworkingEvent.objects.filter(owner=self.user):
            if event.end_date and event.event_date:
                minutes = max(0, (event.end_date - event.event_date).total_seconds() / 60.0)
            else:
                minutes = 90
            entries.append({"dt": _safe_dt(event.event_date), "minutes": minutes, "activity": "networking"})

        # Application time (estimate from creation timestamps)
        for job in JobEntry.objects.filter(candidate=self.candidate):
            dt = _safe_dt(job.created_at or job.updated_at)
            entries.append({"dt": dt, "minutes": 25, "activity": "applications"})
            # Count explicit application events if present
            for item in job.application_history or []:
                action = (item.get("action") or "").lower()
                if "apply" in action or "submit" in action:
                    ts = item.get("timestamp") or item.get("at")
                    try:
                        event_dt = _safe_dt(datetime.fromisoformat(str(ts).replace("Z", "+00:00")))
                    except Exception:
                        event_dt = dt
                    entries.append({"dt": event_dt, "minutes": 25, "activity": "applications"})

        # Remove entries without usable timestamps
        return [e for e in entries if e["dt"] is not None]

    def _build_time_investment(self) -> Dict:
        entries = self._collect_time_entries()
        by_activity: Dict[str, Dict] = defaultdict(lambda: {"minutes": 0, "sessions": 0, "last_logged": None})

        for entry in entries:
            bucket = by_activity[entry["activity"]]
            bucket["minutes"] += entry["minutes"]
            bucket["sessions"] += 1
            last_dt = bucket["last_logged"]
            bucket["last_logged"] = max(last_dt, entry["dt"]) if last_dt else entry["dt"]

        weekly_hours = self._weekly_hours(entries)
        total_minutes = sum(a["minutes"] for a in by_activity.values())

        return {
            "total_hours": round(total_minutes / 60.0, 2),
            "activities": {
                name: {
                    "hours": round(data["minutes"] / 60.0, 2),
                    "sessions": data["sessions"],
                    "last_logged": data["last_logged"].isoformat() if data["last_logged"] else None,
                }
                for name, data in by_activity.items()
            },
            "weekly_hours": weekly_hours,
            "entries": entries,
        }

    def _weekly_hours(self, entries: List[Dict]) -> List[Dict]:
        if not entries:
            return []

        week_buckets = defaultdict(float)
        for entry in entries:
            week_start = entry["dt"].date() - timedelta(days=entry["dt"].weekday())
            week_buckets[week_start] += entry["minutes"]

        series = []
        for week_start, minutes in sorted(week_buckets.items(), key=lambda kv: kv[0]):
            series.append({"week_start": week_start.isoformat(), "hours": round(minutes / 60.0, 2)})
        return series[-8:]  # keep recent history concise

    # ----------------------------
    # Patterns and cadence
    # ----------------------------
    def _build_patterns(self, entries: List[Dict]) -> Dict:
        days = defaultdict(float)
        blocks = defaultdict(float)

        for entry in entries:
            dt = entry["dt"]
            days[dt.strftime("%A")] += entry["minutes"]
            blocks[_time_block(dt)] += entry["minutes"]

        time_block_success = self._success_by_time_block()

        def to_hours_map(src: Dict[str, float]):
            return [{"label": key, "hours": round(val / 60.0, 2)} for key, val in sorted(src.items())]

        block_series = [
            {
                "block": block,
                "hours": round(blocks.get(block, 0) / 60.0, 2),
                "response_rate": stats.get("response_rate", 0),
                "offer_rate": stats.get("offer_rate", 0),
                "applications": stats.get("applications", 0),
            }
            for block, stats in sorted(time_block_success.items())
        ]

        best_block = None
        if block_series:
            best_block = max(
                block_series,
                key=lambda x: (x.get("offer_rate", 0), x.get("response_rate", 0), x.get("applications", 0)),
            )

        return {
            "by_day": to_hours_map(days),
            "by_time_block": block_series,
            "best_time_block": best_block,
        }

    def _success_by_time_block(self) -> Dict[str, Dict]:
        stats = defaultdict(lambda: {"applications": 0, "responses": 0, "offers": 0})
        qs = JobEntry.objects.filter(candidate=self.candidate)

        for job in qs:
            dt = _safe_dt(job.created_at or job.updated_at or timezone.now())
            block = _time_block(dt)
            stats[block]["applications"] += 1
            if job.status and job.status not in ["interested", "applied"]:
                stats[block]["responses"] += 1
            if job.status == "offer":
                stats[block]["offers"] += 1

        for block, data in stats.items():
            applications = data["applications"] or 1
            data["response_rate"] = round((data["responses"] / applications) * 100, 2)
            data["offer_rate"] = round((data["offers"] / applications) * 100, 2)

        return stats

    # ----------------------------
    # Completion & outcomes
    # ----------------------------
    def _build_completion_metrics(self) -> Dict:
        goals = ApplicationGoal.objects.filter(candidate=self.candidate)
        completed_goals = goals.filter(is_completed=True).count()
        active_goals = goals.count()
        goal_completion_rate = round((completed_goals / active_goals) * 100, 1) if active_goals else 0

        prep_tasks = InterviewPreparationTask.objects.filter(interview__candidate=self.candidate)
        completed_tasks = prep_tasks.filter(is_completed=True).count()
        total_tasks = prep_tasks.count()
        prep_completion_rate = round((completed_tasks / total_tasks) * 100, 1) if total_tasks else 0

        followups = EventFollowUp.objects.filter(event__owner=self.user)
        completed_followups = followups.filter(completed=True).count()
        total_followups = followups.count()
        followup_rate = round((completed_followups / total_followups) * 100, 1) if total_followups else 0

        return {
            "goal_completion_rate": goal_completion_rate,
            "prep_task_completion_rate": prep_completion_rate,
            "follow_up_completion_rate": followup_rate,
            "counts": {
                "goals": active_goals,
                "completed_goals": completed_goals,
                "prep_tasks": total_tasks,
                "completed_prep_tasks": completed_tasks,
                "followups": total_followups,
                "completed_followups": completed_followups,
            },
        }

    def _build_outcome_links(self, time_data: Dict) -> Dict:
        jobs = JobEntry.objects.filter(candidate=self.candidate, is_archived=False)
        applied = jobs.exclude(status="interested").count()
        responded = jobs.exclude(status__in=["interested", "applied"]).count()
        interviews = jobs.filter(status__in=["phone_screen", "interview", "offer"]).count()
        offers = jobs.filter(status="offer").count()

        hours_on_apps = time_data["activities"].get("applications", {}).get("hours", 0) or 0.01
        hours_total = time_data.get("total_hours", 0) or 0.01

        return {
            "applications": applied,
            "responses": responded,
            "interviews": interviews,
            "offers": offers,
            "responses_per_hour": round(responded / hours_on_apps, 2) if hours_on_apps else 0,
            "interviews_per_hour": round((interviews or 0) / hours_total, 2) if hours_total else 0,
            "hours_per_offer": round(hours_total / offers, 2) if offers else None,
        }

    # ----------------------------
    # Balance & energy
    # ----------------------------
    def _build_balance(self, entries: List[Dict]) -> Dict:
        if not entries:
            return {
                "avg_daily_hours": 0,
                "late_sessions": 0,
                "burnout_risk": False,
                "notes": "Log time to get balance insights.",
            }

        daily_minutes = defaultdict(float)
        late_sessions = 0
        now = timezone.now().date()
        window_start = now - timedelta(days=14)

        for entry in entries:
            if entry["dt"].date() >= window_start:
                daily_minutes[entry["dt"].date()] += entry["minutes"]
            if entry["dt"].hour >= 22 or entry["dt"].hour < 6:
                late_sessions += 1

        if daily_minutes:
            avg_daily_hours = sum(daily_minutes.values()) / (len(daily_minutes) * 60.0)
        else:
            avg_daily_hours = 0

        burnout_risk = avg_daily_hours > 5 or late_sessions >= 3

        return {
            "avg_daily_hours": round(avg_daily_hours, 2),
            "late_sessions": late_sessions,
            "burnout_risk": burnout_risk,
            "notes": "Keep at or below 4-5 focused hours/day to avoid fatigue.",
        }

    def _build_energy_patterns(self) -> Dict:
        time_block_success = self._success_by_time_block()
        if not time_block_success:
            return {"time_block_success": [], "energy_signals": []}

        series = []
        for block, stats in sorted(time_block_success.items()):
            series.append(
                {
                    "block": block,
                    "applications": stats.get("applications", 0),
                    "response_rate": stats.get("response_rate", 0),
                    "offer_rate": stats.get("offer_rate", 0),
                }
            )

        best = max(series, key=lambda x: (x["offer_rate"], x["response_rate"], x["applications"]))
        energy_signals = [
            f"Your strongest response window is {best['block']} with a {best['response_rate']}% response rate.",
            "Align deep work blocks to the windows with higher response/offer rates to match your energy peaks.",
        ]

        return {"time_block_success": series, "energy_signals": energy_signals}

    # ----------------------------
    # Recommendations
    # ----------------------------
    def _build_recommendations(self, time_data, patterns, completion, balance, outcomes, energy) -> List[str]:
        recs: List[str] = []

        best_block = patterns.get("best_time_block")
        if best_block:
            block_label = best_block.get("block", "your peak window")
            recs.append(
                f"Schedule applications and outreach during {block_label} when response rates peak."
            )

        if (time_data["activities"].get("networking", {}).get("hours", 0) or 0) < 1:
            recs.append("Add at least 1 hour/week for networking conversations to unlock warmer leads.")

        if completion.get("prep_task_completion_rate", 0) < 60:
            recs.append("Close out pending interview prep tasks to raise your readiness score before next rounds.")

        if balance.get("burnout_risk"):
            recs.append("Reduce late-night sessions and set a cutoff time to lower burnout risk.")

        if outcomes.get("responses_per_hour", 0) < 0.5:
            recs.append("Iterate on application quality: tailor resumes and prioritize high-fit roles to improve yield per hour.")

        recs.extend(energy.get("energy_signals", [])[:1])

        # Keep list concise for UI
        return recs[:6]
