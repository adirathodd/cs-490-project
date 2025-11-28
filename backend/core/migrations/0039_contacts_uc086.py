from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings


def get_column_type(connection, table_name, column_name):
    with connection.cursor() as cursor:
        if connection.vendor == 'sqlite':
            cursor.execute(f"PRAGMA table_info('{table_name}')")
            for row in cursor.fetchall():
                if row[1] == column_name:
                    return (row[2] or '').lower()
            return None
        cursor.execute(
            """
            SELECT data_type
            FROM information_schema.columns
            WHERE table_name = %s AND column_name = %s
            """,
            [table_name, column_name],
        )
        row = cursor.fetchone()
        return row[0] if row else None


def table_exists(connection, table_name):
    with connection.cursor() as cursor:
        if connection.vendor == 'sqlite':
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=%s",
                [table_name],
            )
            return cursor.fetchone() is not None
        cursor.execute(
            "SELECT to_regclass(%s)",
            [f'public.{table_name}'],
        )
        result = cursor.fetchone()
        return result and result[0] is not None


def ensure_contact_pk_is_uuid(apps, schema_editor):
    """
    In older dev databases, core_contact was created with a bigint PK and a different
    column layout. That breaks the UUID foreign keys introduced in this migration.
    When the legacy table is empty, drop and recreate it (and the referral table that
    depends on it) with the current schema. If data exists, fail fast and ask for a
    manual reset so we don't silently destroy records.
    """
    connection = schema_editor.connection
    column_type = get_column_type(connection, 'core_contact', 'id')

    if not column_type:
        # Table does not exist; create it with the current model definition.
        Contact = apps.get_model('core', 'Contact')
        Referral = apps.get_model('core', 'Referral')
        schema_editor.create_model(Contact)
        schema_editor.create_model(Referral)
        return

    if column_type == 'uuid':
        return

    contact_count = 0
    referral_count = 0
    with connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM core_contact")
        contact_count = cursor.fetchone()[0]
        if table_exists(connection, "core_referral"):
            cursor.execute("SELECT COUNT(*) FROM core_referral")
            referral_count = cursor.fetchone()[0]

    if contact_count or referral_count:
        raise RuntimeError(
            "core_contact uses a bigint primary key and contains data. "
            "Reset the database (or migrate the data manually) before applying the contacts migration."
        )

    # Safe to rebuild since there is no data.
    drop_suffix = "" if connection.vendor == 'sqlite' else " CASCADE"
    schema_editor.execute(f"DROP TABLE IF EXISTS {schema_editor.quote_name('core_referral')}{drop_suffix}")
    schema_editor.execute(f"DROP TABLE IF EXISTS {schema_editor.quote_name('core_contact')}{drop_suffix}")

    Contact = apps.get_model('core', 'Contact')
    Referral = apps.get_model('core', 'Referral')
    schema_editor.create_model(Contact)
    schema_editor.create_model(Referral)


class Migration(migrations.Migration):

    initial = False

    dependencies = [
        ('core', '0029_merge_20251111_1637'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(ensure_contact_pk_is_uuid, migrations.RunPython.noop),
        migrations.CreateModel(
            name='Tag',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=120)),
                ('type', models.CharField(blank=True, max_length=40)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tags', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('owner', 'name')},
            },
        ),
        # NOTE: legacy `Contact` table is created in 0001_initial; skip creating
        # it here to avoid DuplicateTable errors on environments that already
        # have the legacy contact table. The rest of the contact-related models
        # (tags, notes, interactions, reminders, import jobs, mutuals, links)
        # are created below.
        migrations.AddField(
            model_name='contact',
            name='tags',
            field=models.ManyToManyField(blank=True, related_name='tagged_contacts', to='core.Tag'),
        ),
        migrations.CreateModel(
            name='ContactNote',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('content', models.TextField(blank=True)),
                ('interests', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('author', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contact_notes', to=settings.AUTH_USER_MODEL)),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notes', to='core.contact')),
            ],
        ),
        migrations.CreateModel(
            name='Interaction',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('type', models.CharField(default='email', max_length=32)),
                ('date', models.DateTimeField(default=django.utils.timezone.now)),
                ('duration_minutes', models.PositiveIntegerField(blank=True, null=True)),
                ('summary', models.TextField(blank=True)),
                ('follow_up_needed', models.BooleanField(default=False)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='interactions', to='core.contact')),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='interactions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'indexes': [
                    models.Index(fields=['contact', '-date'], name='idx_core_interaction_contact_date'),
                    models.Index(fields=['owner', '-date'], name='idx_core_interaction_owner_date'),
                ],
            },
        ),
        # Reminder model already exists in the legacy initial migration (0001);
        # skip creating it here to avoid DuplicateTable on clean databases.
        migrations.CreateModel(
            name='ImportJob',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('provider', models.CharField(max_length=60, default='google')),
                ('status', models.CharField(max_length=30, default='pending')),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('errors', models.JSONField(blank=True, default=list)),
                ('result_summary', models.TextField(blank=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='import_jobs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'indexes': [models.Index(fields=['owner', 'provider', 'status'], name='idx_core_importjob_owner_provider_status')],
            },
        ),
        migrations.CreateModel(
            name='MutualConnection',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('context', models.CharField(blank=True, max_length=256)),
                ('source', models.CharField(blank=True, max_length=80)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='mutual_connections', to='core.contact')),
                ('related_contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='related_to', to='core.contact')),
            ],
            options={
                'indexes': [models.Index(fields=['contact', 'related_contact'], name='idx_core_mutualconnection_contact_related')],
            },
        ),
        migrations.CreateModel(
            name='ContactCompanyLink',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('role_title', models.CharField(blank=True, max_length=220)),
                ('start_date', models.DateField(blank=True, null=True)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contact_links', to='core.company')),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='company_links', to='core.contact')),
            ],
            options={
                'indexes': [models.Index(fields=['contact', 'company'], name='idx_core_contactcompanylink_contact_company')],
            },
        ),
        migrations.CreateModel(
            name='ContactJobLink',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('relationship_to_job', models.CharField(blank=True, max_length=80)),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='job_links', to='core.contact')),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contact_links', to='core.jobopportunity')),
            ],
            options={
                'indexes': [models.Index(fields=['contact', 'job'], name='idx_core_contactjoblink_contact_job')],
            },
        ),
    ]
