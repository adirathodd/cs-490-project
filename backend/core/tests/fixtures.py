"""
Test fixtures and factories for creating test data.
Uses factory_boy for consistent test data generation.
"""
import factory
from factory.django import DjangoModelFactory
from django.contrib.auth import get_user_model
from core.models import (
    CandidateProfile, 
    Skill, 
    CandidateSkill, 
    Education,
    WorkExperience,
    Certification,
    Project,
    ProjectMedia,
    UserAccount
)

User = get_user_model()


class UserFactory(DjangoModelFactory):
    """Factory for creating test users"""
    class Meta:
        model = User
    
    username = factory.Sequence(lambda n: f'user{n}')
    email = factory.Sequence(lambda n: f'user{n}@example.com')
    first_name = factory.Faker('first_name')
    last_name = factory.Faker('last_name')
    is_active = True


class UserAccountFactory(DjangoModelFactory):
    """Factory for UserAccount model"""
    class Meta:
        model = UserAccount
    
    user = factory.SubFactory(UserFactory)
    email = factory.LazyAttribute(lambda obj: obj.user.email.lower())


class CandidateProfileFactory(DjangoModelFactory):
    """Factory for candidate profiles"""
    class Meta:
        model = CandidateProfile
    
    user = factory.SubFactory(UserFactory)
    phone = '+15551234567'
    city = factory.Faker('city')
    state = factory.Faker('state_abbr')
    headline = factory.Faker('job')
    summary = factory.Faker('text', max_nb_chars=200)
    industry = 'Technology'
    experience_level = 'mid'


class SkillFactory(DjangoModelFactory):
    """Factory for skills"""
    class Meta:
        model = Skill
    
    name = factory.Sequence(lambda n: f'Skill{n}')
    category = 'Technical'


class CandidateSkillFactory(DjangoModelFactory):
    """Factory for candidate skills"""
    class Meta:
        model = CandidateSkill
    
    candidate = factory.SubFactory(CandidateProfileFactory)
    skill = factory.SubFactory(SkillFactory)
    level = 'intermediate'
    years = 2.0
    order = 0


class EducationFactory(DjangoModelFactory):
    """Factory for education entries"""
    class Meta:
        model = Education
    
    candidate = factory.SubFactory(CandidateProfileFactory)
    institution = factory.Faker('company')
    degree_type = 'ba'
    field_of_study = factory.Faker('job')
    start_date = factory.Faker('date_this_decade')
    end_date = factory.Faker('date_this_year')
    currently_enrolled = False
    gpa = 3.5


class WorkExperienceFactory(DjangoModelFactory):
    """Factory for work experience entries"""
    class Meta:
        model = WorkExperience
    
    candidate = factory.SubFactory(CandidateProfileFactory)
    company_name = factory.Faker('company')
    job_title = factory.Faker('job')
    location = factory.Faker('city')
    start_date = factory.Faker('date_this_decade')
    end_date = factory.Faker('date_this_year')
    is_current = False
    description = factory.Faker('text', max_nb_chars=500)
    achievements = factory.List([
        factory.Faker('sentence') for _ in range(2)
    ])


class CertificationFactory(DjangoModelFactory):
    """Factory for certifications"""
    class Meta:
        model = Certification
    
    candidate = factory.SubFactory(CandidateProfileFactory)
    name = factory.Sequence(lambda n: f'Certification {n}')
    issuing_organization = factory.Faker('company')
    issue_date = factory.Faker('date_this_decade')
    credential_id = factory.Sequence(lambda n: f'CERT{n:06d}')
    never_expires = False


class ProjectFactory(DjangoModelFactory):
    """Factory for projects"""
    class Meta:
        model = Project
    
    candidate = factory.SubFactory(CandidateProfileFactory)
    name = factory.Sequence(lambda n: f'Project {n}')
    description = factory.Faker('text', max_nb_chars=500)
    role = factory.Faker('job')
    start_date = factory.Faker('date_this_decade')
    end_date = factory.Faker('date_this_year')
    status = 'completed'
    team_size = 5
