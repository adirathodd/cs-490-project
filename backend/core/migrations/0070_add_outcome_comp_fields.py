from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0069_rename_core_succ_pred_interview_idx_core_interv_intervi_9bc100_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='salarynegotiationoutcome',
            name='base_salary',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='salarynegotiationoutcome',
            name='bonus',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='salarynegotiationoutcome',
            name='equity',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
    ]
