from django.db import migrations, models


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
                migrations.RunSQL("ALTER INDEX IF EXISTS core_feedba_feedbac_cmt_idx RENAME TO core_feedba_feedbac_f44d81_idx;"),
                migrations.RunSQL("ALTER INDEX IF EXISTS core_feedba_parent__cmt_idx RENAME TO core_feedba_parent__4adac6_idx;"),
                migrations.RunSQL("ALTER INDEX IF EXISTS core_feedba_section_cmt_idx RENAME TO core_feedba_section_4971a3_idx;"),
                migrations.RunSQL("ALTER INDEX IF EXISTS core_feedba_user_notif_idx RENAME TO core_feedba_user_id_c102b0_idx;"),
                migrations.RunSQL("ALTER INDEX IF EXISTS core_feedba_user_is_notif_idx RENAME TO core_feedba_user_id_ade516_idx;"),
                migrations.RunSQL("ALTER INDEX IF EXISTS core_resume_resume_v_fb_idx RENAME TO core_resume_resume__c74ce1_idx;"),
                migrations.RunSQL("ALTER INDEX IF EXISTS core_resume_share_fb_idx RENAME TO core_resume_share_i_4f59d5_idx;"),
                migrations.RunSQL("ALTER INDEX IF EXISTS core_resume_status_fb_idx RENAME TO core_resume_status_610122_idx;"),
                migrations.RunSQL("ALTER INDEX IF EXISTS core_resume_reviewe_fb_idx RENAME TO core_resume_reviewe_7fdbbe_idx;"),
                migrations.RunSQL("ALTER INDEX IF EXISTS core_resum_share_t_idx RENAME TO core_resume_share_t_5aa5d2_idx;"),
                migrations.RunSQL("ALTER INDEX IF EXISTS core_resum_resume_v_idx RENAME TO core_resume_resume__527f39_idx;"),
                migrations.RunSQL("ALTER INDEX IF EXISTS core_resum_is_acti_idx RENAME TO core_resume_is_acti_5ef0f7_idx;"),
                migrations.RunSQL("ALTER INDEX IF EXISTS core_share_share_a_idx RENAME TO core_sharea_share_i_c8e017_idx;"),
                migrations.RunSQL("ALTER INDEX IF EXISTS core_share_reviewe_idx RENAME TO core_sharea_reviewe_08506b_idx;"),
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
                migrations.RunSQL(
                    "ALTER TABLE core_candidateprofile ADD COLUMN IF NOT EXISTS monthly_application_target smallint NOT NULL DEFAULT 20;",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "ALTER TABLE core_candidateprofile ADD COLUMN IF NOT EXISTS weekly_application_target smallint NOT NULL DEFAULT 5;",
                    reverse_sql=migrations.RunSQL.noop,
                ),
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
