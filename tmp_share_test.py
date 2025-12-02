from rest_framework.test import APIClient
from core.models import CandidateProfile, Document
client = APIClient(HTTP_HOST='localhost')
profile = CandidateProfile.objects.first()
user = profile.user
client.force_authenticate(user=user)
cover_doc = Document.objects.filter(candidate=profile, doc_type='cover_letter').first()
print('using cover doc', cover_doc)
data = {
    'cover_letter_document_id': str(cover_doc.id),
    'privacy_level': 'email_verified',
    'allowed_emails': ['reviewer@example.com'],
    'allow_comments': True,
    'allow_download': False,
    'allow_edit': False,
    'require_reviewer_info': False,
}
response = client.post('/api/resume-shares/', data, format='json')
print('status', response.status_code)
print('content', response.content)
