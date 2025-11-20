"""
URL configuration for core app authentication endpoints.
"""
from django.urls import path, re_path
from core import views
from core import analytics_views

app_name = 'core'

urlpatterns = [
    # Authentication endpoints
    path('auth/register', views.register_user, name='register'),
    path('auth/login', views.login_user, name='login'),
    path('auth/verify-token', views.verify_token, name='verify-token'),
    path('auth/oauth/link', views.oauth_link_via_provider, name='oauth-link-provider'),
    # Back-compat route expected by tests
    path('auth/oauth/github', views.oauth_github, name='oauth-github'),
    path('auth/logout', views.logout_user, name='logout'),
    path('users/me', views.get_current_user, name='current-user'),
    path('users/me/delete-request', views.request_account_deletion, name='request-account-deletion'),
    path('users/profile', views.user_profile, name='user-profile'),
    path('users/<str:user_id>/profile', views.user_profile, name='user-profile-detail'),
    

    # Employment (Work Experience) endpoints
    path('profile/employment', views.employment_list_create, name='employment-list-create'),
    path('profile/employment/<int:pk>', views.employment_detail, name='employment-detail'),

    # Skills endpoints
    path('profile/skills', views.skills_list_create, name='skills-list-create'),
    path('profile/skills/<int:pk>', views.skills_detail, name='skills-detail'),

    # Profile endpoints (UC-021)
    path('profile/basic', views.update_basic_profile, name='basic-profile'),

    # Education endpoints
    path('profile/education', views.education_list_create, name='education-list-create'),
    path('profile/education/<int:education_id>', views.education_detail, name='education-detail'),

    # Projects endpoints
    path('profile/projects', views.projects_list_create, name='projects-list-create'),
    path('profile/projects/<int:pk>', views.projects_detail, name='projects-detail'),

    # UC-086: Contacts / Professional Network
    path('contacts', views.contacts_list_create, name='contacts-list-create'),
    path('contacts/<uuid:contact_id>', views.contact_detail, name='contact-detail'),
    path('contacts/<uuid:contact_id>/interactions', views.contact_interactions_list_create, name='contact-interactions'),
    path('contacts/<uuid:contact_id>/notes', views.contact_notes_list_create, name='contact-notes'),
    path('contacts/<uuid:contact_id>/reminders', views.contact_reminders_list_create, name='contact-reminders'),
    path('contacts/reminders/all', views.all_contact_reminders, name='all-contact-reminders'),
    path('contacts/reminders/<uuid:reminder_id>/dismiss', views.dismiss_contact_reminder, name='dismiss-contact-reminder'),
    path('contacts/import/start', views.contacts_import_start, name='contacts-import-start'),
    path('contacts/import/callback', views.contacts_import_callback, name='contacts-import-callback'),
    path('contacts/imports', views.import_jobs_list, name='contacts-imports-list'),
    path('contacts/import/<uuid:job_id>', views.import_job_detail, name='contacts-import-detail'),
    path('contacts/<uuid:contact_id>/mutuals', views.contact_mutuals, name='contact-mutuals'),
    path('contacts/<uuid:contact_id>/mutuals/<uuid:mutual_id>', views.delete_mutual_connection, name='delete-mutual-connection'),
    path('contacts/<uuid:contact_id>/company-links', views.contact_company_links, name='contact-company-links'),
    path('contacts/<uuid:contact_id>/company-links/<uuid:link_id>', views.delete_company_link, name='delete-company-link'),
    path('contacts/<uuid:contact_id>/job-links', views.contact_job_links, name='contact-job-links'),
    path('contacts/<uuid:contact_id>/job-links/<uuid:link_id>', views.delete_job_link, name='delete-job-link'),

    # UC-088: Networking Event Management
    path('networking-events', views.networking_events_list_create, name='networking-events-list-create'),
    path('networking-events/<uuid:event_id>', views.networking_event_detail, name='networking-event-detail'),
    path('networking-events/<uuid:event_id>/goals', views.event_goals_list_create, name='event-goals-list-create'),
    path('networking-events/<uuid:event_id>/goals/<uuid:goal_id>', views.event_goal_detail, name='event-goal-detail'),
    path('networking-events/<uuid:event_id>/connections', views.event_connections_list_create, name='event-connections-list-create'),
    path('networking-events/<uuid:event_id>/connections/<uuid:connection_id>', views.event_connection_detail, name='event-connection-detail'),
    path('networking-events/<uuid:event_id>/follow-ups', views.event_follow_ups_list_create, name='event-follow-ups-list-create'),
    path('networking-events/<uuid:event_id>/follow-ups/<uuid:follow_up_id>', views.event_follow_up_detail, name='event-follow-up-detail'),
    path('networking-events/<uuid:event_id>/follow-ups/<uuid:follow_up_id>/complete', views.event_follow_up_complete, name='event-follow-up-complete'),
    path('networking-events/analytics', views.networking_analytics, name='networking-analytics'),

    # Profile Picture endpoints (UC-022)
    path('profile/picture', views.get_profile_picture, name='get-profile-picture'),
    path('profile/picture/upload', views.upload_profile_picture, name='upload-profile-picture'),
    path('profile/picture/delete', views.delete_profile_picture, name='delete-profile-picture'),
    
    # Skills endpoints (UC-026)
    path('skills', views.skills_list_create, name='skills-list-create'),
    path('skills/<int:skill_id>', views.skill_detail, name='skill-detail'),
    path('skills/autocomplete', views.skills_autocomplete, name='skills-autocomplete'),
    path('skills/categories', views.skills_categories, name='skills-categories'),
    
    # Skills Category Organization endpoints (UC-027)
    path('skills/by-category', views.skills_by_category, name='skills-by-category'),
    path('skills/reorder', views.skills_reorder, name='skills-reorder'),
    path('skills/bulk-reorder', views.skills_bulk_reorder, name='skills-bulk-reorder'),
    path('skills/export', views.skills_export, name='skills-export'),

    # Education endpoints
    path('education/levels', views.education_levels, name='education-levels'),
    path('education', views.education_list_create, name='education-list-create'),
    path('education/<int:education_id>', views.education_detail, name='education-detail'),

    # Certifications endpoints (UC-030)
    path('certifications/categories', views.certification_categories, name='certification-categories'),
    path('certifications/orgs', views.certification_org_search, name='certification-org-search'),
    path('certifications', views.certifications_list_create, name='certifications-list-create'),
    path('certifications/<int:certification_id>', views.certification_detail, name='certification-detail'),

    # Projects endpoints (UC-031)
    path('projects', views.projects_list_create, name='projects-list-create'),
    path('projects/<int:project_id>', views.project_detail, name='project-detail'),
    path('projects/<int:project_id>/media', views.project_media_upload, name='project-media-upload'),
    path('projects/<int:project_id>/media/<int:media_id>', views.project_media_delete, name='project-media-delete'),

    # Employment History endpoints (UC-023, UC-024, UC-025)
    path('employment', views.employment_list_create, name='employment-list-create'),
    path('employment/<int:employment_id>', views.employment_detail, name='employment-detail'),
    path('employment/timeline', views.employment_timeline, name='employment-timeline'),

    # Account Deletion confirmation (email link landing)
    path('auth/delete/confirm/<str:token>', views.confirm_account_deletion, name='confirm-account-deletion'),

    # UC-036: Jobs endpoints
    path('jobs', views.jobs_list_create, name='jobs-list-create'),
    path('jobs/<int:job_id>', views.job_detail, name='job-detail'),
    # SCRUM-39: Job import from URL
    path('jobs/import-from-url', views.import_job_from_url, name='import-job-from-url'),
    path('jobs/stats', views.jobs_stats, name='jobs-stats'),
    path('jobs/analytics', analytics_views.cover_letter_analytics_view, name='cover-letter-analytics'),
    path('jobs/bulk-status', views.jobs_bulk_status, name='jobs-bulk-status'),
    path('jobs/bulk-deadline', views.jobs_bulk_deadline, name='jobs-bulk-deadline'),
    path('jobs/upcoming-deadlines', views.jobs_upcoming_deadlines, name='jobs-upcoming-deadlines'),
    # UC-042: Application Materials endpoints
    path('documents/', views.documents_list, name='documents-list'),
    path('documents/<int:doc_id>/', views.document_delete, name='document-delete'),
    path('documents/<int:doc_id>/download/', views.document_download, name='document-download'),
    path('jobs/<int:job_id>/materials/', views.job_materials, name='job-materials'),
    path('materials/defaults/', views.materials_defaults, name='materials-defaults'),
    path('materials/analytics/', views.materials_analytics, name='materials-analytics'),
    
    # UC-045: Job archiving endpoints
    path('jobs/<int:job_id>/archive', views.job_archive, name='job-archive'),
    path('jobs/<int:job_id>/restore', views.job_restore, name='job-restore'),
    path('jobs/<int:job_id>/delete', views.job_delete, name='job-delete'),
    path('jobs/bulk-archive', views.jobs_bulk_archive, name='jobs-bulk-archive'),
    
    # UC-055: Cover Letter Template Library endpoints
    path('cover-letter-templates', views.cover_letter_template_list_create, name='cover-letter-template-list-create'),
    path('cover-letter-templates/<uuid:pk>', views.cover_letter_template_detail, name='cover-letter-template-detail'),
    path('cover-letter-templates/import', views.cover_letter_template_import, name='cover-letter-template-import'),
    path('cover-letter-templates/<uuid:pk>/customize', views.cover_letter_template_customize, name='cover-letter-template-customize'),
    path('cover-letter-templates/<uuid:pk>/share', views.cover_letter_template_share, name='cover-letter-template-share'),
    path('cover-letter-templates/<uuid:pk>/analytics', views.cover_letter_template_analytics, name='cover-letter-template-analytics'),
    path('cover-letter-templates/<uuid:pk>/download/<str:format_type>', views.cover_letter_template_download, name='cover-letter-template-download'),
    path('cover-letter-templates/stats', views.cover_letter_template_stats, name='cover-letter-template-stats'),
    path('jobs/bulk-restore', views.jobs_bulk_restore, name='jobs-bulk-restore'),
    
    # UC-043: Company information endpoints
    path('companies/search', views.company_search, name='company-search'),
    path('companies/<str:company_name>', views.company_info, name='company-info'),
    path('jobs/<int:job_id>/company', views.job_company_info, name='job-company-info'),
    # UC-047: AI resume generation
    path('jobs/<int:job_id>/resume/generate', views.generate_resume_for_job, name='job-resume-generate'),
    path('jobs/<int:job_id>/resume/tailor-experience/<int:experience_id>', views.tailor_experience_variations, name='tailor-experience'),
    path('jobs/<int:job_id>/resume/tailor-experience/<int:experience_id>/bullet', views.tailor_experience_bullet, name='tailor-experience-bullet'),
    path('resume/compile-latex/', views.compile_latex_to_pdf, name='compile-latex-to-pdf'),
    # UC-056: AI cover letter generation
    path('jobs/<int:job_id>/cover-letter/generate', views.generate_cover_letter_for_job, name='job-cover-letter-generate'),
    path('cover-letter/compile-latex/', views.compile_latex_to_pdf, name='cover-letter-compile-latex-to-pdf'),
    # UC-069: Application package generation
    path('jobs/<int:job_id>/generate-package/', views.generate_application_package, name='job-generate-package'),
    # UC-061: Cover letter export
    path('cover-letter/export-docx/', views.export_cover_letter_docx, name='cover-letter-export-docx'),
    path('cover-letter/export/ai', views.export_ai_cover_letter, name='export-ai-cover-letter'),
    
    # UC-051: Resume export endpoints
    path('resume/export/themes', views.resume_export_themes, name='resume-export-themes'),
    path('resume/export', views.resume_export, name='resume-export'),
    # Ensure exact-match export route is available for tests and clients
    re_path(r'^resume/export$', views.resume_export, name='resume-export-exact'),
    path('resume/export/ai', views.export_ai_resume, name='export-ai-resume'),
    
    # UC-063: Automated Company Research endpoints
    path('companies/<str:company_name>/research', views.automated_company_research, name='automated-company-research'),
    path('companies/<str:company_name>/research/report', views.company_research_report, name='company-research-report'),
    path('companies/<str:company_name>/research/refresh', views.refresh_company_research, name='refresh-company-research'),
    
    # UC-067: Salary Research and Benchmarking endpoints
    path('jobs/<int:job_id>/salary-research/', views.salary_research, name='salary-research'),
    path('jobs/<int:job_id>/salary-research/export/', views.salary_research_export, name='salary-research-export'),
    
    # UC-060: Grammar and Spell Checking endpoints
    path('cover-letter/check-grammar/', views.check_grammar, name='check-grammar'),
    path('cover-letter/apply-grammar-fix/', views.apply_grammar_fix, name='apply-grammar-fix'),
    
    # UC-068: Interview Insights and Preparation endpoints
    path('jobs/<int:job_id>/interview-insights/', views.job_interview_insights, name='job-interview-insights'),
    path('jobs/<int:job_id>/preparation-checklist/', views.job_preparation_checklist_toggle, name='job-preparation-checklist'),
    # UC-075: Role-specific question bank endpoints
    path('jobs/<int:job_id>/question-bank/', views.job_question_bank, name='job-question-bank'),
    path('jobs/<int:job_id>/question-bank/practice/', views.job_question_practice, name='job-question-practice'),
    path('jobs/<int:job_id>/question-bank/practice/<str:question_id>/', views.get_question_practice_history, name='get-question-practice-history'),
    path('jobs/<int:job_id>/question-bank/coach/', views.job_question_response_coach, name='job-question-response-coach'),
    
    # UC-066: Skills Gap Analysis endpoints
    path('jobs/<int:job_id>/skills-gap/', views.job_skills_gap, name='job-skills-gap'),
    path('skills/<int:skill_id>/progress/', views.skill_progress, name='skill-progress'),
    
    # UC-065: Job Matching Algorithm endpoints
    path('jobs/<int:job_id>/match-score/', views.job_match_score, name='job-match-score'),
    path('jobs/match-scores/', views.bulk_job_match_scores, name='bulk-job-match-scores'),
    
    # UC-071: Interview Scheduling endpoints
    path('interviews/', views.interview_list_create, name='interview-list-create'),
    path('interviews/<int:pk>/', views.interview_detail, name='interview-detail'),
    path('interviews/<int:pk>/complete/', views.interview_complete, name='interview-complete'),
    path('interviews/<int:pk>/dismiss-reminder/', views.dismiss_interview_reminder, name='dismiss-interview-reminder'),
    path('interviews/reminders/', views.active_interview_reminders, name='active-interview-reminders'),
    path('interviews/tasks/<int:pk>/toggle/', views.toggle_preparation_task, name='toggle-preparation-task'),
    
    # UC-081: Pre-Interview Preparation Checklist endpoints
    path('interviews/<int:pk>/checklist/', views.preparation_checklist_for_interview, name='preparation-checklist'),
    path('interviews/<int:pk>/checklist/toggle/', views.toggle_checklist_item, name='toggle-checklist-item'),
    
    # UC-052: Resume Version Management endpoints
    path('resume-versions/', views.resume_versions_list_create, name='resume-versions-list-create'),
    path('resume-versions/<uuid:version_id>/', views.resume_version_detail, name='resume-version-detail'),
    path('resume-versions/<uuid:version_id>/set-default/', views.resume_version_set_default, name='resume-version-set-default'),
    path('resume-versions/<uuid:version_id>/archive/', views.resume_version_archive, name='resume-version-archive'),
    path('resume-versions/<uuid:version_id>/restore/', views.resume_version_restore, name='resume-version-restore'),
    path('resume-versions/<uuid:version_id>/duplicate/', views.resume_version_duplicate, name='resume-version-duplicate'),
    path('resume-versions/<uuid:version_id>/history/', views.resume_version_history, name='resume-version-history'),
    path('resume-versions/compare/', views.resume_version_compare, name='resume-version-compare'),
    path('resume-versions/merge/', views.resume_version_merge, name='resume-version-merge'),
    
    # UC-069: Application Workflow Automation endpoints
    path('automation/rules/', views.automation_rules_list_create, name='automation-rules-list-create'),
    path('automation/rules/<uuid:rule_id>/', views.automation_rule_detail, name='automation-rule-detail'),
    path('automation/rules/<uuid:rule_id>/trigger/', views.trigger_automation_rule, name='trigger-automation-rule'),
    path('automation/logs/', views.automation_logs, name='automation-logs'),
    path('automation/packages/', views.application_packages_list, name='application-packages-list'),
    path('automation/scheduled-submissions/', views.automation_logs, name='automation-scheduled-submissions'),
    
    # UC-052: Resume Sharing and Feedback endpoints
    path('resume-shares/', views.resume_share_list_create, name='resume-share-list-create'),
    path('resume-shares/<uuid:share_id>/', views.resume_share_detail, name='resume-share-detail'),
    path('shared-resume/<str:share_token>/', views.shared_resume_view, name='shared-resume-view'),
    path('feedback/', views.feedback_list, name='feedback-list'),
    path('feedback/create/', views.create_feedback, name='create-feedback'),
    path('feedback/<uuid:feedback_id>/', views.feedback_detail, name='feedback-detail'),
    path('comments/create/', views.create_comment, name='create-comment'),
    path('comments/<uuid:comment_id>/', views.comment_detail, name='comment-detail'),
    path('feedback-notifications/', views.feedback_notifications, name='feedback-notifications'),
    path('feedback-notifications/<uuid:notification_id>/read/', views.mark_notification_read, name='mark-notification-read'),
    path('feedback/export/', views.export_feedback_summary, name='export-feedback-summary'),
]
