"""
UC-126: Interview Response Library utilities.

Provides logic for managing a user's library of prepared interview responses,
including gap analysis, response suggestions based on job requirements, and
export functionality.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Tuple
from collections import defaultdict, Counter

from django.conf import settings
from django.db.models import Q, Count, Avg
from django.utils import timezone

from core.models import InterviewResponseLibrary, ResponseVersion, JobEntry
from core import resume_ai

logger = logging.getLogger(__name__)


class ResponseLibraryAnalyzer:
    """Analyze response library for gaps and provide recommendations."""
    
    COMMON_BEHAVIORAL_TOPICS = [
        'leadership', 'teamwork', 'conflict resolution', 'problem solving',
        'communication', 'time management', 'adaptability', 'decision making',
        'goal setting', 'failure/learning', 'influence/persuasion', 'innovation'
    ]
    
    COMMON_TECHNICAL_TOPICS = [
        'system design', 'debugging', 'code review', 'architecture decisions',
        'performance optimization', 'testing', 'deployment', 'mentoring'
    ]
    
    COMMON_SITUATIONAL_TOPICS = [
        'tight deadline', 'resource constraints', 'ambiguous requirements',
        'stakeholder conflict', 'technical debt', 'team disagreement'
    ]
    
    @classmethod
    def analyze_gaps(cls, user) -> Dict[str, Any]:
        """Identify gaps in the user's response library."""
        responses = InterviewResponseLibrary.objects.filter(user=user)
        
        # Count by question type
        type_counts = responses.values('question_type').annotate(count=Count('id'))
        type_distribution = {item['question_type']: item['count'] for item in type_counts}
        
        # Analyze tags/topics coverage
        all_tags = []
        for response in responses:
            all_tags.extend(response.tags or [])
        
        tag_counts = Counter(all_tags)
        
        # Identify missing topics
        covered_topics = set(tag.lower() for tag in all_tags)
        
        behavioral_gaps = [
            topic for topic in cls.COMMON_BEHAVIORAL_TOPICS 
            if not any(topic in covered for covered in covered_topics)
        ]
        
        technical_gaps = [
            topic for topic in cls.COMMON_TECHNICAL_TOPICS 
            if not any(topic in covered for covered in covered_topics)
        ]
        
        situational_gaps = [
            topic for topic in cls.COMMON_SITUATIONAL_TOPICS 
            if not any(topic in covered for covered in covered_topics)
        ]
        
        # Calculate coverage percentages
        behavioral_coverage = (
            (len(cls.COMMON_BEHAVIORAL_TOPICS) - len(behavioral_gaps)) / 
            len(cls.COMMON_BEHAVIORAL_TOPICS) * 100
        ) if cls.COMMON_BEHAVIORAL_TOPICS else 0
        
        technical_coverage = (
            (len(cls.COMMON_TECHNICAL_TOPICS) - len(technical_gaps)) / 
            len(cls.COMMON_TECHNICAL_TOPICS) * 100
        ) if cls.COMMON_TECHNICAL_TOPICS else 0
        
        situational_coverage = (
            (len(cls.COMMON_SITUATIONAL_TOPICS) - len(situational_gaps)) / 
            len(cls.COMMON_SITUATIONAL_TOPICS) * 100
        ) if cls.COMMON_SITUATIONAL_TOPICS else 0
        
        return {
            'total_responses': responses.count(),
            'by_type': {
                'behavioral': type_distribution.get('behavioral', 0),
                'technical': type_distribution.get('technical', 0),
                'situational': type_distribution.get('situational', 0),
            },
            'coverage': {
                'behavioral': round(behavioral_coverage, 1),
                'technical': round(technical_coverage, 1),
                'situational': round(situational_coverage, 1),
            },
            'gaps': {
                'behavioral': behavioral_gaps[:5],  # Top 5 gaps
                'technical': technical_gaps[:5],
                'situational': situational_gaps[:5],
            },
            'top_tags': [tag for tag, _ in tag_counts.most_common(10)],
            'recommendations': cls._build_gap_recommendations(
                behavioral_gaps, technical_gaps, situational_gaps, type_distribution
            )
        }
    
    @classmethod
    def _build_gap_recommendations(
        cls, 
        behavioral_gaps: List[str],
        technical_gaps: List[str],
        situational_gaps: List[str],
        type_distribution: Dict[str, int]
    ) -> List[Dict[str, str]]:
        """Generate actionable recommendations to fill gaps."""
        recommendations = []
        
        # Check for type imbalance
        total = sum(type_distribution.values())
        if total > 0:
            behavioral_pct = type_distribution.get('behavioral', 0) / total * 100
            technical_pct = type_distribution.get('technical', 0) / total * 100
            situational_pct = type_distribution.get('situational', 0) / total * 100
            
            if behavioral_pct < 40:
                recommendations.append({
                    'priority': 'high',
                    'category': 'Question Type Balance',
                    'recommendation': 'Add more behavioral responses. Most interviews heavily feature behavioral questions.',
                    'action': 'Prepare 3-5 STAR method responses covering leadership, teamwork, and problem-solving.'
                })
            
            if technical_pct < 20 and type_distribution.get('technical', 0) < 3:
                recommendations.append({
                    'priority': 'medium',
                    'category': 'Question Type Balance',
                    'recommendation': 'Prepare technical responses for roles requiring technical depth.',
                    'action': 'Add responses about system design, debugging, and technical decision-making.'
                })
        
        # Specific topic gaps
        if behavioral_gaps:
            top_gaps = behavioral_gaps[:3]
            recommendations.append({
                'priority': 'high',
                'category': 'Behavioral Topics',
                'recommendation': f'Missing responses for common behavioral topics: {", ".join(top_gaps)}',
                'action': f'Prepare STAR responses demonstrating {top_gaps[0]} and {top_gaps[1] if len(top_gaps) > 1 else "related skills"}.'
            })
        
        if technical_gaps and len(technical_gaps) > 3:
            recommendations.append({
                'priority': 'medium',
                'category': 'Technical Topics',
                'recommendation': 'Limited technical topic coverage.',
                'action': f'Prepare examples of {technical_gaps[0]}, {technical_gaps[1]}, and {technical_gaps[2]}.'
            })
        
        if not recommendations:
            recommendations.append({
                'priority': 'low',
                'category': 'Library Health',
                'recommendation': 'Your response library has good coverage!',
                'action': 'Continue refining existing responses and tracking their success rates.'
            })
        
        return recommendations


class ResponseSuggestionEngine:
    """Suggest best responses for interview questions based on job requirements."""
    
    @classmethod
    def suggest_responses_for_job(
        cls, 
        job: JobEntry, 
        question_text: str = None,
        question_type: str = None,
        limit: int = 5
    ) -> List[Tuple[InterviewResponseLibrary, float]]:
        """
        Find the best matching responses for a job's requirements.
        
        Returns list of (response, score) tuples sorted by relevance.
        """
        user = job.candidate.user
        responses = InterviewResponseLibrary.objects.filter(user=user)
        
        # Filter by question type if specified
        if question_type:
            responses = responses.filter(question_type=question_type)
        
        # Get job requirements
        job_skills = cls._extract_job_skills(job)
        job_keywords = cls._extract_job_keywords(job)
        
        # Score each response
        scored_responses = []
        for response in responses:
            score = cls._calculate_match_score(
                response, job_skills, job_keywords, question_text
            )
            scored_responses.append((response, score))
        
        # Sort by score and return top matches
        scored_responses.sort(key=lambda x: x[1], reverse=True)
        return scored_responses[:limit]
    
    @classmethod
    def _extract_job_skills(cls, job: JobEntry) -> List[str]:
        """Extract key skills from job description."""
        skills = []
        
        # From job title
        if job.title:
            skills.extend(job.title.lower().split())
        
        # From description
        if job.description:
            desc_lower = job.description.lower()
            # Common skill indicators
            skill_keywords = [
                'python', 'javascript', 'react', 'node', 'django', 'sql',
                'aws', 'azure', 'docker', 'kubernetes', 'leadership', 'management',
                'agile', 'scrum', 'communication', 'teamwork', 'problem solving'
            ]
            skills.extend([kw for kw in skill_keywords if kw in desc_lower])
        
        # From requirements
        if hasattr(job, 'requirements') and job.requirements:
            for req in job.requirements.all():
                if req.skill_name:
                    skills.append(req.skill_name.lower())
        
        return list(set(skills))  # Remove duplicates
    
    @classmethod
    def _extract_job_keywords(cls, job: JobEntry) -> List[str]:
        """Extract important keywords from job description."""
        keywords = []
        
        if job.description:
            # Simple keyword extraction - could be enhanced with NLP
            words = job.description.lower().split()
            # Filter out common words
            stopwords = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'}
            keywords = [w.strip('.,!?;:') for w in words if w not in stopwords and len(w) > 3]
        
        return keywords[:50]  # Limit to top 50
    
    @classmethod
    def _calculate_match_score(
        cls,
        response: InterviewResponseLibrary,
        job_skills: List[str],
        job_keywords: List[str],
        question_text: str = None
    ) -> float:
        """Calculate how well a response matches the job requirements."""
        score = 0.0
        
        # Base score from success metrics
        if response.led_to_offer:
            score += 30
        elif response.led_to_next_round:
            score += 20
        
        # Success rate contribution
        score += response.success_rate * 0.2  # Up to 20 points
        
        # Usage frequency (popular responses get a boost)
        score += min(response.times_used * 2, 10)  # Up to 10 points
        
        # Skill matching
        response_skills = [s.lower() for s in (response.skills or [])]
        matching_skills = set(response_skills) & set(job_skills)
        score += len(matching_skills) * 5  # 5 points per matching skill
        
        # Tag matching
        response_tags = [t.lower() for t in (response.tags or [])]
        matching_tags = set(response_tags) & set(job_skills + job_keywords)
        score += len(matching_tags) * 3  # 3 points per matching tag
        
        # Question text similarity (if provided)
        if question_text:
            question_lower = question_text.lower()
            response_question_lower = response.question_text.lower()
            
            # Simple word overlap
            q_words = set(question_lower.split())
            r_words = set(response_question_lower.split())
            overlap = len(q_words & r_words)
            score += min(overlap * 2, 15)  # Up to 15 points for question similarity
        
        # Recency bonus (more recent responses are slightly preferred)
        if response.updated_at:
            from django.utils import timezone
            days_old = (timezone.now() - response.updated_at).days
            if days_old < 30:
                score += 5
            elif days_old < 90:
                score += 2
        
        return score


class ResponseLibraryExporter:
    """Export response library as formatted interview prep guide."""
    
    @classmethod
    def export_as_text(cls, user, question_type: str = None) -> str:
        """Export responses as formatted text document."""
        responses = InterviewResponseLibrary.objects.filter(user=user)
        
        if question_type:
            responses = responses.filter(question_type=question_type)
        
        responses = responses.order_by('question_type', '-success_rate')
        
        output = []
        output.append("=" * 80)
        output.append("INTERVIEW RESPONSE LIBRARY")
        output.append("=" * 80)
        output.append("")
        
        # Group by type
        by_type = defaultdict(list)
        for response in responses:
            by_type[response.question_type].append(response)
        
        for qtype in ['behavioral', 'technical', 'situational']:
            if qtype in by_type:
                output.append("")
                output.append(f"{qtype.upper()} QUESTIONS")
                output.append("-" * 80)
                output.append("")
                
                for response in by_type[qtype]:
                    output.append(f"Question: {response.question_text}")
                    output.append("")
                    
                    if response.skills:
                        output.append(f"Skills: {', '.join(response.skills)}")
                    if response.tags:
                        output.append(f"Tags: {', '.join(response.tags)}")
                    
                    output.append(f"Success Rate: {response.success_rate:.1f}% ({response.times_used} uses)")
                    if response.led_to_offer:
                        output.append("✓ Led to offer")
                    elif response.led_to_next_round:
                        output.append("✓ Led to next round")
                    
                    output.append("")
                    output.append("Response:")
                    output.append(response.current_response_text)
                    output.append("")
                    
                    # STAR breakdown if available
                    star = response.current_star_response
                    if star and any(star.values()):
                        output.append("STAR Framework:")
                        if star.get('situation'):
                            output.append(f"  Situation: {star['situation']}")
                        if star.get('task'):
                            output.append(f"  Task: {star['task']}")
                        if star.get('action'):
                            output.append(f"  Action: {star['action']}")
                        if star.get('result'):
                            output.append(f"  Result: {star['result']}")
                        output.append("")
                    
                    output.append("-" * 80)
                    output.append("")
        
        return "\n".join(output)
    
    @classmethod
    def export_as_json(cls, user, question_type: str = None) -> str:
        """Export responses as JSON for programmatic use."""
        responses = InterviewResponseLibrary.objects.filter(user=user)
        
        if question_type:
            responses = responses.filter(question_type=question_type)
        
        data = {
            'export_date': timezone.now().isoformat(),
            'total_responses': responses.count(),
            'responses': []
        }
        
        for response in responses:
            data['responses'].append({
                'id': response.id,
                'question_text': response.question_text,
                'question_type': response.question_type,
                'response_text': response.current_response_text,
                'star_response': response.current_star_response,
                'skills': response.skills,
                'tags': response.tags,
                'experiences': response.experiences,
                'companies_used_for': response.companies_used_for,
                'success_metrics': {
                    'times_used': response.times_used,
                    'success_rate': response.success_rate,
                    'led_to_offer': response.led_to_offer,
                    'led_to_next_round': response.led_to_next_round,
                },
                'created_at': response.created_at.isoformat() if response.created_at else None,
                'updated_at': response.updated_at.isoformat() if response.updated_at else None,
            })
        
        return json.dumps(data, indent=2)
