from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0108_make_application_package_optional'),
    ]

    operations = [
        migrations.AddField(
            model_name='certification',
            name='achievement_highlights',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='certification',
            name='assessment_max_score',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name='certification',
            name='assessment_score',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name='certification',
            name='assessment_units',
            field=models.CharField(blank=True, help_text='Units for the assessment score (points, percentile, rank, etc.)', max_length=40),
        ),
        migrations.AddField(
            model_name='certification',
            name='badge_image',
            field=models.ImageField(blank=True, null=True, upload_to='certifications/badges/%Y/%m/'),
        ),
        migrations.AddField(
            model_name='certification',
            name='description',
            field=models.TextField(blank=True),
        ),
    ]
