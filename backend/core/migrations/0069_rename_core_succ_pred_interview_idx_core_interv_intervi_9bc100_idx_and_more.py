from django.db import migrations


def _rename_indexes(apps, schema_editor):
    """Perform index renames only on Postgres; SQLite doesn't support ALTER INDEX IF EXISTS."""
    if schema_editor.connection.vendor != 'postgresql':
        return

    statements = [
        "ALTER INDEX IF EXISTS core_succ_pred_interview_idx RENAME TO core_interv_intervi_9bc100_idx;",
        "ALTER INDEX IF EXISTS core_succ_pred_candidate_idx RENAME TO core_interv_candida_178a75_idx;",
        "ALTER INDEX IF EXISTS core_succ_pred_job_idx RENAME TO core_interv_job_id_1a36cc_idx;",
        "ALTER INDEX IF EXISTS core_succ_pred_latest_idx RENAME TO core_interv_is_late_d6548a_idx;",
    ]
    with schema_editor.connection.cursor() as cursor:
        for sql in statements:
            cursor.execute(sql)


def _rename_indexes_reverse(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return

    statements = [
        "ALTER INDEX IF EXISTS core_interv_intervi_9bc100_idx RENAME TO core_succ_pred_interview_idx;",
        "ALTER INDEX IF EXISTS core_interv_candida_178a75_idx RENAME TO core_succ_pred_candidate_idx;",
        "ALTER INDEX IF EXISTS core_interv_job_id_1a36cc_idx RENAME TO core_succ_pred_job_idx;",
        "ALTER INDEX IF EXISTS core_interv_is_late_d6548a_idx RENAME TO core_succ_pred_latest_idx;",
    ]
    with schema_editor.connection.cursor() as cursor:
        for sql in statements:
            cursor.execute(sql)


class Migration(migrations.Migration):
    """
    Safe index rename for InterviewSuccessPrediction indexes.
    Uses IF EXISTS to avoid errors if indexes were already renamed or missing.
    """

    dependencies = [
        ('core', '0068_sync_uc097_jobentry_fields'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    code=_rename_indexes,
                    reverse_code=_rename_indexes_reverse,
                )
            ],
            state_operations=[
                migrations.RenameIndex(
                    model_name='interviewsuccessprediction',
                    new_name='core_interv_intervi_9bc100_idx',
                    old_name='core_succ_pred_interview_idx',
                ),
                migrations.RenameIndex(
                    model_name='interviewsuccessprediction',
                    new_name='core_interv_candida_178a75_idx',
                    old_name='core_succ_pred_candidate_idx',
                ),
                migrations.RenameIndex(
                    model_name='interviewsuccessprediction',
                    new_name='core_interv_job_id_1a36cc_idx',
                    old_name='core_succ_pred_job_idx',
                ),
                migrations.RenameIndex(
                    model_name='interviewsuccessprediction',
                    new_name='core_interv_is_late_d6548a_idx',
                    old_name='core_succ_pred_latest_idx',
                ),
            ],
        ),
    ]
