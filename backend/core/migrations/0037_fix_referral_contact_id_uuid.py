from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0036_z_merge_20251115_2346"),
        ("core", "0036_interviewchecklistprogress_and_more"),
    ]
    # This migration was intended to convert legacy integer referral.contact_id
    # columns to UUID and re-create the FK against core_contact(id). In
    # development environments where the project has not performed a PK
    # migration for contacts (i.e. contact.id remains bigint from 0001_initial),
    # running the conversion SQL will fail due to incompatible types. To keep
    # developer workflows stable and avoid destructive automatic conversions,
    # make this migration a no-op here. Production data migration should be
    # handled by a reviewed, environment-specific migration script.
    operations = []
