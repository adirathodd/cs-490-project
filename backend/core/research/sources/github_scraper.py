"""
GitHub scraper for tech stack detection.

For technology companies with GitHub presence, extracts:
- Primary programming languages
- Popular repositories
- Technology stack
- Open source activity
"""

import logging
from typing import Dict, List, Optional
from github import Github, GithubException
import os

logger = logging.getLogger(__name__)


class GitHubScraper:
    """Scrape tech stack from GitHub organization."""
    
    def __init__(self, company_name: str, github_url: Optional[str] = None):
        self.company_name = company_name
        self.github_url = github_url
        # GitHub API - no token needed for public data (but rate limited to 60 req/hour)
        # Can add token from environment for higher limits
        github_token = os.environ.get('GITHUB_TOKEN')
        self.github = Github(github_token) if github_token else Github()
        
    def fetch_data(self) -> Dict:
        """
        Fetch tech stack data from GitHub.
        
        Returns:
            Dictionary with tech stack and repository information
        """
        try:
            # Find the organization
            org_name = self._extract_org_name()
            
            if not org_name:
                logger.info(f"No GitHub organization found for {self.company_name}")
                return {}
            
            logger.info(f"Found GitHub organization: {org_name}")
            
            # Get organization data
            org = self.github.get_organization(org_name)
            
            data = {
                'github_url': f"https://github.com/{org_name}",
                'tech_stack': self._extract_tech_stack(org),
                'top_repositories': self._get_top_repos(org),
                'total_repos': org.public_repos,
                'description': org.description or "",
            }
            
            logger.info(f"Extracted GitHub data for {self.company_name}")
            return {k: v for k, v in data.items() if v}
            
        except GithubException as e:
            if e.status == 404:
                logger.info(f"GitHub organization not found for {self.company_name}")
            else:
                logger.warning(f"GitHub API error: {e}")
            return {}
        except Exception as e:
            logger.error(f"Error fetching GitHub data for {self.company_name}: {e}")
            return {}
    
    def _extract_org_name(self) -> Optional[str]:
        """Extract GitHub organization name."""
        if self.github_url:
            # Extract org name from URL
            # https://github.com/plaid -> plaid
            parts = self.github_url.rstrip('/').split('/')
            if len(parts) >= 4 and parts[2] == 'github.com':
                return parts[3]
        
        # Try company name as org name (common pattern)
        # Convert to lowercase and remove spaces
        potential_names = [
            self.company_name.lower().replace(' ', ''),
            self.company_name.lower().replace(' ', '-'),
            self.company_name.lower(),
        ]
        
        for name in potential_names:
            try:
                self.github.get_organization(name)
                return name
            except GithubException:
                continue
        
        return None
    
    def _extract_tech_stack(self, org) -> List[str]:
        """Extract programming languages and technologies from repos."""
        languages = {}
        
        try:
            # Get top repos and aggregate languages
            repos = list(org.get_repos(type='public', sort='updated'))[:20]  # Top 20 repos
            
            for repo in repos:
                try:
                    repo_languages = repo.get_languages()
                    for lang, bytes_count in repo_languages.items():
                        languages[lang] = languages.get(lang, 0) + bytes_count
                except Exception as e:
                    logger.debug(f"Error getting languages for repo {repo.name}: {e}")
                    continue
            
            # Sort by usage (bytes of code)
            sorted_languages = sorted(languages.items(), key=lambda x: x[1], reverse=True)
            
            # Return top languages
            return [lang for lang, _ in sorted_languages[:10]]
            
        except Exception as e:
            logger.error(f"Error extracting tech stack: {e}")
            return []
    
    def _get_top_repos(self, org) -> List[Dict]:
        """Get top repositories by stars."""
        top_repos = []
        
        try:
            repos = list(org.get_repos(type='public', sort='stars'))[:5]  # Top 5 by stars
            
            for repo in repos:
                top_repos.append({
                    'name': repo.name,
                    'description': repo.description or "",
                    'stars': repo.stargazers_count,
                    'language': repo.language,
                    'url': repo.html_url,
                })
            
        except Exception as e:
            logger.error(f"Error getting top repos: {e}")
        
        return top_repos


def fetch_github_data(company_name: str, github_url: Optional[str] = None) -> Dict:
    """
    Convenience function to fetch GitHub data for a company.
    
    Args:
        company_name: Name of the company
        github_url: Optional GitHub organization URL
        
    Returns:
        Dictionary with GitHub data
    """
    scraper = GitHubScraper(company_name, github_url)
    return scraper.fetch_data()
