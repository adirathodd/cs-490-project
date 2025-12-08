"""
Management command to set a user as admin permanently.
Usage: python manage.py set_admin nnair4002@gmail.com
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Set a user as admin (staff and superuser) permanently'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='Email of the user to make admin')

    def handle(self, *args, **options):
        email = options['email']
        
        try:
            user = User.objects.get(email=email)
            
            # Set admin flags
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.save()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully set {email} as admin:\n'
                    f'  is_staff: {user.is_staff}\n'
                    f'  is_superuser: {user.is_superuser}\n'
                    f'  is_active: {user.is_active}'
                )
            )
            
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'User with email {email} does not exist')
            )
