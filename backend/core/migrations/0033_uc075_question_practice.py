from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0032_uc074_company_research_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='JobQuestionPractice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('question_id', models.CharField(max_length=64)),
                ('category', models.CharField(max_length=32)),
                ('question_text', models.TextField()),
                ('difficulty', models.CharField(choices=[('entry', 'Entry'), ('mid', 'Mid-level'), ('senior', 'Senior')], default='mid', max_length=16)),
                ('skills', models.JSONField(blank=True, default=list)),
                ('written_response', models.TextField(blank=True)),
                ('star_response', models.JSONField(blank=True, default=dict)),
                ('practice_notes', models.TextField(blank=True)),
                ('practice_count', models.PositiveIntegerField(default=1)),
                ('first_practiced_at', models.DateTimeField(auto_now_add=True)),
                ('last_practiced_at', models.DateTimeField(auto_now=True)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='question_practice_logs', to='core.jobentry')),
            ],
            options={
                'ordering': ['-last_practiced_at'],
            },
        ),
        migrations.AddIndex(
            model_name='jobquestionpractice',
            index=models.Index(fields=['job', 'category'], name='core_jobque_job_id_2bbc37_idx'),
        ),
        migrations.AddIndex(
            model_name='jobquestionpractice',
            index=models.Index(fields=['job', 'question_id'], name='core_jobque_job_id_364843_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='jobquestionpractice',
            unique_together={('job', 'question_id')},
        ),
    ]
