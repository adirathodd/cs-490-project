from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0109_add_career_growth_calculator'),
    ]

    operations = [
        migrations.AddField(
            model_name='followupreminder',
            name='auto_scheduled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='followupreminder',
            name='completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='followupreminder',
            name='followup_stage',
            field=models.CharField(blank=True, choices=[('interested', 'Interested'), ('applied', 'Applied'), ('phone_screen', 'Phone Screen'), ('interview', 'Interview'), ('offer', 'Offer'), ('rejected', 'Rejected')], help_text='Job stage when the reminder was created', max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='followupreminder',
            name='recommendation_reason',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='followupreminder',
            name='snoozed_until',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name='followupreminder',
            index=models.Index(fields=['job', 'followup_stage'], name='core_follow_job_id_stg_idx'),
        ),
    ]
