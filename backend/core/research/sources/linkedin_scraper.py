"""
LinkedIn public page scraper for company information.

Scrapes publicly available data from LinkedIn company pages (no login required):
- Company description
- Employee count range
- Industry
- Headquarters location
- Top executives (from "People" section)
"""

import logging
import requests
from bs4 import BeautifulSoup
from typing import Dict, List, Optional
import re

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}


class LinkedInScraper:
    """Scrape company data from LinkedIn public pages."""
    
    def __init__(self, company_name: str, linkedin_url: Optional[str] = None):
        self.company_name = company_name
        self.linkedin_url = linkedin_url
        
    def fetch_data(self) -> Dict:
        """
        Fetch company data from LinkedIn.
        
        Returns:
            Dictionary with extracted company information
        """
        try:
            # If we don't have a LinkedIn URL, try to find it
            if not self.linkedin_url:
                self.linkedin_url = self._find_linkedin_url()
            
            if not self.linkedin_url:
                logger.info(f"No LinkedIn URL found for {self.company_name}")
                return {}
            
            logger.info(f"Scraping LinkedIn: {self.linkedin_url}")
            
            # Fetch the company page
            response = requests.get(self.linkedin_url, headers=HEADERS, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            data = {
                'description': self._extract_description(soup),
                'employee_count_range': self._extract_employee_range(soup),
                'industry': self._extract_industry(soup),
                'hq_location': self._extract_location(soup),
                'company_size': self._extract_company_size(soup),
                'specialties': self._extract_specialties(soup),
                'linkedin_url': self.linkedin_url,
            }
            
            logger.info(f"Extracted LinkedIn data for {self.company_name}")
            return {k: v for k, v in data.items() if v}
            
        except requests.exceptions.RequestException as e:
            logger.warning(f"Failed to fetch LinkedIn page: {e}")
            return {}
        except Exception as e:
            logger.error(f"Error scraping LinkedIn for {self.company_name}: {e}")
            return {}
    
    def _find_linkedin_url(self) -> Optional[str]:
        """Try to find the company's LinkedIn URL via Google search."""
        try:
            # Search for company LinkedIn page
            search_query = f"{self.company_name} site:linkedin.com/company"
            search_url = f"https://www.google.com/search?q={requests.utils.quote(search_query)}"
            
            response = requests.get(search_url, headers=HEADERS, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Look for LinkedIn company URLs in search results
            for link in soup.find_all('a', href=True):
                href = link['href']
                if 'linkedin.com/company/' in href:
                    # Extract the actual URL from Google's redirect
                    match = re.search(r'(https://[a-z]{2,3}\.linkedin\.com/company/[^&]+)', href)
                    if match:
                        url = match.group(1)
                        # Clean up URL
                        url = url.split('?')[0]  # Remove query params
                        return url
            
        except Exception as e:
            logger.debug(f"Error finding LinkedIn URL: {e}")
        
        return None
    
    def _extract_description(self, soup: BeautifulSoup) -> str:
        """Extract company description."""
        # LinkedIn descriptions are typically in specific sections
        # This might need updates as LinkedIn changes their HTML structure
        
        # Try multiple possible selectors
        selectors = [
            {'class': 'break-words'},
            {'class': 'org-top-card-summary__tagline'},
            {'class': 'organization__description'},
        ]
        
        for selector in selectors:
            element = soup.find('p', selector)
            if element:
                text = element.get_text().strip()
                if len(text) > 50:  # Meaningful description
                    return text[:500]  # Limit length
        
        return ""
    
    def _extract_employee_range(self, soup: BeautifulSoup) -> str:
        """Extract employee count range."""
        # Look for employee count in the page
        text = soup.get_text()
        
        # Common patterns for employee ranges on LinkedIn
        patterns = [
            r'(\d+[\-–]\d+)\s+employees',
            r'(\d{1,3}(?:,\d{3})+[\-–]\d{1,3}(?:,\d{3})+)\s+employees',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)
        
        # Try to find employee count mentioned anywhere
        if re.search(r'\d+[\+]?\s+employees', text, re.IGNORECASE):
            match = re.search(r'(\d+)[\+]?\s+employees', text, re.IGNORECASE)
            if match:
                count = int(match.group(1))
                return self._format_employee_range(count)
        
        return ""
    
    def _format_employee_range(self, count: int) -> str:
        """Convert employee count to LinkedIn's range format."""
        if count < 11:
            return "1-10"
        elif count < 51:
            return "11-50"
        elif count < 201:
            return "51-200"
        elif count < 501:
            return "201-500"
        elif count < 1001:
            return "501-1000"
        elif count < 5001:
            return "1001-5000"
        elif count < 10001:
            return "5001-10000"
        else:
            return "10000+"
    
    def _extract_industry(self, soup: BeautifulSoup) -> str:
        """Extract industry."""
        # Look for industry in company overview section
        text = soup.get_text()
        
        # Look for "Industry:" label
        match = re.search(r'Industry[:\s]+([^\n]+)', text, re.IGNORECASE)
        if match:
            industry = match.group(1).strip()
            # Clean up
            industry = re.sub(r'[·•].*$', '', industry)  # Remove additional info
            return industry[:100]
        
        return ""
    
    def _extract_location(self, soup: BeautifulSoup) -> str:
        """Extract headquarters location."""
        text = soup.get_text()
        
        # Look for headquarters
        patterns = [
            r'Headquarters[:\s]+([^\n]+)',
            r'Located in[:\s]+([^\n]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                location = match.group(1).strip()
                # Clean up
                location = re.sub(r'[·•].*$', '', location)
                return location[:100]
        
        return ""
    
    def _extract_company_size(self, soup: BeautifulSoup) -> str:
        """Extract company size category."""
        text = soup.get_text().lower()
        
        if 'startup' in text or 'early stage' in text:
            return 'Startup'
        elif 'enterprise' in text or 'fortune 500' in text:
            return 'Enterprise'
        elif 'mid-market' in text or 'mid-size' in text:
            return 'Mid-Market'
        elif 'small business' in text:
            return 'Small Business'
        
        return ""
    
    def _extract_specialties(self, soup: BeautifulSoup) -> List[str]:
        """Extract company specialties/focus areas."""
        text = soup.get_text()
        
        # Look for specialties
        match = re.search(r'Specialties[:\s]+([^\n]+)', text, re.IGNORECASE)
        if match:
            specialties_text = match.group(1)
            # Split by common delimiters
            specialties = [s.strip() for s in re.split(r'[,;·•]', specialties_text)]
            return [s for s in specialties[:10] if s]
        
        return []


def fetch_linkedin_data(company_name: str, linkedin_url: Optional[str] = None) -> Dict:
    """
    Convenience function to fetch LinkedIn data for a company.
    
    Args:
        company_name: Name of the company
        linkedin_url: Optional LinkedIn URL (will search if not provided)
        
    Returns:
        Dictionary with LinkedIn data
    """
    scraper = LinkedInScraper(company_name, linkedin_url)
    return scraper.fetch_data()
