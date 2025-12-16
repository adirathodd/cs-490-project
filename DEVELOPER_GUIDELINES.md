# RocketResume Developer Guidelines

## ⚠️ CRITICAL: API Monitoring Requirement (UC-117)

**ALL external API calls in this codebase MUST use the API monitoring system.**

### Mandatory for:
- ✅ Gemini AI API calls
- ✅ LinkedIn API calls  
- ✅ Gmail API calls
- ✅ ANY future external API integrations

### How to Implement:


```python
from core.api_monitoring import track_api_call, get_or_create_service, SERVICE_GEMINI

# 1. Get or create the service
service = get_or_create_service('gemini', SERVICE_GEMINI)

# 2. Wrap your API call
with track_api_call(service, '/generate', 'POST', user=request.user):
    # Your API call here
    response = requests.post(gemini_url, json=data)
```

### Why This Matters:
- **Rate Limiting**: Prevents exceeding API quotas
- **Error Tracking**: Logs all failures for debugging
- **Usage Analytics**: Tracks costs and patterns
- **Weekly Reports**: Automated monitoring emails to admin
- **Alerts**: Automatic notifications when approaching limits

### Examples to Follow:
- `backend/core/gmail_utils.py` - Gmail API tracking
- `backend/core/cover_letter_ai.py` - Gemini AI tracking
- `backend/core/linkedin_integration.py` - LinkedIn API tracking

### Service Types:
Use these constants from `core.api_monitoring`:
- `SERVICE_GEMINI` = 'gemini'
- `SERVICE_GMAIL` = 'gmail'
- `SERVICE_LINKEDIN` = 'linkedin'
- `SERVICE_OPENAI` = 'openai'
- `SERVICE_OTHER` = 'other'

### For Copilot Users:
When Copilot suggests API integration code, **always add** the `track_api_call()` wrapper.
The system is designed to work seamlessly - it adds minimal overhead and provides critical monitoring.

---

**Non-compliance will result in:**
- ❌ Unmonitored API usage
- ❌ No rate limit protection
- ❌ Missed errors and failures
- ❌ No cost tracking
- ❌ Failed code reviews
