"""
Utilities for importing job details from job posting URLs.
Supports LinkedIn, Indeed, Glassdoor, and performs best-effort extraction for other sites.
"""
import json
import logging
import re
from urllib.parse import urlparse, urlunparse, urljoin

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Common user agent to avoid bot detection
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'

# Additional headers to better mimic a real browser
BASE_REQUEST_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Connection': 'keep-alive',
    'Referer': 'https://www.google.com/',
}

# Provide a couple of realistic user agents to rotate through when sites block requests
USER_AGENTS = [
    USER_AGENT,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
]


class JobImportResult:
    """Result object for job import operations"""
    
    STATUS_SUCCESS = 'success'
    STATUS_PARTIAL = 'partial'
    STATUS_FAILED = 'failed'
    
    def __init__(self, status, data=None, error=None, fields_extracted=None):
        self.status = status
        self.data = data or {}
        self.error = error
        self.fields_extracted = fields_extracted or []
    
    def to_dict(self):
        return {
            'status': self.status,
            'data': self.data,
            'error': self.error,
            'fields_extracted': self.fields_extracted
        }


def clean_text(text):
    """Clean and normalize text content"""
    if not text:
        return ''
    # Remove extra whitespace
    text = ' '.join(text.split())
    # Remove special characters that might cause issues
    text = text.strip()
    return text


def extract_linkedin_job(url):
    """
    Extract job details from LinkedIn job posting URL.
    LinkedIn URLs format: https://www.linkedin.com/jobs/view/{job_id}
    """
    try:
        soup, resolved_url = _fetch_job_document(url)
        
        data = {}
        fields = []
        
        # Extract job title
        title_elem = soup.find('h1', class_='top-card-layout__title') or \
                     soup.find('h1', class_='topcard__title') or \
                     soup.find('h2', class_='t-24')
        if title_elem:
            data['title'] = clean_text(title_elem.get_text())
            fields.append('title')
        
        # Extract company name
        company_elem = soup.find('a', class_='topcard__org-name-link') or \
                       soup.find('span', class_='topcard__flavor') or \
                       soup.find('a', class_='sub-nav-cta__optional-url')
        if company_elem:
            data['company_name'] = clean_text(company_elem.get_text())
            fields.append('company_name')
        
        # Extract location
        location_elem = soup.find('span', class_='topcard__flavor--bullet') or \
                        soup.find('span', class_='jobs-unified-top-card__bullet')
        if location_elem:
            data['location'] = clean_text(location_elem.get_text())
            fields.append('location')
        
        # Extract job description
        desc_elem = soup.find('div', class_='show-more-less-html__markup') or \
                    soup.find('div', class_='description__text')
        if desc_elem:
            # Get text with line breaks preserved
            desc_text = desc_elem.get_text('\n', strip=True)
            data['description'] = clean_text(desc_text)[:2000]  # Limit to 2000 chars
            fields.append('description')
        
        # Extract job type (if available)
        job_type_elem = soup.find('span', string=re.compile(r'(Full-time|Part-time|Contract|Internship)', re.I))
        if job_type_elem:
            job_type_text = job_type_elem.get_text().lower()
            if 'full-time' in job_type_text or 'full time' in job_type_text:
                data['job_type'] = 'ft'
            elif 'part-time' in job_type_text or 'part time' in job_type_text:
                data['job_type'] = 'pt'
            elif 'contract' in job_type_text:
                data['job_type'] = 'contract'
            elif 'internship' in job_type_text or 'intern' in job_type_text:
                data['job_type'] = 'intern'
            fields.append('job_type')
        
        # Store original URL
        data['posting_url'] = resolved_url
        
        if fields:
            logger.info("Import extraction: extracted fields for %s -> %s", url, fields)
            status = JobImportResult.STATUS_SUCCESS if len(fields) >= 2 else JobImportResult.STATUS_PARTIAL
            return JobImportResult(status, data=data, fields_extracted=fields)

        sample = soup.get_text(' ', strip=True)[:500]
        logger.warning("Import extraction: no LinkedIn fields found for %s. Sample content: %s", resolved_url, sample)
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error='Could not extract any job details from LinkedIn URL'
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch LinkedIn job: {e}")
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error=_format_fetch_error(e, 'LinkedIn')
        )
    except Exception as e:
        logger.error(f"Error parsing LinkedIn job: {e}")
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error=f'Failed to parse job posting: {str(e)}'
        )


def extract_indeed_job(url):
    """
    Extract job details from Indeed job posting URL.
    Indeed URLs format: https://www.indeed.com/viewjob?jk={job_id}
    """
    try:
        soup, resolved_url = _fetch_job_document(url)
        
        data = {}
        fields = []
        
        # Extract job title
        title_elem = soup.find('h1', class_='jobsearch-JobInfoHeader-title') or \
                     soup.find('h1', class_='icl-u-xs-mb--xs')
        if title_elem:
            data['title'] = clean_text(title_elem.get_text())
            fields.append('title')
        
        # Extract company name
        company_elem = soup.find('div', class_='jobsearch-InlineCompanyRating') or \
                       soup.find('div', class_='icl-u-lg-mr--sm')
        if company_elem:
            # Get the first div with company name
            company_link = company_elem.find('a') or company_elem.find('div')
            if company_link:
                data['company_name'] = clean_text(company_link.get_text())
                fields.append('company_name')
        
        # Extract location
        location_elem = soup.find('div', class_='jobsearch-JobInfoHeader-subtitle') or \
                        soup.find('div', {'data-testid': 'job-location'})
        if location_elem:
            location_text = location_elem.get_text()
            # Remove company name if it's included
            if data.get('company_name'):
                location_text = location_text.replace(data['company_name'], '')
            data['location'] = clean_text(location_text)
            fields.append('location')
        
        # Extract job description
        desc_elem = soup.find('div', id='jobDescriptionText') or \
                    soup.find('div', class_='jobsearch-jobDescriptionText')
        if desc_elem:
            desc_text = desc_elem.get_text('\n', strip=True)
            data['description'] = clean_text(desc_text)[:2000]
            fields.append('description')
        
        # Extract salary if available
        salary_elem = soup.find('div', class_='jobsearch-JobMetadataHeader-item') or \
                      soup.find('span', class_='icl-u-xs-mr--xs')
        if salary_elem and '$' in salary_elem.get_text():
            salary_text = salary_elem.get_text()
            # Try to extract salary range
            salary_match = re.search(r'\$(\d+[,\d]*)', salary_text)
            if salary_match:
                try:
                    salary_str = salary_match.group(1).replace(',', '')
                    data['salary_min'] = int(salary_str)
                    fields.append('salary_min')
                except ValueError:
                    pass
        
        # Extract job type
        job_type_elem = soup.find('span', string=re.compile(r'(Full-time|Part-time|Contract|Internship)', re.I))
        if job_type_elem:
            job_type_text = job_type_elem.get_text().lower()
            if 'full-time' in job_type_text or 'full time' in job_type_text:
                data['job_type'] = 'ft'
            elif 'part-time' in job_type_text or 'part time' in job_type_text:
                data['job_type'] = 'pt'
            elif 'contract' in job_type_text:
                data['job_type'] = 'contract'
            elif 'internship' in job_type_text or 'intern' in job_type_text:
                data['job_type'] = 'intern'
            fields.append('job_type')
        
        # Store original URL
        data['posting_url'] = resolved_url
        
        if fields:
            logger.info("Import extraction: extracted fields for %s -> %s", url, fields)
            status = JobImportResult.STATUS_SUCCESS if len(fields) >= 2 else JobImportResult.STATUS_PARTIAL
            return JobImportResult(status, data=data, fields_extracted=fields)

        sample = soup.get_text(' ', strip=True)[:500]
        logger.warning("Import extraction: no Indeed fields found for %s. Sample content: %s", resolved_url, sample)
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error='Could not extract any job details from Indeed URL'
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch Indeed job: {e}")
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error=_format_fetch_error(e, 'Indeed')
        )
    except Exception as e:
        logger.error(f"Error parsing Indeed job: {e}")
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error=f'Failed to parse job posting: {str(e)}'
        )


def extract_glassdoor_job(url):
    """
    Extract job details from Glassdoor job posting URL.
    Glassdoor URLs format: https://www.glassdoor.com/job-listing/{details}
    """
    try:
        soup, resolved_url = _fetch_job_document(url)
        
        data = {}
        fields = []
        
        # Extract job title
        title_elem = soup.find('div', class_='job-title') or \
                     soup.find('h1', {'data-test': 'job-title'}) or \
                     soup.find('div', {'data-test': 'jobTitle'})
        if title_elem:
            data['title'] = clean_text(title_elem.get_text())
            fields.append('title')
        
        # Extract company name
        company_elem = soup.find('div', class_='employer-name') or \
                       soup.find('div', {'data-test': 'employer-name'})
        if company_elem:
            data['company_name'] = clean_text(company_elem.get_text())
            fields.append('company_name')
        
        # Extract location
        location_elem = soup.find('div', class_='location') or \
                        soup.find('div', {'data-test': 'location'})
        if location_elem:
            data['location'] = clean_text(location_elem.get_text())
            fields.append('location')
        
        # Extract job description
        desc_elem = soup.find('div', class_='job-description') or \
                    soup.find('div', {'data-test': 'jobDescription'})
        if desc_elem:
            desc_text = desc_elem.get_text('\n', strip=True)
            data['description'] = clean_text(desc_text)[:2000]
            fields.append('description')
        
        # Extract salary if available
        salary_elem = soup.find('span', class_='salary-estimate') or \
                      soup.find('div', {'data-test': 'salary'})
        if salary_elem and '$' in salary_elem.get_text():
            salary_text = salary_elem.get_text()
            salary_match = re.search(r'\$(\d+[,\d]*)', salary_text)
            if salary_match:
                try:
                    salary_str = salary_match.group(1).replace(',', '')
                    data['salary_min'] = int(salary_str)
                    fields.append('salary_min')
                except ValueError:
                    pass
        
        # Store original URL
        data['posting_url'] = resolved_url
        
        if fields:
            logger.info("Import extraction: extracted fields for %s -> %s", url, fields)
            status = JobImportResult.STATUS_SUCCESS if len(fields) >= 2 else JobImportResult.STATUS_PARTIAL
            return JobImportResult(status, data=data, fields_extracted=fields)

        sample = soup.get_text(' ', strip=True)[:500]
        logger.warning("Import extraction: no Glassdoor fields found for %s. Sample content: %s", resolved_url, sample)
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error='Could not extract any job details from Glassdoor URL'
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch Glassdoor job: {e}")
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error=_format_fetch_error(e, 'Glassdoor')
        )
    except Exception as e:
        logger.error(f"Error parsing Glassdoor job: {e}")
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error=f'Failed to parse job posting: {str(e)}'
        )


def detect_job_board(url):
    """Detect which job board the URL belongs to"""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        
        if 'linkedin.com' in domain:
            return 'linkedin'
        elif 'indeed.com' in domain:
            return 'indeed'
        elif 'glassdoor.com' in domain:
            return 'glassdoor'
        else:
            return None
    except Exception:
        return None


def _proxy_reader_url(url: str) -> str:
    """Return a fallback reader proxy URL (Jina AI) preserving the original scheme."""
    parsed = urlparse(url)
    scheme = parsed.scheme or 'https'
    netloc = parsed.netloc
    path = parsed.path or '/'
    full = urlunparse((scheme, netloc, path, '', parsed.query, ''))
    # Jina reader expects the original URL appended after the scheme indicator
    return f'https://r.jina.ai/{full}'


def _normalize_url(url: str) -> str:
    if not url:
        return ''
    parsed = urlparse(url)
    scheme = parsed.scheme.lower() if parsed.scheme else 'https'
    netloc = parsed.netloc.lower()
    path = parsed.path or '/'
    return urlunparse((scheme, netloc, path, '', parsed.query, ''))


def _fetch_job_document(url: str, allow_proxy: bool = True, depth: int = 0, visited=None):
    """
    Fetch soup and follow canonical/meta-refresh once to reach the real job page.
    Returns (soup, final_url).
    """
    if visited is None:
        visited = set()
    normalized = _normalize_url(url)
    if normalized in visited:
        logger.warning("Import fetch: detected loop when resolving %s", url)
        soup = _fetch_job_soup(url, allow_proxy)
        return soup, url
    visited.add(normalized)

    soup = _fetch_job_soup(url, allow_proxy)

    if depth >= 2:
        return soup, url

    redirect_url = None

    canonical = soup.find('link', attrs={'rel': lambda v: v and 'canonical' in v.lower()})
    if canonical:
        href = canonical.get('href')
        if href:
            candidate = urljoin(url, href)
            if _normalize_url(candidate) != normalized:
                redirect_url = candidate

    if not redirect_url:
        meta_refresh = soup.find('meta', attrs={'http-equiv': lambda v: v and v.lower() == 'refresh'})
        if meta_refresh:
            content = meta_refresh.get('content') or ''
            match = re.search(r'url=(.+)', content, re.I)
            if match:
                candidate = urljoin(url, match.group(1).strip())
                if candidate:
                    redirect_url = candidate

    if redirect_url:
        norm_redirect = _normalize_url(redirect_url)
        if norm_redirect not in visited:
            logger.info("Import fetch: following resolved URL %s -> %s", url, redirect_url)
            return _fetch_job_document(redirect_url, allow_proxy, depth + 1, visited)

    return soup, url


def _format_fetch_error(exc: requests.RequestException, site_name: str) -> str:
    """Build a user-friendly error message for fetch failures."""
    if isinstance(exc, requests.Timeout):
        return (
            f'{site_name} took too long to respond. '
            'Please try again later or copy the details manually.'
        )
    if isinstance(exc, requests.ConnectionError):
        return (
            f'Could not connect to {site_name}. '
            'Please confirm the link is reachable in your browser.'
        )

    status_code = None
    if hasattr(exc, 'response') and getattr(exc.response, 'status_code', None) is not None:
        status_code = exc.response.status_code
    if status_code in (403, 429):
        return (
            f'{site_name} rejected the request (HTTP {status_code}). '
            'Many job boards block automated imports. Try again later or paste details manually.'
        )
    return f'Failed to fetch job posting: {str(exc)}'


def _fetch_job_soup(url: str, allow_proxy: bool = True) -> BeautifulSoup:
    """
    Fetch the HTML for a job posting URL, trying multiple headers and a reader proxy if needed.
    Raises requests.RequestException on failure.
    """
    last_exc = None
    logger.info("Import fetch: attempting direct fetch for %s (allow_proxy=%s)", url, allow_proxy)
    for agent in USER_AGENTS:
        headers = dict(BASE_REQUEST_HEADERS)
        headers['User-Agent'] = agent
        try:
            logger.debug("Import fetch: trying user-agent %s for %s", agent, url)
            response = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
            if response.status_code in (403, 429):
                logger.warning("Import fetch: received status %s for %s with agent %s", response.status_code, url, agent)
                last_exc = requests.HTTPError(f'HTTP {response.status_code}', response=response)
                continue
            response.raise_for_status()
            if not response.encoding:
                response.encoding = response.apparent_encoding or 'utf-8'
            logger.info(
                "Import fetch: success for %s with agent %s (content-type=%s, len=%s)",
                url,
                agent,
                response.headers.get('Content-Type'),
                len(response.text),
            )
            return BeautifulSoup(response.text, 'html.parser')
        except requests.RequestException as exc:
            last_exc = exc
            logger.debug("Import fetch: exception %s for %s with agent %s", exc, url, agent)
            # If the status is not a transient block, do not retry with other user agents
            if isinstance(exc, requests.HTTPError) and getattr(exc.response, 'status_code', None) not in (403, 429):
                logger.debug("Import fetch: breaking retry loop due to non-retryable HTTP error")
                break

    if allow_proxy:
        try:
            fallback_url = _proxy_reader_url(url)
            headers = dict(BASE_REQUEST_HEADERS)
            headers['User-Agent'] = USER_AGENT
            logger.info("Import fetch: attempting proxy fetch via %s", fallback_url)
            response = requests.get(fallback_url, headers=headers, timeout=10, allow_redirects=True)
            response.raise_for_status()
            if not response.encoding:
                response.encoding = response.apparent_encoding or 'utf-8'
            logger.info(
                "Import fetch: proxy success for %s (content-type=%s, len=%s)",
                url,
                response.headers.get('Content-Type'),
                len(response.text),
            )
            return BeautifulSoup(response.text, 'html.parser')
        except requests.RequestException as exc:
            last_exc = exc
            logger.warning("Import fetch: proxy fetch failed for %s with error: %s", url, exc)

    if last_exc:
        logger.error("Import fetch: giving up on %s after error: %s", url, last_exc)
        raise last_exc
    raise requests.RequestException('Unable to fetch job posting.')


def _load_json_ld_objects(soup):
    """Yield JSON-LD objects from the page, ignoring parsing errors."""
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            text = script.string or script.text
            if not text:
                continue
            data = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            continue

        stack = [data]
        while stack:
            current = stack.pop()
            if isinstance(current, dict):
                yield current
                for value in current.values():
                    if isinstance(value, (dict, list)):
                        stack.append(value)
            elif isinstance(current, list):
                stack.extend(current)


def _infer_job_type(text):
    """Infer job type from text."""
    if not text:
        return None
    text = text.lower()
    mappings = [
        ('full-time', 'ft'),
        ('full time', 'ft'),
        ('part-time', 'pt'),
        ('part time', 'pt'),
        ('contract', 'contract'),
        ('internship', 'intern'),
        ('intern', 'intern'),
        ('temporary', 'temp'),
    ]
    for keyword, code in mappings:
        if keyword in text:
            return code
    return None


def extract_generic_job(url):
    """
    Best-effort extraction for job postings on unsupported sites.
    Uses OpenGraph/Twitter meta tags and JSON-LD JobPosting data when available.
    """
    try:
        soup, resolved_url = _fetch_job_document(url, allow_proxy=True)

        data = {}
        fields = []

        def set_field(key, value, cleaner=clean_text):
            if value is None:
                return
            if cleaner:
                value = cleaner(value)
            if not value:
                return
            data[key] = value
            fields.append(key)

        def meta_content(*pairs):
            for attr, value in pairs:
                tag = soup.find('meta', attrs={attr: value})
                if tag and tag.get('content'):
                    return tag['content']
            return None

        # Attempt to extract JSON-LD JobPosting data first
        job_posting = None
        for obj in _load_json_ld_objects(soup):
            type_val = obj.get('@type')
            if isinstance(type_val, list):
                if 'JobPosting' in [t.lower() if isinstance(t, str) else t for t in type_val]:
                    job_posting = obj
                    break
            elif isinstance(type_val, str) and type_val.lower() == 'jobposting':
                job_posting = obj
                break

        if job_posting:
            set_field('title', job_posting.get('title'))
            description = job_posting.get('description')
            if description:
                # Description may include HTML; use BeautifulSoup to strip tags if present
                desc_soup = BeautifulSoup(description, 'html.parser')
                set_field('description', desc_soup.get_text(' ', strip=True)[:2000], cleaner=lambda x: x)

            hiring_org = job_posting.get('hiringOrganization') or {}
            if isinstance(hiring_org, dict):
                set_field('company_name', hiring_org.get('name'))

            job_location = job_posting.get('jobLocation') or {}
            if isinstance(job_location, list):
                job_location = job_location[0]
            if isinstance(job_location, dict):
                address = job_location.get('address') or {}
                if isinstance(address, dict):
                    locality = address.get('addressLocality') or ''
                    region = address.get('addressRegion') or ''
                    country = address.get('addressCountry') or ''
                    location_parts = [part for part in [locality, region, country] if part]
                    if location_parts:
                        set_field('location', ', '.join(location_parts))
                elif isinstance(address, str):
                    set_field('location', address)

            employment_type = job_posting.get('employmentType')
            if isinstance(employment_type, list):
                employment_type = employment_type[0]
            job_type_code = _infer_job_type(employment_type)
            if not job_type_code and isinstance(employment_type, str):
                job_type_code = _infer_job_type(employment_type)
            if not job_type_code and isinstance(job_posting.get('description'), str):
                job_type_code = _infer_job_type(job_posting['description'])
            if job_type_code:
                set_field('job_type', job_type_code)

            base_salary = job_posting.get('baseSalary')
            if isinstance(base_salary, dict):
                value = base_salary.get('value')
                if isinstance(value, dict):
                    amount = value.get('value') or value.get('minValue')
                    currency = value.get('currency')
                    try:
                        if amount is not None:
                            amount_float = float(amount)
                            set_field('salary_min', str(int(amount_float)) if amount_float.is_integer() else f"{amount_float:.2f}", cleaner=lambda x: x)
                        if currency and not data.get('salary_currency'):
                            set_field('salary_currency', currency.upper(), cleaner=lambda x: x.upper())
                    except (TypeError, ValueError):
                        pass

        # Fallback to meta tags if necessary
        if 'title' not in data:
            meta_title = meta_content(('property', 'og:title'), ('name', 'og:title'), ('name', 'twitter:title'))
            if not meta_title and soup.title and soup.title.string:
                meta_title = soup.title.string
            set_field('title', meta_title)

        if 'company_name' not in data:
            company = meta_content(('property', 'og:site_name'), ('name', 'company'), ('name', 'twitter:data1'))
            if not company:
                # Look for common company label patterns
                company_elem = soup.find(attrs={'itemprop': 'hiringOrganization'}) or soup.find(class_=re.compile('company', re.I))
                if company_elem:
                    company = company_elem.get_text()
            set_field('company_name', company)

        if 'location' not in data:
            location = meta_content(('property', 'job:location'), ('name', 'job_location'), ('name', 'twitter:data2'))
            if not location:
                location_elem = soup.find(attrs={'itemprop': 'jobLocation'}) or soup.find(class_=re.compile('location', re.I))
                if location_elem:
                    location = location_elem.get_text()
            set_field('location', location)

        if 'description' not in data:
            description = meta_content(('property', 'og:description'), ('name', 'description'), ('name', 'twitter:description'))
            if not description:
                desc_elem = soup.find('article') or soup.find('section', class_=re.compile('description|details', re.I))
                if desc_elem:
                    description = desc_elem.get_text(' ', strip=True)
            if description:
                description = description[:2000]
            set_field('description', description, cleaner=lambda x: clean_text(x)[:2000])

        if 'job_type' not in data:
            type_candidates = [
                meta_content(('property', 'employmentType'), ('name', 'employmentType')),
                meta_content(('name', 'job_type')),
            ]
            job_type_code = None
            for candidate in type_candidates:
                job_type_code = _infer_job_type(candidate)
                if job_type_code:
                    break
            if not job_type_code:
                # Use surrounding text heuristics
                for label in soup.find_all(string=re.compile(r'(Full[- ]?time|Part[- ]?time|Contract|Intern)', re.I)):
                    job_type_code = _infer_job_type(label)
                    if job_type_code:
                        break
            if job_type_code:
                set_field('job_type', job_type_code)

        data['posting_url'] = resolved_url
        if fields:
            logger.info("Import extraction: extracted fields for %s -> %s", url, fields)
            status = JobImportResult.STATUS_SUCCESS if len(fields) >= 2 else JobImportResult.STATUS_PARTIAL
            return JobImportResult(status, data=data, fields_extracted=fields)

        sample = soup.get_text(' ', strip=True)[:500]
        logger.warning("Import extraction: generic parser found no fields for %s. Sample content: %s", resolved_url, sample)
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error='Unable to extract job details from the provided URL'
        )

    except requests.RequestException as exc:
        logger.error(f"Failed to fetch job page: {exc}")
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error=_format_fetch_error(exc, 'The job site')
        )
    except Exception as exc:
        logger.error(f"Error parsing generic job page: {exc}")
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error=f'Failed to parse job posting: {str(exc)}'
        )


def import_job_from_url(url):
    """
    Main function to import job details from a URL.
    Returns JobImportResult object.
    """
    # Validate URL
    if not url or not isinstance(url, str):
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error='Invalid URL provided'
        )
    
    url = url.strip()
    
    # Validate URL format
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return JobImportResult(
                JobImportResult.STATUS_FAILED,
                error='Invalid URL format. Please provide a complete URL (e.g., https://...)'
            )
    except Exception:
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error='Invalid URL format'
        )
    
    job_board = detect_job_board(url)
    extractors = {
        'linkedin': extract_linkedin_job,
        'indeed': extract_indeed_job,
        'glassdoor': extract_glassdoor_job,
    }

    if job_board in extractors:
        result = extractors[job_board](url)
        if result.status != JobImportResult.STATUS_FAILED:
            return result
        # fall back to generic extractor if specific parser failed
        fallback_result = extract_generic_job(url)
        if fallback_result.status != JobImportResult.STATUS_FAILED:
            return fallback_result
        return result

    # Attempt generic extraction for other job boards
    generic_result = extract_generic_job(url)
    if generic_result.status != JobImportResult.STATUS_FAILED:
        return generic_result

    error_message = 'Unable to extract job details from the provided URL.'
    if job_board:
        error_message = f'Unsupported job board: {job_board}'
    return JobImportResult(JobImportResult.STATUS_FAILED, error=error_message)
