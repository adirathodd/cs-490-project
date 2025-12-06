"""
Management command to clean up orphaned emails for users without Gmail integration
"""
from django.core.management.base import BaseCommand
from core.models import ApplicationEmail, GmailIntegration


class Command(BaseCommand):
    help = 'Clean up application emails for users without active Gmail integration'

    def handle(self, *args, **options):
        # Get all users with emails
        users_with_emails = ApplicationEmail.objects.values_list('user_id', flat=True).distinct()
        
        deleted_count = 0
        for user_id in users_with_emails:
            # Check if user has an active Gmail integration
            has_integration = GmailIntegration.objects.filter(
                user_id=user_id,
                status='connected'
            ).exists()
            
            if not has_integration:
                # Delete all emails for this user
                count = ApplicationEmail.objects.filter(user_id=user_id).delete()[0]
                deleted_count += count
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Deleted {count} emails for user {user_id} (no active integration)'
                    )
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Cleanup complete. Total emails deleted: {deleted_count}'
            )
        )
