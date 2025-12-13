from django.db import migrations


def rename_indexes_postgresql(apps, schema_editor):
    """Rename indexes - PostgreSQL only."""
    if schema_editor.connection.vendor != 'postgresql':
        return
    
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("ALTER INDEX IF EXISTS core_succ_pred_interview_idx RENAME TO core_interv_intervi_9bc100_idx;")
        cursor.execute("ALTER INDEX IF EXISTS core_succ_pred_candidate_idx RENAME TO core_interv_candida_178a75_idx;")
        cursor.execute("ALTER INDEX IF EXISTS core_succ_pred_job_idx RENAME TO core_interv_job_id_1a36cc_idx;")
        cursor.execute("ALTER INDEX IF EXISTS core_succ_pred_latest_idx RENAME TO core_interv_is_late_d6548a_idx;")


def reverse_rename_indexes_postgresql(apps, schema_editor):
    """Reverse index renames - PostgreSQL only."""
    if schema_editor.connection.vendor != 'postgresql':
        return
    
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("ALTER INDEX IF EXISTS core_interv_intervi_9bc100_idx RENAME TO core_succ_pred_interview_idx;")
        cursor.execute("ALTER INDEX IF EXISTS core_interv_candida_178a75_idx RENAME TO core_succ_pred_candidate_idx;")
        cursor.execute("ALTER INDEX IF EXISTS core_interv_job_id_1a36cc_idx RENAME TO core_succ_pred_job_idx;")
        cursor.execute("ALTER INDEX IF EXISTS core_interv_is_late_d6548a_idx RENAME TO core_succ_pred_latest_idx;")


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
                migrations.RunPython(rename_indexes_postgresql, reverse_rename_indexes_postgresql),
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
