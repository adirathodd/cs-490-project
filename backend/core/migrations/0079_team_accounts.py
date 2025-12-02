from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0078_merge_20251130_1658'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TeamAccount',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=180)),
                ('billing_email', models.EmailField(blank=True, max_length=254)),
                ('subscription_plan', models.CharField(choices=[('starter', 'Starter'), ('pro', 'Professional'), ('enterprise', 'Enterprise')], default='starter', max_length=40)),
                ('subscription_status', models.CharField(choices=[('active', 'Active'), ('trialing', 'Trialing'), ('past_due', 'Past Due'), ('cancelled', 'Cancelled')], default='trialing', max_length=40)),
                ('seat_limit', models.PositiveIntegerField(default=5)),
                ('next_billing_date', models.DateTimeField(blank=True, null=True)),
                ('trial_ends_at', models.DateTimeField(blank=True, null=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='owned_teams', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'indexes': [models.Index(fields=['owner'], name='core_teamac_owner_c1fe62_idx'), models.Index(fields=['subscription_status'], name='core_teamac_subscri_5df6f4_idx')],
            },
        ),
        migrations.CreateModel(
            name='TeamMembership',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('admin', 'Admin'), ('mentor', 'Mentor'), ('candidate', 'Candidate')], max_length=20)),
                ('permission_level', models.CharField(choices=[('view', 'View Only'), ('comment', 'View & Comment'), ('edit', 'Edit'), ('admin', 'Admin')], default='view', max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('last_accessed_at', models.DateTimeField(blank=True, null=True)),
                ('candidate_profile', models.ForeignKey(blank=True, help_text='Link candidate role memberships to their profile for analytics', null=True, on_delete=django.db.models.deletion.SET_NULL, to='core.candidateprofile')),
                ('invited_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='team_invites_sent', to=settings.AUTH_USER_MODEL)),
                ('team', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='memberships', to='core.teamaccount')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='team_memberships', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'indexes': [models.Index(fields=['team', 'role'], name='core_teammem_team_id_930156_idx'), models.Index(fields=['team', 'permission_level'], name='core_teammem_team_id_3e0925_idx'), models.Index(fields=['user'], name='core_teammem_user_id_3c5672_idx')],
            },
        ),
        migrations.CreateModel(
            name='TeamMessage',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('message', models.TextField()),
                ('message_type', models.CharField(choices=[('update', 'Update'), ('request', 'Request'), ('alert', 'Alert'), ('note', 'Note')], default='update', max_length=20)),
                ('pinned', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('author', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='team_messages', to=settings.AUTH_USER_MODEL)),
                ('team', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='core.teamaccount')),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [models.Index(fields=['team', '-created_at'], name='core_teammem_team_id_fc0b5d_idx')],
            },
        ),
        migrations.CreateModel(
            name='TeamInvitation',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(max_length=254)),
                ('role', models.CharField(choices=[('admin', 'Admin'), ('mentor', 'Mentor'), ('candidate', 'Candidate')], max_length=20)),
                ('permission_level', models.CharField(choices=[('view', 'View Only'), ('comment', 'View & Comment'), ('edit', 'Edit'), ('admin', 'Admin')], default='view', max_length=20)),
                ('token', models.CharField(db_index=True, max_length=128, unique=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('expired', 'Expired'), ('cancelled', 'Cancelled')], default='pending', max_length=20)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('accepted_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('accepted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='team_invitations_accepted', to=settings.AUTH_USER_MODEL)),
                ('candidate_profile', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='core.candidateprofile')),
                ('invited_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='team_invitations_created', to=settings.AUTH_USER_MODEL)),
                ('team', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invitations', to='core.teamaccount')),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [models.Index(fields=['team', 'status'], name='core_teamin_team_id_2e101d_idx'), models.Index(fields=['email'], name='core_teamin_email_031d6b_idx')],
            },
        ),
        migrations.CreateModel(
            name='TeamCandidateAccess',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('permission_level', models.CharField(choices=[('view', 'View Only'), ('comment', 'View & Comment'), ('edit', 'Edit'), ('admin', 'Admin')], default='view', max_length=20)),
                ('can_view_profile', models.BooleanField(default=True)),
                ('can_view_progress', models.BooleanField(default=True)),
                ('can_edit_goals', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('candidate', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='team_access', to='core.candidateprofile')),
                ('granted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='team_access_granted', to=settings.AUTH_USER_MODEL)),
                ('granted_to', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='candidate_access', to='core.teammembership')),
                ('team', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='candidate_access', to='core.teamaccount')),
            ],
            options={
                'indexes': [models.Index(fields=['team', 'candidate'], name='core_teamcan_team_id_a24e14_idx'), models.Index(fields=['team', 'granted_to'], name='core_teamcan_team_id_3f814f_idx')],
            },
        ),
        migrations.AddConstraint(
            model_name='teammembership',
            constraint=models.UniqueConstraint(fields=('team', 'user'), name='core_teammembership_team_user_uniq'),
        ),
        migrations.AddConstraint(
            model_name='teamcandidateaccess',
            constraint=models.UniqueConstraint(fields=('team', 'candidate', 'granted_to'), name='core_teamcandidate_team_cand_member_uniq'),
        ),
    ]
