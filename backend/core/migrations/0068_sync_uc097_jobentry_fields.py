from django.db import migrations


def ensure_uc097_jobentry_columns(apps, schema_editor):
    """Add UC-097 columns if they are missing (SQLite lacks IF NOT EXISTS)."""

    connection = schema_editor.connection
    table_name = 'core_jobentry'

    with connection.cursor() as cursor:
        existing_columns = {
            column.name for column in connection.introspection.get_table_description(cursor, table_name)
        }

    statements = [
        ("application_source", "varchar(50)"),
        ("application_method", "varchar(50)"),
        ("application_submitted_at", "timestamp with time zone"),
        ("company_size", "varchar(20)"),
        ("cover_letter_customized", "boolean NOT NULL DEFAULT false"),
        ("days_to_response", "integer"),
        ("first_response_at", "timestamp with time zone"),
        ("resume_customized", "boolean NOT NULL DEFAULT false"),
    ]

    for column_name, definition in statements:
        if column_name in existing_columns:
            continue

        sql = (
            f"ALTER TABLE {schema_editor.quote_name(table_name)} "
            f"ADD COLUMN {schema_editor.quote_name(column_name)} {definition}"
        )
        with connection.cursor() as cursor:
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
            ensure_uc097_jobentry_columns,
            reverse_code=migrations.RunPython.noop,
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
