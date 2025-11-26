from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0045_questionresponsecoaching'),
    ]

    operations = [
        migrations.CreateModel(
            name='TechnicalPrepCache',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('prep_data', models.JSONField(blank=True, default=dict)),
                ('source', models.CharField(default='template', max_length=32)),
                ('generated_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('is_valid', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='technical_prep_caches', to='core.jobentry')),
            ],
            options={
                'ordering': ['-generated_at'],
            },
        ),
        migrations.CreateModel(
            name='TechnicalPrepPractice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('challenge_id', models.CharField(max_length=64)),
                ('challenge_title', models.CharField(max_length=255)),
                ('challenge_type', models.CharField(choices=[('coding', 'Coding'), ('system_design', 'System Design'), ('case_study', 'Case Study')], default='coding', max_length=32)),
                ('duration_seconds', models.PositiveIntegerField(blank=True, null=True)),
                ('tests_passed', models.PositiveIntegerField(blank=True, null=True)),
                ('tests_total', models.PositiveIntegerField(blank=True, null=True)),
                ('score', models.PositiveIntegerField(blank=True, help_text='Percent accuracy (0-100)', null=True)),
                ('confidence', models.CharField(blank=True, max_length=20)),
                ('notes', models.TextField(blank=True)),
                ('attempted_at', models.DateTimeField(auto_now_add=True)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='technical_prep_practice', to='core.jobentry')),
            ],
            options={
                'ordering': ['-attempted_at'],
            },
        ),
        migrations.AddIndex(
            model_name='technicalprepcache',
            index=models.Index(fields=['job', 'is_valid'], name='techprep_job_valid_idx'),
        ),
        migrations.AddIndex(
            model_name='technicalprepcache',
            index=models.Index(fields=['job', '-generated_at'], name='techprep_job_gen_idx'),
        ),
        migrations.AddIndex(
            model_name='technicalpreppractice',
            index=models.Index(fields=['job', 'challenge_id'], name='techprep_job_ch_idx'),
        ),
        migrations.AddIndex(
            model_name='technicalpreppractice',
            index=models.Index(fields=['job', '-attempted_at'], name='techprep_job_att_idx'),
        ),
    ]
