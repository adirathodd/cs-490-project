from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0016_add_uc038_fields_to_jobentry'),
    ]

    operations = [
        migrations.AddField(
            model_name='jobentry',
            name='three_day_notice_sent_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='jobentry',
            name='day_of_notice_sent_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]
