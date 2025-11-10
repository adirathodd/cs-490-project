"""
Job Matching Engine for UC-065

Provides comprehensive job matching analysis with scoring across multiple dimensions:
skills, experience, education. Builds on the existing Skills Gap Analysis system.
"""
import logging
from typing import Dict, List, Optional
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date

from core.skills_gap_analysis import SkillsGapAnalyzer

logger = logging.getLogger(__name__)


class JobMatchingEngine:
    """Core job matching engine with multi-dimensional scoring."""
    
    # Default scoring weights
    DEFAULT_WEIGHTS = {
        'skills': Decimal('0.50'),     # 50% - Skills matching
        'experience': Decimal('0.30'), # 30% - Experience relevance  
        'education': Decimal('0.20')   # 20% - Education alignment
    }
    
    @classmethod
    def calculate_match_score(
        cls, 
        job, 
        candidate_profile, 
        user_weights: Optional[Dict] = None
    ) -> Dict:
        """
        Calculate comprehensive match score for a job and candidate.
        
        Args:
            job: JobEntry instance
            candidate_profile: CandidateProfile instance
            user_weights: Custom scoring weights (optional)
            
        Returns:
            Dictionary with match analysis results
        """
        weights = cls._normalize_weights(user_weights or cls.DEFAULT_WEIGHTS)
        
        # Calculate component scores
        skills_score = cls.calculate_skills_score(job, candidate_profile)
        experience_score = cls.calculate_experience_score(job, candidate_profile)
        education_score = cls.calculate_education_score(job, candidate_profile)
        
        # Calculate weighted overall score
        overall_score = (
            skills_score * weights['skills'] +
            experience_score * weights['experience'] + 
            education_score * weights['education']
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Generate detailed breakdown
        breakdown = cls._generate_match_breakdown(job, candidate_profile)
        
        return {
            'overall_score': float(overall_score),
            'skills_score': float(skills_score),
            'experience_score': float(experience_score),
            'education_score': float(education_score),
            'breakdown': breakdown,
            'generated_at': datetime.now().isoformat()
        }
    
    @classmethod
    def calculate_skills_score(cls, job, candidate_profile) -> Decimal:
        """
        Calculate skills match score (0-100) using existing Skills Gap Analysis.
        
        Uses the same SkillsGapAnalyzer to ensure consistency with Skills Gap Analysis.
        """
        try:
            # Get skills gap analysis - this is the same data shown in Skills Gap Analysis
            analysis = SkillsGapAnalyzer.analyze_job(job, candidate_profile)
            skills_data = analysis.get('skills', [])
            summary = analysis.get('summary', {})
            
            if not skills_data:
                return Decimal('40')  # Base score when no skills detected
            
            # Use the exact same counts as Skills Gap Analysis
            total_skills = summary.get('total_skills_required', len(skills_data))
            matched_skills = summary.get('total_skills_matched', 0)
            missing_skills = summary.get('total_skills_missing', 0)
            
            if total_skills == 0:
                return Decimal('40')  # Base score when no skills detected
            
            # Calculate match percentage based on the same data as Skills Gap Analysis
            # This ensures consistency: if Skills Gap shows "2 out of 8 skills", 
            # the match score will reflect that same ratio
            match_ratio = Decimal(str(matched_skills)) / Decimal(str(total_skills))
            
            # Calculate detailed score based on individual skill quality
            total_score = Decimal('0')
            for skill in skills_data:
                gap_severity = skill.get('gap_severity', 100)
                candidate_level = skill.get('candidate_level')
                
                if candidate_level is None:
                    # Missing skill - contributes 0
                    skill_score = Decimal('0')
                elif gap_severity <= 20:
                    # Strong match (very small gap)
                    skill_score = Decimal('90')
                elif gap_severity <= 40:
                    # Good match
                    skill_score = Decimal('75')
                elif gap_severity <= 60:
                    # Partial match
                    skill_score = Decimal('60')
                elif gap_severity <= 80:
                    # Weak match
                    skill_score = Decimal('40')
                else:
                    # Very weak match but candidate has some level
                    skill_score = Decimal('20') if candidate_level else Decimal('0')
                
                total_score += skill_score
            
            # Calculate quality-weighted average
            quality_score = total_score / total_skills if total_skills > 0 else Decimal('0')
            
            # Combine ratio-based and quality-based scoring
            # 60% weight on actual match ratio, 40% on skill quality
            ratio_component = match_ratio * Decimal('100') * Decimal('0.6')
            quality_component = quality_score * Decimal('0.4')
            
            final_score = ratio_component + quality_component
            
            # Apply bonuses for good distributions (same as before)
            strong_matches = sum(1 for s in skills_data if s.get('gap_severity', 100) <= 20 and s.get('candidate_level'))
            strong_ratio = strong_matches / total_skills if total_skills > 0 else 0
            missing_ratio = missing_skills / total_skills if total_skills > 0 else 0
            
            # Bonus for high quality matches
            if strong_ratio > 0.5:
                final_score *= Decimal('1.15')  # 15% bonus
            elif strong_ratio > 0.3:
                final_score *= Decimal('1.1')   # 10% bonus
            elif match_ratio > 0.6:
                final_score *= Decimal('1.05')  # 5% bonus
            
            # Penalty only for excessive missing skills
            if missing_ratio > 0.7:
                final_score *= Decimal('0.85')  # 15% penalty
            elif missing_ratio > 0.5:
                final_score *= Decimal('0.95')  # 5% penalty
            
            return min(Decimal('100'), max(Decimal('0'), final_score))
            
        except Exception as e:
            logger.error(f"Error calculating skills score: {e}")
            return Decimal('40')  # More reasonable default than 0
    
    @classmethod
    def calculate_experience_score(cls, job, candidate_profile) -> Decimal:
        """
        Calculate experience match score (0-100) based on job level:
        - Internship positions: Experience not weighted (return high base score)
        - Senior positions: Experience weighted higher with stricter requirements
        - Regular positions: Experience weighted normally, with generous scoring for any experience
        """
        try:
            from core.models import WorkExperience
            
            # Analyze job title for level indicators
            job_title_lower = job.title.lower()
            job_text = f"{job.title} {job.description or ''}".lower()
            
            is_internship = any(keyword in job_text for keyword in ['intern', 'internship'])
            is_senior = any(keyword in job_title_lower for keyword in ['senior', 'lead', 'principal', 'staff', 'architect'])
            
            # Get candidate's work experience
            experiences = WorkExperience.objects.filter(
                candidate=candidate_profile
            ).order_by('-start_date')
            
            # Handle internship positions - experience not weighted
            if is_internship:
                return Decimal('90')  # High score since experience doesn't matter for internships
            
            # Check if candidate has any experience
            has_any_experience = experiences.exists()
            
            if not has_any_experience:
                if is_senior:
                    return Decimal('20')  # Senior roles need experience
                else:
                    return Decimal('50')  # Regular entry-level roles okay without experience
            
            # Calculate experience metrics
            total_years = cls._calculate_total_experience_years(experiences)
            required_years = cls._extract_experience_requirements(job)
            
            # Adjust required years based on job level
            if is_senior:
                # Senior positions need more experience, be stricter
                if required_years < 3:
                    required_years = Decimal('5')  # Minimum expectation for senior roles
            else:
                # Regular positions - be more lenient
                if required_years > 3:
                    required_years = max(Decimal('2'), required_years * Decimal('0.7'))  # Reduce requirements
            
            # Enhanced scoring for any experience
            if is_senior:
                # Senior positions: stricter scoring
                years_score = cls._score_experience_years_senior(total_years, required_years)
            else:
                # Regular positions: generous scoring
                years_score = cls._score_experience_years_generous(total_years, required_years)
            
            # Industry relevance and career progression (smaller weight for non-senior)
            industry_score = cls._score_industry_relevance(job, experiences)
            level_score = cls._score_career_progression(job, candidate_profile, experiences)
            
            # Combine scores with different weights based on job level
            if is_senior:
                # Senior roles: experience is most important
                experience_score = (
                    years_score * Decimal('0.7') +
                    industry_score * Decimal('0.2') +
                    level_score * Decimal('0.1')
                ).quantize(Decimal('0.01'))
            else:
                # Regular roles: balanced approach
                experience_score = (
                    years_score * Decimal('0.6') +
                    industry_score * Decimal('0.25') +
                    level_score * Decimal('0.15')
                ).quantize(Decimal('0.01'))
            
            return min(Decimal('100'), experience_score)
            
        except Exception as e:
            logger.error(f"Error calculating experience score: {e}")
            return Decimal('60')  # Reasonable default
    
    @classmethod
    def calculate_education_score(cls, job, candidate_profile) -> Decimal:
        """
        Calculate education match score (0-100) based on:
        - Completed college = 100% (unless internship)
        - Internship positions = enrolled in college is sufficient
        - Field of study relevance and certifications as bonus
        """
        try:
            from core.models import Education, Certification
            
            # Get candidate's education
            educations = Education.objects.filter(
                candidate=candidate_profile
            ).order_by('-end_date')  # Use end_date instead of graduation_date
            
            # Check if this is an internship position
            job_text = f"{job.title} {job.description or ''}".lower()
            is_internship = any(keyword in job_text for keyword in ['intern', 'internship'])
            
            # Check candidate's education status
            has_college_degree = False
            currently_in_college = False
            
            for edu in educations:
                # Check for completed college degrees (associate or higher)
                if edu.degree_type in ['aa', 'ba', 'ma', 'phd'] and edu.end_date and not edu.currently_enrolled:
                    has_college_degree = True
                    break
                # Check for current college enrollment
                elif edu.degree_type in ['aa', 'ba', 'ma', 'phd'] and edu.currently_enrolled:
                    currently_in_college = True
            
            # Apply new scoring logic
            if has_college_degree:
                base_score = Decimal('100')  # Completed college = 100%
            elif is_internship and currently_in_college:
                base_score = Decimal('100')  # Internship + enrolled = 100%
            elif currently_in_college:
                base_score = Decimal('75')   # Currently enrolled but not internship
            elif is_internship:
                base_score = Decimal('40')   # Internship but not in college
            else:
                # No college education for non-internship position
                base_score = Decimal('30')
            
            # Add bonuses for field relevance and certifications
            certifications = Certification.objects.filter(
                candidate=candidate_profile
            )
            
            field_bonus = cls._score_field_relevance(job, educations)
            cert_bonus = cls._score_certifications(job, certifications)
            
            # Apply bonuses (but cap at 100%)
            final_score = min(
                Decimal('100'),
                base_score + (field_bonus * Decimal('0.5')) + (cert_bonus * Decimal('0.5'))
            ).quantize(Decimal('0.01'))
            
            return final_score
            
        except Exception as e:
            logger.error(f"Error calculating education score: {e}")
            return Decimal('50')  # Neutral score on error
    
    @classmethod
    def _normalize_weights(cls, weights: Dict) -> Dict[str, Decimal]:
        """Normalize weights to sum to 1.0."""
        decimal_weights = {k: Decimal(str(v)) for k, v in weights.items()}
        total = sum(decimal_weights.values())
        
        if total == 0:
            return cls.DEFAULT_WEIGHTS
        
        return {k: v / total for k, v in decimal_weights.items()}
    
    @classmethod
    def _generate_match_breakdown(cls, job, candidate_profile) -> Dict:
        """Generate detailed match breakdown and recommendations."""
        try:
            # Get skills gap analysis for detailed breakdown
            skills_analysis = SkillsGapAnalyzer.analyze_job(job, candidate_profile)
            
            # Identify strengths (skills with low gap severity)
            strengths = [
                skill['name'] for skill in skills_analysis.get('skills', [])
                if skill.get('gap_severity', 100) < 30 and skill.get('candidate_level')
            ][:5]
            
            # Identify top gaps (skills with high gap severity)
            top_gaps = [
                {
                    'skill': skill['name'],
                    'severity': skill.get('gap_severity', 100),
                    'required_level': skill.get('target_level'),
                    'current_level': skill.get('candidate_level')
                }
                for skill in skills_analysis.get('skills', [])
                if skill.get('gap_severity', 100) > 60
            ][:3]
            
            # Generate recommendations
            recommendations = cls._generate_recommendations(job, candidate_profile, top_gaps)
            
            return {
                'strengths': strengths,
                'top_gaps': top_gaps,
                'recommendations': recommendations,
                'skills_summary': {
                    'total_skills': len(skills_analysis.get('skills', [])),
                    'matched_skills': skills_analysis.get('summary', {}).get('matched_skills', 0),
                    'missing_skills': skills_analysis.get('summary', {}).get('missing_skills', 0)
                }
            }
            
        except Exception as e:
            logger.error(f"Error generating match breakdown: {e}")
            return {
                'strengths': [],
                'top_gaps': [],
                'recommendations': [],
                'skills_summary': {}
            }
    
    @classmethod 
    def _calculate_total_experience_years(cls, experiences) -> Decimal:
        """Calculate total years of relevant work experience."""
        total_days = 0
        
        for exp in experiences:
            start = exp.start_date
            end = exp.end_date or date.today()
            
            if start and end:
                days = (end - start).days
                total_days += max(0, days)
        
        return Decimal(str(total_days / 365.25)).quantize(Decimal('0.1'))
    
    @classmethod
    def _extract_experience_requirements(cls, job) -> Decimal:
        """Extract required years of experience from job description."""
        import re
        
        # Use description and notes fields that actually exist
        description = (job.description or '') + ' ' + (job.personal_notes or '')
        
        # Look for experience patterns
        patterns = [
            r'(\d+)[\+\s]*years?\s+(?:of\s+)?experience',
            r'(\d+)[\+\s]*yrs?\s+(?:of\s+)?experience',
            r'minimum\s+(\d+)\s+years?',
            r'at\s+least\s+(\d+)\s+years?'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, description.lower())
            if match:
                return Decimal(str(match.group(1)))
        
        # Default based on job title/level
        title_lower = job.title.lower()
        if any(word in title_lower for word in ['senior', 'lead', 'principal']):
            return Decimal('5')
        elif any(word in title_lower for word in ['mid', 'intermediate']):
            return Decimal('3')
        elif any(word in title_lower for word in ['junior', 'entry', 'associate']):
            return Decimal('1')
        
        return Decimal('2')  # Default
    
    @classmethod
    def _score_experience_years(cls, actual_years: Decimal, required_years: Decimal) -> Decimal:
        """Score experience based on years comparison."""
        if required_years == 0:
            return Decimal('80')  # Good score when no specific requirement
        
        ratio = actual_years / required_years
        
        if ratio >= 2.0:
            return Decimal('100')  # Significantly exceeds requirements
        elif ratio >= 1.2:
            return Decimal('95')   # Comfortably exceeds requirements
        elif ratio >= 1.0:
            return Decimal('90')   # Meets requirements
        elif ratio >= 0.8:
            return Decimal('75')   # Close to requirements
        elif ratio >= 0.6:
            return Decimal('60')   # Somewhat below
        elif ratio >= 0.4:
            return Decimal('45')   # Well below
        elif ratio >= 0.2:
            return Decimal('30')   # Far below but some experience
        else:
            return Decimal('15')   # Very limited experience

    @classmethod
    def _score_experience_years_generous(cls, actual_years: Decimal, required_years: Decimal) -> Decimal:
        """Generous scoring for regular positions - even one job should score well."""
        if actual_years > 0:
            # Any experience is valuable
            base_score = Decimal('70')  # Good base score for having any experience
        else:
            return Decimal('40')  # Some credit even with no experience
        
        if required_years == 0:
            return Decimal('85')  # Great score when no specific requirement
        
        ratio = actual_years / required_years
        
        if ratio >= 1.5:
            return Decimal('100')  # Exceeds requirements
        elif ratio >= 1.0:
            return Decimal('95')   # Meets requirements perfectly
        elif ratio >= 0.7:
            return Decimal('85')   # Close to requirements - still great
        elif ratio >= 0.5:
            return Decimal('75')   # Half the experience - still good
        elif ratio >= 0.3:
            return Decimal('70')   # Some relevant experience
        else:
            return Decimal('65')   # Any experience is valuable
    
    @classmethod
    def _score_experience_years_senior(cls, actual_years: Decimal, required_years: Decimal) -> Decimal:
        """Stricter scoring for senior positions."""
        if actual_years == 0:
            return Decimal('10')  # Senior roles require experience
        
        if required_years == 0:
            required_years = Decimal('5')  # Default expectation for senior roles
        
        ratio = actual_years / required_years
        
        if ratio >= 2.0:
            return Decimal('100')  # Significantly exceeds
        elif ratio >= 1.5:
            return Decimal('95')   # Comfortably exceeds
        elif ratio >= 1.0:
            return Decimal('85')   # Meets requirements
        elif ratio >= 0.8:
            return Decimal('70')   # Close but slightly below
        elif ratio >= 0.6:
            return Decimal('55')   # Somewhat below
        elif ratio >= 0.4:
            return Decimal('40')   # Well below
        else:
            return Decimal('25')   # Significantly below senior expectations
    
    @classmethod
    def _score_industry_relevance(cls, job, experiences) -> Decimal:
        """Score industry relevance of experience."""
        job_industry = (job.industry or '').lower()
        
        if not job_industry:
            return Decimal('70')  # Neutral score if no industry specified
        
        # Check if any experience is in relevant industry
        for exp in experiences:
            exp_industry = (exp.industry or '').lower()
            if job_industry in exp_industry or exp_industry in job_industry:
                return Decimal('90')
        
        return Decimal('60')  # No direct industry match
    
    @classmethod
    def _score_career_progression(cls, job, candidate_profile, experiences) -> Decimal:
        """Score career level progression alignment."""
        candidate_level = candidate_profile.experience_level or 'entry'
        
        # Map job title to expected level
        job_title_lower = job.title.lower()
        if any(word in job_title_lower for word in ['senior', 'lead', 'principal', 'staff']):
            job_level = 'senior'
        elif any(word in job_title_lower for word in ['mid', 'intermediate']):
            job_level = 'mid'
        elif any(word in job_title_lower for word in ['junior', 'entry', 'associate']):
            job_level = 'entry'
        else:
            job_level = 'mid'  # Default
        
        # Score alignment
        level_mapping = {'entry': 1, 'mid': 2, 'senior': 3, 'executive': 4}
        candidate_score = level_mapping.get(candidate_level, 2)
        job_score = level_mapping.get(job_level, 2)
        
        diff = abs(candidate_score - job_score)
        
        if diff == 0:
            return Decimal('90')   # Perfect match
        elif diff == 1:
            return Decimal('75')   # Close match
        else:
            return Decimal('50')   # Significant mismatch
    
    @classmethod
    def _extract_education_requirements(cls, job) -> Dict:
        """Extract education requirements from job description."""
        # Use available fields
        description = (job.description or '') + ' ' + (job.personal_notes or '')
        description_lower = description.lower()
        
        requirements = {
            'degree_required': False,
            'degree_level': None,
            'field_preferences': []
        }
        
        # Check for degree requirements
        if any(phrase in description_lower for phrase in [
            'bachelor', 'ba ', 'bs ', 'b.a.', 'b.s.',
            'master', 'ma ', 'ms ', 'm.a.', 'm.s.',
            'phd', 'ph.d.', 'doctorate'
        ]):
            requirements['degree_required'] = True
            
            if any(phrase in description_lower for phrase in ['phd', 'ph.d.', 'doctorate']):
                requirements['degree_level'] = 'doctorate'
            elif any(phrase in description_lower for phrase in ['master', 'ma ', 'ms ', 'm.a.', 'm.s.']):
                requirements['degree_level'] = 'master'
            else:
                requirements['degree_level'] = 'bachelor'
        
        return requirements
    
    @classmethod
    def _score_degree_level(cls, educations, requirements) -> Decimal:
        """Score degree level match."""
        if not requirements.get('degree_required'):
            return Decimal('20')  # Bonus for having education when not required
        
        required_level = requirements.get('degree_level')
        
        # Get highest degree
        degree_hierarchy = {'associate': 1, 'bachelor': 2, 'master': 3, 'doctorate': 4}
        highest_degree = None
        
        for edu in educations:
            degree_type = (edu.degree_type or '').lower()
            if degree_type in degree_hierarchy:
                if not highest_degree or degree_hierarchy[degree_type] > degree_hierarchy[highest_degree]:
                    highest_degree = degree_type
        
        if not highest_degree:
            return Decimal('-30')  # Penalty for missing required degree
        
        candidate_level = degree_hierarchy[highest_degree]
        required_level_num = degree_hierarchy.get(required_level, 2)
        
        if candidate_level >= required_level_num:
            return Decimal('30')   # Meets or exceeds requirements
        else:
            return Decimal('-10')  # Below requirements
    
    @classmethod
    def _score_field_relevance(cls, job, educations) -> Decimal:
        """Score relevance of education field to job."""
        job_title_lower = job.title.lower()
        
        # Define field relevance mappings
        tech_keywords = ['software', 'developer', 'engineer', 'programmer', 'technical']
        business_keywords = ['manager', 'analyst', 'consultant', 'business']
        
        for edu in educations:
            field = (edu.field_of_study or '').lower()
            
            # Tech roles
            if any(kw in job_title_lower for kw in tech_keywords):
                if any(tech_field in field for tech_field in [
                    'computer', 'software', 'engineering', 'information', 'technology'
                ]):
                    return Decimal('20')
            
            # Business roles  
            if any(kw in job_title_lower for kw in business_keywords):
                if any(biz_field in field for biz_field in [
                    'business', 'management', 'economics', 'finance', 'marketing'
                ]):
                    return Decimal('20')
        
        return Decimal('0')  # No specific field relevance
    
    @classmethod
    def _score_certifications(cls, job, certifications) -> Decimal:
        """Score relevant certifications."""
        if not certifications.exists():
            return Decimal('0')
        
        # Basic bonus for having certifications
        base_bonus = Decimal('10')
        
        # Additional bonus for relevant certifications
        job_description = (job.description or '').lower()
        relevant_bonus = Decimal('0')
        
        for cert in certifications:
            cert_name = (cert.name or '').lower()
            
            # Check if certification is mentioned in job description
            if cert_name and cert_name in job_description:
                relevant_bonus += Decimal('15')
        
        return min(Decimal('25'), base_bonus + relevant_bonus)
    
    @classmethod
    def _generate_recommendations(cls, job, candidate_profile, top_gaps) -> List[str]:
        """Generate improvement recommendations."""
        recommendations = []
        
        # Skills-based recommendations
        if top_gaps:
            # Take first 3 skills and make the message match the actual count
            displayed_skills = top_gaps[:3]
            skills_rec = f"Focus on developing {len(displayed_skills)} key skills: " + \
                        ", ".join([gap['skill'] for gap in displayed_skills])
            recommendations.append(skills_rec)
        
        # Experience recommendations
        from core.models import WorkExperience
        exp_count = WorkExperience.objects.filter(candidate=candidate_profile).count()
        
        if exp_count == 0:
            recommendations.append("Consider gaining relevant experience through internships or projects")
        elif exp_count < 2:
            recommendations.append("Build more diverse experience in your field")
        
        # Education recommendations  
        from core.models import Education
        edu_count = Education.objects.filter(candidate=candidate_profile).count()
        
        if edu_count == 0:
            recommendations.append("Consider pursuing relevant education or certifications")
        
        return recommendations