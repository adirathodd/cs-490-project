# Generated manually for MaterialVersion and MaterialVersionApplication

import django.db.models.deletion
import django.utils.timezone
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0115_merge_20251214_1825'),
    ]

    operations = [
        migrations.CreateModel(
            name='MaterialVersion',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('material_type', models.CharField(choices=[('resume', 'Resume'), ('cover_letter', 'Cover Letter')], max_length=20)),
                ('version_label', models.CharField(help_text="Version label (e.g., 'Version A', 'Version B', 'Technical Focus')", max_length=50)),
                ('description', models.TextField(blank=True, help_text='Description of what makes this version unique')),
                ('is_archived', models.BooleanField(default=False, help_text='Archived versions are hidden from active selection')),
                ('is_active', models.BooleanField(default=True, help_text='Whether this version is currently in use')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('archived_at', models.DateTimeField(blank=True, null=True)),
                ('candidate', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='material_versions', to='core.candidateprofile')),
                ('document', models.ForeignKey(blank=True, help_text='Link to the actual document if uploaded', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tracked_versions', to='core.document')),
            ],
            options={
                'ordering': ['material_type', 'version_label'],
            },
        ),
        migrations.CreateModel(
            name='MaterialVersionApplication',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('company_name', models.CharField(blank=True, max_length=220)),
                ('job_title', models.CharField(blank=True, max_length=220)),
                ('applied_date', models.DateField(default=django.utils.timezone.now)),
                ('outcome', models.CharField(choices=[('pending', 'Pending / No Response Yet'), ('no_response', 'No Response'), ('response_received', 'Response Received'), ('interview', 'Interview Scheduled'), ('offer', 'Offer Received'), ('rejection', 'Rejection')], default='pending', max_length=20)),
                ('outcome_date', models.DateField(blank=True, null=True)),
                ('outcome_notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('application', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='material_version_tracking', to='core.application')),
                ('job', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='material_version_tracking', to='core.jobentry')),
                ('material_version', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='applications', to='core.materialversion')),
            ],
            options={
                'ordering': ['-applied_date'],
            },
        ),
        migrations.AddIndex(
            model_name='materialversion',
            index=models.Index(fields=['candidate', 'material_type'], name='core_materi_candida_93a38d_idx'),
        ),
        migrations.AddIndex(
            model_name='materialversion',
            index=models.Index(fields=['candidate', 'is_archived'], name='core_materi_candida_af77d6_idx'),
        ),
        migrations.AddConstraint(
            model_name='materialversion',
            constraint=models.UniqueConstraint(fields=('candidate', 'material_type', 'version_label'), name='unique_material_version_label'),
        ),
        migrations.AddIndex(
            model_name='materialversionapplication',
            index=models.Index(fields=['material_version', 'outcome'], name='core_materi_materia_ab2e12_idx'),
        ),
        migrations.AddIndex(
            model_name='materialversionapplication',
            index=models.Index(fields=['material_version', '-applied_date'], name='core_materi_materia_fed101_idx'),
        ),
    ]
