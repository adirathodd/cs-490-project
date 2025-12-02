from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0078_merge_20251130_1658'),
    ]

    operations = [
        migrations.AddField(
            model_name='mentorshipsharingpreference',
            name='share_accountability_insights',
            field=models.BooleanField(default=True, help_text='Allow sharing of accountability impact/insights'),
        ),
        migrations.AddField(
            model_name='mentorshipsharingpreference',
            name='share_goal_progress',
            field=models.BooleanField(default=True, help_text='Allow mentors/accountability partners to see detailed goal progress'),
        ),
        migrations.AddField(
            model_name='mentorshipsharingpreference',
            name='share_milestones',
            field=models.BooleanField(default=True, help_text='Allow sharing of milestone-level achievements'),
        ),
        migrations.AddField(
            model_name='mentorshipsharingpreference',
            name='share_practice_insights',
            field=models.BooleanField(default=True, help_text='Allow sharing of practice/engagement insights in reports'),
        ),
        migrations.CreateModel(
            name='AccountabilityEngagement',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(choices=[('report_viewed', 'Progress report viewed'), ('encouragement', 'Encouragement sent'), ('celebration', 'Celebration shared'), ('check_in', 'Check-in logged'), ('comment', 'Commented on progress')], max_length=40)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='accountability_events', to=settings.AUTH_USER_MODEL)),
                ('team_member', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='accountability_engagements', to='core.teammember')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='accountabilityengagement',
            index=models.Index(fields=['team_member', 'event_type', '-created_at'], name='core_accoun_team_me_51fe72_idx'),
        ),
    ]
