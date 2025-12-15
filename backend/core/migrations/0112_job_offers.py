from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0111_application_quality_review'),
    ]

    operations = [
        migrations.CreateModel(
            name='JobOffer',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role_title', models.CharField(max_length=220)),
                ('company_name', models.CharField(max_length=220)),
                ('location', models.CharField(blank=True, max_length=200)),
                ('remote_policy', models.CharField(choices=[('onsite', 'Onsite'), ('hybrid', 'Hybrid'), ('remote', 'Remote')], default='onsite', max_length=20)),
                ('base_salary', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('bonus', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('equity', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('benefits_breakdown', models.JSONField(blank=True, default=dict)),
                ('benefits_total_value', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('benefits_notes', models.TextField(blank=True)),
                ('culture_fit_score', models.PositiveSmallIntegerField(blank=True, help_text='1-10 score', null=True)),
                ('growth_opportunity_score', models.PositiveSmallIntegerField(blank=True, help_text='1-10 score', null=True)),
                ('work_life_balance_score', models.PositiveSmallIntegerField(blank=True, help_text='1-10 score', null=True)),
                ('cost_of_living_index', models.DecimalField(decimal_places=2, default=100, max_digits=6)),
                ('notes', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('pending', 'Decision Pending'), ('accepted', 'Accepted'), ('declined', 'Declined'), ('archived', 'Archived')], default='pending', max_length=20)),
                ('decline_reason', models.CharField(blank=True, max_length=120)),
                ('archived_reason', models.CharField(blank=True, max_length=120)),
                ('archived_at', models.DateTimeField(blank=True, null=True)),
                ('scenario_label', models.CharField(blank=True, help_text='Last scenario applied', max_length=120)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('candidate', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='job_offers', to='core.candidateprofile')),
                ('job', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='job_offers', to='core.jobentry')),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AddIndex(
            model_name='joboffer',
            index=models.Index(fields=['candidate', '-updated_at'], name='core_joboff_candidat_4fbb41_idx'),
        ),
        migrations.AddIndex(
            model_name='joboffer',
            index=models.Index(fields=['candidate', 'status'], name='core_joboff_candidat_6055e4_idx'),
        ),
        migrations.AddIndex(
            model_name='joboffer',
            index=models.Index(fields=['status'], name='core_joboff_status_5450a9_idx'),
        ),
    ]
