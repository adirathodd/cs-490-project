from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings

class Migration(migrations.Migration):

    initial = False

    dependencies = [
        ('core', '0029_merge_20251111_1637'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    # This migration was superseded by 0039_contacts_uc086 to avoid a duplicate
    # migration-number conflict in the repository. It is intentionally a no-op
    # to preserve history while ensuring a deterministic migration graph for
    # development environments.
    operations = []
