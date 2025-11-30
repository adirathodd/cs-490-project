from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0063_merge_conflicting_merges'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE core_candidateprofile "
                    "ADD COLUMN IF NOT EXISTS monthly_application_target smallint NOT NULL DEFAULT 20;",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "ALTER TABLE core_candidateprofile "
                    "ADD COLUMN IF NOT EXISTS weekly_application_target smallint NOT NULL DEFAULT 5;",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='candidateprofile',
                    name='monthly_application_target',
                    field=models.PositiveSmallIntegerField(
                        default=20,
                        help_text='User-defined goal for applications per month',
                    ),
                ),
                migrations.AddField(
                    model_name='candidateprofile',
                    name='weekly_application_target',
                    field=models.PositiveSmallIntegerField(
                        default=5,
                        help_text='User-defined goal for applications per week',
                    ),
                ),
            ],
        ),
    ]
