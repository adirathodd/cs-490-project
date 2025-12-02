from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0081_add_cover_letter_share_document'),
    ]

    operations = [
        migrations.AddField(
            model_name='resumefeedback',
            name='cover_letter_document',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='cover_letter_feedback',
                to='core.document',
            ),
        ),
        migrations.AlterField(
            model_name='resumefeedback',
            name='resume_version',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='feedback_received',
                to='core.resumeversion',
            ),
        ),
        migrations.AlterModelOptions(
            name='resumefeedback',
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['resume_version', '-created_at'], name='core_resumefeedback_resume_version_0c3a71_idx'),
                    models.Index(fields=['cover_letter_document', '-created_at'], name='core_resumefeedback_cover_letter_d_5ab3d9_idx'),
                    models.Index(fields=['share', '-created_at'], name='core_resumefeedback_share_92935d_idx'),
                    models.Index(fields=['status', '-created_at'], name='core_resumefeedback_status_03b13a_idx'),
                    models.Index(fields=['reviewer_email', '-created_at'], name='core_resumefeedback_review_2a84fb_idx'),
                ],
            },
        ),
    ]
