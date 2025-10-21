# Generated manually to align with project requirements.
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CandidateProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('headline', models.CharField(blank=True, max_length=255)),
                ('bio', models.TextField(blank=True)),
                ('location', models.CharField(blank=True, max_length=255)),
                ('years_experience', models.PositiveIntegerField(blank=True, null=True)),
                ('job_search_status', models.CharField(blank=True, max_length=100)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='JobOpportunity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('company', models.CharField(max_length=200)),
                ('location', models.CharField(blank=True, max_length=200)),
                ('description', models.TextField(blank=True)),
                ('application_url', models.URLField(blank=True)),
                ('source', models.CharField(blank=True, max_length=120)),
                ('salary_range', models.CharField(blank=True, max_length=120)),
                ('posted_at', models.DateField(blank=True, null=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='Skill',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name='CandidatePreference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('desired_role', models.CharField(blank=True, max_length=200)),
                ('desired_location', models.CharField(blank=True, max_length=200)),
                ('salary_min', models.PositiveIntegerField(blank=True, null=True)),
                ('salary_max', models.PositiveIntegerField(blank=True, null=True)),
                ('remote', models.BooleanField(default=False)),
                ('profile', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='preferences', to='ats.candidateprofile')),
            ],
        ),
        migrations.CreateModel(
            name='CandidateExperience',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('company', models.CharField(max_length=200)),
                ('start_date', models.DateField()),
                ('end_date', models.DateField(blank=True, null=True)),
                ('is_current', models.BooleanField(default=False)),
                ('description', models.TextField(blank=True)),
                ('profile', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='experiences', to='ats.candidateprofile')),
            ],
            options={'ordering': ['-start_date']},
        ),
        migrations.CreateModel(
            name='CandidateSkill',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('proficiency', models.IntegerField(choices=[(1, 'Beginner'), (2, 'Intermediate'), (3, 'Advanced'), (4, 'Expert')], default=1)),
                ('years_used', models.PositiveIntegerField(default=0)),
                ('profile', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='skills', to='ats.candidateprofile')),
                ('skill', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='candidates', to='ats.skill')),
            ],
            options={'unique_together': {('profile', 'skill')}},
        ),
        migrations.CreateModel(
            name='Document',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('document_type', models.CharField(choices=[('resume', 'Resume'), ('cover_letter', 'Cover Letter'), ('portfolio', 'Portfolio'), ('other', 'Other')], max_length=50)),
                ('file', models.FileField(upload_to='documents/')),
                ('version', models.PositiveIntegerField(default=1)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('notes', models.TextField(blank=True)),
                ('profile', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='ats.candidateprofile')),
            ],
            options={'ordering': ['-uploaded_at'], 'unique_together': {('profile', 'name', 'version')}},
        ),
        migrations.CreateModel(
            name='Application',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('interested', 'Interested'), ('applied', 'Applied'), ('interview', 'Interview'), ('offer', 'Offer'), ('rejected', 'Rejected'), ('withdrawn', 'Withdrawn')], default='interested', max_length=20)),
                ('applied_at', models.DateTimeField(blank=True, null=True)),
                ('last_updated', models.DateTimeField(auto_now=True)),
                ('notes', models.TextField(blank=True)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='applications', to='ats.jobopportunity')),
                ('profile', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='applications', to='ats.candidateprofile')),
            ],
            options={'unique_together': {('profile', 'job')}},
        ),
        migrations.CreateModel(
            name='AnalyticsSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('metric', models.CharField(max_length=120)),
                ('value', models.FloatField()),
                ('period_start', models.DateField()),
                ('period_end', models.DateField()),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('profile', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='analytics_snapshots', to='ats.candidateprofile')),
            ],
            options={'ordering': ['-period_end', 'metric'], 'unique_together': {('profile', 'metric', 'period_start', 'period_end')}},
        ),
        migrations.CreateModel(
            name='ApplicationStatusHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('from_status', models.CharField(choices=[('interested', 'Interested'), ('applied', 'Applied'), ('interview', 'Interview'), ('offer', 'Offer'), ('rejected', 'Rejected'), ('withdrawn', 'Withdrawn')], max_length=20)),
                ('to_status', models.CharField(choices=[('interested', 'Interested'), ('applied', 'Applied'), ('interview', 'Interview'), ('offer', 'Offer'), ('rejected', 'Rejected'), ('withdrawn', 'Withdrawn')], max_length=20)),
                ('changed_at', models.DateTimeField(auto_now_add=True)),
                ('note', models.CharField(blank=True, max_length=255)),
                ('application', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='history', to='ats.application')),
            ],
            options={'ordering': ['-changed_at']},
        ),
        migrations.CreateModel(
            name='DocumentUsage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('used_at', models.DateTimeField(auto_now_add=True)),
                ('application', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='ats.application')),
                ('document', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='usage_records', to='ats.document')),
            ],
            options={'unique_together': {('document', 'application')}},
        ),
    ]

