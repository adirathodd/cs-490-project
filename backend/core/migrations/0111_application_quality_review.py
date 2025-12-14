from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0110_followupreminder_intelligent_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='ApplicationQualityReview',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('linkedin_url', models.URLField(blank=True, default='')),
                ('overall_score', models.DecimalField(decimal_places=2, max_digits=5)),
                ('alignment_score', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('keyword_score', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('consistency_score', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('formatting_score', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('missing_keywords', models.JSONField(blank=True, default=list)),
                ('missing_skills', models.JSONField(blank=True, default=list)),
                ('formatting_issues', models.JSONField(blank=True, default=list)),
                ('improvement_suggestions', models.JSONField(blank=True, default=list)),
                ('comparison_snapshot', models.JSONField(blank=True, default=dict)),
                ('threshold', models.PositiveIntegerField(default=70)),
                ('meets_threshold', models.BooleanField(default=False)),
                ('score_delta', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('candidate', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='application_quality_reviews', to='core.candidateprofile')),
                ('cover_letter_doc', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='quality_reviews_as_cover', to='core.document')),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='quality_reviews', to='core.jobentry')),
                ('resume_doc', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='quality_reviews_as_resume', to='core.document')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.AddIndex(
            model_name='applicationqualityreview',
            index=models.Index(fields=['candidate', 'job', '-created_at'], name='core_applic_candidat_39cc77_idx'),
        ),
        migrations.AddIndex(
            model_name='applicationqualityreview',
            index=models.Index(fields=['job', '-created_at'], name='core_applic_job_id_a5a6ba_idx'),
        ),
        migrations.AddIndex(
            model_name='applicationqualityreview',
            index=models.Index(fields=['candidate', '-created_at'], name='core_applic_candidat_ba38a1_idx'),
        ),
    ]

