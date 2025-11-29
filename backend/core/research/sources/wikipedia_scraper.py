"""
Wikipedia scraper for company information.

Extracts structured data from Wikipedia including:
- Company description
- Industry and sector
- Products and services
- Competitors
- Employee count
- Headquarters location
"""

import logging
import wikipedia
from typing import Dict, Optional, List
import re
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class WikipediaScraper:
    """Scrape company data from Wikipedia."""
    
    def __init__(self, company_name: str):
        self.company_name = company_name
        self.page = None
        self.soup = None  # For HTML parsing
        
    def fetch_data(self) -> Dict:
        """
        Fetch comprehensive company data from Wikipedia.
        
        Returns:
            Dictionary with extracted company information
        """
        try:
            # Search for company page
            search_results = wikipedia.search(self.company_name, results=5)
            
            if not search_results:
                logger.info(f"No Wikipedia results for {self.company_name}")
                return {}
            
            # PRIORITIZE: Company-related pages (with Inc., Corp., Ltd., etc.)
            company_keywords = ['inc.', 'inc', 'corp.', 'corp', 'ltd.', 'ltd', 'llc', 
                              'corporation', 'company', 'technologies']
            
            # Sort results: company keywords first
            sorted_results = sorted(search_results, 
                key=lambda x: any(kw in x.lower() for kw in company_keywords),
                reverse=True)
            
            logger.debug(f"Wikipedia search results for {self.company_name}: {sorted_results}")
            
            # Try to find the right page
            for result in sorted_results:
                try:
                    page = wikipedia.page(result, auto_suggest=False)
                    
                    # Verify it's about the company (not a person, place, etc.)
                    if self._is_company_page(page):
                        self.page = page
                        logger.info(f"Found Wikipedia page: {page.title}")
                        
                        # Fetch HTML for infobox parsing
                        self._fetch_html()
                        break
                        
                except wikipedia.exceptions.DisambiguationError as e:
                    # Disambiguation page - try to find company-related option
                    logger.debug(f"Disambiguation page for {result}, options: {e.options[:5]}")
                    
                    # Look for company-related options
                    for option in e.options:
                        if any(kw in option.lower() for kw in company_keywords):
                            try:
                                page = wikipedia.page(option, auto_suggest=False)
                                if self._is_company_page(page):
                                    self.page = page
                                    logger.info(f"Found Wikipedia page from disambiguation: {page.title}")
                                    self._fetch_html()
                                    break
                            except:
                                continue
                    
                    if self.page:
                        break
                        
                except wikipedia.exceptions.PageError as e:
                    logger.debug(f"Page not found: {result}")
                    continue
            
            if not self.page:
                logger.info(f"No suitable Wikipedia page found for {self.company_name}")
                return {}
            
            # Extract data from the page
            data = {
                'description': self._extract_description(),
                'industry': self._extract_industry(),
                'products': self._extract_products(),
                'competitors': self._extract_competitors(),
                'employee_count': self._extract_employee_count(),
                'hq_location': self._extract_headquarters(),
                'founded': self._extract_founded_date(),
                'type': self._extract_company_type(),
                'url': self.page.url,
            }
            
            logger.info(f"Extracted Wikipedia data for {self.company_name}: {list(data.keys())}")
            return {k: v for k, v in data.items() if v}  # Remove empty values
            
        except Exception as e:
            logger.error(f"Error fetching Wikipedia data for {self.company_name}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {}
    
    def _fetch_html(self):
        """Fetch Wikipedia HTML page for infobox parsing."""
        try:
            if not self.page:
                return
            
            response = requests.get(self.page.url, timeout=10)
            if response.status_code == 200:
                self.soup = BeautifulSoup(response.content, 'html.parser')
                logger.debug(f"Fetched HTML for {self.page.title}")
        except Exception as e:
            logger.debug(f"Could not fetch HTML: {e}")
            self.soup = None
    
    def _is_company_page(self, page) -> bool:
        """Check if Wikipedia page is about a company."""
        content_lower = page.content.lower()
        title_lower = page.title.lower()
        
        # Company indicators
        company_keywords = [
            'company', 'corporation', 'inc.', 'ltd.', 'llc',
            'founded', 'headquarters', 'ceo', 'products',
            'industry', 'publicly traded', 'subsidiary'
        ]
        
        # Check if page contains company-related keywords
        matches = sum(1 for keyword in company_keywords if keyword in content_lower)
        
        # Should have at least 3 company-related keywords
        return matches >= 3
    
    def _extract_description(self) -> str:
        """Extract company description (first few paragraphs)."""
        if not self.page:
            return ""
        
        # Get summary (first few sentences)
        try:
            summary = getattr(self.page, 'summary', '') or ''
            if not summary and getattr(self.page, 'content', ''):
                # Fallback to the first paragraph of the page content
                paragraphs = [p.strip() for p in self.page.content.split('\n') if p.strip()]
                summary = paragraphs[0] if paragraphs else ''
            # Limit to ~500 characters
            if len(summary) > 500:
                sentences = summary.split('. ')
                summary = '. '.join(sentences[:3]) + '.'
            return summary
        except Exception as e:
            logger.debug(f"Error extracting description: {e}")
            return ""
    
    def _extract_industry(self) -> str:
        """Extract industry from Wikipedia page."""
        if not self.page:
            return ""
        
        # Try infobox first
        if self.soup:
            infobox = self.soup.find('table', class_='infobox')
            if infobox:
                rows = infobox.find_all('tr')
                for row in rows:
                    header = row.find('th')
                    if header and 'industry' in header.get_text().lower():
                        data = row.find('td')
                        if data:
                            industry = data.get_text().strip()
                            industry = re.sub(r'\[.*?\]', '', industry)
                            industry = re.sub(r'\s+', ' ', industry).strip()
                            logger.debug(f"Found industry in infobox: {industry}")
                            return industry[:100]
        
        # Extract from page summary - look for common patterns
        summary = self.page.summary if self.page else ""
        
        # Pattern: "is a/an [industry] company/corporation/firm"
        patterns = [
            r'is an? ([\w\s-]+?)\s+company',
            r'is an? ([\w\s-]+?)\s+corporation',
            r'is an? ([\w\s-]+?)\s+firm',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, summary, re.IGNORECASE)
            if match:
                industry = match.group(1).strip()
                # Common industry terms to extract
                if any(term in industry.lower() for term in ['financial', 'technology', 'software', 'services', 'tech', 'fintech']):
                    logger.debug(f"Extracted industry from summary: {industry}")
                    return industry.title()
        
        return ""
    
    def _extract_products(self) -> List[Dict]:
        """Extract products and services."""
        if not self.page:
            return []
        
        products = []
        content = self.page.content
        
        # Look for products section
        products_pattern = r'Products?[:\s]+([^\n]+)'
        match = re.search(products_pattern, content, re.IGNORECASE)
        if match:
            products_text = match.group(1).strip()
            # Split by common delimiters
            product_list = re.split(r'[,;]', products_text)
            products = [{'name': p.strip(), 'description': ''} 
                       for p in product_list[:10] if p.strip()]
        
        return products
    
    def _extract_competitors(self) -> List[str]:
        """Extract competitors from Wikipedia."""
        if not self.page:
            return []
        
        content = self.page.content
        competitors = []
        
        # Look for competitor mentions
        # Common patterns in Wikipedia
        sections = ['Competitors', 'Competition', 'Market position']
        
        for section in sections:
            pattern = rf'{section}[:\s]+(.*?)(?:\n\n|\Z)'
            match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
            if match:
                text = match.group(1)
                # Extract company names (capitalized words)
                potential_competitors = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*', text)
                competitors.extend(potential_competitors[:10])
        
        return list(set(competitors))[:5]  # Unique, max 5
    
    def _extract_employee_count(self) -> Optional[int]:
        """Extract number of employees."""
        if not self.page:
            return None
        
        # Try infobox first (most reliable)
        if self.soup:
            infobox = self.soup.find('table', class_='infobox')
            if infobox:
                rows = infobox.find_all('tr')
                for row in rows:
                    header = row.find('th')
                    if header:
                        header_text = header.get_text().lower()
                        if 'employees' in header_text or 'number of employees' in header_text:
                            data = row.find('td')
                            if data:
                                text = data.get_text().strip()
                                # Extract numbers (handle formats like "1,234" or "~1,000")
                                numbers = re.findall(r'([\d,]+)', text)
                                if numbers:
                                    try:
                                        count_str = numbers[0].replace(',', '')
                                        count = int(count_str)
                                        logger.debug(f"Found employee count in infobox: {count}")
                                        return count
                                    except ValueError:
                                        continue
        
        # Fallback to text content
        content = self.page.content
        patterns = [
            r'(?:Number of )?employees?[:\s]+([0-9,]+)',
            r'([0-9,]+)\s+employees',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                try:
                    count_str = match.group(1).replace(',', '')
                    return int(count_str)
                except ValueError:
                    continue
        
        return None
    
    def _extract_headquarters(self) -> str:
        """Extract headquarters location from Wikipedia page."""
        if not self.page:
            return ""
        
        # Try infobox first
        if self.soup:
            infobox = self.soup.find('table', class_='infobox')
            if infobox:
                rows = infobox.find_all('tr')
                for row in rows:
                    header = row.find('th')
                    if header:
                        header_text = header.get_text().lower()
                        if 'headquarters' in header_text or 'hq' in header_text:
                            data = row.find('td')
                            if data:
                                hq = data.get_text().strip()
                                hq = re.sub(r'\[.*?\]', '', hq)
                                hq = re.sub(r'\s+', ' ', hq).strip()
                                logger.debug(f"Found HQ in infobox: {hq}")
                                return hq[:100]
        
        # Extract from page summary - look for location patterns
        summary = self.page.summary if self.page else ""
        
        # Patterns for location
        patterns = [
            r'based in ([A-Z][^.,]+(?:,\s*[A-Z][^.,]+)?)',
            r'headquartered in ([A-Z][^.,]+(?:,\s*[A-Z][^.,]+)?)',
            r'located in ([A-Z][^.,]+(?:,\s*[A-Z][^.,]+)?)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, summary)
            if match:
                hq = match.group(1).strip()
                logger.debug(f"Extracted HQ from summary: {hq}")
                return hq[:100]
        
        return ""
    
    def _extract_founded_date(self) -> str:
        """Extract founding date."""
        if not self.page:
            return ""
        
        # Try infobox first (most reliable)
        if self.soup:
            infobox = self.soup.find('table', class_='infobox')
            if infobox:
                rows = infobox.find_all('tr')
                for row in rows:
                    header = row.find('th')
                    if header:
                        header_text = header.get_text().lower()
                        if 'founded' in header_text:
                            data = row.find('td')
                            if data:
                                founded = data.get_text().strip()
                                # Clean up
                                founded = re.sub(r'\[.*?\]', '', founded)
                                founded = re.sub(r'\s+', ' ', founded).strip()
                                logger.debug(f"Found founded date in infobox: {founded}")
                                return founded[:50]
        
        # Fallback to text content
        content = self.page.content
        founded_pattern = r'Founded[:\s]+([^\n]+)'
        match = re.search(founded_pattern, content, re.IGNORECASE)
        if match:
            founded = match.group(1).strip()
            founded = re.sub(r'\[.*?\]', '', founded)
            return founded[:50]
        
        return ""
    
    def _extract_company_type(self) -> str:
        """Extract company type (public, private, subsidiary, etc.)."""
        if not self.page:
            return ""
        
        content = self.page.content.lower()
        
        if 'publicly traded' in content or 'public company' in content:
            return 'Public'
        elif 'private company' in content or 'privately held' in content:
            return 'Private'
        elif 'subsidiary' in content:
            return 'Subsidiary'
        
        return ""


def fetch_wikipedia_data(company_name: str) -> Dict:
    """
    Convenience function to fetch Wikipedia data for a company.
    
    Args:
        company_name: Name of the company
        
    Returns:
        Dictionary with Wikipedia data
    """
    scraper = WikipediaScraper(company_name)
    return scraper.fetch_data()
