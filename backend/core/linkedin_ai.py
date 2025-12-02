"""
UC-089: AI-powered LinkedIn profile optimization and networking guidance
Provides AI-generated suggestions for LinkedIn profiles and networking messages
"""
import logging
from typing import Dict, List, Optional
from django.conf import settings

try:
    from google import genai
except ImportError:
    genai = None

logger = logging.getLogger(__name__)


class LinkedInAI:
    """AI service for LinkedIn profile optimization and networking"""
    
    def __init__(self):
        """Initialize the AI service with Gemini configuration"""
        self.api_key = getattr(settings, 'GEMINI_API_KEY', None)
        self.model = getattr(settings, 'GEMINI_MODEL', 'gemini-2.0-flash-exp')
        
        logger.info(f"LinkedInAI initializing - API key present: {bool(self.api_key)}, Model: {self.model}, genai available: {bool(genai)}")
        
        self.client = genai.Client(api_key=self.api_key) if (self.api_key and genai) else None
        
        if not self.client:
            logger.warning("Gemini client not initialized - missing API key or genai module")
    
    def generate_profile_optimization_suggestions(
        self,
        current_headline: str = '',
        current_summary: str = '',
        target_roles: List[str] = None,
        skills: List[str] = None
    ) -> Dict[str, any]:
        """
        Generate LinkedIn profile optimization suggestions
        
        Args:
            current_headline: User's current LinkedIn headline
            current_summary: User's current profile summary
            target_roles: List of job titles user is targeting
            skills: List of user's key skills
        
        Returns:
            Dict with suggestions and metadata
        """
        if not self.client:
            logger.info("Gemini not configured, using fallback suggestions")
            return self._fallback_profile_suggestions()
        
        target_roles_str = ', '.join(target_roles) if target_roles else 'Not specified'
        skills_str = ', '.join(skills[:10]) if skills else 'Not specified'
        
        prompt = f"""Analyze this LinkedIn profile and provide optimization suggestions:

**Current Headline:** {current_headline or 'Not set'}
**Current Summary:** {current_summary or 'Not set'}
**Target Roles:** {target_roles_str}
**Key Skills:** {skills_str}

Provide:
1. **Headline Optimization**: 3-5 specific alternative headlines that are compelling and keyword-rich
2. **Summary Improvements**: Specific suggestions for structure, keywords, and impact
3. **Keyword Recommendations**: Key terms to include for target roles
4. **Profile Completeness Checklist**: Key sections to focus on
5. **Visibility & SEO Best Practices**: Tips to improve profile discoverability

Format as structured, actionable advice with clear sections."""

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config={
                    'temperature': 0.7,
                    'max_output_tokens': 1500
                }
            )
            
            # Extract text from response robustly
            content = getattr(response, 'text', None) or getattr(response, 'output_text', None)
            if not content:
                candidates = getattr(response, 'candidates', None) or []
                if candidates:
                    try:
                        first_part = candidates[0].content.parts[0]
                        content = getattr(first_part, 'text', '') or str(first_part)
                    except (IndexError, AttributeError, TypeError) as e:
                        logger.error(f"Error extracting from candidates: {e}")
                        content = ''
            
            if not content:
                logger.error("No content in Gemini response for profile optimization")
                return self._fallback_profile_suggestions()
            
            logger.info(f"Gemini API success - generated {len(content)} characters")
            
            return {
                'suggestions': content,
                'generated_by': 'ai',
                'model': self.model
            }
        except Exception as e:
            logger.error(f"Gemini API error in profile optimization: {e}")
            logger.exception("Full Gemini error traceback:")
            return self._fallback_profile_suggestions()
    
    def generate_networking_message(
        self,
        recipient_name: str,
        recipient_title: str = '',
        company_name: str = '',
        connection_context: str = '',
        purpose: str = 'connection_request',
        tone: str = 'professional'
    ) -> Dict[str, str]:
        """
        Generate LinkedIn networking message templates
        
        Args:
            recipient_name: Name of the person to connect with
            recipient_title: Their job title
            company_name: Their company
            connection_context: How you know them or common interests
            purpose: Message purpose (connection_request, informational_interview, etc.)
            tone: Desired tone (professional, casual, warm)
        
        Returns:
            Dict with message, character_count, and metadata
        """
        if not self.client:
            logger.info("Gemini not configured, using fallback message")
            return self._fallback_networking_message(recipient_name, purpose)
        
        purpose_guidance = {
            'connection_request': 'a connection request to expand professional network',
            'informational_interview': 'requesting an informational interview to learn about their role',
            'job_inquiry': 'inquiring about potential job opportunities at their company',
            'referral_request': 'requesting a referral for a specific position',
            'follow_up': 'following up after a networking event or previous interaction'
        }
        
        purpose_desc = purpose_guidance.get(purpose, purpose)
        
        # Build prompt with only non-empty fields
        prompt_parts = [f"Generate a LinkedIn message for {purpose_desc}.\n"]
        
        # Add recipient details
        recipient_info = f"**Recipient:** {recipient_name}"
        if recipient_title:
            recipient_info += f", {recipient_title}"
        if company_name:
            recipient_info += f" at {company_name}"
        prompt_parts.append(recipient_info)
        
        # Add context if provided
        if connection_context:
            prompt_parts.append(f"**Context/Connection:** {connection_context}")
        
        prompt_parts.append(f"**Desired Tone:** {tone}")
        
        # Add detailed requirements
        prompt_parts.append("""
**Requirements:**
- Keep under 300 characters for connection requests, 500 for InMail
- Use the recipient's specific details (name, title, company) in the message
- Reference the provided context to make it personal and relevant
- Avoid generic phrases like "I came across your profile" or "your background is impressive"
- Include a specific, actionable call-to-action relevant to the purpose
- Match the specified tone throughout
- Be authentic and conversational, not templated

Generate ONLY the message text - no subject line, no additional commentary, no quotes around the message.""")
        
        prompt = "\n".join(prompt_parts)
        
        logger.info(f"Generating networking message with prompt length: {len(prompt)} chars")
        logger.debug(f"Prompt: {prompt}")

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config={
                    'temperature': 0.9,
                    'max_output_tokens': 200
                }
            )
            
            # Extract text from response robustly (same method as mock_interview.py)
            message = getattr(response, 'text', None) or getattr(response, 'output_text', None)
            
            logger.debug(f"Response.text value: {message}")
            logger.debug(f"Response has candidates: {hasattr(response, 'candidates')}")
            
            if not message:
                candidates = getattr(response, 'candidates', None) or []
                logger.debug(f"Number of candidates: {len(candidates)}")
                
                if candidates:
                    try:
                        logger.debug(f"First candidate: {candidates[0]}")
                        logger.debug(f"Candidate content: {candidates[0].content if hasattr(candidates[0], 'content') else 'N/A'}")
                        
                        first_part = candidates[0].content.parts[0]
                        logger.debug(f"First part: {first_part}")
                        logger.debug(f"First part type: {type(first_part)}")
                        
                        message = getattr(first_part, 'text', '') or str(first_part)
                        logger.debug(f"Extracted message from parts: {message[:100] if message else 'empty'}")
                    except (IndexError, AttributeError, TypeError) as e:
                        logger.error(f"Error extracting from candidates: {e}")
                        logger.exception("Candidate extraction error:")
                        message = ''
            
            if not message:
                logger.error("No content in Gemini response")
                return self._fallback_networking_message(recipient_name, purpose)
            
            message = message.strip()
            logger.info(f"Generated message successfully: {len(message)} chars")
            
            return {
                'message': message,
                'character_count': len(message),
                'purpose': purpose,
                'tone': tone,
                'generated_by': 'ai'
            }
        except Exception as e:
            logger.error(f"Gemini API error in networking message: {e}")
            logger.exception("Full traceback:")
            return self._fallback_networking_message(recipient_name, purpose)
    
    def generate_content_strategy(
        self,
        industry: str = '',
        career_goals: str = '',
        expertise_areas: List[str] = None
    ) -> Dict[str, any]:
        """
        Generate LinkedIn content sharing strategy
        
        Args:
            industry: User's industry
            career_goals: User's career aspirations
            expertise_areas: Areas of expertise to share about
        
        Returns:
            Dict with strategy content and key tips
        """
        expertise_str = ', '.join(expertise_areas[:5]) if expertise_areas else 'various professional topics'
        
        content = f"""**LinkedIn Content Strategy**

**Posting Frequency:**
- Aim for 2-3 posts per week for consistent visibility
- Quality over quantity - focus on valuable insights
- Consistency matters more than volume

**Content Mix (40/30/20/10 Rule):**
- 40% Industry insights and trends
- 30% Personal experiences and lessons learned
- 20% Engagement with others' content (thoughtful comments)
- 10% Company/project updates and achievements

**Optimal Posting Times:**
- Tuesday-Thursday typically see highest engagement
- Post during business hours (8 AM - 5 PM local time)
- Early morning (7-9 AM) or lunch time (12-1 PM) often work well

**Best Practices:**
- Use 3-5 relevant hashtags per post
- Include visuals (images, infographics) when possible
- Ask questions to encourage discussion
- Share authentic stories and perspectives
- Keep posts concise and scannable

**Content Ideas for Your Expertise:**"""

        if expertise_areas:
            content += f"\n- Share insights on: {expertise_str}"
        
        content += """
- Career lessons and professional development tips
- Industry trends and analysis you've observed
- Project highlights and key achievements
- Book/article recommendations with your takeaways
- Professional challenges and how you overcame them
- Tips and best practices in your field

**Engagement Strategy:**
- Respond to comments within 2 hours of posting
- Thank people for sharing and engaging with your content
- Build genuine relationships, not just connections
- Support others in your network by commenting on their posts
- Join relevant LinkedIn groups and participate actively

**Measuring Success:**
- Track engagement rates (likes, comments, shares)
- Monitor profile views after posting
- Note which content types resonate most
- Adjust strategy based on what works for your audience"""

        key_tips = [
            'Be authentic and share your unique perspective',
            'Engage consistently with your network',
            'Provide value, don\'t just self-promote',
            'Use storytelling to make content memorable',
            'Stay consistent with your posting schedule'
        ]
        
        if industry:
            key_tips.append(f'Focus on {industry} industry insights')
        
        return {
            'strategy': content,
            'key_tips': key_tips,
            'recommended_frequency': '2-3 posts per week',
            'engagement_goal': 'Build authentic professional relationships'
        }
    
    def _fallback_profile_suggestions(self) -> Dict[str, any]:
        """Fallback suggestions when AI is unavailable"""
        return {
            'suggestions': """**LinkedIn Profile Optimization Checklist**

**Headline Best Practices:**
- Include your current role and key value proposition
- Use keywords relevant to your target positions
- Make it specific and results-focused
- Example: "Software Engineer | Full-Stack Developer | Building Scalable Web Applications"

**Summary/About Section:**
- Start with a compelling hook about who you are
- Highlight 3-5 key achievements with metrics
- Include relevant keywords naturally throughout
- Show personality and authentic voice
- End with a call-to-action (how to reach you)
- Keep it 3-5 short paragraphs for readability

**Profile Completeness Priorities:**
✓ Professional photo (increases profile views by 21x)
✓ Compelling headline with keywords
✓ Detailed work experience with accomplishments
✓ Skills section (minimum 5, ideally 10+ skills)
✓ Recommendations from colleagues and managers
✓ Education and relevant certifications
✓ Custom LinkedIn URL
✓ Featured section with portfolio work

**Keyword Optimization:**
- Research job descriptions for target roles
- Identify common required skills and terms
- Incorporate keywords in headline, summary, and experience
- Use industry-standard job titles
- Include technical skills and soft skills

**SEO Best Practices:**
- Keep your profile public for maximum visibility
- Use location information accurately
- Add relevant skills endorsed by connections
- Engage regularly (post, comment, share)
- Join and participate in relevant groups
- Use hashtags strategically in posts

**Content Activity:**
- Post 2-3 times per week on industry topics
- Share insights and lessons learned
- Engage with others' content meaningfully
- Celebrate team and professional wins""",
            'generated_by': 'fallback',
            'model': 'template'
        }
    
    def _fallback_networking_message(self, recipient_name: str, purpose: str) -> Dict[str, str]:
        """Fallback networking message template"""
        templates = {
            'connection_request': f"Hi {recipient_name}, I'd love to connect and learn more about your work. I'm interested in expanding my professional network and believe we could benefit from staying connected.",
            
            'informational_interview': f"Hi {recipient_name}, I came across your profile and was impressed by your experience. I'm exploring career paths in this field and would greatly appreciate the opportunity to learn from your insights. Would you be open to a brief conversation?",
            
            'job_inquiry': f"Hi {recipient_name}, I'm very interested in opportunities at your company and admire the work you're doing. I'd appreciate any insights you could share about the team, culture, and potential openings. Thank you for considering connecting!",
            
            'referral_request': f"Hi {recipient_name}, I hope this message finds you well. I'm reaching out because I'm very interested in a position at your company and believe my skills would be a strong fit. Would you be comfortable providing a referral or introduction?",
            
            'follow_up': f"Hi {recipient_name}, it was great connecting with you recently. I wanted to follow up and continue our conversation. I'd love to stay in touch and explore ways we might collaborate or support each other professionally."
        }
        
        message = templates.get(purpose, f"Hi {recipient_name}, I'd like to connect with you professionally and learn more about your experience.")
        
        return {
            'message': message,
            'character_count': len(message),
            'purpose': purpose,
            'tone': 'professional',
            'generated_by': 'fallback'
        }
