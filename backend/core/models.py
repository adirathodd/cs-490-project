# backend/core/models.py
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.contrib.auth import get_user_model
from datetime import timedelta
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
    weekly_application_target = models.PositiveSmallIntegerField(
        default=5,
        help_text='User-defined goal for applications per week',
    )
    monthly_application_target = models.PositiveSmallIntegerField(
        default=20,
        help_text='User-defined goal for applications per month',
    )
    supporter_mood_score = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Optional 1-10 score for supporter visibility")
    supporter_mood_note = models.TextField(blank=True, help_text="Optional note on how the candidate is feeling for supporters")
    
    # UC-089: LinkedIn integration fields
    linkedin_url = models.URLField(blank=True, help_text='LinkedIn profile URL')
    linkedin_imported = models.BooleanField(default=False)
    linkedin_import_date = models.DateTimeField(blank=True, null=True)

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

class JobOfficeLocation(models.Model):
    """Office location linked to a job with optional stored commute metrics."""
    job = models.ForeignKey('JobEntry', on_delete=models.CASCADE, related_name='office_locations')
    label = models.CharField(max_length=120, blank=True)
    address = models.CharField(max_length=240, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)
    # Commute cache
    last_commute_eta_min = models.FloatField(null=True, blank=True)
    last_commute_distance_km = models.FloatField(null=True, blank=True)
    last_commute_calculated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['job']),
            models.Index(fields=['job', 'created_at']),
        ]

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
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

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


class LinkedInIntegration(models.Model):
    """UC-089: LinkedIn OAuth integration and profile import tracking"""
    
    STATUS_CHOICES = [
        ('not_connected', 'Not Connected'),
        ('connected', 'Connected'),
        ('synced', 'Synced'),
        ('error', 'Error'),
    ]
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='linkedin_integration'
    )
    
    # OAuth tokens
    access_token = models.TextField(blank=True)
    refresh_token = models.TextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    
    # Imported profile data
    linkedin_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    linkedin_profile_url = models.URLField(blank=True)
    
    # Import metadata
    last_sync_date = models.DateTimeField(null=True, blank=True)
    import_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='not_connected')
    last_error = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['linkedin_id']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - LinkedIn ({self.import_status})"
    
    def mark_connected(self, access_token, refresh_token='', expires_at=None, linkedin_id='', profile_url=''):
        """Mark the integration as connected with OAuth data"""
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.token_expires_at = expires_at
        self.linkedin_id = linkedin_id
        self.linkedin_profile_url = profile_url
        self.import_status = 'connected'
        self.last_error = ''
        self.save()
    
    def mark_synced(self):
        """Mark profile data as synced"""
        self.last_sync_date = timezone.now()
        self.import_status = 'synced'
        self.save(update_fields=['last_sync_date', 'import_status', 'updated_at'])
    
    def mark_error(self, error_message):
        """Mark integration as having an error"""
        self.import_status = 'error'
        self.last_error = error_message
        self.save(update_fields=['import_status', 'last_error', 'updated_at'])
    
    def disconnect(self):
        """Disconnect and clear OAuth data"""
        self.access_token = ''
        self.refresh_token = ''
        self.token_expires_at = None
        self.import_status = 'not_connected'
        self.last_error = ''
        self.save()

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
    EMPLOY_TYPES = [
        ("ft", "Full-time"),
        ("pt", "Part-time"),
        ("contract", "Contract"),
        ("intern", "Internship"),
    ]

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="jobs")
    company_name = models.CharField(max_length=180, blank=True)
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

    def save(self, *args, **kwargs):
        # If a company_name is provided but no company FK, try to resolve or create a Company
        try:
            if not getattr(self, 'company', None) and self.company_name:
                company_obj = Company.objects.filter(name__iexact=self.company_name).first()
                if not company_obj:
                    # create a minimal Company record; domain will be a slug of the name
                    domain = (self.company_name or '').lower().replace(' ', '-')
                    company_obj = Company.objects.create(name=self.company_name, domain=domain)
                self.company = company_obj
        except Exception:
            # If Company model isn't available or creation fails, proceed and allow DB to raise
            pass
        return super().save(*args, **kwargs)

    class Meta:
        indexes = [
            models.Index(fields=["company", "-posted_at"]),
            models.Index(fields=["active"]),
        ]


# 
# 
# =
# Contacts / Network Models (UC-086)
# 
# 
# =


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


class DiscoverySearch(models.Model):
    """UC-092: Discovery search parameters for contact suggestions."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='discovery_searches'
    )
    target_companies = models.JSONField(default=list, blank=True)
    target_roles = models.JSONField(default=list, blank=True)
    target_industries = models.JSONField(default=list, blank=True)
    target_locations = models.JSONField(default=list, blank=True)
    include_alumni = models.BooleanField(default=True)
    include_mutual_connections = models.BooleanField(default=True)
    include_industry_leaders = models.BooleanField(default=True)
    results_count = models.IntegerField(default=0)
    contacted_count = models.IntegerField(default=0)
    connected_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    last_refreshed = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Discovery searches'
        ordering = ['-created_at']


class ContactSuggestion(models.Model):
    SUGGESTION_TYPES = [
        ('target_company', 'Target Company Employee'),
        ('alumni', 'Alumni Connection'),
        ('industry_leader', 'Industry Leader/Influencer'),
        ('mutual_connection', 'Mutual Connection'),
        ('conference_speaker', 'Conference Speaker/Event Participant'),
        ('similar_role', 'Similar Role Professional'),
    ]
    STATUS_CHOICES = [
        ('suggested', 'Suggested'),
        ('contacted', 'Contacted'),
        ('connected', 'Connected'),
        ('dismissed', 'Dismissed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='contact_suggestions'
    )
    suggested_name = models.CharField(max_length=255)
    suggested_title = models.CharField(max_length=220, blank=True)
    suggested_company = models.CharField(max_length=180, blank=True)
    suggested_linkedin_url = models.URLField(blank=True)
    suggested_location = models.CharField(max_length=160, blank=True)
    suggested_industry = models.CharField(max_length=120, blank=True)
    suggestion_type = models.CharField(max_length=30, choices=SUGGESTION_TYPES)
    relevance_score = models.FloatField(default=0.0, help_text='0.0-1.0 relevance score')
    reason = models.TextField(help_text='Why this contact is suggested')
    connection_path = models.JSONField(blank=True, default=list, help_text='Intermediate contacts')
    mutual_connections = models.JSONField(blank=True, default=list)
    shared_institution = models.CharField(max_length=200, blank=True)
    shared_degree = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='suggested')
    contacted_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(blank=True, default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    related_company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    related_job = models.ForeignKey(
        'JobOpportunity',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='contact_suggestions'
    )
    connected_contact = models.ForeignKey(
        'Contact',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='originated_from_suggestion'
    )

    class Meta:
        ordering = ['-relevance_score', '-created_at']
        indexes = [
            models.Index(fields=['user', 'status', '-relevance_score'], name='core_contac_user_id_035ce8_idx'),
            models.Index(fields=['user', 'suggestion_type', '-created_at'], name='core_contac_user_id_2c8626_idx'),
            models.Index(fields=['-relevance_score'], name='core_contac_relevan_d9bd1d_idx'),
        ]

    def __str__(self):
        return f"{self.suggested_name} ({self.suggestion_type})"


class InformationalInterview(models.Model):
    """UC-090: Informational Interview Management - Track and manage informational interviews."""
    
    STATUS_CHOICES = [
        ('identified', 'Candidate Identified'),
        ('outreach_sent', 'Outreach Sent'),
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('declined', 'Declined'),
        ('no_response', 'No Response'),
    ]
    
    OUTCOME_CHOICES = [
        ('', 'Not Yet Recorded'),
        ('excellent', 'Excellent'),
        ('good', 'Good'),
        ('average', 'Average'),
        ('poor', 'Poor'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='informational_interviews'
    )
    contact = models.ForeignKey(
        Contact,
        on_delete=models.CASCADE,
        related_name='informational_interviews',
        help_text='The contact being interviewed'
    )
    
    # Request details
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='identified')
    outreach_template_used = models.CharField(max_length=50, blank=True, help_text='Template type used for outreach')
    outreach_sent_at = models.DateTimeField(null=True, blank=True)
    outreach_message = models.TextField(blank=True, help_text='Actual outreach message sent')
    
    # Scheduling
    scheduled_at = models.DateTimeField(null=True, blank=True, help_text='Interview date and time')
    meeting_location = models.CharField(max_length=500, blank=True, help_text='Physical location or video link')
    duration_minutes = models.PositiveIntegerField(default=30, help_text='Expected duration')
    
    # Preparation
    preparation_notes = models.TextField(blank=True, help_text='User preparation notes')
    questions_to_ask = models.JSONField(default=list, blank=True, help_text='List of prepared questions')
    research_notes = models.TextField(blank=True, help_text='Research about the contact/company')
    goals = models.JSONField(default=list, blank=True, help_text='What user wants to learn/achieve')
    
    # Completion and outcomes
    completed_at = models.DateTimeField(null=True, blank=True)
    outcome = models.CharField(max_length=20, choices=OUTCOME_CHOICES, blank=True, default='')
    interview_notes = models.TextField(blank=True, help_text='Notes taken during/after interview')
    key_insights = models.JSONField(default=list, blank=True, help_text='Key takeaways and insights')
    industry_intelligence = models.TextField(blank=True, help_text='Industry trends and intelligence gathered')
    
    # Follow-up and relationship
    follow_up_sent_at = models.DateTimeField(null=True, blank=True)
    follow_up_message = models.TextField(blank=True)
    relationship_strength_change = models.IntegerField(default=0, help_text='Change in relationship strength (-5 to +5)')
    future_opportunities = models.JSONField(default=list, blank=True, help_text='Potential opportunities identified')
    
    # Impact tracking
    led_to_job_application = models.BooleanField(default=False)
    led_to_referral = models.BooleanField(default=False)
    led_to_introduction = models.BooleanField(default=False)
    connected_jobs = models.ManyToManyField('JobEntry', blank=True, related_name='from_informational_interviews')
    
    # Metadata
    tags = models.ManyToManyField(Tag, blank=True, related_name='informational_interviews')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-scheduled_at', '-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', '-scheduled_at']),
            models.Index(fields=['contact', 'status']),
        ]
    
    def __str__(self):
        return f"Informational Interview with {self.contact.display_name} - {self.status}"
    
    def mark_outreach_sent(self):
        """Mark outreach as sent and update status."""
        self.status = 'outreach_sent'
        self.outreach_sent_at = timezone.now()
        self.save(update_fields=['status', 'outreach_sent_at', 'updated_at'])
    
    def mark_scheduled(self, scheduled_time):
        """Mark interview as scheduled."""
        self.status = 'scheduled'
        self.scheduled_at = scheduled_time
        self.save(update_fields=['status', 'scheduled_at', 'updated_at'])
    
    def mark_completed(self, outcome='good'):
        """Mark interview as completed."""
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.outcome = outcome
        self.save(update_fields=['status', 'completed_at', 'outcome', 'updated_at'])


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


# 
# 
# =
# EXTENDED PROFILE MODELS

# UC-114: GitHub Repository Showcase Integration
class GitHubAccount(models.Model):
    candidate = models.OneToOneField(CandidateProfile, on_delete=models.CASCADE, related_name='github_account')
    github_user_id = models.BigIntegerField(unique=True)
    login = models.CharField(max_length=255)
    avatar_url = models.URLField(blank=True, default='')
    access_token = models.CharField(max_length=255)
    token_type = models.CharField(max_length=64, blank=True, default='')
    scopes = models.CharField(max_length=512, blank=True, default='')
    include_private = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.login} ({self.github_user_id})"


class Repository(models.Model):
    account = models.ForeignKey(GitHubAccount, on_delete=models.CASCADE, related_name='repositories')
    repo_id = models.BigIntegerField()
    name = models.CharField(max_length=255)
    full_name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    html_url = models.URLField()
    private = models.BooleanField(default=False)
    primary_language = models.CharField(max_length=128, blank=True, default='')
    languages = models.JSONField(default=dict, blank=True)
    stars = models.PositiveIntegerField(default=0)
    forks = models.PositiveIntegerField(default=0)
    pushed_at = models.DateTimeField(null=True, blank=True)
    last_synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("account", "repo_id")]
        indexes = [
            models.Index(fields=["account", "-stars"]),
            models.Index(fields=["account", "-pushed_at"]),
        ]

    def __str__(self):
        return self.full_name


class FeaturedRepository(models.Model):
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name='featured_repositories')
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='featured_for')
    position = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("candidate", "repository")]
        indexes = [models.Index(fields=["candidate", "position"])]

# 
# 
# =

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
    badge_image = models.ImageField(upload_to='certifications/badges/%Y/%m/', null=True, blank=True)
    description = models.TextField(blank=True)
    achievement_highlights = models.TextField(blank=True)
    assessment_score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    assessment_max_score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    assessment_units = models.CharField(
        max_length=40,
        blank=True,
        help_text="Units for the assessment score (points, percentile, rank, etc.)"
    )
    
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


# 
# 
# =
# EXTENDED JOB & COMPANY MODELS
# 
# 
# =

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
    def save(self, *args, **kwargs):
        # If contact is None (tests sometimes create referrals without a contact),
        # try to create/assign a minimal Contact to satisfy DB NOT NULL constraint.
        try:
            if not getattr(self, 'contact', None) and getattr(self, 'application', None):
                owner = getattr(self.application, 'candidate', None)
                owner_user = getattr(owner, 'user', None)
                if owner_user:
                    contact_obj = Contact.objects.create(owner=owner_user)
                    self.contact = contact_obj
        except Exception:
            pass
        return super().save(*args, **kwargs)


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


class TeamAccount(models.Model):
    """Organization/team workspace with billing + membership controls."""

    PLAN_CHOICES = [
        ('starter', 'Starter'),
        ('pro', 'Professional'),
        ('enterprise', 'Enterprise'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('trialing', 'Trialing'),
        ('past_due', 'Past Due'),
        ('cancelled', 'Cancelled'),
    ]

    name = models.CharField(max_length=180)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='owned_teams')
    billing_email = models.EmailField(blank=True)
    subscription_plan = models.CharField(max_length=40, choices=PLAN_CHOICES, default='starter')
    subscription_status = models.CharField(max_length=40, choices=STATUS_CHOICES, default='trialing')
    seat_limit = models.PositiveIntegerField(default=5)
    next_billing_date = models.DateTimeField(null=True, blank=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['owner']),
            models.Index(fields=['subscription_status']),
        ]

    def __str__(self):
        return f"{self.name} ({self.subscription_plan})"


TEAM_PERMISSION_CHOICES = [
    ('view', 'View Only'),
    ('comment', 'View & Comment'),
    ('edit', 'Edit'),
    ('admin', 'Admin'),
]


class TeamMembership(models.Model):
    """Membership record for users inside a TeamAccount."""

    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('mentor', 'Mentor'),
        ('candidate', 'Candidate'),
    ]

    team = models.ForeignKey(TeamAccount, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='team_memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    permission_level = models.CharField(max_length=20, choices=TEAM_PERMISSION_CHOICES, default='view')
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    last_accessed_at = models.DateTimeField(null=True, blank=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='team_invites_sent'
    )
    candidate_profile = models.ForeignKey(
        CandidateProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Link candidate role memberships to their profile for analytics"
    )

    class Meta:
        unique_together = [('team', 'user')]
        indexes = [
            models.Index(fields=['team', 'role']),
            models.Index(fields=['team', 'permission_level']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.user_id} in {self.team_id} as {self.role}"


class TeamInvitation(models.Model):
    """Invitation flow for bringing collaborators into a TeamAccount."""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
    ]

    team = models.ForeignKey(TeamAccount, on_delete=models.CASCADE, related_name='invitations')
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=TeamMembership.ROLE_CHOICES)
    permission_level = models.CharField(max_length=20, choices=TEAM_PERMISSION_CHOICES, default='view')
    token = models.CharField(max_length=128, unique=True, db_index=True)
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='team_invitations_created')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    expires_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='team_invitations_accepted')
    candidate_profile = models.ForeignKey(CandidateProfile, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['team', 'status']),
            models.Index(fields=['email']),
        ]

    def is_expired(self):
        return self.expires_at and timezone.now() > self.expires_at


class TeamCandidateAccess(models.Model):
    """Per-mentorship access controls for viewing candidate data inside a team."""

    team = models.ForeignKey(TeamAccount, on_delete=models.CASCADE, related_name='candidate_access')
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name='team_access')
    granted_to = models.ForeignKey(TeamMembership, on_delete=models.CASCADE, related_name='candidate_access')
    permission_level = models.CharField(max_length=20, choices=TEAM_PERMISSION_CHOICES, default='view')
    can_view_profile = models.BooleanField(default=True)
    can_view_progress = models.BooleanField(default=True)
    can_edit_goals = models.BooleanField(default=False)
    granted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='team_access_granted')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('team', 'candidate', 'granted_to')]
        indexes = [
            models.Index(fields=['team', 'candidate']),
            models.Index(fields=['team', 'granted_to']),
        ]

    def __str__(self):
        return f"{self.granted_to_id} -> {self.candidate_id} ({self.permission_level})"


class TeamMessage(models.Model):
    """Lightweight collaboration feed for a team workspace."""

    MESSAGE_TYPES = [
        ('update', 'Update'),
        ('request', 'Request'),
        ('alert', 'Alert'),
        ('note', 'Note'),
    ]

    team = models.ForeignKey(TeamAccount, on_delete=models.CASCADE, related_name='messages')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='team_messages')
    message = models.TextField()
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default='update')
    pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['team', '-created_at']),
        ]

    def __str__(self):
        return f"TeamMessage({self.team_id})"


class SupporterInvite(models.Model):
    """Invite and lightweight access control for family/supporter dashboards."""
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="supporter_invites")
    email = models.EmailField()
    name = models.CharField(max_length=120, blank=True)
    token = models.CharField(max_length=64, unique=True, db_index=True)
    permissions = models.JSONField(default=dict, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    last_access_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paused_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["candidate", "is_active"]),
            models.Index(fields=["email"]),
        ]

    def __str__(self):
        return f"Supporter {self.email} for {self.candidate.user.username}"


class SupporterEncouragement(models.Model):
    """Simple encouragement messages sent by supporters."""
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="supporter_encouragements")
    supporter = models.ForeignKey(SupporterInvite, on_delete=models.SET_NULL, null=True, blank=True, related_name="encouragements")
    supporter_name = models.CharField(max_length=120, blank=True)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["candidate", "-created_at"]),
        ]


class SupporterChatMessage(models.Model):
    """Two-way chat between candidate and supporters (lightweight feed)."""
    ROLE_CHOICES = [
        ("supporter", "Supporter"),
        ("candidate", "Candidate"),
    ]

    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="supporter_messages")
    supporter = models.ForeignKey(SupporterInvite, on_delete=models.SET_NULL, null=True, blank=True, related_name="messages")
    sender_role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    sender_name = models.CharField(max_length=120, blank=True)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["candidate", "-created_at"]),
        ]

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


# 
# 
# =
# INTERVIEW PREPARATION MODELS
# 
# 
# =

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
    last_duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    total_duration_seconds = models.PositiveIntegerField(default=0)

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


class InterviewResponseLibrary(models.Model):
    """UC-126: User's library of prepared interview responses."""
    
    QUESTION_TYPE_CHOICES = [
        ('behavioral', 'Behavioral'),
        ('technical', 'Technical'),
        ('situational', 'Situational'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='response_library')
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPE_CHOICES)
    
    # Current best version
    current_response_text = models.TextField()
    current_star_response = models.JSONField(default=dict, blank=True)
    
    # Tagging and categorization
    skills = models.JSONField(default=list, blank=True, help_text="List of skills demonstrated")
    experiences = models.JSONField(default=list, blank=True, help_text="List of experiences referenced")
    companies_used_for = models.JSONField(default=list, blank=True, help_text="Companies this response was used for")
    tags = models.JSONField(default=list, blank=True, help_text="Custom tags for organization")
    
    # Success tracking
    led_to_offer = models.BooleanField(default=False)
    led_to_next_round = models.BooleanField(default=False)
    times_used = models.PositiveIntegerField(default=0)
    success_rate = models.FloatField(default=0.0, help_text="Calculated success rate based on outcomes")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    
    # Optional job linkage for context
    related_jobs = models.ManyToManyField('JobEntry', blank=True, related_name='linked_responses')
    
    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'question_type']),
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['user', 'led_to_offer']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.question_type} - {self.question_text[:50]}"
    
    def calculate_success_rate(self):
        """Update success rate based on tracked outcomes."""
        if self.times_used == 0:
            self.success_rate = 0.0
        else:
            successful = 0
            if self.led_to_offer:
                successful = self.times_used  # If got offer, count all uses as successful
            elif self.led_to_next_round:
                successful = max(1, self.times_used // 2)  # Partial success
            self.success_rate = (successful / self.times_used) * 100
        self.save()


class ResponseVersion(models.Model):
    """Version history for interview responses (UC-126)."""
    
    response_library = models.ForeignKey(InterviewResponseLibrary, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField()
    response_text = models.TextField()
    star_response = models.JSONField(default=dict, blank=True)
    
    # What changed in this version
    change_notes = models.TextField(blank=True, help_text="Notes about what was improved")
    coaching_score = models.FloatField(null=True, blank=True, help_text="AI coaching score if available")
    
    # Link to original coaching session if applicable
    coaching_session = models.ForeignKey(
        'QuestionResponseCoaching', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='saved_versions'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-version_number']
        unique_together = [('response_library', 'version_number')]
        indexes = [
            models.Index(fields=['response_library', '-version_number']),
        ]
    
    def __str__(self):
        return f"Version {self.version_number} - {self.response_library.question_text[:30]}"


class MockInterviewSession(models.Model):
    """UC-077: Full mock interview practice sessions with AI-generated questions."""
    
    STATUS_CHOICES = [
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('abandoned', 'Abandoned'),
    ]
    
    INTERVIEW_TYPE_CHOICES = [
        ('behavioral', 'Behavioral'),
        ('technical', 'Technical'),
        ('case_study', 'Case Study'),
        ('mixed', 'Mixed'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='mock_interview_sessions')
    job = models.ForeignKey('JobEntry', on_delete=models.SET_NULL, null=True, blank=True, related_name='mock_sessions')
    interview_type = models.CharField(max_length=20, choices=INTERVIEW_TYPE_CHOICES, default='behavioral')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_progress')
    
    # Configuration
    question_count = models.PositiveIntegerField(default=5)
    difficulty_level = models.CharField(max_length=50, default='mid')
    focus_areas = models.JSONField(default=list, blank=True)  # e.g., ['leadership', 'conflict resolution']
    
    # Session metadata
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    total_duration_seconds = models.PositiveIntegerField(default=0)
    
    # Overall performance
    overall_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)  # 0-100
    strengths = models.JSONField(default=list, blank=True)
    areas_for_improvement = models.JSONField(default=list, blank=True)
    ai_summary = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', '-started_at']),
        ]
    
    def __str__(self):
        return f"MockInterviewSession({self.id}, {self.user.email}, {self.interview_type})"
    
    def mark_completed(self):
        """Mark session as completed and calculate duration."""
        self.status = 'completed'
        self.completed_at = timezone.now()
        if self.started_at:
            self.total_duration_seconds = int((self.completed_at - self.started_at).total_seconds())
        self.save()
    
    def calculate_overall_score(self):
        """Calculate overall score from all question responses."""
        questions = self.questions.filter(answer_score__isnull=False)
        if not questions.exists():
            return None
        avg_score = questions.aggregate(models.Avg('answer_score'))['answer_score__avg']
        return round(avg_score, 2) if avg_score else None


class MockInterviewQuestion(models.Model):
    """Individual questions within a mock interview session (UC-077)."""
    
    session = models.ForeignKey(MockInterviewSession, on_delete=models.CASCADE, related_name='questions')
    question_number = models.PositiveIntegerField()
    
    # Question details
    question_text = models.TextField()
    question_category = models.CharField(max_length=50, blank=True)  # e.g., 'teamwork', 'problem-solving'
    suggested_framework = models.CharField(max_length=50, blank=True)  # e.g., 'STAR', 'CAR'
    ideal_answer_points = models.JSONField(default=list, blank=True)  # Key points to cover
    
    # User's response
    user_answer = models.TextField(blank=True)
    answer_timestamp = models.DateTimeField(null=True, blank=True)
    time_taken_seconds = models.PositiveIntegerField(null=True, blank=True)
    
    # AI evaluation
    answer_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)  # 0-100
    ai_feedback = models.TextField(blank=True)
    strengths = models.JSONField(default=list, blank=True)
    improvements = models.JSONField(default=list, blank=True)
    keyword_coverage = models.JSONField(default=dict, blank=True)  # Track which key points were mentioned
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['session', 'question_number']
        unique_together = [('session', 'question_number')]
        indexes = [
            models.Index(fields=['session', 'question_number']),
        ]
    
    def __str__(self):
        return f"Question {self.question_number} - {self.session_id}"
    
    def submit_answer(self, answer_text):
        """Record user's answer with timestamp."""
        self.user_answer = answer_text
        self.answer_timestamp = timezone.now()
        if self.created_at:
            self.time_taken_seconds = int((self.answer_timestamp - self.created_at).total_seconds())
        self.save()


class MockInterviewSummary(models.Model):
    """Post-session summary and recommendations (UC-077)."""
    
    session = models.OneToOneField(MockInterviewSession, on_delete=models.CASCADE, related_name='summary')
    
    # Performance breakdown
    performance_by_category = models.JSONField(default=dict, blank=True)  # {'teamwork': 85, 'leadership': 72}
    response_quality_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    communication_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    structure_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    
    # Detailed feedback
    top_strengths = models.JSONField(default=list, blank=True)
    critical_areas = models.JSONField(default=list, blank=True)
    recommended_practice_topics = models.JSONField(default=list, blank=True)
    next_steps = models.JSONField(default=list, blank=True)
    
    # AI-generated insights
    overall_assessment = models.TextField(blank=True)
    readiness_level = models.CharField(max_length=20, blank=True)  # e.g., 'ready', 'needs_practice', 'not_ready'
    estimated_interview_readiness = models.PositiveIntegerField(null=True, blank=True)  # 0-100%
    
    # Comparison metrics
    compared_to_previous_sessions = models.JSONField(default=dict, blank=True)
    improvement_trend = models.CharField(max_length=20, blank=True)  # 'improving', 'stable', 'declining'
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name_plural = "Mock interview summaries"
    
    def __str__(self):
        return f"Summary for {self.session}"


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


class TechnicalPrepGeneration(models.Model):
    """Track async technical prep build jobs so we can queue/poll status."""

    STATUS_PENDING = 'pending'
    STATUS_RUNNING = 'running'
    STATUS_SUCCEEDED = 'succeeded'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_RUNNING, 'Running'),
        (STATUS_SUCCEEDED, 'Succeeded'),
        (STATUS_FAILED, 'Failed'),
    ]

    job = models.ForeignKey('JobEntry', on_delete=models.CASCADE, related_name='technical_prep_generations')
    profile = models.ForeignKey('CandidateProfile', on_delete=models.CASCADE, related_name='technical_prep_generations')
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='technical_prep_generations',
    )
    cache = models.ForeignKey(
        'TechnicalPrepCache',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generation_jobs',
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    reason = models.CharField(max_length=32, blank=True)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)
    attempt_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    last_progress_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['job', 'status'], name='techprep_job_status_idx'),
            models.Index(fields=['job', '-created_at'], name='techprep_job_created_idx'),
        ]

    def __str__(self):
        return f"TechnicalPrepGeneration(job={self.job_id}, status={self.status})"


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


class InterviewSuccessPrediction(models.Model):
    """Persist interview success forecasts for historical analysis."""

    interview = models.ForeignKey(
        'InterviewSchedule',
        on_delete=models.CASCADE,
        related_name='success_predictions'
    )
    job = models.ForeignKey('JobEntry', on_delete=models.CASCADE, related_name='success_predictions')
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name='interview_success_predictions')

    predicted_probability = models.DecimalField(max_digits=5, decimal_places=2)
    confidence_score = models.DecimalField(max_digits=4, decimal_places=2)
    preparation_score = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    match_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    research_completion = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    practice_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    historical_adjustment = models.DecimalField(max_digits=4, decimal_places=2, default=0)

    payload = models.JSONField(default=dict, blank=True, help_text="Serialized breakdown for reuse")

    generated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    accuracy = models.DecimalField(
        max_digits=4,
        decimal_places=3,
        null=True,
        blank=True,
        help_text="Absolute error between prediction and normalized outcome"
    )
    actual_outcome = models.CharField(max_length=20, blank=True)
    evaluated_at = models.DateTimeField(null=True, blank=True)
    is_latest = models.BooleanField(default=True)

    class Meta:
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['interview', '-generated_at']),
            models.Index(fields=['candidate', '-generated_at']),
            models.Index(fields=['job', '-generated_at']),
            models.Index(fields=['is_latest']),
        ]

    def __str__(self):
        pct = float(self.predicted_probability or 0)
        return f"Prediction({pct:.1f}% for interview {self.interview_id})"

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


# 
# 
# =
# ANALYTICS & TRACKING MODELS
# 
# 
# =

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


# 
# 
# =
# AI & AUTOMATION MODELS
# 
# 
# =

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


# 
# 
# =
# REMINDERS & NOTIFICATIONS
# (existing reminder model replaced by UC-086 Reminder model defined earlier)
# 
# 
# =
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


# 
# 
# =
# UC-036: JOB ENTRIES
# 
# 
# =

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

    # UC-097: Application Success Rate Analysis tracking
    APPLICATION_SOURCES = [
        ('company_website', 'Company Website'),
        ('linkedin', 'LinkedIn'),
        ('indeed', 'Indeed'),
        ('glassdoor', 'Glassdoor'),
        ('referral', 'Referral'),
        ('recruiter', 'Recruiter'),
        ('job_board', 'Job Board'),
        ('networking', 'Networking Event'),
        ('other', 'Other'),
    ]
    
    APPLICATION_METHODS = [
        ('online_form', 'Online Application Form'),
        ('email', 'Email'),
        ('referral', 'Internal Referral'),
        ('recruiter', 'Through Recruiter'),
        ('direct_contact', 'Direct Contact'),
        ('other', 'Other'),
    ]

    # UC-116: Precomputed geocoding
    location_lat = models.FloatField(null=True, blank=True)
    location_lon = models.FloatField(null=True, blank=True)
    location_geo_precision = models.CharField(max_length=20, blank=True, default='unknown')
    location_geo_updated_at = models.DateTimeField(null=True, blank=True)
    
    COMPANY_SIZES = [
        ('startup', 'Startup (1-50)'),
        ('small', 'Small (51-200)'),
        ('medium', 'Medium (201-1000)'),
        ('large', 'Large (1001-5000)'),
        ('enterprise', 'Enterprise (5000+)'),
    ]
    
    application_source = models.CharField(max_length=50, choices=APPLICATION_SOURCES, blank=True, db_index=True)
    application_method = models.CharField(max_length=50, choices=APPLICATION_METHODS, blank=True, db_index=True)
    company_size = models.CharField(max_length=20, choices=COMPANY_SIZES, blank=True, db_index=True)
    
    # Track if resume/cover letter were customized for this application
    resume_customized = models.BooleanField(default=False, help_text="Was the resume customized for this application?")
    cover_letter_customized = models.BooleanField(default=False, help_text="Was the cover letter customized for this application?")
    
    # Application submission tracking
    application_submitted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    first_response_at = models.DateTimeField(null=True, blank=True)  # When we first heard back
    days_to_response = models.IntegerField(null=True, blank=True, help_text="Days from application to first response")

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
    

class SalaryNegotiationPlan(models.Model):
    """Structured negotiation preparation plan for a specific job offer (UC-083)."""

    job = models.OneToOneField(JobEntry, on_delete=models.CASCADE, related_name='negotiation_plan')
    salary_research = models.ForeignKey(SalaryResearch, on_delete=models.SET_NULL, null=True, blank=True, related_name='negotiation_plans')
    offer_details = models.JSONField(default=dict, blank=True)
    market_context = models.JSONField(default=dict, blank=True)
    talking_points = models.JSONField(default=list, blank=True)
    total_comp_framework = models.JSONField(default=dict, blank=True)
    scenario_scripts = models.JSONField(default=list, blank=True)
    timing_strategy = models.JSONField(default=dict, blank=True)
    counter_offer_templates = models.JSONField(default=list, blank=True)
    confidence_exercises = models.JSONField(default=list, blank=True)
    offer_guidance = models.JSONField(default=dict, blank=True)
    readiness_checklist = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    version = models.CharField(max_length=20, default='1.0')
    generated_by = models.CharField(max_length=60, default='planner')
    generated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['job']),
            models.Index(fields=['updated_at']),
        ]

    def __str__(self):
        return f"Negotiation Plan for {self.job.title} @ {self.job.company_name}"


class SalaryNegotiationOutcome(models.Model):
    """Track actual negotiation attempts and results for analytics."""

    STAGE_CHOICES = [
        ('pre-offer', 'Pre-Offer Research'),
        ('offer', 'Offer Review'),
        ('counter', 'Counter Submitted'),
        ('final', 'Final Decision'),
    ]

    RESULT_STATUS = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('withdrawn', 'Withdrawn'),
    ]

    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, related_name='negotiation_outcomes')
    plan = models.ForeignKey(SalaryNegotiationPlan, on_delete=models.SET_NULL, null=True, blank=True, related_name='outcomes')
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default='offer')
    base_salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    bonus = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    equity = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    company_offer = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    counter_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    final_result = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_comp_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    leverage_used = models.CharField(max_length=80, blank=True)
    confidence_score = models.PositiveSmallIntegerField(null=True, blank=True, help_text='1-5 self-assessed confidence')
    status = models.CharField(max_length=20, choices=RESULT_STATUS, default='pending')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['job', '-created_at']),
            models.Index(fields=['stage']),
        ]

    def __str__(self):
        return f"Negotiation outcome ({self.stage}) for job {self.job_id}"

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

    def ensure_event_metadata(self):
        """Ensure there's a matching InterviewEvent record with logistics info."""
        try:
            event, created = InterviewEvent.objects.get_or_create(
                interview=self,
                defaults={
                    'location_override': self.location,
                    'video_conference_link': self.meeting_link,
                }
            )
        except Exception:
            # Avoid cascading failures if event creation hits race or db issues
            return None

        updated_fields = []
        if not event.calendar_provider:
            event.calendar_provider = 'in_app'
            updated_fields.append('calendar_provider')
        if self.location and event.location_override != self.location:
            event.location_override = self.location
            updated_fields.append('location_override')
        if self.meeting_link and event.video_conference_link != self.meeting_link:
            event.video_conference_link = self.meeting_link
            updated_fields.append('video_conference_link')
        if updated_fields:
            updated_fields.append('updated_at')
            event.save(update_fields=updated_fields)
        return event


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


class InterviewEvent(models.Model):
    """Calendar-focused metadata for scheduled interviews (UC-079)."""

    PROVIDER_CHOICES = [
        ('in_app', 'In-App Only'),
        ('google', 'Google Calendar'),
        ('outlook', 'Outlook Calendar'),
        ('other', 'Other Calendar'),
    ]

    SYNC_STATUS_CHOICES = [
        ('not_synced', 'Not Synced'),
        ('pending', 'Pending Sync'),
        ('synced', 'Synced'),
        ('failed', 'Sync Failed'),
        ('disconnected', 'Disconnected'),
    ]

    FOLLOW_UP_CHOICES = [
        ('pending', 'Pending'),
        ('scheduled', 'Scheduled'),
        ('sent', 'Thank You Sent'),
        ('skipped', 'Skipped'),
    ]

    interview = models.OneToOneField(
        InterviewSchedule,
        on_delete=models.CASCADE,
        related_name='event_metadata'
    )
    calendar_provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default='in_app')
    external_calendar_id = models.CharField(max_length=255, blank=True)
    external_event_id = models.CharField(max_length=255, blank=True)
    external_event_link = models.URLField(max_length=500, blank=True)
    sync_enabled = models.BooleanField(default=False)
    sync_status = models.CharField(max_length=20, choices=SYNC_STATUS_CHOICES, default='not_synced')
    last_synced_at = models.DateTimeField(null=True, blank=True)

    location_override = models.CharField(max_length=500, blank=True)
    video_conference_link = models.URLField(max_length=500, blank=True)
    logistics_notes = models.TextField(blank=True)
    dial_in_details = models.CharField(max_length=500, blank=True)

    reminder_24h_sent = models.BooleanField(default=False)
    reminder_2h_sent = models.BooleanField(default=False)
    thank_you_note_sent = models.BooleanField(default=False)
    thank_you_note_sent_at = models.DateTimeField(null=True, blank=True)
    follow_up_status = models.CharField(max_length=20, choices=FOLLOW_UP_CHOICES, default='pending')
    outcome_recorded_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['calendar_provider', 'sync_status']),
            models.Index(fields=['interview', 'sync_status']),
            models.Index(fields=['follow_up_status']),
        ]
        ordering = ['-updated_at']

    def __str__(self):
        return f"InterviewEvent for {self.interview.job.title} ({self.get_calendar_provider_display()})"

    def mark_thank_you_sent(self):
        self.thank_you_note_sent = True
        self.thank_you_note_sent_at = timezone.now()
        self.follow_up_status = 'sent'
        self.save(update_fields=['thank_you_note_sent', 'thank_you_note_sent_at', 'follow_up_status', 'updated_at'])


class CalendarIntegration(models.Model):
    """Stores OAuth credentials + sync status for external calendar providers."""

    STATUS_CHOICES = [
        ('disconnected', 'Disconnected'),
        ('pending', 'Pending Authorization'),
        ('connected', 'Connected'),
        ('error', 'Error'),
    ]

    candidate = models.ForeignKey(
        CandidateProfile,
        on_delete=models.CASCADE,
        related_name='calendar_integrations'
    )
    provider = models.CharField(max_length=20, choices=InterviewEvent.PROVIDER_CHOICES)
    external_email = models.EmailField(blank=True)
    external_account_id = models.CharField(max_length=255, blank=True)

    access_token = models.TextField(blank=True)
    refresh_token = models.TextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    scopes = models.JSONField(default=list, blank=True)

    sync_enabled = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='disconnected')
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)

    state_token = models.CharField(max_length=128, blank=True)
    frontend_redirect_url = models.URLField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['candidate', 'provider'], name='core_calend_candida_6af480_idx'),
            models.Index(fields=['provider', 'status'], name='core_calend_provide_e175df_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['candidate', 'provider', 'external_account_id'],
                condition=~Q(external_account_id=''),
                name='unique_calendar_account_per_provider'
            )
        ]

    def __str__(self):  # pragma: no cover - display helper
        return f"{self.candidate.user.email} → {self.get_provider_display()} ({self.status})"

    def generate_state_token(self):
        token = secrets.token_urlsafe(32)
        self.state_token = token
        self.status = 'pending'
        self.save(update_fields=['state_token', 'status', 'updated_at'])
        return token

    def mark_connected(self, *, access_token, refresh_token, expires_at, scopes, external_email=None, external_account_id=None):
        self.access_token = access_token or ''
        self.refresh_token = refresh_token or self.refresh_token
        self.token_expires_at = expires_at
        self.scopes = scopes or []
        self.external_email = external_email or self.external_email
        self.external_account_id = external_account_id or self.external_account_id
        self.status = 'connected'
        self.sync_enabled = True
        self.last_error = ''
        self.state_token = ''
        self.save(update_fields=[
            'access_token',
            'refresh_token',
            'token_expires_at',
            'scopes',
            'external_email',
            'external_account_id',
            'status',
            'sync_enabled',
            'last_error',
            'state_token',
            'updated_at',
        ])

    def disconnect(self, reason=None, disable_sync=True):
        self.access_token = ''
        self.refresh_token = ''
        self.token_expires_at = None
        self.external_email = ''
        self.external_account_id = ''
        self.state_token = ''
        self.status = 'disconnected'
        self.last_error = reason or ''
        self.frontend_redirect_url = ''
        if disable_sync:
            self.sync_enabled = False
        self.save(update_fields=[
            'access_token',
            'refresh_token',
            'token_expires_at',
            'external_email',
            'external_account_id',
            'state_token',
            'status',
            'last_error',
            'sync_enabled',
            'frontend_redirect_url',
            'updated_at',
        ])

    def mark_error(self, message):
        self.last_error = message
        self.status = 'error'
        self.save(update_fields=['last_error', 'status', 'updated_at'])


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


# 
# 
# =
# UC-069: Application Workflow Automation Models
# 
# 
# =

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


class ApplicationQualityReview(models.Model):
    """
    UC-??? AI quality score for application packages

    Stores per-job, per-candidate quality assessments so we can track history
    and enforce submission readiness thresholds.
    """
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name='application_quality_reviews')
    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, related_name='quality_reviews')
    resume_doc = models.ForeignKey('Document', on_delete=models.SET_NULL, null=True, blank=True, related_name='quality_reviews_as_resume')
    cover_letter_doc = models.ForeignKey('Document', on_delete=models.SET_NULL, null=True, blank=True, related_name='quality_reviews_as_cover')
    linkedin_url = models.URLField(blank=True, default='')

    overall_score = models.DecimalField(max_digits=5, decimal_places=2)
    alignment_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    keyword_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    consistency_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    formatting_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    missing_keywords = models.JSONField(default=list, blank=True)
    missing_skills = models.JSONField(default=list, blank=True)
    formatting_issues = models.JSONField(default=list, blank=True)
    improvement_suggestions = models.JSONField(default=list, blank=True)
    comparison_snapshot = models.JSONField(default=dict, blank=True)

    threshold = models.PositiveIntegerField(default=70)
    meets_threshold = models.BooleanField(default=False)
    score_delta = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['candidate', 'job', '-created_at']),
            models.Index(fields=['job', '-created_at']),
            models.Index(fields=['candidate', '-created_at']),
        ]

    def __str__(self):
        return f"Quality {self.overall_score} for job {self.job_id}"


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
        related_name='shares',
        null=True,
        blank=True,
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
    allow_edit = models.BooleanField(
        default=False,
        help_text="Allow reviewers to edit the resume themselves"
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
    
    cover_letter_document = models.ForeignKey(
        Document,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cover_letter_shares',
        help_text="Cover letter document shared with reviewers"
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
        # Refresh so subsequent serialization sees the real integer value
        self.refresh_from_db(fields=['view_count'])
    
    def __str__(self):
        status = "Active" if self.is_accessible() else "Inactive"
        label = None
        if self.resume_version:
            label = self.resume_version.version_name
        elif self.cover_letter_document:
            label = self.cover_letter_document.document_name
        else:
            label = 'Document'
        return f"{label} - {status} ({self.privacy_level})"


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
            ('edit', 'Edited'),
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
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='feedback_received'
    )
    cover_letter_document = models.ForeignKey(
        Document,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cover_letter_feedback'
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
            models.Index(fields=['cover_letter_document', '-created_at']),
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


# 
# 
# =
# Networking Event Management Models (UC-088)
# 
# 
# =


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


class CareerGoal(models.Model):
    """
    UC-101: Career goal setting and achievement tracking.
    Enables users to set SMART goals with milestones and track progress.
    """
    GOAL_TYPES = [
        ('short_term', 'Short-term (< 6 months)'),
        ('long_term', 'Long-term (6+ months)'),
    ]
    
    STATUS_CHOICES = [
        ('not_started', 'Not Started'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('paused', 'Paused'),
        ('abandoned', 'Abandoned'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='career_goals')
    
    # SMART Goal components
    title = models.CharField(max_length=200, help_text="Specific goal title")
    description = models.TextField(help_text="Detailed goal description")
    goal_type = models.CharField(max_length=20, choices=GOAL_TYPES, default='short_term')
    
    # Measurable metrics
    target_metric = models.CharField(max_length=200, blank=True, 
                                     help_text="What metric defines success? e.g., '5 interviews', '$120K salary'")
    current_value = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                        help_text="Current progress value")
    target_value = models.DecimalField(max_digits=10, decimal_places=2, default=100,
                                       help_text="Target value to achieve")
    
    # Achievable & Relevant context
    action_steps = models.JSONField(default=list, blank=True, 
                                    help_text="List of actionable steps to achieve goal")
    linked_jobs = models.ManyToManyField('JobOpportunity', blank=True, related_name='career_goals',
                                         help_text="Jobs connected to this goal")
    
    # Time-bound
    target_date = models.DateField(help_text="Goal deadline")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Status and progress
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='not_started')
    progress_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0,
                                              help_text="Auto-calculated or manual progress %")
    
    # Motivation and accountability
    motivation_notes = models.TextField(blank=True, help_text="Why this goal matters")
    accountability_partner = models.EmailField(blank=True, help_text="Optional accountability partner email")
    share_progress = models.BooleanField(default=False, help_text="Share progress with accountability partner")
    
    # Recommendations and insights
    ai_recommendations = models.JSONField(default=dict, blank=True,
                                          help_text="AI-generated recommendations for achieving goal")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', 'target_date']),
            models.Index(fields=['status', 'target_date']),
        ]
    
    def calculate_progress(self):
        """Auto-calculate progress based on current vs target value"""
        if self.target_value > 0:
            progress = (self.current_value / self.target_value) * 100
            return min(progress, 100)
        return 0
    
    def update_progress(self, new_value):
        """Update current value and recalculate progress"""
        self.current_value = new_value
        self.progress_percentage = self.calculate_progress()
        if self.progress_percentage >= 100 and self.status != 'completed':
            self.mark_completed()
        elif self.progress_percentage < 100 and self.status == 'completed':
            self.status = 'in_progress'
            self.completed_at = None
        self.save()
    
    def mark_completed(self):
        """Mark goal as completed with timestamp"""
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.progress_percentage = 100
        self.save()
    
    def is_overdue(self):
        """Check if goal is past target date and not completed"""
        return (self.target_date < timezone.now().date() and 
                self.status not in ['completed', 'abandoned'])
    
    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"


class GoalMilestone(models.Model):
    """
    Sub-goals or milestones within a career goal for better tracking.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    goal = models.ForeignKey(CareerGoal, on_delete=models.CASCADE, related_name='milestones')
    
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    target_date = models.DateField(null=True, blank=True)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0, help_text="Display order")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['order', 'target_date']
        indexes = [
            models.Index(fields=['goal', 'completed']),
        ]
    
    def mark_completed(self):
        """Mark milestone as completed"""
        self.completed = True
        self.completed_at = timezone.now()
        self.save()
        
        # Update parent goal progress based on milestone completion
        total_milestones = self.goal.milestones.count()
        completed_milestones = self.goal.milestones.filter(completed=True).count()
        if total_milestones > 0:
            milestone_progress = (completed_milestones / total_milestones) * 100
            # Update parent goal if milestone-based tracking
            if self.goal.progress_percentage < milestone_progress:
                self.goal.progress_percentage = milestone_progress
                self.goal.save()
    
    def __str__(self):
        return f"{self.title} - {self.goal.title}"


# 

# 
# 
# =
# UC-095: Professional Reference Management
# 
# 
# =

class ProfessionalReference(models.Model):
    """Stores professional references for job applications (UC-095)"""
    RELATIONSHIP_TYPES = [
        ('supervisor', 'Direct Supervisor'),
        ('manager', 'Manager'),
        ('colleague', 'Colleague'),
        ('mentor', 'Mentor'),
        ('professor', 'Professor/Academic'),
        ('client', 'Client'),
        ('other', 'Other'),
    ]
    
    AVAILABILITY_STATUS = [
        ('available', 'Available'),
        ('limited', 'Limited Availability'),
        ('unavailable', 'Currently Unavailable'),
        ('pending_permission', 'Pending Permission'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='professional_references')
    
    # Contact Information
    name = models.CharField(max_length=200)
    title = models.CharField(max_length=200, help_text="Professional title/position")
    company = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=50, blank=True)
    linkedin_url = models.URLField(blank=True)
    
    # Relationship
    relationship_type = models.CharField(max_length=30, choices=RELATIONSHIP_TYPES)
    relationship_description = models.TextField(blank=True, help_text="How you worked together")
    years_known = models.PositiveSmallIntegerField(default=0, help_text="Years known")
    
    # Availability
    availability_status = models.CharField(max_length=30, choices=AVAILABILITY_STATUS, default='pending_permission')
    permission_granted_date = models.DateField(null=True, blank=True)
    last_used_date = models.DateField(null=True, blank=True)
    
    # Preferences
    preferred_contact_method = models.CharField(max_length=20, choices=[
        ('email', 'Email'),
        ('phone', 'Phone'),
        ('either', 'Either'),
    ], default='email')
    best_for_roles = models.JSONField(default=list, blank=True, help_text="Role types this reference is best for")
    best_for_industries = models.JSONField(default=list, blank=True, help_text="Industries this reference is best for")
    
    # Notes and Talking Points
    key_strengths_to_highlight = models.TextField(blank=True, help_text="Key strengths this reference can speak to")
    projects_worked_together = models.TextField(blank=True, help_text="Specific projects or achievements")
    talking_points = models.JSONField(default=list, blank=True, help_text="Specific talking points for reference")
    
    # Maintenance
    last_contacted_date = models.DateField(null=True, blank=True)
    next_check_in_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, help_text="Private notes about this reference")
    
    # Tracking
    times_used = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['user', 'availability_status']),
            models.Index(fields=['user', 'last_used_date']),
        ]
        ordering = ['-is_active', 'name']
    
    def __str__(self):
        return f"{self.name} - {self.relationship_type} at {self.company}"


class ReferenceRequest(models.Model):
    """Tracks when references are requested for specific applications (UC-095)"""
    REQUEST_STATUS = [
        ('pending', 'Pending'),
        ('sent', 'Sent to Reference'),
        ('completed', 'Completed'),
        ('declined', 'Declined'),
        ('expired', 'Expired'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reference_requests')
    reference = models.ForeignKey(ProfessionalReference, on_delete=models.CASCADE, related_name='requests')
    
    # Associated application (optional)
    application = models.ForeignKey('Application', on_delete=models.SET_NULL, null=True, blank=True, 
                                   related_name='reference_requests')
    job_opportunity = models.ForeignKey('JobOpportunity', on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name='reference_requests')
    
    # Request details
    company_name = models.CharField(max_length=200)
    position_title = models.CharField(max_length=200)
    request_status = models.CharField(max_length=20, choices=REQUEST_STATUS, default='pending')
    
    # Communication
    request_sent_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    completed_date = models.DateField(null=True, blank=True)
    
    # Custom message/template used
    custom_message = models.TextField(blank=True, help_text="Personalized message sent to reference")
    preparation_materials_sent = models.BooleanField(default=False)
    
    # Feedback
    feedback_received = models.TextField(blank=True, help_text="Feedback from reference about the request")
    reference_rating = models.PositiveSmallIntegerField(null=True, blank=True, 
                                                        help_text="How reference rated the experience (1-5)")
    
    # Outcome
    contributed_to_success = models.BooleanField(default=False, help_text="Did this reference contribute to getting the job?")
    outcome_notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'request_status']),
            models.Index(fields=['reference', 'request_status']),
            models.Index(fields=['application']),
            models.Index(fields=['user', 'due_date']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Reference request for {self.position_title} at {self.company_name}"


class ReferenceTemplate(models.Model):
    """Templates for reference requests and preparation materials (UC-095)"""
    TEMPLATE_TYPES = [
        ('request_email', 'Reference Request Email'),
        ('preparation_guide', 'Preparation Guide'),
        ('talking_points', 'Talking Points'),
        ('thank_you', 'Thank You Note'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reference_templates')
    
    name = models.CharField(max_length=200)
    template_type = models.CharField(max_length=30, choices=TEMPLATE_TYPES)
    subject_line = models.CharField(max_length=200, blank=True, help_text="Email subject (for email templates)")
    content = models.TextField(help_text="Template content with placeholders")
    
    # Customization
    for_relationship_types = models.JSONField(default=list, blank=True, help_text="Relationship types this template is for")
    for_role_types = models.JSONField(default=list, blank=True, help_text="Job role types this template is for")
    
    is_default = models.BooleanField(default=False)
    times_used = models.PositiveIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'template_type']),
            models.Index(fields=['user', 'is_default']),
        ]
        ordering = ['-is_default', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.get_template_type_display()})"


class ReferenceAppreciation(models.Model):
    """Track appreciation/maintenance activities for references (UC-095)"""
    APPRECIATION_TYPES = [
        ('thank_you_note', 'Thank You Note'),
        ('coffee_meetup', 'Coffee/Lunch Meetup'),
        ('gift', 'Gift/Token of Appreciation'),
        ('linkedin_endorsement', 'LinkedIn Endorsement'),
        ('recommendation', 'Written Recommendation'),
        ('referral_returned', 'Returned Referral/Favor'),
        ('update_call', 'Update Call'),
        ('holiday_greeting', 'Holiday Greeting'),
        ('other', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reference_appreciations')
    reference = models.ForeignKey(ProfessionalReference, on_delete=models.CASCADE, related_name='appreciations')
    
    appreciation_type = models.CharField(max_length=30, choices=APPRECIATION_TYPES)
    date = models.DateField()
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True, help_text="Private notes")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'date']),
            models.Index(fields=['reference', 'date']),
        ]
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.get_appreciation_type_display()} for {self.reference.name}"


class ReferencePortfolio(models.Model):
    """Group references for specific career goals or application types (UC-095)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reference_portfolios')
    
    name = models.CharField(max_length=200, help_text="e.g., 'Software Engineering Roles', 'Management Positions'")
    description = models.TextField(blank=True)
    
    references = models.ManyToManyField(ProfessionalReference, related_name='portfolios', blank=True)
    
    # Target
    target_role_types = models.JSONField(default=list, blank=True)
    target_industries = models.JSONField(default=list, blank=True)
    target_companies = models.JSONField(default=list, blank=True)
    
    is_default = models.BooleanField(default=False)
    times_used = models.PositiveIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'is_default']),
        ]
        ordering = ['-is_default', 'name']
    
    def __str__(self):
        return self.name




class MentorshipRequest(models.Model):
    """Track inbound/outbound mentorship invitations between users."""

    ROLE_CHOICES = [
        ('mentor', 'Mentor'),
        ('mentee', 'Mentee'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requester = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name='sent_mentorship_requests')
    receiver = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name='received_mentorship_requests')
    role_for_requester = models.CharField(max_length=20, choices=ROLE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    responded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='mentorship_responses'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['requester', 'status'], name='core_mr_request_status'),
            models.Index(fields=['receiver', 'status'], name='core_mr_receiv_status'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['requester', 'receiver'],
                condition=Q(status='pending'),
                name='unique_pending_mentorship_request',
            )
        ]

    def __str__(self):
        return f"{self.requester_id} -> {self.receiver_id} ({self.status})"

    def get_mentee_profile(self):
        """Return the CandidateProfile that will be mentored in this request."""
        if self.role_for_requester == 'mentor':
            return self.receiver
        return self.requester

    def get_mentor_user(self):
        """Return the Django user who will act as mentor in this request."""
        if self.role_for_requester == 'mentor':
            return getattr(self.requester, 'user', None)
        return getattr(self.receiver, 'user', None)


class MentorshipSharingPreference(models.Model):
    """Per-mentor sharing toggles that mentees control."""

    JOB_SHARING_CHOICES = [
        ('none', 'Do not share jobs'),
        ('all', 'Share all jobs'),
        ('responded', 'Share jobs with responses'),
        ('selected', 'Share selected jobs'),
    ]

    team_member = models.OneToOneField(
        'TeamMember',
        on_delete=models.CASCADE,
        related_name='sharing_preference',
    )
    share_profile_basics = models.BooleanField(default=False)
    share_skills = models.BooleanField(default=False)
    share_employment = models.BooleanField(default=False)
    share_education = models.BooleanField(default=False)
    share_certifications = models.BooleanField(default=False)
    share_documents = models.BooleanField(default=False)
    share_job_applications = models.BooleanField(default=False)
    job_sharing_mode = models.CharField(max_length=20, choices=JOB_SHARING_CHOICES, default='selected')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"SharingPreference({self.team_member_id})"


class MentorshipSharedApplication(models.Model):
    """Specific job entries a mentee shares with a mentor."""

    team_member = models.ForeignKey(
        'TeamMember',
        on_delete=models.CASCADE,
        related_name='shared_applications',
    )
    job = models.ForeignKey(
        'JobEntry',
        on_delete=models.CASCADE,
        related_name='mentorship_shares',
    )
    include_documents = models.BooleanField(default=False)
    shared_resume = models.ForeignKey(
        'Document',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    shared_cover_letter = models.ForeignKey(
        'Document',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    notes = models.TextField(blank=True)
    shared_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('team_member', 'job')]
        indexes = [
            models.Index(fields=['team_member', 'job'], name='core_mshare_team_job'),
        ]

    def __str__(self):
        return f"SharedApplication({self.team_member_id}, job={self.job_id})"


class MentorshipGoal(models.Model):
    """Quantitative goals mentors assign to mentees."""

    GOAL_TYPE_CHOICES = [
        ('applications_submitted', 'Job applications submitted'),
        ('skills_added', 'Skills added'),
        ('projects_completed', 'Projects completed'),
        ('skill_add', 'Add a specific skill'),
        ('skill_improve', 'Improve an existing skill'),
        ('interview_practice', 'Interview practice questions'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team_member = models.ForeignKey(
        'TeamMember',
        on_delete=models.CASCADE,
        related_name='mentorship_goals',
    )
    goal_type = models.CharField(max_length=40, choices=GOAL_TYPE_CHOICES)
    title = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    target_value = models.PositiveIntegerField(default=1)
    baseline_value = models.PositiveIntegerField(default=0)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    custom_skill_name = models.CharField(max_length=160, blank=True)
    required_level = models.CharField(
        max_length=20,
        blank=True,
        choices=[
            ('beginner', 'Beginner'),
            ('intermediate', 'Intermediate'),
            ('advanced', 'Advanced'),
            ('expert', 'Expert'),
        ],
    )
    starting_level = models.CharField(
        max_length=20,
        blank=True,
        choices=[
            ('beginner', 'Beginner'),
            ('intermediate', 'Intermediate'),
            ('advanced', 'Advanced'),
            ('expert', 'Expert'),
        ],
    )
    metric_scope = models.CharField(max_length=60, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    skill = models.ForeignKey(
        Skill,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mentorship_goal_targets',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['team_member', 'status'], name='core_mentor_team_me_8c8455_idx'),
            models.Index(fields=['goal_type'], name='core_mentor_goal_ty_17e26d_idx'),
        ]

    def __str__(self):
        return f"{self.get_goal_type_display()} ({self.team_member_id})"

    @property
    def skill_display_name(self):
        """Used by serializers to show whichever skill label is available."""
        if self.custom_skill_name:
            return self.custom_skill_name
        if self.skill_id and self.skill:
            return self.skill.name
        return ''


class MentorshipMessage(models.Model):
    """Secure chat messages between a mentor and mentee."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team_member = models.ForeignKey(
        'TeamMember',
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mentorship_messages',
    )
    message = models.TextField()
    is_read_by_mentor = models.BooleanField(default=False)
    is_read_by_mentee = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['team_member', '-created_at'], name='core_mentor_msg_team_idx'),
        ]

    def __str__(self):
        return f"MentorshipMessage({self.team_member_id})"


class TeamSharedJob(models.Model):
    """Jobs shared with a team for collaborative review and feedback."""

    team = models.ForeignKey(
        TeamAccount,
        on_delete=models.CASCADE,
        related_name='shared_jobs',
    )
    job = models.ForeignKey(
        'JobEntry',
        on_delete=models.CASCADE,
        related_name='team_shares',
    )
    shared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='team_shared_jobs',
    )
    note = models.TextField(blank=True, help_text='Optional note when sharing')
    shared_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('team', 'job')]
        ordering = ['-shared_at']
        indexes = [
            models.Index(fields=['team', '-shared_at']),
        ]

    def __str__(self):
        return f"TeamSharedJob({self.team_id}, job={self.job_id})"


class TeamJobComment(models.Model):
    """Comments on jobs shared with the team."""

    shared_job = models.ForeignKey(
        TeamSharedJob,
        on_delete=models.CASCADE,
        related_name='comments',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='team_job_comments',
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['shared_job', 'created_at']),
        ]

    def __str__(self):
        return f"TeamJobComment({self.shared_job_id}, by={self.author_id})"


# 
# 
# =
# EMAIL INTEGRATION MODELS (UC-113)
# 
# 
# =


class GmailIntegration(models.Model):
    """UC-113: Gmail OAuth integration for email scanning"""
    
    STATUS_CHOICES = [
        ('disconnected', 'Disconnected'),
        ('pending', 'Pending Authorization'),
        ('connected', 'Connected'),
        ('scanning', 'Scanning'),
        ('error', 'Error'),
    ]
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='gmail_integration'
    )
    
    # OAuth tokens
    access_token = models.TextField(blank=True)
    refresh_token = models.TextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    scopes = models.JSONField(default=list, blank=True)
    
    # Gmail account info
    gmail_address = models.EmailField(blank=True)
    gmail_history_id = models.CharField(max_length=100, blank=True)  # For incremental sync
    
    # User preferences
    scan_enabled = models.BooleanField(default=False)
    
    # Scanning metadata
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='disconnected')
    last_scan_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    emails_scanned_count = models.IntegerField(default=0)
    rate_limit_reset_at = models.DateTimeField(null=True, blank=True, help_text='When the rate limit resets')
    
    # OAuth state token
    state_token = models.CharField(max_length=128, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['status', 'scan_enabled']),
        ]

    def __str__(self):
        return f"{self.user.email} - Gmail ({self.status})"


class ApplicationEmail(models.Model):
    """UC-113: Emails related to job applications"""
    
    EMAIL_TYPE_CHOICES = [
        ('application_sent', 'Application Sent'),
        ('acknowledgment', 'Application Acknowledged'),
        ('recruiter_outreach', 'Recruiter Outreach'),
        ('interview_invitation', 'Interview Invitation'),
        ('interview_confirmation', 'Interview Confirmation'),
        ('interview_reminder', 'Interview Reminder'),
        ('rejection', 'Rejection'),
        ('offer', 'Offer Letter'),
        ('follow_up', 'Follow-up'),
        ('other', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='application_emails'
    )
    job = models.ForeignKey(
        'JobEntry',
        on_delete=models.CASCADE,
        related_name='emails',
        null=True,
        blank=True
    )
    
    # Email metadata
    gmail_message_id = models.CharField(max_length=255, unique=True, db_index=True)
    thread_id = models.CharField(max_length=255, blank=True, db_index=True)
    
    # Email content
    subject = models.CharField(max_length=500)
    sender_email = models.EmailField()
    sender_name = models.CharField(max_length=255, blank=True)
    received_at = models.DateTimeField()
    snippet = models.TextField(blank=True)  # Email preview/snippet
    body_text = models.TextField(blank=True)  # Plain text body
    
    # Classification
    email_type = models.CharField(max_length=30, choices=EMAIL_TYPE_CHOICES, default='other')
    confidence_score = models.FloatField(default=0.0)  # 0-1 ML confidence
    is_application_related = models.BooleanField(default=False)
    
    # Status suggestions
    suggested_job_status = models.CharField(max_length=20, blank=True)  # From Application.STATUS
    status_applied = models.BooleanField(default=False)
    
    # User interaction
    is_linked = models.BooleanField(default=False)  # User confirmed link to job
    is_dismissed = models.BooleanField(default=False)  # User dismissed suggestion
    user_notes = models.TextField(blank=True)
    
    # Metadata
    labels = models.JSONField(default=list, blank=True)  # Gmail labels
    attachments = models.JSONField(default=list, blank=True)  # Attachment info
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', '-received_at']),
            models.Index(fields=['job', '-received_at']),
            models.Index(fields=['is_application_related', '-received_at']),
            models.Index(fields=['gmail_message_id']),
            models.Index(fields=['thread_id']),
        ]
        ordering = ['-received_at']

    def __str__(self):
        return f"{self.subject[:50]} - {self.sender_email}"


class EmailScanLog(models.Model):
    """UC-113: Audit log for email scanning operations"""
    
    integration = models.ForeignKey(
        'GmailIntegration',
        on_delete=models.CASCADE,
        related_name='scan_logs'
    )
    
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    emails_processed = models.IntegerField(default=0)
    emails_matched = models.IntegerField(default=0)
    emails_linked = models.IntegerField(default=0)
    
    status = models.CharField(max_length=20)  # success, partial, error
    error_message = models.TextField(blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['integration', '-started_at']),
        ]

    def __str__(self):
        return f"EmailScanLog({self.integration_id}, {self.status})"


# UC-117: API Rate Limiting and Error Handling Dashboard Models

class APIService(models.Model):
    """Configuration for tracked API services"""
    SERVICE_TYPES = [
        ('gemini', 'Google Gemini AI'),
        ('gmail', 'Gmail API'),
        ('google_calendar', 'Google Calendar'),
        ('google_contacts', 'Google Contacts'),
        ('linkedin', 'LinkedIn API'),
        ('github', 'GitHub API'),
        ('openai', 'OpenAI API'),
        ('market_data', 'Market Data APIs'),
        ('other', 'Other API Service'),
    ]
    
    name = models.CharField(max_length=100, unique=True)
    service_type = models.CharField(max_length=50, choices=SERVICE_TYPES)
    description = models.TextField(blank=True)
    
    # Rate limit configuration
    rate_limit_enabled = models.BooleanField(default=True)
    requests_per_minute = models.IntegerField(null=True, blank=True, help_text='Max requests per minute')
    requests_per_hour = models.IntegerField(null=True, blank=True, help_text='Max requests per hour')
    requests_per_day = models.IntegerField(null=True, blank=True, help_text='Max requests per day')
    
    # Alert thresholds (percentage of quota)
    alert_threshold_warning = models.IntegerField(default=75, help_text='Warning threshold %')
    alert_threshold_critical = models.IntegerField(default=90, help_text='Critical threshold %')
    
    # Service status
    is_active = models.BooleanField(default=True)
    last_error_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['service_type', 'is_active']),
            models.Index(fields=['-last_error_at']),
        ]
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({self.get_service_type_display()})"


class APIUsageLog(models.Model):
    """Log of all API requests for monitoring and analytics"""
    service = models.ForeignKey(APIService, on_delete=models.CASCADE, related_name='usage_logs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Request details
    endpoint = models.CharField(max_length=500, help_text='API endpoint called')
    method = models.CharField(max_length=10, default='GET')
    
    # Timing
    request_at = models.DateTimeField(auto_now_add=True, db_index=True)
    response_time_ms = models.IntegerField(null=True, blank=True, help_text='Response time in milliseconds')
    
    # Response details
    status_code = models.IntegerField(null=True, blank=True)
    success = models.BooleanField(default=True)
    
    # Error tracking
    error_message = models.TextField(blank=True)
    error_type = models.CharField(max_length=100, blank=True)
    
    # Additional context
    request_data = models.JSONField(default=dict, blank=True, help_text='Sanitized request data')
    response_data = models.JSONField(default=dict, blank=True, help_text='Sanitized response data')
    metadata = models.JSONField(default=dict, blank=True, help_text='Additional tracking metadata')
    
    class Meta:
        indexes = [
            models.Index(fields=['service', '-request_at']),
            models.Index(fields=['user', '-request_at']),
            models.Index(fields=['success', '-request_at']),
            models.Index(fields=['-request_at']),
        ]
        ordering = ['-request_at']
    
    def __str__(self):
        return f"{self.service.name} - {self.endpoint} ({self.status_code})"


class APIQuotaUsage(models.Model):
    """Aggregate quota usage per service per time period"""
    service = models.ForeignKey(APIService, on_delete=models.CASCADE, related_name='quota_usage')
    
    # Time period
    period_type = models.CharField(max_length=20, choices=[
        ('minute', 'Minute'),
        ('hour', 'Hour'),
        ('day', 'Day'),
        ('week', 'Week'),
        ('month', 'Month'),
    ])
    period_start = models.DateTimeField(db_index=True)
    period_end = models.DateTimeField()
    
    # Usage counts
    total_requests = models.IntegerField(default=0)
    successful_requests = models.IntegerField(default=0)
    failed_requests = models.IntegerField(default=0)
    
    # Performance metrics
    avg_response_time_ms = models.FloatField(null=True, blank=True)
    max_response_time_ms = models.IntegerField(null=True, blank=True)
    min_response_time_ms = models.IntegerField(null=True, blank=True)
    
    # Rate limit status
    quota_limit = models.IntegerField(null=True, blank=True)
    quota_remaining = models.IntegerField(null=True, blank=True)
    quota_percentage_used = models.FloatField(null=True, blank=True)
    
    # Alert status
    alert_level = models.CharField(max_length=20, choices=[
        ('normal', 'Normal'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
        ('exceeded', 'Exceeded'),
    ], default='normal')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['service', 'period_type', '-period_start']),
            models.Index(fields=['alert_level', '-period_start']),
        ]
        unique_together = [['service', 'period_type', 'period_start']]
        ordering = ['-period_start']
    
    def __str__(self):
        return f"{self.service.name} - {self.period_type} ({self.period_start.date()})"


class APIError(models.Model):
    """Detailed error tracking for API failures"""
    service = models.ForeignKey(APIService, on_delete=models.CASCADE, related_name='errors')
    usage_log = models.ForeignKey(APIUsageLog, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Error details
    error_type = models.CharField(max_length=100, db_index=True)
    error_message = models.TextField()
    error_code = models.CharField(max_length=50, blank=True)
    
    # Context
    endpoint = models.CharField(max_length=500)
    request_method = models.CharField(max_length=10)
    status_code = models.IntegerField(null=True, blank=True)
    
    # Error tracking
    occurred_at = models.DateTimeField(auto_now_add=True, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    is_resolved = models.BooleanField(default=False)
    
    # Impact assessment
    affected_users_count = models.IntegerField(default=0)
    retry_count = models.IntegerField(default=0)
    
    # Details for debugging
    stack_trace = models.TextField(blank=True)
    request_data = models.JSONField(default=dict, blank=True)
    response_data = models.JSONField(default=dict, blank=True)
    
    # Resolution tracking
    resolution_notes = models.TextField(blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='resolved_api_errors'
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['service', '-occurred_at']),
            models.Index(fields=['error_type', '-occurred_at']),
            models.Index(fields=['is_resolved', '-occurred_at']),
        ]
        ordering = ['-occurred_at']
    
    def __str__(self):
        return f"{self.service.name} - {self.error_type} at {self.occurred_at}"


class APIAlert(models.Model):
    """Alerts for API quota and error thresholds"""
    service = models.ForeignKey(APIService, on_delete=models.CASCADE, related_name='alerts')
    
    ALERT_TYPES = [
        ('quota_warning', 'Quota Warning'),
        ('quota_critical', 'Quota Critical'),
        ('quota_exceeded', 'Quota Exceeded'),
        ('high_error_rate', 'High Error Rate'),
        ('service_down', 'Service Down'),
        ('slow_response', 'Slow Response Time'),
    ]
    
    alert_type = models.CharField(max_length=50, choices=ALERT_TYPES)
    severity = models.CharField(max_length=20, choices=[
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    ])
    
    # Alert details
    message = models.TextField()
    details = models.JSONField(default=dict, blank=True)
    
    # Status
    triggered_at = models.DateTimeField(auto_now_add=True, db_index=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    is_acknowledged = models.BooleanField(default=False)
    is_resolved = models.BooleanField(default=False)
    
    # Notification tracking
    email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acknowledged_api_alerts'
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['service', '-triggered_at']),
            models.Index(fields=['alert_type', 'is_resolved']),
            models.Index(fields=['is_acknowledged', '-triggered_at']),
        ]
        ordering = ['-triggered_at']
    
    def __str__(self):
        return f"{self.get_alert_type_display()} - {self.service.name}"


class APIWeeklyReport(models.Model):
    """Weekly API usage summary reports"""
    
    # Report period
    week_start = models.DateField(db_index=True)
    week_end = models.DateField()
    
    # Overall statistics
    total_requests = models.IntegerField(default=0)
    total_errors = models.IntegerField(default=0)
    error_rate = models.FloatField(default=0.0, help_text='Error rate as percentage')
    
    # Performance metrics
    avg_response_time_ms = models.FloatField(default=0.0)
    
    # Service breakdown
    service_stats = models.JSONField(default=dict, help_text='Per-service statistics')
    
    # Top issues
    top_errors = models.JSONField(default=list, help_text='Most common errors')
    services_approaching_limit = models.JSONField(default=list, help_text='Services near quota')
    
    # Alerts summary
    total_alerts = models.IntegerField(default=0)
    critical_alerts = models.IntegerField(default=0)
    
    # Report metadata
    generated_at = models.DateTimeField(auto_now_add=True)
    email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    
    # Report content
    html_content = models.TextField(blank=True)
    summary_text = models.TextField(blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['-week_start']),
        ]
        unique_together = [['week_start', 'week_end']]
        ordering = ['-week_start']
    
    def __str__(self):
        return f"Weekly Report {self.week_start} to {self.week_end}"


class ScheduledSubmission(models.Model):
    """
    UC-124: Scheduled application submissions with timing optimization
    
    Allows users to schedule application submissions for future dates/times
    and track submission history with timing analytics.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('scheduled', 'Scheduled'),
        ('submitted', 'Submitted'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    candidate = models.ForeignKey(
        CandidateProfile,
        on_delete=models.CASCADE,
        related_name='scheduled_submissions'
    )
    job = models.ForeignKey(
        JobEntry,
        on_delete=models.CASCADE,
        related_name='scheduled_submissions'
    )
    application_package = models.ForeignKey(
        'ApplicationPackage',
        on_delete=models.CASCADE,
        related_name='scheduled_submissions',
        null=True,
        blank=True
    )
    
    # Scheduling details
    scheduled_datetime = models.DateTimeField(
        help_text='When to submit the application'
    )
    timezone = models.CharField(
        max_length=50,
        default='UTC',
        help_text="User's timezone for scheduling"
    )
    submission_method = models.CharField(
        max_length=50,
        default='email',
        help_text='How to submit (email, portal, etc.)'
    )
    
    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    priority = models.PositiveSmallIntegerField(
        default=5,
        help_text='Submission priority (1=highest)'
    )
    
    # Retry logic
    retry_count = models.PositiveSmallIntegerField(default=0)
    max_retries = models.PositiveSmallIntegerField(default=3)
    
    # Submission details
    submission_parameters = models.JSONField(
        default=dict,
        help_text='Parameters for submission'
    )
    submission_result = models.JSONField(
        default=dict,
        help_text='Result of submission attempt'
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    
    # Timing metadata for analytics
    day_of_week = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text='Day of week when submitted (0=Monday, 6=Sunday)'
    )
    hour_of_day = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text='Hour of day when submitted (0-23)'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['scheduled_datetime', 'priority']
        indexes = [
            models.Index(fields=['candidate', 'status']),
            models.Index(fields=['scheduled_datetime', 'status']),
            models.Index(fields=['job', 'status']),
            models.Index(fields=['candidate', 'day_of_week']),
            models.Index(fields=['candidate', 'hour_of_day']),
        ]
    
    def __str__(self):
        return f"Scheduled submission for {self.job.title} at {self.scheduled_datetime}"
    
    def save(self, *args, **kwargs):
        # Update timing metadata when submitted
        if self.status == 'submitted' and self.submitted_at:
            self.day_of_week = self.submitted_at.weekday()
            self.hour_of_day = self.submitted_at.hour
        super().save(*args, **kwargs)
    
    def mark_submitted(self):
        """Mark this submission as completed"""
        self.status = 'submitted'
        self.submitted_at = timezone.now()
        self.save(update_fields=['status', 'submitted_at', 'day_of_week', 'hour_of_day'])
        
        # Also update the job status
        if self.job.status == 'interested':
            self.job.status = 'applied'
            self.job.application_submitted_at = self.submitted_at
            self.job.save(update_fields=['status', 'application_submitted_at'])
            try:
                from core import followup_utils
                followup_utils.create_stage_followup(self.job, 'applied', auto=True)
            except Exception:
                # Scheduling reminders should not block submission updates
                pass
    
    def cancel(self, reason=''):
        """Cancel this scheduled submission"""
        self.status = 'cancelled'
        self.error_message = reason
        self.save(update_fields=['status', 'error_message'])


class FollowUpReminder(models.Model):
    """
    UC-124: Follow-up reminders for applications and deadlines
    
    Manages reminders for application deadlines, follow-ups, and other
    time-sensitive application-related tasks.
    """
    REMINDER_TYPES = [
        ('application_deadline', 'Application Deadline'),
        ('application_followup', 'Application Follow-up'),
        ('interview_followup', 'Interview Follow-up'),
        ('offer_response', 'Offer Response'),
        ('thank_you', 'Thank You Note'),
        ('status_inquiry', 'Status Inquiry'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('dismissed', 'Dismissed'),
        ('failed', 'Failed'),
    ]
    
    candidate = models.ForeignKey(
        CandidateProfile,
        on_delete=models.CASCADE,
        related_name='followup_reminders'
    )
    job = models.ForeignKey(
        JobEntry,
        on_delete=models.CASCADE,
        related_name='followup_reminders'
    )
    
    # Reminder details
    reminder_type = models.CharField(
        max_length=30,
        choices=REMINDER_TYPES
    )
    subject = models.CharField(
        max_length=200,
        help_text='Email subject or reminder title'
    )
    message_template = models.TextField(
        help_text='Template message with placeholders'
    )
    
    # Scheduling
    scheduled_datetime = models.DateTimeField(
        help_text='When to send the reminder'
    )
    interval_days = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text='Days between reminders for recurring'
    )
    is_recurring = models.BooleanField(default=False)
    max_occurrences = models.PositiveSmallIntegerField(
        default=1,
        help_text='Maximum times to send'
    )
    occurrence_count = models.PositiveSmallIntegerField(default=0)
    
    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    response_received = models.BooleanField(default=False)
    response_date = models.DateTimeField(null=True, blank=True)
    # Stage + automation context
    followup_stage = models.CharField(
        max_length=20,
        choices=JobEntry.STATUS_CHOICES,
        null=True,
        blank=True,
        help_text='Job stage when the reminder was created'
    )
    auto_scheduled = models.BooleanField(default=False)
    recommendation_reason = models.CharField(max_length=200, blank=True)
    snoozed_until = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['scheduled_datetime']
        indexes = [
            models.Index(fields=['candidate', 'status']),
            models.Index(fields=['scheduled_datetime', 'status']),
            models.Index(fields=['job', 'reminder_type']),
            models.Index(fields=['job', 'followup_stage']),
        ]
    
    def __str__(self):
        return f"{self.get_reminder_type_display()} for {self.job.title} at {self.scheduled_datetime}"
    
    def mark_sent(self):
        """Mark reminder as sent"""
        self.status = 'sent'
        self.sent_at = timezone.now()
        self.occurrence_count += 1
        self.completed_at = self.sent_at
        # Ensure we persist stage if it was not set
        if not self.followup_stage:
            self.followup_stage = getattr(self.job, 'status', None)
        self.save(update_fields=['status', 'sent_at', 'occurrence_count', 'completed_at', 'followup_stage', 'updated_at'])
        
        # Schedule next occurrence if recurring
        if self.is_recurring and self.occurrence_count < self.max_occurrences:
            next_reminder = FollowUpReminder.objects.create(
                candidate=self.candidate,
                job=self.job,
                reminder_type=self.reminder_type,
                subject=self.subject,
                message_template=self.message_template,
                scheduled_datetime=self.scheduled_datetime + timedelta(days=self.interval_days),
                interval_days=self.interval_days,
                is_recurring=True,
                max_occurrences=self.max_occurrences,
                occurrence_count=self.occurrence_count
            )
            return next_reminder
        return None
    
    def dismiss(self):
        """Dismiss this reminder"""
        self.status = 'dismissed'
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'completed_at', 'updated_at'])

    def snooze(self, new_datetime):
        """Snooze reminder to a new datetime."""
        self.scheduled_datetime = new_datetime
        self.snoozed_until = new_datetime
        if self.status != 'pending':
            self.status = 'pending'
        self.save(update_fields=['scheduled_datetime', 'snoozed_until', 'status', 'updated_at'])

    def mark_completed(self, response_received=False, response_date=None):
        """Mark reminder as completed and optionally record a response."""
        self.completed_at = timezone.now()
        self.response_received = response_received or self.response_received
        if response_received:
            self.response_date = response_date or timezone.now()
        if self.status == 'pending':
            self.status = 'sent'
        self.save(update_fields=[
            'status',
            'completed_at',
            'response_received',
            'response_date',
            'updated_at',
        ])


class CareerGrowthScenario(models.Model):
    """
    UC-128: Career Growth Calculator - Store salary growth projections and scenarios.
    
    Allows users to model different career paths with multiple job offers,
    including salary progression, promotions, and total compensation over time.
    """
    SCENARIO_TYPES = [
        ('conservative', 'Conservative Growth'),
        ('expected', 'Expected Growth'),
        ('optimistic', 'Optimistic Growth'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='career_scenarios')
    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, related_name='career_scenarios', null=True, blank=True)
    
    # Scenario details
    scenario_name = models.CharField(max_length=200, help_text="User-defined name for this scenario")
    scenario_type = models.CharField(max_length=20, choices=SCENARIO_TYPES, default='expected')
    
    # Starting compensation
    starting_salary = models.DecimalField(max_digits=12, decimal_places=2, help_text="Initial base salary")
    starting_bonus = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, default=0)
    starting_equity_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, default=0)
    
    # Growth assumptions
    annual_raise_percent = models.DecimalField(max_digits=5, decimal_places=2, help_text="Expected annual raise %")
    bonus_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, default=0, help_text="Annual bonus as % of salary")
    equity_refresh_annual = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, default=0)
    
    # Company and role details
    company_name = models.CharField(max_length=200, blank=True)
    job_title = models.CharField(max_length=200, blank=True)
    location = models.CharField(max_length=200, blank=True)
    
    # Career milestones (stored as JSON array)
    milestones = models.JSONField(
        default=list,
        blank=True,
        help_text="List of career milestones: [{year, title, salary_increase_percent, promotion_bonus, notes}]"
    )
    
    # Calculated projections (cached for performance)
    projections_5_year = models.JSONField(default=dict, blank=True, help_text="Year-by-year breakdown for 5 years")
    projections_10_year = models.JSONField(default=dict, blank=True, help_text="Year-by-year breakdown for 10 years")
    
    # Total compensation summaries
    total_comp_5_year = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    total_comp_10_year = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    
    # Non-financial considerations
    career_goals_notes = models.TextField(blank=True, help_text="Notes about non-financial career goals")
    work_life_balance_score = models.PositiveSmallIntegerField(null=True, blank=True, help_text="1-10 score")
    growth_opportunity_score = models.PositiveSmallIntegerField(null=True, blank=True, help_text="1-10 score")
    culture_fit_score = models.PositiveSmallIntegerField(null=True, blank=True, help_text="1-10 score")
    
    # Market data integration
    market_salary_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="External salary data from Glassdoor, etc."
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True, help_text="Active scenarios for comparison")
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['job']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.scenario_name} - {self.user.username}"
    
    def calculate_projections(self):
        """
        Calculate year-by-year salary and total compensation projections.
        Returns both 5-year and 10-year projections.
        """
        projections_5 = []
        projections_10 = []
        
        current_salary = float(self.starting_salary)
        annual_raise = float(self.annual_raise_percent) / 100
        bonus_rate = float(self.bonus_percent or 0) / 100
        
        # For simplicity, assume equity vests over 4 years
        equity_vesting_years = 4
        equity_per_year = float(self.starting_equity_value or 0) / equity_vesting_years if self.starting_equity_value else 0
        
        # Create milestone lookup
        milestone_map = {}
        for milestone in self.milestones:
            year = milestone.get('year')
            if year:
                milestone_map[year] = milestone
        
        for year in range(1, 11):
            # Check for milestone in this year
            milestone = milestone_map.get(year)
            
            if milestone:
                # Apply promotion/milestone adjustments
                salary_increase = milestone.get('salary_increase_percent', 0)
                current_salary *= (1 + salary_increase / 100)
                # Bonus can also change with milestone
                bonus_change = milestone.get('bonus_change', 0)
                bonus_rate += (bonus_change / 100)
            else:
                # Regular annual raise
                current_salary *= (1 + annual_raise)
            
            # Calculate annual bonus and equity
            annual_bonus = current_salary * bonus_rate
            annual_equity = equity_per_year if year <= equity_vesting_years else 0
            
            # Total compensation for this year
            total_comp = current_salary + annual_bonus + annual_equity
            
            year_data = {
                'year': year,
                'base_salary': round(current_salary, 2),
                'bonus': round(annual_bonus, 2),
                'equity': round(annual_equity, 2),
                'total_comp': round(total_comp, 2),
                'milestone': milestone.get('title', '') if milestone else '',
                'milestone_description': milestone.get('description', '') if milestone else '',
            }
            
            if year <= 5:
                projections_5.append(year_data)
            projections_10.append(year_data)
        
        # Calculate cumulative totals
        total_5_year = sum(p['total_comp'] for p in projections_5)
        total_10_year = sum(p['total_comp'] for p in projections_10)
        
        # Update the model
        self.projections_5_year = projections_5
        self.projections_10_year = projections_10
        self.total_comp_5_year = total_5_year
        self.total_comp_10_year = total_10_year
        self.save(update_fields=['projections_5_year', 'projections_10_year', 'total_comp_5_year', 'total_comp_10_year', 'updated_at'])
        
        return {
            '5_year': projections_5,
            '10_year': projections_10,
            'total_5_year': total_5_year,
            'total_10_year': total_10_year,
        }


class JobOffer(models.Model):
    """
    UC-127: Capture comparative job offer data for side-by-side analysis.

    Stores both financial and non-financial attributes so the frontend can
    render a weighted comparison matrix and scenario modeling.
    """
    REMOTE_POLICIES = [
        ('onsite', 'Onsite'),
        ('hybrid', 'Hybrid'),
        ('remote', 'Remote'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Decision Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('archived', 'Archived'),
    ]

    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name='job_offers')
    job = models.ForeignKey(JobEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='job_offers')
    role_title = models.CharField(max_length=220)
    company_name = models.CharField(max_length=220)
    location = models.CharField(max_length=200, blank=True)
    remote_policy = models.CharField(max_length=20, choices=REMOTE_POLICIES, default='onsite')

    base_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bonus = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    equity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    benefits_breakdown = models.JSONField(default=dict, blank=True)
    benefits_total_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    benefits_notes = models.TextField(blank=True)

    culture_fit_score = models.PositiveSmallIntegerField(null=True, blank=True, help_text='1-10 score')
    growth_opportunity_score = models.PositiveSmallIntegerField(null=True, blank=True, help_text='1-10 score')
    work_life_balance_score = models.PositiveSmallIntegerField(null=True, blank=True, help_text='1-10 score')

    cost_of_living_index = models.DecimalField(max_digits=6, decimal_places=2, default=100)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    decline_reason = models.CharField(max_length=120, blank=True)
    archived_reason = models.CharField(max_length=120, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    scenario_label = models.CharField(max_length=120, blank=True, help_text='Last scenario applied')
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['candidate', '-updated_at']),
            models.Index(fields=['candidate', 'status']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.role_title} @ {self.company_name} ({self.status})"
