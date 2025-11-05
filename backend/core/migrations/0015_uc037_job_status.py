from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0015_jobentry'),
    ]

    operations = [
        migrations.AddField(
            model_name='jobentry',
            name='status',
            field=models.CharField(choices=[('interested', 'Interested'), ('applied', 'Applied'), ('phone_screen', 'Phone Screen'), ('interview', 'Interview'), ('offer', 'Offer'), ('rejected', 'Rejected')], default='interested', max_length=20),
        ),
        migrations.AddField(
            model_name='jobentry',
            name='last_status_change',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddIndex(
            model_name='jobentry',
            index=models.Index(fields=['candidate', 'status'], name='core_jobentr_candida_6a6926_idx'),
        ),
        migrations.CreateModel(
            name='JobStatusChange',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('old_status', models.CharField(choices=[('interested', 'Interested'), ('applied', 'Applied'), ('phone_screen', 'Phone Screen'), ('interview', 'Interview'), ('offer', 'Offer'), ('rejected', 'Rejected')], max_length=20)),
                ('new_status', models.CharField(choices=[('interested', 'Interested'), ('applied', 'Applied'), ('phone_screen', 'Phone Screen'), ('interview', 'Interview'), ('offer', 'Offer'), ('rejected', 'Rejected')], max_length=20)),
                ('changed_at', models.DateTimeField(auto_now_add=True)),
                ('job', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='status_changes', to='core.jobentry')),
            ],
            options={
                'ordering': ['-changed_at'],
            },
        ),
        migrations.AddIndex(
            model_name='jobstatuschange',
            index=models.Index(fields=['job', '-changed_at'], name='core_jobstat_job_id__1a3daa_idx'),
        ),
    ]
