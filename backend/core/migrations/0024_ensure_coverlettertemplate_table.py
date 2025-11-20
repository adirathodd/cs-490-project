from django.db import migrations

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS public.core_coverlettertemplate (
    id uuid PRIMARY KEY,
    name varchar(200) NOT NULL,
    description text NOT NULL DEFAULT '',
    template_type varchar(20) NOT NULL DEFAULT 'formal',
    industry varchar(100) NOT NULL DEFAULT '',
    content text NOT NULL,
    sample_content text NOT NULL DEFAULT '',
    is_shared boolean NOT NULL DEFAULT false,
    imported_from varchar(200) NOT NULL DEFAULT '',
    usage_count integer NOT NULL DEFAULT 0,
    last_used timestamptz NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    customization_options jsonb NOT NULL DEFAULT '{}'::jsonb,
    owner_id integer NULL
);

-- add FK only if not present; note owner_id is UUID to match core_useraccount(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'core_coverlettertemplate_owner_id_fk'
    ) THEN
        ALTER TABLE public.core_coverlettertemplate
        ADD CONSTRAINT core_coverlettertemplate_owner_id_fk
        FOREIGN KEY (owner_id)
        REFERENCES public.auth_user(id)
        ON DELETE SET NULL;
    END IF;
END$$;
"""

REVERSE_SQL = """
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'core_coverlettertemplate_owner_id_fk'
    ) THEN
        ALTER TABLE public.core_coverlettertemplate
        DROP CONSTRAINT core_coverlettertemplate_owner_id_fk;
    END IF;
END$$;
"""


def create_cover_letter_table(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        # SQLite (used in tests) already has the model from earlier migrations.
        return
    schema_editor.execute(CREATE_TABLE_SQL)


def drop_cover_letter_constraint(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute(REVERSE_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0019_add_automation_models'),
    ]

    operations = [
        migrations.RunPython(create_cover_letter_table, drop_cover_letter_constraint),
    ]
