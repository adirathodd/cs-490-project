from django.db import migrations


def rebuild_reminder_if_missing_contact(apps, schema_editor):
    """
    Some dev databases have a legacy core_reminder table without contact/owner
    and a bigint PK. If the table is empty and missing the contact_id column,
    drop and recreate it using the current model definition (UUID PK + FKs).
    If data exists, fail fast so we don't destroy records.
    """
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'core_reminder' AND column_name = 'contact_id'
            """
        )
        has_contact_id = cursor.fetchone() is not None

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
    with connection.cursor() as cursor:
        cursor.execute("DROP TABLE IF EXISTS core_reminder CASCADE")

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
