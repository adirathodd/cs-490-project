# Generated migration for rate limit tracking

from django.db import migrations, models


def add_rate_limit_reset_at_if_not_exists(apps, schema_editor):
    """Safely add rate_limit_reset_at column if it doesn't already exist."""
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'core_gmailintegration'
            AND column_name = 'rate_limit_reset_at'
        """)
        if not cursor.fetchone():
            cursor.execute("""
                ALTER TABLE core_gmailintegration
                ADD COLUMN rate_limit_reset_at TIMESTAMP WITH TIME ZONE NULL
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
