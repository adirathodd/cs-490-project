from django.core.management.base import BaseCommand
from django.contrib.auth import authenticate

class Command(BaseCommand):
    help = "Test Django authentication for a given username/password."

    def add_arguments(self, parser):
        parser.add_argument('--username', required=True)
        parser.add_argument('--password', required=True)

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        user = authenticate(username=username, password=password)
        if user is not None:
            self.stdout.write(self.style.SUCCESS(f"AUTH OK username='{username}' id={user.id} staff={user.is_staff} superuser={user.is_superuser}"))
        else:
            self.stdout.write(self.style.ERROR(f"AUTH FAIL username='{username}'"))
