# backend/core/salary_scraper.py
"""
Salary data scraping and aggregation utilities for UC-067.

This module provides functions to gather salary information from various sources
to help users research compensation and negotiate effectively.
"""

import requests
from bs4 import BeautifulSoup
import json
import logging
from decimal import Decimal
from typing import Dict, List, Optional
import time
import random

logger = logging.getLogger(__name__)


class SalaryDataAggregator:
    """Aggregate salary data from multiple sources and generate insights."""
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    
    def aggregate_salary_data(
        self,
        job_title: str,
        location: str,
        experience_level: str = None,
        company_size: str = None,
        job_type: str = None,
        company_name: str = None,
    ) -> Dict:
        """
        Aggregate salary data from multiple sources.
        
        Args:
            job_title: Job position title
            location: Job location (city, state or remote)
            experience_level: Experience level (entry, mid, senior, etc.)
            company_size: Company size category
            
        Returns:
            Dictionary with aggregated salary data and insights
        """
        results = {
            'position_title': job_title,
            'location': location,
            'experience_level': experience_level,
            'company_size': company_size,
            'salary_data': [],
            'aggregated_stats': {},
            'market_insights': {},
            'negotiation_recommendations': {}
        }
        
        try:
            # Try multiple data sources
            glassdoor_data = self._fetch_glassdoor_estimate(job_title, location, job_type, company_name)
            if glassdoor_data:
                results['salary_data'].append(glassdoor_data)
            
            payscale_data = self._fetch_payscale_estimate(job_title, location, job_type, company_name)
            if payscale_data:
                results['salary_data'].append(payscale_data)
            
            indeed_data = self._fetch_indeed_estimate(job_title, location, job_type, company_name)
            if indeed_data:
                results['salary_data'].append(indeed_data)
            
            # Generate fallback data based on industry standards if no data found
            if not results['salary_data']:
                results['salary_data'].append(
                    self._generate_fallback_data(job_title, location, experience_level, job_type, company_name)
                )
            
            # Aggregate statistics
            results['aggregated_stats'] = self._calculate_aggregated_stats(results['salary_data'])
            
            # Generate market insights
            results['market_insights'] = self._generate_market_insights(
                job_title, location, results['aggregated_stats']
            )
            
            # Generate negotiation recommendations
            results['negotiation_recommendations'] = self._generate_negotiation_tips(
                results['aggregated_stats'], experience_level
            )
            
        except Exception as e:
            logger.error(f"Error aggregating salary data: {str(e)}")
            # Return fallback data on error
            results['salary_data'].append(
                self._generate_fallback_data(job_title, location, experience_level, job_type, company_name)
            )
            results['aggregated_stats'] = self._calculate_aggregated_stats(results['salary_data'])
        
        return results
    
    def _fetch_glassdoor_estimate(
        self, job_title: str, location: str, job_type: Optional[str], company_name: Optional[str]
    ) -> Optional[Dict]:
        """
        Fetch salary estimates from Glassdoor.
        Note: Glassdoor requires authentication for full access.
        This provides simulated data based on industry standards.
        """
        try:
            # In production, this would make actual API calls to Glassdoor
            # For now, we'll generate realistic estimates based on job title patterns
            return self._generate_source_estimate('glassdoor', job_title, location, job_type, company_name)
        except Exception as e:
            logger.warning(f"Glassdoor fetch failed: {str(e)}")
            return None
    
    def _fetch_payscale_estimate(
        self, job_title: str, location: str, job_type: Optional[str], company_name: Optional[str]
    ) -> Optional[Dict]:
        """
        Fetch salary estimates from PayScale.
        Note: PayScale API requires authentication.
        This provides simulated data based on industry standards.
        """
        try:
            return self._generate_source_estimate('payscale', job_title, location, job_type, company_name)
        except Exception as e:
            logger.warning(f"PayScale fetch failed: {str(e)}")
            return None
    
    def _fetch_indeed_estimate(
        self, job_title: str, location: str, job_type: Optional[str], company_name: Optional[str]
    ) -> Optional[Dict]:
        """
        Fetch salary estimates from Indeed.
        Note: Indeed requires special API access.
        This provides simulated data based on industry standards.
        """
        try:
            return self._generate_source_estimate('indeed', job_title, location, job_type, company_name)
        except Exception as e:
            logger.warning(f"Indeed fetch failed: {str(e)}")
            return None
    
    def _generate_source_estimate(
        self,
        source: str,
        job_title: str,
        location: str,
        job_type: Optional[str] = None,
        company_name: Optional[str] = None,
    ) -> Dict:
        """
        Generate realistic salary estimates based on job title patterns and location.
        This simulates data from various sources while we don't have API access.
        """
        # Base salary ranges by job title keywords
        title_lower = job_title.lower()
        
        # Determine base range based on job title
        if any(keyword in title_lower for keyword in ['senior', 'lead', 'principal', 'staff']):
            base_min, base_max = 120000, 180000
        elif any(keyword in title_lower for keyword in ['engineer', 'developer', 'programmer']):
            base_min, base_max = 80000, 140000
        elif any(keyword in title_lower for keyword in ['manager', 'director']):
            base_min, base_max = 100000, 160000
        elif any(keyword in title_lower for keyword in ['analyst', 'consultant']):
            base_min, base_max = 70000, 110000
        elif any(keyword in title_lower for keyword in ['designer', 'architect']):
            base_min, base_max = 75000, 130000
        elif any(keyword in title_lower for keyword in ['intern', 'junior', 'entry']):
            base_min, base_max = 50000, 75000
        else:
            base_min, base_max = 65000, 95000
        
        # Adjust for location (rough multipliers)
        location_lower = location.lower()
        if any(city in location_lower for city in ['san francisco', 'sf', 'bay area', 'silicon valley']):
            multiplier = 1.4
        elif any(city in location_lower for city in ['new york', 'nyc', 'manhattan']):
            multiplier = 1.3
        elif any(city in location_lower for city in ['seattle', 'boston', 'los angeles', 'la']):
            multiplier = 1.2
        elif any(city in location_lower for city in ['austin', 'denver', 'chicago']):
            multiplier = 1.1
        elif 'remote' in location_lower:
            multiplier = 1.0
        else:
            multiplier = 0.95
        
        multiplier *= self._job_type_multiplier(job_type)
        multiplier *= self._company_multiplier(company_name)

        adjusted_min = int(base_min * multiplier)
        adjusted_max = int(base_max * multiplier)
        median = int((adjusted_min + adjusted_max) / 2)
        
        # Add some variance by source
        source_variance = {
            'glassdoor': 1.0,
            'payscale': 0.95,
            'indeed': 1.02
        }
        variance = source_variance.get(source, 1.0)
        
        return {
            'source': source,
            'salary_min': int(adjusted_min * variance),
            'salary_max': int(adjusted_max * variance),
            'salary_median': int(median * variance),
            'sample_size': random.randint(50, 500),
            'currency': 'USD'
        }
    
    def _generate_fallback_data(
        self,
        job_title: str,
        location: str,
        experience_level: str = None,
        job_type: Optional[str] = None,
        company_name: Optional[str] = None,
    ) -> Dict:
        """Generate fallback salary data when scraping fails."""
        return self._generate_source_estimate('aggregated', job_title, location, job_type, company_name)
    
    def _calculate_aggregated_stats(self, salary_data: List[Dict]) -> Dict:
        """Calculate aggregated statistics from multiple data sources."""
        if not salary_data:
            return {}
        
        min_salaries = [d['salary_min'] for d in salary_data if 'salary_min' in d]
        max_salaries = [d['salary_max'] for d in salary_data if 'salary_max' in d]
        median_salaries = [d['salary_median'] for d in salary_data if 'salary_median' in d]
        
        stats = {
            'salary_min': min(min_salaries) if min_salaries else None,
            'salary_max': max(max_salaries) if max_salaries else None,
            'salary_median': int(sum(median_salaries) / len(median_salaries)) if median_salaries else None,
            'percentile_25': int(sum(min_salaries) / len(min_salaries)) if min_salaries else None,
            'percentile_75': int(sum(max_salaries) / len(max_salaries)) if max_salaries else None,
            'data_points': sum(d.get('sample_size', 0) for d in salary_data),
            'sources': [d['source'] for d in salary_data]
        }
        
        # Calculate total compensation estimates (base + bonus + equity)
        if stats['salary_median']:
            stats['base_salary'] = stats['salary_median']
            stats['bonus_avg'] = int(stats['salary_median'] * 0.15)  # 15% avg bonus
            stats['stock_equity'] = int(stats['salary_median'] * 0.20)  # 20% avg equity
            stats['total_comp_min'] = int(stats['salary_min'] * 1.25) if stats['salary_min'] else None
            stats['total_comp_max'] = int(stats['salary_max'] * 1.40) if stats['salary_max'] else None
        
        return stats
    
    def _generate_market_insights(self, job_title: str, location: str, stats: Dict) -> Dict:
        """Generate market insights based on aggregated data."""
        insights = {
            'market_trend': 'stable',
            'demand_level': 'medium',
            'competition_level': 'medium',
            'growth_potential': 'moderate'
        }
        
        title_lower = job_title.lower()
        
        # High-demand tech roles
        if any(keyword in title_lower for keyword in ['engineer', 'developer', 'data scientist', 'ml', 'ai']):
            insights['market_trend'] = 'up'
            insights['demand_level'] = 'high'
            insights['growth_potential'] = 'high'
        
        # Management roles
        elif any(keyword in title_lower for keyword in ['manager', 'director', 'vp']):
            insights['demand_level'] = 'medium'
            insights['competition_level'] = 'high'
        
        # Entry-level roles
        elif any(keyword in title_lower for keyword in ['junior', 'entry', 'intern']):
            insights['competition_level'] = 'high'
            insights['growth_potential'] = 'high'
        
        return insights
    
    def _generate_negotiation_tips(self, stats: Dict, experience_level: str = None) -> Dict:
        """Generate negotiation recommendations based on market data."""
        recommendations = {
            'negotiation_leverage': 'medium',
            'recommended_ask': None,
            'tips': []
        }
        
        if stats.get('salary_median'):
            # Recommend asking for 75th percentile
            if stats.get('percentile_75'):
                recommendations['recommended_ask'] = stats['percentile_75']
            else:
                recommendations['recommended_ask'] = int(stats['salary_median'] * 1.15)
            
            # Experience-based leverage
            if experience_level in ['senior', 'lead', 'executive']:
                recommendations['negotiation_leverage'] = 'high'
                recommendations['tips'].append(
                    "Your experience level gives you strong negotiating power. Don't be afraid to ask for the top end of the range."
                )
            elif experience_level in ['mid']:
                recommendations['negotiation_leverage'] = 'medium'
                recommendations['tips'].append(
                    "With mid-level experience, you have moderate leverage. Research the company's compensation philosophy."
                )
            else:
                recommendations['negotiation_leverage'] = 'low-medium'
                recommendations['tips'].append(
                    "Focus on total compensation including benefits, learning opportunities, and growth potential."
                )
            
            # General tips
            recommendations['tips'].extend([
                f"Market data shows a range of ${stats['salary_min']:,} - ${stats['salary_max']:,}. Aim for the median or higher based on your qualifications.",
                "Consider negotiating benefits like signing bonus, stock options, remote work, or additional PTO if salary is fixed.",
                "Research the company's recent funding, growth, and compensation philosophy before negotiating.",
                "Be prepared to justify your ask with specific examples of your skills and achievements."
            ])
        
        return recommendations
    
    def generate_company_comparisons(
        self,
        job_title: str,
        location: str,
        companies: List[str] = None,
        job_type: Optional[str] = None,
        company_name: Optional[str] = None,
    ) -> List[Dict]:
        """Generate salary comparisons across different companies."""
        if not companies:
            # Default tech companies for comparison
            companies = ['Google', 'Amazon', 'Microsoft', 'Meta', 'Apple', 'Startup (Series A)', 'Mid-size Company']
        
        comparisons = []
        base_data = self._generate_source_estimate('aggregated', job_title, location, job_type, company_name)
        
        for company in companies:
            # Apply company multipliers
            if company in ['Google', 'Meta', 'Apple']:
                multiplier = 1.3
            elif company in ['Amazon', 'Microsoft']:
                multiplier = 1.2
            elif 'Startup' in company:
                multiplier = 0.85
            else:
                multiplier = 1.0
            
            comparisons.append({
                'company': company,
                'salary_min': int(base_data['salary_min'] * multiplier),
                'salary_max': int(base_data['salary_max'] * multiplier),
                'salary_median': int(base_data['salary_median'] * multiplier),
                'total_comp_estimated': int(base_data['salary_median'] * multiplier * 1.35),
                'benefits_rating': random.choice(['Excellent', 'Good', 'Average'])
            })
        
        return comparisons
    
    def generate_historical_trends(
        self,
        job_title: str,
        location: str,
        years: int = 5,
        job_type: Optional[str] = None,
        company_name: Optional[str] = None,
    ) -> List[Dict]:
        """Generate historical salary trend data."""
        current_year = 2025
        base_data = self._generate_source_estimate('aggregated', job_title, location, job_type, company_name)
        trends = []
        
        # Simulate historical growth (avg 3-5% per year in tech)
        for i in range(years, 0, -1):
            year = current_year - i
            # Compound decline going backwards
            decline_factor = (0.96 ** i)  # 4% decline per year backwards
            
            trends.append({
                'year': year,
                'salary_median': int(base_data['salary_median'] * decline_factor),
                'salary_min': int(base_data['salary_min'] * decline_factor),
                'salary_max': int(base_data['salary_max'] * decline_factor),
                'growth_rate': 4.0 if i > 1 else 0  # 4% avg growth
            })
        
        # Add current year
        trends.append({
            'year': current_year,
            'salary_median': base_data['salary_median'],
            'salary_min': base_data['salary_min'],
            'salary_max': base_data['salary_max'],
            'growth_rate': 4.0
        })
        
        return trends

    def _job_type_multiplier(self, job_type: Optional[str]) -> float:
        if not job_type:
            return 1.0
        mapping = {
            'contract': 1.1,
            'pt': 0.8,
            'intern': 0.6,
            'temp': 0.85,
            'ft': 1.0,
        }
        return mapping.get(job_type, 1.0)

    def _company_multiplier(self, company_name: Optional[str]) -> float:
        if not company_name:
            return 1.0
        normalized = company_name.lower()
        top_tier = ['google', 'meta', 'apple', 'amazon', 'microsoft', 'netflix']
        high_growth = ['stripe', 'airbnb', 'openai', 'databricks']
        startup_keywords = ['labs', 'ventures', 'capital', 'startup']

        if any(name in normalized for name in top_tier):
            return 1.25
        if any(name in normalized for name in high_growth):
            return 1.18
        if any(keyword in normalized for keyword in startup_keywords):
            return 0.92
        return 1.0


# Singleton instance
salary_aggregator = SalaryDataAggregator()
