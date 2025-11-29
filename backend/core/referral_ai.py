"""
AI-powered referral request generation and management service (UC-087).

This module provides intelligent referral request assistance including:
- Personalized referral request message generation
- Timing and etiquette guidance
- Relationship strength analysis
- Follow-up scheduling recommendations
"""

import logging
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from django.utils import timezone
from django.conf import settings

# OpenAI is optional — keep import lazy so missing package doesn't fail imports
openai = None
OPENAI_AVAILABLE = False

logger = logging.getLogger(__name__)


class ReferralRequestAI:
    """AI service for generating and optimizing referral requests"""
    
    def __init__(self):
        """Initialize the AI service with OpenAI configuration"""
        self.api_key = getattr(settings, 'OPENAI_API_KEY', None)

        # Try to import OpenAI lazily. Doing this here avoids raising
        # ModuleNotFoundError during module import when the package
        # isn't installed in lightweight/dev environments.
        global openai, OPENAI_AVAILABLE
        if not OPENAI_AVAILABLE and not openai:
            try:
                import importlib
                openai = importlib.import_module('openai')  # type: ignore
                OPENAI_AVAILABLE = True
            except Exception:
                openai = None
                OPENAI_AVAILABLE = False

        if self.api_key and OPENAI_AVAILABLE:
            try:
                openai.api_key = self.api_key
            except Exception:
                # If anything goes wrong setting the key, disable OpenAI usage
                OPENAI_AVAILABLE = False
    
    def generate_referral_request_message(
        self,
        job_title: str,
        company_name: str,
        referral_source_name: str,
        relationship_strength: str = 'moderate',
        referral_source_title: str = '',
        user_background: str = '',
        last_contact_date: Optional[datetime] = None,
        tone: str = 'professional',
        additional_context: str = ''
    ) -> Dict[str, str]:
        """
        Generate a personalized referral request message using AI.
        
        Args:
            job_title: The job position title
            company_name: The company name
            referral_source_name: Name of the person to ask for referral
            relationship_strength: How well you know the person (strong/moderate/weak/minimal)
            referral_source_title: The referral source's job title
            user_background: Brief summary of user's background/qualifications
            last_contact_date: When you last contacted this person
            tone: Message tone (professional, casual, warm)
            additional_context: Any additional context or requirements
        
        Returns:
            Dict with 'message', 'subject_line', and 'tone' keys
        """
        if not self.api_key:
            logger.warning("OpenAI API key not configured. Using fallback template.")
            return self._generate_fallback_message(
                job_title, company_name, referral_source_name, 
                relationship_strength, tone
            )
        
        try:
            # Build the prompt for AI generation
            prompt = self._build_referral_message_prompt(
                job_title=job_title,
                company_name=company_name,
                referral_source_name=referral_source_name,
                relationship_strength=relationship_strength,
                referral_source_title=referral_source_title,
                user_background=user_background,
                last_contact_date=last_contact_date,
                tone=tone,
                additional_context=additional_context
            )
            
            # Call OpenAI API
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert career coach specializing in professional networking and referral requests. Generate personalized, effective, and appropriately-toned referral request messages that respect relationships and maximize success probability."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=800
            )
            
            content = response.choices[0].message.content.strip()
            
            # Parse the response to extract message and subject
            message, subject = self._parse_ai_response(content)
            
            return {
                'message': message,
                'subject_line': subject,
                'tone': tone
            }
            
        except Exception as e:
            logger.error(f"Error generating AI referral message: {str(e)}")
            return self._generate_fallback_message(
                job_title, company_name, referral_source_name,
                relationship_strength, tone
            )
    
    def _build_referral_message_prompt(
        self,
        job_title: str,
        company_name: str,
        referral_source_name: str,
        relationship_strength: str,
        referral_source_title: str,
        user_background: str,
        last_contact_date: Optional[datetime],
        tone: str,
        additional_context: str
    ) -> str:
        """Build the prompt for AI message generation"""
        
        # Calculate time since last contact
        time_context = ""
        if last_contact_date:
            days_since = (timezone.now() - last_contact_date).days
            if days_since < 30:
                time_context = f"We spoke recently ({days_since} days ago)."
            elif days_since < 90:
                time_context = f"It's been a couple months ({days_since} days) since we last connected."
            else:
                time_context = f"It's been a while ({days_since} days) since we last connected."
        
        prompt = f"""Generate a referral request message with the following details:

**Job Information:**
- Position: {job_title}
- Company: {company_name}

**Referral Source:**
- Name: {referral_source_name}
- Title: {referral_source_title or 'Not specified'}
- Relationship Strength: {relationship_strength}
{f"- Last Contact: {time_context}" if time_context else ""}

**Message Requirements:**
- Tone: {tone}
- Background: {user_background or 'General professional background'}
{f"- Additional Context: {additional_context}" if additional_context else ""}

**Guidelines:**
1. Start with an appropriate greeting based on relationship strength
2. If there's been a gap in communication, acknowledge it naturally
3. Express genuine interest in the role and company
4. Make the ask clear but not demanding
5. Show appreciation for their time and consideration
6. Offer to provide any additional information they might need
7. Keep it concise (2-3 short paragraphs max)
8. End with a professional closing

**Output Format:**
SUBJECT: [Generate an appropriate email subject line]

MESSAGE:
[Generate the referral request message here]

Please generate the message now."""
        
        return prompt
    
    def _parse_ai_response(self, content: str) -> tuple:
        """Parse AI response to extract subject and message"""
        lines = content.strip().split('\n')
        subject = ""
        message_lines = []
        found_message = False
        
        for line in lines:
            if line.startswith('SUBJECT:'):
                subject = line.replace('SUBJECT:', '').strip()
            elif line.startswith('MESSAGE:'):
                found_message = True
            elif found_message:
                message_lines.append(line)
        
        message = '\n'.join(message_lines).strip()
        
        # If parsing failed, use the whole content as message
        if not message:
            message = content
            subject = f"Referral Request"
        
        return message, subject
    
    def _generate_fallback_message(
        self,
        job_title: str,
        company_name: str,
        referral_source_name: str,
        relationship_strength: str,
        tone: str
    ) -> Dict[str, str]:
        """Generate a fallback template when AI is not available"""
        
        greeting = self._get_greeting_by_relationship(relationship_strength, tone)
        
        message = f"""{greeting},

I hope this message finds you well. I'm reaching out because I recently came across an opportunity at {company_name} for a {job_title} position that aligns perfectly with my background and career goals.

I know you have connections at {company_name}, and I was wondering if you'd be comfortable providing a referral or introduction. I believe my skills and experience would be a strong fit for the role, and a referral from you would be incredibly valuable.

I completely understand if this isn't feasible, and I appreciate your consideration either way. I'd be happy to provide my resume or any additional information that might be helpful.

Thank you so much for your time!

Best regards"""
        
        subject = f"Referral Request for {job_title} at {company_name}"
        
        return {
            'message': message,
            'subject_line': subject,
            'tone': tone
        }
    
    def _get_greeting_by_relationship(self, strength: str, tone: str) -> str:
        """Get appropriate greeting based on relationship strength and tone"""
        if tone == 'casual' or strength == 'strong':
            return f"Hi {{name}}"
        else:
            return f"Hello {{name}}"
    
    def generate_timing_guidance(
        self,
        last_contact_date: Optional[datetime],
        relationship_strength: str,
        job_application_deadline: Optional[datetime] = None
    ) -> Dict[str, any]:
        """
        Generate guidance on optimal timing for referral request.
        
        Returns:
            Dict with 'optimal_date', 'guidance_text', and 'reasoning' keys
        """
        today = timezone.now().date()
        
        # Calculate suggested send date based on relationship and timing
        if not last_contact_date:
            # No previous contact info, suggest immediate action if strong relationship
            if relationship_strength == 'strong':
                suggested_date = today
                reasoning = "Since you have a strong relationship, you can reach out immediately."
            else:
                suggested_date = today + timedelta(days=1)
                reasoning = "Take a day to craft a thoughtful message for this professional contact."
        else:
            days_since_contact = (timezone.now().date() - last_contact_date.date()).days
            
            if days_since_contact < 7:
                suggested_date = today
                reasoning = "You've been in recent contact, so timing is ideal for this request."
            elif days_since_contact < 30:
                suggested_date = today
                reasoning = "Your recent communication makes this a good time to reach out."
            elif days_since_contact < 90:
                suggested_date = today + timedelta(days=1)
                reasoning = "It's been a little while. Consider a brief warm-up message before the ask, or proceed with a well-crafted direct request."
            else:
                suggested_date = today + timedelta(days=2)
                reasoning = "Given the time gap, consider re-establishing contact with a friendly message before making your request, or include a warm acknowledgment in your referral request."
        
        # Adjust for application deadline if provided
        if job_application_deadline:
            deadline_date = job_application_deadline.date() if isinstance(job_application_deadline, datetime) else job_application_deadline
            days_until_deadline = (deadline_date - today).days
            
            if days_until_deadline < 3:
                suggested_date = today
                reasoning = f"Application deadline is very soon ({days_until_deadline} days). Reach out immediately and mention the timeline."
            elif days_until_deadline < 7:
                suggested_date = min(suggested_date, today + timedelta(days=1))
                reasoning = f"With the application deadline approaching ({days_until_deadline} days), send your request soon to allow time for the referral process."
        
        # Generate comprehensive guidance text
        guidance_text = self._generate_timing_guidance_text(
            suggested_date, relationship_strength, last_contact_date
        )
        
        return {
            'optimal_date': suggested_date,
            'guidance_text': guidance_text,
            'reasoning': reasoning
        }
    
    def _generate_timing_guidance_text(
        self,
        suggested_date: datetime,
        relationship_strength: str,
        last_contact_date: Optional[datetime]
    ) -> str:
        """Generate detailed timing guidance text"""
        guidance = f"**Suggested Send Date:** {suggested_date.strftime('%B %d, %Y')}\n\n"
        
        guidance += "**Timing Considerations:**\n"
        
        if last_contact_date:
            days_since = (timezone.now().date() - last_contact_date.date()).days
            if days_since > 90:
                guidance += "- It's been a while since your last contact. Consider mentioning a shared memory or recent achievement to warm up the conversation.\n"
            elif days_since > 30:
                guidance += "- A moderate time gap exists. A brief acknowledgment of the gap can help make your request feel more natural.\n"
            else:
                guidance += "- Recent contact makes this an ideal time for your request.\n"
        
        if relationship_strength == 'minimal' or relationship_strength == 'weak':
            guidance += "- Given the relationship level, be especially respectful of their time and make your request as easy to fulfill as possible.\n"
            guidance += "- Consider offering something of value in return, even if just keeping them updated on the outcome.\n"
        
        guidance += "\n**Best Practices:**\n"
        guidance += "- Avoid weekends and Monday mornings if possible\n"
        guidance += "- Tuesday through Thursday, 10 AM - 2 PM is typically optimal\n"
        guidance += "- Be prepared to follow up if you don't hear back within 5-7 days\n"
        
        return guidance
    
    def generate_etiquette_guidance(
        self,
        relationship_strength: str,
        referral_source_title: str = '',
        referral_source_company: str = ''
    ) -> str:
        """
        Generate etiquette guidance for referral requests.
        
        Returns:
            String with comprehensive etiquette guidance
        """
        guidance = "**Referral Request Etiquette Guidelines:**\n\n"
        
        # General principles
        guidance += "**Core Principles:**\n"
        guidance += "- Make it easy for them to say yes (or no)\n"
        guidance += "- Provide all necessary information upfront\n"
        guidance += "- Express genuine appreciation for their consideration\n"
        guidance += "- Never pressure or create obligation\n"
        guidance += "- Follow up with gratitude regardless of outcome\n\n"
        
        # Relationship-specific guidance
        guidance += f"**For {relationship_strength.title()} Relationships:**\n"
        
        if relationship_strength == 'strong':
            guidance += "- You can be more direct with close connections\n"
            guidance += "- Still be professional and respectful of their position\n"
            guidance += "- Offer to provide any information they might need\n"
        elif relationship_strength == 'moderate':
            guidance += "- Strike a balance between warmth and formality\n"
            guidance += "- Acknowledge that you're asking for a favor\n"
            guidance += "- Make it clear there's no obligation\n"
        else:  # weak or minimal
            guidance += "- Be especially formal and respectful\n"
            guidance += "- Consider whether a referral request is appropriate at this stage\n"
            guidance += "- Might be better to first re-establish connection without the ask\n"
            guidance += "- If proceeding, be extra clear that you understand this is a significant favor\n"
        
        guidance += "\n**What to Include:**\n"
        guidance += "✓ Why you're interested in the company/role\n"
        guidance += "✓ Brief summary of relevant qualifications\n"
        guidance += "✓ Your resume or LinkedIn profile\n"
        guidance += "✓ Specific role/job posting link if available\n"
        guidance += "✓ How you know them and context for the relationship\n\n"
        
        guidance += "**What to Avoid:**\n"
        guidance += "✗ Generic or copy-paste messages\n"
        guidance += "✗ Demanding or entitled tone\n"
        guidance += "✗ Multiple requests too close together\n"
        guidance += "✗ Asking for referrals to multiple companies in same message\n"
        guidance += "✗ Forgetting to follow up with gratitude and outcomes\n\n"
        
        guidance += "**After the Request:**\n"
        guidance += "- Respect their decision either way\n"
        guidance += "- Thank them for considering your request\n"
        guidance += "- Keep them updated on your progress\n"
        guidance += "- Express gratitude if you get an interview or offer\n"
        guidance += "- Look for ways to reciprocate or pay it forward\n"
        
        return guidance
    
    def analyze_relationship_health(
        self,
        relationship_strength: str,
        last_interaction_date: Optional[datetime],
        previous_referral_requests: int = 0,
        referrals_provided_to_them: int = 0
    ) -> Dict[str, any]:
        """
        Analyze the health of the relationship for referral requests.
        
        Returns:
            Dict with 'health_score', 'assessment', and 'recommendations' keys
        """
        health_score = 50  # Start at neutral
        issues = []
        recommendations = []
        
        # Factor in relationship strength
        strength_scores = {
            'strong': 30,
            'moderate': 15,
            'weak': 0,
            'minimal': -10
        }
        health_score += strength_scores.get(relationship_strength, 0)
        
        # Factor in recency of contact
        if last_interaction_date:
            days_since = (timezone.now() - last_interaction_date).days
            if days_since < 30:
                health_score += 20
            elif days_since < 90:
                health_score += 10
            elif days_since < 180:
                health_score += 0
            else:
                health_score -= 10
                issues.append(f"No contact in {days_since} days")
                recommendations.append("Consider re-establishing contact before making request")
        
        # Factor in reciprocity
        if previous_referral_requests > 0 and referrals_provided_to_them == 0:
            health_score -= (previous_referral_requests * 5)
            issues.append(f"Asked for {previous_referral_requests} referral(s) without reciprocation")
            recommendations.append("Look for opportunities to provide value or assistance")
        elif referrals_provided_to_them > 0:
            health_score += (referrals_provided_to_them * 10)
        
        # Request frequency check
        if previous_referral_requests > 2:
            issues.append("Multiple previous referral requests")
            recommendations.append("Be especially mindful of request frequency")
        
        # Clamp health score
        health_score = max(0, min(100, health_score))
        
        # Generate assessment
        if health_score >= 80:
            assessment = "Excellent - Strong relationship with good request timing"
        elif health_score >= 60:
            assessment = "Good - Relationship is healthy for a referral request"
        elif health_score >= 40:
            assessment = "Fair - Consider strengthening relationship first"
        else:
            assessment = "Poor - Recommend building relationship before requesting referral"
        
        return {
            'health_score': health_score,
            'assessment': assessment,
            'issues': issues,
            'recommendations': recommendations
        }
    
    def suggest_follow_up_timing(
        self,
        request_sent_date: datetime,
        relationship_strength: str,
        status: str = 'sent'
    ) -> Dict[str, any]:
        """
        Suggest optimal follow-up timing after sending a referral request.
        
        Returns:
            Dict with 'follow_up_date', 'guidance', and 'message_template' keys
        """
        today = timezone.now().date()
        days_since_sent = (today - request_sent_date.date()).days
        
        # Determine base follow-up window based on relationship
        if relationship_strength == 'strong':
            base_days = 5
        elif relationship_strength == 'moderate':
            base_days = 7
        else:  # weak or minimal
            base_days = 10
        
        follow_up_date = request_sent_date.date() + timedelta(days=base_days)
        
        # Adjust if already past due
        if days_since_sent > base_days:
            follow_up_date = today + timedelta(days=1)
            guidance = f"Your request was sent {days_since_sent} days ago. A polite follow-up is appropriate now."
        else:
            days_until_follow_up = (follow_up_date - today).days
            guidance = f"Wait approximately {days_until_follow_up} more day(s) before following up to give them time to respond."
        
        # Generate follow-up message template
        message_template = self._generate_follow_up_template(relationship_strength, days_since_sent)
        
        return {
            'follow_up_date': follow_up_date,
            'guidance': guidance,
            'message_template': message_template,
            'days_since_sent': days_since_sent
        }
    
    def _generate_follow_up_template(self, relationship_strength: str, days_since: int) -> str:
        """Generate a follow-up message template"""
        
        if relationship_strength == 'strong':
            greeting = "Hi {name}"
        else:
            greeting = "Hello {name}"
        
        template = f"""{greeting},

I wanted to follow up on my previous message about the {{job_title}} position at {{company_name}}. I completely understand you're busy, so no worries if you haven't had a chance to look into this yet.

If you're able to provide a referral or introduction, I'd be incredibly grateful. If not, I completely understand and appreciate your consideration.

Thank you again for your time!

Best regards"""
        
        return template
    
    def generate_gratitude_message(
        self,
        referral_source_name: str,
        job_title: str,
        company_name: str,
        outcome: str = 'referral_given',
        relationship_strength: str = 'moderate'
    ) -> str:
        """
        Generate a gratitude/thank you message.
        
        Args:
            referral_source_name: Name of the person who helped
            job_title: The job position
            company_name: The company
            outcome: Type of outcome (referral_given, interview_received, offer_received, declined)
            relationship_strength: Relationship level
        
        Returns:
            Thank you message text
        """
        
        if relationship_strength == 'strong':
            greeting = f"Hi {referral_source_name}"
        else:
            greeting = f"Dear {referral_source_name}"
        
        if outcome == 'referral_given':
            main_text = f"I wanted to take a moment to sincerely thank you for providing a referral for the {job_title} position at {company_name}. Your support means a great deal to me, and I'm very grateful for your willingness to put in a good word on my behalf."
        elif outcome == 'interview_received':
            main_text = f"I'm thrilled to share that I've been invited to interview for the {job_title} position at {company_name}! I wanted to thank you again for your referral - I truly believe it made a significant difference in my application being noticed."
        elif outcome == 'offer_received':
            main_text = f"I'm excited to let you know that I received an offer for the {job_title} position at {company_name}! Your referral was instrumental in this success, and I cannot thank you enough for your support and belief in my abilities."
        elif outcome == 'declined':
            main_text = f"I wanted to thank you for considering my referral request for the {job_title} position at {company_name}. I completely understand your decision and appreciate you taking the time to respond. Your honesty and consideration mean a lot."
        else:
            main_text = f"Thank you so much for your help with the {job_title} opportunity at {company_name}."
        
        closing = "\n\nIf there's ever anything I can do to return the favor, please don't hesitate to reach out. I'd be happy to help in any way I can.\n\nThanks again!\n\nBest regards"
        
        return f"{greeting},\n\n{main_text}{closing}"
