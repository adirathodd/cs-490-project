from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.models import Count


class Command(BaseCommand):
    help = "Report Django auth users that share the same email address (case-insensitive)."

    def handle(self, *args, **options):
        User = get_user_model()
        # Aggregate lowercased emails
        # Not all DBs support lower() in annotate portably; fall back to Python if needed
        try:
            from django.db.models.functions import Lower
            qs = (
                User.objects.exclude(email__isnull=True).exclude(email__exact="")
                .values(email_lower=Lower('email'))
                .annotate(c=Count('id'))
                .filter(c__gt=1)
                .order_by('-c')
            )
            duplicates = list(qs)
        except Exception:
            # Fallback: group in Python
            buckets = {}
            for u in User.objects.all().only('id', 'email'):
                e = (u.email or '').lower()
                if not e:
                    continue
                buckets.setdefault(e, []).append(u.id)
            duplicates = [
                {'email_lower': e, 'c': len(ids)} for e, ids in buckets.items() if len(ids) > 1
            ]

        if not duplicates:
            self.stdout.write(self.style.SUCCESS('No duplicate user emails found.'))
            return

        self.stdout.write(self.style.WARNING('Duplicate user emails detected:'))
        User = get_user_model()
        for row in duplicates:
            email = row['email_lower']
            users = list(User.objects.filter(email__iexact=email).values('id', 'username', 'email', 'date_joined', 'is_active'))
            users_sorted = sorted(users, key=lambda u: (u.get('date_joined'), u.get('id')))
            self.stdout.write(f"\nEmail: {email} (count={row['c']})")
            for u in users_sorted:
                self.stdout.write(f"  - id={u['id']} username={u['username']} active={u['is_active']} joined={u.get('date_joined')} email={u['email']}")
        self.stdout.write("\nSuggestion: Keep the earliest user as canonical and disable or merge others. See auth linking logic for runtime handling.")
