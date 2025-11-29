from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0054_jobquestionpractice_timing'),
    ]

    operations = [
        migrations.CreateModel(
            name='InterviewSuccessPrediction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('predicted_probability', models.DecimalField(decimal_places=2, max_digits=5)),
                ('confidence_score', models.DecimalField(decimal_places=2, max_digits=4)),
                ('preparation_score', models.DecimalField(decimal_places=2, default=0, max_digits=4)),
                ('match_score', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('research_completion', models.DecimalField(decimal_places=2, default=0, max_digits=4)),
                ('practice_hours', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('historical_adjustment', models.DecimalField(decimal_places=2, default=0, max_digits=4)),
                ('payload', models.JSONField(blank=True, default=dict, help_text='Serialized breakdown for reuse')),
                ('generated_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('accuracy', models.DecimalField(decimal_places=3, help_text='Absolute error between prediction and normalized outcome', max_digits=4, null=True, blank=True)),
                ('actual_outcome', models.CharField(blank=True, max_length=20)),
                ('evaluated_at', models.DateTimeField(blank=True, null=True)),
                ('is_latest', models.BooleanField(default=True)),
                ('candidate', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='interview_success_predictions', to='core.candidateprofile')),
                ('interview', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='success_predictions', to='core.interviewschedule')),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='success_predictions', to='core.jobentry')),
            ],
            options={
                'ordering': ['-generated_at'],
            },
        ),
        migrations.AddIndex(
            model_name='interviewsuccessprediction',
            index=models.Index(fields=['interview', '-generated_at'], name='core_succ_pred_interview_idx'),
        ),
        migrations.AddIndex(
            model_name='interviewsuccessprediction',
            index=models.Index(fields=['candidate', '-generated_at'], name='core_succ_pred_candidate_idx'),
        ),
        migrations.AddIndex(
            model_name='interviewsuccessprediction',
            index=models.Index(fields=['job', '-generated_at'], name='core_succ_pred_job_idx'),
        ),
        migrations.AddIndex(
            model_name='interviewsuccessprediction',
            index=models.Index(fields=['is_latest'], name='core_succ_pred_latest_idx'),
        ),
    ]

