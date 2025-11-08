"""
Wikidata scraper for structured company information.

Uses SPARQL queries to extract reliable structured data including:
- Industry classification
- Headquarters location
- Employee count
- Founding date
- Official website
"""

import logging
from typing import Dict, Optional
from SPARQLWrapper import SPARQLWrapper, JSON

logger = logging.getLogger(__name__)

WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql"


class WikidataScraper:
    """Scrape structured company data from Wikidata."""
    
    def __init__(self, company_name: str):
        self.company_name = company_name
        self.sparql = SPARQLWrapper(WIKIDATA_ENDPOINT)
        self.sparql.setReturnFormat(JSON)
        
    def fetch_data(self) -> Dict:
        """
        Fetch company data from Wikidata using SPARQL.
        
        Returns:
            Dictionary with extracted company information
        """
        try:
            # First, find the company's Wikidata ID
            company_id = self._find_company_id()
            
            if not company_id:
                logger.info(f"No Wikidata entry found for {self.company_name}")
                return {}
            
            logger.info(f"Found Wikidata ID {company_id} for {self.company_name}")
            
            # Fetch comprehensive data for the company
            data = self._fetch_company_details(company_id)
            
            if data:
                logger.info(f"Extracted Wikidata information for {self.company_name}")
            
            return data
            
        except Exception as e:
            logger.error(f"Error fetching Wikidata for {self.company_name}: {e}")
            return {}
    
    def _find_company_id(self) -> Optional[str]:
        """Find the Wikidata ID (Q-number) for the company."""
        query = f"""
        SELECT ?company WHERE {{
          ?company rdfs:label "{self.company_name}"@en .
          ?company wdt:P31/wdt:P279* wd:Q4830453 .  # Instance of: business/company
        }}
        LIMIT 1
        """
        
        try:
            self.sparql.setQuery(query)
            results = self.sparql.query().convert()
            
            if results["results"]["bindings"]:
                company_uri = results["results"]["bindings"][0]["company"]["value"]
                # Extract Q-number from URI
                company_id = company_uri.split("/")[-1]
                return company_id
            
        except Exception as e:
            logger.debug(f"Error finding company ID: {e}")
        
        return None
    
    def _fetch_company_details(self, company_id: str) -> Dict:
        """Fetch detailed company information given a Wikidata ID."""
        query = f"""
        SELECT ?industry ?industryLabel 
               ?headquarters ?headquartersLabel
               ?employees ?founded ?website
               ?ceo ?ceoLabel
               ?country ?countryLabel
        WHERE {{
          OPTIONAL {{ wd:{company_id} wdt:P452 ?industry . }}          # Industry
          OPTIONAL {{ wd:{company_id} wdt:P159 ?headquarters . }}      # Headquarters
          OPTIONAL {{ wd:{company_id} wdt:P1128 ?employees . }}        # Number of employees
          OPTIONAL {{ wd:{company_id} wdt:P571 ?founded . }}           # Founded date
          OPTIONAL {{ wd:{company_id} wdt:P856 ?website . }}           # Official website
          OPTIONAL {{ wd:{company_id} wdt:P169 ?ceo . }}               # CEO
          OPTIONAL {{ wd:{company_id} wdt:P17 ?country . }}            # Country
          
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
        }}
        LIMIT 1
        """
        
        try:
            self.sparql.setQuery(query)
            results = self.sparql.query().convert()
            
            if not results["results"]["bindings"]:
                return {}
            
            result = results["results"]["bindings"][0]
            
            data = {}
            
            # Extract industry
            if "industryLabel" in result:
                data['industry'] = result["industryLabel"]["value"]
            
            # Extract headquarters
            if "headquartersLabel" in result:
                hq = result["headquartersLabel"]["value"]
                if "countryLabel" in result:
                    country = result["countryLabel"]["value"]
                    data['hq_location'] = f"{hq}, {country}"
                else:
                    data['hq_location'] = hq
            elif "countryLabel" in result:
                data['hq_location'] = result["countryLabel"]["value"]
            
            # Extract employee count
            if "employees" in result:
                try:
                    data['employee_count'] = int(result["employees"]["value"])
                except (ValueError, KeyError):
                    pass
            
            # Extract founding date
            if "founded" in result:
                founded_str = result["founded"]["value"]
                # Extract just the year
                data['founded'] = founded_str.split('-')[0] if '-' in founded_str else founded_str
            
            # Extract website
            if "website" in result:
                website = result["website"]["value"]
                # Extract domain from URL
                if website.startswith('http'):
                    domain = website.replace('https://', '').replace('http://', '')
                    domain = domain.rstrip('/')
                    data['website'] = website
                    data['domain'] = domain
            
            # Extract CEO
            if "ceoLabel" in result:
                ceo_name = result["ceoLabel"]["value"]
                data['ceo'] = ceo_name
            
            return data
            
        except Exception as e:
            logger.error(f"Error fetching company details: {e}")
            return {}


def fetch_wikidata(company_name: str) -> Dict:
    """
    Convenience function to fetch Wikidata for a company.
    
    Args:
        company_name: Name of the company
        
    Returns:
        Dictionary with Wikidata information
    """
    scraper = WikidataScraper(company_name)
    return scraper.fetch_data()
