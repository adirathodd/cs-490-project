"""
No-op merge migration to resolve multiple leaf nodes created during
branch merges. This migration depends on both conflicting 0062
merge migrations so Django has a single leaf node for test DB
creation. Remove or replace with a proper merged migration when
reconciling upstream histories.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0062_merge_20251129_0024'),
        ('core', '0062_merge_20251129_1144'),
    ]

    operations = [
    ]
