from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0050_interviewevent'),
    ]

    operations = [
        migrations.AddField(
            model_name='interviewevent',
            name='external_event_link',
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.CreateModel(
            name='CalendarIntegration',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(choices=[('in_app', 'In-App Only'), ('google', 'Google Calendar'), ('outlook', 'Outlook Calendar'), ('other', 'Other Calendar')], max_length=20)),
                ('external_email', models.EmailField(blank=True, max_length=254)),
                ('external_account_id', models.CharField(blank=True, max_length=255)),
                ('access_token', models.TextField(blank=True)),
                ('refresh_token', models.TextField(blank=True)),
                ('token_expires_at', models.DateTimeField(blank=True, null=True)),
                ('scopes', models.JSONField(blank=True, default=list)),
                ('sync_enabled', models.BooleanField(default=False)),
                ('status', models.CharField(choices=[('disconnected', 'Disconnected'), ('pending', 'Pending Authorization'), ('connected', 'Connected'), ('error', 'Error')], default='disconnected', max_length=20)),
                ('last_synced_at', models.DateTimeField(blank=True, null=True)),
                ('last_error', models.TextField(blank=True)),
                ('state_token', models.CharField(blank=True, max_length=128)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('candidate', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='calendar_integrations', to='core.candidateprofile')),
            ],
            options={
                'indexes': [
                    models.Index(fields=['candidate', 'provider'], name='core_cal_cand_provider_idx'),
                    models.Index(fields=['provider', 'status'], name='core_cal_prov_status_idx'),
                ],
                'unique_together': {('candidate', 'provider')},
            },
        ),
    ]
