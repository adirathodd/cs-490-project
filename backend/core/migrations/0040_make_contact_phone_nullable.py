from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0039_merge_20251116_2213'),
    ]

    operations = [
        migrations.AlterField(
            model_name='contact',
            name='phone',
            field=models.CharField(max_length=40, blank=True, null=True),
        ),
    ]
