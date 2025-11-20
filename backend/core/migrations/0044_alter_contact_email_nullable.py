from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0043_eventconnection_networkingevent_eventgoal_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='contact',
            name='email',
            field=models.EmailField(blank=True, null=True, max_length=254),
        ),
    ]
