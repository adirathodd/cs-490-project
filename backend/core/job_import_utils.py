"""
Utilities for importing job details from job posting URLs.
Supports LinkedIn, Indeed, and Glassdoor.
"""
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

# Common user agent to avoid bot detection
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'


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
        headers = {'User-Agent': USER_AGENT}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
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
        data['posting_url'] = url
        
        if fields:
            status = JobImportResult.STATUS_SUCCESS if len(fields) >= 2 else JobImportResult.STATUS_PARTIAL
            return JobImportResult(status, data=data, fields_extracted=fields)
        else:
            return JobImportResult(
                JobImportResult.STATUS_FAILED,
                error='Could not extract any job details from LinkedIn URL'
            )
    
    except requests.RequestException as e:
        logger.error(f"Failed to fetch LinkedIn job: {e}")
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error=f'Failed to fetch job posting: {str(e)}'
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
        headers = {'User-Agent': USER_AGENT}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
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
        data['posting_url'] = url
        
        if fields:
            status = JobImportResult.STATUS_SUCCESS if len(fields) >= 2 else JobImportResult.STATUS_PARTIAL
            return JobImportResult(status, data=data, fields_extracted=fields)
        else:
            return JobImportResult(
                JobImportResult.STATUS_FAILED,
                error='Could not extract any job details from Indeed URL'
            )
    
    except requests.RequestException as e:
        logger.error(f"Failed to fetch Indeed job: {e}")
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error=f'Failed to fetch job posting: {str(e)}'
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
        headers = {'User-Agent': USER_AGENT}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
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
        data['posting_url'] = url
        
        if fields:
            status = JobImportResult.STATUS_SUCCESS if len(fields) >= 2 else JobImportResult.STATUS_PARTIAL
            return JobImportResult(status, data=data, fields_extracted=fields)
        else:
            return JobImportResult(
                JobImportResult.STATUS_FAILED,
                error='Could not extract any job details from Glassdoor URL'
            )
    
    except requests.RequestException as e:
        logger.error(f"Failed to fetch Glassdoor job: {e}")
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error=f'Failed to fetch job posting: {str(e)}'
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
    
    # Detect job board
    job_board = detect_job_board(url)
    
    if not job_board:
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error='Unsupported job board. Currently supported: LinkedIn, Indeed, Glassdoor'
        )
    
    # Extract job details based on job board
    if job_board == 'linkedin':
        return extract_linkedin_job(url)
    elif job_board == 'indeed':
        return extract_indeed_job(url)
    elif job_board == 'glassdoor':
        return extract_glassdoor_job(url)
    else:
        return JobImportResult(
            JobImportResult.STATUS_FAILED,
            error=f'Unsupported job board: {job_board}'
        )
