# backend/core/automation.py
"""
UC-069: Application Workflow Automation Engine

This module provides the core automation functionality for job applications,
including package generation, scheduling, and workflow management.
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from django.utils import timezone
from django.db import transaction
from django.conf import settings

from .models import (
    JobEntry, CandidateProfile, ApplicationPackage, ApplicationAutomationRule,
    ScheduledSubmission, FollowUpReminder, ApplicationChecklist,
    ChecklistTask, BulkOperation, WorkflowAutomationLog, Document, CoverLetterTemplate
)
from .job_matching import JobMatchingEngine

logger = logging.getLogger(__name__)


class ApplicationPackageGenerator:
    """
    UC-069: Automatically generate application packages (resume + cover letter + portfolio)
    based on job requirements and user preferences.
    """
    
    @staticmethod
    def generate_package(job: JobEntry, candidate: CandidateProfile, 
                        parameters: Dict[str, Any] = None) -> ApplicationPackage:
        """
        Generate a complete application package for a job.
        
        Args:
            job: The job to generate package for
            candidate: The candidate profile
            parameters: Optional generation parameters
        
        Returns:
            ApplicationPackage: The generated package
        """
        try:
            logger.info(f"Generating application package for job {job.id} and candidate {candidate.id}")
            
            # Get or create existing package
            package, created = ApplicationPackage.objects.get_or_create(
                job=job,
                candidate=candidate,
                defaults={
                    'status': 'generating',
                    'generation_parameters': parameters or {},
                }
            )
            
            if not created and package.status == 'ready':
                logger.info(f"Package already exists and is ready: {package.id}")
                return package
            
            # Update status to generating
            package.status = 'generating'
            package.generation_parameters = parameters or {}
            package.save()
            
            # Calculate match score for package metadata
            try:
                match_result = JobMatchingEngine.calculate_match_score(job, candidate)
                package.match_score = match_result.get('overall_score', 0)
            except Exception as e:
                logger.warning(f"Failed to calculate match score: {e}")
                package.match_score = None
            
            # Generate resume
            resume_doc = ApplicationPackageGenerator._generate_resume(
                job, candidate, parameters
            )
            if resume_doc:
                package.resume_document = resume_doc
                logger.info(f"Linked resume document {resume_doc.id} to package {package.id}")
            
            # Generate cover letter
            cover_letter_doc = ApplicationPackageGenerator._generate_cover_letter(
                job, candidate, parameters
            )
            if cover_letter_doc:
                package.cover_letter_document = cover_letter_doc
                logger.info(f"Linked cover letter document {cover_letter_doc.id} to package {package.id}")
            
            # Set portfolio URL if available
            package.portfolio_url = candidate.portfolio_url or ""
            
            # Mark as ready and save all changes
            package.status = 'ready'
            package.save()
            
            logger.info(f"Successfully generated application package {package.id} with resume: {package.resume_document.id if package.resume_document else None}, cover letter: {package.cover_letter_document.id if package.cover_letter_document else None}")
            return package
            
        except Exception as e:
            logger.error(f"Failed to generate application package: {e}")
            if 'package' in locals():
                package.status = 'failed'
                package.save()
            raise
    
    @staticmethod
    def _generate_resume(job: JobEntry, candidate: CandidateProfile, 
                        parameters: Dict[str, Any]) -> Optional[Document]:
        """Generate or select appropriate resume for the job."""
        try:
            # First try to use default resume if available
            if candidate.default_resume_doc:
                logger.info(f"Using default resume document {candidate.default_resume_doc.id}")
                return candidate.default_resume_doc
            
            # Generate AI resume using the same logic as the existing views
            logger.info(f"Generating AI resume for job {job.id}")
            
            from core import resume_ai
            from core.models import Document
            from django.conf import settings
            
            api_key = getattr(settings, 'GEMINI_API_KEY', '')
            if not api_key:
                logger.error("GEMINI_API_KEY not configured for AI resume generation")
                return None
            
            # Collect candidate and job data (same as in generate_resume_for_job view)
            candidate_snapshot = resume_ai.collect_candidate_snapshot(candidate)
            job_snapshot = resume_ai.build_job_snapshot(job)
            
            # Generate AI content using existing resume AI logic
            generation = resume_ai.run_resume_generation(
                candidate_snapshot,
                job_snapshot,
                tone='balanced',  # Use default tone for automation
                variation_count=1,  # Generate one variation for automation
                api_key=api_key,
                model=getattr(settings, 'GEMINI_MODEL', None),
            )
            
            # Extract the generated content
            if generation and 'variations' in generation and len(generation['variations']) > 0:
                first_variation = generation['variations'][0]
                logger.info(f"AI generation result keys: {list(first_variation.keys())}")
                
                # Create document with actual file content
                # Get the next version number to avoid duplicate key constraint
                existing_docs = Document.objects.filter(
                    candidate=candidate,
                    doc_type='resume'
                ).order_by('-version')
                next_version = (existing_docs.first().version + 1) if existing_docs.exists() else 1
                
                document = Document.objects.create(
                    candidate=candidate,
                    doc_type='resume',
                    document_name=f"AI_Resume_{job.company_name}_{job.title}",
                    version=next_version,
                    generated_by_ai=True,
                    notes=f"AI-generated resume for {job.title} at {job.company_name}"
                )
                
                # Save the actual content as a file
                import tempfile
                import os
                from django.core.files.base import ContentFile
                
                # Prefer PDF if available
                if first_variation.get('pdf_document'):
                    try:
                        import base64
                        pdf_content = first_variation['pdf_document']
                        logger.info(f"Found PDF content, length: {len(pdf_content) if pdf_content else 'None'}")
                        
                        # If it's base64 encoded, decode it
                        if isinstance(pdf_content, str) and pdf_content:
                            pdf_bytes = base64.b64decode(pdf_content)
                        else:
                            pdf_bytes = pdf_content
                            
                        # Save as PDF file
                        filename = f"resume_{candidate.id}_{job.id}_{document.id}.pdf"
                        document.file.save(filename, ContentFile(pdf_bytes), save=True)
                        document.content_type = 'application/pdf'
                        document.file_size = len(pdf_bytes)
                        document.save()
                        
                        logger.info(f"Created AI-generated PDF resume document {document.id}")
                        return document
                        
                    except Exception as pdf_error:
                        logger.error(f"Failed to save PDF content: {pdf_error}")
                        # Fall through to LaTeX fallback
                
                # Use LaTeX document as fallback
                if first_variation.get('latex_document'):
                    try:
                        latex_content = first_variation['latex_document']
                        logger.info(f"Found LaTeX content, length: {len(latex_content) if latex_content else 'None'}")
                        
                        # Save as LaTeX file
                        filename = f"resume_{candidate.id}_{job.id}_{document.id}.tex"
                        if isinstance(latex_content, str):
                            latex_bytes = latex_content.encode('utf-8')
                        else:
                            latex_bytes = latex_content
                            
                        document.file.save(filename, ContentFile(latex_bytes), save=True)
                        document.content_type = 'application/x-tex'
                        document.file_size = len(latex_bytes)
                        document.save()
                        
                        logger.info(f"Created AI-generated LaTeX resume document {document.id}")
                        return document
                        
                    except Exception as latex_error:
                        logger.error(f"Failed to save LaTeX content: {latex_error}")
                
                # If we get here, we couldn't save any content
                logger.error(f"No usable content found in AI generation result. Available keys: {list(first_variation.keys())}")
                document.delete()  # Clean up the empty document
                return None
            
            logger.warning(f"AI resume generation returned no usable content")
            return None
            
        except Exception as e:
            logger.error(f"Failed to generate AI resume: {e}")
            # Log more details about the error
            logger.error(f"Resume generation error details: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Resume generation traceback: {traceback.format_exc()}")
            return None
            
        except Exception as e:
            logger.error(f"Failed to generate resume: {e}")
            return None

    @staticmethod
    def _generate_cover_letter(job: JobEntry, candidate: CandidateProfile,
                             parameters: Dict[str, Any]) -> Optional[Document]:
        """Generate or select appropriate cover letter for the job."""
        try:
            # First try to use default cover letter if available
            if candidate.default_cover_letter_doc:
                logger.info(f"Using default cover letter document {candidate.default_cover_letter_doc.id}")
                return candidate.default_cover_letter_doc
            
            # Generate AI cover letter using the same logic as the existing views
            logger.info(f"Generating AI cover letter for job {job.id}")
            
            from core import cover_letter_ai, resume_ai
            from core.models import Document
            from django.conf import settings
            
            api_key = getattr(settings, 'GEMINI_API_KEY', '')
            if not api_key:
                logger.error("GEMINI_API_KEY not configured for AI cover letter generation")
                return None
            
            # Collect data (same as in generate_cover_letter_for_job view)
            candidate_snapshot = resume_ai.collect_candidate_snapshot(candidate)
            job_snapshot = resume_ai.build_job_snapshot(job)
            research_snapshot = cover_letter_ai.build_company_research_snapshot(job.company_name)
            
            # Generate AI content using existing cover letter AI logic
            generation = cover_letter_ai.run_cover_letter_generation(
                candidate_snapshot,
                job_snapshot,
                research_snapshot,
                tone='balanced',  # Use default tone for automation
                variation_count=1,  # Generate one variation for automation
                api_key=api_key,
                model=getattr(settings, 'GEMINI_MODEL', None),
            )
            
            # Extract the generated content
            if generation and 'variations' in generation and len(generation['variations']) > 0:
                first_variation = generation['variations'][0]
                logger.info(f"AI cover letter generation result keys: {list(first_variation.keys())}")
                
                # Create document with actual file content
                # Get the next version number to avoid duplicate key constraint
                existing_docs = Document.objects.filter(
                    candidate=candidate,
                    doc_type='cover_letter'
                ).order_by('-version')
                next_version = (existing_docs.first().version + 1) if existing_docs.exists() else 1
                
                document = Document.objects.create(
                    candidate=candidate,
                    doc_type='cover_letter',
                    document_name=f"AI_CoverLetter_{job.company_name}_{job.title}",
                    version=next_version,
                    generated_by_ai=True,
                    notes=f"AI-generated cover letter for {job.title} at {job.company_name}"
                )
                
                # Save the actual content as a file
                from django.core.files.base import ContentFile
                
                # Try PDF first
                if first_variation.get('pdf_document'):
                    try:
                        import base64
                        pdf_content = first_variation['pdf_document']
                        logger.info(f"Found PDF cover letter content, length: {len(pdf_content) if pdf_content else 'None'}")
                        
                        # If it's base64 encoded, decode it
                        if isinstance(pdf_content, str) and pdf_content:
                            pdf_bytes = base64.b64decode(pdf_content)
                        else:
                            pdf_bytes = pdf_content
                            
                        # Save as PDF file
                        filename = f"cover_letter_{candidate.id}_{job.id}_{document.id}.pdf"
                        document.file.save(filename, ContentFile(pdf_bytes), save=True)
                        document.content_type = 'application/pdf'
                        document.file_size = len(pdf_bytes)
                        document.save()
                        
                        logger.info(f"Created AI-generated PDF cover letter document {document.id}")
                        return document
                        
                    except Exception as pdf_error:
                        logger.error(f"Failed to save PDF cover letter: {pdf_error}")
                        # Fall through to LaTeX/text fallback
                
                # Try LaTeX document
                if first_variation.get('latex_document'):
                    try:
                        latex_content = first_variation['latex_document']
                        logger.info(f"Found LaTeX cover letter content, length: {len(latex_content) if latex_content else 'None'}")
                        
                        # Save as LaTeX file
                        filename = f"cover_letter_{candidate.id}_{job.id}_{document.id}.tex"
                        if isinstance(latex_content, str):
                            latex_bytes = latex_content.encode('utf-8')
                        else:
                            latex_bytes = latex_content
                            
                        document.file.save(filename, ContentFile(latex_bytes), save=True)
                        document.content_type = 'application/x-tex'
                        document.file_size = len(latex_bytes)
                        document.save()
                        
                        logger.info(f"Created AI-generated LaTeX cover letter document {document.id}")
                        return document
                        
                    except Exception as latex_error:
                        logger.error(f"Failed to save LaTeX cover letter: {latex_error}")
                
                # Fallback to plain text
                if first_variation.get('full_text'):
                    try:
                        text_content = first_variation['full_text']
                        logger.info(f"Found text cover letter content, length: {len(text_content) if text_content else 'None'}")
                        
                        # Save as text file
                        filename = f"cover_letter_{candidate.id}_{job.id}_{document.id}.txt"
                        if isinstance(text_content, str):
                            text_bytes = text_content.encode('utf-8')
                        else:
                            text_bytes = text_content
                            
                        document.file.save(filename, ContentFile(text_bytes), save=True)
                        document.content_type = 'text/plain'
                        document.file_size = len(text_bytes)
                        document.save()
                        
                        logger.info(f"Created AI-generated text cover letter document {document.id}")
                        return document
                        
                    except Exception as text_error:
                        logger.error(f"Failed to save text cover letter: {text_error}")
                
                # If we get here, we couldn't save any content
                logger.error(f"No usable content found in AI cover letter generation result. Available keys: {list(first_variation.keys())}")
                document.delete()  # Clean up the empty document
                return None
            
            logger.warning(f"AI cover letter generation returned no usable content")
            return None
            
        except Exception as e:
            logger.error(f"Failed to generate AI cover letter: {e}")
            # Log more details about the error
            logger.error(f"Cover letter generation error details: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Cover letter generation traceback: {traceback.format_exc()}")
            return None
            
        except Exception as e:
            logger.error(f"Failed to generate cover letter: {e}")
            return None
class AutomationEngine:
    """
    UC-069: Core automation engine that executes rules and manages workflows.
    """
    
    @staticmethod
    def trigger_rules(trigger_type: str, context: Dict[str, Any]):
        """
        Execute automation rules based on triggers.
        
        Args:
            trigger_type: Type of trigger (new_job, match_score, etc.)
            context: Context data for the trigger
        """
        try:
            # Get candidate from context
            candidate_id = context.get('candidate_id')
            if not candidate_id:
                logger.warning(f"No candidate_id in trigger context: {context}")
                return
            
            candidate = CandidateProfile.objects.get(id=candidate_id)
            
            # Find matching active rules
            rules = ApplicationAutomationRule.objects.filter(
                candidate=candidate,
                trigger_type=trigger_type,
                is_active=True
            ).order_by('priority')
            
            logger.info(f"Found {len(rules)} rules to execute for trigger {trigger_type}")
            
            for rule in rules:
                try:
                    if AutomationEngine._should_execute_rule(rule, context):
                        AutomationEngine._execute_rule(rule, context)
                except Exception as e:
                    logger.error(f"Failed to execute rule {rule.id}: {e}")
                    # Create serializable context for logging (remove non-serializable objects)
                    log_context = {k: v for k, v in context.items() if k not in ['job']}
                    WorkflowAutomationLog.objects.create(
                        candidate=candidate,
                        automation_rule=rule,
                        level='error',
                        message=f"Rule execution failed: {str(e)}",
                        context=log_context
                    )
        
        except Exception as e:
            logger.error(f"Failed to process automation triggers: {e}")
    
    @staticmethod
    def _should_execute_rule(rule: ApplicationAutomationRule, context: Dict[str, Any]) -> bool:
        """Check if a rule should be executed based on its conditions."""
        try:
            conditions = rule.trigger_conditions or {}
            
            # Check match score threshold if specified
            if 'min_match_score' in conditions:
                match_score = context.get('match_score', 0)
                if match_score < conditions['min_match_score']:
                    return False
            
            # Check job type filter if specified
            if 'job_types' in conditions:
                job_type = context.get('job_type')
                if job_type and job_type not in conditions['job_types']:
                    return False
            
            # Check industry filter if specified
            if 'industries' in conditions:
                industry = context.get('industry')
                if industry and industry not in conditions['industries']:
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to evaluate rule conditions: {e}")
            return False
    
    @staticmethod
    def _execute_rule(rule: ApplicationAutomationRule, context: Dict[str, Any]):
        """Execute a specific automation rule."""
        try:
            action_type = rule.action_type
            parameters = rule.action_parameters or {}
            
            logger.info(f"Executing rule {rule.id}: {action_type}")
            
            if action_type == 'generate_package':
                AutomationEngine._execute_generate_package(rule, context, parameters)
            elif action_type == 'generate_application_package':
                AutomationEngine._execute_generate_package(rule, context, parameters)
            elif action_type == 'create_deadline_reminder':
                AutomationEngine._execute_create_deadline_reminder(rule, context, parameters)
            elif action_type == 'schedule_application':
                AutomationEngine._execute_schedule_application(rule, context, parameters)
            elif action_type == 'send_followup':
                AutomationEngine._execute_send_followup(rule, context, parameters)
            elif action_type == 'create_reminder':
                AutomationEngine._execute_create_reminder(rule, context, parameters)
            elif action_type == 'update_status':
                AutomationEngine._execute_update_status(rule, context, parameters)
            else:
                logger.warning(f"Unknown action type: {action_type}")
            
            # Update rule execution tracking
            rule.execution_count += 1
            rule.last_executed = timezone.now()
            rule.save()
            
            # Log successful execution
            # Create serializable context for logging (remove non-serializable objects)
            log_context = {k: v for k, v in context.items() if k not in ['job']}
            WorkflowAutomationLog.objects.create(
                candidate=rule.candidate,
                automation_rule=rule,
                level='info',
                message=f"Successfully executed {action_type}",
                context=log_context,
                job_id=context.get('job_id')
            )
            
        except Exception as e:
            logger.error(f"Failed to execute rule {rule.id}: {e}")
            raise
    
    @staticmethod
    def _execute_generate_package(rule: ApplicationAutomationRule, context: Dict[str, Any], 
                                parameters: Dict[str, Any]):
        """Execute package generation action."""
        job_id = context.get('job_id')
        if not job_id:
            raise ValueError("job_id required for package generation")
        
        job = JobEntry.objects.get(id=job_id)
        package = ApplicationPackageGenerator.generate_package(
            job=job,
            candidate=rule.candidate,
            parameters=parameters
        )
        
        logger.info(f"Generated package {package.id} via automation")
    
    @staticmethod
    def _execute_schedule_application(rule: ApplicationAutomationRule, context: Dict[str, Any],
                                    parameters: Dict[str, Any]):
        """Execute application scheduling action."""
        job_id = context.get('job_id')
        if not job_id:
            raise ValueError("job_id required for scheduling")
        
        job = JobEntry.objects.get(id=job_id)
        
        # Get or create package first
        package = ApplicationPackageGenerator.generate_package(
            job=job,
            candidate=rule.candidate
        )
        
        # Calculate scheduling time
        delay_hours = parameters.get('delay_hours', 24)
        scheduled_time = timezone.now() + timedelta(hours=delay_hours)
        
        # Create scheduled submission
        submission = ScheduledSubmission.objects.create(
            candidate=rule.candidate,
            job=job,
            application_package=package,
            scheduled_datetime=scheduled_time,
            submission_method=parameters.get('method', 'email'),
            submission_parameters=parameters
        )
        
        logger.info(f"Scheduled submission {submission.id} for {scheduled_time}")
    
    @staticmethod
    def _execute_send_followup(rule: ApplicationAutomationRule, context: Dict[str, Any],
                             parameters: Dict[str, Any]):
        """Execute follow-up reminder action."""
        job_id = context.get('job_id')
        if not job_id:
            raise ValueError("job_id required for follow-up")
        
        job = JobEntry.objects.get(id=job_id)
        
        # Calculate follow-up time
        delay_days = parameters.get('delay_days', 7)
        followup_time = timezone.now() + timedelta(days=delay_days)
        
        # Create follow-up reminder
        reminder = FollowUpReminder.objects.create(
            candidate=rule.candidate,
            job=job,
            reminder_type=parameters.get('type', 'application_followup'),
            subject=parameters.get('subject', f"Follow up: {job.title} at {job.company_name}"),
            message_template=parameters.get('message_template', ""),
            scheduled_datetime=followup_time,
            is_recurring=parameters.get('is_recurring', False),
            interval_days=parameters.get('interval_days')
        )
        
        logger.info(f"Created follow-up reminder {reminder.id} for {followup_time}")
    
    @staticmethod
    def _execute_create_reminder(rule: ApplicationAutomationRule, context: Dict[str, Any],
                               parameters: Dict[str, Any]):
        """Execute create reminder action."""
        # This would integrate with the existing Reminder model
        logger.info("Create reminder action executed")
    
    @staticmethod
    def _execute_update_status(rule: ApplicationAutomationRule, context: Dict[str, Any],
                             parameters: Dict[str, Any]):
        """Execute status update action."""
        job_id = context.get('job_id')
        if not job_id:
            raise ValueError("job_id required for status update")
        
        job = JobEntry.objects.get(id=job_id)
        new_status = parameters.get('status')
        
        if new_status:
            # Update job application history
            history_entry = {
                "action": f"Status updated to {new_status}",
                "timestamp": timezone.now().isoformat(),
                "notes": "Automated status update",
                "automated": True
            }
            
            if job.application_history:
                job.application_history.append(history_entry)
            else:
                job.application_history = [history_entry]
            
            job.save()
            logger.info(f"Updated job {job.id} status to {new_status}")


class AutomationTriggers:
    """
    UC-069: Trigger automation rules based on various events.
    """
    
    @staticmethod
    def on_job_created(job: JobEntry):
        """Trigger automation when a new job is created."""
        try:
            context = {
                'candidate_id': job.candidate.id,
                'job_id': job.id,
                'job_type': job.job_type,
                'industry': job.industry,
                'company_name': job.company_name,
            }
            
            # Calculate match score for context
            try:
                match_result = JobMatchingEngine.calculate_match_score(job, job.candidate)
                context['match_score'] = match_result.get('overall_score', 0)
            except Exception as e:
                logger.warning(f"Failed to calculate match score for automation trigger: {e}")
                context['match_score'] = 0
            
            AutomationEngine.trigger_rules('new_job', context)
            
        except Exception as e:
            logger.error(f"Failed to process new job automation trigger: {e}")
    
    @staticmethod
    def on_match_score_calculated(job: JobEntry, match_score: float):
        """Trigger automation when match score meets threshold."""
        try:
            context = {
                'candidate_id': job.candidate.id,
                'job_id': job.id,
                'match_score': match_score,
                'job_type': job.job_type,
                'industry': job.industry,
            }
            
            AutomationEngine.trigger_rules('match_score', context)
            
        except Exception as e:
            logger.error(f"Failed to process match score automation trigger: {e}")
    
    @staticmethod
    def on_deadline_approaching(job: JobEntry, days_until_deadline: int):
        """Trigger automation when application deadline approaches."""
        try:
            context = {
                'candidate_id': job.candidate.id,
                'job_id': job.id,
                'days_until_deadline': days_until_deadline,
                'deadline': job.application_deadline.isoformat() if job.application_deadline else None,
            }
            
            AutomationEngine.trigger_rules('deadline_approaching', context)
            
        except Exception as e:
            logger.error(f"Failed to process deadline automation trigger: {e}")

    @staticmethod
    def _execute_create_deadline_reminder(rule: ApplicationAutomationRule, context: Dict[str, Any],
                                        parameters: Dict[str, Any]):
        """Execute deadline reminder creation action."""
        job_id = context.get('job_id')
        if not job_id:
            raise ValueError("job_id required for deadline reminder")
        
        job = JobEntry.objects.get(id=job_id)
        
        if not job.application_deadline:
            logger.warning(f"Cannot create deadline reminder for job {job_id}: no deadline set")
            return
        
        # Get reminder parameters
        reminder_days = parameters.get('reminder_days', 3)
        reminder_message = parameters.get('reminder_message', 
            f'Remember to apply for {job.title} at {job.company_name}')
        reminder_type = parameters.get('reminder_type', 'notification')
        
        # Calculate reminder date
        reminder_date = job.application_deadline - timedelta(days=reminder_days)
        
        # Create follow-up reminder (reusing existing model)
        from core.models import FollowUpReminder
        
        reminder = FollowUpReminder.objects.create(
            candidate=rule.candidate,
            job=job,
            reminder_type='deadline',
            scheduled_date=reminder_date,
            message=reminder_message,
            is_active=True,
            automation_rule=rule
        )
        
        logger.info(f"Created deadline reminder {reminder.id} for job {job.id} - reminder on {reminder_date}")


# External trigger methods
def generate_application_package(job_id: int, candidate_id: int, parameters: Dict[str, Any] = None) -> ApplicationPackage:
    """Public API for generating application packages."""
    job = JobEntry.objects.get(id=job_id)
    candidate = CandidateProfile.objects.get(id=candidate_id)
    return ApplicationPackageGenerator.generate_package(job, candidate, parameters)


def trigger_job_automation(job: JobEntry):
    """Public API for triggering job-related automation."""
    AutomationTriggers.on_job_created(job)