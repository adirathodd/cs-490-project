# Generated migration for UC-052: Resume Sharing and Feedback

import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0025_merge_20251111_1221'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ResumeShare model
        migrations.CreateModel(
            name='ResumeShare',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('share_token', models.CharField(db_index=True, help_text='Unique token for shareable link', max_length=64, unique=True)),
                ('privacy_level', models.CharField(choices=[('public', 'Public - Anyone with link can view'), ('password', 'Password Protected'), ('email_verified', 'Email Verified Only'), ('private', 'Private - Owner Only')], default='public', max_length=20)),
                ('password_hash', models.CharField(blank=True, help_text='Hashed password for password-protected shares', max_length=128)),
                ('allowed_emails', models.JSONField(blank=True, default=list, help_text='List of email addresses allowed to access (for email_verified mode)')),
                ('allowed_domains', models.JSONField(blank=True, default=list, help_text='List of email domains allowed to access')),
                ('allow_comments', models.BooleanField(default=True, help_text='Allow reviewers to leave comments')),
                ('allow_download', models.BooleanField(default=False, help_text='Allow reviewers to download the resume')),
                ('require_reviewer_info', models.BooleanField(default=True, help_text='Require reviewers to provide name/email before accessing')),
                ('view_count', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('expires_at', models.DateTimeField(blank=True, help_text='Optional expiration date for the share link', null=True)),
                ('is_active', models.BooleanField(default=True, help_text='Deactivate to disable access without deleting')),
                ('share_message', models.TextField(blank=True, help_text='Optional message to display to reviewers')),
                ('resume_version', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shares', to='core.resumeversion')),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['share_token'], name='core_resum_share_t_idx'),
                    models.Index(fields=['resume_version', '-created_at'], name='core_resum_resume_v_idx'),
                    models.Index(fields=['is_active', 'expires_at'], name='core_resum_is_acti_idx'),
                ],
            },
        ),
        
        # ShareAccessLog model
        migrations.CreateModel(
            name='ShareAccessLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('reviewer_name', models.CharField(blank=True, max_length=200)),
                ('reviewer_email', models.EmailField(blank=True, max_length=254)),
                ('reviewer_ip', models.GenericIPAddressField(blank=True, null=True)),
                ('accessed_at', models.DateTimeField(auto_now_add=True)),
                ('action', models.CharField(choices=[('view', 'Viewed'), ('download', 'Downloaded'), ('comment', 'Commented')], default='view', max_length=20)),
                ('share', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='access_logs', to='core.resumeshare')),
            ],
            options={
                'ordering': ['-accessed_at'],
                'indexes': [
                    models.Index(fields=['share', '-accessed_at'], name='core_share_share_a_idx'),
                    models.Index(fields=['reviewer_email', '-accessed_at'], name='core_share_reviewe_idx'),
                ],
            },
        ),
        
        # ResumeFeedback model
        migrations.CreateModel(
            name='ResumeFeedback',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('reviewer_name', models.CharField(max_length=200)),
                ('reviewer_email', models.EmailField(max_length=254)),
                ('reviewer_title', models.CharField(blank=True, help_text="e.g., 'Senior Recruiter at TechCorp'", max_length=200)),
                ('overall_feedback', models.TextField(help_text='General comments about the resume')),
                ('rating', models.PositiveSmallIntegerField(blank=True, help_text='Optional rating (1-5 stars)', null=True)),
                ('status', models.CharField(choices=[('pending', 'Pending Review'), ('in_review', 'Under Review'), ('addressed', 'Addressed'), ('resolved', 'Resolved'), ('dismissed', 'Dismissed')], default='pending', max_length=20)),
                ('is_resolved', models.BooleanField(default=False)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('resolution_notes', models.TextField(blank=True, help_text='Notes about how feedback was addressed')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('incorporated_in_version', models.ForeignKey(blank=True, help_text='Version that incorporated this feedback', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='incorporated_feedback', to='core.resumeversion')),
                ('resume_version', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='feedback_received', to='core.resumeversion')),
                ('share', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='feedback_items', to='core.resumeshare')),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['resume_version', '-created_at'], name='core_resume_resume_v_fb_idx'),
                    models.Index(fields=['share', '-created_at'], name='core_resume_share_fb_idx'),
                    models.Index(fields=['status', '-created_at'], name='core_resume_status_fb_idx'),
                    models.Index(fields=['reviewer_email', '-created_at'], name='core_resume_reviewe_fb_idx'),
                ],
            },
        ),
        
        # FeedbackComment model
        migrations.CreateModel(
            name='FeedbackComment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('commenter_name', models.CharField(max_length=200)),
                ('commenter_email', models.EmailField(max_length=254)),
                ('is_owner', models.BooleanField(default=False, help_text='True if comment is from resume owner (response)')),
                ('comment_type', models.CharField(choices=[('general', 'General Comment'), ('suggestion', 'Suggestion'), ('question', 'Question'), ('praise', 'Praise'), ('concern', 'Concern')], default='general', max_length=20)),
                ('comment_text', models.TextField()),
                ('section', models.CharField(blank=True, help_text="Resume section this comment refers to (e.g., 'experience', 'skills')", max_length=100)),
                ('section_index', models.IntegerField(blank=True, help_text='Index of item within section (for specific bullet points)', null=True)),
                ('highlighted_text', models.TextField(blank=True, help_text='Specific text this comment refers to')),
                ('is_resolved', models.BooleanField(default=False)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('helpful_count', models.PositiveIntegerField(default=0)),
                ('feedback', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='comments', to='core.resumefeedback')),
                ('parent_comment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='replies', to='core.feedbackcomment')),
            ],
            options={
                'ordering': ['created_at'],
                'indexes': [
                    models.Index(fields=['feedback', '-created_at'], name='core_feedba_feedbac_cmt_idx'),
                    models.Index(fields=['parent_comment', '-created_at'], name='core_feedba_parent__cmt_idx'),
                    models.Index(fields=['section', 'section_index'], name='core_feedba_section_cmt_idx'),
                ],
            },
        ),
        
        # FeedbackNotification model
        migrations.CreateModel(
            name='FeedbackNotification',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('notification_type', models.CharField(choices=[('new_feedback', 'New Feedback Received'), ('new_comment', 'New Comment on Your Resume'), ('feedback_reply', 'Reply to Your Feedback'), ('feedback_resolved', 'Feedback Marked as Resolved'), ('share_accessed', 'Resume Share Accessed')], max_length=30)),
                ('title', models.CharField(max_length=200)),
                ('message', models.TextField()),
                ('is_read', models.BooleanField(default=False)),
                ('read_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('action_url', models.CharField(blank=True, help_text='URL to view the feedback/comment', max_length=500)),
                ('comment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to='core.feedbackcomment')),
                ('feedback', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to='core.resumefeedback')),
                ('share', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to='core.resumeshare')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='feedback_notifications', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['user', '-created_at'], name='core_feedba_user_notif_idx'),
                    models.Index(fields=['user', 'is_read', '-created_at'], name='core_feedba_user_is_notif_idx'),
                ],
            },
        ),
    ]
