# Generated manually for LinkedIn integration
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0063_merge_conflicting_merges'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Create LinkedInIntegration model
        migrations.CreateModel(
            name='LinkedInIntegration',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('access_token', models.TextField(blank=True)),
                ('refresh_token', models.TextField(blank=True)),
                ('token_expires_at', models.DateTimeField(blank=True, null=True)),
                ('linkedin_id', models.CharField(blank=True, max_length=100, null=True, unique=True)),
                ('linkedin_profile_url', models.URLField(blank=True)),
                ('last_sync_date', models.DateTimeField(blank=True, null=True)),
                ('import_status', models.CharField(
                    choices=[
                        ('not_connected', 'Not Connected'),
                        ('connected', 'Connected'),
                        ('synced', 'Synced'),
                        ('error', 'Error')
                    ],
                    default='not_connected',
                    max_length=20
                )),
                ('last_error', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='linkedin_integration',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
        ),
        
        # Add LinkedIn fields to CandidateProfile
        migrations.AddField(
            model_name='candidateprofile',
            name='linkedin_url',
            field=models.URLField(blank=True, help_text='LinkedIn profile URL'),
        ),
        migrations.AddField(
            model_name='candidateprofile',
            name='linkedin_imported',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='candidateprofile',
            name='linkedin_import_date',
            field=models.DateTimeField(blank=True, null=True),
        ),
        
        # Add indexes
        migrations.AddIndex(
            model_name='linkedinintegration',
            index=models.Index(fields=['user'], name='core_linked_user_id_idx'),
        ),
        migrations.AddIndex(
            model_name='linkedinintegration',
            index=models.Index(fields=['linkedin_id'], name='core_linked_linkedin_id_idx'),
        ),
    ]
