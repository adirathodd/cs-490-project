"""
UC-068: Interview Insights and Preparation

This module provides AI-generated interview insights for companies/roles
using Gemini API to deliver personalized, company-specific guidance.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import logging
import json
import requests
import os

logger = logging.getLogger(__name__)


@dataclass
class StageTemplate:
    """Represents an interview stage with typical activities."""
    name: str
    duration: str
    description: str
    activities: List[str]


class InterviewInsightsGenerator:
    """Generates realistic interview insights based on role and company."""
    
    # Common interview stages by role type
    TECHNICAL_STAGES = [
        StageTemplate(
            name="Initial Screening",
            duration="30 minutes",
            description="Phone or video call with recruiter to discuss background and role fit",
            activities=[
                "Resume review and background discussion",
                "Overview of the role and company",
                "Basic technical background questions",
                "Availability and logistics discussion"
            ]
        ),
        StageTemplate(
            name="Technical Phone Screen",
            duration="45-60 minutes",
            description="Technical interview focusing on coding and problem-solving",
            activities=[
                "Data structures and algorithms questions",
                "Live coding exercise",
                "System design discussion (for senior roles)",
                "Questions about past projects"
            ]
        ),
        StageTemplate(
            name="On-site/Virtual On-site",
            duration="3-5 hours",
            description="Multiple rounds with different team members",
            activities=[
                "Advanced coding challenges",
                "System design interview",
                "Behavioral questions",
                "Team collaboration scenarios",
                "Cultural fit assessment"
            ]
        ),
        StageTemplate(
            name="Final Interview",
            duration="30-45 minutes",
            description="Discussion with hiring manager or leadership",
            activities=[
                "Role expectations and responsibilities",
                "Career goals alignment",
                "Questions about the team and projects",
                "Compensation discussion"
            ]
        )
    ]
    
    NON_TECHNICAL_STAGES = [
        StageTemplate(
            name="Initial Screening",
            duration="30 minutes",
            description="Phone call with recruiter to discuss background and fit",
            activities=[
                "Resume walkthrough",
                "Discussion of relevant experience",
                "Role overview and expectations",
                "Availability and next steps"
            ]
        ),
        StageTemplate(
            name="Hiring Manager Interview",
            duration="45-60 minutes",
            description="In-depth discussion with the hiring manager",
            activities=[
                "Detailed experience review",
                "Situational and behavioral questions",
                "Role-specific scenario discussions",
                "Team dynamics and culture"
            ]
        ),
        StageTemplate(
            name="Panel Interview",
            duration="1-2 hours",
            description="Meet with multiple team members",
            activities=[
                "Cross-functional collaboration scenarios",
                "Problem-solving exercises",
                "Presentation or case study (if applicable)",
                "Questions from various stakeholders"
            ]
        ),
        StageTemplate(
            name="Final Round",
            duration="30-45 minutes",
            description="Leadership interview and final assessment",
            activities=[
                "Strategic thinking discussion",
                "Long-term career goals",
                "Company vision alignment",
                "Offer discussion preparation"
            ]
        )
    ]
    
    # Common technical interview questions by role type
    TECHNICAL_QUESTIONS = {
        "software": [
            "Explain the difference between a stack and a queue",
            "How would you design a URL shortening service?",
            "What's your experience with [specific technology from job description]?",
            "Describe a challenging bug you've solved",
            "How do you approach code reviews?",
            "Explain your testing strategy",
            "Walk me through a system you designed from scratch"
        ],
        "data": [
            "Explain the difference between supervised and unsupervised learning",
            "How would you handle missing data in a dataset?",
            "Describe your experience with SQL optimization",
            "What's your approach to feature engineering?",
            "How do you validate model performance?",
            "Explain a data pipeline you've built",
            "What tools do you use for data visualization?"
        ],
        "product": [
            "How do you prioritize features?",
            "Describe a product you shipped from conception to launch",
            "How do you handle conflicting stakeholder requirements?",
            "What metrics would you track for [product type]?",
            "How do you gather user feedback?",
            "Describe a time you had to pivot a product strategy",
            "How do you work with engineering teams?"
        ]
    }
    
    BEHAVIORAL_QUESTIONS = [
        "Tell me about a time you faced a significant challenge at work",
        "Describe a situation where you had to work with a difficult team member",
        "How do you handle tight deadlines and competing priorities?",
        "Tell me about a project you're particularly proud of",
        "Describe a time you failed and what you learned",
        "How do you stay current with industry trends?",
        "What motivates you in your work?",
        "Where do you see yourself in 5 years?",
        "Why are you interested in this role?",
        "What's your approach to giving and receiving feedback?"
    ]
    
    @classmethod
    def _is_technical_role(cls, title: str) -> bool:
        """Determine if a role is technical based on title."""
        technical_keywords = [
            'engineer', 'developer', 'software', 'programmer',
            'data', 'scientist', 'analyst', 'ml', 'ai',
            'devops', 'sre', 'architect', 'qa', 'test'
        ]
        title_lower = title.lower()
        return any(keyword in title_lower for keyword in technical_keywords)
    
    @classmethod
    def _get_role_type(cls, title: str) -> str:
        """Categorize role for question selection."""
        title_lower = title.lower()
        if any(word in title_lower for word in ['data', 'scientist', 'analyst', 'ml', 'ai']):
            return 'data'
        elif any(word in title_lower for word in ['product', 'pm', 'manager']):
            return 'product'
        else:
            return 'software'
    
    @classmethod
    def _get_timeline(cls, is_technical: bool) -> Dict[str, str]:
        """Generate typical timeline for the interview process."""
        if is_technical:
            return {
                "total_duration": "2-4 weeks",
                "response_time": "1-2 weeks after application",
                "between_rounds": "3-7 days typically",
                "final_decision": "1-2 weeks after final interview"
            }
        else:
            return {
                "total_duration": "3-5 weeks",
                "response_time": "1-2 weeks after application",
                "between_rounds": "5-10 days typically",
                "final_decision": "1-2 weeks after final interview"
            }
    
    @classmethod
    def _get_preparation_tips(cls, is_technical: bool, role_type: str) -> List[str]:
        """Generate role-specific preparation recommendations."""
        tips = [
            "Research the company's products, services, and recent news",
            "Review the job description and match your experience to requirements",
            "Prepare questions to ask the interviewer about the role and team",
            "Practice the STAR method for behavioral questions",
            "Prepare examples of your past work and achievements",
            "Understand the company's culture and values",
            "Plan your outfit and test your technology setup (for virtual interviews)"
        ]
        
        if is_technical:
            tips.extend([
                "Practice coding problems on platforms like LeetCode or HackerRank",
                "Review data structures and algorithms fundamentals",
                "Be ready to explain your technical decisions and trade-offs",
                "Prepare to discuss system design and scalability",
                "Review the company's tech stack and relevant technologies"
            ])
            
            if role_type == 'data':
                tips.extend([
                    "Review statistics and probability concepts",
                    "Be prepared to discuss your approach to data analysis",
                    "Have examples of data visualization work ready",
                    "Understand common ML algorithms and their use cases"
                ])
        else:
            tips.extend([
                "Prepare case studies or examples of your strategic thinking",
                "Be ready to discuss your leadership and collaboration style",
                "Review industry trends and competitive landscape",
                "Prepare metrics and results from your previous roles"
            ])
        
        return tips
    
    @classmethod
    def _get_success_tips(cls) -> List[str]:
        """General success tips for interviews."""
        return [
            "Be authentic and genuine in your responses",
            "Show enthusiasm for the role and company",
            "Ask thoughtful questions throughout the process",
            "Follow up with a thank-you note after each interview",
            "Be specific with examples rather than speaking in generalities",
            "Demonstrate curiosity and willingness to learn",
            "Be honest about what you don't know",
            "Show how you've grown from past challenges",
            "Communicate clearly and concisely",
            "Maintain a positive attitude throughout the process"
        ]
    
    @classmethod
    def _get_preparation_checklist(cls, is_technical: bool) -> List[Dict[str, Any]]:
        """Generate an actionable preparation checklist."""
        checklist = [
            {
                "category": "Research",
                "items": [
                    {"task": "Review company website and mission", "completed": False},
                    {"task": "Read recent company news and press releases", "completed": False},
                    {"task": "Research the interviewer(s) on LinkedIn", "completed": False},
                    {"task": "Understand the company's products/services", "completed": False},
                    {"task": "Review company culture and values", "completed": False}
                ]
            },
            {
                "category": "Preparation",
                "items": [
                    {"task": "Review your resume and be ready to discuss each point", "completed": False},
                    {"task": "Prepare 3-5 STAR method examples", "completed": False},
                    {"task": "Prepare questions to ask the interviewer", "completed": False},
                    {"task": "Practice common behavioral questions", "completed": False},
                    {"task": "Review the job description thoroughly", "completed": False}
                ]
            }
        ]
        
        if is_technical:
            checklist.append({
                "category": "Technical Prep",
                "items": [
                    {"task": "Practice coding problems (arrays, strings, trees, graphs)", "completed": False},
                    {"task": "Review system design principles", "completed": False},
                    {"task": "Study the company's tech stack", "completed": False},
                    {"task": "Prepare to explain past technical projects", "completed": False},
                    {"task": "Practice whiteboarding or live coding", "completed": False}
                ]
            })
        
        checklist.append({
            "category": "Logistics",
            "items": [
                {"task": "Test video call technology and internet connection", "completed": False},
                {"task": "Prepare professional attire", "completed": False},
                {"task": "Plan your schedule and time zones", "completed": False},
                {"task": "Prepare a quiet interview space", "completed": False},
                {"task": "Have resume, notepad, and pen ready", "completed": False}
            ]
        })
        
        return checklist
    
    @classmethod
    def generate_with_ai(cls, job_title: str, company_name: str, api_key: str, model: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate company-specific interview insights using Gemini AI.
        
        Args:
            job_title: The title of the position
            company_name: The name of the company
            api_key: Gemini API key
            model: Optional model name (defaults to gemini-2.5-flash)
            
        Returns:
            Dictionary containing AI-generated interview insights
            
        Raises:
            Exception: If API call fails
        """
        if not api_key:
            raise ValueError("Gemini API key is required for AI generation")
        
        model = model or 'gemini-2.5-flash'
        
        # Build a detailed prompt for Gemini
        prompt = cls._build_ai_prompt(job_title, company_name)
        
        # Call Gemini API
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }],
            "generationConfig": {
                "temperature": 0.4,  # Lower temperature for more consistent JSON
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 8192,  # More tokens for comprehensive insights
                "responseMimeType": "application/json"
            }
        }
        
        try:
            service = get_or_create_service(SERVICE_GEMINI, 'Google Gemini AI')
            with track_api_call(service, endpoint=f'/models/{model}:generateContent', method='POST'):
                response = requests.post(url, json=payload, timeout=30)
                response.raise_for_status()
            
            result = response.json()
            
            # Extract the generated content
            if 'candidates' not in result or not result['candidates']:
                raise ValueError("No content generated by AI")
            
            content = result['candidates'][0]['content']['parts'][0]['text']
            
            # Clean the content - remove markdown code blocks if present
            content = content.strip()
            if content.startswith('```json'):
                content = content[7:]  # Remove ```json
            if content.startswith('```'):
                content = content[3:]  # Remove ```
            if content.endswith('```'):
                content = content[:-3]  # Remove trailing ```
            content = content.strip()
            
            # Log the raw content for debugging
            logger.debug(f"Raw AI response (first 500 chars): {content[:500]}")
            
            # Parse JSON response
            try:
                insights_data = json.loads(content)
            except json.JSONDecodeError as json_err:
                # Log the problematic content area
                logger.error(f"JSON parsing failed at position {json_err.pos}")
                if json_err.pos and len(content) > json_err.pos:
                    start = max(0, json_err.pos - 100)
                    end = min(len(content), json_err.pos + 100)
                    logger.error(f"Context around error: ...{content[start:end]}...")
                raise
            
            # Add metadata
            insights_data['has_data'] = True
            insights_data['job_title'] = job_title
            insights_data['company_name'] = company_name
            insights_data['generated_by'] = 'ai'
            
            return insights_data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Gemini API request failed: {e}")
            raise Exception(f"Failed to generate interview insights: {str(e)}")
        except (json.JSONDecodeError, KeyError, IndexError) as e:
            logger.error(f"Failed to parse AI response: {e}")
            raise Exception(f"Invalid response from AI service: {str(e)}")
    
    @classmethod
    def _build_ai_prompt(cls, job_title: str, company_name: str) -> str:
        """Build a structured prompt for Gemini to generate interview insights."""
        return f"""You are an expert career coach and interview preparation specialist. Generate comprehensive, realistic interview insights for the following position:

Job Title: {job_title}
Company: {company_name}

Provide detailed, company-specific interview preparation guidance in the following JSON structure. Research typical practices for this company and role type:

{{
  "process_overview": {{
    "total_stages": <number of typical interview stages>,
    "estimated_duration": "<e.g., '2-4 weeks'>",
    "stages": [
      {{
        "stage_number": 1,
        "name": "<stage name>",
        "duration": "<e.g., '30 minutes'>",
        "description": "<what happens in this stage>",
        "activities": ["<activity 1>", "<activity 2>", "..."]
      }}
      // Include 3-5 stages typical for this role/company
    ]
  }},
  "common_questions": {{
    "technical": [
      // 5-10 role-specific technical questions (empty array for non-technical roles)
    ],
    "behavioral": [
      // 8-12 behavioral questions relevant to this company culture
    ],
    "note": "These questions are based on typical interview patterns for {company_name} and similar companies."
  }},
  "preparation_recommendations": [
    // 10-15 specific, actionable preparation tips tailored to this role and company
  ],
  "timeline": {{
    "total_duration": "<typical end-to-end timeline>",
    "response_time": "<typical initial response time>",
    "between_rounds": "<typical time between interview rounds>",
    "final_decision": "<typical time to final decision>"
  }},
  "success_tips": [
    // 8-12 success tips based on what {company_name} values in candidates
  ],
  "preparation_checklist": [
    {{
      "category": "<category name>",
      "items": [
        {{"task": "<actionable task>", "completed": false}},
        // 4-6 items per category
      ]
    }}
    // Include 3-5 categories (Research, Technical Prep, Behavioral Prep, Logistics, etc.)
  ],
  "disclaimer": "This information is based on publicly available data, typical interview processes for {company_name}, and industry standards. Always refer to official communications from the company for the most accurate details."
}}

Important guidelines:
- Be specific to {company_name}'s known culture, values, and interview style
- For technical roles, include relevant technology stack questions
- Tailor behavioral questions to reflect the company's values (innovation, collaboration, customer focus, etc.)
- Make timeline estimates realistic based on company size and typical processes
- Include company-specific preparation tips (e.g., "Review {company_name}'s recent product launches", "Understand their mission: ...")
- Ensure all advice is professional, ethical, and publicly appropriate
- Do NOT include trailing commas in JSON arrays or objects
- Ensure all strings are properly escaped
- Use double quotes for all JSON strings

CRITICAL: Return ONLY valid JSON. No markdown code blocks, no explanatory text before or after, just pure JSON starting with {{ and ending with }}."""

    @classmethod
    def generate_for_job(cls, job_title: str, company_name: str, api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate comprehensive interview insights for a specific job.
        Tries AI generation first if API key provided, falls back to templates.
        
        Args:
            job_title: The title of the position
            company_name: The name of the company
            api_key: Optional Gemini API key for AI generation
            model: Optional model name
            
        Returns:
            Dictionary containing structured interview insights
        """
        # Try AI generation if API key is available and we're not running tests
        # (pytest may run on developer machines with API keys set; skip AI there to keep tests deterministic)
        if api_key and not os.getenv('PYTEST_CURRENT_TEST'):
            try:
                logger.info(f"Generating AI-powered interview insights for {job_title} at {company_name}")
                return cls.generate_with_ai(job_title, company_name, api_key, model)
            except Exception as e:
                logger.warning(f"AI generation failed, falling back to templates: {e}")
        
        # Fall back to template-based generation
        logger.info(f"Generating template-based interview insights for {job_title} at {company_name}")
        is_technical = cls._is_technical_role(job_title)
        role_type = cls._get_role_type(job_title)
        
        # Select appropriate interview stages
        stages = cls.TECHNICAL_STAGES if is_technical else cls.NON_TECHNICAL_STAGES
        
        # Build process overview
        process_overview = {
            "total_stages": len(stages),
            "estimated_duration": cls._get_timeline(is_technical)["total_duration"],
            "stages": [
                {
                    "stage_number": idx + 1,
                    "name": stage.name,
                    "duration": stage.duration,
                    "description": stage.description,
                    "activities": stage.activities
                }
                for idx, stage in enumerate(stages)
            ]
        }
        
        # Select relevant technical questions
        technical_questions = []
        if is_technical:
            technical_questions = cls.TECHNICAL_QUESTIONS.get(role_type, cls.TECHNICAL_QUESTIONS['software'])
        
        # Combine with behavioral questions
        common_questions = {
            "technical": technical_questions if is_technical else [],
            "behavioral": cls.BEHAVIORAL_QUESTIONS,
            "note": "These are common questions - actual questions may vary"
        }
        
        # Generate recommendations
        preparation_recommendations = cls._get_preparation_tips(is_technical, role_type)
        
        # Timeline
        timeline = cls._get_timeline(is_technical)
        
        # Success tips
        success_tips = cls._get_success_tips()
        
        # Checklist
        checklist = cls._get_preparation_checklist(is_technical)
        
        return {
            "has_data": True,
            "job_title": job_title,
            "company_name": company_name,
            "process_overview": process_overview,
            "common_questions": common_questions,
            "preparation_recommendations": preparation_recommendations,
            "timeline": timeline,
            "success_tips": success_tips,
            "preparation_checklist": checklist,
            "generated_by": "template",
            "disclaimer": "This information is based on typical interview processes and may not reflect the exact process at this company. Always refer to communications from the company for specific details."
        }
