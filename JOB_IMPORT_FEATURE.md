# Job Import from URL Feature (SCRUM-39)

## Overview

This feature allows users to quickly import job details from major job board URLs (LinkedIn, Indeed, Glassdoor) into the job tracker, significantly reducing manual data entry effort.

## Feature Highlights

### ✅ Supported Job Boards
- **LinkedIn** - Full support for job postings
- **Indeed** - Full support for job listings
- **Glassdoor** - Full support for job posts

### ✅ Auto-Populated Fields
The system automatically extracts and populates:
- Job Title
- Company Name
- Location
- Job Type (Full-time, Part-time, Contract, etc.)
- Job Description
- Salary Information (when available)
- Original posting URL (for reference)

### ✅ Import Status Indicators
- **Success** (✓) - All major fields extracted successfully
- **Partial** (⚠) - Some fields extracted, others require manual entry
- **Failed** (✗) - Import unsuccessful, fallback to manual entry

### ✅ User Experience
- Visual indicators show which fields were auto-populated
- All imported data is editable before saving
- Graceful error handling with clear messaging
- Fallback to manual entry if import fails

## Usage

### Frontend

1. **Navigate to Job Tracker** page
2. **Click "Add Job"** button
3. **Paste job posting URL** into the import field
4. **Click "Import"** button
5. **Review auto-populated fields** (highlighted in green)
6. **Edit/adjust** any fields as needed
7. **Save** the job entry

### Backend API

#### Endpoint: `POST /api/jobs/import-from-url`

**Request:**
```json
{
  "url": "https://www.linkedin.com/jobs/view/123456"
}
```

**Response (Success):**
```json
{
  "status": "success",
  "data": {
    "title": "Software Engineer",
    "company_name": "Acme Inc",
    "location": "New York, NY",
    "description": "Job description...",
    "job_type": "ft",
    "posting_url": "https://www.linkedin.com/jobs/view/123456"
  },
  "fields_extracted": ["title", "company_name", "location", "description", "job_type"]
}
```

**Response (Partial):**
```json
{
  "status": "partial",
  "data": {
    "title": "Software Engineer",
    "company_name": "Acme Inc",
    "posting_url": "https://www.linkedin.com/jobs/view/123456"
  },
  "fields_extracted": ["title", "company_name"]
}
```

**Response (Failed):**
```json
{
  "status": "failed",
  "error": "Unsupported job board. Currently supported: LinkedIn, Indeed, Glassdoor"
}
```

## Technical Implementation

### Backend Components

1. **`core/job_import_utils.py`** - Core import logic
   - Web scraping with BeautifulSoup4
   - URL detection and validation
   - Field extraction for each job board
   - Error handling and status reporting

2. **`core/views.py`** - API endpoint
   - `import_job_from_url` - Handles POST requests
   - Authentication required
   - Returns structured import result

3. **`core/urls.py`** - URL routing
   - Route: `jobs/import-from-url`

### Frontend Components

1. **`components/Jobs.js`** - Main job tracker UI
   - Import URL input field
   - Import button with loading state
   - Status indicators (success/partial/failed)
   - Field highlighting for imported data
   - Error handling and user feedback

2. **`services/api.js`** - API client
   - `jobsAPI.importFromUrl(url)` - Calls import endpoint

### Dependencies

**Backend:**
- `beautifulsoup4==4.12.3` - HTML parsing
- `lxml==5.3.0` - XML/HTML parser
- `requests==2.32.5` - HTTP requests

**Frontend:**
- React state management for import flow
- Visual indicators with CSS styling

## Error Handling

The system handles various error scenarios gracefully:

1. **Invalid URLs** - Clear validation message
2. **Unsupported job boards** - List of supported platforms
3. **Network errors** - Retry suggestions
4. **Parsing failures** - Fallback to manual entry
5. **Authentication issues** - Login prompt

All errors are user-friendly and actionable.

## Testing

### Unit Tests

Run backend tests:
```bash
cd backend
pytest core/tests/test_job_import.py -v
```

### Manual Testing

Test each supported job board:

1. **LinkedIn**
   ```
   https://www.linkedin.com/jobs/view/{job_id}
   ```

2. **Indeed**
   ```
   https://www.indeed.com/viewjob?jk={job_id}
   ```

3. **Glassdoor**
   ```
   https://www.glassdoor.com/job-listing/{details}
   ```

### Test Scenarios

- ✅ Valid URL from supported job board
- ✅ Invalid URL format
- ✅ URL from unsupported job board
- ✅ Network timeout/connection error
- ✅ Job posting no longer available (404)
- ✅ Partial data extraction
- ✅ Empty fields handling
- ✅ Special characters in job descriptions
- ✅ Multiple imports in same session
- ✅ Edit imported data before saving

## Acceptance Criteria ✅

All acceptance criteria from SCRUM-39 have been met:

- ✅ URL input field on job entry form
- ✅ Auto-populate job title, company, and description from URL
- ✅ Support for major job boards (LinkedIn, Indeed, Glassdoor)
- ✅ Manual review and edit of imported data
- ✅ Fallback to manual entry if import fails
- ✅ Import status indication (success, partial, failed)
- ✅ Store original URL for reference
- ✅ Error handling for invalid URLs
- ✅ Frontend verification: Paste URL → auto-populate → manual adjust → save

## Future Enhancements

Potential improvements for future iterations:

1. **Additional Job Boards** - Monster, ZipRecruiter, CareerBuilder
2. **Browser Extension** - One-click import from any job page
3. **Bulk Import** - Import multiple jobs from a list of URLs
4. **Smart Categorization** - Auto-categorize by industry/job type
5. **Salary Normalization** - Convert salary ranges to standard format
6. **Company Enrichment** - Auto-fetch company logo and details
7. **Duplicate Detection** - Warn if similar job already exists
8. **Import History** - Track import success rates per job board

## Security Considerations

- All imports are authenticated (user must be logged in)
- Rate limiting on import endpoint to prevent abuse
- URL validation to prevent SSRF attacks
- HTML sanitization to prevent XSS
- No storage of sensitive data from job postings
- User-Agent headers to identify our service to job boards

## Performance

- Import typically completes in 2-5 seconds
- Timeout set to 10 seconds for network requests
- No impact on database performance (import doesn't save automatically)
- Frontend remains responsive during import

## Support

For issues or questions:
1. Check error message for specific guidance
2. Verify URL is from a supported job board
3. Try manual entry if import consistently fails
4. Report bugs with job board URL and error message

---

**Implementation Date:** November 2025  
**Story:** SCRUM-39  
**Status:** ✅ Complete
