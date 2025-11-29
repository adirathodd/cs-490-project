from django.db import migrations


def column_exists(connection, table_name, column_name):
    with connection.cursor() as cursor:
        if connection.vendor == 'sqlite':
            cursor.execute(f"PRAGMA table_info('{table_name}')")
            return any(row[1] == column_name for row in cursor.fetchall())
        cursor.execute(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = %s AND column_name = %s
            """,
            [table_name, column_name],
        )
        return cursor.fetchone() is not None


def rebuild_reminder_if_missing_contact(apps, schema_editor):
    """
    Some dev databases have a legacy core_reminder table without contact/owner
    and a bigint PK. If the table is empty and missing the contact_id column,
    drop and recreate it using the current model definition (UUID PK + FKs).
    If data exists, fail fast so we don't destroy records.
    """
    connection = schema_editor.connection

    has_contact_id = column_exists(connection, 'core_reminder', 'contact_id')

    if has_contact_id:
        return

    with connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM core_reminder")
        row_count = cursor.fetchone()[0]

    if row_count:
        raise RuntimeError(
            "core_reminder is in a legacy schema without contact_id and has data. "
            "Migrate or back up data before rebuilding the table."
        )

    # Drop and recreate table with the current model schema.
    drop_suffix = "" if connection.vendor == "sqlite" else " CASCADE"
    schema_editor.execute(f"DROP TABLE IF EXISTS {schema_editor.quote_name('core_reminder')}{drop_suffix}")

    Reminder = apps.get_model("core", "Reminder")
    schema_editor.create_model(Reminder)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0041_remove_contact_core_contac_owner_lastint_3f1e2d_idx_and_more"),
    ]

    operations = [
        migrations.RunPython(
            rebuild_reminder_if_missing_contact, migrations.RunPython.noop
        ),
    ]
