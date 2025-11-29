from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
    verbose_name = 'ATS Core'

    def ready(self):
        # Register signal handlers for auth events (login success/failure/logout)
        # Importing here ensures receivers are connected when Django starts.
        from . import signals  # noqa: F401
