# backend/core/models.py
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
import secrets
import uuid


class UserAccount(models.Model):
    """Application-level user record with UUID id and normalized unique email.

    This complements Django's auth_user table to meet UC-010 requirements:
    - UUID primary keys
    - Lowercased, unique email with DB constraint
    - created_at / updated_at timestamps
    The one-to-one link to the Django User keeps compatibility with existing relations.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='account')
    email = models.EmailField(unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["email"])]

    def save(self, *args, **kwargs):
        # Ensure lowercase email for consistency
        if self.email:
            self.email = self.email.lower()
        return super().save(*args, **kwargs)

class CandidateProfile(models.Model):
    EXPERIENCE_LEVELS = [
        ('entry', 'Entry Level'),
        ('mid', 'Mid Level'),
        ('senior', 'Senior Level'),
        ('executive', 'Executive'),
    ]
    
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    
    # Basic Information (UC-021)
    phone = models.CharField(max_length=20, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    
    # Professional Information
    headline = models.CharField(max_length=160, blank=True, help_text="Professional title/headline (LinkedIn-style)")
    summary = models.TextField(max_length=500, blank=True, help_text="Brief bio/summary (500 character limit)")
    industry = models.CharField(max_length=120, blank=True)
    experience_level = models.CharField(max_length=20, choices=EXPERIENCE_LEVELS, blank=True)
    
    # Profile Picture (UC-022)
    profile_picture = models.ImageField(
        upload_to='profile_pictures/%Y/%m/',
        blank=True,
        null=True,
        help_text="Profile picture image file"
    )
    profile_picture_uploaded_at = models.DateTimeField(null=True, blank=True)
    
    # Legacy fields
    location = models.CharField(max_length=160, blank=True)  # Deprecated in favor of city/state
    years_experience = models.PositiveSmallIntegerField(default=0)
    preferred_roles = models.JSONField(default=list, blank=True)
    portfolio_url = models.URLField(blank=True)
    visibility = models.CharField(max_length=20, default="private")  # private|shared|public
    # UC-042: Default materials selection
    # Default resume/cover letter documents to prefill on new applications/jobs
    default_resume_doc = models.ForeignKey(
        'Document', on_delete=models.SET_NULL, null=True, blank=True, related_name='default_resume_for'
    )
    default_cover_letter_doc = models.ForeignKey(
        'Document', on_delete=models.SET_NULL, null=True, blank=True, related_name='default_cover_letter_for'
    )

    class Meta:
        indexes = [models.Index(fields=["user"])]
    
    def get_full_location(self):
        """Return formatted location string"""
        if self.city and self.state:
            return f"{self.city}, {self.state}"
        return self.city or self.state or self.location
    
    def get_full_name(self):
        """Return candidate's full name from linked User"""
        return f"{self.user.first_name} {self.user.last_name}".strip()

class Skill(models.Model):
    name = models.CharField(max_length=120, unique=True)
    category = models.CharField(max_length=120, blank=True)

    def __str__(self):
        return self.name

class CandidateSkill(models.Model):
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="skills")
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name="candidates")
    level = models.CharField(max_length=20, default="intermediate")  # beginner|intermediate|advanced|expert
    years = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    order = models.IntegerField(default=0, help_text="Display order within category")

    class Meta:
        unique_together = [("candidate", "skill")]
        indexes = [
            models.Index(fields=["candidate"]), 
            models.Index(fields=["skill"]),
            models.Index(fields=["candidate", "order"])
        ]
        ordering = ['order', 'id']

class AccountDeletionRequest(models.Model):
    """One-time token to confirm irreversible account deletion via email."""
    user = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='account_deletion_requests')
    token = models.CharField(max_length=128, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    consumed = models.BooleanField(default=False)

    @staticmethod
    def create_for_user(user, ttl_hours: int = 24):
        token = secrets.token_urlsafe(48)
        expires_at = timezone.now() + timezone.timedelta(hours=ttl_hours)
        return AccountDeletionRequest.objects.create(user=user, token=token, expires_at=expires_at)

    def is_valid(self) -> bool:
        return (not self.consumed) and timezone.now() <= self.expires_at

    def mark_consumed(self):
        self.consumed = True
        self.save(update_fields=['consumed'])

class Company(models.Model):
    name = models.CharField(max_length=180)
    domain = models.CharField(max_length=180, unique=True)
    linkedin_url = models.URLField(blank=True)
    industry = models.CharField(max_length=120, blank=True)
    size = models.CharField(max_length=50, blank=True)
    hq_location = models.CharField(max_length=160, blank=True)
    enrichment = models.JSONField(default=dict, blank=True)
    # Normalized name for fuzzy matching and trigram index (populated on save)
    normalized_name = models.CharField(max_length=200, blank=True, db_index=True)

    class Meta:
        indexes = [models.Index(name="idx_company_domain_lower", fields=["domain"]), models.Index(name="idx_company_normalized_name", fields=["normalized_name"])]

    def save(self, *args, **kwargs):
        # Lazy import to avoid circular imports at module load time
        try:
            from core.utils.company_matching import normalize_name
            if self.name:
                self.normalized_name = normalize_name(self.name)
        except Exception:
            # If normalization fails for any reason, keep existing value
            pass
        return super().save(*args, **kwargs)

class JobOpportunity(models.Model):
    EMPLOY_TYPES = [("ft", "Full-time"), ("pt", "Part-time"), ("contract", "Contract"), ("intern", "Internship")]
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="jobs")
    title = models.CharField(max_length=220)
    location = models.CharField(max_length=160, blank=True)
    employment_type = models.CharField(max_length=20, choices=EMPLOY_TYPES, default="ft")
    seniority = models.CharField(max_length=60, blank=True)
    source = models.CharField(max_length=60, default="manual")
    external_url = models.URLField(blank=True)
    description = models.TextField(blank=True)
    raw_posting = models.JSONField(default=dict, blank=True)
    active = models.BooleanField(default=True)
    posted_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(fields=["company", "-posted_at"]),
            models.Index(fields=["active"]),
        ]


# ======================
# Contacts / Network Models (UC-086)
# ======================


class Tag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='tags')
    name = models.CharField(max_length=120)
    type = models.CharField(max_length=60, blank=True)

    class Meta:
        unique_together = [('owner', 'name')]


class Contact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='contacts')
    first_name = models.CharField(max_length=120, blank=True)
    last_name = models.CharField(max_length=120, blank=True)
    display_name = models.CharField(max_length=255, blank=True)
    title = models.CharField(max_length=220, blank=True)
    email = models.EmailField(blank=True, null=True)
    # Allow NULL at DB level for imported contacts that may omit phone
    phone = models.CharField(max_length=40, blank=True, null=True)
    location = models.CharField(max_length=160, blank=True)
    company_name = models.CharField(max_length=180, blank=True)
    company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True, related_name='contacts')
    linkedin_url = models.URLField(blank=True)
    profile_url = models.URLField(blank=True)
    photo_url = models.URLField(blank=True)
    industry = models.CharField(max_length=120, blank=True)
    role = models.CharField(max_length=120, blank=True)
    relationship_type = models.CharField(max_length=80, blank=True)
    relationship_strength = models.IntegerField(default=0)
    last_interaction = models.DateTimeField(null=True, blank=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name='contacts')
    external_id = models.CharField(max_length=255, blank=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_private = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=['owner', 'external_id']), models.Index(fields=['owner', 'updated_at'])]


class ContactNote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='notes')
    author = models.ForeignKey(get_user_model(), on_delete=models.SET_NULL, null=True, blank=True)
    content = models.TextField(blank=True)
    interests = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Interaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='interactions')
    owner = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='interactions')
    type = models.CharField(max_length=60, blank=True)
    date = models.DateTimeField(default=timezone.now)
    duration_minutes = models.IntegerField(null=True, blank=True)
    summary = models.TextField(blank=True)
    follow_up_needed = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Reminder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='reminders')
    owner = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='reminders')
    message = models.TextField()
    due_date = models.DateTimeField()
    recurrence = models.CharField(max_length=60, blank=True)
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class ImportJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='import_jobs')
    provider = models.CharField(max_length=60, default='google')
    status = models.CharField(max_length=30, default='pending')
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    errors = models.JSONField(default=list, blank=True)
    result_summary = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class MutualConnection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='mutuals')
    related_contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='related_to')
    context = models.CharField(max_length=255, blank=True)
    source = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class ContactCompanyLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='company_links')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='contact_links')
    role_title = models.CharField(max_length=200, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)


class ContactJobLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='job_links')
    job = models.ForeignKey(JobOpportunity, on_delete=models.CASCADE, related_name='contact_links')
    relationship_to_job = models.CharField(max_length=120, blank=True)


class Document(models.Model):
    DOC_TYPES = [("resume","Resume"), ("cover_letter","Cover Letter"), ("portfolio","Portfolio"), ("cert","Certification")]
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="documents")
    doc_type = models.CharField(max_length=20, choices=DOC_TYPES)
    document_name = models.CharField(max_length=255, blank=True, default='')  # UC-042: Descriptive name
    version = models.PositiveIntegerField(default=1)
    storage_url = models.URLField(blank=True, default='')
    file_upload = models.FileField(upload_to='documents/%Y/%m/', blank=True, null=True)  # UC-042: Actual file storage
    file_hash = models.CharField(max_length=128, blank=True)
    generated_by_ai = models.BooleanField(default=False)
    source_job = models.ForeignKey(JobOpportunity, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Additional fields that exist in the database
    content_type = models.CharField(max_length=100, blank=True, default='')
    file_size = models.PositiveIntegerField(default=0)
    name = models.CharField(max_length=255, blank=True, default='')
    file = models.FileField(upload_to='documents/%Y/%m/', blank=True, null=True)  # Legacy field
    default_for_type = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default='')
    
    # Cover letter style/tone tracking for analytics
    ai_generation_tone = models.CharField(max_length=50, blank=True, help_text="AI generation tone (e.g., formal, analytical, warm)")
    ai_generation_params = models.JSONField(default=dict, blank=True, help_text="AI generation parameters for analytics")

    class Meta:
        unique_together = [("candidate", "doc_type", "version")]
        indexes = [models.Index(fields=["candidate", "doc_type", "-created_at"])]
    
    @property
    def document_url(self):
        """Return the URL for accessing the document."""
        if self.file_upload:
            return self.file_upload.url
        return self.storage_url
    
    @property
    def document_type(self):
        """Alias for doc_type to match frontend API."""
        return self.doc_type
    
    @property
    def version_number(self):
        """Alias for version to match frontend API."""
        return self.version
    
    @property
    def uploaded_at(self):
        """Alias for created_at to match frontend API."""
        return self.created_at

class Application(models.Model):
    STATUS = [
        ("interested","Interested"), ("applied","Applied"), ("phone","Phone Screen"),
        ("onsite","Onsite/Panel"), ("offer","Offer"), ("rejected","Rejected"), ("withdrawn","Withdrawn")
    ]
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="applications")
    job = models.ForeignKey(JobOpportunity, on_delete=models.CASCADE, related_name="applications")
    status = models.CharField(max_length=20, choices=STATUS, default="interested")
    applied_via = models.CharField(max_length=40, blank=True)
    resume_doc = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True, related_name="resume_for")
    cover_letter_doc = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True, related_name="cover_for")
    salary_expectation = models.DecimalField(max_digits=9, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("candidate", "job")]
        indexes = [models.Index(fields=["candidate", "status", "-updated_at"])]

class ApplicationStage(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="stages")
    stage = models.CharField(max_length=24)
    at = models.DateTimeField(default=timezone.now)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [models.Index(fields=["application", "-at"])]

class Interview(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="interviews")
    type = models.CharField(max_length=24)  # screen|technical|behavioral|onsite
    scheduled_start = models.DateTimeField()
    scheduled_end = models.DateTimeField()
    location_or_link = models.CharField(max_length=255, blank=True)
    interviewer_contact = models.JSONField(default=dict, blank=True)
    result = models.CharField(max_length=16, blank=True)
    feedback = models.TextField(blank=True)

    class Meta:
        indexes = [models.Index(fields=["application", "-scheduled_start"])]


# ======================
# EXTENDED PROFILE MODELS
# ======================

class WorkExperience(models.Model):
    """Career history entries for candidate profiles"""
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="work_experiences")
    company_name = models.CharField(max_length=180)
    job_title = models.CharField(max_length=220)
    location = models.CharField(max_length=160, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=False)
    description = models.TextField(blank=True)
    achievements = models.JSONField(default=list, blank=True)  # List of achievement strings
    skills_used = models.ManyToManyField(Skill, blank=True, related_name="used_in_experiences")
    
    class Meta:
        ordering = ['-start_date']
        indexes = [models.Index(fields=["candidate", "-start_date"])]

    def __str__(self):
        return f"{self.job_title} at {self.company_name}"


class Project(models.Model):
    """Projects to showcase significant work beyond regular employment (UC-031)."""
    STATUS_CHOICES = [
        ("completed", "Completed"),
        ("ongoing", "Ongoing"),
        ("planned", "Planned"),
    ]

    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    role = models.CharField(max_length=160, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    project_url = models.URLField(blank=True)
    team_size = models.PositiveSmallIntegerField(null=True, blank=True)
    collaboration_details = models.TextField(blank=True)
    outcomes = models.TextField(blank=True)
    industry = models.CharField(max_length=120, blank=True)
    category = models.CharField(max_length=120, blank=True, help_text="Project type categorization")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="completed")
    skills_used = models.ManyToManyField(Skill, blank=True, related_name="used_in_projects")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    display_order = models.IntegerField(default=0, help_text="Custom display order for portfolio")

    class Meta:
        ordering = ['display_order', '-start_date', '-created_at']
        indexes = [
            models.Index(fields=["candidate", "-start_date"]),
            models.Index(fields=["status"]),
            models.Index(fields=["candidate", "display_order"]) 
        ]

    def __str__(self):
        return self.name


class ProjectMedia(models.Model):
    """Media (screenshots) associated with a project."""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="media")
    image = models.ImageField(upload_to='projects/%Y/%m/')
    caption = models.CharField(max_length=200, blank=True)
    order = models.IntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']
        indexes = [models.Index(fields=["project", "order"])]

    def __str__(self):
        return f"Media for {self.project_id} #{self.id}"

class Education(models.Model):
    """Educational background for candidates"""
    DEGREE_CHOICES = [
        ('hs', 'High School'),
        ('aa', 'Associate'),
        ('ba', 'Bachelor'),
        ('ma', 'Master'),
        ('phd', 'PhD'),
        ('cert', 'Certificate'),
        ('boot', 'Bootcamp'),
    ]

    # Note: related_name changed to 'educations' for natural access; this does not affect DB schema
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="educations")
    institution = models.CharField(max_length=200)
    # Education level dropdown
    degree_type = models.CharField(max_length=20, choices=DEGREE_CHOICES)
    field_of_study = models.CharField(max_length=200, blank=True)
    # Timeline
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    currently_enrolled = models.BooleanField(default=False)
    # GPA
    gpa = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    gpa_private = models.BooleanField(default=False, help_text="If true, GPA is hidden from shared/public views")
    # Achievements/Honors
    honors = models.CharField(max_length=200, blank=True)
    achievements = models.TextField(blank=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['-end_date']
        indexes = [models.Index(fields=["candidate", "-end_date"])]

    def __str__(self):
        return f"{self.get_degree_type_display()} in {self.field_of_study or ''} - {self.institution}"


class Certification(models.Model):
    """Professional certifications and credentials"""
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="certifications")
    name = models.CharField(max_length=200)
    issuing_organization = models.CharField(max_length=200)
    issue_date = models.DateField()
    expiry_date = models.DateField(null=True, blank=True)
    credential_id = models.CharField(max_length=100, blank=True)
    credential_url = models.URLField(blank=True)
    never_expires = models.BooleanField(default=False)
    # UC-030 extensions
    category = models.CharField(max_length=100, blank=True)
    verification_status = models.CharField(
        max_length=20,
        default="unverified",
        choices=[
            ("unverified", "Unverified"),
            ("pending", "Pending"),
            ("verified", "Verified"),
            ("rejected", "Rejected"),
        ],
    )
    document = models.FileField(upload_to='certifications/%Y/%m/', null=True, blank=True)
    renewal_reminder_enabled = models.BooleanField(default=False)
    reminder_days_before = models.PositiveSmallIntegerField(default=30)
    
    class Meta:
        ordering = ['-issue_date']
        indexes = [models.Index(fields=["candidate", "-issue_date"])]

    def __str__(self):
        return f"{self.name} - {self.issuing_organization}"

    @property
    def is_expired(self):
        from django.utils import timezone
        if self.never_expires or not self.expiry_date:
            return False
        return self.expiry_date < timezone.localdate()

    @property
    def days_until_expiration(self):
        from django.utils import timezone
        if self.never_expires or not self.expiry_date:
            return None
        return (self.expiry_date - timezone.localdate()).days

    @property
    def reminder_date(self):
        if not self.renewal_reminder_enabled or not self.expiry_date:
            return None
        from datetime import timedelta
        return self.expiry_date - timedelta(days=int(self.reminder_days_before or 0))


class Achievement(models.Model):
    """Awards, publications, patents, speaking engagements"""
    ACHIEVEMENT_TYPES = [
        ('award', 'Award'),
        ('publication', 'Publication'),
        ('patent', 'Patent'),
        ('speaking', 'Speaking Engagement'),
        ('project', 'Notable Project'),
        ('other', 'Other'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="achievements")
    type = models.CharField(max_length=20, choices=ACHIEVEMENT_TYPES)
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    date = models.DateField()
    url = models.URLField(blank=True)
    issuer = models.CharField(max_length=200, blank=True)
    
    class Meta:
        ordering = ['-date']
        indexes = [models.Index(fields=["candidate", "type", "-date"])]

    def __str__(self):
        return f"{self.get_type_display()}: {self.title}"


# ======================
# EXTENDED JOB & COMPANY MODELS
# ======================

class JobRequirement(models.Model):
    """Specific requirements and qualifications for a job"""
    job = models.ForeignKey(JobOpportunity, on_delete=models.CASCADE, related_name="requirements")
    category = models.CharField(max_length=50)  # required_skills, preferred_skills, education, experience
    description = models.TextField()
    is_required = models.BooleanField(default=True)
    priority = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['-is_required', '-priority']
        indexes = [models.Index(fields=["job", "category"])]


class SalaryData(models.Model):
    """Salary information for jobs"""
    job = models.OneToOneField(JobOpportunity, on_delete=models.CASCADE, related_name="salary_info")
    min_salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    max_salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="USD")
    salary_period = models.CharField(max_length=20, default="yearly")  # yearly, hourly
    equity_offered = models.BooleanField(default=False)
    benefits_summary = models.TextField(blank=True)
    source = models.CharField(max_length=50, default="manual")  # manual, glassdoor, indeed
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [models.Index(fields=["job"])]


class CompanyResearch(models.Model):
    """Automated company research and intelligence (UC-063)"""
    company = models.OneToOneField(Company, on_delete=models.CASCADE, related_name="research")
    description = models.TextField(blank=True)
    profile_overview = models.TextField(blank=True)
    company_history = models.TextField(blank=True)
    mission_statement = models.TextField(blank=True)
    culture_keywords = models.JSONField(default=list, blank=True)
    recent_news = models.JSONField(default=list, blank=True)  # List of {title, url, date, summary}
    recent_developments = models.JSONField(default=list, blank=True)  # Interview-ready highlights
    funding_info = models.JSONField(default=dict, blank=True)  # Stage, amount, investors
    tech_stack = models.JSONField(default=list, blank=True)
    employee_count = models.IntegerField(null=True, blank=True)
    growth_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    glassdoor_rating = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    
    # UC-063: Additional automated research fields
    executives = models.JSONField(default=list, blank=True)  # List of {name, title, linkedin_url}
    potential_interviewers = models.JSONField(default=list, blank=True)  # Tailored to upcoming interviews
    products = models.JSONField(default=list, blank=True)  # List of {name, description}
    competitors = models.JSONField(default=dict, blank=True)  # {industry, companies: [...], market_position}
    competitive_landscape = models.TextField(blank=True)
    strategic_initiatives = models.JSONField(default=list, blank=True)
    talking_points = models.JSONField(default=list, blank=True)
    interview_questions = models.JSONField(default=list, blank=True)
    export_summary = models.TextField(blank=True)  # Markdown-ready digest for offline prep
    social_media = models.JSONField(default=dict, blank=True)  # {linkedin, twitter, facebook, etc.}
    company_values = models.JSONField(default=list, blank=True)  # List of company values
    
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [models.Index(fields=["company"])]


class CoverLetterTemplate(models.Model):
    """Cover letter template for different industries and styles."""
    TEMPLATE_TYPES = [
        ("formal", "Formal"),
        ("creative", "Creative"),
        ("technical", "Technical"),
        ("industry", "Industry-specific"),
        ("custom", "Custom"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    template_type = models.CharField(max_length=20, choices=TEMPLATE_TYPES, default="formal")
    industry = models.CharField(max_length=100, blank=True)
    content = models.TextField()
    sample_content = models.TextField(blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="custom_templates")
    is_shared = models.BooleanField(default=False)
    imported_from = models.CharField(max_length=200, blank=True)
    usage_count = models.PositiveIntegerField(default=0)
    last_used = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    customization_options = models.JSONField(default=dict, blank=True)
    # Fields for preserving original file content
    original_file_content = models.BinaryField(null=True, blank=True, help_text="Original file content for Word documents")
    original_file_type = models.CharField(max_length=10, blank=True, help_text="Original file extension (txt, docx)")
    original_filename = models.CharField(max_length=255, blank=True, help_text="Original uploaded filename")

    class Meta:
        indexes = [
            models.Index(fields=["template_type"]),
            models.Index(fields=["industry"]),
            models.Index(fields=["owner"]),
            models.Index(fields=["is_shared"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_template_type_display()})"


class Referral(models.Model):
    """Track referral opportunities and warm introductions"""
    STATUS_CHOICES = [
        ('potential', 'Potential'),
        ('requested', 'Requested'),
        ('received', 'Received'),
        ('used', 'Used'),
        ('declined', 'Declined'),
    ]
    
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="referrals")
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name="referrals_given")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='potential')
    requested_date = models.DateField(null=True, blank=True)
    completed_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=["application", "status"]),
            models.Index(fields=["contact"]),
        ]


class TeamMember(models.Model):
    """Multi-user collaboration: coaches, mentors, accountability partners"""
    ROLE_CHOICES = [
        ('coach', 'Career Coach'),
        ('mentor', 'Mentor'),
        ('partner', 'Accountability Partner'),
        ('viewer', 'Viewer'),
    ]
    
    PERMISSION_CHOICES = [
        ('view', 'View Only'),
        ('comment', 'View & Comment'),
        ('edit', 'Edit'),
        ('admin', 'Admin'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="team_members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="collaborating_on")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    permission_level = models.CharField(max_length=20, choices=PERMISSION_CHOICES, default='view')
    invited_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = [("candidate", "user")]
        indexes = [models.Index(fields=["candidate", "is_active"])]


class SharedNote(models.Model):
    """Collaborative notes and feedback on applications"""
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="shared_notes")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notes_written")
    content = models.TextField()
    is_private = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=["application", "-created_at"])]


# ======================
# INTERVIEW PREPARATION MODELS
# ======================

class InterviewQuestion(models.Model):
    """Question bank for interview preparation"""
    QUESTION_TYPES = [
        ('behavioral', 'Behavioral'),
        ('technical', 'Technical'),
        ('system_design', 'System Design'),
        ('case_study', 'Case Study'),
        ('cultural_fit', 'Cultural Fit'),
    ]
    
    type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    question_text = models.TextField()
    context = models.TextField(blank=True)
    category = models.CharField(max_length=100, blank=True)  # leadership, problem_solving, algorithms
    difficulty = models.CharField(max_length=20, default='medium')  # easy, medium, hard
    suggested_answer_framework = models.TextField(blank=True)
    related_skills = models.ManyToManyField(Skill, blank=True, related_name="interview_questions")
    
    class Meta:
        indexes = [models.Index(fields=["type", "category"])]

    def __str__(self):
        return f"[{self.get_type_display()}] {self.question_text[:50]}"


class InterviewPrepSession(models.Model):
    """Track interview preparation and practice sessions"""
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="prep_sessions")
    interview = models.ForeignKey(Interview, on_delete=models.SET_NULL, null=True, blank=True, related_name="prep_sessions")
    session_date = models.DateTimeField(default=timezone.now)
    duration_minutes = models.IntegerField(default=0)
    questions_practiced = models.ManyToManyField(InterviewQuestion, blank=True, related_name="practice_sessions")
    notes = models.TextField(blank=True)
    confidence_level = models.IntegerField(default=3)  # 1-5 scale
    
    class Meta:
        ordering = ['-session_date']
        indexes = [models.Index(fields=["application", "-session_date"])]


class MockInterview(models.Model):
    """Video practice sessions with AI or mentor feedback"""
    prep_session = models.ForeignKey(InterviewPrepSession, on_delete=models.CASCADE, related_name="mock_interviews")
    recording_url = models.URLField(blank=True)
    transcript = models.TextField(blank=True)
    ai_feedback = models.JSONField(default=dict, blank=True)  # Automated analysis
    mentor_feedback = models.TextField(blank=True)
    score = models.IntegerField(null=True, blank=True)  # 0-100
    areas_for_improvement = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']


class JobQuestionPractice(models.Model):
    """Track practiced interview questions for a specific job entry (UC-075)."""

    DIFFICULTY_CHOICES = [
        ('entry', 'Entry'),
        ('mid', 'Mid-level'),
        ('senior', 'Senior'),
    ]

    job = models.ForeignKey('JobEntry', on_delete=models.CASCADE, related_name='question_practice_logs')
    question_id = models.CharField(max_length=64)
    category = models.CharField(max_length=32)
    question_text = models.TextField()
    difficulty = models.CharField(max_length=16, choices=DIFFICULTY_CHOICES, default='mid')
    skills = models.JSONField(default=list, blank=True)
    written_response = models.TextField(blank=True)
    star_response = models.JSONField(default=dict, blank=True)
    practice_notes = models.TextField(blank=True)
    practice_count = models.PositiveIntegerField(default=1)
    first_practiced_at = models.DateTimeField(auto_now_add=True)
    last_practiced_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('job', 'question_id')]
        indexes = [
            models.Index(fields=['job', 'category']),
            models.Index(fields=['job', 'question_id']),
        ]
        ordering = ['-last_practiced_at']

    def increment_count(self):
        self.practice_count = (self.practice_count or 0) + 1


class QuestionResponseCoaching(models.Model):
    """Store AI coaching sessions for interview practice answers (UC-076)."""

    job = models.ForeignKey('JobEntry', on_delete=models.CASCADE, related_name='response_coaching_sessions')
    practice_log = models.ForeignKey(JobQuestionPractice, on_delete=models.CASCADE, related_name='coaching_sessions')
    question_id = models.CharField(max_length=64)
    question_text = models.TextField()
    response_text = models.TextField(blank=True)
    star_response = models.JSONField(default=dict, blank=True)
    coaching_payload = models.JSONField(default=dict, blank=True)
    scores = models.JSONField(default=dict, blank=True)
    word_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['job', 'question_id'], name='core_qrc_job_question_idx'),
            models.Index(fields=['practice_log', '-created_at'], name='core_qrc_practice_idx'),
        ]

    def __str__(self):
        timestamp = self.created_at.isoformat() if self.created_at else ''
        return f"CoachingSession(job={self.job_id}, question={self.question_id}, created={timestamp})"


class QuestionBankCache(models.Model):
    """Cache generated question bank data per job."""

    job = models.ForeignKey('JobEntry', on_delete=models.CASCADE, related_name='question_bank_caches')
    bank_data = models.JSONField(default=dict, blank=True)
    source = models.CharField(max_length=32, default='template')
    generated_at = models.DateTimeField(default=timezone.now)
    is_valid = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['job', 'is_valid']),
        ]

    def __str__(self):
        return f"QuestionBankCache(job={self.job_id}, source={self.source}, generated_at={self.generated_at})"


class TechnicalPrepCache(models.Model):
    """Cache structured technical prep data per job (UC-078)."""

    job = models.ForeignKey('JobEntry', on_delete=models.CASCADE, related_name='technical_prep_caches')
    prep_data = models.JSONField(default=dict, blank=True)
    source = models.CharField(max_length=32, default='template')
    generated_at = models.DateTimeField(default=timezone.now)
    is_valid = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['job', 'is_valid'], name='techprep_job_valid_idx'),
            models.Index(fields=['job', '-generated_at'], name='techprep_job_gen_idx'),
        ]

    def __str__(self):
        return f"TechnicalPrepCache(job={self.job_id}, generated_at={self.generated_at})"


class PreparationChecklistProgress(models.Model):
    """Track completion status for preparation checklist items per job."""

    job = models.ForeignKey('JobEntry', on_delete=models.CASCADE, related_name='preparation_checklist')
    task_id = models.CharField(max_length=64)
    category = models.CharField(max_length=200)
    task = models.CharField(max_length=500)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('job', 'task_id')]
        indexes = [
            models.Index(fields=['job', 'completed']),
            models.Index(fields=['job', 'task_id']),
        ]
        ordering = ['-updated_at']

    def __str__(self):
        return f"ChecklistProgress(job={self.job_id}, task={self.task[:32]})"


class InterviewChecklistProgress(models.Model):
    """
    UC-081: Track completion status for interview preparation checklist items.
    
    Stores user progress on comprehensive preparation checklist including:
    - Company research tasks
    - Role-specific preparation
    - Questions to ask
    - Attire/presentation
    - Logistics
    - Confidence building
    - Portfolio preparation
    - Post-interview follow-up
    """
    interview = models.ForeignKey(
        'InterviewSchedule',
        on_delete=models.CASCADE,
        related_name='checklist_progress'
    )
    task_id = models.CharField(max_length=64, help_text="Unique identifier for the task")
    category = models.CharField(max_length=200, help_text="Checklist category (e.g., 'Company Research')")
    task = models.CharField(max_length=500, help_text="Task description")
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('interview', 'task_id')]
        indexes = [
            models.Index(fields=['interview', 'completed']),
            models.Index(fields=['interview', 'task_id']),
        ]
        ordering = ['category', 'created_at']

    def __str__(self):
        status = "✓" if self.completed else "○"
        return f"{status} {self.task[:50]}..."


class TechnicalPrepPractice(models.Model):
    """Track timed coding challenge attempts for UC-078."""

    CHALLENGE_TYPES = [
        ('coding', 'Coding'),
        ('system_design', 'System Design'),
        ('case_study', 'Case Study'),
    ]

    job = models.ForeignKey('JobEntry', on_delete=models.CASCADE, related_name='technical_prep_practice')
    challenge_id = models.CharField(max_length=64)
    challenge_title = models.CharField(max_length=255)
    challenge_type = models.CharField(max_length=32, choices=CHALLENGE_TYPES, default='coding')
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    tests_passed = models.PositiveIntegerField(null=True, blank=True)
    tests_total = models.PositiveIntegerField(null=True, blank=True)
    score = models.PositiveIntegerField(null=True, blank=True, help_text="Percent accuracy (0-100)")
    confidence = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    attempted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-attempted_at']
        indexes = [
            models.Index(fields=['job', 'challenge_id'], name='techprep_job_ch_idx'),
            models.Index(fields=['job', '-attempted_at'], name='techprep_job_att_idx'),
        ]

    def __str__(self):
        ts = self.attempted_at.isoformat() if self.attempted_at else ''
        return f"TechnicalPrepPractice(job={self.job_id}, challenge={self.challenge_id}, attempted_at={ts})"


# ======================
# ANALYTICS & TRACKING MODELS
# ======================

class UserActivity(models.Model):
    """Track user actions for analytics and insights"""
    ACTION_TYPES = [
        ('login', 'Login'),
        ('profile_update', 'Profile Update'),
        ('application_created', 'Application Created'),
        ('application_updated', 'Application Status Update'),
        ('document_generated', 'Document Generated'),
        ('interview_scheduled', 'Interview Scheduled'),
        ('company_research', 'Company Research'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="activities")
    action_type = models.CharField(max_length=30, choices=ACTION_TYPES)
    resource_type = models.CharField(max_length=50, blank=True)  # Application, Document, etc.
    resource_id = models.IntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=["user", "-timestamp"]),
            models.Index(fields=["action_type", "-timestamp"]),
        ]


class PerformanceMetric(models.Model):
    """Aggregate performance metrics and success patterns"""
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="metrics")
    metric_date = models.DateField()
    total_applications = models.IntegerField(default=0)
    applications_this_week = models.IntegerField(default=0)
    phone_screens = models.IntegerField(default=0)
    onsite_interviews = models.IntegerField(default=0)
    offers_received = models.IntegerField(default=0)
    rejections = models.IntegerField(default=0)
    avg_response_time_days = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    conversion_rate_to_phone = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)  # percentage
    conversion_rate_to_offer = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    active_pipelines = models.IntegerField(default=0)
    
    class Meta:
        unique_together = [("candidate", "metric_date")]
        ordering = ['-metric_date']
        indexes = [models.Index(fields=["candidate", "-metric_date"])]


class SuccessPattern(models.Model):
    """AI-identified patterns in successful applications"""
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="success_patterns")
    pattern_type = models.CharField(max_length=50)  # company_size, industry, role_type
    pattern_value = models.CharField(max_length=200)
    success_rate = models.DecimalField(max_digits=5, decimal_places=2)
    sample_size = models.IntegerField(default=0)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2)
    insights = models.TextField(blank=True)
    identified_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-success_rate', '-confidence_score']
        indexes = [models.Index(fields=["candidate", "pattern_type"])]


class MarketIntelligence(models.Model):
    """Aggregated market data and salary benchmarks"""
    job_title = models.CharField(max_length=220)
    location = models.CharField(max_length=160)
    experience_level = models.CharField(max_length=50)
    industry = models.CharField(max_length=120, blank=True)
    median_salary = models.DecimalField(max_digits=10, decimal_places=2)
    percentile_25 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    percentile_75 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    sample_size = models.IntegerField(default=0)
    demand_score = models.IntegerField(default=50)  # 0-100
    growth_trend = models.CharField(max_length=20, default='stable')  # growing, stable, declining
    top_skills = models.JSONField(default=list, blank=True)
    data_source = models.CharField(max_length=100, blank=True)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=["job_title", "location"]),
            models.Index(fields=["industry"]),
        ]


# ======================
# AI & AUTOMATION MODELS
# ======================

class AIGenerationLog(models.Model):
    """Track AI-generated content for auditing and improvement"""
    CONTENT_TYPES = [
        ('resume', 'Resume'),
        ('cover_letter', 'Cover Letter'),
        ('email', 'Email Template'),
        ('linkedin_message', 'LinkedIn Message'),
        ('company_research', 'Company Research'),
        ('interview_answer', 'Interview Answer'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="ai_generations")
    content_type = models.CharField(max_length=30, choices=CONTENT_TYPES)
    prompt_used = models.TextField()
    generated_content = models.TextField()
    model_version = models.CharField(max_length=50)
    tokens_used = models.IntegerField(default=0)
    generation_time_ms = models.IntegerField(default=0)
    user_edited = models.BooleanField(default=False)
    user_rating = models.IntegerField(null=True, blank=True)  # 1-5
    associated_job = models.ForeignKey(JobOpportunity, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=["candidate", "content_type", "-created_at"]),
            models.Index(fields=["associated_job"]),
        ]


class AutomationRule(models.Model):
    """User-defined automation rules for workflow optimization"""
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="automation_rules")
    rule_name = models.CharField(max_length=200)
    trigger_event = models.CharField(max_length=50)  # application_status_change, new_job_match
    trigger_conditions = models.JSONField(default=dict)
    action_type = models.CharField(max_length=50)  # send_email, update_status, generate_document
    action_config = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    times_triggered = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [models.Index(fields=["candidate", "is_active"])]


# ======================
# REMINDERS & NOTIFICATIONS
# (existing reminder model replaced by UC-086 Reminder model defined earlier)
# ======================
class Notification(models.Model):
    """System notifications for users"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=50)  # application_update, reminder, system
    link_url = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=["user", "is_read", "-created_at"]),
        ]


# ======================
# UC-036: JOB ENTRIES
# ======================

class JobEntry(models.Model):
    """User-tracked job opportunities (manual entries).

    Keeps it independent from Company/JobOpportunity, so users can quickly log leads
    without needing company domains, etc.

    Basic fields (UC-036):
    - title (required)
    - company_name (required)
    - location
    - salary range (min/max, currency)
    - posting_url
    - application_deadline
    - description (2000 char limit)
    - industry
    - job_type (dropdown)
    
    Extended fields (UC-038):
    - personal_notes (unlimited text for observations)
    - recruiter contact information
    - hiring manager contact information
    - salary_negotiation_notes
    - interview_notes
    - application_history (JSON with timestamps)
    """
    JOB_TYPES = [
        ("ft", "Full-time"),
        ("pt", "Part-time"),
        ("contract", "Contract"),
        ("intern", "Internship"),
        ("temp", "Temporary"),
    ]

    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="job_entries")
    
    # Basic job information (UC-036)
    title = models.CharField(max_length=220)
    company_name = models.CharField(max_length=180)
    location = models.CharField(max_length=160, blank=True)
    salary_min = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    salary_max = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    salary_currency = models.CharField(max_length=3, default="USD")
    posting_url = models.URLField(blank=True)
    application_deadline = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True, max_length=2000)
    industry = models.CharField(max_length=120, blank=True)
    job_type = models.CharField(max_length=20, choices=JOB_TYPES, default="ft")
    
    # Extended fields for detailed tracking (UC-038)
    personal_notes = models.TextField(blank=True, help_text="Unlimited text for personal observations")
    
    # Contact information
    recruiter_name = models.CharField(max_length=180, blank=True)
    recruiter_email = models.EmailField(blank=True)
    recruiter_phone = models.CharField(max_length=20, blank=True)
    hiring_manager_name = models.CharField(max_length=180, blank=True)
    hiring_manager_email = models.EmailField(blank=True)
    
    # Additional notes sections
    salary_negotiation_notes = models.TextField(blank=True)
    interview_notes = models.TextField(blank=True)
    
    # Application history log with timestamps
    # Format: [{"action": "Applied", "timestamp": "2024-11-04T10:30:00Z", "notes": "..."}, ...]
    application_history = models.JSONField(default=list, blank=True)
    
    # UC-042: Linked application materials
    resume_doc = models.ForeignKey('Document', on_delete=models.SET_NULL, null=True, blank=True, related_name='used_as_resume_in')
    cover_letter_doc = models.ForeignKey('Document', on_delete=models.SET_NULL, null=True, blank=True, related_name='used_as_cover_letter_in')

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    STATUS_CHOICES = [
        ("interested", "Interested"),
        ("applied", "Applied"),
        ("phone_screen", "Phone Screen"),
        ("interview", "Interview"),
        ("offer", "Offer"),
        ("rejected", "Rejected"),
    ]

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="interested")
    last_status_change = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    # Deadline notification tracking
    three_day_notice_sent_at = models.DateTimeField(null=True, blank=True)
    day_of_notice_sent_at = models.DateTimeField(null=True, blank=True)

    # Archiving fields (UC-045)
    is_archived = models.BooleanField(default=False, db_index=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    archive_reason = models.CharField(
        max_length=100,
        blank=True,
        choices=[
            ("completed", "Position Filled/Completed"),
            ("not_interested", "No Longer Interested"),
            ("rejected", "Application Rejected"),
            ("expired", "Posting Expired"),
            ("auto", "Auto-archived"),
            ("other", "Other"),
        ],
    )

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=["candidate", "-updated_at"]),
            models.Index(fields=["job_type"]),
            models.Index(fields=["industry"]),
            models.Index(fields=["candidate", "status"]),
            models.Index(fields=["candidate", "is_archived"]),
            # UC-042: quick lookups for analytics
            models.Index(fields=["resume_doc"]),
            models.Index(fields=["cover_letter_doc"]),
        ]

    def __str__(self):
        return f"{self.title} @ {self.company_name}"


class JobStatusChange(models.Model):
    """History of job status changes for auditing and analytics."""
    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, related_name="status_changes")
    old_status = models.CharField(max_length=20, choices=JobEntry.STATUS_CHOICES)
    new_status = models.CharField(max_length=20, choices=JobEntry.STATUS_CHOICES)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-changed_at']
        indexes = [
            models.Index(fields=["job", "-changed_at"]),
        ]

    def __str__(self):
        return f"{self.job_id}: {self.old_status} -> {self.new_status} @ {self.changed_at}"


class JobMaterialsHistory(models.Model):
    """History of application materials linked to a JobEntry (UC-042).

    Each record captures the pair of materials selected at a point in time.
    """
    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, related_name='materials_history')
    resume_doc = models.ForeignKey('Document', on_delete=models.SET_NULL, null=True, blank=True, related_name='materials_history_resume')
    cover_letter_doc = models.ForeignKey('Document', on_delete=models.SET_NULL, null=True, blank=True, related_name='materials_history_cover')
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-changed_at']
        indexes = [
            models.Index(fields=["job", "-changed_at"]),
        ]


class SalaryResearch(models.Model):
    """Salary research and benchmarking data for job opportunities (UC-067).
    
    Stores salary information gathered from various sources including web scraping,
    to help users understand compensation ranges and negotiate effectively.
    """
    EXPERIENCE_LEVELS = [
        ('entry', 'Entry Level (0-2 years)'),
        ('mid', 'Mid Level (3-5 years)'),
        ('senior', 'Senior Level (6-10 years)'),
        ('lead', 'Lead/Principal (10+ years)'),
        ('executive', 'Executive'),
    ]
    
    COMPANY_SIZES = [
        ('startup', 'Startup (1-50)'),
        ('small', 'Small (51-200)'),
        ('medium', 'Medium (201-1000)'),
        ('large', 'Large (1001-5000)'),
        ('enterprise', 'Enterprise (5000+)'),
    ]
    
    DATA_SOURCES = [
        ('glassdoor', 'Glassdoor'),
        ('payscale', 'PayScale'),
        ('indeed', 'Indeed'),
        ('linkedin', 'LinkedIn'),
        ('levels_fyi', 'Levels.fyi'),
        ('manual', 'Manual Entry'),
        ('aggregated', 'Aggregated Data'),
    ]

    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, related_name='salary_research')
    
    # Job details for research context
    position_title = models.CharField(max_length=220)
    location = models.CharField(max_length=160)
    experience_level = models.CharField(max_length=20, choices=EXPERIENCE_LEVELS, blank=True)
    company_size = models.CharField(max_length=20, choices=COMPANY_SIZES, blank=True)
    
    # Salary data
    salary_min = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    salary_max = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    salary_median = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    salary_currency = models.CharField(max_length=3, default="USD")
    
    # Total compensation breakdown
    base_salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    bonus_avg = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    stock_equity = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_comp_min = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_comp_max = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # Benefits and perks (JSON for flexibility)
    benefits = models.JSONField(default=dict, blank=True, help_text="Benefits package details")
    
    # Market insights
    market_trend = models.CharField(max_length=20, blank=True, help_text="up, down, stable")
    percentile_25 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    percentile_75 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # Negotiation insights
    negotiation_leverage = models.CharField(max_length=20, blank=True, help_text="high, medium, low")
    recommended_ask = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    negotiation_tips = models.TextField(blank=True)
    
    # Comparison with user's current compensation
    user_current_salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    salary_change_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    
    # Data source and metadata
    data_source = models.CharField(max_length=20, choices=DATA_SOURCES, default='aggregated')
    source_url = models.URLField(blank=True)
    sample_size = models.PositiveIntegerField(null=True, blank=True, help_text="Number of data points")
    confidence_score = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True, help_text="0-1 confidence")
    
    # Additional market data (JSON for flexibility)
    company_comparisons = models.JSONField(default=list, blank=True, help_text="List of company salary comparisons")
    historical_data = models.JSONField(default=list, blank=True, help_text="Historical salary trends")
    
    # Metadata
    research_notes = models.TextField(blank=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=["job", "-created_at"]),
            models.Index(fields=["position_title", "location"]),
            models.Index(fields=["experience_level"]),
        ]

    def __str__(self):
        return f"Salary Research: {self.position_title} in {self.location}"
    
    def get_salary_range_display(self):
        """Return formatted salary range string"""
        if self.salary_min and self.salary_max:
            return f"${self.salary_min:,.0f} - ${self.salary_max:,.0f}"
        elif self.salary_median:
            return f"${self.salary_median:,.0f} (median)"
        return "N/A"
    
    def get_total_comp_range_display(self):
        """Return formatted total compensation range string"""
        if self.total_comp_min and self.total_comp_max:
            return f"${self.total_comp_min:,.0f} - ${self.total_comp_max:,.0f}"
        return "N/A"

    def __str__(self):
        return f"Materials@{self.changed_at} for job {self.job_id}"


class InterviewInsightsCache(models.Model):
    """Cached AI-generated interview insights to reduce API costs (UC-068).
    
    Stores interview insights generated for specific job/company combinations
    to avoid redundant Gemini API calls.
    """
    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, related_name='interview_insights_cache')
    
    # Job details used for generation
    job_title = models.CharField(max_length=220)
    company_name = models.CharField(max_length=220)
    
    # Generated insights stored as JSON
    insights_data = models.JSONField(
        help_text="Complete interview insights JSON including process, questions, tips, checklist"
    )
    
    # Generation metadata
    generated_by = models.CharField(
        max_length=20,
        choices=[('ai', 'AI Generated'), ('template', 'Template Based')],
        default='ai'
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    
    # Cache invalidation
    is_valid = models.BooleanField(
        default=True,
        help_text="Set to False to force regeneration"
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['job', 'is_valid']),
            models.Index(fields=['company_name', 'job_title']),
        ]
        ordering = ['-generated_at']
    
    def __str__(self):
        return f"Interview Insights: {self.job_title} at {self.company_name}"


class LearningResource(models.Model):
    """Curated learning resources for skill development (UC-066).
    
    Stores links to courses, tutorials, and learning materials that can be
    recommended for specific skills in the skills gap analysis.
    """
    RESOURCE_TYPES = [
        ('course', 'Online Course'),
        ('tutorial', 'Tutorial'),
        ('documentation', 'Documentation'),
        ('video', 'Video'),
        ('book', 'Book'),
        ('practice', 'Practice Platform'),
        ('certification', 'Certification'),
    ]
    
    COST_TYPES = [
        ('free', 'Free'),
        ('freemium', 'Freemium'),
        ('paid', 'Paid'),
    ]
    
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name='learning_resources')
    title = models.CharField(max_length=300)
    provider = models.CharField(max_length=200)  # e.g., Coursera, freeCodeCamp, YouTube
    url = models.URLField()
    resource_type = models.CharField(max_length=20, choices=RESOURCE_TYPES, default='course')
    cost_type = models.CharField(max_length=20, choices=COST_TYPES, default='free')
    duration_hours = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    difficulty_level = models.CharField(max_length=20, blank=True)  # beginner, intermediate, advanced
    description = models.TextField(blank=True)
    
    # Quality indicators
    rating = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)  # 0-5.0
    credibility_score = models.IntegerField(default=50, help_text="0-100 internal quality score")
    
    # Metadata
    tags = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['skill', 'is_active', '-credibility_score']),
            models.Index(fields=['difficulty_level']),
        ]
        ordering = ['-credibility_score', '-rating', 'title']
    
    def __str__(self):
        return f"{self.title} ({self.provider}) - {self.skill.name}"


class SkillGapAnalysisCache(models.Model):
    """Cached skills gap analysis results (UC-066).
    
    Stores computed skill gap analysis for job entries to avoid repeated
    computation and provide consistent results.
    """
    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, related_name='skills_gap_cache')
    
    # Job details used for analysis
    job_title = models.CharField(max_length=220)
    company_name = models.CharField(max_length=220)
    
    # Analysis results stored as JSON
    analysis_data = models.JSONField(
        help_text="Complete skills gap analysis including skills, gaps, resources, learning paths"
    )
    
    # Generation metadata
    source = models.CharField(
        max_length=20,
        choices=[
            ('requirements', 'Job Requirements'),
            ('parsed', 'Parsed Description'),
            ('ai', 'AI Analysis'),
        ],
        default='parsed'
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    
    # Cache invalidation
    is_valid = models.BooleanField(
        default=True,
        help_text="Set to False to force regeneration"
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['job', 'is_valid']),
            models.Index(fields=['job_title']),
        ]
        ordering = ['-generated_at']
    
    def __str__(self):
        return f"Skills Gap: {self.job_title} at {self.company_name}"


class SkillDevelopmentProgress(models.Model):
    """Track user progress on developing specific skills (UC-066).
    
    Records practice sessions, course completions, and other activities
    that contribute to skill development.
    """
    ACTIVITY_TYPES = [
        ('practice', 'Practice Session'),
        ('course', 'Course Progress'),
        ('project', 'Project Work'),
        ('certification', 'Certification Earned'),
        ('review', 'Review/Refresh'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name='skill_progress')
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name='progress_records')
    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, null=True, blank=True, related_name='skill_progress')
    learning_resource = models.ForeignKey(LearningResource, on_delete=models.SET_NULL, null=True, blank=True)
    
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES, default='practice')
    hours_spent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    progress_percent = models.IntegerField(default=0, help_text="0-100 completion percentage")
    notes = models.TextField(blank=True)
    
    activity_date = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['candidate', 'skill', '-activity_date']),
            models.Index(fields=['job', '-activity_date']),
        ]
        ordering = ['-activity_date']
    
    def __str__(self):
        return f"{self.candidate.user.username} - {self.skill.name} ({self.activity_type})"


class JobMatchAnalysis(models.Model):
    """Store job matching analysis results with scores and breakdowns.
    
    Provides comprehensive match scoring for UC-065 Job Matching Algorithm:
    - Overall match score (0-100)
    - Component scores (skills, experience, education) 
    - Detailed match breakdown and recommendations
    - Personalized scoring weights
    - Historical tracking capabilities
    """
    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, related_name='match_analysis')
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name='job_matches')
    
    # Overall match score (0-100)
    overall_score = models.DecimalField(max_digits=5, decimal_places=2)
    
    # Component scores (0-100 each)
    skills_score = models.DecimalField(max_digits=5, decimal_places=2)
    experience_score = models.DecimalField(max_digits=5, decimal_places=2)
    education_score = models.DecimalField(max_digits=5, decimal_places=2)
    
    # Detailed match breakdown
    match_data = models.JSONField(help_text="Detailed analysis including strengths, gaps, and recommendations")
    
    # Personalized scoring weights
    user_weights = models.JSONField(
        default=dict, 
        help_text="Custom category weights (skills, experience, education)"
    )
    
    # Metadata
    generated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_valid = models.BooleanField(default=True, help_text="False if analysis is outdated due to profile changes")
    
    class Meta:
        indexes = [
            models.Index(fields=['candidate', '-overall_score']),
            models.Index(fields=['job', '-overall_score']),
            models.Index(fields=['candidate', '-generated_at']),
            models.Index(fields=['-overall_score']),
        ]
        ordering = ['-overall_score', '-generated_at']
        unique_together = ['job', 'candidate']
    
    def __str__(self):
        return f"{self.candidate.user.username} - {self.job.title} at {self.job.company_name} ({self.overall_score}%)"
    
    def invalidate(self):
        """Mark analysis as invalid when profile or job changes."""
        self.is_valid = False
        self.save(update_fields=['is_valid'])
    
    @property
    def match_grade(self):
        """Return letter grade based on overall score."""
        if self.overall_score >= 90:
            return 'A+'
        elif self.overall_score >= 85:
            return 'A'
        elif self.overall_score >= 80:
            return 'B+'
        elif self.overall_score >= 75:
            return 'B'
        elif self.overall_score >= 70:
            return 'C+'
        elif self.overall_score >= 65:
            return 'C'
        elif self.overall_score >= 60:
            return 'D+'
        elif self.overall_score >= 55:
            return 'D'
        else:
            return 'F'


class InterviewSchedule(models.Model):
    """Interview scheduling and tracking for job applications (UC-071).
    
    Manages interview scheduling with calendar integration, conflict detection,
    preparation task generation, and reminder system.
    """
    INTERVIEW_TYPES = [
        ('phone', 'Phone Interview'),
        ('video', 'Video Interview'),
        ('in_person', 'In-Person Interview'),
        ('assessment', 'Technical Assessment'),
        ('group', 'Group Interview'),
    ]
    
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('rescheduled', 'Rescheduled'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
        ('no_show', 'No Show'),
    ]
    
    OUTCOME_CHOICES = [
        ('', 'Not Yet Recorded'),
        ('excellent', 'Excellent'),
        ('good', 'Good'),
        ('average', 'Average'),
        ('poor', 'Poor'),
        ('rejected', 'Rejected'),
        ('withdrew', 'Withdrew Application'),
    ]
    
    # Core relationships
    job = models.ForeignKey(
        'JobEntry',
        on_delete=models.CASCADE,
        related_name='interviews'
    )
    candidate = models.ForeignKey(
        'CandidateProfile',
        on_delete=models.CASCADE,
        related_name='interviews'
    )
    
    # Interview details
    interview_type = models.CharField(max_length=20, choices=INTERVIEW_TYPES)
    scheduled_at = models.DateTimeField(db_index=True, help_text="Interview date and time")
    duration_minutes = models.PositiveIntegerField(default=60, help_text="Expected duration in minutes")
    
    # Location/meeting details
    location = models.CharField(
        max_length=500,
        blank=True,
        help_text="Physical address for in-person interviews"
    )
    meeting_link = models.URLField(
        max_length=500,
        blank=True,
        help_text="Video conference link (Zoom, Teams, etc.)"
    )
    interviewer_name = models.CharField(max_length=200, blank=True)
    interviewer_email = models.EmailField(blank=True)
    interviewer_phone = models.CharField(max_length=20, blank=True)
    
    # Status and outcome
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    outcome = models.CharField(max_length=20, choices=OUTCOME_CHOICES, blank=True, default='')
    feedback_notes = models.TextField(blank=True, help_text="Post-interview notes and feedback")
    
    # Interview preparation
    preparation_notes = models.TextField(blank=True, help_text="Preparation notes and research")
    questions_to_ask = models.TextField(blank=True, help_text="Questions prepared for interviewer")
    
    # In-app reminder tracking (will appear in calendar/dashboard)
    show_24h_reminder = models.BooleanField(default=False, help_text="Show 24h reminder in app")
    show_1h_reminder = models.BooleanField(default=False, help_text="Show 1h reminder in app")
    reminder_24h_dismissed = models.BooleanField(default=False)
    reminder_1h_dismissed = models.BooleanField(default=False)
    
    # Rescheduling history
    original_datetime = models.DateTimeField(null=True, blank=True, help_text="Original scheduled time if rescheduled")
    rescheduled_reason = models.CharField(max_length=500, blank=True)
    cancelled_reason = models.CharField(max_length=500, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['scheduled_at']
        indexes = [
            models.Index(fields=['candidate', 'scheduled_at']),
            models.Index(fields=['job', 'scheduled_at']),
            models.Index(fields=['candidate', 'status']),
            models.Index(fields=['scheduled_at', 'status']),
            models.Index(fields=['show_24h_reminder', 'show_1h_reminder']),
        ]
    
    def __str__(self):
        return f"{self.get_interview_type_display()} - {self.job.title} at {self.job.company_name} on {self.scheduled_at.strftime('%Y-%m-%d %H:%M')}"
    
    def get_end_time(self):
        """Calculate interview end time based on duration."""
        from datetime import timedelta
        return self.scheduled_at + timedelta(minutes=self.duration_minutes)
    
    def has_conflict(self, exclude_self=True):
        """Check if this interview conflicts with other scheduled interviews.
        
        Returns:
            QuerySet of conflicting InterviewSchedule objects
        """
        from datetime import timedelta
        
        # Get all interviews for this candidate that aren't cancelled/no-show
        interviews = InterviewSchedule.objects.filter(
            candidate=self.candidate,
            status__in=['scheduled', 'rescheduled']
        )
        
        if exclude_self and self.pk:
            interviews = interviews.exclude(pk=self.pk)
        
        # Check for time overlap
        start = self.scheduled_at
        end = self.get_end_time()
        
        conflicts = []
        for interview in interviews:
            other_start = interview.scheduled_at
            other_end = interview.get_end_time()
            
            # Check if intervals overlap
            if start < other_end and end > other_start:
                conflicts.append(interview)
        
        return conflicts
    
    def mark_completed(self, outcome=None, feedback_notes=None):
        """Mark interview as completed and optionally record outcome."""
        self.status = 'completed'
        if outcome:
            self.outcome = outcome
        if feedback_notes:
            self.feedback_notes = feedback_notes
        self.save()
    
    def reschedule(self, new_datetime, reason=''):
        """Reschedule interview to new datetime."""
        if not self.original_datetime:
            self.original_datetime = self.scheduled_at
        self.scheduled_at = new_datetime
        self.status = 'rescheduled'
        self.rescheduled_reason = reason
        # Reset reminders
        self.show_24h_reminder = False
        self.show_1h_reminder = False
        self.reminder_24h_dismissed = False
        self.reminder_1h_dismissed = False
        self.save()
    
    def cancel(self, reason=''):
        """Cancel the interview."""
        self.status = 'cancelled'
        self.cancelled_reason = reason
        self.save()
    
    @property
    def is_upcoming(self):
        """Check if interview is in the future."""
        return self.scheduled_at > timezone.now() and self.status in ['scheduled', 'rescheduled']
    
    @property
    def needs_24h_reminder(self):
        """Check if 24-hour reminder should be shown in app."""
        from datetime import timedelta
        if self.reminder_24h_dismissed or self.status not in ['scheduled', 'rescheduled']:
            return False
        time_until = self.scheduled_at - timezone.now()
        # Show reminder when within 24 hours
        return timedelta(hours=0) <= time_until <= timedelta(hours=24)
    
    @property
    def needs_1h_reminder(self):
        """Check if 1-hour reminder should be shown in app."""
        from datetime import timedelta
        if self.reminder_1h_dismissed or self.status not in ['scheduled', 'rescheduled']:
            return False
        time_until = self.scheduled_at - timezone.now()
        # Show reminder when within 1 hour
        return timedelta(minutes=0) <= time_until <= timedelta(hours=1)
    
    def update_reminder_flags(self):
        """Update reminder flags based on time until interview."""
        if self.needs_24h_reminder:
            self.show_24h_reminder = True
        if self.needs_1h_reminder:
            self.show_1h_reminder = True
        if self.show_24h_reminder or self.show_1h_reminder:
            self.save(update_fields=['show_24h_reminder', 'show_1h_reminder'])


class InterviewPreparationTask(models.Model):
    """Auto-generated preparation tasks for interviews (UC-071).
    
    When an interview is scheduled, helpful preparation tasks are automatically
    created to guide the candidate through interview preparation.
    """
    TASK_TYPES = [
        ('research_company', 'Research Company'),
        ('review_job', 'Review Job Description'),
        ('prepare_questions', 'Prepare Questions'),
        ('practice_answers', 'Practice Common Answers'),
        ('review_resume', 'Review Your Resume'),
        ('prepare_examples', 'Prepare STAR Examples'),
        ('research_interviewer', 'Research Interviewer'),
        ('test_tech', 'Test Technology (for video)'),
        ('plan_route', 'Plan Route (for in-person)'),
        ('prepare_materials', 'Prepare Materials'),
        ('custom', 'Custom Task'),
    ]
    
    interview = models.ForeignKey(
        'InterviewSchedule',
        on_delete=models.CASCADE,
        related_name='preparation_tasks'
    )
    task_type = models.CharField(max_length=30, choices=TASK_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0, help_text="Display order")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['interview', 'is_completed']),
        ]
    
    def __str__(self):
        status = "✓" if self.is_completed else "○"
        return f"{status} {self.title}"
    
    def mark_completed(self):
        """Mark task as completed."""
        self.is_completed = True
        self.completed_at = timezone.now()
        self.save()


class ResumeVersion(models.Model):
    """UC-052: Resume Version Management
    
    Tracks different versions of resumes with version control capabilities.
    Allows users to manage multiple tailored versions for different applications.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(
        CandidateProfile, 
        on_delete=models.CASCADE, 
        related_name="resume_versions"
    )
    
    # Version identification
    version_name = models.CharField(
        max_length=200,
        help_text="Descriptive name for this resume version (e.g., 'Software Engineer - Tech Companies')"
    )
    description = models.TextField(
        blank=True,
        help_text="Optional notes about what makes this version unique"
    )
    
    # Version content (stored as LaTeX or structured JSON)
    content = models.JSONField(
        help_text="Resume content in structured format (sections, experiences, skills, etc.)"
    )
    latex_content = models.TextField(
        blank=True,
        help_text="LaTeX source if generated by AI"
    )
    
    # Version metadata
    is_default = models.BooleanField(
        default=False,
        help_text="Mark as the master/default resume version"
    )
    is_archived = models.BooleanField(
        default=False,
        help_text="Archive old versions without deleting them"
    )
    
    # Link to job application (optional)
    source_job = models.ForeignKey(
        JobOpportunity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resume_versions",
        help_text="Job this version was tailored for"
    )
    
    # Link to applications using this version
    applications = models.ManyToManyField(
        'Application',
        blank=True,
        related_name="resume_versions_used",
        help_text="Applications that used this resume version"
    )
    
    # Version history
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_from = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="derived_versions",
        help_text="Parent version this was created from"
    )
    
    # AI generation metadata
    generated_by_ai = models.BooleanField(default=False)
    generation_params = models.JSONField(
        default=dict,
        blank=True,
        help_text="AI generation parameters (tone, variation, etc.)"
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['candidate', '-created_at']),
            models.Index(fields=['candidate', 'is_default']),
            models.Index(fields=['candidate', 'is_archived']),
        ]
        ordering = ['-is_default', '-updated_at']
        constraints = [
            models.UniqueConstraint(
                fields=['candidate', 'version_name'],
                name='unique_version_name_per_candidate'
            )
        ]
    
    def __str__(self):
        default_marker = " [DEFAULT]" if self.is_default else ""
        archived_marker = " [ARCHIVED]" if self.is_archived else ""
        return f"{self.version_name}{default_marker}{archived_marker}"
    
    def save(self, *args, **kwargs):
        # Track if this is an update to existing version
        is_update = self.pk is not None
        old_version = None
        if is_update:
            try:
                old_version = ResumeVersion.objects.get(pk=self.pk)
            except ResumeVersion.DoesNotExist:
                pass
        
        # Ensure only one default version per candidate
        if self.is_default:
            ResumeVersion.objects.filter(
                candidate=self.candidate,
                is_default=True
            ).exclude(id=self.id).update(is_default=False)
        
        super().save(*args, **kwargs)
        
        # Create change record if content was modified
        if is_update and old_version:
            changes = {}
            if old_version.version_name != self.version_name:
                changes['version_name'] = {'old': old_version.version_name, 'new': self.version_name}
            if old_version.description != self.description:
                changes['description'] = {'old': old_version.description, 'new': self.description}
            if old_version.content != self.content:
                changes['content'] = {'old': old_version.content, 'new': self.content}
            if old_version.latex_content != self.latex_content:
                changes['latex_content'] = {'old': len(old_version.latex_content or ''), 'new': len(self.latex_content or '')}
            
            if changes:
                ResumeVersionChange.objects.create(
                    version=self,
                    changes=changes,
                    change_type='edit'
                )


class ResumeVersionChange(models.Model):
    """
    UC-052: Track changes made to resume versions
    Records each edit with timestamp and change details
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.ForeignKey(
        ResumeVersion,
        on_delete=models.CASCADE,
        related_name='change_history'
    )
    change_type = models.CharField(
        max_length=50,
        choices=[
            ('create', 'Created'),
            ('edit', 'Edited'),
            ('merge', 'Merged'),
            ('duplicate', 'Duplicated'),
        ],
        default='edit'
    )
    changes = models.JSONField(
        help_text='Details of what changed (field-level diffs)'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['version', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.change_type.title()} - {self.version.version_name} at {self.created_at}"


# ============================================================================
# UC-069: Application Workflow Automation Models
# ============================================================================

class ApplicationAutomationRule(models.Model):
    """
    UC-069: Defines automation rules for job applications
    
    Allows candidates to set up automated workflows that trigger
    specific actions when certain conditions are met (like when a new job is saved).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(
        CandidateProfile,
        on_delete=models.CASCADE,
        related_name='application_automation_rules'
    )
    
    # Rule identification
    name = models.CharField(
        max_length=255,
        help_text="User-defined name for this automation rule"
    )
    description = models.TextField(
        blank=True,
        help_text="Optional description of what this rule does"
    )
    
    # Trigger configuration
    trigger_type = models.CharField(
        max_length=50,
        choices=[
            ('job_saved', 'Job Saved'),
            ('job_updated', 'Job Updated'),
            ('deadline_approaching', 'Application Deadline Approaching'),
            ('status_changed', 'Application Status Changed'),
        ],
        help_text="Event that triggers this automation"
    )
    
    trigger_conditions = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional conditions that must be met for trigger (e.g., job title contains keywords)"
    )
    
    # Action configuration  
    action_type = models.CharField(
        max_length=50,
        choices=[
            ('generate_documents', 'Generate Application Documents'),
            ('set_reminder', 'Set Application Reminder'),
            ('update_status', 'Update Application Status'),
            ('send_email', 'Send Email Notification'),
        ],
        help_text="Action to take when rule is triggered"
    )
    
    action_parameters = models.JSONField(
        default=dict,
        blank=True,
        help_text="Parameters for the action (e.g., which document templates to use)"
    )
    
    # Rule state
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this rule is currently active"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Execution tracking
    last_triggered_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this rule was last executed"
    )
    trigger_count = models.PositiveIntegerField(
        default=0,
        help_text="How many times this rule has been triggered"
    )
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['candidate', 'is_active']),
            models.Index(fields=['trigger_type', 'is_active']),
            models.Index(fields=['last_triggered_at']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.get_trigger_type_display()} → {self.get_action_type_display()})"
    
    def can_trigger_for_job(self, job_entry):
        """
        Check if this rule should trigger for the given job
        
        Args:
            job_entry (JobEntry): The job to check against
            
        Returns:
            bool: True if the rule should trigger
        """
        if not self.is_active:
            return False
        
        # Check trigger conditions
        conditions = self.trigger_conditions or {}
        
        # Check job title keywords if specified
        if 'job_title_keywords' in conditions:
            keywords = conditions['job_title_keywords']
            if isinstance(keywords, list):
                job_title_lower = job_entry.title.lower()
                if not any(keyword.lower() in job_title_lower for keyword in keywords):
                    return False
        
        # Check company keywords if specified  
        if 'company_keywords' in conditions:
            keywords = conditions['company_keywords']
            if isinstance(keywords, list):
                company_name_lower = job_entry.company_name.lower()
                if not any(keyword.lower() in company_name_lower for keyword in keywords):
                    return False
        
        # Check salary range if specified
        if 'min_salary' in conditions and job_entry.salary_min:
            if job_entry.salary_min < conditions['min_salary']:
                return False
                
        if 'max_salary' in conditions and job_entry.salary_max:
            if job_entry.salary_max > conditions['max_salary']:
                return False
        
        return True
    
    def execute_action(self, context_data=None):
        """
        Execute the action defined by this rule
        
        Args:
            context_data (dict): Additional context for action execution
            
        Returns:
            dict: Result of action execution
        """
        context_data = context_data or {}
        
        try:
            if self.action_type == 'generate_documents':
                return self._execute_generate_documents(context_data)
            elif self.action_type == 'set_reminder':
                return self._execute_set_reminder(context_data)
            elif self.action_type == 'update_status':
                return self._execute_update_status(context_data)
            elif self.action_type == 'send_email':
                return self._execute_send_email(context_data)
            else:
                return {'success': False, 'error': f'Unknown action type: {self.action_type}'}
        
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _execute_generate_documents(self, context_data):
        """Execute document generation action"""
        job_entry = context_data.get('job_entry')
        if not job_entry:
            return {'success': False, 'error': 'No job_entry in context'}
        
        # Import here to avoid circular imports
        from core.models import ApplicationPackageGenerator
        
        generator = ApplicationPackageGenerator(
            candidate=self.candidate,
            job=job_entry
        )
        
        # Use action parameters to determine what to generate
        params = self.action_parameters or {}
        include_resume = params.get('include_resume', True)
        include_cover_letter = params.get('include_cover_letter', True)
        
        try:
            package = generator.generate_application_package(
                include_resume=include_resume,
                include_cover_letter=include_cover_letter
            )
            
            # Update trigger statistics
            self.last_triggered_at = timezone.now()
            self.trigger_count += 1
            self.save(update_fields=['last_triggered_at', 'trigger_count'])
            
            return {
                'success': True,
                'package_id': package.id,
                'message': 'Application package generated successfully'
            }
            
        except Exception as e:
            return {'success': False, 'error': f'Failed to generate package: {str(e)}'}
    
    def _execute_set_reminder(self, context_data):
        """Execute reminder setting action"""
        # Implementation for setting reminders
        return {'success': True, 'message': 'Reminder action not yet implemented'}
    
    def _execute_update_status(self, context_data):
        """Execute status update action"""
        # Implementation for status updates
        return {'success': True, 'message': 'Status update action not yet implemented'}
    
    def _execute_send_email(self, context_data):
        """Execute email sending action"""
        # Implementation for email notifications
        return {'success': True, 'message': 'Email action not yet implemented'}


class ApplicationPackage(models.Model):
    """
    UC-069: Generated application package containing documents for a job
    
    Represents a complete application package (resume + cover letter + other docs)
    that was generated for a specific job, either manually or via automation.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(
        CandidateProfile,
        on_delete=models.CASCADE,
        related_name='application_packages'
    )
    job = models.ForeignKey(
        JobEntry,
        on_delete=models.CASCADE,
        related_name='application_packages'
    )
    
    # Generated documents
    resume_document = models.ForeignKey(
        'Document',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resume_packages',
        help_text="Generated resume document for this application"
    )
    
    cover_letter_document = models.ForeignKey(
        'Document',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cover_letter_packages',
        help_text="Generated cover letter document for this application"
    )
    
    # Package metadata
    generation_method = models.CharField(
        max_length=50,
        choices=[
            ('manual', 'Manual Generation'),
            ('automation_rule', 'Automation Rule'),
            ('batch_process', 'Batch Processing'),
        ],
        default='manual'
    )
    
    automation_rule = models.ForeignKey(
        ApplicationAutomationRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_packages',
        help_text="Automation rule that generated this package (if applicable)"
    )
    
    status = models.CharField(
        max_length=50,
        choices=[
            ('draft', 'Draft'),
            ('ready', 'Ready to Submit'),
            ('submitted', 'Submitted'),
            ('needs_review', 'Needs Review'),
        ],
        default='ready'
    )
    
    notes = models.TextField(
        blank=True,
        help_text="User notes about this application package"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this package was submitted for the job"
    )
    
    class Meta:
        ordering = ['-created_at']
        unique_together = ['candidate', 'job']  # One package per job per candidate
        indexes = [
            models.Index(fields=['candidate', 'status']),
            models.Index(fields=['job', 'status']),
            models.Index(fields=['automation_rule']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"Application Package: {self.job.title} at {self.job.company_name}"
    
    @property
    def document_count(self):
        """Count of documents in this package"""
        count = 0
        if self.resume_document:
            count += 1
        if self.cover_letter_document:
            count += 1
        return count
    
    @property
    def is_complete(self):
        """Check if package has all required documents"""
        return bool(self.resume_document and self.cover_letter_document)
    
    def mark_submitted(self):
        """Mark this package as submitted"""
        self.status = 'submitted'
        self.submitted_at = timezone.now()
        self.save(update_fields=['status', 'submitted_at'])


class ApplicationPackageGenerator:
    """
    UC-069: Utility class for generating application packages
    
    Handles the logic for creating complete application packages
    by generating or selecting appropriate documents for a job application.
    """
    
    def __init__(self, candidate, job):
        """
        Initialize generator
        
        Args:
            candidate (CandidateProfile): The candidate applying
            job (JobEntry): The job being applied to
        """
        self.candidate = candidate
        self.job = job
    
    def generate_application_package(self, include_resume=True, include_cover_letter=True):
        """
        Generate a complete application package for the job
        
        Args:
            include_resume (bool): Whether to include a resume
            include_cover_letter (bool): Whether to include a cover letter
            
        Returns:
            ApplicationPackage: The generated package
        """
        # Check if package already exists
        package, created = ApplicationPackage.objects.get_or_create(
            candidate=self.candidate,
            job=self.job,
            defaults={
                'generation_method': 'automation_rule',
                'status': 'ready'
            }
        )
        
        # Generate or select documents
        if include_resume and not package.resume_document:
            resume_doc = self._generate_or_select_resume()
            if resume_doc:
                package.resume_document = resume_doc
        
        if include_cover_letter and not package.cover_letter_document:
            cover_letter_doc = self._generate_or_select_cover_letter()
            if cover_letter_doc:
                package.cover_letter_document = cover_letter_doc
        
        package.save()
        return package
    
    def _generate_or_select_resume(self):
        """
        Generate or select the best resume for this job
        
        Returns:
            Document: Resume document or None
        """
        # For now, use the default resume
        # In the future, this could use AI to customize the resume
        try:
            return Document.objects.filter(
                candidate=self.candidate,
                doc_type='resume'
            ).first()
        except Document.DoesNotExist:
            return None
    
    def _generate_or_select_cover_letter(self):
        """
        Generate or select the best cover letter for this job
        
        Returns:
            Document: Cover letter document or None
        """
        # For now, use existing cover letter or create a basic one
        # In the future, this could use AI to generate custom cover letters
        try:
            return Document.objects.filter(
                candidate=self.candidate,
                doc_type='cover_letter'
            ).first()
        except Document.DoesNotExist:
            return None


class ApplicationGoal(models.Model):
    """Track weekly application goals and progress for analytics."""
    
    GOAL_TYPES = [
        ('weekly_applications', 'Weekly Applications'),
        ('response_rate', 'Response Rate Target'),
        ('interviews_per_month', 'Interviews per Month'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="application_goals")
    goal_type = models.CharField(max_length=30, choices=GOAL_TYPES, default='weekly_applications')
    target_value = models.DecimalField(max_digits=10, decimal_places=2, help_text="Target number (e.g., 5 applications per week)")
    current_value = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Current progress toward goal")
    
    # Time period for the goal
    start_date = models.DateField()
    end_date = models.DateField()
    
    # Goal status
    is_active = models.BooleanField(default=True)
    is_completed = models.BooleanField(default=False)
    completion_date = models.DateTimeField(null=True, blank=True)
    
    # Additional metadata
    notes = models.TextField(blank=True, help_text="Optional notes about this goal")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['candidate', 'goal_type', 'is_active']),
            models.Index(fields=['start_date', 'end_date']),
        ]
    
    def __str__(self):
        return f"{self.candidate.user.username} - {self.get_goal_type_display()}: {self.target_value}"
    
    @property
    def progress_percentage(self):
        """Calculate progress as percentage of target."""
        if not self.target_value or self.target_value == 0:
            return 0
        return min(100, (float(self.current_value) / float(self.target_value)) * 100)
    
    @property
    def is_overdue(self):
        """Check if goal period has passed."""
        return timezone.now().date() > self.end_date and not self.is_completed
    
    def update_progress(self):
        """Update current_value based on actual job application data."""
        
        if self.goal_type == 'weekly_applications':
            # Count applications in the goal period
            applications = JobEntry.objects.filter(
                candidate=self.candidate,
                created_at__date__gte=self.start_date,
                created_at__date__lte=self.end_date
            ).count()
            self.current_value = applications
            
        elif self.goal_type == 'response_rate':
            # Calculate response rate in the goal period
            applications = JobEntry.objects.filter(
                candidate=self.candidate,
                created_at__date__gte=self.start_date,
                created_at__date__lte=self.end_date,
                status__in=['applied', 'phone_screen', 'interview', 'offer', 'rejected']
            )
            responded = applications.filter(
                status__in=['phone_screen', 'interview', 'offer', 'rejected']
            )
            
            if applications.count() > 0:
                self.current_value = (responded.count() / applications.count()) * 100
            else:
                self.current_value = 0
                
        elif self.goal_type == 'interviews_per_month':
            # Count interviews in the goal period
            interviews = JobEntry.objects.filter(
                candidate=self.candidate,
                created_at__date__gte=self.start_date,
                created_at__date__lte=self.end_date,
                status__in=['interview', 'offer']
            ).count()
            self.current_value = interviews
        
        # Check if goal is completed
        if self.current_value >= self.target_value and not self.is_completed:
            self.is_completed = True
            self.completion_date = timezone.now()
        
        self.save()
        return self.current_value


class ResumeShare(models.Model):
    """
    UC-052: Resume Sharing for Feedback
    Generate shareable links for resumes with privacy controls
    """
    PRIVACY_CHOICES = [
        ('public', 'Public - Anyone with link can view'),
        ('password', 'Password Protected'),
        ('email_verified', 'Email Verified Only'),
        ('private', 'Private - Owner Only'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    resume_version = models.ForeignKey(
        ResumeVersion,
        on_delete=models.CASCADE,
        related_name='shares'
    )
    
    # Sharing configuration
    share_token = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Unique token for shareable link"
    )
    privacy_level = models.CharField(
        max_length=20,
        choices=PRIVACY_CHOICES,
        default='public'
    )
    password_hash = models.CharField(
        max_length=128,
        blank=True,
        help_text="Hashed password for password-protected shares"
    )
    
    # Access control
    allowed_emails = models.JSONField(
        default=list,
        blank=True,
        help_text="List of email addresses allowed to access (for email_verified mode)"
    )
    allowed_domains = models.JSONField(
        default=list,
        blank=True,
        help_text="List of email domains allowed to access"
    )
    
    # Permissions
    allow_comments = models.BooleanField(
        default=True,
        help_text="Allow reviewers to leave comments"
    )
    allow_download = models.BooleanField(
        default=False,
        help_text="Allow reviewers to download the resume"
    )
    require_reviewer_info = models.BooleanField(
        default=True,
        help_text="Require reviewers to provide name/email before accessing"
    )
    
    # Tracking
    view_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Optional expiration date for the share link"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Deactivate to disable access without deleting"
    )
    
    # Metadata
    share_message = models.TextField(
        blank=True,
        help_text="Optional message to display to reviewers"
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['share_token']),
            models.Index(fields=['resume_version', '-created_at']),
            models.Index(fields=['is_active', 'expires_at']),
        ]
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        if not self.share_token:
            self.share_token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)
    
    def is_expired(self):
        """Check if the share link has expired"""
        if self.expires_at and timezone.now() > self.expires_at:
            return True
        return False
    
    def is_accessible(self):
        """Check if the share link is currently accessible"""
        return self.is_active and not self.is_expired()
    
    def increment_view_count(self):
        """Increment the view count atomically"""
        self.view_count = models.F('view_count') + 1
        self.save(update_fields=['view_count'])
    
    def __str__(self):
        status = "Active" if self.is_accessible() else "Inactive"
        return f"{self.resume_version.version_name} - {status} ({self.privacy_level})"


class ShareAccessLog(models.Model):
    """
    Track who accessed shared resumes and when
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    share = models.ForeignKey(
        ResumeShare,
        on_delete=models.CASCADE,
        related_name='access_logs'
    )
    
    # Reviewer information
    reviewer_name = models.CharField(max_length=200, blank=True)
    reviewer_email = models.EmailField(blank=True)
    reviewer_ip = models.GenericIPAddressField(null=True, blank=True)
    
    # Access details
    accessed_at = models.DateTimeField(auto_now_add=True)
    action = models.CharField(
        max_length=20,
        choices=[
            ('view', 'Viewed'),
            ('download', 'Downloaded'),
            ('comment', 'Commented'),
        ],
        default='view'
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['share', '-accessed_at']),
            models.Index(fields=['reviewer_email', '-accessed_at']),
        ]
        ordering = ['-accessed_at']
    
    def __str__(self):
        return f"{self.reviewer_email or 'Anonymous'} {self.action} - {self.accessed_at}"


class ResumeFeedback(models.Model):
    """
    UC-052: Feedback on shared resumes
    Main feedback record with overall comments and ratings
    """
    FEEDBACK_STATUS = [
        ('pending', 'Pending Review'),
        ('in_review', 'Under Review'),
        ('addressed', 'Addressed'),
        ('resolved', 'Resolved'),
        ('dismissed', 'Dismissed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    share = models.ForeignKey(
        ResumeShare,
        on_delete=models.CASCADE,
        related_name='feedback_items'
    )
    resume_version = models.ForeignKey(
        ResumeVersion,
        on_delete=models.CASCADE,
        related_name='feedback_received'
    )
    
    # Reviewer information
    reviewer_name = models.CharField(max_length=200)
    reviewer_email = models.EmailField()
    reviewer_title = models.CharField(
        max_length=200,
        blank=True,
        help_text="e.g., 'Senior Recruiter at TechCorp'"
    )
    
    # Feedback content
    overall_feedback = models.TextField(
        help_text="General comments about the resume"
    )
    rating = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Optional rating (1-5 stars)"
    )
    
    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=FEEDBACK_STATUS,
        default='pending'
    )
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(
        blank=True,
        help_text="Notes about how feedback was addressed"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Tracking which version incorporated this feedback
    incorporated_in_version = models.ForeignKey(
        ResumeVersion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incorporated_feedback',
        help_text="Version that incorporated this feedback"
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['resume_version', '-created_at']),
            models.Index(fields=['share', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['reviewer_email', '-created_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Feedback from {self.reviewer_name} - {self.status}"
    
    def mark_resolved(self, resolution_notes='', incorporated_version=None):
        """Mark feedback as resolved"""
        self.is_resolved = True
        self.status = 'resolved'
        self.resolved_at = timezone.now()
        self.resolution_notes = resolution_notes
        if incorporated_version:
            self.incorporated_in_version = incorporated_version
        self.save()


class FeedbackComment(models.Model):
    """
    UC-052: Detailed comments on specific sections/lines of resume
    Thread-based commenting system
    """
    COMMENT_TYPE = [
        ('general', 'General Comment'),
        ('suggestion', 'Suggestion'),
        ('question', 'Question'),
        ('praise', 'Praise'),
        ('concern', 'Concern'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    feedback = models.ForeignKey(
        ResumeFeedback,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    
    # Comment thread support
    parent_comment = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies'
    )
    
    # Commenter info (can be owner replying or reviewer)
    commenter_name = models.CharField(max_length=200)
    commenter_email = models.EmailField()
    is_owner = models.BooleanField(
        default=False,
        help_text="True if comment is from resume owner (response)"
    )
    
    # Comment content
    comment_type = models.CharField(
        max_length=20,
        choices=COMMENT_TYPE,
        default='general'
    )
    comment_text = models.TextField()
    
    # Location in resume (optional, for inline comments)
    section = models.CharField(
        max_length=100,
        blank=True,
        help_text="Resume section this comment refers to (e.g., 'experience', 'skills')"
    )
    section_index = models.IntegerField(
        null=True,
        blank=True,
        help_text="Index of item within section (for specific bullet points)"
    )
    highlighted_text = models.TextField(
        blank=True,
        help_text="Specific text this comment refers to"
    )
    
    # Status
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Helpful votes (optional feature)
    helpful_count = models.PositiveIntegerField(default=0)
    
    class Meta:
        indexes = [
            models.Index(fields=['feedback', '-created_at']),
            models.Index(fields=['parent_comment', '-created_at']),
            models.Index(fields=['section', 'section_index']),
        ]
        ordering = ['created_at']
    
    def __str__(self):
        comment_preview = self.comment_text[:50]
        return f"{self.commenter_name}: {comment_preview}..."
    
    def mark_resolved(self):
        """Mark comment as resolved"""
        self.is_resolved = True
        self.resolved_at = timezone.now()
        self.save()
    
    def get_thread_depth(self):
        """Calculate depth of comment in thread"""
        depth = 0
        current = self
        while current.parent_comment:
            depth += 1
            current = current.parent_comment
        return depth


class FeedbackNotification(models.Model):
    """
    UC-052: Notifications for feedback activity
    Notify users about new feedback, comments, and resolutions
    """
    NOTIFICATION_TYPE = [
        ('new_feedback', 'New Feedback Received'),
        ('new_comment', 'New Comment on Your Resume'),
        ('feedback_reply', 'Reply to Your Feedback'),
        ('feedback_resolved', 'Feedback Marked as Resolved'),
        ('share_accessed', 'Resume Share Accessed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='feedback_notifications'
    )
    
    # Notification details
    notification_type = models.CharField(
        max_length=30,
        choices=NOTIFICATION_TYPE
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    
    # Related objects
    feedback = models.ForeignKey(
        ResumeFeedback,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    comment = models.ForeignKey(
        FeedbackComment,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    share = models.ForeignKey(
        ResumeShare,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    
    # Status
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Action link
    action_url = models.CharField(
        max_length=500,
        blank=True,
        help_text="URL to view the feedback/comment"
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'is_read', '-created_at']),
        ]
        ordering = ['-created_at']
    
    def mark_read(self):
        """Mark notification as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save()
    
    def __str__(self):
        return f"{self.notification_type} for {self.user.username} - {'Read' if self.is_read else 'Unread'}"


# ======================
# Networking Event Management Models (UC-088)
# ======================


class NetworkingEvent(models.Model):
    """UC-088: Networking events and opportunities tracking"""
    EVENT_TYPES = [
        ('conference', 'Conference'),
        ('meetup', 'Meetup'),
        ('workshop', 'Workshop'),
        ('webinar', 'Webinar'),
        ('career_fair', 'Career Fair'),
        ('networking_mixer', 'Networking Mixer'),
        ('panel', 'Panel Discussion'),
        ('virtual', 'Virtual Event'),
        ('other', 'Other'),
    ]
    
    ATTENDANCE_STATUS = [
        ('planned', 'Planning to Attend'),
        ('registered', 'Registered'),
        ('attended', 'Attended'),
        ('missed', 'Missed'),
        ('cancelled', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name='networking_events')
    
    # Event Details
    name = models.CharField(max_length=250)
    event_type = models.CharField(max_length=60, choices=EVENT_TYPES, default='other')
    description = models.TextField(blank=True)
    location = models.CharField(max_length=250, blank=True, help_text="Physical location or 'Virtual'")
    is_virtual = models.BooleanField(default=False)
    virtual_link = models.URLField(blank=True, help_text="Zoom, Teams, or other virtual event link")
    
    # Dates and Time
    event_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)
    registration_deadline = models.DateTimeField(null=True, blank=True)
    
    # Organization
    organizer = models.CharField(max_length=200, blank=True)
    industry = models.CharField(max_length=120, blank=True)
    event_url = models.URLField(blank=True, help_text="Event page or registration link")
    
    # Attendance Tracking
    attendance_status = models.CharField(max_length=30, choices=ATTENDANCE_STATUS, default='planned')
    registration_fee = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # Preparation and Notes
    pre_event_notes = models.TextField(blank=True, help_text="Research, people to meet, companies attending")
    post_event_notes = models.TextField(blank=True, help_text="Key takeaways, impressions")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['owner', '-event_date']),
            models.Index(fields=['owner', 'attendance_status']),
            models.Index(fields=['industry']),
            models.Index(fields=['is_virtual']),
        ]
        ordering = ['-event_date']
    
    def __str__(self):
        return f"{self.name} ({self.event_date.date()})"


class EventGoal(models.Model):
    """Networking goals for each event (UC-088)"""
    GOAL_TYPES = [
        ('connections', 'Make New Connections'),
        ('leads', 'Generate Job Leads'),
        ('learning', 'Learn About Industry/Company'),
        ('visibility', 'Increase Professional Visibility'),
        ('skills', 'Develop Skills'),
        ('other', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(NetworkingEvent, on_delete=models.CASCADE, related_name='goals')
    goal_type = models.CharField(max_length=60, choices=GOAL_TYPES)
    description = models.CharField(max_length=300)
    target_value = models.IntegerField(null=True, blank=True, help_text="e.g., number of connections to make")
    achieved = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['event', 'achieved']),
        ]
    
    def __str__(self):
        return f"{self.get_goal_type_display()} - {self.event.name}"


class EventConnection(models.Model):
    """People met at networking events (UC-088)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(NetworkingEvent, on_delete=models.CASCADE, related_name='connections')
    contact = models.ForeignKey('Contact', on_delete=models.SET_NULL, null=True, blank=True, 
                                related_name='event_connections',
                                help_text="Link to existing contact if available")
    
    # Connection details (if not linked to Contact)
    name = models.CharField(max_length=200)
    title = models.CharField(max_length=200, blank=True)
    company = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    linkedin_url = models.URLField(blank=True)
    
    # Context
    conversation_notes = models.TextField(blank=True, help_text="What you discussed")
    potential_value = models.CharField(max_length=30, choices=[
        ('high', 'High - Strong Lead/Connection'),
        ('medium', 'Medium - Worth Following Up'),
        ('low', 'Low - Casual Connection'),
    ], default='medium')
    
    # Follow-up
    follow_up_completed = models.BooleanField(default=False)
    follow_up_date = models.DateField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['event', 'potential_value']),
            models.Index(fields=['event', 'follow_up_completed']),
        ]
        ordering = ['-potential_value', '-created_at']
    
    def __str__(self):
        return f"{self.name} at {self.event.name}"


class EventFollowUp(models.Model):
    """Post-event follow-up actions (UC-088)"""
    ACTION_TYPES = [
        ('email', 'Send Email'),
        ('linkedin', 'LinkedIn Connection Request'),
        ('phone', 'Phone Call'),
        ('meeting', 'Schedule Meeting'),
        ('application', 'Submit Job Application'),
        ('thank_you', 'Send Thank You Note'),
        ('other', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(NetworkingEvent, on_delete=models.CASCADE, related_name='follow_ups')
    connection = models.ForeignKey(EventConnection, on_delete=models.CASCADE, null=True, blank=True,
                                   related_name='follow_ups')
    
    action_type = models.CharField(max_length=60, choices=ACTION_TYPES)
    description = models.TextField()
    due_date = models.DateField()
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['event', 'completed', 'due_date']),
            models.Index(fields=['connection', 'completed']),
        ]
        ordering = ['due_date', '-created_at']
    
    def mark_completed(self):
        self.completed = True
        self.completed_at = timezone.now()
        self.save()
    
    def __str__(self):
        return f"{self.get_action_type_display()} - {self.event.name}"
