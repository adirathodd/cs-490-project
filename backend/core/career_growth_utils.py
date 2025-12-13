# backend/core/career_growth_utils.py
"""
UC-128: Career Growth Calculator utilities.

Provides functionality to fetch salary progression data, calculate growth projections,
and integrate with external APIs like Glassdoor for realistic career path modeling.
"""

import requests
import logging
from decimal import Decimal
from typing import Dict, List, Optional, Any
from django.conf import settings

logger = logging.getLogger(__name__)


class CareerGrowthAnalyzer:
    """Analyze career growth potential and salary progression."""
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    
    def get_promotion_timeline(
        self,
        job_title: str,
        company_name: str,
        industry: str = None
    ) -> Dict[str, Any]:
        """
        Get typical promotion timeline and salary progression for a role.
        
        Returns progression data including:
        - Typical years until promotion
        - Common promotion paths
        - Salary increases at each level
        """
        # Normalize title for career path analysis
        normalized_title = self._normalize_job_title(job_title)
        
        # Get career ladder for this role
        career_ladder = self._get_career_ladder(normalized_title, industry)
        
        # Get salary progression estimates
        progression_data = self._estimate_salary_progression(
            normalized_title,
            company_name,
            career_ladder
        )
        
        return {
            'current_title': job_title,
            'normalized_title': normalized_title,
            'career_ladder': career_ladder,
            'progression_timeline': progression_data,
            'typical_tenure_years': self._get_typical_tenure(normalized_title),
        }
    
    def _normalize_job_title(self, title: str) -> str:
        """Normalize job title to standard career levels."""
        title_lower = title.lower()
        
        # Map to standard levels
        if any(word in title_lower for word in ['junior', 'associate', 'entry']):
            return 'junior'
        elif any(word in title_lower for word in ['senior', 'sr.', 'sr ']):
            return 'senior'
        elif any(word in title_lower for word in ['lead', 'principal', 'staff']):
            return 'lead'
        elif any(word in title_lower for word in ['manager', 'engineering manager']):
            return 'manager'
        elif any(word in title_lower for word in ['director', 'head of']):
            return 'director'
        else:
            return 'mid'
    
    def _get_career_ladder(self, level: str, industry: str = None) -> List[Dict]:
        """
        Define career ladder progression for different levels.
        Returns list of promotion steps with typical timeline.
        """
        # Software Engineering ladder (default)
        ladders = {
            'junior': [
                {'title': 'Junior Engineer', 'years': 0, 'level': 1},
                {'title': 'Engineer II', 'years': 2, 'level': 2},
                {'title': 'Senior Engineer', 'years': 4, 'level': 3},
                {'title': 'Staff Engineer', 'years': 7, 'level': 4},
                {'title': 'Principal Engineer', 'years': 10, 'level': 5},
            ],
            'mid': [
                {'title': 'Engineer II', 'years': 0, 'level': 2},
                {'title': 'Senior Engineer', 'years': 2, 'level': 3},
                {'title': 'Staff Engineer', 'years': 5, 'level': 4},
                {'title': 'Principal Engineer', 'years': 8, 'level': 5},
            ],
            'senior': [
                {'title': 'Senior Engineer', 'years': 0, 'level': 3},
                {'title': 'Staff Engineer', 'years': 3, 'level': 4},
                {'title': 'Principal Engineer', 'years': 6, 'level': 5},
            ],
            'lead': [
                {'title': 'Staff Engineer', 'years': 0, 'level': 4},
                {'title': 'Principal Engineer', 'years': 3, 'level': 5},
                {'title': 'Distinguished Engineer', 'years': 6, 'level': 6},
            ],
            'manager': [
                {'title': 'Engineering Manager', 'years': 0, 'level': 3},
                {'title': 'Senior Engineering Manager', 'years': 3, 'level': 4},
                {'title': 'Director of Engineering', 'years': 6, 'level': 5},
            ],
            'director': [
                {'title': 'Director of Engineering', 'years': 0, 'level': 5},
                {'title': 'VP of Engineering', 'years': 4, 'level': 6},
            ],
        }
        
        return ladders.get(level, ladders['mid'])
    
    def _estimate_salary_progression(
        self,
        level: str,
        company_name: str,
        career_ladder: List[Dict]
    ) -> List[Dict]:
        """
        Estimate salary at each career level.
        Uses typical industry multipliers for promotions.
        """
        # Base salary estimates by level (can be enhanced with real API data)
        base_salaries = {
            1: 85000,   # Junior
            2: 115000,  # Mid
            3: 155000,  # Senior
            4: 195000,  # Staff/Lead
            5: 240000,  # Principal/Director
            6: 300000,  # Distinguished/VP
        }
        
        # Company size multipliers (estimate based on company name)
        company_multiplier = self._get_company_multiplier(company_name)
        
        # Promotion raise percentages
        promotion_raises = {
            1: 15,  # Junior to Mid
            2: 20,  # Mid to Senior
            3: 25,  # Senior to Staff
            4: 20,  # Staff to Principal
            5: 25,  # Principal to VP
        }
        
        progression = []
        for step in career_ladder:
            level_num = step['level']
            base = base_salaries.get(level_num, 120000)
            salary = base * company_multiplier
            
            # Calculate raise from previous level
            raise_percent = 0
            if progression:
                prev_salary = progression[-1]['estimated_salary']
                raise_percent = ((salary - prev_salary) / prev_salary) * 100
            
            progression.append({
                'title': step['title'],
                'years_in_role': step['years'],
                'estimated_salary': round(salary, 2),
                'promotion_raise_percent': round(raise_percent, 1) if raise_percent else promotion_raises.get(level_num - 1, 15),
                'total_comp_estimate': round(salary * 1.3, 2),  # Assume 30% additional for bonus/equity
            })
        
        return progression
    
    def _get_company_multiplier(self, company_name: str) -> float:
        """
        Estimate salary multiplier based on company.
        FAANG and top tech companies typically pay 20-50% more.
        """
        company_lower = company_name.lower()
        
        # Top tier tech companies
        faang = ['google', 'facebook', 'meta', 'amazon', 'apple', 'netflix', 'microsoft']
        top_tier = ['stripe', 'databricks', 'snowflake', 'airbnb', 'uber', 'lyft']
        
        if any(comp in company_lower for comp in faang):
            return 1.4
        elif any(comp in company_lower for comp in top_tier):
            return 1.3
        else:
            return 1.0
    
    def _get_typical_tenure(self, level: str) -> Dict[str, int]:
        """Get typical tenure before promotion."""
        tenure_map = {
            'junior': {'min': 1, 'avg': 2, 'max': 3},
            'mid': {'min': 2, 'avg': 3, 'max': 4},
            'senior': {'min': 2, 'avg': 3, 'max': 5},
            'lead': {'min': 3, 'avg': 4, 'max': 6},
            'manager': {'min': 2, 'avg': 3, 'max': 5},
            'director': {'min': 3, 'avg': 5, 'max': 7},
        }
        return tenure_map.get(level, {'min': 2, 'avg': 3, 'max': 4})
    
    def fetch_glassdoor_career_path(
        self,
        job_title: str,
        company_name: str
    ) -> Optional[Dict]:
        """
        Fetch career path and salary progression from Glassdoor.
        Note: This requires Glassdoor API access or web scraping.
        For now, returns structured estimates based on typical patterns.
        """
        try:
            # In production, this would call Glassdoor API
            # For now, return structured estimates
            
            normalized_title = self._normalize_job_title(job_title)
            career_ladder = self._get_career_ladder(normalized_title)
            progression = self._estimate_salary_progression(normalized_title, company_name, career_ladder)
            
            return {
                'company': company_name,
                'current_role': job_title,
                'career_path': progression,
                'data_source': 'industry_estimates',
                'last_updated': 'recent',
            }
            
        except Exception as e:
            logger.error(f"Error fetching Glassdoor career path: {e}")
            return None
    
    def calculate_scenario_comparison(
        self,
        scenarios: List[Dict]
    ) -> Dict[str, Any]:
        """
        Compare multiple career scenarios side-by-side.
        
        Args:
            scenarios: List of scenario dictionaries with projections
            
        Returns:
            Comparison analysis with recommendations
        """
        if not scenarios:
            return {'error': 'No scenarios to compare'}
        
        comparison = {
            'scenarios': [],
            'highest_5_year': None,
            'highest_10_year': None,
            'best_growth_rate': None,
            'recommendations': [],
        }
        
        for scenario in scenarios:
            scenario_analysis = {
                'name': scenario.get('scenario_name', 'Unnamed'),
                'total_comp_5_year': scenario.get('total_comp_5_year', 0),
                'total_comp_10_year': scenario.get('total_comp_10_year', 0),
                'starting_salary': scenario.get('starting_salary', 0),
                'annual_raise': scenario.get('annual_raise_percent', 0),
                'milestones_count': len(scenario.get('milestones', [])),
            }
            
            # Calculate growth rate
            if scenario_analysis['starting_salary'] > 0:
                final_salary = scenario.get('projections_10_year', [{}])[-1].get('base_salary', 0)
                growth_rate = ((final_salary - scenario_analysis['starting_salary']) / 
                              scenario_analysis['starting_salary'] * 100)
                scenario_analysis['10_year_growth_rate'] = round(growth_rate, 1)
            
            comparison['scenarios'].append(scenario_analysis)
        
        # Find best scenarios
        comparison['scenarios'].sort(key=lambda x: x['total_comp_10_year'], reverse=True)
        
        if comparison['scenarios']:
            comparison['highest_10_year'] = comparison['scenarios'][0]['name']
            comparison['best_growth_rate'] = max(
                comparison['scenarios'],
                key=lambda x: x.get('10_year_growth_rate', 0)
            )['name']
        
        # Generate recommendations
        comparison['recommendations'] = self._generate_comparison_recommendations(comparison)
        
        return comparison
    
    def _generate_comparison_recommendations(self, comparison: Dict) -> List[str]:
        """Generate actionable recommendations from scenario comparison."""
        recommendations = []
        
        scenarios = comparison.get('scenarios', [])
        if not scenarios:
            return recommendations
        
        # Compare total comp
        if len(scenarios) >= 2:
            top_scenario = scenarios[0]
            second_scenario = scenarios[1]
            diff = top_scenario['total_comp_10_year'] - second_scenario['total_comp_10_year']
            
            recommendations.append(
                f"{top_scenario['name']} offers ${diff:,.0f} more total compensation over 10 years compared to {second_scenario['name']}."
            )
        
        # Check for promotion opportunities
        for scenario in scenarios:
            if scenario['milestones_count'] >= 2:
                recommendations.append(
                    f"{scenario['name']} includes {scenario['milestones_count']} career milestones, which can accelerate growth."
                )
        
        # Growth rate analysis
        high_growth = [s for s in scenarios if s.get('10_year_growth_rate', 0) > 100]
        if high_growth:
            recommendations.append(
                f"Scenarios with >100% growth over 10 years: {', '.join(s['name'] for s in high_growth)}"
            )
        
        return recommendations


# Global instance
career_growth_analyzer = CareerGrowthAnalyzer()
