from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0044_alter_contact_email_nullable'),
    ]

    operations = [
        migrations.CreateModel(
            name='QuestionResponseCoaching',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('question_id', models.CharField(max_length=64)),
                ('question_text', models.TextField()),
                ('response_text', models.TextField(blank=True)),
                ('star_response', models.JSONField(blank=True, default=dict)),
                ('coaching_payload', models.JSONField(blank=True, default=dict)),
                ('scores', models.JSONField(blank=True, default=dict)),
                ('word_count', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='response_coaching_sessions', to='core.jobentry')),
                ('practice_log', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coaching_sessions', to='core.jobquestionpractice')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='questionresponsecoaching',
            index=models.Index(fields=['job', 'question_id'], name='core_qrc_job_question_idx'),
        ),
        migrations.AddIndex(
            model_name='questionresponsecoaching',
            index=models.Index(fields=['practice_log', '-created_at'], name='core_qrc_practice_idx'),
        ),
    ]
