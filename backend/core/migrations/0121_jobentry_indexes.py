from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0120_merge_20251215_1119'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='jobentry',
            index=models.Index(fields=['candidate', 'created_at'], name='jobentry_candidate_created_idx'),
        ),
        migrations.AddIndex(
            model_name='jobentry',
            index=models.Index(fields=['candidate', 'application_deadline'], name='jobentry_candidate_deadline_idx'),
        ),
    ]
