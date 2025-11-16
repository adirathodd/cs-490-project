from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0034_questionbankcache'),
    ]

    operations = [
        migrations.CreateModel(
            name='PreparationChecklistProgress',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('task_id', models.CharField(max_length=64)),
                ('category', models.CharField(max_length=200)),
                ('task', models.CharField(max_length=500)),
                ('completed', models.BooleanField(default=False)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='preparation_checklist', to='core.jobentry')),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AddIndex(
            model_name='preparationchecklistprogress',
            index=models.Index(fields=['job', 'completed'], name='core_prepar_job_id_9f38c7_idx'),
        ),
        migrations.AddIndex(
            model_name='preparationchecklistprogress',
            index=models.Index(fields=['job', 'task_id'], name='core_prepar_job_id_3e5f28_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='preparationchecklistprogress',
            unique_together={('job', 'task_id')},
        ),
    ]
