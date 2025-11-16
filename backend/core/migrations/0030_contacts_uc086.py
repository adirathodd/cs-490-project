from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings

class Migration(migrations.Migration):

    initial = False

    dependencies = [
        ('core', '0029_merge_20251111_1637'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Tag',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=120)),
                ('type', models.CharField(blank=True, max_length=40)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contact_tags', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('owner', 'name')},
            },
        ),
        migrations.CreateModel(
            name='Contact',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('first_name', models.CharField(blank=True, max_length=128)),
                ('last_name', models.CharField(blank=True, max_length=128)),
                ('display_name', models.CharField(blank=True, max_length=256)),
                ('title', models.CharField(blank=True, max_length=256)),
                ('email', models.EmailField(blank=True, db_index=True, max_length=254, null=True)),
                ('phone', models.CharField(blank=True, max_length=64)),
                ('location', models.CharField(blank=True, max_length=160)),
                ('company_name', models.CharField(blank=True, db_index=True, max_length=256)),
                ('linkedin_url', models.URLField(blank=True)),
                ('profile_url', models.URLField(blank=True)),
                ('photo_url', models.URLField(blank=True)),
                ('industry', models.CharField(blank=True, max_length=120)),
                ('role', models.CharField(blank=True, max_length=120)),
                ('relationship_type', models.CharField(blank=True, max_length=40)),
                ('relationship_strength', models.PositiveSmallIntegerField(default=50)),
                ('last_interaction', models.DateTimeField(blank=True, null=True)),
                ('external_id', models.CharField(blank=True, db_index=True, max_length=256)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('is_private', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='contacts', to='core.company')),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contacts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'indexes': [
                    models.Index(fields=['owner', 'email'], name='idx_core_contact_owner_email'),
                    models.Index(fields=['owner', 'company_name'], name='idx_core_contact_owner_company'),
                ],
            },
        ),
        migrations.AddField(
            model_name='contact',
            name='tags',
            field=models.ManyToManyField(blank=True, related_name='tagged_contacts', to='core.Tag'),
        ),
        migrations.CreateModel(
            name='ContactNote',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('content', models.TextField(blank=True)),
                ('interests', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('author', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contact_notes', to=settings.AUTH_USER_MODEL)),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notes', to='core.contact')),
            ],
        ),
        migrations.CreateModel(
            name='Interaction',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('type', models.CharField(default='email', max_length=32)),
                ('date', models.DateTimeField(default=django.utils.timezone.now)),
                ('duration_minutes', models.PositiveIntegerField(blank=True, null=True)),
                ('summary', models.TextField(blank=True)),
                ('follow_up_needed', models.BooleanField(default=False)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='interactions', to='core.contact')),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='interactions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'indexes': [
                    models.Index(fields=['contact', '-date'], name='idx_core_interaction_contact_date'),
                    models.Index(fields=['owner', '-date'], name='idx_core_interaction_owner_date'),
                ],
            },
        ),
        migrations.CreateModel(
            name='Reminder',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('message', models.CharField(max_length=512)),
                ('due_date', models.DateTimeField()),
                ('recurrence', models.CharField(default='none', max_length=20)),
                ('completed', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reminders', to='core.contact')),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reminders', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'indexes': [
                    models.Index(fields=['owner', 'due_date'], name='idx_core_reminder_owner_duedate'),
                    models.Index(fields=['contact', 'due_date'], name='idx_core_reminder_contact_duedate'),
                ],
            },
        ),
        migrations.CreateModel(
            name='ImportJob',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('provider', models.CharField(max_length=40)),
                ('status', models.CharField(default='pending', max_length=20)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('errors', models.JSONField(blank=True, default=list)),
                ('result_summary', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contact_imports', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'indexes': [models.Index(fields=['owner', 'provider', 'status'], name='idx_core_importjob_owner_provider_status')],
            },
        ),
        migrations.CreateModel(
            name='MutualConnection',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('context', models.CharField(blank=True, max_length=256)),
                ('source', models.CharField(blank=True, max_length=80)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='mutual_connections', to='core.contact')),
                ('related_contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='related_to', to='core.contact')),
            ],
            options={
                'indexes': [models.Index(fields=['contact', 'related_contact'], name='idx_core_mutualconnection_contact_related')],
            },
        ),
        migrations.CreateModel(
            name='ContactCompanyLink',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('role_title', models.CharField(blank=True, max_length=220)),
                ('start_date', models.DateField(blank=True, null=True)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contact_links', to='core.company')),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='company_links', to='core.contact')),
            ],
            options={
                'indexes': [models.Index(fields=['contact', 'company'], name='idx_core_contactcompanylink_contact_company')],
            },
        ),
        migrations.CreateModel(
            name='ContactJobLink',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('relationship_to_job', models.CharField(blank=True, max_length=80)),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='job_links', to='core.contact')),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contact_links', to='core.jobopportunity')),
            ],
            options={
                'indexes': [models.Index(fields=['contact', 'job'], name='idx_core_contactjoblink_contact_job')],
            },
        ),
    ]
