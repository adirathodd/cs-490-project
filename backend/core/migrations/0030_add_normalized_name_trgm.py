from django.db import migrations, models
from django.contrib.postgres.operations import TrigramExtension

class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('core', '0029_merge_20251111_1637'),
    ]

    operations = [
        TrigramExtension(),
        migrations.AddField(
            model_name='company',
            name='normalized_name',
            field=models.CharField(max_length=200, blank=True, db_index=True),
        ),
        # Backfill normalized_name using a simple SQL normalization: lower + remove non-alphanumerics
        migrations.RunSQL(
            sql=(
                "UPDATE core_company SET normalized_name = lower(regexp_replace(name, '[^a-z0-9 ]', '', 'g'))"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
        # Create a GIN trigram index for similarity queries. Use CONCURRENTLY and allow migration to run non-atomically.
        migrations.RunSQL(
            sql=(
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_core_company_normalized_trgm "
                "ON core_company USING gin (normalized_name gin_trgm_ops);"
            ),
            reverse_sql=(
                "DROP INDEX CONCURRENTLY IF EXISTS idx_core_company_normalized_trgm;"
            ),
        ),
    ]
