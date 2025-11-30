from django.db import migrations, models


def rename_indexes_pg_only(apps, schema_editor):
    """Rename indexes only on PostgreSQL."""
    if schema_editor.connection.vendor != 'postgresql':
        return
    
    renames = [
        ("core_feedba_feedbac_cmt_idx", "core_feedba_feedbac_f44d81_idx"),
        ("core_feedba_parent__cmt_idx", "core_feedba_parent__4adac6_idx"),
        ("core_feedba_section_cmt_idx", "core_feedba_section_4971a3_idx"),
        ("core_feedba_user_notif_idx", "core_feedba_user_id_c102b0_idx"),
        ("core_feedba_user_is_notif_idx", "core_feedba_user_id_ade516_idx"),
        ("core_resume_resume_v_fb_idx", "core_resume_resume__c74ce1_idx"),
        ("core_resume_share_fb_idx", "core_resume_share_i_4f59d5_idx"),
        ("core_resume_status_fb_idx", "core_resume_status_610122_idx"),
        ("core_resume_reviewe_fb_idx", "core_resume_reviewe_7fdbbe_idx"),
        ("core_resum_share_t_idx", "core_resume_share_t_5aa5d2_idx"),
        ("core_resum_resume_v_idx", "core_resume_resume__527f39_idx"),
        ("core_resum_is_acti_idx", "core_resume_is_acti_5ef0f7_idx"),
        ("core_share_share_a_idx", "core_sharea_share_i_c8e017_idx"),
        ("core_share_reviewe_idx", "core_sharea_reviewe_08506b_idx"),
    ]
    
    with schema_editor.connection.cursor() as cursor:
        # Get existing indexes
        cursor.execute("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")
        existing_indexes = {row[0] for row in cursor.fetchall()}
        
        for old_name, new_name in renames:
            if old_name in existing_indexes:
                try:
                    cursor.execute(f"ALTER INDEX {old_name} RENAME TO {new_name}")
                except Exception:
                    pass  # Already renamed or doesn't exist


def add_candidate_targets_pg_only(apps, schema_editor):
    """Add candidate target columns only on PostgreSQL."""
    if schema_editor.connection.vendor != 'postgresql':
        return
    
    with schema_editor.connection.cursor() as cursor:
        # Check if columns exist first
        cursor.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'core_candidateprofile' 
            AND column_name IN ('monthly_application_target', 'weekly_application_target')
        """)
        existing_columns = {row[0] for row in cursor.fetchall()}
        
        if 'monthly_application_target' not in existing_columns:
            try:
                cursor.execute(
                    "ALTER TABLE core_candidateprofile ADD COLUMN monthly_application_target smallint NOT NULL DEFAULT 20"
                )
            except Exception:
                pass
        
        if 'weekly_application_target' not in existing_columns:
            try:
                cursor.execute(
                    "ALTER TABLE core_candidateprofile ADD COLUMN weekly_application_target smallint NOT NULL DEFAULT 5"
                )
            except Exception:
                pass


class Migration(migrations.Migration):
    """
    Single migration to (a) safely align feedback/resume/share index names, and
    (b) ensure candidate application targets exist, using IF EXISTS/IF NOT EXISTS guards.
    """

    dependencies = [
        ('core', '0066_add_uc097_success_tracking_fields'),
    ]

    operations = [
        # Index renames (DB + state; DB side is no-op if already renamed/missing)
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(rename_indexes_pg_only, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.RenameIndex(
                    model_name='feedbackcomment',
                    new_name='core_feedba_feedbac_f44d81_idx',
                    old_name='core_feedba_feedbac_cmt_idx',
                ),
                migrations.RenameIndex(
                    model_name='feedbackcomment',
                    new_name='core_feedba_parent__4adac6_idx',
                    old_name='core_feedba_parent__cmt_idx',
                ),
                migrations.RenameIndex(
                    model_name='feedbackcomment',
                    new_name='core_feedba_section_4971a3_idx',
                    old_name='core_feedba_section_cmt_idx',
                ),
                migrations.RenameIndex(
                    model_name='feedbacknotification',
                    new_name='core_feedba_user_id_c102b0_idx',
                    old_name='core_feedba_user_notif_idx',
                ),
                migrations.RenameIndex(
                    model_name='feedbacknotification',
                    new_name='core_feedba_user_id_ade516_idx',
                    old_name='core_feedba_user_is_notif_idx',
                ),
                migrations.RenameIndex(
                    model_name='resumefeedback',
                    new_name='core_resume_resume__c74ce1_idx',
                    old_name='core_resume_resume_v_fb_idx',
                ),
                migrations.RenameIndex(
                    model_name='resumefeedback',
                    new_name='core_resume_share_i_4f59d5_idx',
                    old_name='core_resume_share_fb_idx',
                ),
                migrations.RenameIndex(
                    model_name='resumefeedback',
                    new_name='core_resume_status_610122_idx',
                    old_name='core_resume_status_fb_idx',
                ),
                migrations.RenameIndex(
                    model_name='resumefeedback',
                    new_name='core_resume_reviewe_7fdbbe_idx',
                    old_name='core_resume_reviewe_fb_idx',
                ),
                migrations.RenameIndex(
                    model_name='resumeshare',
                    new_name='core_resume_share_t_5aa5d2_idx',
                    old_name='core_resum_share_t_idx',
                ),
                migrations.RenameIndex(
                    model_name='resumeshare',
                    new_name='core_resume_resume__527f39_idx',
                    old_name='core_resum_resume_v_idx',
                ),
                migrations.RenameIndex(
                    model_name='resumeshare',
                    new_name='core_resume_is_acti_5ef0f7_idx',
                    old_name='core_resum_is_acti_idx',
                ),
                migrations.RenameIndex(
                    model_name='shareaccesslog',
                    new_name='core_sharea_share_i_c8e017_idx',
                    old_name='core_share_share_a_idx',
                ),
                migrations.RenameIndex(
                    model_name='shareaccesslog',
                    new_name='core_sharea_reviewe_08506b_idx',
                    old_name='core_share_reviewe_idx',
                ),
            ],
        ),

        # Candidate targets (no-op if columns already present)
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(add_candidate_targets_pg_only, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='candidateprofile',
                    name='monthly_application_target',
                    field=models.PositiveSmallIntegerField(
                        default=20,
                        help_text='User-defined goal for applications per month',
                    ),
                ),
                migrations.AddField(
                    model_name='candidateprofile',
                    name='weekly_application_target',
                    field=models.PositiveSmallIntegerField(
                        default=5,
                        help_text='User-defined goal for applications per week',
                    ),
                ),
            ],
        ),
    ]
