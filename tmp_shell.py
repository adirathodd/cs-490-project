from core.models import ResumeShare
print('shares count:', ResumeShare.objects.count())
print('ids:', list(ResumeShare.objects.values_list('id', flat=True)[:5]))
