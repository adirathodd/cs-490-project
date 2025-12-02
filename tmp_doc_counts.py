from core.models import CandidateProfile, Document
print('cover_letter docs', Document.objects.filter(doc_type='cover_letter').count())
print('resume docs', Document.objects.filter(doc_type='resume').count())
