try:
	from .celery import app as celery_app
	__all__ = ('celery_app',)
except Exception:
	# Celery is optional in some environments (e.g., lightweight dev containers)
	celery_app = None
	__all__ = ()

