# backend/core/migrations/0015_merge_20251111_0725.py
from django.db import migrations

class Migration(migrations.Migration):
    # Depend on an existing migration before the two 0016s.
    dependencies = [
        ("core", "0013_jobmatchanalysis"),
    ]
    operations = []
