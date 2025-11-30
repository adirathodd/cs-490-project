# Generated migration for UC-052: Resume Sharing and Feedback
# NOTE: This is a no-op migration as the tables were already created in 0026_b_uc_052_resume_sharing_feedback


import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0057_referraloutcome_referralrequest_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # No operations - tables already exist from 0026_b_uc_052_resume_sharing_feedback
    ]