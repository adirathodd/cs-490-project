from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    help = "Create or update a Django superuser with a specified username/password."

    def add_arguments(self, parser):
        parser.add_argument('--username', required=True, help='Username for the admin user')
        parser.add_argument('--password', required=True, help='Password for the admin user')
        parser.add_argument('--email', default='', help='Email for the admin user (optional)')
        parser.add_argument('--first-name', default='', help='First name (optional)')
        parser.add_argument('--last-name', default='', help='Last name (optional)')

    def handle(self, *args, **options):
        User = get_user_model()
        username = options['username']
        password = options['password']
        email = options.get('email') or ''
        first_name = options.get('first_name') or ''
        last_name = options.get('last_name') or ''

        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': email}
        )

        # Update fields and ensure admin privileges
        changed = False
        if email and user.email != email:
            user.email = email
            changed = True
        if first_name and user.first_name != first_name:
            user.first_name = first_name
            changed = True
        if last_name and user.last_name != last_name:
            user.last_name = last_name
            changed = True

        if not user.is_staff:
            user.is_staff = True
            changed = True
        if not user.is_superuser:
            user.is_superuser = True
            changed = True
        if not user.is_active:
            user.is_active = True
            changed = True

        user.set_password(password)
        user.save()

        if created:
            self.stdout.write(self.style.SUCCESS(f"Admin user created: username='{username}' email='{user.email}'"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Admin user updated: username='{username}' email='{user.email}'"))
        if changed:
            self.stdout.write(self.style.SUCCESS("Privileges/fields ensured (is_staff, is_superuser, is_active)."))
        else:
            self.stdout.write("No field privilege changes were necessary.")
