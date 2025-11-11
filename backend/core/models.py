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

    class Meta:
        indexes = [models.Index(name="idx_company_domain_lower", fields=["domain"])]

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
    mission_statement = models.TextField(blank=True)
    culture_keywords = models.JSONField(default=list, blank=True)
    recent_news = models.JSONField(default=list, blank=True)  # List of {title, url, date, summary}
    funding_info = models.JSONField(default=dict, blank=True)  # Stage, amount, investors
    tech_stack = models.JSONField(default=list, blank=True)
    employee_count = models.IntegerField(null=True, blank=True)
    growth_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    glassdoor_rating = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    
    # UC-063: Additional automated research fields
    executives = models.JSONField(default=list, blank=True)  # List of {name, title, linkedin_url}
    products = models.JSONField(default=list, blank=True)  # List of {name, description}
    competitors = models.JSONField(default=dict, blank=True)  # {industry, companies: [...], market_position}
    social_media = models.JSONField(default=dict, blank=True)  # {linkedin, twitter, facebook, etc.}
    company_values = models.JSONField(default=list, blank=True)  # List of company values
    
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [models.Index(fields=["company"])]


# ======================
# NETWORK & COLLABORATION MODELS
# ======================

class Contact(models.Model):
    """Professional contacts and connections"""
    RELATIONSHIP_TYPES = [
        ('colleague', 'Colleague'),
        ('manager', 'Manager'),
        ('mentor', 'Mentor'),
        ('recruiter', 'Recruiter'),
        ('employee', 'Employee at Target Company'),
        ('other', 'Other'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="contacts")
    name = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    linkedin_url = models.URLField(blank=True)
    company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True, related_name="contacts")
    job_title = models.CharField(max_length=200, blank=True)
    relationship_type = models.CharField(max_length=20, choices=RELATIONSHIP_TYPES)
    notes = models.TextField(blank=True)
    last_contacted = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-last_contacted', '-created_at']
        indexes = [
            models.Index(fields=["candidate", "-last_contacted"]),
            models.Index(fields=["company"]),
        ]

    def __str__(self):
        return f"{self.name} - {self.get_relationship_type_display()}"


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


# ======================
# REMINDERS & NOTIFICATIONS
# ======================

class Reminder(models.Model):
    """Reminders and follow-up tasks"""
    REMINDER_TYPES = [
        ('follow_up', 'Follow Up'),
        ('interview_prep', 'Interview Preparation'),
        ('deadline', 'Application Deadline'),
        ('networking', 'Network Contact'),
        ('document_update', 'Update Document'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="reminders")
    application = models.ForeignKey(Application, on_delete=models.CASCADE, null=True, blank=True, related_name="reminders")
    reminder_type = models.CharField(max_length=30, choices=REMINDER_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_date = models.DateTimeField()
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    priority = models.IntegerField(default=2)  # 1=high, 2=medium, 3=low
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['is_completed', 'due_date']
        indexes = [
            models.Index(fields=["candidate", "is_completed", "due_date"]),
            models.Index(fields=["application"]),
        ]


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


# ======================
# UC-069: APPLICATION WORKFLOW AUTOMATION MODELS
# ======================

class ApplicationAutomationRule(models.Model):
    """
    UC-069: User-defined automation rules for application workflows
    
    Examples:
    - Auto-generate resume for jobs with match score > 80%
    - Schedule applications for Tuesdays at 9 AM
    - Send follow-up after 1 week if no response
    """
    TRIGGER_TYPES = [
        ('new_job', 'New Job Added'),
        ('job_match_found', 'High Match Job Found'),
        ('application_deadline', 'Application Deadline Approaching'),
        ('match_score', 'Match Score Threshold'),
        ('deadline_approaching', 'Deadline Approaching'),
        ('status_change', 'Application Status Change'),
        ('time_based', 'Time-Based Schedule'),
    ]
    
    ACTION_TYPES = [
        ('generate_package', 'Generate Application Package'),
        ('generate_application_package', 'Generate Resume & Cover Letter'),
        ('create_deadline_reminder', 'Create Deadline Reminder'),
        ('schedule_application', 'Schedule Application Submission'),
        ('send_followup', 'Send Follow-up Reminder'),
        ('update_status', 'Update Application Status'),
        ('create_reminder', 'Create Reminder'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="automation_rules")
    name = models.CharField(max_length=200, help_text="User-friendly rule name")
    description = models.TextField(blank=True, help_text="Description of what this rule does")
    
    # Trigger configuration
    trigger_type = models.CharField(max_length=30, choices=TRIGGER_TYPES)
    trigger_conditions = models.JSONField(default=dict, help_text="Conditions that activate this rule")
    
    # Action configuration
    action_type = models.CharField(max_length=30, choices=ACTION_TYPES)
    action_parameters = models.JSONField(default=dict, help_text="Parameters for the action to take")
    
    # Rule settings
    is_active = models.BooleanField(default=True)
    priority = models.PositiveSmallIntegerField(default=5, help_text="Execution priority (1=highest, 10=lowest)")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_executed = models.DateTimeField(null=True, blank=True)
    execution_count = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['priority', 'created_at']
        indexes = [
            models.Index(fields=['candidate', 'is_active']),
            models.Index(fields=['trigger_type', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.candidate.get_full_name()} - {self.name}"


class ApplicationPackage(models.Model):
    """
    UC-069: Auto-generated application packages (resume + cover letter + portfolio)
    
    Packages are generated automatically based on job requirements and user preferences.
    Links to existing documents or creates new ones.
    """
    PACKAGE_STATUS = [
        ('generating', 'Generating'),
        ('ready', 'Ready'),
        ('submitted', 'Submitted'),
        ('failed', 'Generation Failed'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="application_packages")
    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, related_name="application_packages")
    
    # Package components
    resume_document = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True, related_name="resume_packages")
    cover_letter_document = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True, related_name="cover_letter_packages")
    portfolio_url = models.URLField(blank=True, help_text="Link to portfolio or additional materials")
    
    # Generation metadata
    status = models.CharField(max_length=20, choices=PACKAGE_STATUS, default='generating')
    generation_parameters = models.JSONField(default=dict, help_text="Parameters used for generation")
    match_score = models.FloatField(null=True, blank=True, help_text="Job match score at time of generation")
    
    # Template references
    resume_template = models.CharField(max_length=100, blank=True, help_text="Resume template used")
    cover_letter_template = models.ForeignKey(CoverLetterTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['candidate', 'status']),
            models.Index(fields=['job', 'created_at']),
        ]
    
    def __str__(self):
        return f"Package for {self.job.title} at {self.job.company_name}"


class ScheduledSubmission(models.Model):
    """
    UC-069: Scheduled application submissions with queue management
    
    Handles automatic submission of applications at optimal times,
    respecting business hours, time zones, and user preferences.
    """
    SUBMISSION_STATUS = [
        ('pending', 'Pending'),
        ('scheduled', 'Scheduled'),
        ('submitted', 'Submitted'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="scheduled_submissions")
    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, related_name="scheduled_submissions")
    application_package = models.ForeignKey(ApplicationPackage, on_delete=models.CASCADE, related_name="scheduled_submissions")
    
    # Scheduling details
    scheduled_datetime = models.DateTimeField(help_text="When to submit the application")
    timezone = models.CharField(max_length=50, default='UTC', help_text="User's timezone for scheduling")
    submission_method = models.CharField(max_length=50, default='email', help_text="How to submit (email, portal, etc.)")
    
    # Queue management
    status = models.CharField(max_length=20, choices=SUBMISSION_STATUS, default='pending')
    priority = models.PositiveSmallIntegerField(default=5, help_text="Submission priority (1=highest)")
    retry_count = models.PositiveSmallIntegerField(default=0)
    max_retries = models.PositiveSmallIntegerField(default=3)
    
    # Submission details
    submission_parameters = models.JSONField(default=dict, help_text="Parameters for submission")
    submission_result = models.JSONField(default=dict, help_text="Result of submission attempt")
    submitted_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['scheduled_datetime', 'priority']
        indexes = [
            models.Index(fields=['candidate', 'status']),
            models.Index(fields=['scheduled_datetime', 'status']),
        ]
    
    def __str__(self):
        return f"Scheduled: {self.job.title} at {self.scheduled_datetime}"


class FollowUpReminder(models.Model):
    """
    UC-069: Automated follow-up reminders with customizable intervals
    
    Tracks and manages follow-up communications for job applications.
    """
    REMINDER_TYPES = [
        ('application_followup', 'Application Follow-up'),
        ('interview_followup', 'Interview Follow-up'),
        ('offer_response', 'Offer Response'),
        ('thank_you', 'Thank You Note'),
        ('status_inquiry', 'Status Inquiry'),
    ]
    
    REMINDER_STATUS = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('dismissed', 'Dismissed'),
        ('failed', 'Failed'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="followup_reminders")
    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, related_name="followup_reminders")
    
    # Reminder configuration
    reminder_type = models.CharField(max_length=30, choices=REMINDER_TYPES)
    subject = models.CharField(max_length=200, help_text="Email subject or reminder title")
    message_template = models.TextField(help_text="Template message with placeholders")
    
    # Scheduling
    scheduled_datetime = models.DateTimeField(help_text="When to send the reminder")
    interval_days = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Days between reminders for recurring")
    is_recurring = models.BooleanField(default=False)
    max_occurrences = models.PositiveSmallIntegerField(default=1, help_text="Maximum times to send")
    occurrence_count = models.PositiveSmallIntegerField(default=0)
    
    # Status and tracking
    status = models.CharField(max_length=20, choices=REMINDER_STATUS, default='pending')
    sent_at = models.DateTimeField(null=True, blank=True)
    response_received = models.BooleanField(default=False)
    response_date = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['scheduled_datetime']
        indexes = [
            models.Index(fields=['candidate', 'status']),
            models.Index(fields=['scheduled_datetime', 'status']),
        ]
    
    def __str__(self):
        return f"{self.reminder_type} for {self.job.title} on {self.scheduled_datetime.date()}"


class ApplicationChecklist(models.Model):
    """
    UC-069: Dynamic application checklists that auto-update based on progress
    
    Manages task lists for job applications that adapt to company requirements
    and user-defined criteria.
    """
    CHECKLIST_STATUS = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('paused', 'Paused'),
        ('archived', 'Archived'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="application_checklists")
    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, related_name="application_checklists")
    
    # Checklist metadata
    name = models.CharField(max_length=200, help_text="Checklist name")
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=CHECKLIST_STATUS, default='active')
    
    # Progress tracking
    total_tasks = models.PositiveIntegerField(default=0)
    completed_tasks = models.PositiveIntegerField(default=0)
    completion_percentage = models.FloatField(default=0.0)
    
    # Automation settings
    auto_update_enabled = models.BooleanField(default=True, help_text="Whether to auto-update based on application progress")
    template_used = models.CharField(max_length=100, blank=True, help_text="Template this checklist was based on")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['candidate', 'status']),
            models.Index(fields=['job', 'status']),
        ]
    
    def update_progress(self):
        """Update completion percentage based on completed tasks"""
        if self.total_tasks > 0:
            self.completion_percentage = (self.completed_tasks / self.total_tasks) * 100
        else:
            self.completion_percentage = 0.0
        
        if self.completion_percentage >= 100 and self.status == 'active':
            self.status = 'completed'
            self.completed_at = timezone.now()
    
    def __str__(self):
        return f"Checklist for {self.job.title} - {self.completion_percentage:.0f}% complete"


class ChecklistTask(models.Model):
    """
    UC-069: Individual tasks within an application checklist
    """
    TASK_PRIORITIES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]
    
    TASK_STATUS = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('skipped', 'Skipped'),
        ('blocked', 'Blocked'),
    ]
    
    checklist = models.ForeignKey(ApplicationChecklist, on_delete=models.CASCADE, related_name="tasks")
    
    # Task details
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=20, choices=TASK_PRIORITIES, default='medium')
    status = models.CharField(max_length=20, choices=TASK_STATUS, default='pending')
    
    # Ordering and dependencies
    order_index = models.PositiveIntegerField(default=0)
    depends_on = models.ManyToManyField('self', blank=True, symmetrical=False, related_name='dependents')
    
    # Due dates and automation
    due_date = models.DateTimeField(null=True, blank=True)
    auto_complete_trigger = models.CharField(max_length=100, blank=True, help_text="Event that auto-completes this task")
    
    # Completion tracking
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by_automation = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['order_index', 'created_at']
        indexes = [
            models.Index(fields=['checklist', 'status']),
            models.Index(fields=['due_date', 'status']),
        ]
    
    def mark_completed(self, automated=False, notes=""):
        """Mark task as completed and update checklist progress"""
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.completed_by_automation = automated
        if notes:
            self.notes = notes
        self.save()
        
        # Update checklist progress
        self.checklist.completed_tasks = self.checklist.tasks.filter(status='completed').count()
        self.checklist.update_progress()
        self.checklist.save()
    
    def __str__(self):
        return f"{self.checklist.job.title} - {self.title}"


class BulkOperation(models.Model):
    """
    UC-069: Bulk operations for mass application management
    
    Tracks bulk operations like mass apply, status updates, and batch processing.
    """
    OPERATION_TYPES = [
        ('bulk_apply', 'Bulk Apply'),
        ('status_update', 'Status Update'),
        ('package_generation', 'Package Generation'),
        ('reminder_creation', 'Reminder Creation'),
        ('export', 'Data Export'),
        ('archive', 'Archive Jobs'),
    ]
    
    OPERATION_STATUS = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="bulk_operations")
    
    # Operation details
    operation_type = models.CharField(max_length=30, choices=OPERATION_TYPES)
    description = models.CharField(max_length=200)
    parameters = models.JSONField(default=dict, help_text="Operation parameters and settings")
    
    # Target jobs
    target_jobs = models.ManyToManyField(JobEntry, related_name="bulk_operations")
    
    # Progress tracking
    status = models.CharField(max_length=20, choices=OPERATION_STATUS, default='pending')
    total_items = models.PositiveIntegerField(default=0)
    processed_items = models.PositiveIntegerField(default=0)
    successful_items = models.PositiveIntegerField(default=0)
    failed_items = models.PositiveIntegerField(default=0)
    
    # Results and errors
    results = models.JSONField(default=dict, help_text="Operation results and summary")
    error_log = models.JSONField(default=list, help_text="List of errors encountered")
    
    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['candidate', 'status']),
            models.Index(fields=['operation_type', 'status']),
        ]
    
    @property
    def progress_percentage(self):
        """Calculate completion percentage"""
        if self.total_items > 0:
            return (self.processed_items / self.total_items) * 100
        return 0.0
    
    def __str__(self):
        return f"{self.operation_type} - {self.progress_percentage:.0f}% complete"


class WorkflowAutomationLog(models.Model):
    """
    UC-069: Log of automation executions for debugging and analytics
    """
    LOG_LEVELS = [
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error'),
        ('debug', 'Debug'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="automation_logs")
    automation_rule = models.ForeignKey(ApplicationAutomationRule, on_delete=models.SET_NULL, null=True, blank=True, related_name="execution_logs")
    
    # Log details
    level = models.CharField(max_length=20, choices=LOG_LEVELS, default='info')
    message = models.TextField()
    context = models.JSONField(default=dict, help_text="Additional context data")
    
    # Related objects (optional)
    job = models.ForeignKey(JobEntry, on_delete=models.SET_NULL, null=True, blank=True)
    bulk_operation = models.ForeignKey(BulkOperation, on_delete=models.SET_NULL, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['candidate', 'level']),
            models.Index(fields=['automation_rule', 'created_at']),
        ]
    
    def __str__(self):
        return f"[{self.level.upper()}] {self.message[:100]}..."


# ======================
# INTERVIEW SCHEDULING MODELS (from main branch)
# ======================

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