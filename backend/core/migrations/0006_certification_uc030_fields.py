from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_education_achievements_education_currently_enrolled_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='certification',
            name='category',
            field=models.CharField(max_length=100, blank=True),
        ),
        migrations.AddField(
            model_name='certification',
            name='verification_status',
            field=models.CharField(
                max_length=20,
                default='unverified',
                choices=[
                    ('unverified', 'Unverified'),
                    ('pending', 'Pending'),
                    ('verified', 'Verified'),
                    ('rejected', 'Rejected'),
                ],
            ),
        ),
        migrations.AddField(
            model_name='certification',
            name='document',
            field=models.FileField(upload_to='certifications/%Y/%m/', null=True, blank=True),
        ),
        migrations.AddField(
            model_name='certification',
            name='renewal_reminder_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='certification',
            name='reminder_days_before',
            field=models.PositiveSmallIntegerField(default=30),
        ),
    ]
