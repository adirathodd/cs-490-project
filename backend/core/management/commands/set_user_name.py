from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Set first and last name for a user by email.'

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True, help='Email of the user to update')
        parser.add_argument('--first', required=True, help='First name to set')
        parser.add_argument('--last', required=True, help='Last name to set')

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        first = options['first'].strip()
        last = options['last'].strip()

        User = get_user_model()
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise CommandError(f'User with email {email} not found')

        user.first_name = first
        user.last_name = last
        user.save(update_fields=['first_name', 'last_name'])

        self.stdout.write(self.style.SUCCESS(f'Updated user {email}: {first} {last}'))
