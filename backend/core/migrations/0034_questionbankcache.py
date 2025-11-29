from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0033_uc075_question_practice'),
    ]

    operations = [
        migrations.CreateModel(
            name='QuestionBankCache',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('bank_data', models.JSONField(blank=True, default=dict)),
                ('source', models.CharField(default='template', max_length=32)),
                ('generated_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('is_valid', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='question_bank_caches', to='core.jobentry')),
            ],
            options={
                'ordering': ['-generated_at'],
            },
        ),
        migrations.AddIndex(
            model_name='questionbankcache',
            index=models.Index(fields=['job', 'is_valid'], name='core_questi_job_id_a459d3_idx'),
        ),
    ]
