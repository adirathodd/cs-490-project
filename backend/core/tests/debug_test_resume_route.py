from django.urls import resolve

def test_resolve_resume_export():
    res = resolve('/api/resume/export')
    print('resolver match:', res)
    assert res.func is not None
