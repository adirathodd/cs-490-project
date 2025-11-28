from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0053_calendarintegration_multiaccount'),
    ]

    operations = [
        migrations.AddField(
            model_name='jobquestionpractice',
            name='last_duration_seconds',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='jobquestionpractice',
            name='total_duration_seconds',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
