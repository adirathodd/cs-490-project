"""
URL configuration for core app authentication endpoints.
"""
from django.urls import path, re_path
from core import views
from core import analytics_views
from core import market_views
from core import team_views
from core import api_monitoring_views

# app_name = 'core'  # Removed to avoid namespace issues with reverse() in tests

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
    # GitHub OAuth connect/callback (UC-114)
    path('github/connect/', views.github_connect, name='github_connect'),
    path('github/callback/', views.github_callback, name='github_callback'),
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
    path('contacts/maintenance/overview', views.relationship_maintenance_overview, name='contacts-maintenance-overview'),
    path('contacts/maintenance/generate-reminders', views.generate_check_in_reminders, name='contacts-maintenance-generate'),
    path('contacts/<uuid:contact_id>/outreach', views.log_personalized_outreach, name='contact-outreach'),
    path('contacts/<uuid:contact_id>/mutuals', views.contact_mutuals, name='contact-mutuals'),
    path('contacts/<uuid:contact_id>/mutuals/<uuid:mutual_id>', views.delete_mutual_connection, name='delete-mutual-connection'),
    path('contacts/<uuid:contact_id>/company-links', views.contact_company_links, name='contact-company-links'),
    path('contacts/<uuid:contact_id>/company-links/<uuid:link_id>', views.delete_company_link, name='delete-company-link'),
    path('contacts/<uuid:contact_id>/job-links', views.contact_job_links, name='contact-job-links'),
    path('contacts/<uuid:contact_id>/job-links/<uuid:link_id>', views.delete_job_link, name='delete-job-link'),

    # UC-079: Calendar integrations
    path('calendar/integrations/', views.calendar_integrations, name='calendar-integrations'),
    path('calendar/integrations/<str:provider>/', views.calendar_integration_update, name='calendar-integration-update'),
    path('calendar/google/start', views.calendar_google_connect_start, name='calendar-google-start'),
    path('calendar/google/callback', views.calendar_google_callback, name='calendar-google-callback'),
    path('calendar/google/disconnect', views.calendar_google_disconnect, name='calendar-google-disconnect'),
    path('calendar/google/events', views.calendar_google_events, name='calendar-google-events'),

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

    # UC-092: Industry Contact Discovery
    path('contact-suggestions', views.contact_suggestions_list_create, name='contact-suggestions-list-create'),
    path('contact-suggestions/<uuid:pk>', views.contact_suggestion_detail, name='contact-suggestion-detail'),
    path('contact-suggestions/<uuid:pk>/convert', views.contact_suggestion_convert_to_contact, name='contact-suggestion-convert'),
    path('discovery-searches', views.discovery_searches_list_create, name='discovery-searches-list-create'),
    path('discovery-searches/<uuid:pk>', views.discovery_search_detail, name='discovery-search-detail'),
    path('discovery/analytics', views.discovery_analytics, name='discovery-analytics'),

    # Supporters (family/friends) access
    path('supporters', views.supporter_invites, name='supporter-invites'),
    path('supporters/<int:invite_id>', views.supporter_invite_detail, name='supporter-invite-detail'),
    path('supporters/dashboard', views.supporter_dashboard, name='supporter-dashboard'),
    path('supporters/encouragements', views.supporter_encouragement, name='supporter-encouragement'),
    path('supporters/encouragements/list', views.supporter_encouragements_for_candidate, name='supporter-encouragements-for-candidate'),
    path('supporters/chat', views.supporter_chat, name='supporter-chat'),
    path('supporters/chat/candidate', views.supporter_chat_candidate, name='supporter-chat-candidate'),
    path('supporters/mood', views.supporter_mood, name='supporter-mood'),

    # Mentorship & collaboration
    path('mentorship/requests', views.mentorship_requests_view, name='mentorship-requests'),
    path('mentorship/requests/<uuid:request_id>/respond', views.respond_to_mentorship_request, name='mentorship-request-respond'),
    path('mentorship/requests/<uuid:request_id>/cancel', views.cancel_mentorship_request, name='mentorship-request-cancel'),
    path('mentorship/relationships', views.mentorship_relationships, name='mentorship-relationships'),
    path('mentorship/relationships/<int:team_member_id>/sharing', views.mentorship_sharing_preferences_view, name='mentorship-sharing-preferences'),
    path('mentorship/relationships/<int:team_member_id>/shared-data', views.mentorship_shared_data, name='mentorship-shared-data'),
    path('mentorship/relationships/<int:team_member_id>/goals', views.mentorship_goals, name='mentorship-goals'),
    path('mentorship/relationships/<int:team_member_id>/analytics', views.mentorship_relationship_analytics, name='mentorship-relationship-analytics'),
    path('mentorship/goals/<uuid:goal_id>', views.mentorship_goal_detail, name='mentorship-goal-detail'),
    path('mentorship/relationships/<int:team_member_id>/progress-report', views.mentorship_progress_report, name='mentorship-progress-report'),
    path('mentorship/relationships/<int:team_member_id>/messages', views.mentorship_messages, name='mentorship-messages'),

    # Team accounts & collaboration
    path('team/accounts', team_views.team_accounts, name='team-accounts'),
    path('team/my-invites', team_views.my_pending_invites, name='team-my-invites'),
    path('team/my-shareable-jobs', team_views.my_shareable_jobs, name='team-my-shareable-jobs'),
    path('team/accounts/<int:team_id>', team_views.team_account_detail, name='team-account-detail'),
    path('team/accounts/<int:team_id>/subscription', team_views.team_subscription_update, name='team-subscription-update'),
    path('team/accounts/<int:team_id>/invites', team_views.team_invites, name='team-invites'),
    path('team/invites/<str:token>/accept', team_views.team_accept_invite, name='team-accept-invite'),
    path('team/memberships/<int:membership_id>', team_views.team_membership_detail, name='team-membership-detail'),
    path('team/accounts/<int:team_id>/access', team_views.team_candidate_access, name='team-candidate-access'),
    path('team/accounts/<int:team_id>/dashboard', team_views.team_dashboard, name='team-dashboard'),
    path('team/accounts/<int:team_id>/messages', team_views.team_messages, name='team-messages'),
    path('team/accounts/<int:team_id>/reports', team_views.team_reports, name='team-reports'),
    path('team/accounts/<int:team_id>/shared-jobs', team_views.team_shared_jobs, name='team-shared-jobs'),
    path('team/accounts/<int:team_id>/share-job', team_views.share_job_with_team, name='team-share-job'),
    path('team/accounts/<int:team_id>/shared-jobs/<int:shared_job_id>', team_views.unshare_job_from_team, name='team-unshare-job'),
    path('team/accounts/<int:team_id>/shared-jobs/<int:shared_job_id>/comments', team_views.shared_job_comments, name='team-shared-job-comments'),
    path('team/accounts/<int:team_id>/shared-jobs/<int:shared_job_id>/comments/<int:comment_id>', team_views.delete_shared_job_comment, name='team-delete-shared-job-comment'),

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
    path('jobs/competitive-analysis', analytics_views.competitive_analysis_view, name='competitive-analysis'),
    path('productivity/analytics', analytics_views.productivity_analytics_view, name='productivity-analytics'),
    path('jobs/success-analysis', views.application_success_analysis, name='application-success-analysis'),  # UC-097
    path('jobs/analytics/goals', analytics_views.update_application_targets_view, name='analytics-goals'),
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
    path('cover-letter/save-document/', views.save_ai_cover_letter_document, name='cover-letter-save-document'),
    
    # UC-051: Resume export endpoints
    path('resume/export/themes', views.resume_export_themes, name='resume-export-themes'),
    path('resume/export', views.resume_export, name='resume-export'),
    # Ensure exact-match export route is available for tests and clients
    re_path(r'^resume/export$', views.resume_export, name='resume-export-exact'),
    path('resume/export/ai', views.export_ai_resume, name='export-ai-resume'),

    # UC-114: GitHub integration
    path('github/connect/', views.github_connect, name='github-connect'),
    path('github/callback/', views.github_callback, name='github-callback'),
    path('github/repos/', views.github_repos, name='github-repos'),
    path('github/featured/', views.github_featured_repositories, name='github-featured'),
        path('github/contrib/summary/', views.github_contributions_summary, name='github-contrib-summary'),
        path('github/contrib/commits/', views.github_total_commits, name='github_total_commits'),
        path('github/contrib/commits-by-repo/', views.github_commits_by_repo, name='github_commits_by_repo'),
    path('github/disconnect/', views.github_disconnect, name='github-disconnect'),
    
    # UC-063: Automated Company Research endpoints
    path('companies/<str:company_name>/research', views.automated_company_research, name='automated-company-research'),
    path('companies/<str:company_name>/research/report', views.company_research_report, name='company-research-report'),
    path('companies/<str:company_name>/research/refresh', views.refresh_company_research, name='refresh-company-research'),
    
    # UC-067: Salary Research and Benchmarking endpoints
    path('jobs/<int:job_id>/salary-research/', views.salary_research, name='salary-research'),
    path('jobs/<int:job_id>/salary-research/export/', views.salary_research_export, name='salary-research-export'),
    path('jobs/<int:job_id>/salary-negotiation/', views.salary_negotiation_prep, name='salary-negotiation-prep'),
    path('jobs/<int:job_id>/salary-negotiation/outcomes/', views.salary_negotiation_outcomes, name='salary-negotiation-outcomes'),
    path('jobs/<int:job_id>/salary-negotiation/outcomes/<int:outcome_id>/', views.salary_negotiation_outcome_detail, name='salary-negotiation-outcome-detail'),
    
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
    # UC-078: Technical interview preparation endpoints
    path('jobs/<int:job_id>/technical-prep/', views.job_technical_prep, name='job-technical-prep'),
    path('jobs/<int:job_id>/technical-prep/practice/', views.job_technical_prep_practice, name='job-technical-prep-practice'),
    
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
    path('interviews/events/', views.interview_events_list_create, name='interview-events-list-create'),
    path('interviews/events/<int:pk>/', views.interview_event_detail, name='interview-event-detail'),
    path('interviews/success-forecast/', views.interview_success_forecast, name='interview-success-forecast'),
    path('interviews/performance-analytics/', views.interview_performance_analytics, name='interview-performance-analytics'),  # UC-080
    path('interviews/performance-tracking/', views.interview_performance_tracking, name='interview-performance-tracking'),  # UC-098

    # UC-081: Pre-Interview Preparation Checklist endpoints
    path('interviews/<int:pk>/checklist/', views.preparation_checklist_for_interview, name='preparation-checklist'),
    path('interviews/<int:pk>/checklist/toggle/', views.toggle_checklist_item, name='toggle-checklist-item'),
    
    # UC-082: Interview Follow-Up Templates
    path('interviews/follow-up/generate/', views.generate_interview_followup, name='generate-interview-followup'),

    # UC-101: Career Goals endpoints
    path('career-goals/', views.career_goals_list_create, name='career-goals-list-create'),
    path('career-goals/<uuid:pk>/', views.career_goal_detail, name='career-goal-detail'),
    path('career-goals/<uuid:pk>/update-progress/', views.update_goal_progress, name='update-goal-progress'),
    path('career-goals/<uuid:pk>/complete/', views.complete_goal, name='complete-goal'),
    path('career-goals/<uuid:goal_pk>/milestones/', views.goal_milestones_list_create, name='goal-milestones-list-create'),
    path('career-goals/<uuid:goal_pk>/milestones/<uuid:milestone_pk>/', views.goal_milestone_detail, name='goal-milestone-detail'),
    path('career-goals/<uuid:goal_pk>/milestones/<uuid:milestone_pk>/complete/', views.complete_milestone, name='complete-milestone'),
    path('career-goals/analytics/', views.career_goals_analytics, name='career-goals-analytics'),

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
    path('resume-shares/reviewer/', views.reviewer_resume_shares, name='resume-share-reviewer'),
    path('resume-shares/reviewer/stats/', views.reviewer_feedback_stats, name='reviewer-feedback-stats'),
    path('shared-resume/<str:share_token>/', views.shared_resume_view, name='shared-resume-view'),
    path('shared-resume/<str:share_token>/pdf/', views.shared_resume_pdf, name='shared-resume-pdf'),
    path('feedback/', views.feedback_list, name='feedback-list'),
    path('feedback/create/', views.create_feedback, name='create-feedback'),
    path('feedback/<uuid:feedback_id>/', views.feedback_detail, name='feedback-detail'),
    path('comments/create/', views.create_comment, name='create-comment'),
    path('comments/<uuid:comment_id>/', views.comment_detail, name='comment-detail'),
    path('feedback-notifications/', views.feedback_notifications, name='feedback-notifications'),
    path('feedback-notifications/<uuid:notification_id>/read/', views.mark_notification_read, name='mark-notification-read'),
    path('feedback/export/', views.export_feedback_summary, name='export-feedback-summary'),
    
    # UC-095: Professional Reference Management endpoints
    path('references/', views.references_list_create, name='references-list-create'),
    path('references/<uuid:reference_id>/', views.reference_detail, name='reference-detail'),
    path('references/<uuid:reference_id>/check-in/', views.reference_check_in, name='reference-check-in'),
    path('references/requests/', views.reference_requests_list_create, name='reference-requests-list-create'),
    path('references/requests/<uuid:request_id>/', views.reference_request_detail, name='reference-request-detail'),
    path('references/requests/<uuid:request_id>/mark-sent/', views.reference_request_mark_sent, name='reference-request-mark-sent'),
    path('references/requests/<uuid:request_id>/mark-completed/', views.reference_request_mark_completed, name='reference-request-mark-completed'),
    path('references/templates/', views.reference_templates_list_create, name='reference-templates-list-create'),
    path('references/templates/<uuid:template_id>/', views.reference_template_detail, name='reference-template-detail'),
    path('references/appreciations/', views.reference_appreciations_list_create, name='reference-appreciations-list-create'),
    path('references/appreciations/<uuid:appreciation_id>/', views.reference_appreciation_detail, name='reference-appreciation-detail'),
    path('references/portfolios/', views.reference_portfolios_list_create, name='reference-portfolios-list-create'),
    path('references/portfolios/<uuid:portfolio_id>/', views.reference_portfolio_detail, name='reference-portfolio-detail'),
    path('references/analytics/', views.reference_analytics, name='reference-analytics'),
    path('references/preparation-guide/', views.generate_reference_preparation_guide, name='reference-preparation-guide'),
    # UC-087: Referral management (minimal dev stubs)
    path('referrals', views.referrals_list_create, name='referrals-list-create'),
    path('referrals/analytics', views.referrals_analytics, name='referrals-analytics'),
    path('referrals/generate-message', views.referrals_generate_message, name='referrals-generate-message'),
    path('referrals/<str:referral_id>', views.referral_detail, name='referral-detail'),
    path('referrals/<str:referral_id>/mark-sent', views.referral_mark_sent, name='referral-mark-sent'),
    path('referrals/<str:referral_id>/response', views.referral_mark_response, name='referral-response'),
    path('referrals/<str:referral_id>/complete', views.referral_mark_completed, name='referral-complete'),
    path('referrals/<str:referral_id>/uncomplete', views.referral_unmark_completed, name='referral-uncomplete'),
    path('referrals/<str:referral_id>/express-gratitude', views.referral_express_gratitude, name='referral-express-gratitude'),
    path('referrals/<str:referral_id>/suggest-follow-up', views.referral_suggest_follow_up, name='referral-suggest-follow-up'),
    path('referrals/<str:referral_id>/outcome', views.referral_update_outcome, name='referral-update-outcome'),

    # UC-102: Market Intelligence
    path('market-intelligence/', market_views.market_intelligence_view, name='market-intelligence'),

    
    # UC-095: Professional Reference Management endpoints
    path('references/', views.references_list_create, name='references-list-create'),
    path('references/<uuid:reference_id>/', views.reference_detail, name='reference-detail'),
    path('references/<uuid:reference_id>/check-in/', views.reference_check_in, name='reference-check-in'),
    path('references/requests/', views.reference_requests_list_create, name='reference-requests-list-create'),
    path('references/requests/<uuid:request_id>/', views.reference_request_detail, name='reference-request-detail'),
    path('references/requests/<uuid:request_id>/mark-sent/', views.reference_request_mark_sent, name='reference-request-mark-sent'),
    path('references/requests/<uuid:request_id>/mark-completed/', views.reference_request_mark_completed, name='reference-request-mark-completed'),
    path('references/templates/', views.reference_templates_list_create, name='reference-templates-list-create'),
    path('references/templates/<uuid:template_id>/', views.reference_template_detail, name='reference-template-detail'),
    path('references/appreciations/', views.reference_appreciations_list_create, name='reference-appreciations-list-create'),
    path('references/appreciations/<uuid:appreciation_id>/', views.reference_appreciation_detail, name='reference-appreciation-detail'),
    path('references/portfolios/', views.reference_portfolios_list_create, name='reference-portfolios-list-create'),
    path('references/portfolios/<uuid:portfolio_id>/', views.reference_portfolio_detail, name='reference-portfolio-detail'),
    path('references/analytics/', views.reference_analytics, name='reference-analytics'),
    path('references/preparation-guide/', views.generate_reference_preparation_guide, name='reference-preparation-guide'),
    # UC-087: Referral management (minimal dev stubs)
    path('referrals', views.referrals_list_create, name='referrals-list-create'),
    path('referrals/analytics', views.referrals_analytics, name='referrals-analytics'),
    path('referrals/generate-message', views.referrals_generate_message, name='referrals-generate-message'),
    path('referrals/<str:referral_id>', views.referral_detail, name='referral-detail'),
    path('referrals/<str:referral_id>/mark-sent', views.referral_mark_sent, name='referral-mark-sent'),
    path('referrals/<str:referral_id>/response', views.referral_mark_response, name='referral-response'),
    path('referrals/<str:referral_id>/complete', views.referral_mark_completed, name='referral-complete'),
    path('referrals/<str:referral_id>/uncomplete', views.referral_unmark_completed, name='referral-uncomplete'),
    path('referrals/<str:referral_id>/express-gratitude', views.referral_express_gratitude, name='referral-express-gratitude'),
    path('referrals/<str:referral_id>/suggest-follow-up', views.referral_suggest_follow_up, name='referral-suggest-follow-up'),
    path('referrals/<str:referral_id>/outcome', views.referral_update_outcome, name='referral-update-outcome'),

    # UC-077: Mock Interview Practice Sessions
    path('mock-interviews/start', views.start_mock_interview, name='mock-interview-start'),
    path('mock-interviews/answer', views.submit_mock_interview_answer, name='mock-interview-answer'),
    path('mock-interviews/complete', views.complete_mock_interview, name='mock-interview-complete'),
    path('mock-interviews', views.list_mock_interviews, name='mock-interviews-list'),
    path('mock-interviews/<int:session_id>', views.get_mock_interview_session, name='mock-interview-detail'),
    path('mock-interviews/<int:session_id>/summary', views.get_mock_interview_summary, name='mock-interview-summary'),
    path('mock-interviews/<int:session_id>/delete', views.delete_mock_interview_session, name='mock-interview-delete'),

    # UC-090: Informational Interview Management
    path('informational-interviews/analytics', views.informational_interviews_analytics, name='informational-interviews-analytics'),
    path('informational-interviews', views.informational_interviews_list_create, name='informational-interviews-list-create'),
    path('informational-interviews/<uuid:pk>', views.informational_interviews_detail, name='informational-interviews-detail'),
    path('informational-interviews/<uuid:pk>/mark-outreach-sent', views.informational_interviews_mark_outreach_sent, name='informational-interviews-mark-outreach-sent'),
    path('informational-interviews/<uuid:pk>/mark-scheduled', views.informational_interviews_mark_scheduled, name='informational-interviews-mark-scheduled'),
    path('informational-interviews/<uuid:pk>/mark-completed', views.informational_interviews_mark_completed, name='informational-interviews-mark-completed'),
    path('informational-interviews/<uuid:pk>/generate-outreach', views.informational_interviews_generate_outreach, name='informational-interviews-generate-outreach'),
    path('informational-interviews/<uuid:pk>/generate-preparation', views.informational_interviews_generate_preparation, name='informational-interviews-generate-preparation'),

    # UC-089: LinkedIn Integration and Guidance
    path('auth/oauth/linkedin/initiate', views.linkedin_oauth_initiate, name='linkedin-oauth-initiate'),
    path('auth/oauth/linkedin/callback', views.linkedin_oauth_callback, name='linkedin-oauth-callback'),
    path('linkedin/profile-optimization', views.linkedin_profile_optimization, name='linkedin-profile-optimization'),
    path('linkedin/networking-message', views.linkedin_networking_message, name='linkedin-networking-message'),
    path('linkedin/content-strategy', views.linkedin_content_strategy, name='linkedin-content-strategy'),
    path('linkedin/integration-status', views.linkedin_integration_status, name='linkedin-integration-status'),

    # UC-113: Email Integration for Application Tracking
    path('gmail/oauth/start/', views.gmail_oauth_start, name='gmail-oauth-start'),
    path('gmail/oauth/callback/', views.gmail_oauth_callback, name='gmail-oauth-callback'),
    path('gmail/status/', views.gmail_integration_status, name='gmail-status'),
    path('gmail/disconnect/', views.gmail_disconnect, name='gmail-disconnect'),
    path('gmail/enable-scanning/', views.gmail_enable_scanning, name='gmail-enable-scanning'),
    path('gmail/preferences/', views.gmail_update_preferences, name='gmail-update-preferences'),
    path('gmail/scan/', views.gmail_scan_now, name='gmail-scan'),
    path('gmail/scan-now/', views.gmail_scan_now, name='gmail-scan-now'),
    path('gmail/scan-logs/', views.gmail_scan_logs, name='gmail-scan-logs'),
    path('emails/', views.application_emails_list, name='application-emails-list'),
    path('emails/<uuid:email_id>/', views.application_email_detail, name='application-email-detail'),
    path('emails/<uuid:email_id>/link/', views.link_email_to_job, name='link-email-to-job'),
    path('emails/<uuid:email_id>/apply-status/', views.apply_email_status_suggestion, name='apply-email-status'),
    path('emails/<uuid:email_id>/dismiss/', views.dismiss_email, name='dismiss-email'),

    # UC-117: API Rate Limiting and Error Handling Dashboard
    path('admin/api-monitoring/dashboard/', api_monitoring_views.api_monitoring_dashboard, name='api-monitoring-dashboard'),
    path('admin/api-monitoring/services/', api_monitoring_views.api_service_list, name='api-service-list'),
    path('admin/api-monitoring/services/<int:service_id>/', api_monitoring_views.api_service_detail, name='api-service-detail'),
    path('admin/api-monitoring/usage-logs/', api_monitoring_views.api_usage_logs, name='api-usage-logs'),
    path('admin/api-monitoring/errors/', api_monitoring_views.api_error_logs, name='api-error-logs'),
    path('admin/api-monitoring/alerts/', api_monitoring_views.api_alerts, name='api-alerts'),
    path('admin/api-monitoring/alerts/<int:alert_id>/acknowledge/', api_monitoring_views.acknowledge_alert, name='acknowledge-alert'),
    path('admin/api-monitoring/alerts/<int:alert_id>/resolve/', api_monitoring_views.resolve_alert, name='resolve-alert'),
    path('admin/api-monitoring/weekly-reports/', api_monitoring_views.api_weekly_reports, name='api-weekly-reports'),
    path('admin/api-monitoring/weekly-reports/<int:report_id>/', api_monitoring_views.api_weekly_report_detail, name='api-weekly-report-detail'),

]
