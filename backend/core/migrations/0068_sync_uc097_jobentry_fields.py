from django.db import migrations


def _ensure_jobentry_columns(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return

    statements = [
        "ALTER TABLE core_jobentry ADD COLUMN IF NOT EXISTS application_source varchar(50);",
        "ALTER TABLE core_jobentry ADD COLUMN IF NOT EXISTS application_method varchar(50);",
        "ALTER TABLE core_jobentry ADD COLUMN IF NOT EXISTS application_submitted_at timestamp with time zone;",
        "ALTER TABLE core_jobentry ADD COLUMN IF NOT EXISTS company_size varchar(20);",
        "ALTER TABLE core_jobentry ADD COLUMN IF NOT EXISTS cover_letter_customized boolean NOT NULL DEFAULT false;",
        "ALTER TABLE core_jobentry ADD COLUMN IF NOT EXISTS days_to_response integer;",
        "ALTER TABLE core_jobentry ADD COLUMN IF NOT EXISTS first_response_at timestamp with time zone;",
        "ALTER TABLE core_jobentry ADD COLUMN IF NOT EXISTS resume_customized boolean NOT NULL DEFAULT false;",
        "CREATE INDEX IF NOT EXISTS core_jobentry_application_source_idx ON core_jobentry(application_source);",
        "CREATE INDEX IF NOT EXISTS core_jobentry_application_method_idx ON core_jobentry(application_method);",
        "CREATE INDEX IF NOT EXISTS core_jobentry_company_size_idx ON core_jobentry(company_size);",
        "CREATE INDEX IF NOT EXISTS core_jobentry_application_submitted_at_idx ON core_jobentry(application_submitted_at);",
    ]
    with schema_editor.connection.cursor() as cursor:
        for sql in statements:
            cursor.execute(sql)


class Migration(migrations.Migration):
    """
    Ensure UC-097 job entry fields exist in the database (columns + indexes) in case
    prior migrations were faked or skipped.
    """

    dependencies = [
        ('core', '0067_feedback_indexes_and_targets'),
    ]

    operations = [
        migrations.RunPython(
            code=_ensure_jobentry_columns,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
