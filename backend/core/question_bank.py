"""
UC-075: Role-Specific Interview Question Bank utilities.

Builds curated interview question sets based on the job title, industry,
and extracted skill requirements. Generates technical, behavioral, and
situational questions with difficulty levels plus STAR guidance so the
frontend can render a structured bank.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from typing import Dict, List, Any

from django.conf import settings
from django.utils import timezone

from core.interview_insights import InterviewInsightsGenerator
from core.skills_gap_analysis import SkillsGapAnalyzer

logger = logging.getLogger(__name__)


def _normalize_industry(industry: str | None) -> str:
    if not industry:
        return "general"
    return industry.strip().lower()


@dataclass
class DifficultyLevel:
    value: str
    label: str
    description: str


class QuestionBankBuilder:
    """Generate categorized interview questions for a job entry."""

    DIFFICULTY_LEVELS = [
        DifficultyLevel("entry", "Entry", "Focus on foundational understanding and terminology."),
        DifficultyLevel("mid", "Mid-level", "Demonstrate applied experience and collaboration."),
        DifficultyLevel("senior", "Senior", "Show strategic thinking, scale, and leadership."),
    ]

    INDUSTRY_TECH_TOPICS: Dict[str, List[str]] = {
        "software": ["scalability", "code quality", "agile delivery", "observability"],
        "finance": ["risk controls", "regulatory compliance", "data accuracy", "automation"],
        "healthcare": ["patient safety", "HIPAA compliance", "interoperability", "clinical workflows"],
        "education": ["learner outcomes", "content personalization", "accessibility", "engagement"],
        "retail": ["supply chain visibility", "customer loyalty", "omnichannel experiences", "inventory accuracy"],
        "manufacturing": ["throughput optimization", "quality control", "predictive maintenance", "safety"],
        "government": ["public transparency", "security", "policy alignment", "mission impact"],
        "general": ["process efficiency", "stakeholder alignment", "data-driven decisions", "innovation"],
    }

    SITUATIONAL_PROMPTS = {
        "software": [
            "a production outage that impacts key customers",
            "re-architecting a legacy service without downtime",
            "aligning engineers and product on a tight launch",
        ],
        "finance": [
            "responding to an unexpected audit finding",
            "rolling out automation while staying compliant",
            "handling a market downturn that affects forecasts",
        ],
        "healthcare": [
            "introducing a new clinical workflow across sites",
            "handling sensitive data across multiple vendors",
            "improving patient experience metrics during change",
        ],
    }

    COMPANY_OPPORTUNITIES = [
        "accelerating roadmap delivery without sacrificing quality",
        "leveraging data or AI to create a competitive moat",
        "elevating cross-functional collaboration and communication",
        "navigating upcoming industry regulations or standards",
        "supporting growth while maintaining culture and values",
    ]

    def __init__(self, job, candidate_profile):
        self.job = job
        self.profile = candidate_profile
        self.industry_key = _normalize_industry(job.industry)
        self.is_technical = InterviewInsightsGenerator._is_technical_role(job.title or "")
        self.role_type = InterviewInsightsGenerator._get_role_type(job.title or "")

        # Use extracted job requirements to link questions to skills
        self.required_skills = SkillsGapAnalyzer._extract_job_requirements(job)[:8]

    def build(self) -> Dict[str, Any]:
        ai_bank = self._build_from_ai()
        if ai_bank:
            return ai_bank

        categories = [
            self._build_technical_category(),
            self._build_behavioral_category(),
            self._build_situational_category(),
        ]

        # Remove categories that ended up empty (e.g., technical for non-technical roles)
        categories = [cat for cat in categories if cat["questions"]]

        bank = {
            "job_id": self.job.id,
            "job_title": self.job.title,
            "company_name": self.job.company_name,
            "industry": self.job.industry or "General",
            "generated_at": timezone.now().isoformat(),
            "difficulty_levels": [dl.__dict__ for dl in self.DIFFICULTY_LEVELS],
            "star_framework": self._star_guidance(),
            "categories": categories,
            "company_focus": self._company_focus_questions(),
            "skills_referenced": self._skills_reference_summary(),
            "source": "template",
        }
        return bank

    def _skills_reference_summary(self) -> List[Dict[str, Any]]:
        summary = []
        for idx, skill in enumerate(self.required_skills[:5]):
            summary.append(
                {
                    "skill_id": skill.get("skill_id"),
                    "name": skill.get("name"),
                    "category": skill.get("category", ""),
                    "importance_rank": idx + 1,
                }
            )
        return summary

    def _build_from_ai(self) -> Dict[str, Any] | None:
        api_key = getattr(settings, "GEMINI_API_KEY", "")
        if not api_key:
            return None

        model = getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")
        try:
            insights = InterviewInsightsGenerator.generate_for_job(
                job_title=self.job.title or "",
                company_name=self.job.company_name or "",
                api_key=api_key,
                model=model,
            )
        except Exception as exc:
            logger.warning("Gemini question bank generation failed: %s", exc)
            return None

        if insights.get("generated_by") != "ai":
            logger.info("Question bank generation fell back to template insights (generated_by=%s)", insights.get("generated_by"))
            return None

        categories = self._categories_from_ai(insights)
        if not categories:
            return None

        bank = {
            "job_id": self.job.id,
            "job_title": self.job.title,
            "company_name": self.job.company_name,
            "industry": self.job.industry or "General",
            "generated_at": timezone.now().isoformat(),
            "difficulty_levels": [dl.__dict__ for dl in self.DIFFICULTY_LEVELS],
            "star_framework": self._star_guidance(),
            "categories": categories,
            "company_focus": self._company_focus_from_ai(insights) or self._company_focus_questions(),
            "skills_referenced": self._skills_reference_summary(),
            "source": "ai",
        }

        bank["ai_context"] = {
            "process_overview": insights.get("process_overview", {}),
            "timeline": insights.get("timeline", {}),
            "generated_at": insights.get("generated_at"),
        }
        return bank

    def _categories_from_ai(self, insights: Dict[str, Any]) -> List[Dict[str, Any]]:
        categories: List[Dict[str, Any]] = []
        common_questions = insights.get("common_questions") or {}

        technical_prompts = common_questions.get("technical") or []
        if self.is_technical and technical_prompts:
            questions = self._ai_question_entries(technical_prompts, "technical")
            if questions:
                categories.append({
                    "id": "technical",
                    "label": "Technical",
                    "guidance": "Tailor answers to the company's stack, architecture, and metrics.",
                    "questions": questions,
                })

        behavioral_prompts = common_questions.get("behavioral") or []
        if behavioral_prompts:
            questions = self._ai_question_entries(behavioral_prompts, "behavioral", star_framework=True)
            if questions:
                categories.append({
                    "id": "behavioral",
                    "label": "Behavioral",
                    "guidance": "Use the STAR method and highlight measurable impact.",
                    "questions": questions,
                })

        situational_questions = self._ai_situational_questions(insights)
        if situational_questions:
            categories.append({
                "id": "situational",
                "label": "Situational",
                "guidance": "Outline discovery, alignment, execution, and measurement for each scenario.",
                "questions": situational_questions,
            })

        return categories

    def _ai_question_entries(self, prompts: List[str], category: str, star_framework: bool = False) -> List[Dict[str, Any]]:
        questions: List[Dict[str, Any]] = []
        for idx, prompt in enumerate(prompts):
            prompt_text = (prompt or "").strip()
            if not prompt_text:
                continue
            framework = self._behavioral_star_prompts() if star_framework else None
            skills = self._skills_for_question(idx)
            questions.append(
                self._question_entry(
                    base_prompt=prompt_text,
                    category=category,
                    difficulty=self._difficulty_from_index(idx),
                    skills=skills,
                    concepts=[self.job.company_name, self.job.title],
                    framework=framework,
                )
            )
        return questions

    def _ai_situational_questions(self, insights: Dict[str, Any]) -> List[Dict[str, Any]]:
        stages = (insights.get("process_overview") or {}).get("stages") or []
        questions: List[Dict[str, Any]] = []
        if not stages:
            return questions

        for idx, stage in enumerate(stages[:4]):
            stage_name = stage.get("name", f"Stage {idx + 1}")
            activities = stage.get("activities") or []
            activity_hint = activities[0] if activities else "navigate this stage"
            prompt = (
                f"{stage_name} at {self.job.company_name} typically involves {activity_hint}. "
                f"How would you structure your first 90 days to excel in this stage?"
            )
            questions.append(
                self._question_entry(
                    base_prompt=prompt,
                    category="situational",
                    difficulty=self._difficulty_from_index(idx),
                    skills=self._skills_for_question(idx, count=2),
                    concepts=[stage_name, activity_hint],
                )
            )
        return questions

    def _skills_for_question(self, index: int, count: int = 1) -> List[Dict[str, Any]]:
        if not self.required_skills:
            return []
        skills = []
        for offset in range(count):
            skill = self.required_skills[(index + offset) % len(self.required_skills)]
            skills.append({
                "skill_id": skill.get("skill_id"),
                "name": skill.get("name"),
                "category": skill.get("category", ""),
            })
        return skills

    def _difficulty_from_index(self, index: int) -> str:
        if not self.DIFFICULTY_LEVELS:
            return "mid"
        return self.DIFFICULTY_LEVELS[index % len(self.DIFFICULTY_LEVELS)].value

    def _build_technical_category(self) -> Dict[str, Any]:
        if not self.is_technical:
            return {"id": "technical", "label": "Technical", "questions": [], "guidance": ""}

        topics = self.INDUSTRY_TECH_TOPICS.get(self.industry_key, self.INDUSTRY_TECH_TOPICS["general"])
        questions: List[Dict[str, Any]] = []

        # Pair top required skills with industry topics
        for idx, skill in enumerate(self.required_skills[:4]):
            topic = topics[idx % len(topics)]
            questions.extend(
                [
                    self._question_entry(
                        base_prompt=f"Explain how you would apply {skill['name']} to improve {topic} at {self.job.company_name}.",
                        category="technical",
                        difficulty="mid",
                        skills=[skill],
                        concepts=[topic],
                    ),
                    self._question_entry(
                        base_prompt=f"Describe a senior-level decision you made involving {skill['name']} and how you balanced trade-offs affecting {topic}.",
                        category="technical",
                        difficulty="senior",
                        skills=[skill],
                        concepts=[topic, "trade-offs"],
                    ),
                ]
            )

        # Add at least one entry-level foundations question tied to the role
        foundational_topic = topics[0]
        questions.insert(
            0,
            self._question_entry(
                base_prompt=f"For a new teammate, how would you introduce the core principles of {self.role_type.title()} work while supporting {foundational_topic} goals?",
                category="technical",
                difficulty="entry",
                skills=self.required_skills[:1],
                concepts=[foundational_topic, "fundamentals"],
            ),
        )

        guidance = (
            "Highlight specific architectures, metrics, and tooling you have owned. "
            "Tie your examples back to the company's stack or constraints to show relevance."
        )
        return {"id": "technical", "label": "Technical", "guidance": guidance, "questions": questions}

    def _build_behavioral_category(self) -> Dict[str, Any]:
        prompts = [
            "Tell me about a time you had to rally a cross-functional team around an ambiguous goal.",
            "Describe a situation where you received critical feedback late in a project. What did you do?",
            "Share an example of how you navigated conflicting priorities between stakeholders.",
            "Talk about a time you identified a growth opportunity before others recognized it.",
        ]

        questions = []
        for idx, prompt in enumerate(prompts):
            linked_skill = self.required_skills[idx % len(self.required_skills)] if self.required_skills else None
            skills = [linked_skill] if linked_skill else []
            questions.append(
                self._question_entry(
                    base_prompt=prompt,
                    category="behavioral",
                    difficulty=self.DIFFICULTY_LEVELS[idx % len(self.DIFFICULTY_LEVELS)].value,
                    skills=skills,
                    framework=self._behavioral_star_prompts(),
                )
            )

        guidance = "Use the STAR method to structure every behavioral response. Lead with impact metrics when possible."
        return {"id": "behavioral", "label": "Behavioral", "guidance": guidance, "questions": questions}

    def _behavioral_star_prompts(self) -> Dict[str, Any]:
        return {
            "type": "STAR",
            "prompts": {
                "situation": "Set the stage with the challenge context.",
                "task": "Clarify your responsibility or ownership.",
                "action": "Explain the exact steps you took.",
                "result": "Quantify the outcome or learning.",
            },
        }

    def _build_situational_category(self) -> Dict[str, Any]:
        scenarios = self.SITUATIONAL_PROMPTS.get(self.industry_key, self.SITUATIONAL_PROMPTS.get("software", []))
        if not scenarios:
            scenarios = ["managing change during a critical initiative", "handling rapid scaling demands"]

        questions = []
        for idx, scenario in enumerate(scenarios[:3]):
            questions.append(
                self._question_entry(
                    base_prompt=f"If {self.job.company_name} faced {scenario}, how would you respond in your first 90 days?",
                    category="situational",
                    difficulty=["entry", "mid", "senior"][idx % 3],
                    skills=self.required_skills[idx : idx + 2],
                    concepts=[scenario],
                )
            )

        guidance = "Demonstrate structured thinking: outline discovery, alignment, execution, and measurement."
        return {"id": "situational", "label": "Situational", "guidance": guidance, "questions": questions}

    def _company_focus_from_ai(self, insights: Dict[str, Any]) -> List[Dict[str, str]]:
        prompts = insights.get("success_tips") or insights.get("preparation_recommendations") or []
        focus = []
        for idx, tip in enumerate(prompts[:4]):
            focus.append(
                {
                    "id": self._stable_id(f"ai_company_focus_{idx}"),
                    "prompt": f"Apply this success principle at {self.job.company_name}: {tip}",
                    "context": tip,
                }
            )
        return focus

    def _company_focus_questions(self) -> List[Dict[str, str]]:
        opportunities = []
        for idx, theme in enumerate(self.COMPANY_OPPORTUNITIES):
            opportunities.append(
                {
                    "id": self._stable_id(f"company_focus_{idx}_{theme}"),
                    "prompt": f"How would you help {self.job.company_name} {theme}?",
                    "context": theme,
                }
            )
        return opportunities

    def _question_entry(
        self,
        base_prompt: str,
        category: str,
        difficulty: str,
        skills: List[Dict[str, Any]] | None = None,
        concepts: List[str] | None = None,
        framework: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        question_id = self._stable_id(f"{category}:{base_prompt}")
        return {
            "id": question_id,
            "prompt": base_prompt.strip(),
            "category": category,
            "difficulty": difficulty,
            "skills": [
                {
                    "skill_id": skill.get("skill_id"),
                    "name": skill.get("name"),
                    "category": skill.get("category", ""),
                }
                for skill in (skills or [])
                if skill
            ],
            "concepts": concepts or [],
            "framework": framework,
            "practice_status": None,
        }

    def _star_guidance(self) -> Dict[str, Any]:
        return {
            "overview": "Structure behavioral answers with STAR to stay concise and highlight impact.",
            "steps": [
                {"id": "situation", "title": "Situation", "tip": "Set context with the role, company, and challenge."},
                {"id": "task", "title": "Task", "tip": "Clarify what you owned or were responsible for."},
                {"id": "action", "title": "Action", "tip": "Walk through specific steps or decisions you made."},
                {"id": "result", "title": "Result", "tip": "Close with quantifiable outcomes or learnings."},
            ],
        }

    def _stable_id(self, seed: str) -> str:
        digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()
        return digest[:16]


def build_question_bank(job, candidate_profile) -> Dict[str, Any]:
    """Convenience helper."""
    builder = QuestionBankBuilder(job, candidate_profile)
    return builder.build()
