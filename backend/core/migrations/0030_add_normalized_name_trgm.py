import re
from django.db import migrations, models


def ensure_trigram_extension(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm;')


def normalize_company_names(apps, schema_editor):
    Company = apps.get_model('core', 'Company')
    connection = schema_editor.connection
    if connection.vendor == 'postgresql':
        schema_editor.execute(
            "UPDATE core_company "
            "SET normalized_name = lower(regexp_replace(name, '[^a-z0-9 ]', '', 'g'))"
        )
        return

    pattern = re.compile(r'[^a-z0-9 ]')
    for company in Company.objects.all():
        normalized = ''
        if company.name:
            normalized = pattern.sub('', company.name.lower())
        if normalized != company.normalized_name:
            Company.objects.filter(pk=company.pk).update(normalized_name=normalized)


def create_trigram_index(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute(
            "CREATE INDEX IF NOT EXISTS idx_core_company_normalized_trgm "
            "ON core_company USING gin (normalized_name gin_trgm_ops);"
        )


def drop_trigram_index(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute("DROP INDEX IF EXISTS idx_core_company_normalized_trgm;")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('core', '0029_merge_20251111_1637'),
    ]

    operations = [
        migrations.RunPython(ensure_trigram_extension, migrations.RunPython.noop),
        migrations.AddField(
            model_name='company',
            name='normalized_name',
            field=models.CharField(max_length=200, blank=True, db_index=True),
        ),
        migrations.RunPython(normalize_company_names, migrations.RunPython.noop),
        migrations.RunPython(create_trigram_index, drop_trigram_index),
    ]
