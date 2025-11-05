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
    version = models.PositiveIntegerField(default=1)
    storage_url = models.URLField()
    file_hash = models.CharField(max_length=128, blank=True)
    generated_by_ai = models.BooleanField(default=False)
    source_job = models.ForeignKey(JobOpportunity, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("candidate", "doc_type", "version")]
        indexes = [models.Index(fields=["candidate", "doc_type", "-created_at"])]

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
    degree_type = models.CharField(max_length=10, choices=DEGREE_CHOICES)
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
    """Automated company research and intelligence"""
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

    Acceptance fields:
    - title (required)
    - company_name (required)
    - location
    - salary range (min/max, currency)
    - posting_url
    - application_deadline
    - description (2000 char limit)
    - industry
    - job_type (dropdown)
    """
    JOB_TYPES = [
        ("ft", "Full-time"),
        ("pt", "Part-time"),
        ("contract", "Contract"),
        ("intern", "Internship"),
        ("temp", "Temporary"),
    ]

    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="job_entries")
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=["candidate", "-updated_at"]),
            models.Index(fields=["job_type"]),
            models.Index(fields=["industry"]),
        ]

    def __str__(self):
        return f"{self.title} @ {self.company_name}"