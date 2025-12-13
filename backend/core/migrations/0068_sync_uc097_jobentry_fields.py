from django.db import migrations


def add_columns_and_indexes(apps, schema_editor):
    """Add columns and indexes, checking database vendor for compatibility."""
    if schema_editor.connection.vendor == 'postgresql':
        # PostgreSQL supports IF NOT EXISTS
        with schema_editor.connection.cursor() as cursor:
            cursor.execute("""
                ALTER TABLE core_jobentry
                ADD COLUMN IF NOT EXISTS application_source varchar(50),
                ADD COLUMN IF NOT EXISTS application_method varchar(50),
                ADD COLUMN IF NOT EXISTS application_submitted_at timestamp with time zone,
                ADD COLUMN IF NOT EXISTS company_size varchar(20),
                ADD COLUMN IF NOT EXISTS cover_letter_customized boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS days_to_response integer,
                ADD COLUMN IF NOT EXISTS first_response_at timestamp with time zone,
                ADD COLUMN IF NOT EXISTS resume_customized boolean NOT NULL DEFAULT false;
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS core_jobentry_application_source_idx ON core_jobentry(application_source);")
            cursor.execute("CREATE INDEX IF NOT EXISTS core_jobentry_application_method_idx ON core_jobentry(application_method);")
            cursor.execute("CREATE INDEX IF NOT EXISTS core_jobentry_company_size_idx ON core_jobentry(company_size);")
            cursor.execute("CREATE INDEX IF NOT EXISTS core_jobentry_application_submitted_at_idx ON core_jobentry(application_submitted_at);")
    else:
        # SQLite: check if columns exist before adding
        with schema_editor.connection.cursor() as cursor:
            cursor.execute("PRAGMA table_info(core_jobentry)")
            existing_columns = {row[1] for row in cursor.fetchall()}
            
            columns_to_add = {
                'application_source': 'varchar(50)',
                'application_method': 'varchar(50)',
                'application_submitted_at': 'timestamp',
                'company_size': 'varchar(20)',
                'cover_letter_customized': 'boolean NOT NULL DEFAULT 0',
                'days_to_response': 'integer',
                'first_response_at': 'timestamp',
                'resume_customized': 'boolean NOT NULL DEFAULT 0',
            }
            
            for column, col_type in columns_to_add.items():
                if column not in existing_columns:
                    cursor.execute(f"ALTER TABLE core_jobentry ADD COLUMN {column} {col_type};")
            
            # Create indexes (SQLite supports CREATE INDEX IF NOT EXISTS)
            cursor.execute("CREATE INDEX IF NOT EXISTS core_jobentry_application_source_idx ON core_jobentry(application_source);")
            cursor.execute("CREATE INDEX IF NOT EXISTS core_jobentry_application_method_idx ON core_jobentry(application_method);")
            cursor.execute("CREATE INDEX IF NOT EXISTS core_jobentry_company_size_idx ON core_jobentry(company_size);")
            cursor.execute("CREATE INDEX IF NOT EXISTS core_jobentry_application_submitted_at_idx ON core_jobentry(application_submitted_at);")


class Migration(migrations.Migration):
    """
    Ensure UC-097 job entry fields exist in the database (columns + indexes) in case
    prior migrations were faked or skipped.
    """

    dependencies = [
        ('core', '0067_feedback_indexes_and_targets'),
    ]

    operations = [
        migrations.RunPython(add_columns_and_indexes, migrations.RunPython.noop),
    ]
