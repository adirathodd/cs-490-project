from django.conf import settings
from django.db import models


class CandidateProfile(models.Model):
    """Extended profile information for a Django auth user."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    headline = models.CharField(max_length=255, blank=True)
    bio = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    years_experience = models.PositiveIntegerField(null=True, blank=True)
    job_search_status = models.CharField(max_length=100, blank=True)

    def __str__(self) -> str:
        return self.user.get_full_name() or self.user.username


class Skill(models.Model):
    name = models.CharField(max_length=120, unique=True)

    def __str__(self) -> str:
        return self.name


class CandidateSkill(models.Model):
    class Proficiency(models.IntegerChoices):
        BEGINNER = 1, "Beginner"
        INTERMEDIATE = 2, "Intermediate"
        ADVANCED = 3, "Advanced"
        EXPERT = 4, "Expert"

    profile = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="skills")
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name="candidates")
    proficiency = models.IntegerField(choices=Proficiency.choices, default=Proficiency.BEGINNER)
    years_used = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("profile", "skill")

    def __str__(self) -> str:
        return f"{self.profile} - {self.skill}"


class CandidateExperience(models.Model):
    profile = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="experiences")
    title = models.CharField(max_length=200)
    company = models.CharField(max_length=200)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=False)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self) -> str:
        return f"{self.title} at {self.company}"


class CandidatePreference(models.Model):
    profile = models.OneToOneField(CandidateProfile, on_delete=models.CASCADE, related_name="preferences")
    desired_role = models.CharField(max_length=200, blank=True)
    desired_location = models.CharField(max_length=200, blank=True)
    salary_min = models.PositiveIntegerField(null=True, blank=True)
    salary_max = models.PositiveIntegerField(null=True, blank=True)
    remote = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"Preferences for {self.profile}"


class JobOpportunity(models.Model):
    title = models.CharField(max_length=200)
    company = models.CharField(max_length=200)
    location = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    application_url = models.URLField(blank=True)
    source = models.CharField(max_length=120, blank=True)
    salary_range = models.CharField(max_length=120, blank=True)
    posted_at = models.DateField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.title} at {self.company}"


class Application(models.Model):
    class Status(models.TextChoices):
        INTERESTED = "interested", "Interested"
        APPLIED = "applied", "Applied"
        INTERVIEW = "interview", "Interview"
        OFFER = "offer", "Offer"
        REJECTED = "rejected", "Rejected"
        WITHDRAWN = "withdrawn", "Withdrawn"

    profile = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="applications")
    job = models.ForeignKey(JobOpportunity, on_delete=models.CASCADE, related_name="applications")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.INTERESTED)
    applied_at = models.DateTimeField(null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ("profile", "job")

    def __str__(self) -> str:
        return f"{self.profile} -> {self.job} ({self.status})"


class ApplicationStatusHistory(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="history")
    from_status = models.CharField(max_length=20, choices=Application.Status.choices)
    to_status = models.CharField(max_length=20, choices=Application.Status.choices)
    changed_at = models.DateTimeField(auto_now_add=True)
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-changed_at"]

    def __str__(self) -> str:
        return f"{self.application} {self.from_status} -> {self.to_status}"


class Document(models.Model):
    class DocumentType(models.TextChoices):
        RESUME = "resume", "Resume"
        COVER_LETTER = "cover_letter", "Cover Letter"
        PORTFOLIO = "portfolio", "Portfolio"
        OTHER = "other", "Other"

    profile = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="documents")
    name = models.CharField(max_length=200)
    document_type = models.CharField(max_length=50, choices=DocumentType.choices)
    file = models.FileField(upload_to="documents/")
    version = models.PositiveIntegerField(default=1)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ("profile", "name", "version")
        ordering = ["-uploaded_at"]

    def __str__(self) -> str:
        return f"{self.name} v{self.version}"


class DocumentUsage(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="usage_records")
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="documents")
    used_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("document", "application")

    def __str__(self) -> str:
        return f"{self.document} used for {self.application}"


class AnalyticsSnapshot(models.Model):
    profile = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="analytics_snapshots")
    metric = models.CharField(max_length=120)
    value = models.FloatField()
    period_start = models.DateField()
    period_end = models.DateField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("profile", "metric", "period_start", "period_end")
        ordering = ["-period_end", "metric"]

    def __str__(self) -> str:
        return f"{self.profile} - {self.metric} ({self.period_start} to {self.period_end})"
