"""
UC-063: Automated Company Research Service

This module provides comprehensive automated company research functionality including:
- Gathering basic company information (size, industry, headquarters)
- Research company mission, values, and culture
- Finding recent news and press releases
- Identifying key executives and leadership team
- Discovering company products and services
- Researching competitive landscape
- Finding company social media presence
- Generating company research summary

Enhanced with multi-source data collection:
- Wikipedia for company overview and history
- Wikidata for structured company data
- LinkedIn for employee count and executives
- GitHub for tech stack (tech companies)
"""

import logging
import re
from typing import Dict, List, Optional
import requests
from bs4 import BeautifulSoup
from django.utils import timezone
import json

from core.models import Company, CompanyResearch
from .news import fetch_recent_company_news
from .enrichment import (
    fetch_profile_from_yfinance,
    fallback_domain,
)
from .sources.wikipedia_scraper import fetch_wikipedia_data
from .sources.wikidata_scraper import fetch_wikidata
from .sources.linkedin_scraper import fetch_linkedin_data
from .sources.github_scraper import fetch_github_data

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
SOCIAL_MEDIA_PLATFORMS = [
    "linkedin.com",
    "twitter.com",
    "x.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "github.com",
]


class CompanyResearchService:
    """
    Service for automated company research.
    
    This service orchestrates data collection from multiple sources to build
    a comprehensive company profile.
    """

    def __init__(self, company_name: str, max_news_items: int = 50):
        self.company_name = company_name
        self.company = None
        self.research_data = {}
        self.max_news_items = max_news_items

    def research_company(self, force_refresh: bool = False) -> Dict:
        """
        Main method to perform comprehensive company research.
        
        Args:
            force_refresh: If True, refresh data even if recent research exists
            
        Returns:
            Dictionary containing all research data
        """
        try:
            # Get or create company
            self.company = self._get_or_create_company()
            
            # Check if we need to refresh research
            if not force_refresh and self._has_recent_research():
                logger.info(f"Using cached research for {self.company_name}")
                return self._serialize_research()
            
            # Perform comprehensive research
            logger.info(f"Starting automated research for {self.company_name}")
            
            # 1. Find recent news and press releases (FIRST - used for validation)
            self._fetch_recent_news()
            
            # 2. Gather basic company information (uses news for validation)
            self._gather_basic_info()
            
            # 3. Research mission, values, and culture
            self._research_mission_and_culture()
            
            # 4. Identify key executives and leadership
            self._identify_executives()
            
            # 5. Discover products and services
            self._discover_products()
            
            # 6. Research competitive landscape
            self._research_competitors()
            
            # 7. Find social media presence
            self._find_social_media()
            
            # 8. Generate research summary
            self._generate_summary()

            # 9. Derive UC-074 interview prep assets
            self._build_interview_brief()
            
            # Save research to database
            self._save_research()
            
            logger.info(f"Completed automated research for {self.company_name}")
            return self._serialize_research()
            
        except Exception as e:
            logger.error(f"Error researching company {self.company_name}: {e}")
            raise

    def research(self, force_refresh: bool = False) -> Dict:
        """
        Backwards-compatible alias for legacy callers/tests.
        """
        return self.research_company(force_refresh=force_refresh)

    def _get_or_create_company(self) -> Company:
        """Get existing company or create new one."""
        company = Company.objects.filter(name__iexact=self.company_name).first()
        
        if not company:
            domain = fallback_domain(self.company_name)
            company = Company.objects.create(
                name=self.company_name,
                domain=domain
            )
            logger.info(f"Created new company: {self.company_name}")
        
        return company

    def _has_recent_research(self, hours: int = 24) -> bool:
        """Check if company has research data updated within specified hours."""
        try:
            research = CompanyResearch.objects.get(company=self.company)
            if research.last_updated:
                age = timezone.now() - research.last_updated
                return age.total_seconds() < (hours * 3600)
        except CompanyResearch.DoesNotExist:
            pass
        return False

    def _gather_basic_info(self):
        """
        Gather basic company information using multiple sources.
        
        Sources tried in order:
        1. yfinance (with validation)
        2. Wikipedia + Wikidata
        3. LinkedIn
        4. Website scraping + Clearbit
        """
        try:
            logger.info(f"Gathering basic info for {self.company_name} from multiple sources")
            
            # Initialize data aggregator
            aggregated_data = {}
            
            # SOURCE 1: yfinance (validated)
            profile = fetch_profile_from_yfinance(self.company_name)
            yfinance_valid = False
            
            if profile:
                yfinance_valid = self._validate_yfinance_data(profile)
                if yfinance_valid:
                    logger.info(f"✓ yfinance data validated for {self.company_name}")
                    aggregated_data['yfinance'] = profile
                else:
                    logger.warning(f"✗ yfinance data rejected for {self.company_name}")
            
            # SOURCE 2: Wikipedia
            wiki_data = fetch_wikipedia_data(self.company_name)
            if wiki_data:
                logger.info(f"✓ Wikipedia data found for {self.company_name}")
                aggregated_data['wikipedia'] = wiki_data
            
            # SOURCE 3: Wikidata
            wikidata = fetch_wikidata(self.company_name)
            if wikidata:
                logger.info(f"✓ Wikidata found for {self.company_name}")
                aggregated_data['wikidata'] = wikidata
            
            # SOURCE 4: LinkedIn
            linkedin_data = fetch_linkedin_data(self.company_name, self.company.linkedin_url)
            if linkedin_data:
                logger.info(f"✓ LinkedIn data found for {self.company_name}")
                aggregated_data['linkedin'] = linkedin_data
                # Update LinkedIn URL if found
                if linkedin_data.get('linkedin_url') and not self.company.linkedin_url:
                    self.company.linkedin_url = linkedin_data['linkedin_url']
            
            # SOURCE 5: Website scraping
            website_data = self._scrape_company_website()
            if website_data:
                logger.info(f"✓ Website data scraped for {self.company_name}")
                aggregated_data['website'] = website_data
            
            # SOURCE 6: Clearbit
            clearbit_data = self._fetch_clearbit_data()
            if clearbit_data:
                logger.info(f"✓ Clearbit data found for {self.company_name}")
                aggregated_data['clearbit'] = clearbit_data
            
            # AGGREGATE DATA FROM ALL SOURCES
            final_data = self._aggregate_basic_info(aggregated_data)
            
            # Update Company model with aggregated data
            if final_data.get('industry'):
                self.company.industry = final_data['industry']
            if final_data.get('hq_location'):
                self.company.hq_location = final_data['hq_location']
            if final_data.get('employee_count'):
                self.company.size = self._format_employee_count(final_data['employee_count'])
            if final_data.get('domain') and not self.company.domain:
                self.company.domain = final_data['domain']
            
            self.company.save()
            
            # Store in research_data
            self.research_data['basic_info'] = final_data
            
            logger.info(f"✓ Aggregated data from {len(aggregated_data)} sources for {self.company_name}")
            
        except Exception as e:
            logger.error(f"Error gathering basic info: {e}")
            import traceback
            logger.error(traceback.format_exc())
            self.research_data['basic_info'] = {
                'name': self.company_name,
                'industry': '',
                'sector': '',
                'hq_location': '',
                'employees': None,
                'website': '',
                'domain': '',
            }
    
    def _aggregate_basic_info(self, sources: Dict[str, Dict]) -> Dict:
        """
        Intelligently aggregate data from multiple sources.
        
        Priority order:
        1. Wikidata (most structured)
        2. Wikipedia (reliable)
        3. yfinance (if validated)
        4. LinkedIn (good for employee count)
        5. Website/Clearbit (fallback)
        """
        aggregated = {
            'name': self.company_name,
            'sources_used': list(sources.keys()),
        }
        
        # Industry: Prefer Wikidata > Wikipedia > yfinance > LinkedIn
        for source in ['wikidata', 'wikipedia', 'yfinance', 'linkedin']:
            if source in sources and sources[source].get('industry'):
                aggregated['industry'] = sources[source]['industry']
                break
        
        # Location: Prefer Wikidata > Wikipedia > yfinance > LinkedIn
        for source in ['wikidata', 'wikipedia', 'yfinance', 'linkedin']:
            if source in sources and sources[source].get('hq_location'):
                aggregated['hq_location'] = sources[source]['hq_location']
                break
        
        # Employee count: Prefer Wikidata > Wikipedia > LinkedIn > yfinance
        for source in ['wikidata', 'wikipedia', 'linkedin', 'yfinance']:
            if source in sources:
                count = sources[source].get('employee_count') or sources[source].get('employees')
                if count:
                    aggregated['employee_count'] = count
                    break
        
        # Description: Prefer Wikipedia > Website > yfinance
        descriptions = []
        if 'wikipedia' in sources and sources['wikipedia'].get('description'):
            descriptions.append(sources['wikipedia']['description'])
        if 'website' in sources and sources['website'].get('description'):
            descriptions.append(sources['website']['description'])
        if 'yfinance' in sources and sources['yfinance'].get('description'):
            descriptions.append(sources['yfinance']['description'])
        
        if descriptions:
            # Use longest description (likely most comprehensive)
            aggregated['description'] = max(descriptions, key=len)
        
        # Domain: Prefer wikidata > clearbit > website > yfinance
        for source in ['wikidata', 'clearbit', 'website', 'yfinance']:
            if source in sources and sources[source].get('domain'):
                aggregated['domain'] = sources[source]['domain']
                break
        
        # Website URL
        for source in ['wikidata', 'yfinance', 'website']:
            if source in sources and sources[source].get('website'):
                aggregated['website'] = sources[source]['website']
                break
        
        # Founded date (if available)
        for source in ['wikidata', 'wikipedia']:
            if source in sources and sources[source].get('founded'):
                aggregated['founded'] = sources[source]['founded']
                break
        
        # Logo (if available)
        if 'clearbit' in sources and sources['clearbit'].get('logo'):
            aggregated['logo'] = sources['clearbit']['logo']
        
        # Sector (if available from yfinance)
        if 'yfinance' in sources and sources['yfinance'].get('sector'):
            aggregated['sector'] = sources['yfinance']['sector']
        
        return aggregated

    def _validate_yfinance_data(self, profile: Dict) -> bool:
        """
        Validate that yfinance returned data for the correct company
        by cross-checking with news articles and other indicators.
        """
        try:
            # Get recent news if we don't have it yet
            if 'recent_news' not in self.research_data:
                news_items = fetch_recent_company_news(self.company_name, max_results=5)
                self.research_data['recent_news'] = news_items
            else:
                news_items = self.research_data['recent_news']
            
            if not news_items:
                # No news to validate against, accept yfinance data cautiously
                logger.warning(f"No news found to validate yfinance data for {self.company_name}")
                return True
            
            # Extract keywords from news titles and descriptions
            news_text = ' '.join([
                f"{item.get('title', '')} {item.get('description', '')}" 
                for item in news_items[:5]
            ]).lower()
            
            # Check if yfinance industry appears in news context
            yf_industry = profile.get('industry', '').lower()
            yf_sector = profile.get('sector', '').lower()
            yf_location = profile.get('hq_location', '').lower()
            
            # Common fintech/tech indicators (since Plaid is fintech)
            tech_indicators = ['fintech', 'financial', 'technology', 'api', 'banking', 
                             'payments', 'data', 'software', 'platform', 'developer']
            
            # Check for tech indicators in news
            has_tech_indicators = any(indicator in news_text for indicator in tech_indicators)
            
            # If news mentions tech/fintech but yfinance says "Packaged Foods", that's wrong
            if has_tech_indicators and yf_industry in ['packaged foods', 'food products', 'beverages']:
                logger.warning(f"Industry mismatch: news suggests tech/fintech but yfinance says {yf_industry}")
                return False
            
            # If industry/sector/location appear nowhere in news, it might be wrong company
            yf_keywords = [k for k in [yf_industry, yf_sector, yf_location] if k]
            if yf_keywords:
                # Check if at least one yfinance keyword appears in news
                matches = sum(1 for keyword in yf_keywords if keyword and keyword in news_text)
                if matches == 0:
                    logger.warning(f"No yfinance keywords found in news context")
                    return False
            
            logger.info(f"yfinance data validated successfully for {self.company_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error validating yfinance data: {e}")
            # On error, accept yfinance data
            return True


    def _format_employee_count(self, count: int) -> str:
        """Format employee count into standard size ranges."""
        if count < 50:
            return "1-50 employees"
        elif count < 200:
            return "51-200 employees"
        elif count < 1000:
            return "201-1000 employees"
        elif count < 5000:
            return "1001-5000 employees"
        elif count < 10000:
            return "5001-10000 employees"
        else:
            return "10000+ employees"

    def _scrape_company_website(self) -> Dict:
        """
        Fallback method to scrape company website for information.
        Attempts to find company description, mission, and other data from their website.
        """
        try:
            if not self.company.domain:
                logger.warning(f"No domain available for {self.company_name}")
                return {}
            
            url = f"https://{self.company.domain}"
            logger.info(f"Scraping company website: {url}")
            
            response = requests.get(url, headers=HEADERS, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            scraped_data = {}
            
            # Extract meta description
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            if meta_desc and meta_desc.get('content'):
                scraped_data['description'] = meta_desc.get('content', '').strip()
            
            # Try to find "About" page description
            about_text = self._find_about_section(soup)
            if about_text:
                scraped_data['about'] = about_text
            
            # Extract title
            title = soup.find('title')
            if title:
                scraped_data['title'] = title.get_text().strip()
            
            # Look for social media links
            social_links = {}
            for link in soup.find_all('a', href=True):
                href = link.get('href', '')
                for platform in SOCIAL_MEDIA_PLATFORMS:
                    if platform in href.lower():
                        platform_name = platform.split('.')[0]
                        if platform_name not in social_links:
                            social_links[platform_name] = href
            
            if social_links:
                scraped_data['social_media'] = social_links
            
            logger.info(f"Successfully scraped data from {url}")
            return scraped_data
            
        except Exception as e:
            logger.warning(f"Failed to scrape website for {self.company_name}: {e}")
            return {}

    def _find_about_section(self, soup: BeautifulSoup) -> Optional[str]:
        """Find and extract content from About section on website."""
        try:
            # Look for common About section indicators
            about_indicators = ['about', 'who we are', 'our story', 'our mission', 'about us']
            
            for indicator in about_indicators:
                # Try to find section by id or class
                section = soup.find(['section', 'div'], attrs={'id': re.compile(indicator, re.I)})
                if not section:
                    section = soup.find(['section', 'div'], attrs={'class': re.compile(indicator, re.I)})
                
                if section:
                    # Get text from paragraphs
                    paragraphs = section.find_all('p', limit=3)
                    if paragraphs:
                        text = ' '.join([p.get_text().strip() for p in paragraphs])
                        if len(text) > 100:  # Only return if substantial content
                            return text[:1000]  # Limit to 1000 chars
            
            return None
        except Exception as e:
            logger.warning(f"Error finding about section: {e}")
            return None

    def _fetch_clearbit_data(self) -> Dict:
        """
        Attempt to fetch company data from Clearbit's free logo API.
        This often includes basic company info in the response.
        """
        try:
            if not self.company.domain:
                return {}
            
            # Clearbit logo API - free tier
            url = f"https://autocomplete.clearbit.com/v1/companies/suggest?query={self.company_name}"
            
            response = requests.get(url, headers=HEADERS, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    company_data = data[0]
                    return {
                        'name': company_data.get('name'),
                        'domain': company_data.get('domain'),
                        'logo': company_data.get('logo'),
                    }
            
        except Exception as e:
            logger.debug(f"Clearbit fetch failed for {self.company_name}: {e}")
        
        return {}

    def _search_crunchbase_basic(self) -> Dict:
        """
        Search for basic company info that might be publicly available.
        Note: This is a placeholder for potential integration with company databases.
        """
        try:
            # Search Google for company info
            search_query = f"{self.company_name} company headquarters location industry"
            search_url = f"https://www.google.com/search?q={requests.utils.quote(search_query)}"
            
            response = requests.get(search_url, headers=HEADERS, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Try to extract info from knowledge graph or featured snippets
            info = {}
            
            # Look for headquarters info
            if 'headquarters' in response.text.lower():
                # Simple extraction - can be enhanced
                pass
            
            return info
            
        except Exception as e:
            logger.debug(f"Search failed for {self.company_name}: {e}")
            return {}

    def _research_mission_and_culture(self):
        """Research company mission, values, and culture."""
        try:
            # Get data from yfinance profile
            profile = fetch_profile_from_yfinance(self.company_name)
            
            if profile:
                description = profile.get('description', '')
                mission = profile.get('mission_statement', '')
                
                # Extract culture keywords from description
                culture_keywords = self._extract_culture_keywords(description)
                
                self.research_data['mission_culture'] = {
                    'description': description,
                    'mission_statement': mission,
                    'culture_keywords': culture_keywords,
                    'values': self._extract_values(description),
                }
                
                logger.info(f"Researched mission and culture for {self.company_name}")
            else:
                # ENHANCED FALLBACK: Use website data
                logger.info(f"Using website data for mission/culture for {self.company_name}")
                
                website_data = self._scrape_company_website()
                description = website_data.get('description', '')
                about_text = website_data.get('about', '')
                
                # Combine description and about text
                combined_text = f"{description} {about_text}".strip()
                
                # If we got basic_info description, use that too
                if 'basic_info' in self.research_data:
                    basic_desc = self.research_data['basic_info'].get('description', '')
                    if basic_desc and basic_desc not in combined_text:
                        combined_text = f"{combined_text} {basic_desc}".strip()
                
                culture_keywords = self._extract_culture_keywords(combined_text)
                values = self._extract_values(combined_text)
                
                self.research_data['mission_culture'] = {
                    'description': combined_text[:500] if combined_text else '',  # Limit to 500 chars
                    'mission_statement': '',
                    'culture_keywords': culture_keywords,
                    'values': values,
                }
                
                logger.info(f"Extracted {len(culture_keywords)} culture keywords from website")
                
        except Exception as e:
            logger.error(f"Error researching mission and culture: {e}")
            self.research_data['mission_culture'] = {
                'description': '',
                'mission_statement': '',
                'culture_keywords': [],
                'values': [],
            }

    def _extract_culture_keywords(self, text: str) -> List[str]:
        """Extract culture-related keywords from company description."""
        if not text:
            return []
        
        culture_terms = {
            'innovation', 'innovative', 'cutting-edge', 'pioneering',
            'collaboration', 'collaborative', 'teamwork', 'team-oriented',
            'diversity', 'inclusive', 'inclusion', 'equity',
            'growth', 'learning', 'development', 'career',
            'impact', 'mission-driven', 'purpose', 'meaningful',
            'agile', 'fast-paced', 'dynamic', 'flexible',
            'excellence', 'quality', 'integrity', 'customer-focused',
        }
        
        text_lower = text.lower()
        found_keywords = []
        
        for term in culture_terms:
            if term in text_lower:
                found_keywords.append(term.capitalize())
        
        return list(set(found_keywords))[:10]  # Limit to 10 unique keywords

    def _extract_values(self, text: str) -> List[str]:
        """Extract company values from description text."""
        if not text:
            return []
        
        value_patterns = [
            r'values?:\s*([^.]+)',
            r'we value\s+([^.]+)',
            r'committed to\s+([^.]+)',
            r'believe in\s+([^.]+)',
        ]
        
        values = []
        text_lower = text.lower()
        
        for pattern in value_patterns:
            matches = re.findall(pattern, text_lower)
            for match in matches:
                # Split by common separators
                parts = re.split(r'[,;]|\sand\s', match)
                values.extend([p.strip().capitalize() for p in parts if p.strip()])
        
        return list(set(values))[:5]  # Limit to 5 unique values

    def _fetch_recent_news(self):
        """Fetch recent news and press releases."""
        try:
            news_items = fetch_recent_company_news(self.company_name, max_results=self.max_news_items)
            self.research_data['recent_news'] = news_items
            logger.info(f"Fetched {len(news_items)} news items for {self.company_name}")
        except Exception as e:
            logger.error(f"Error fetching news: {e}")
            self.research_data['recent_news'] = []

    def _identify_executives(self):
        """Identify key executives and leadership team."""
        try:
            executives = []
            
            # Try to get executive data from yfinance
            try:
                profile = fetch_profile_from_yfinance(self.company_name)
                if profile:
                    # yfinance may have some executive info in company info
                    # For now, we'll use a placeholder approach
                    # In production, you'd use a dedicated API like Clearbit or PeopleDataLabs
                    pass
            except Exception:
                pass
            
            # Placeholder for executive identification
            # In production, integrate with LinkedIn API, company websites, or executive databases
            self.research_data['executives'] = executives
            logger.info(f"Identified {len(executives)} executives for {self.company_name}")
            
        except Exception as e:
            logger.error(f"Error identifying executives: {e}")
            self.research_data['executives'] = []

    def _discover_products(self):
        """
        Discover company products and services from multiple sources.
        
        Sources:
        1. Wikipedia (most comprehensive for established companies)
        2. Company website
        3. yfinance description
        4. GitHub (for tech products)
        """
        try:
            products = []
            
            # SOURCE 1: Wikipedia (often has detailed product listings)
            if 'wikipedia' in self.research_data.get('basic_info', {}).get('sources_used', []):
                wiki_data = fetch_wikipedia_data(self.company_name)
                if wiki_data.get('products'):
                    products.extend(wiki_data['products'])
                    logger.info(f"Found {len(wiki_data['products'])} products from Wikipedia")
            
            # SOURCE 2: GitHub repositories (for tech companies)
            github_data = self._get_github_data()
            if github_data.get('top_repositories'):
                for repo in github_data['top_repositories'][:3]:
                    products.append({
                        'name': repo['name'],
                        'description': repo.get('description', ''),
                        'type': 'Open Source Project',
                    })
                logger.info(f"Found {len(github_data['top_repositories'])} products from GitHub")
            
            # SOURCE 3: Extract from yfinance description if needed
            if len(products) < 3:
                profile = fetch_profile_from_yfinance(self.company_name)
                if profile:
                    description = profile.get('description', '')
                    text_products = self._extract_products_from_text(description)
                    products.extend(text_products)
            
            # Remove duplicates and limit
            seen = set()
            unique_products = []
            for product in products:
                name_lower = product['name'].lower()
                if name_lower not in seen:
                    seen.add(name_lower)
                    unique_products.append(product)
            
            self.research_data['products'] = unique_products[:10]  # Max 10
            logger.info(f"Discovered {len(unique_products)} total products for {self.company_name}")
            
        except Exception as e:
            logger.error(f"Error discovering products: {e}")
            self.research_data['products'] = []
    
    def _get_github_data(self) -> Dict:
        """Get GitHub data if available (cached or fresh)."""
        # Check if we already fetched social media with GitHub URL
        social_media = self.research_data.get('social_media', {})
        github_url = social_media.get('github')
        
        if github_url or self.company_name:
            github_data = fetch_github_data(self.company_name, github_url)
            if github_data:
                # Store tech stack if found
                if github_data.get('tech_stack'):
                    self.research_data['tech_stack'] = github_data['tech_stack']
                return github_data
        
        return {}

    def _extract_products_from_text(self, text: str) -> List[Dict]:
        """Extract product mentions from text."""
        if not text:
            return []
        
        products = []
        
        # Look for product-related keywords
        product_patterns = [
            r'products?\s+include[s]?\s+([^.]+)',
            r'offers?\s+([^.]+)',
            r'provides?\s+([^.]+)',
            r'platform[s]?\s+([^.]+)',
        ]
        
        for pattern in product_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                # Extract individual products
                parts = re.split(r'[,;]|\sand\s', match)
                for part in parts:
                    if part.strip() and len(part.strip()) > 3:
                        products.append({
                            'name': part.strip().capitalize(),
                            'description': '',
                        })
        
        return products[:5]  # Limit to 5 products

    def _research_competitors(self):
        """
        Research competitive landscape.
        
        Sources:
        1. Wikipedia (often lists direct competitors)
        2. News articles (mentions competitors)
        """
        try:
            competitors = []
            
            # Get industry from basic info
            industry = self.research_data.get('basic_info', {}).get('industry', '')
            
            # SOURCE 1: Wikipedia
            wiki_data = fetch_wikipedia_data(self.company_name)
            if wiki_data.get('competitors'):
                competitors.extend(wiki_data['competitors'])
                logger.info(f"Found {len(wiki_data['competitors'])} competitors from Wikipedia")
            
            # SOURCE 2: Extract from news articles
            news_items = self.research_data.get('recent_news', [])
            for item in news_items[:10]:
                text = f"{item.get('title', '')} {item.get('description', '')}".lower()
                # Look for competitor mentions (common patterns)
                # Companies often mentioned alongside in news
                # This is a simplified approach - could be enhanced with NER
                pass  # Placeholder for more sophisticated analysis
            
            self.research_data['competitors'] = {
                'industry': industry,
                'companies': competitors[:10],  # Limit to 10
                'market_position': 'Unknown',
            }
            
            logger.info(f"Researched {len(competitors)} competitors for {self.company_name}")
            
        except Exception as e:
            logger.error(f"Error researching competitors: {e}")
            self.research_data['competitors'] = {
                'industry': '',
                'companies': [],
                'market_position': 'Unknown',
            }

    def _find_social_media(self):
        """Find company social media presence."""
        try:
            social_media = {}
            
            # Start with LinkedIn if we have it
            if self.company.linkedin_url:
                social_media['linkedin'] = self.company.linkedin_url
            
            # ENHANCED: Check if we already scraped social media from website
            if 'basic_info' in self.research_data:
                scraped_social = self.research_data['basic_info'].get('social_media', {})
                if scraped_social:
                    social_media.update(scraped_social)
                    logger.info(f"Using previously scraped social media links")
            
            # If we don't have much yet, try to scrape again
            if len(social_media) < 2 and self.company.domain:
                website_data = self._scrape_company_website()
                if website_data.get('social_media'):
                    social_media.update(website_data['social_media'])
            
            self.research_data['social_media'] = social_media
            logger.info(f"Found {len(social_media)} social media profiles for {self.company_name}")
            
        except Exception as e:
            logger.error(f"Error finding social media: {e}")
            self.research_data['social_media'] = {}

    def _generate_summary(self):
        """Generate a comprehensive research summary."""
        try:
            basic_info = self.research_data.get('basic_info', {})
            mission_culture = self.research_data.get('mission_culture', {})
            news = self.research_data.get('recent_news', [])
            products = self.research_data.get('products', [])
            social_media = self.research_data.get('social_media', {})
            
            # Build summary sections
            summary_parts = []
            
            # Company overview
            if basic_info.get('industry'):
                summary_parts.append(
                    f"{self.company_name} is a {basic_info.get('industry')} company"
                )
                if basic_info.get('hq_location'):
                    summary_parts[-1] += f" headquartered in {basic_info.get('hq_location')}"
                summary_parts[-1] += "."
            
            # Size
            if basic_info.get('employees'):
                count = basic_info.get('employees')
                summary_parts.append(f"The company employs approximately {count:,} people.")
            
            # Mission
            if mission_culture.get('mission_statement'):
                summary_parts.append(
                    f"Mission: {mission_culture.get('mission_statement')}"
                )
            
            # Products
            if products:
                product_names = [p.get('name', '') for p in products[:3]]
                summary_parts.append(
                    f"Key offerings include: {', '.join(product_names)}."
                )
            
            # Recent news
            if news:
                latest_news = news[0]
                summary_parts.append(
                    f"Recent news: {latest_news.get('title', '')} ({latest_news.get('date', '')})."
                )
            
            # Social presence
            if social_media:
                platforms = ', '.join(social_media.keys())
                summary_parts.append(
                    f"Active on: {platforms}."
                )
            
            summary = " ".join(summary_parts)
            self.research_data['summary'] = summary
            
            logger.info(f"Generated summary for {self.company_name}")
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            self.research_data['summary'] = f"Research data available for {self.company_name}."

    def _build_interview_brief(self):
        """UC-074: Build interview-ready research assets for frontend/database storage."""
        try:
            basic_info = self.research_data.get('basic_info', {}) or {}
            mission_culture = self.research_data.get('mission_culture', {}) or {}
            news_items = self.research_data.get('recent_news', []) or []
            executives = self.research_data.get('executives', []) or []
            competitors = self.research_data.get('competitors', {}) or {}
            values = mission_culture.get('values') or []
            overview = self.research_data.get('summary') or mission_culture.get('description') or basic_info.get('description', '')
            self.research_data['profile_overview'] = overview.strip()

            history_parts = []
            founded = basic_info.get('founded')
            if founded:
                history_parts.append(f"{self.company_name} was founded {founded}.")
            description = mission_culture.get('description') or basic_info.get('description')
            if description:
                history_parts.append(description.strip())
            self.research_data['company_history'] = ' '.join(history_parts).strip()

            developments = []
            for item in news_items[:5]:
                if not item:
                    continue
                developments.append({
                    'title': item.get('title', ''),
                    'summary': item.get('summary', ''),
                    'date': item.get('date'),
                    'category': item.get('category'),
                    'source': item.get('source'),
                    'key_points': item.get('key_points', []),
                })
            self.research_data['recent_developments'] = developments

            potential = []
            for exec_data in executives:
                name = exec_data.get('name') or exec_data.get('full_name')
                if not name:
                    continue
                potential.append({
                    'name': name,
                    'title': exec_data.get('title', ''),
                    'linkedin_url': exec_data.get('linkedin_url', ''),
                })
                if len(potential) >= 5:
                    break
            self.research_data['potential_interviewers'] = potential

            competitor_companies = [c for c in competitors.get('companies', []) if c]
            industry = competitors.get('industry')
            market_position = competitors.get('market_position')
            comp_summary_parts = []
            if competitor_companies:
                comp_summary_parts.append(
                    f"Key competitors in {industry or 'the market'} include {', '.join(competitor_companies[:4])}."
                )
            if market_position and (market_position or '').lower() != 'unknown':
                comp_summary_parts.append(f"{self.company_name} is positioned as {market_position}.")
            self.research_data['competitive_landscape'] = ' '.join(comp_summary_parts).strip()

            strategic_categories = {'market', 'partnership', 'product', 'funding'}
            initiatives = []
            for item in news_items:
                if not item or item.get('category') not in strategic_categories:
                    continue
                initiatives.append({
                    'title': item.get('title', ''),
                    'category': item.get('category'),
                    'summary': item.get('summary', ''),
                    'date': item.get('date'),
                    'source': item.get('source'),
                })
                if len(initiatives) >= 5:
                    break
            self.research_data['strategic_initiatives'] = initiatives

            talking_points = []
            if overview:
                talking_points.append(overview.strip()[:280])
            mission_statement = mission_culture.get('mission_statement')
            if mission_statement:
                talking_points.append(f"Mission focus: {mission_statement.strip()}")
            if values:
                talking_points.append(f"Values that stand out: {', '.join(values[:4])}")
            if initiatives:
                talking_points.append(f"Strategic initiative: {initiatives[0]['title']}")
            if self.research_data['competitive_landscape']:
                talking_points.append(self.research_data['competitive_landscape'])
            if news_items:
                talking_points.append(f"Recent headline: {news_items[0].get('title', '')}")
            self.research_data['talking_points'] = [p for p in talking_points if p][:6]

            intelligent_questions = []
            if mission_statement:
                intelligent_questions.append(
                    f"How does {self.company_name} measure success on its mission to {mission_statement[:120]}?"
                )
            if initiatives:
                intelligent_questions.append(
                    f"What impact will {initiatives[0].get('title')} have on this team?"
                )
            if competitor_companies:
                intelligent_questions.append(
                    f"How does {self.company_name} differentiate itself from {competitor_companies[0]} in {industry or 'the market'}?"
                )
            if values:
                intelligent_questions.append(
                    f"Which company value is most critical for success in this role?"
                )
            if news_items:
                intelligent_questions.append(
                    f"How should I reference \"{news_items[0].get('title', '')}\" during interviews?"
                )
            self.research_data['interview_questions'] = [q for q in intelligent_questions if q][:6]

            export_lines = [
                f"# {self.company_name} Interview Research",
                "",
                "## Overview",
                overview or "Overview unavailable.",
                "",
                "## Company History",
                self.research_data['company_history'] or "History not available.",
                "",
                "## Mission & Values",
                mission_statement or "Mission not available.",
                f"Values: {', '.join(values)}" if values else "Values not available.",
                "",
                "## Recent Developments",
            ]
            if developments:
                export_lines.extend([f"- {dev['title']} ({dev.get('category') or 'update'})" for dev in developments])
            else:
                export_lines.append("- None available")

            export_lines.extend([
                "",
                "## Strategic Initiatives",
            ])
            if initiatives:
                export_lines.extend([f"- {item['title']} — {item.get('summary', '')}" for item in initiatives])
            else:
                export_lines.append("- None available")

            export_lines.extend([
                "",
                "## Talking Points",
            ])
            if self.research_data['talking_points']:
                export_lines.extend([f"- {point}" for point in self.research_data['talking_points']])
            else:
                export_lines.append("- None available")

            export_lines.extend([
                "",
                "## Intelligent Questions",
            ])
            if self.research_data['interview_questions']:
                export_lines.extend([f"- {question}" for question in self.research_data['interview_questions']])
            else:
                export_lines.append("- None available")

            self.research_data['export_summary'] = '\n'.join(export_lines).strip()

        except Exception as e:
            logger.error(f"Error building UC-074 interview brief for {self.company_name}: {e}")
            self.research_data.setdefault('profile_overview', '')
            self.research_data.setdefault('company_history', '')
            self.research_data.setdefault('recent_developments', [])
            self.research_data.setdefault('potential_interviewers', [])
            self.research_data.setdefault('competitive_landscape', '')
            self.research_data.setdefault('strategic_initiatives', [])
            self.research_data.setdefault('talking_points', [])
            self.research_data.setdefault('interview_questions', [])
            self.research_data.setdefault('export_summary', '')

    def _save_research(self):
        """Save research data to CompanyResearch model and update Company model."""
        try:
            research, created = CompanyResearch.objects.get_or_create(
                company=self.company
            )
            
            # Update Company model fields from basic_info
            basic_info = self.research_data.get('basic_info', {})
            if basic_info:
                if basic_info.get('industry') and not self.company.industry:
                    self.company.industry = basic_info['industry']
                if basic_info.get('hq_location') and not self.company.hq_location:
                    self.company.hq_location = basic_info['hq_location']
                if basic_info.get('employees'):
                    # Map employee count to size category
                    count = basic_info['employees']
                    if count < 50:
                        self.company.size = '1-50'
                    elif count < 200:
                        self.company.size = '51-200'
                    elif count < 1000:
                        self.company.size = '201-1000'
                    elif count < 5000:
                        self.company.size = '1001-5000'
                    else:
                        self.company.size = '5000+'
                if basic_info.get('linkedin_url') and not self.company.linkedin_url:
                    self.company.linkedin_url = basic_info['linkedin_url']
                
                self.company.save()
                logger.info(f"Updated Company model with basic_info for {self.company_name}")
            
            # Update fields from research_data
            mission_culture = self.research_data.get('mission_culture', {})
            
            # Use basic_info description if available, otherwise use mission_culture
            if basic_info.get('description'):
                research.description = basic_info['description']
            elif mission_culture.get('description'):
                research.description = mission_culture['description']
                
            research.profile_overview = self.research_data.get('profile_overview', research.profile_overview or '')
            research.company_history = self.research_data.get('company_history', research.company_history or '')
            research.mission_statement = mission_culture.get('mission_statement', '')
            research.culture_keywords = mission_culture.get('culture_keywords', [])
            research.company_values = mission_culture.get('values', [])
            
            # Recent news
            research.recent_news = self.research_data.get('recent_news', [])
            research.recent_developments = self.research_data.get('recent_developments', [])
            
            # Employee count
            if basic_info.get('employees'):
                research.employee_count = basic_info['employees']
            
            # Tech stack from basic_info or existing
            if basic_info.get('tech_stack'):
                research.tech_stack = basic_info['tech_stack']
            else:
                research.tech_stack = research.tech_stack or []
            
            # Funding info
            profile = fetch_profile_from_yfinance(self.company_name)
            if profile:
                research.funding_info = profile.get('funding_info', {})
            
            # UC-063: Save additional research fields
            research.executives = self.research_data.get('executives', [])
            research.potential_interviewers = self.research_data.get('potential_interviewers', [])
            research.products = self.research_data.get('products', [])
            research.competitors = self.research_data.get('competitors', {})
            research.competitive_landscape = self.research_data.get('competitive_landscape', research.competitive_landscape or '')
            research.strategic_initiatives = self.research_data.get('strategic_initiatives', [])
            research.talking_points = self.research_data.get('talking_points', [])
            research.interview_questions = self.research_data.get('interview_questions', [])
            research.export_summary = self.research_data.get('export_summary', research.export_summary or '')
            research.social_media = self.research_data.get('social_media', {})
            
            # Save timestamp
            research.last_updated = timezone.now()
            research.save()
            
            logger.info(f"Saved research data for {self.company_name}")
            
        except Exception as e:
            logger.error(f"Error saving research data: {e}")
            raise

    def _serialize_research(self) -> Dict:
        """Serialize research data for API response."""
        try:
            research = CompanyResearch.objects.get(company=self.company)
            
            # Include basic_info from research_data if available
            basic_info = self.research_data.get('basic_info', {})
            
            return {
                'company': {
                    'id': self.company.id,
                    'name': self.company.name,
                    'domain': self.company.domain,
                    'industry': self.company.industry,
                    'size': self.company.size,
                    'hq_location': self.company.hq_location,
                    'linkedin_url': self.company.linkedin_url,
                },
                'research': {
                    'description': research.description,
                    'profile_overview': research.profile_overview,
                    'company_history': research.company_history,
                    'mission_statement': research.mission_statement,
                    'culture_keywords': research.culture_keywords,
                    'company_values': research.company_values,
                    'recent_news': research.recent_news[:10],  # Limit to 10 most recent
                    'recent_developments': research.recent_developments[:10] if isinstance(research.recent_developments, list) else [],
                    'executives': research.executives,
                    'products': research.products,
                    'competitors': research.competitors,
                    'social_media': research.social_media,
                    'funding_info': research.funding_info,
                    'tech_stack': research.tech_stack,
                    'employee_count': research.employee_count,
                    'glassdoor_rating': research.glassdoor_rating,
                    'competitive_landscape': research.competitive_landscape,
                    'strategic_initiatives': research.strategic_initiatives,
                    'talking_points': research.talking_points,
                    'interview_questions': research.interview_questions,
                    'export_summary': research.export_summary,
                    'last_updated': research.last_updated.isoformat() if research.last_updated else None,
                },
                'executives': research.executives,
                'products': research.products,
                'competitors': research.competitors,
                'social_media': research.social_media,
                'summary': self.research_data.get('summary', research.description or ''),
                # Include the aggregated basic_info with sources
                'basic_info': basic_info,
            }
            
        except CompanyResearch.DoesNotExist:
            return {
                'company': {
                    'id': self.company.id,
                    'name': self.company.name,
                    'domain': self.company.domain,
                },
                'error': 'Research data not available'
            }


def automated_company_research(company_name: str, force_refresh: bool = False, max_news_items: int = 50) -> Dict:
    """
    Convenience function to perform automated company research.
    
    Args:
        company_name: Name of the company to research
        force_refresh: If True, refresh data even if recent research exists
        max_news_items: Maximum number of news items to fetch (default: 50)
        
    Returns:
        Dictionary containing comprehensive company research data
    """
    service = CompanyResearchService(company_name, max_news_items=max_news_items)
    return service.research_company(force_refresh=force_refresh)
