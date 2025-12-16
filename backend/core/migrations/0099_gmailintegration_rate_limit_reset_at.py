# Generated migration for rate limit tracking

from django.db import migrations, models


def add_rate_limit_reset_at_if_not_exists(apps, schema_editor):
    """Safely add rate_limit_reset_at column if it doesn't already exist."""
    connection = schema_editor.connection
    vendor = connection.vendor  # 'postgresql', 'sqlite', etc.
    
    with connection.cursor() as cursor:
        # Check if column exists using database-specific query
        if vendor == 'postgresql':
            cursor.execute("""
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'core_gmailintegration'
                AND column_name = 'rate_limit_reset_at'
            """)
            column_exists = cursor.fetchone() is not None
        else:
            # SQLite: use PRAGMA table_info
            cursor.execute("PRAGMA table_info(core_gmailintegration)")
            columns = [row[1] for row in cursor.fetchall()]
            column_exists = 'rate_limit_reset_at' in columns
        
        if not column_exists:
            if vendor == 'postgresql':
                cursor.execute("""
                    ALTER TABLE core_gmailintegration
                    ADD COLUMN rate_limit_reset_at TIMESTAMP WITH TIME ZONE NULL
                """)
            else:
                # SQLite syntax
                cursor.execute("""
                    ALTER TABLE core_gmailintegration
                    ADD COLUMN rate_limit_reset_at DATETIME NULL
                """)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0088_applicationemail_emailscanlog_gmailintegration_and_more'),
        ('core', '0088_remove_teamcandidateaccess_core_teamcandidate_team_cand_member_uniq_and_more'),
    ]

    operations = [
        migrations.RunPython(add_rate_limit_reset_at_if_not_exists, noop),
    ]
