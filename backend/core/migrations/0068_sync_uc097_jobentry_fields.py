from django.db import migrations


class Migration(migrations.Migration):
    """
    Ensure UC-097 job entry fields exist in the database (columns + indexes) in case
    prior migrations were faked or skipped.
    """

    dependencies = [
        ('core', '0067_feedback_indexes_and_targets'),
    ]

    operations = [
        migrations.RunSQL(
            "ALTER TABLE core_jobentry "
            "ADD COLUMN IF NOT EXISTS application_source varchar(50);",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            "ALTER TABLE core_jobentry "
            "ADD COLUMN IF NOT EXISTS application_method varchar(50);",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            "ALTER TABLE core_jobentry "
            "ADD COLUMN IF NOT EXISTS application_submitted_at timestamp with time zone;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            "ALTER TABLE core_jobentry "
            "ADD COLUMN IF NOT EXISTS company_size varchar(20);",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            "ALTER TABLE core_jobentry "
            "ADD COLUMN IF NOT EXISTS cover_letter_customized boolean NOT NULL DEFAULT false;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            "ALTER TABLE core_jobentry "
            "ADD COLUMN IF NOT EXISTS days_to_response integer;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            "ALTER TABLE core_jobentry "
            "ADD COLUMN IF NOT EXISTS first_response_at timestamp with time zone;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            "ALTER TABLE core_jobentry "
            "ADD COLUMN IF NOT EXISTS resume_customized boolean NOT NULL DEFAULT false;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS core_jobentry_application_source_idx "
            "ON core_jobentry(application_source);",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS core_jobentry_application_method_idx "
            "ON core_jobentry(application_method);",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS core_jobentry_company_size_idx "
            "ON core_jobentry(company_size);",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS core_jobentry_application_submitted_at_idx "
            "ON core_jobentry(application_submitted_at);",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
