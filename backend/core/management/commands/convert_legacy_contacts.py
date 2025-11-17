from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.conf import settings
from django.utils import timezone
import uuid
import json


class Command(BaseCommand):
    help = 'Convert legacy core_contact table rows to new UUID-based core_contact_new table and record id mappings.'

    def add_arguments(self, parser):
        parser.add_argument('--fallback-owner', type=int, default=1, help='Fallback auth_user.id for unmapped owner (default: 1)')
        parser.add_argument('--time-for-last-contact', type=str, default='09:00:00', help='Time to use when converting legacy date-only last_contacted values')

    def handle(self, *args, **options):
        fallback_owner = options['fallback_owner']
        time_for_last_contact = options['time_for_last_contact']

        self.stdout.write('Starting legacy contacts conversion...')

        with connection.cursor() as cur:
            # 1) Create a read-only snapshot of the current core_contact if not exists
            cur.execute("""
            CREATE TABLE IF NOT EXISTS core_contact_legacy AS TABLE core_contact WITH NO DATA;
            """)
            # Only populate snapshot if empty
            cur.execute("SELECT count(1) FROM core_contact_legacy")
            count = cur.fetchone()[0]
            if count == 0:
                self.stdout.write('Populating `core_contact_legacy` snapshot...')
                cur.execute('INSERT INTO core_contact_legacy SELECT * FROM core_contact')
            else:
                self.stdout.write('`core_contact_legacy` already populated, skipping copy.')

            # 2) Create mapping table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS core_contact_id_map (
                old_id bigint PRIMARY KEY,
                new_id uuid NOT NULL
            );
            """)

            # 3) Create new contacts table if not exists (minimal schema matching current model)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS core_contact_new (
                id uuid PRIMARY KEY,
                owner_id bigint NOT NULL,
                first_name varchar(120) DEFAULT ''::varchar,
                last_name varchar(120) DEFAULT ''::varchar,
                display_name varchar(255) DEFAULT ''::varchar,
                title varchar(220) DEFAULT ''::varchar,
                email varchar(254) DEFAULT ''::varchar,
                phone varchar(40) DEFAULT ''::varchar,
                location varchar(160) DEFAULT ''::varchar,
                company_name varchar(180) DEFAULT ''::varchar,
                company_id bigint,
                linkedin_url varchar(200) DEFAULT ''::varchar,
                profile_url varchar(200) DEFAULT ''::varchar,
                photo_url varchar(200) DEFAULT ''::varchar,
                industry varchar(120) DEFAULT ''::varchar,
                role varchar(120) DEFAULT ''::varchar,
                relationship_type varchar(80) DEFAULT ''::varchar,
                relationship_strength integer DEFAULT 0,
                last_interaction timestamp with time zone,
                external_id varchar(255) DEFAULT ''::varchar,
                metadata jsonb DEFAULT '{}'::jsonb,
                is_private boolean DEFAULT false,
                created_at timestamp with time zone DEFAULT now(),
                updated_at timestamp with time zone DEFAULT now()
            );
            """)

            # 4) Iterate legacy rows and insert into new table, recording mapping
            cur.execute("SELECT id, name, job_title, email, phone, linkedin_url, relationship_type, last_contacted, created_at, candidate_id, company_id, notes FROM core_contact_legacy")
            rows = cur.fetchall()
            self.stdout.write(f'Found {len(rows)} legacy contact rows to migrate')

            insert_sql = """
            INSERT INTO core_contact_new (id, owner_id, first_name, last_name, display_name, title, email, phone, linkedin_url, relationship_type, last_interaction, created_at, company_id, company_name, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            map_sql = "INSERT INTO core_contact_id_map (old_id, new_id) VALUES (%s, %s) ON CONFLICT (old_id) DO NOTHING"

            for r in rows:
                old_id, name, job_title, email, phone, linkedin_url, relationship_type, last_contacted, created_at, candidate_id, company_id, notes = r
                new_uuid = str(uuid.uuid4())

                # owner mapping: candidate -> candidate.user_id
                owner_id = fallback_owner
                if candidate_id:
                    cur.execute('SELECT user_id FROM core_candidateprofile WHERE id = %s', [candidate_id])
                    res = cur.fetchone()
                    if res and res[0]:
                        owner_id = res[0]

                # display name and name split
                display_name = name or ''
                first_name = ''
                last_name = ''
                if display_name:
                    parts = display_name.strip().split()
                    if len(parts) == 1:
                        first_name = parts[0]
                    elif len(parts) >= 2:
                        first_name = parts[0]
                        last_name = parts[-1]

                # last_contacted date -> timestamp at configured time
                last_interaction = None
                if last_contacted:
                    # combine date and time_for_last_contact
                    try:
                        last_interaction = timezone.make_aware(timezone.datetime.combine(last_contacted, timezone.datetime.strptime(time_for_last_contact, '%H:%M:%S').time()), timezone.get_current_timezone())
                    except Exception:
                        last_interaction = None

                metadata = {}
                if notes:
                    metadata['legacy_notes'] = notes

                cur.execute(insert_sql, [new_uuid, owner_id, first_name, last_name, display_name, job_title or '', email or '', phone or '', linkedin_url or '', relationship_type or '', last_interaction, created_at, company_id, None, json.dumps(metadata)])
                cur.execute(map_sql, [old_id, new_uuid])

            self.stdout.write('Migration into `core_contact_new` complete. Sample mappings:')
            cur.execute('SELECT old_id, new_id FROM core_contact_id_map LIMIT 10')
            for old_id, new_id in cur.fetchall():
                self.stdout.write(f'  {old_id} -> {new_id}')

        self.stdout.write('Conversion finished. Next steps: review new table `core_contact_new` and id mappings in `core_contact_id_map`. Run dependent table updates when ready.')
