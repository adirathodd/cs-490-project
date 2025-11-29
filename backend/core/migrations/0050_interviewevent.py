from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0049_merge_20251126_0417'),
    ]

    operations = [
        migrations.CreateModel(
            name='InterviewEvent',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('calendar_provider', models.CharField(choices=[('in_app', 'In-App Only'), ('google', 'Google Calendar'), ('outlook', 'Outlook Calendar'), ('other', 'Other Calendar')], default='in_app', max_length=20)),
                ('external_calendar_id', models.CharField(blank=True, max_length=255)),
                ('external_event_id', models.CharField(blank=True, max_length=255)),
                ('sync_enabled', models.BooleanField(default=False)),
                ('sync_status', models.CharField(choices=[('not_synced', 'Not Synced'), ('pending', 'Pending Sync'), ('synced', 'Synced'), ('failed', 'Sync Failed'), ('disconnected', 'Disconnected')], default='not_synced', max_length=20)),
                ('last_synced_at', models.DateTimeField(blank=True, null=True)),
                ('location_override', models.CharField(blank=True, max_length=500)),
                ('video_conference_link', models.URLField(blank=True, max_length=500)),
                ('logistics_notes', models.TextField(blank=True)),
                ('dial_in_details', models.CharField(blank=True, max_length=500)),
                ('reminder_24h_sent', models.BooleanField(default=False)),
                ('reminder_2h_sent', models.BooleanField(default=False)),
                ('thank_you_note_sent', models.BooleanField(default=False)),
                ('thank_you_note_sent_at', models.DateTimeField(blank=True, null=True)),
                ('follow_up_status', models.CharField(choices=[('pending', 'Pending'), ('scheduled', 'Scheduled'), ('sent', 'Thank You Sent'), ('skipped', 'Skipped')], default='pending', max_length=20)),
                ('outcome_recorded_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('interview', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='event_metadata', to='core.interviewschedule')),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AddIndex(
            model_name='interviewevent',
            index=models.Index(fields=['calendar_provider', 'sync_status'], name='core_inter_calendar_a3b9ca_idx'),
        ),
        migrations.AddIndex(
            model_name='interviewevent',
            index=models.Index(fields=['interview', 'sync_status'], name='core_inter_intervie_2cd140_idx'),
        ),
        migrations.AddIndex(
            model_name='interviewevent',
            index=models.Index(fields=['follow_up_status'], name='core_inter_follow__ec5b91_idx'),
        ),
    ]
