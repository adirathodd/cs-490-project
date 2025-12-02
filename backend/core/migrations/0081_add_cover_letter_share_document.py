from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0080_alter_contactsuggestion_connection_path_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='resumeshare',
            name='cover_letter_document',
            field=models.ForeignKey(
                related_name='cover_letter_shares',
                on_delete=models.SET_NULL,
                blank=True,
                null=True,
                to='core.document',
                help_text='Cover letter document shared with reviewers'
            ),
        ),
    ]
