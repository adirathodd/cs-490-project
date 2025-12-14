# Generated manually to fix CareerGrowthScenario schema mismatch

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0113_merge_0109_add_certification_details_0112_job_offers'),
    ]

    operations = [
        # Step 1: Add the new fields
        migrations.AddField(
            model_name='careergrowthscenario',
            name='starting_bonus',
            field=models.DecimalField(blank=True, decimal_places=2, default=0, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='careergrowthscenario',
            name='starting_equity_value',
            field=models.DecimalField(blank=True, decimal_places=2, default=0, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='careergrowthscenario',
            name='bonus_percent',
            field=models.DecimalField(blank=True, decimal_places=2, default=0, help_text='Annual bonus as % of salary', max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name='careergrowthscenario',
            name='equity_refresh_annual',
            field=models.DecimalField(blank=True, decimal_places=2, default=0, max_digits=12, null=True),
        ),
        
        # Step 2: Remove the old fields that are no longer in the model
        migrations.RemoveField(
            model_name='careergrowthscenario',
            name='annual_bonus_percent',
        ),
        migrations.RemoveField(
            model_name='careergrowthscenario',
            name='equity_value',
        ),
        migrations.RemoveField(
            model_name='careergrowthscenario',
            name='equity_vesting_years',
        ),
        migrations.RemoveField(
            model_name='careergrowthscenario',
            name='notes',
        ),
    ]
