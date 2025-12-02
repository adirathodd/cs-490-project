# Generated manually to resolve migration conflicts
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0064_linkedinintegration'),
        ('core', '0064_remove_referraloutcome_referral_request_and_more'),
        ('core', '0069_rename_core_succ_pred_interview_idx_core_interv_intervi_9bc100_idx_and_more'),
        ('core', '0069_uc090_informational_interviews'),
        ('core', '0070_add_outcome_comp_fields'),
    ]

    operations = [
        # No operations needed - just merging branches
    ]
