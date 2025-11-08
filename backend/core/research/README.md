# Company Data Scrapers

This module provides multi-source company data collection and aggregation.

## Overview

The scraping system collects company information from multiple free sources and intelligently aggregates the data with a priority-based merging strategy.

## Architecture

```
core/
├── research/
│   ├── __init__.py               # Public API exports
│   ├── README.md                 # This guide
│   ├── service.py                # CompanyResearchService orchestrator
│   ├── enrichment.py             # yfinance helpers & fallback utils
│   ├── news.py                   # Google News RSS fetching
│   └── sources/                  # Individual data sources
│       ├── wikipedia_scraper.py
│       ├── wikidata_scraper.py
│       ├── linkedin_scraper.py
│       └── github_scraper.py
└── tests/
    └── research/
        ├── test_automated_company_research.py
        ├── test_company_news.py
        └── test_multi_source_scraping.py
```

## Scrapers

### Wikipedia Scraper (`wikipedia_scraper.py`)

Extracts company data from Wikipedia pages.

**Data Collected:**
- Company description (summary)
- Industry/sector
- Products and services
- Competitors
- Employee count
- Headquarters location
- Founded date
- Company type (public/private)

**Usage:**
```python
from core.research.sources.wikipedia_scraper import fetch_wikipedia_data

data = fetch_wikipedia_data('Company Name')
# Returns dict with extracted fields
```

**Features:**
- Handles disambiguation pages
- Prioritizes company-specific pages (looks for "Inc.", "Corp.", etc.)
- Parses both infobox and article text
- Robust error handling

### Wikidata Scraper (`wikidata_scraper.py`)

Queries Wikidata for structured company information via SPARQL.

**Data Collected:**
- Industry (P452)
- Headquarters location (P159)
- Number of employees (P1128)
- CEO (P169)
- Official website (P856)
- Founded date (P571)

**Usage:**
```python
from core.research.sources.wikidata_scraper import fetch_wikidata

data = fetch_wikidata('Company Name')
# Returns dict with Wikidata properties
```

**Features:**
- Uses SPARQL queries for precise data extraction
- Returns structured, machine-readable data
- Includes Wikidata entity IDs for reference

### LinkedIn Scraper (`linkedin_scraper.py`)

Scrapes public LinkedIn company pages (no authentication required).

**Data Collected:**
- Company description
- Employee count/range
- Industry
- Company size
- LinkedIn URL

**Usage:**
```python
from core.research.sources.linkedin_scraper import fetch_linkedin_data

# With known URL
data = fetch_linkedin_data('Company Name', 'https://linkedin.com/company/xyz')

# Or search for URL
data = fetch_linkedin_data('Company Name', None)
```

**Features:**
- Searches for LinkedIn URL via Google if not provided
- Extracts from public page (no login needed)
- Handles rate limiting gracefully

### GitHub Scraper (`github_scraper.py`)

Analyzes GitHub organizations to infer tech stack.

**Data Collected:**
- Programming languages used
- Popular repositories
- Technology stack
- GitHub organization URL

**Usage:**
```python
from core.research.sources.github_scraper import fetch_github_data

data = fetch_github_data('Company Name', 'https://github.com/company')
```

**Features:**
- Uses GitHub API (no auth for public data)
- Aggregates languages across repos
- Identifies primary technologies
- Optionally uses environment variable `GITHUB_TOKEN` for higher rate limits

## Multi-Source Aggregation

The `CompanyResearchService` orchestrates all scrapers and intelligently merges data.

### Priority Order

When multiple sources provide the same field, priority is:

1. **Wikidata** - Most structured and reliable
2. **Wikipedia** - Generally accurate and comprehensive
3. **yfinance** - Good for public companies (if validated)
4. **LinkedIn** - Good for employee counts
5. **Website/Clearbit** - Fallback sources

### Data Validation

- **yfinance validation**: Cross-checks against news articles to ensure correct company
  - Example: Rejects "Plaid Enterprises" (food company) when news mentions fintech
- **Industry validation**: Ensures industry terms are consistent across sources
- **Location normalization**: Standardizes location formats

### Usage Example

```python
from core.research import automated_company_research

# Research a company
result = automated_company_research(
    company_name='Plaid',
    force_refresh=True,
    max_news_items=50
)

# Result structure:
{
    'company': {
        'id': 123,
        'name': 'Plaid',
        'domain': 'plaid.com',
        'industry': 'Financial Services',  # Aggregated
        'hq_location': 'San Francisco, CA',  # Aggregated
        'size': '201-1000',  # Calculated from employee count
    },
    'research': {
        'description': '...',
        'employee_count': 500,
        'tech_stack': ['Python', 'JavaScript', 'Go'],
        'recent_news': [...],
    },
    'basic_info': {
        'sources_used': ['wikipedia', 'wikidata', 'github', 'website'],
        'industry': 'Financial Services',
        'hq_location': 'San Francisco, CA',
        'employees': 500,
        'description': '...',
        'tech_stack': ['Python', 'JavaScript', 'Go'],
    },
    'executives': [...],
    'products': [...],
    'competitors': {...},
    'social_media': {...},
}
```

## Testing

### Unit Tests

```bash
# Run all research scraper tests
python manage.py test core.tests.research.test_multi_source_scraping

# Run specific test class
python manage.py test core.tests.research.test_multi_source_scraping.WikipediaScraperTest

# Run with coverage
pytest --cov=core/research core/tests/research/test_multi_source_scraping.py
```

### Integration Tests

Integration tests make real API calls and require internet:

```bash
# Run integration tests
pytest -m integration core/tests/research/test_multi_source_scraping.py
```

### Manual Testing

```bash
# Test Wikipedia scraper
docker-compose exec backend python -c "
from core.research.sources.wikipedia_scraper import fetch_wikipedia_data
import json
data = fetch_wikipedia_data('Microsoft')
print(json.dumps(data, indent=2))
"

# Test full research
docker-compose exec backend python test_plaid_complete.py
```

## Configuration

### Environment Variables

- `GITHUB_TOKEN` (optional): GitHub personal access token for higher API rate limits
- `CLEARBIT_API_KEY` (optional): Clearbit API key for company enrichment

### Settings

In `settings.py`:

```python
# Maximum number of news articles to fetch
MAX_NEWS_ITEMS = 50

# Enable/disable specific scrapers
ENABLE_WIKIPEDIA_SCRAPER = True
ENABLE_WIKIDATA_SCRAPER = True
ENABLE_LINKEDIN_SCRAPER = True
ENABLE_GITHUB_SCRAPER = True
```

## Error Handling

All scrapers implement robust error handling:

- Network errors: Return empty dict, log warning
- Rate limiting: Backoff and retry (or gracefully skip)
- Invalid data: Skip and continue with other sources
- Missing data: Return partial results

The aggregation system continues even if individual scrapers fail.

## Performance

### Execution Time

Typical research for one company:
- Wikipedia: ~1-2 seconds
- Wikidata: ~1-2 seconds
- LinkedIn: ~2-3 seconds (includes search)
- GitHub: ~1-2 seconds
- Total: ~5-10 seconds for full research

### Caching

- Company data is cached in PostgreSQL (`CompanyResearch` model)
- `force_refresh=False` (default) uses cached data if < 7 days old
- `force_refresh=True` re-fetches from all sources

### Rate Limiting

- Wikipedia: No strict limits for reasonable use
- Wikidata: No strict limits
- LinkedIn: May block if too many requests (use delays)
- GitHub: 60 requests/hour without token, 5000/hour with token

## Future Enhancements

Potential improvements:

1. **Crunchbase integration** (requires API key)
2. **Glassdoor scraping** for ratings and reviews
3. **Twitter/X API** for social presence
4. **SEC Edgar** for public company filings
5. **Better caching** with Redis
6. **Async/parallel** scraping with asyncio
7. **Machine learning** for data validation and deduplication

## Troubleshooting

### Common Issues

**Wikipedia returns wrong company:**
- Check disambiguation handling in `wikipedia_scraper.py`
- Verify company keywords prioritization

**No data from Wikidata:**
- Company may not be in Wikidata
- Try searching Wikidata manually to verify

**LinkedIn blocking requests:**
- Add delays between requests
- Use residential proxies (advanced)

**GitHub rate limit exceeded:**
- Set `GITHUB_TOKEN` environment variable
- Reduce number of repos analyzed

### Debug Logging

Enable debug logging in `settings.py`:

```python
LOGGING = {
    'loggers': {
        'core.research.sources': {
            'level': 'DEBUG',
        },
    },
}
```

## Contributing

When adding new scrapers:

1. Create new file in `core/research/sources/`
2. Implement main `fetch_<source>_data(company_name)` function
3. Return consistent dict structure
4. Add error handling and logging
5. Write tests in `test_multi_source_scraping.py`
6. Update this README
7. Add source to aggregation priority in `research/service.py`
