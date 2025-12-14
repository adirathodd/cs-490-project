# Generated migration for rate limit tracking

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0088_applicationemail_emailscanlog_gmailintegration_and_more'),
        ('core', '0088_remove_teamcandidateaccess_core_teamcandidate_team_cand_member_uniq_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='gmailintegration',
            name='rate_limit_reset_at',
            field=models.DateTimeField(null=True, blank=True, help_text='When the rate limit resets'),
        ),
    ]
