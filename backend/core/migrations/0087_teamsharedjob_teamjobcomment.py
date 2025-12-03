# Generated manually - safe migration for TeamSharedJob and TeamJobComment

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0086_remove_teamcandidateaccess_core_teamcandidate_team_cand_member_uniq_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TeamSharedJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('note', models.TextField(blank=True, help_text='Optional note when sharing')),
                ('shared_at', models.DateTimeField(auto_now_add=True)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='team_shares', to='core.jobentry')),
                ('shared_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='team_shared_jobs', to=settings.AUTH_USER_MODEL)),
                ('team', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shared_jobs', to='core.teamaccount')),
            ],
            options={
                'ordering': ['-shared_at'],
                'unique_together': {('team', 'job')},
            },
        ),
        migrations.CreateModel(
            name='TeamJobComment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('content', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('author', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='team_job_comments', to=settings.AUTH_USER_MODEL)),
                ('shared_job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='comments', to='core.teamsharedjob')),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='teamsharedjob',
            index=models.Index(fields=['team', '-shared_at'], name='core_teamsh_team_id_f093ba_idx'),
        ),
        migrations.AddIndex(
            model_name='teamjobcomment',
            index=models.Index(fields=['shared_job', 'created_at'], name='core_teamjo_shared__990616_idx'),
        ),
    ]
