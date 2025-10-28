import logging
from django.dispatch import receiver
from django.contrib.auth.signals import user_logged_in, user_login_failed, user_logged_out
from django.db.models.signals import post_save
from django.contrib.auth import get_user_model

from core.models import UserAccount

logger = logging.getLogger(__name__)


@receiver(user_login_failed)
def log_login_failed(sender, credentials, request, **kwargs):
    """Log details when a login attempt fails (e.g., admin form)."""
    try:
        username = credentials.get('username') if isinstance(credentials, dict) else None
    except Exception:
        username = None

    remote_addr = None
    user_agent = None
    referer = None

    try:
        if request is not None:
            remote_addr = request.META.get('REMOTE_ADDR')
            # Honor X-Forwarded-For if present (docker/nginx)
            xff = request.META.get('HTTP_X_FORWARDED_FOR')
            if xff:
                remote_addr = xff.split(',')[0].strip()
            user_agent = request.META.get('HTTP_USER_AGENT')
            referer = request.META.get('HTTP_REFERER')
    except Exception:
        pass

    logger.warning(
        "AUTH login_failed username=%s ip=%s ua=%s referer=%s",
        username, remote_addr, user_agent, referer
    )


@receiver(user_logged_in)
def log_user_logged_in(sender, request, user, **kwargs):
    """Log successful logins (including admin)."""
    remote_addr = None
    try:
        if request is not None:
            remote_addr = request.META.get('REMOTE_ADDR')
            xff = request.META.get('HTTP_X_FORWARDED_FOR')
            if xff:
                remote_addr = xff.split(',')[0].strip()
    except Exception:
        pass

    logger.info(
        "AUTH login_success user_id=%s username=%s staff=%s superuser=%s ip=%s",
        getattr(user, 'id', None), getattr(user, 'username', None), getattr(user, 'is_staff', None), getattr(user, 'is_superuser', None), remote_addr
    )


@receiver(user_logged_out)
def log_user_logged_out(sender, request, user, **kwargs):
    """Log logouts to complete the auth trail."""
    remote_addr = None
    try:
        if request is not None:
            remote_addr = request.META.get('REMOTE_ADDR')
            xff = request.META.get('HTTP_X_FORWARDED_FOR')
            if xff:
                remote_addr = xff.split(',')[0].strip()
    except Exception:
        pass

    logger.info(
        "AUTH logout user_id=%s username=%s ip=%s",
        getattr(user, 'id', None), getattr(user, 'username', None), remote_addr
    )


@receiver(post_save, sender=get_user_model())
def ensure_useraccount_exists(sender, instance, created, **kwargs):
    """Ensure a UserAccount record exists for every Django User."""
    try:
        if created:
            # Create linked UserAccount with normalized email
            UserAccount.objects.get_or_create(user=instance, defaults={'email': (getattr(instance, 'email', '') or '').lower()})
        else:
            # Keep email in sync (lowercased)
            acc = getattr(instance, 'account', None)
            if acc and acc.email != (instance.email or '').lower():
                acc.email = (instance.email or '').lower()
                acc.save(update_fields=['email'])
    except Exception:
        # Avoid breaking auth flows due to side-effect errors
        pass
