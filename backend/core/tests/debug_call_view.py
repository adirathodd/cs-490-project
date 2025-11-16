from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth import get_user_model
from core.views import resume_export_wrapper


def test_call_resume_export_direct(db):
    factory = APIRequestFactory()
    user = get_user_model().objects.create_user(username='d', email='d@example.com', password='p')
    request = factory.get('/api/resume/export?format=invalid')
    force_authenticate(request, user=user)
    # Call the wrapped function directly to bypass DRF decorator behavior
    try:
        func = getattr(resume_export_wrapper, '__wrapped__', resume_export_wrapper)
        response = func(request)
    except Exception as e:
        print('direct call to __wrapped__ raised', type(e), e)
        raise
    print('direct response repr:', repr(response))
    print('direct response status', getattr(response, 'status_code', None))
    try:
        print('direct response data:', getattr(response, 'data', None))
    except Exception:
        print('direct response content:', getattr(response, 'content', None))
    assert response is not None
