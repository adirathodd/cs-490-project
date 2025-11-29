from django.test import TestCase
from django.utils import timezone

from core.models import Company, JobOpportunity, Referral, Contact, CandidateProfile, Application


class ReferralUnmarkTestCase(TestCase):
    """Verify that a completed referral record can be updated to clear its completion date."""

    def setUp(self):
        # create minimal user-related objects (CandidateProfile/Application) and contact
        # Use simplified objects to keep test focused on Referral model behavior
        from django.contrib.auth import get_user_model
        User = get_user_model()

        self.user = User.objects.create_user(username='refuser', email='ref@example.com')

        self.company = Company.objects.create(name='Acme')
        self.job = JobOpportunity.objects.create(company=self.company, title='Backend Engineer')

        # CandidateProfile + Application required by Referral.application FK
        self.profile = CandidateProfile.objects.create(user=self.user)
        self.application = Application.objects.create(candidate=self.profile, job=self.job)

        # contact who provided the referral
        self.contact = Contact.objects.create(owner=self.user, first_name='Alice', last_name='Referrer')

        # create a completed referral (uses `completed_date` on Referral model)
        self.referral = Referral.objects.create(
            application=self.application,
            contact=self.contact,
            status='used',
            completed_date=timezone.now(),
            notes='Initial referral completed'
        )

    def test_unmark_completed_clears_completed_date_and_updates_status(self):
        # simulate unmarking the referral as completed by changing fields directly
        self.referral.status = 'requested'
        self.referral.completed_date = None
        self.referral.save()

        # reload and assert fields updated
        self.referral.refresh_from_db()
        self.assertEqual(self.referral.status, 'requested')
        self.assertIsNone(self.referral.completed_date)
