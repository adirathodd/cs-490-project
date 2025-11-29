from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0057_referraloutcome_referralrequest_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='MentorshipRequest',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('role_for_requester', models.CharField(choices=[('mentor', 'Mentor'), ('mentee', 'Mentee')], max_length=20)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('declined', 'Declined'), ('cancelled', 'Cancelled')], default='pending', max_length=20)),
                ('message', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('responded_at', models.DateTimeField(blank=True, null=True)),
                ('receiver', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='received_mentorship_requests', to='core.candidateprofile')),
                ('requester', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sent_mentorship_requests', to='core.candidateprofile')),
                ('responded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='mentorship_responses', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='mentorshiprequest',
            index=models.Index(fields=['requester', 'status'], name='core_mr_request_status'),
        ),
        migrations.AddIndex(
            model_name='mentorshiprequest',
            index=models.Index(fields=['receiver', 'status'], name='core_mr_receiv_status'),
        ),
        migrations.AddConstraint(
            model_name='mentorshiprequest',
            constraint=models.UniqueConstraint(condition=models.Q(('status', 'pending')), fields=('requester', 'receiver'), name='unique_pending_mentorship_request'),
        ),
        migrations.CreateModel(
            name='MentorshipSharingPreference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('share_profile_basics', models.BooleanField(default=False)),
                ('share_skills', models.BooleanField(default=False)),
                ('share_employment', models.BooleanField(default=False)),
                ('share_education', models.BooleanField(default=False)),
                ('share_certifications', models.BooleanField(default=False)),
                ('share_documents', models.BooleanField(default=False)),
                ('share_job_applications', models.BooleanField(default=False)),
                ('job_sharing_mode', models.CharField(choices=[('none', 'Do not share jobs'), ('all', 'Share all jobs'), ('responded', 'Share jobs with responses'), ('selected', 'Share selected jobs')], default='selected', max_length=20)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('team_member', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='sharing_preference', to='core.teammember')),
            ],
        ),
        migrations.CreateModel(
            name='MentorshipSharedApplication',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('include_documents', models.BooleanField(default=False)),
                ('notes', models.TextField(blank=True)),
                ('shared_at', models.DateTimeField(auto_now_add=True)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='mentorship_shares', to='core.jobentry')),
                ('shared_cover_letter', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='core.document')),
                ('shared_resume', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='core.document')),
                ('team_member', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shared_applications', to='core.teammember')),
            ],
        ),
        migrations.AddIndex(
            model_name='mentorshipsharedapplication',
            index=models.Index(fields=['team_member', 'job'], name='core_mshare_team_job'),
        ),
        migrations.AlterUniqueTogether(
            name='mentorshipsharedapplication',
            unique_together={('team_member', 'job')},
        ),
        migrations.CreateModel(
            name='MentorshipGoal',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('goal_type', models.CharField(choices=[('applications_submitted', 'Job applications submitted'), ('skills_added', 'Skills added'), ('projects_completed', 'Projects completed'), ('skill_add', 'Add a specific skill'), ('skill_improve', 'Improve an existing skill'), ('interview_practice', 'Interview practice questions')], max_length=40)),
                ('title', models.CharField(blank=True, max_length=255)),
                ('notes', models.TextField(blank=True)),
                ('target_value', models.PositiveIntegerField(default=1)),
                ('baseline_value', models.PositiveIntegerField(default=0)),
                ('due_date', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('active', 'Active'), ('completed', 'Completed'), ('cancelled', 'Cancelled')], default='active', max_length=20)),
                ('custom_skill_name', models.CharField(blank=True, max_length=160)),
                ('required_level', models.CharField(blank=True, choices=[('beginner', 'Beginner'), ('intermediate', 'Intermediate'), ('advanced', 'Advanced'), ('expert', 'Expert')], max_length=20)),
                ('starting_level', models.CharField(blank=True, choices=[('beginner', 'Beginner'), ('intermediate', 'Intermediate'), ('advanced', 'Advanced'), ('expert', 'Expert')], max_length=20)),
                ('metric_scope', models.CharField(blank=True, max_length=60)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('skill', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='mentorship_goal_targets', to='core.skill')),
                ('team_member', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='mentorship_goals', to='core.teammember')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='mentorshipgoal',
            index=models.Index(fields=['team_member', 'status'], name='core_mentor_team_me_8c8455_idx'),
        ),
        migrations.AddIndex(
            model_name='mentorshipgoal',
            index=models.Index(fields=['goal_type'], name='core_mentor_goal_ty_17e26d_idx'),
        ),
        migrations.AddField(
            model_name='candidateskill',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name='candidateskill',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.CreateModel(
            name='MentorshipMessage',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('message', models.TextField()),
                ('is_read_by_mentor', models.BooleanField(default=False)),
                ('is_read_by_mentee', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('sender', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='mentorship_messages', to=settings.AUTH_USER_MODEL)),
                ('team_member', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='core.teammember')),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='mentorshipmessage',
            index=models.Index(fields=['team_member', '-created_at'], name='core_mentors_team_me_efacc8_idx'),
        ),
    ]
