import pytest
from django.utils import timezone
from django.contrib.auth import get_user_model

from core.models import (
    Tag, Contact, ContactNote, Interaction, Reminder, ImportJob,
    MutualConnection, ContactCompanyLink, ContactJobLink, Document, Company, JobOpportunity, CandidateProfile
)


@pytest.mark.django_db
def test_uc086_models_basic_relations(tmp_path):
    User = get_user_model()
    user = User.objects.create_user(username='u7', email='u7@example.com', password='p')

    tag = Tag.objects.create(owner=user, name='colleague')

    c = Contact.objects.create(owner=user, display_name='Cathy', email='cathy@example.com', company_name='XCo')
    c.tags.add(tag)

    note = ContactNote.objects.create(contact=c, author=user, content='Notes here', interests=['python','django'])
    assert note in c.notes.all()

    inter = Interaction.objects.create(contact=c, owner=user, type='email', summary='Reached out')
    assert inter in c.interactions.all()

    due = timezone.now() + timezone.timedelta(days=1)
    rem = Reminder.objects.create(contact=c, owner=user, message='Ping', due_date=due)
    assert rem in c.reminders.all()

    job = ImportJob.objects.create(owner=user, provider='google')
    assert job.status == 'pending'

    # mutual connection
    other = Contact.objects.create(owner=user, display_name='Other', email='o@example.com', company_name='XCo')
    mutual = MutualConnection.objects.create(contact=c, related_contact=other, context='worked together')
    assert mutual in c.mutuals.all()

    # company and job links
    comp = Company.objects.create(name='XCo', domain='xco.com')
    j = JobOpportunity.objects.create(company=comp, title='Eng')
    ccl = ContactCompanyLink.objects.create(contact=c, company=comp, role_title='Engineer')
    cjl = ContactJobLink.objects.create(contact=c, job=j, relationship_to_job='referred')
    assert ccl in c.company_links.all()
    assert cjl in c.job_links.all()

    # Document simple properties
    profile = CandidateProfile.objects.create(user=user)
    doc = Document.objects.create(candidate=profile, doc_type='resume', document_name='Res', storage_url='http://s')
    assert doc.document_url == 'http://s'
    assert doc.document_type == 'resume'
    assert doc.version_number == doc.version
