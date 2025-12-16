from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0122_deployment_tracking'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='jobentry',
            index=models.Index(
                fields=['candidate', 'is_archived', 'status'],
                name='jobentry_arch_status_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='jobentry',
            index=models.Index(
                fields=['candidate', 'is_archived', '-updated_at'],
                name='jobentry_arch_updated_idx',
            ),
        ),
    ]
