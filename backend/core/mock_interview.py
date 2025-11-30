# backend/core/mock_interview.py
"""
UC-077: Mock Interview Practice Sessions
AI-powered mock interview generator and coaching using Gemini AI
"""

try:
    from google import genai
except ImportError:  # pragma: no cover - library installed at runtime
    genai = None

from django.conf import settings
from typing import List, Dict, Any
import json
import re


class MockInterviewGenerator:
    """Generate tailored mock interview questions using Gemini AI."""
    
    def __init__(self):
        """Initialize generator without creating client yet."""
        self._client = None
    
    @property
    def client(self):
        """Lazy initialization of Gemini AI client."""
        if self._client is None:
            if genai is None:
                raise ValueError("google-genai package is not installed")
            if not settings.GEMINI_API_KEY:
                raise ValueError("API key must be set when using the Google AI API.")
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client
    
    def generate_questions(
        self,
        interview_type: str,
        difficulty_level: str,
        focus_areas: List[str],
        job_title: str = None,
        job_description: str = None,
        count: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Generate mock interview questions tailored to user's needs.
        
        Args:
            interview_type: 'behavioral', 'technical', 'case_study', or 'mixed'
            difficulty_level: 'entry', 'mid', 'senior', or 'executive'
            focus_areas: List of skills/topics to focus on
            job_title: Optional specific job title
            job_description: Optional job description for context
            count: Number of questions to generate
        
        Returns:
            List of question dictionaries with text, category, framework, and ideal points
        """
        
        # Build comprehensive prompt
        prompt = self._build_question_generation_prompt(
            interview_type=interview_type,
            difficulty_level=difficulty_level,
            focus_areas=focus_areas,
            job_title=job_title,
            job_description=job_description,
            count=count
        )
        
        try:
            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt
            )
            
            # Extract text from response
            content = getattr(response, 'text', None) or getattr(response, 'output_text', None)
            if not content:
                candidates = getattr(response, 'candidates', None) or []
                if candidates:
                    try:
                        first_part = candidates[0].content.parts[0]
                        content = getattr(first_part, 'text', '') or str(first_part)
                    except (IndexError, AttributeError, TypeError):
                        content = ''
            
            if not content:
                raise ValueError("No content in Gemini response")
            
            questions = self._parse_questions_response(content)
            
            # Ensure we have the right number of questions
            if len(questions) < count:
                questions.extend(self._get_fallback_questions(
                    interview_type, 
                    count - len(questions)
                ))
            
            return questions[:count]
        
        except Exception as e:
            print(f"Error generating questions with Gemini: {e}")
            return self._get_fallback_questions(interview_type, count)
    
    def _build_question_generation_prompt(
        self,
        interview_type: str,
        difficulty_level: str,
        focus_areas: List[str],
        job_title: str,
        job_description: str,
        count: int
    ) -> str:
        """Build detailed prompt for Gemini AI."""
        
        focus_context = f"Focus on these areas: {', '.join(focus_areas)}" if focus_areas else ""
        job_context = f"Job Title: {job_title}\n" if job_title else ""
        if job_description:
            job_context += f"Job Description: {job_description[:500]}...\n"
        
        prompt = f"""You are an expert interview coach. Generate {count} {interview_type} interview questions for a {difficulty_level} level candidate.

{job_context}
{focus_context}

For each question, provide:
1. The interview question
2. Category (e.g., leadership, problem-solving, technical skills, teamwork)
3. Suggested framework (STAR, CAR, or specific technical approach)
4. 3-5 ideal answer points that a strong candidate should cover

Format your response as a JSON array with this structure:
[
  {{
    "question": "Tell me about a time when...",
    "category": "conflict resolution",
    "framework": "STAR",
    "ideal_points": [
      "Clearly described the situation and conflict",
      "Explained their specific role and actions",
      "Demonstrated empathy and communication skills",
      "Described positive outcome and lessons learned"
    ]
  }}
]

Make questions realistic, relevant to the level, and specific to the focus areas.
Ensure variety in categories and question types.
Return ONLY the JSON array, no additional text."""
        
        return prompt
    
    def _parse_questions_response(self, response_text: str) -> List[Dict[str, Any]]:
        """Parse Gemini's JSON response into question dictionaries."""
        try:
            # Clean up response - remove markdown code blocks if present
            cleaned = response_text.strip()
            if cleaned.startswith('```'):
                cleaned = re.sub(r'^```(?:json)?\s*\n', '', cleaned)
                cleaned = re.sub(r'\n```\s*$', '', cleaned)
            
            questions = json.loads(cleaned)
            
            # Validate structure
            validated_questions = []
            for q in questions:
                if isinstance(q, dict) and 'question' in q:
                    validated_questions.append({
                        'question': q.get('question', ''),
                        'category': q.get('category', 'general'),
                        'framework': q.get('framework', 'STAR'),
                        'ideal_points': q.get('ideal_points', [])
                    })
            
            return validated_questions
        
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON response: {e}")
            return []
    
    def _get_fallback_questions(self, interview_type: str, count: int) -> List[Dict[str, Any]]:
        """Provide fallback questions if AI generation fails."""
        
        fallback_behavioral = [
            {
                "question": "Tell me about a time when you had to overcome a significant challenge at work.",
                "category": "problem-solving",
                "framework": "STAR",
                "ideal_points": [
                    "Clearly described the challenging situation",
                    "Explained specific actions taken",
                    "Demonstrated persistence and adaptability",
                    "Quantified the positive result"
                ]
            },
            {
                "question": "Describe a situation where you had to work with a difficult team member.",
                "category": "teamwork",
                "framework": "STAR",
                "ideal_points": [
                    "Maintained professionalism",
                    "Demonstrated empathy and communication",
                    "Found common ground or solution",
                    "Reflected on lessons learned"
                ]
            },
            {
                "question": "Give an example of when you had to meet a tight deadline.",
                "category": "time management",
                "framework": "STAR",
                "ideal_points": [
                    "Prioritized tasks effectively",
                    "Communicated proactively with stakeholders",
                    "Demonstrated focus and efficiency",
                    "Met or exceeded expectations"
                ]
            },
            {
                "question": "Tell me about a time you had to learn something new quickly.",
                "category": "adaptability",
                "framework": "STAR",
                "ideal_points": [
                    "Identified resources and learning strategy",
                    "Demonstrated initiative and self-direction",
                    "Applied new knowledge effectively",
                    "Shared insights with others"
                ]
            },
            {
                "question": "Describe a situation where you demonstrated leadership.",
                "category": "leadership",
                "framework": "STAR",
                "ideal_points": [
                    "Took initiative without being asked",
                    "Motivated and guided others",
                    "Made difficult decisions",
                    "Achieved measurable results"
                ]
            }
        ]
        
        fallback_technical = [
            {
                "question": "Walk me through how you would design a scalable system for [specific use case].",
                "category": "system design",
                "framework": "structured approach",
                "ideal_points": [
                    "Clarified requirements and constraints",
                    "Proposed high-level architecture",
                    "Addressed scalability concerns",
                    "Discussed trade-offs"
                ]
            },
            {
                "question": "Explain the difference between [concept A] and [concept B] and when you'd use each.",
                "category": "technical knowledge",
                "framework": "compare and contrast",
                "ideal_points": [
                    "Accurate technical definitions",
                    "Clear distinctions",
                    "Real-world use cases",
                    "Performance implications"
                ]
            },
            {
                "question": "How would you debug a performance issue in a production system?",
                "category": "troubleshooting",
                "framework": "systematic approach",
                "ideal_points": [
                    "Monitoring and metrics review",
                    "Hypothesis-driven investigation",
                    "Root cause analysis",
                    "Prevention strategies"
                ]
            }
        ]
        
        questions = fallback_behavioral if interview_type == 'behavioral' else fallback_technical
        return questions[:count]


class MockInterviewCoach:
    """Provide AI-powered coaching and feedback on interview responses."""
    
    def __init__(self):
        """Initialize coach without creating client yet."""
        self._client = None
    
    @property
    def client(self):
        """Lazy initialization of Gemini AI client."""
        if self._client is None:
            if genai is None:
                raise ValueError("google-genai package is not installed")
            if not settings.GEMINI_API_KEY:
                raise ValueError("API key must be set when using the Google AI API.")
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client
    
    def evaluate_answer(
        self,
        question: str,
        answer: str,
        ideal_points: List[str],
        framework: str = "STAR",
        category: str = None
    ) -> Dict[str, Any]:
        """
        Evaluate a candidate's answer and provide detailed feedback.
        
        Args:
            question: The interview question
            answer: Candidate's response
            ideal_points: Key points that should be covered
            framework: Expected framework (STAR, CAR, etc.)
            category: Question category for context
        
        Returns:
            Dictionary with score, feedback, strengths, and improvements
        """
        
        prompt = self._build_evaluation_prompt(
            question=question,
            answer=answer,
            ideal_points=ideal_points,
            framework=framework,
            category=category
        )
        
        try:
            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt
            )
            
            # Extract text from response
            content = getattr(response, 'text', None) or getattr(response, 'output_text', None)
            if not content:
                candidates = getattr(response, 'candidates', None) or []
                if candidates:
                    try:
                        first_part = candidates[0].content.parts[0]
                        content = getattr(first_part, 'text', '') or str(first_part)
                    except (IndexError, AttributeError, TypeError):
                        content = ''
            
            if not content:
                raise ValueError("No content in Gemini response")
            
            evaluation = self._parse_evaluation_response(content)
            
            # Calculate keyword coverage
            coverage = self._calculate_keyword_coverage(answer, ideal_points)
            evaluation['keyword_coverage'] = coverage
            
            return evaluation
        
        except Exception as e:
            print(f"Error evaluating answer with Gemini: {e}")
            return self._get_fallback_evaluation(answer, ideal_points)
    
    def generate_session_summary(
        self,
        questions_and_answers: List[Dict[str, Any]],
        overall_score: float,
        interview_type: str
    ) -> Dict[str, Any]:
        """
        Generate comprehensive summary after mock interview session.
        
        Args:
            questions_and_answers: List of Q&A with evaluations
            overall_score: Calculated average score
            interview_type: Type of interview conducted
        
        Returns:
            Summary dictionary with assessment, recommendations, and next steps
        """
        
        prompt = self._build_summary_prompt(
            questions_and_answers=questions_and_answers,
            overall_score=overall_score,
            interview_type=interview_type
        )
        
        try:
            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt
            )
            
            # Extract text from response
            content = getattr(response, 'text', None) or getattr(response, 'output_text', None)
            if not content:
                candidates = getattr(response, 'candidates', None) or []
                if candidates:
                    try:
                        first_part = candidates[0].content.parts[0]
                        content = getattr(first_part, 'text', '') or str(first_part)
                    except (IndexError, AttributeError, TypeError):
                        content = ''
            
            if not content:
                raise ValueError("No content in Gemini response")
            
            summary = self._parse_summary_response(content)
            
            # Determine readiness level
            summary['readiness_level'] = self._determine_readiness(overall_score)
            summary['estimated_interview_readiness'] = int(overall_score)
            
            return summary
        
        except Exception as e:
            print(f"Error generating summary with Gemini: {e}")
            return self._get_fallback_summary(overall_score)
    
    def _build_evaluation_prompt(
        self,
        question: str,
        answer: str,
        ideal_points: List[str],
        framework: str,
        category: str
    ) -> str:
        """Build prompt for answer evaluation."""
        
        ideal_points_text = "\n".join(f"- {point}" for point in ideal_points)
        category_context = f"Category: {category}\n" if category else ""
        
        prompt = f"""You are an expert interview coach evaluating a candidate's response.

Question: {question}
{category_context}
Expected Framework: {framework}

Ideal answer should cover:
{ideal_points_text}

Candidate's Answer:
{answer}

Evaluate this response and provide:
1. Overall score (0-100)
2. Specific strengths (what they did well)
3. Areas for improvement (what could be better)
4. Detailed constructive feedback

Format as JSON:
{{
  "score": 85,
  "strengths": ["Used STAR framework effectively", "Provided specific examples"],
  "improvements": ["Could quantify results more", "Add more detail about team dynamics"],
  "feedback": "Your response demonstrated strong use of the STAR framework..."
}}

Be constructive and specific. Return ONLY the JSON, no additional text."""
        
        return prompt
    
    def _build_summary_prompt(
        self,
        questions_and_answers: List[Dict[str, Any]],
        overall_score: float,
        interview_type: str
    ) -> str:
        """Build prompt for session summary generation."""
        
        qa_summary = []
        for i, qa in enumerate(questions_and_answers[:5], 1):  # Limit to first 5 for context
            qa_summary.append(f"Q{i}: {qa.get('question', 'N/A')}")
            qa_summary.append(f"Score: {qa.get('score', 0)}/100")
            qa_summary.append(f"Feedback: {qa.get('feedback', 'N/A')[:100]}...")
            qa_summary.append("")
        
        qa_text = "\n".join(qa_summary)
        
        prompt = f"""You are an expert interview coach providing a comprehensive summary after a mock {interview_type} interview.

Overall Performance Score: {overall_score}/100

Question Performance Summary:
{qa_text}

Provide a comprehensive assessment including:
1. Top 3-5 strengths across all responses
2. Top 3-5 critical areas needing improvement
3. Recommended practice topics (specific skills or scenarios)
4. 3-5 concrete next steps for preparation
5. Overall assessment (2-3 paragraphs)

Format as JSON:
{{
  "top_strengths": ["Consistent use of STAR framework", "Strong technical knowledge"],
  "critical_areas": ["Need more quantifiable results", "Improve brevity"],
  "recommended_practice_topics": ["Conflict resolution scenarios", "Technical system design"],
  "next_steps": ["Practice 5 more behavioral questions", "Review STAR examples"],
  "overall_assessment": "You demonstrated strong foundational skills...",
  "improvement_trend": "improving"
}}

Be encouraging yet honest. Return ONLY the JSON, no additional text."""
        
        return prompt
    
    def _parse_evaluation_response(self, response_text: str) -> Dict[str, Any]:
        """Parse evaluation JSON from Gemini response."""
        try:
            cleaned = response_text.strip()
            if cleaned.startswith('```'):
                cleaned = re.sub(r'^```(?:json)?\s*\n', '', cleaned)
                cleaned = re.sub(r'\n```\s*$', '', cleaned)
            
            evaluation = json.loads(cleaned)
            
            return {
                'score': float(evaluation.get('score', 0)),
                'strengths': evaluation.get('strengths', []),
                'improvements': evaluation.get('improvements', []),
                'feedback': evaluation.get('feedback', '')
            }
        
        except json.JSONDecodeError as e:
            print(f"Failed to parse evaluation JSON: {e}")
            return {'score': 0, 'strengths': [], 'improvements': [], 'feedback': ''}
    
    def _parse_summary_response(self, response_text: str) -> Dict[str, Any]:
        """Parse summary JSON from Gemini response."""
        try:
            cleaned = response_text.strip()
            if cleaned.startswith('```'):
                cleaned = re.sub(r'^```(?:json)?\s*\n', '', cleaned)
                cleaned = re.sub(r'\n```\s*$', '', cleaned)
            
            summary = json.loads(cleaned)
            
            return {
                'top_strengths': summary.get('top_strengths', []),
                'critical_areas': summary.get('critical_areas', []),
                'recommended_practice_topics': summary.get('recommended_practice_topics', []),
                'next_steps': summary.get('next_steps', []),
                'overall_assessment': summary.get('overall_assessment', ''),
                'improvement_trend': summary.get('improvement_trend', 'stable')
            }
        
        except json.JSONDecodeError as e:
            print(f"Failed to parse summary JSON: {e}")
            return {}
    
    def _calculate_keyword_coverage(self, answer: str, ideal_points: List[str]) -> Dict[str, bool]:
        """Calculate which ideal points were covered in the answer."""
        answer_lower = answer.lower()
        coverage = {}
        
        for point in ideal_points:
            # Extract key terms from the ideal point
            key_terms = [word.lower() for word in point.split() if len(word) > 4]
            # Check if any key terms appear in answer
            covered = any(term in answer_lower for term in key_terms)
            coverage[point] = covered
        
        return coverage
    
    def _determine_readiness(self, score: float) -> str:
        """Determine readiness level based on score."""
        if score >= 85:
            return 'ready'
        elif score >= 70:
            return 'nearly_ready'
        elif score >= 50:
            return 'needs_practice'
        else:
            return 'not_ready'
    
    def _get_fallback_evaluation(self, answer: str, ideal_points: List[str]) -> Dict[str, Any]:
        """Provide basic evaluation if AI fails."""
        word_count = len(answer.split())
        coverage = self._calculate_keyword_coverage(answer, ideal_points)
        coverage_ratio = sum(coverage.values()) / len(coverage) if coverage else 0
        
        # Simple scoring based on length and keyword coverage
        score = min(100, (word_count / 100 * 50) + (coverage_ratio * 50))
        
        return {
            'score': round(score, 2),
            'strengths': ['Provided a response'],
            'improvements': ['Add more specific details', 'Use structured framework'],
            'feedback': 'Consider using the STAR framework for a more structured response.',
            'keyword_coverage': coverage
        }
    
    def _get_fallback_summary(self, overall_score: float) -> Dict[str, Any]:
        """Provide basic summary if AI fails."""
        return {
            'top_strengths': ['Completed the mock interview'],
            'critical_areas': ['Continue practicing responses', 'Use structured frameworks'],
            'recommended_practice_topics': ['Behavioral scenarios', 'STAR method'],
            'next_steps': ['Review responses', 'Practice with more questions'],
            'overall_assessment': f'You completed the interview with a score of {overall_score}/100. Keep practicing!',
            'improvement_trend': 'stable',
            'readiness_level': self._determine_readiness(overall_score),
            'estimated_interview_readiness': int(overall_score)
        }
