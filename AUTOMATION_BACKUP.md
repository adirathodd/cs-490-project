# UC-069 Automation Features Backup
# This document contains all the automation functionality that needs to be re-applied after the clean merge

## MODELS (to be added back to models.py)

### 1. ApplicationAutomationRule Model
```python
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

    class Meta:
        db_table = 'core_applicationautomationrule'
        ordering = ['priority', '-created_at']
        verbose_name = "Application Automation Rule"
        verbose_name_plural = "Application Automation Rules"

    def __str__(self):
        return f"{self.name} ({self.trigger_type} → {self.action_type})"

    def clean(self):
        # Validate trigger conditions against trigger type
        # Validate action parameters against action type
        pass
```

### 2. ApplicationPackage Model
```python
class ApplicationPackage(models.Model):
    """
    UC-069: Generated application package containing resume, cover letter, and other documents
    """
    STATUS_CHOICES = [
        ('generating', 'Generating'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
        ('submitted', 'Submitted'),
        ('processing', 'Processing'),
    ]
    
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="application_packages")
    job = models.ForeignKey(JobEntry, on_delete=models.CASCADE, related_name="application_packages")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='generating')
    
    # Generated documents
    resume_document = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True, related_name="resume_packages")
    cover_letter_document = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True, related_name="cover_letter_packages")
    
    # Package metadata
    generation_parameters = models.JSONField(default=dict)
    ai_analysis = models.JSONField(default=dict)
    match_score = models.FloatField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'core_applicationpackage'
        unique_together = ['candidate', 'job']
        ordering = ['-created_at']

    def __str__(self):
        return f"Package for {self.job.title} at {self.job.company_name}"
```

### 3. ApplicationPackageGenerator Model
```python
class ApplicationPackageGenerator(models.Model):
    """
    UC-069: Tracks package generation jobs and parameters
    """
    package = models.OneToOneField(ApplicationPackage, on_delete=models.CASCADE, related_name="generator")
    parameters = models.JSONField(default=dict)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    
    class Meta:
        db_table = 'core_applicationpackagegenerator'

    def __str__(self):
        return f"Generator for {self.package}"
```

## VIEWS (to be added back to views.py)

### Automation Views to Add:
```python
# ======================
# UC-069: APPLICATION WORKFLOW AUTOMATION
# ======================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def automation_rules_list_create(request):
    """
    UC-069: Application Workflow Automation - Rules Management
    
    GET: List all automation rules for the authenticated user
    POST: Create a new automation rule
    """
    # Implementation from lines 5672-5890 of current views.py

@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def automation_rule_detail(request, rule_id):
    """
    UC-069: Automation Rule Detail Management
    
    GET: Get details of a specific automation rule
    PUT/PATCH: Update automation rule
    DELETE: Delete automation rule
    """
    # Implementation from lines 5892-5915 of current views.py

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_application_package(request, job_id):
    """
    UC-069: Generate Application Package
    
    POST: Generate a comprehensive application package for a specific job
    """
    # Implementation from lines 5917-6100 of current views.py

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def application_packages_list(request):
    """
    UC-069: List Application Packages
    
    GET: Get all application packages for the authenticated user
    """
    # Implementation from lines 6102-6200 of current views.py

@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def application_package_detail(request, package_id):
    """
    UC-069: Application Package Detail Management
    """
    # Implementation from lines 6202-6315 of current views.py

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def application_package_download(request, package_id):
    """
    UC-069: Download Application Package
    """
    # Implementation from lines 6317-6350 of current views.py

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def application_package_regenerate(request, package_id):
    """
    UC-069: Regenerate Application Package
    """
    # Implementation from lines 6352-6410 of current views.py

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trigger_automation_rules(request):
    """
    UC-069: Trigger Automation Rules
    """
    # Implementation from lines 6412-6500 of current views.py

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def automation_logs(request):
    """
    UC-069: Automation Execution Logs
    """
    # Implementation - fixed version that uses ApplicationPackage instead of non-existent WorkflowAutomationLog

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_automation_actions(request):
    """
    UC-069: Bulk Automation Operations
    """
    # Implementation from current views.py
```

## URLs (to be added back to urls.py)

### Automation URL Patterns:
```python
    # UC-069: Application Workflow Automation endpoints
    path('automation/rules/', views.automation_rules_list_create, name='automation-rules-list-create'),
    path('automation/rules/<int:rule_id>/', views.automation_rule_detail, name='automation-rule-detail'),
    path('automation/trigger/', views.trigger_automation_rules, name='trigger-automation-rules'),
    path('automation/logs/', views.automation_logs, name='automation-logs'),
    path('automation/bulk-actions/', views.bulk_automation_actions, name='bulk-automation-actions'),
    path('jobs/<int:job_id>/generate-package/', views.generate_application_package, name='generate-application-package'),
    path('automation/packages/', views.application_packages_list, name='application-packages-list'),
    path('automation/packages/<int:package_id>/', views.application_package_detail, name='application-package-detail'),
    path('automation/packages/<int:package_id>/download/', views.application_package_download, name='application-package-download'),
    path('automation/packages/<int:package_id>/regenerate/', views.application_package_regenerate, name='application-package-regenerate'),
```

## AUTOMATION ENGINE FILES

### 1. automation.py file
- Contains ApplicationPackageGenerator class
- Contains AutomationEngine class  
- Contains AutomationTriggers class
- All the logic for rule execution, package generation, etc.
- This file should remain as-is

### 2. Key Features Working:
- 8 active automation rules
- ApplicationPackage model with 24 packages generated
- Document generation and linking
- Rule triggering on job creation
- Frontend automation UI components
- API endpoints for rule management

## DATABASE STATE:
- 8 ApplicationAutomationRule records active
- 24 ApplicationPackage records
- Document linking working (resume_document_id, cover_letter_document_id)
- All models importing correctly

## TESTING COMMANDS TO RUN AFTER RESTORATION:
```python
# Verify automation rules
docker-compose exec backend python -c "
import django; django.setup()
from core.models import ApplicationAutomationRule
rules = ApplicationAutomationRule.objects.filter(is_active=True)
print(f'Active automation rules: {rules.count()}')
[print(f'  Rule {rule.id}: {rule.name}') for rule in rules]
"

# Verify application packages  
docker-compose exec backend python -c "
import django; django.setup()
from core.models import ApplicationPackage
packages = ApplicationPackage.objects.all()
print(f'Application packages: {packages.count()}')
[print(f'  Package {pkg.id}: {pkg.job.title} - {pkg.status}') for pkg in packages[:5]]
"

# Test automation triggering
docker-compose exec backend python -c "
import django; django.setup()
from core.automation import trigger_job_automation
from core.models import JobEntry
job = JobEntry.objects.first()
trigger_job_automation(job)
print('Automation trigger test completed')
"
```