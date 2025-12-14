import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { jobsAPI, skillsAPI, interviewsAPI, followupAPI } from '../../services/api';
import Icon from '../common/Icon';
import { CompanyInfo } from '../../features/company';
import InterviewInsights from './InterviewInsights';
import SkillGapAnalysis from './SkillGapAnalysis';
import JobMatchAnalysis from './JobMatchAnalysis';
import InterviewScheduler from './InterviewScheduler';
import InterviewFollowUp from './InterviewFollowUp';
import RoleQuestionBank from './RoleQuestionBank';
import PreparationChecklist from './PreparationChecklist';
import ApplicationQualityScore from './ApplicationQualityScore';
import JobPreparationChecklist from './JobPreparationChecklist';
import SalaryResearch from './SalaryResearch';
import SalaryNegotiation from './SalaryNegotiation';
import TechnicalPrepSuite from './TechnicalPrepSuite';
import InterviewSuccessForecast from './InterviewSuccessForecast';
import ApplicationEmails from './ApplicationEmails';
import './JobDetailView.css';

const TAB_GROUPS = [
  {
    title: 'Overview',
    tabs: [
      {
        id: 'basic',
        label: 'Basic Information',
        icon: 'info',
        description: 'Job details, company context, compensation',
      },
      {
        id: 'salary',
        label: 'Salary Research',
        icon: 'dollar-sign',
        description: 'Market rates, compensation analysis',
      },
      {
        id: 'interview',
        label: 'Interview Insights',
        icon: 'user-check',
        description: 'Process, timeline, and tips',
      },
    ],
  },
  {
    title: 'Interview Workspace',
    tabs: [
      {
        id: 'interview-prep',
        label: 'Interview Prep',
        icon: 'check-circle',
        description: 'Checklist & Question Bank',
      },
      {
        id: 'success-forecast',
        label: 'Success Forecast',
        icon: 'activity',
        description: 'Probability, action items, confidence',
      },
      {
        id: 'scheduled-interviews',
        label: 'Scheduled Interviews',
        icon: 'calendar',
        description: 'Upcoming rounds and reminders',
      },
    ],
  },
  {
    title: 'Analysis & Prep',
    tabs: [
      {
        id: 'match',
        label: 'Match Analysis',
        icon: 'zap',
        description: 'Role fit, strengths, and improvement areas',
      },
      {
        id: 'quality',
        label: 'Quality Score',
        icon: 'award',
        description: 'Package quality, ATS coverage, submission gate',
      },
      {
        id: 'skills',
        label: 'Skills Gap',
        icon: 'target',
        description: 'Required skills vs. current proficiency',
      },
      {
        id: 'technical-prep',
        label: 'Technical Prep',
        icon: 'code',
        description: 'Practice sprints, drills, and tracking',
      },
    ],
  },
];

const JobDetailView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [job, setJob] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('basic');
  const [companyInfo, setCompanyInfo] = useState(null);
  const [interviewInsights, setInterviewInsights] = useState(null);
  const [questionBank, setQuestionBank] = useState(null);
  const [loadingQuestionBank, setLoadingQuestionBank] = useState(false);
  const [questionBankError, setQuestionBankError] = useState('');
  const [savingPracticeQuestion, setSavingPracticeQuestion] = useState(null);
  const [savingChecklistId, setSavingChecklistId] = useState(null);
  const [skillsGapAnalysis, setSkillsGapAnalysis] = useState(null);
  const [skillProgress, setSkillProgress] = useState({});
  const [formData, setFormData] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [showInterviewScheduler, setShowInterviewScheduler] = useState(false);
  const [jobInterviews, setJobInterviews] = useState([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [editingInterviewId, setEditingInterviewId] = useState(null);
  const [interviewToDelete, setInterviewToDelete] = useState(null);
  const [showPreparationChecklist, setShowPreparationChecklist] = useState(false);
  const [selectedInterviewForChecklist, setSelectedInterviewForChecklist] = useState(null);
  const [technicalPrep, setTechnicalPrep] = useState(null);
  const [loadingTechnicalPrep, setLoadingTechnicalPrep] = useState(false);
  const [technicalPrepError, setTechnicalPrepError] = useState('');
  const [loggingTechnicalAttemptId, setLoggingTechnicalAttemptId] = useState(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedInterviewForFollowUp, setSelectedInterviewForFollowUp] = useState(null);
  const [successForecast, setSuccessForecast] = useState(null);
  const [loadingSuccessForecast, setLoadingSuccessForecast] = useState(false);
  const [successForecastError, setSuccessForecastError] = useState('');
  const [followupPlan, setFollowupPlan] = useState(null);
  const [followupReminders, setFollowupReminders] = useState([]);
  const [loadingFollowup, setLoadingFollowup] = useState(false);
  const [followupError, setFollowupError] = useState('');
  
  const jobTypeOptions = [
    { value: 'ft', label: 'Full-time' },
    { value: 'pt', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'intern', label: 'Internship' },
    { value: 'temp', label: 'Temporary' },
  ];
  
  const industryOptions = [
    'Software', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing', 'Government', 'Other'
  ];

  useEffect(() => {
    loadJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Check for tab query parameter and switch to that tab
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'interviews') {
      setActiveTab('scheduled-interviews');
      // Scroll to the interviews section after a short delay to ensure it's rendered
      setTimeout(() => {
        const interviewsSection = document.getElementById('scheduled-interviews-section');
        if (interviewsSection) {
          interviewsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [searchParams]);

  const buildFallbackCompanyInfo = (jobData) => {
    if (!jobData || !jobData.company_name) return null;
    const inferredDomain = jobData.company_name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || '';
    return {
      name: jobData.company_name,
      industry: jobData.industry || '',
      size: '',
      hq_location: jobData.location || '',
      domain: inferredDomain ? `${inferredDomain}.com` : '',
      website: jobData.posting_url || '',
      linkedin_url: '',
      description: '',
      mission_statement: '',
      glassdoor_rating: null,
      employee_count: null,
      recent_news: [],
    };
  };

  const loadJob = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await jobsAPI.getJob(id);
      setJob(data);
      if (data.company_info && data.company_info.name) {
        setCompanyInfo(data.company_info);
      } else {
        setCompanyInfo(buildFallbackCompanyInfo(data));
      }
      setFormData({
        title: data.title || '',
        company_name: data.company_name || '',
        location: data.location || '',
        salary_min: data.salary_min !== null && data.salary_min !== undefined ? String(data.salary_min) : '',
        salary_max: data.salary_max !== null && data.salary_max !== undefined ? String(data.salary_max) : '',
        salary_currency: data.salary_currency || 'USD',
        posting_url: data.posting_url || '',
        application_deadline: data.application_deadline || '',
        description: data.description || '',
        industry: data.industry || '',
        job_type: data.job_type || 'ft',
        personal_notes: data.personal_notes || '',
        recruiter_name: data.recruiter_name || '',
        recruiter_email: data.recruiter_email || '',
        recruiter_phone: data.recruiter_phone || '',
        hiring_manager_name: data.hiring_manager_name || '',
        hiring_manager_email: data.hiring_manager_email || '',
        salary_negotiation_notes: data.salary_negotiation_notes || '',
        interview_notes: data.interview_notes || '',
        application_history: data.application_history || [],
      });
        } catch (err) {
      console.error('Failed to load job:', err);
      setError(err?.message || 'Failed to load job');
    } finally {
      setLoading(false);
    }
  };

  const loadInterviews = useCallback(async () => {
    setLoadingInterviews(true);
    try {
      const response = await interviewsAPI.getInterviews({ job: id });
      const filtered = Array.isArray(response)
        ? response.filter((interview) => String(interview.job) === String(id))
        : [];
      setJobInterviews(filtered);
    } catch (err) {
      console.error('Failed to load interviews:', err);
    } finally {
      setLoadingInterviews(false);
    }
  }, [id]);

  const loadSuccessForecast = useCallback(async (refresh = false) => {
    if (!job?.id) return;
    setLoadingSuccessForecast(true);
    setSuccessForecastError('');
    try {
      const data = await interviewsAPI.getSuccessForecast({ jobId: job.id, refresh });
      setSuccessForecast(data);
    } catch (err) {
      console.error('Failed to load success forecast:', err);
      const message = err?.message || err?.error || 'Failed to load success forecast';
      setSuccessForecastError(message);
    } finally {
      setLoadingSuccessForecast(false);
    }
  }, [job?.id]);

  useEffect(() => {
    if (activeTab === 'scheduled-interviews') {
      loadInterviews();
    }
  }, [activeTab, id, loadInterviews]);

  useEffect(() => {
    if (activeTab === 'success-forecast') {
      loadSuccessForecast();
    }
  }, [activeTab, loadSuccessForecast]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const n = { ...prev };
        delete n[name];
        return n;
      });
    }
  };

  const addHistoryEntry = () => {
    const action = prompt('Enter action (e.g., "Applied", "Phone Screen Scheduled", "Interview Completed"):');
    if (!action) return;
    
    const notes = prompt('Enter notes (optional):');
    
    const entry = {
      action: action.trim(),
      timestamp: new Date().toISOString(),
      notes: notes?.trim() || '',
    };
    
    setFormData((prev) => ({
      ...prev,
      application_history: [...(prev.application_history || []), entry],
    }));
  };

  const removeHistoryEntry = (index) => {
    if (!window.confirm('Remove this history entry?')) return;
    setFormData((prev) => ({
      ...prev,
      application_history: prev.application_history.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    
    try {
      const payload = { ...formData };
      
      // Normalize salary fields
      ['salary_min', 'salary_max'].forEach((k) => {
        if (payload[k] === '') payload[k] = null;
        else payload[k] = payload[k] === null ? null : Number(payload[k]);
      });
      
      // Normalize optional string fields
      ['posting_url', 'industry', 'location', 'description', 'personal_notes',
       'recruiter_name', 'recruiter_email', 'recruiter_phone',
       'hiring_manager_name', 'hiring_manager_email',
       'salary_negotiation_notes', 'interview_notes'].forEach((k) => {
        if (!payload[k]) payload[k] = '';
      });
      
      // Normalize date field
      if (!payload.application_deadline || payload.application_deadline === '') {
        payload.application_deadline = null;
      }

      const updated = await jobsAPI.updateJob(id, payload);
      setJob(updated);
      setFormData({
        title: updated.title || '',
        company_name: updated.company_name || '',
        location: updated.location || '',
        salary_min: updated.salary_min !== null && updated.salary_min !== undefined ? String(updated.salary_min) : '',
        salary_max: updated.salary_max !== null && updated.salary_max !== undefined ? String(updated.salary_max) : '',
        salary_currency: updated.salary_currency || 'USD',
        posting_url: updated.posting_url || '',
        application_deadline: updated.application_deadline || '',
        description: updated.description || '',
        industry: updated.industry || '',
        job_type: updated.job_type || 'ft',
        personal_notes: updated.personal_notes || '',
        recruiter_name: updated.recruiter_name || '',
        recruiter_email: updated.recruiter_email || '',
        recruiter_phone: updated.recruiter_phone || '',
        hiring_manager_name: updated.hiring_manager_name || '',
        hiring_manager_email: updated.hiring_manager_email || '',
        salary_negotiation_notes: updated.salary_negotiation_notes || '',
        interview_notes: updated.interview_notes || '',
        application_history: updated.application_history || [],
      });
      setEditMode(false);
      setSuccess('Job updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      if (e?.details) setFieldErrors(e.details);
      const msg = Array.isArray(e?.messages) && e.messages.length
        ? e.messages.join(' • ')
        : (e?.message || e?.error?.message || 'Failed to save');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const formatTimestamp = (isoStr) => {
    if (!isoStr) return '';
    try {
      return new Date(isoStr).toLocaleString();
    } catch {
      return isoStr;
    }
  };

  const fetchInterviewInsights = useCallback(async (jobId) => {
    try {
      const insights = await jobsAPI.getJobInterviewInsights(jobId);
      setInterviewInsights(insights);
    } catch (err) {
      console.warn('Unable to load interview insights', err);
      setInterviewInsights(null);
    }
  }, []);

  const fetchQuestionBank = useCallback(async (jobId) => {
    setQuestionBankError('');
    setLoadingQuestionBank(true);
    try {
      const bank = await jobsAPI.getJobQuestionBank(jobId);
      setQuestionBank(bank);
    } catch (err) {
      setQuestionBankError(err?.message || 'Failed to load question bank');
    } finally {
      setLoadingQuestionBank(false);
    }
  }, []);

  const fetchTechnicalPrep = useCallback(async (jobId, options = {}) => {
    setTechnicalPrepError('');
    setLoadingTechnicalPrep(true);
    try {
      const data = await jobsAPI.getJobTechnicalPrep(jobId, options);
      setTechnicalPrep(data);
    } catch (err) {
      setTechnicalPrepError(err?.message || 'Failed to load technical prep');
    } finally {
      setLoadingTechnicalPrep(false);
    }
  }, []);

  const loadFollowupData = useCallback(async (jobId, stage) => {
    if (!jobId) return;
    setLoadingFollowup(true);
    setFollowupError('');
    try {
      const [plan, reminders] = await Promise.all([
        followupAPI.getPlaybook({ jobId, stage }),
        followupAPI.list()
      ]);
      setFollowupPlan(plan);
      setFollowupReminders(Array.isArray(reminders) ? reminders.filter((r) => r.job === Number(jobId)) : []);
    } catch (err) {
      const msg = err?.message || err?.error || 'Unable to load follow-up guidance';
      setFollowupError(msg);
      setFollowupPlan(null);
      setFollowupReminders([]);
    } finally {
      setLoadingFollowup(false);
    }
  }, []);

  const handleScheduleFollowup = async () => {
    if (!job?.id) return;
    setLoadingFollowup(true);
    setFollowupError('');
    try {
      await followupAPI.createFromPlaybook({ jobId: job.id, stage: job.status });
      await loadFollowupData(job.id, job.status);
      setSuccess('Follow-up reminder scheduled');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const msg = err?.message || err?.error || 'Failed to schedule follow-up';
      setFollowupError(msg);
    } finally {
      setLoadingFollowup(false);
    }
  };

  const handleSnoozeReminder = async (reminderId, hours = 48) => {
    if (!job?.id || !reminderId) return;
    setLoadingFollowup(true);
    setFollowupError('');
    try {
      await followupAPI.snooze(reminderId, { hours });
      await loadFollowupData(job.id, job.status);
    } catch (err) {
      setFollowupError(err?.message || 'Failed to snooze reminder');
    } finally {
      setLoadingFollowup(false);
    }
  };

  const handleDismissReminder = async (reminderId) => {
    if (!job?.id || !reminderId) return;
    setLoadingFollowup(true);
    setFollowupError('');
    try {
      await followupAPI.dismiss(reminderId);
      await loadFollowupData(job.id, job.status);
    } catch (err) {
      setFollowupError(err?.message || 'Failed to dismiss reminder');
    } finally {
      setLoadingFollowup(false);
    }
  };

  const handleCompleteReminder = async (reminderId) => {
    if (!job?.id || !reminderId) return;
    setLoadingFollowup(true);
    setFollowupError('');
    try {
      await followupAPI.complete(reminderId, { response_received: true });
      await loadFollowupData(job.id, job.status);
    } catch (err) {
      setFollowupError(err?.message || 'Failed to mark reminder complete');
    } finally {
      setLoadingFollowup(false);
    }
  };

  useEffect(() => {
    if (job?.id) {
      loadFollowupData(job.id, job.status);
    }
  }, [job?.id, job?.status, loadFollowupData]);

  const handleRefreshTechnicalPrep = useCallback(() => {
    if (job?.id) {
      fetchTechnicalPrep(job.id, { refresh: true });
    }
  }, [job?.id, fetchTechnicalPrep]);

  const handlePollTechnicalPrep = useCallback(() => {
    if (job?.id) {
      fetchTechnicalPrep(job.id);
    }
  }, [job?.id, fetchTechnicalPrep]);

  const fetchSkillsGap = useCallback(async (jobId, options = {}) => {
    try {
      const analysis = await jobsAPI.getJobSkillsGap(jobId, options);
      setSkillsGapAnalysis(analysis);

      // Load progress for each skill
      if (analysis && analysis.skills) {
        const progressData = {};
        await Promise.all(
          analysis.skills.map(async (skill) => {
            try {
              const progress = await jobsAPI.getSkillProgress(skill.skill_id);
              if (progress && progress.length > 0) {
                // Calculate total hours from all progress entries
                const totalHours = progress.reduce((sum, entry) => sum + (entry.hours_spent || 0), 0);
                const latestProgress = progress[progress.length - 1];
                progressData[skill.skill_id] = {
                  total_hours: totalHours,
                  progress_percent: latestProgress.progress_percent || 0,
                };
              }
            } catch (err) {
              // Skip if can't load progress for this skill
            }
          })
        );
        setSkillProgress(progressData);
      }
    } catch (err) {
      console.warn('Unable to load skills gap analysis', err);
      setSkillsGapAnalysis(null);
    }
  }, []);

  const handleRefreshSkillsGap = () => {
    if (job?.id) {
      fetchSkillsGap(job.id, { refresh: true });
    }
  };

  const handleLogSkillProgress = async (skill, logData) => {
    try {
      // Calculate progress percentage based on hours spent
      const totalNeeded = skill.suggested_learning_path?.reduce((sum, step) => sum + (step.estimated_hours || 0), 0) || 40;
      const currentSpent = skillProgress[skill.skill_id]?.total_hours || 0;
      const newTotal = currentSpent + logData.hours_spent;
      const progressPercent = Math.min(100, Math.round((newTotal / totalNeeded) * 100));

      await jobsAPI.logSkillProgress(skill.skill_id, {
        activity_type: 'practice',
        hours_spent: logData.hours_spent,
        progress_percent: progressPercent,
        job_id: job.id,
      });

      // Update local skill progress immediately for instant UI feedback
      setSkillProgress((prev) => ({
        ...prev,
        [skill.skill_id]: {
          total_hours: newTotal,
          progress_percent: progressPercent,
        },
      }));
      
      setSuccess('Practice logged successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to log progress: ' + (err.message || 'Unknown error'));
    }
  };

  const handleAddSkill = async (skill) => {
    try {
      await skillsAPI.addSkill({
        skill_id: skill.skill_id,
        level: 'beginner',
        years: 0,
      });

      setSuccess(`${skill.name} added to your skills!`);
      setTimeout(() => setSuccess(''), 3000);

      // Refresh the analysis to show the updated status
      if (job?.id) {
        await fetchSkillsGap(job.id, { refresh: true });
      }
    } catch (err) {
      setError('Failed to add skill: ' + (err.message || 'Unknown error'));
    }
  };

  useEffect(() => {
    if (!job?.id || !job?.company_name) {
      setCompanyInfo(null);
      return;
    }

    let isMounted = true;

    const fetchCompanyInfo = async () => {
      try {
        const info = await jobsAPI.getJobCompanyInsights(job.id);
        if (isMounted && info && info.name) {
          setCompanyInfo(info);
        } else if (isMounted) {
          setCompanyInfo((prev) => prev || buildFallbackCompanyInfo(job));
        }
      } catch (err) {
        console.warn('Unable to load company profile', err);
        if (isMounted) {
          setCompanyInfo((prev) => prev || buildFallbackCompanyInfo(job));
        }
      }
    };

    fetchCompanyInfo();

    return () => {
      isMounted = false;
    };
  }, [job]);

  useEffect(() => {
    if (job?.id) {
      fetchInterviewInsights(job.id);
      fetchSkillsGap(job.id);
      fetchQuestionBank(job.id);
      fetchTechnicalPrep(job.id);
    }
  }, [job?.id, fetchInterviewInsights, fetchSkillsGap, fetchQuestionBank, fetchTechnicalPrep]);

  const handlePracticeStatusUpdate = useCallback((questionId, practiceStatus) => {
    if (!questionId || !practiceStatus) return;
    setQuestionBank((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map((category) => ({
          ...category,
          questions: category.questions.map((question) =>
            question.id === questionId
              ? { ...question, practice_status: practiceStatus }
              : question
          ),
        })),
      };
    });
  }, []);

  const handleLogQuestionPractice = useCallback(async (payload) => {
    if (!job?.id) return;
    setSavingPracticeQuestion(payload.question_id);
    setError('');
    setSuccess('');
    try {
      const response = await jobsAPI.logQuestionPractice(job.id, payload);
      const practiceStatus = response?.practice_status || { practiced: true, practice_count: 1 };
      handlePracticeStatusUpdate(payload.question_id, practiceStatus);
      setSuccess('Practice response saved!');
      setTimeout(() => setSuccess(''), 3000);
      return response;
    } catch (err) {
      setError(err?.message || 'Failed to save practice');
    } finally {
      setSavingPracticeQuestion(null);
    }
  }, [job?.id, handlePracticeStatusUpdate]);

  const handleLogTechnicalAttempt = useCallback(async (payload) => {
    if (!job?.id || !payload?.challenge_id) return;
    setLoggingTechnicalAttemptId(payload.challenge_id);
    setError('');
    try {
      const response = await jobsAPI.logTechnicalPrepAttempt(job.id, payload);
      setTechnicalPrep((prev) => {
        if (!prev) return prev;
        const stats = response?.challenge_stats || {};
        const updatedChallenges = (prev.coding_challenges || []).map((challenge) => {
          if (challenge.id !== payload.challenge_id) return challenge;
          return {
            ...challenge,
            practice_stats: {
              attempts: stats.attempts || 0,
              best_time_seconds: stats.best_time_seconds,
              best_accuracy: stats.best_accuracy,
              average_accuracy: stats.average_accuracy,
              last_attempt_at: stats.last_attempt_at,
            },
            recent_attempts: stats.history || challenge.recent_attempts || [],
          };
        });
        return {
          ...prev,
          coding_challenges: updatedChallenges,
          performance_tracking: response?.performance_tracking || prev.performance_tracking,
        };
      });
      setSuccess('Technical practice logged!');
      setTimeout(() => setSuccess(''), 3000);
      return response;
    } catch (err) {
      setError(err?.message || 'Failed to log technical practice');
      throw err;
    } finally {
      setLoggingTechnicalAttemptId(null);
    }
  }, [job?.id]);

  const handleToggleChecklistItem = async ({ taskId, category, task, completed }) => {
    if (!job?.id || !taskId) return;
    setSavingChecklistId(taskId);
    setError('');
    try {
      await jobsAPI.togglePreparationChecklist(job.id, {
        task_id: taskId,
        category,
        task,
        completed,
      });
      setInterviewInsights((prev) => {
        if (!prev?.preparation_checklist) return prev;
        return {
          ...prev,
          preparation_checklist: prev.preparation_checklist.map((cat) => ({
            ...cat,
            items: cat.items?.map((item) =>
              item.task_id === taskId ? { ...item, completed } : item
            ) || [],
          })),
        };
      });
    } catch (err) {
      setError(err?.message || 'Failed to update checklist item');
    } finally {
      setSavingChecklistId(null);
    }
  };

  if (loading) {
    return (
      <div className="education-container">
        <div className="page-backbar">
          <button className="btn-back" onClick={() => navigate('/jobs')}>
            ← Back to Jobs
          </button>
        </div>
        <p>Loading...</p>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="education-container">
        <div className="page-backbar">
          <button className="btn-back" onClick={() => navigate('/jobs')}>
            ← Back to Jobs
          </button>
        </div>
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  return (
    <div className="education-container">
      <div className="page-backbar">
        <button className="btn-back" onClick={() => navigate('/jobs')}>
          ← Back to Jobs
        </button>
      </div>

      <div className="education-header">
        <h2>
          <Icon name="briefcase" size="md" /> Job Details
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          {!editMode && (
            <button 
              className="add-education-button" 
              onClick={() => setShowInterviewScheduler(true)}
              style={{ 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Icon name="calendar" size="sm" /> Schedule Interview
            </button>
          )}
          {!editMode ? (
            <>
              <button className="add-education-button" onClick={() => setEditMode(true)}>
                <Icon name="edit" size="sm" /> Edit
              </button>
              <button
                className="add-education-button"
                onClick={() => navigate(`/jobs/${id}/timeline`)}
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: 'white',
                  border: 'none'
                }}
              >
                <Icon name="clock" size="sm" /> View Timeline
              </button>
            </>
          ) : (
            <>
              <button 
                className="cancel-button" 
                onClick={() => {
                  setEditMode(false);
                  loadJob();
                  setFieldErrors({});
                }}
                disabled={saving}
                style={{ 
                  padding: '12px 24px',
                  fontSize: '15px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: '1.5px solid #d1d5db',
                  background: 'white',
                  color: '#4b5563',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                className="save-button" 
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '12px 28px',
                  fontSize: '15px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {/* Main Content with Sidebar Layout */}
      <div className="job-detail-layout">
        <div className="job-detail-main">
          {/* Tab Navigation */}
          <div className="job-tabs">
        {TAB_GROUPS.map((group) => (
          <div key={group.title} className="job-tab-group">
            <p className="job-tab-group__title">{group.title}</p>
            <div className="job-tab-group__buttons">
              {group.tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`job-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <div className="job-tab__icon">
                    <Icon name={tab.icon} size="sm" />
                  </div>
                  <div>
                    <span className="job-tab__label">{tab.label}</span>
                    <span className="job-tab__desc">{tab.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tab Content - Basic Information */}
      {activeTab === 'basic' && (
        <>
          {/* Basic Information & Company Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ width: '100%' }}>
              {/* Job Details */}
              <div className="education-form-card" style={{ height: '100%' }}>
                <div className="form-header">
                  <h3>Basic Information</h3>
                </div>
            
            {editMode ? (
          <form className="education-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="title">Job Title <span className="required">*</span></label>
                <input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={onChange}
                  className={fieldErrors.title ? 'error' : ''}
                />
                {fieldErrors.title && <div className="error-message">{fieldErrors.title}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="company_name">Company <span className="required">*</span></label>
                <input
                  id="company_name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={onChange}
                  className={fieldErrors.company_name ? 'error' : ''}
                />
                {fieldErrors.company_name && <div className="error-message">{fieldErrors.company_name}</div>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input id="location" name="location" value={formData.location} onChange={onChange} />
              </div>
              <div className="form-group">
                <label htmlFor="job_type">Job Type</label>
                <select id="job_type" name="job_type" value={formData.job_type} onChange={onChange}>
                  {jobTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="industry">Industry</label>
                <select id="industry" name="industry" value={formData.industry} onChange={onChange}>
                  <option value="">Select...</option>
                  {industryOptions.map((ind) => (<option key={ind} value={ind}>{ind}</option>))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="posting_url">Job Posting URL</label>
                <input id="posting_url" name="posting_url" value={formData.posting_url} onChange={onChange} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="application_deadline">Application Deadline</label>
                <input 
                  id="application_deadline" 
                  type="date" 
                  name="application_deadline" 
                  value={formData.application_deadline} 
                  onChange={onChange}
                />
              </div>
              <div className="form-group" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="salary_min">Salary Min</label>
                <input
                  id="salary_min"
                  type="number"
                  step="0.01"
                  name="salary_min"
                  value={formData.salary_min}
                  onChange={onChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="salary_max">Salary Max</label>
                <input 
                  id="salary_max" 
                  type="number" 
                  step="0.01" 
                  name="salary_max" 
                  value={formData.salary_max} 
                  onChange={onChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Job Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={onChange}
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="form-actions" style={{ marginTop: '24px' }}>
              <button 
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="save-button"
                style={{
                  padding: '12px 28px',
                  fontSize: '15px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  width: '100%'
                }}
              >
                {saving ? 'Saving...' : 'Save Basic Information'}
              </button>
            </div>
          </form>
            ) : (
              <div className="education-form" style={{ padding: '32px' }}>
            <div className="detail-row" style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Job Title:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.title}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Company:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.company_name}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Location:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.location || 'Not specified'}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Job Type:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>
                {jobTypeOptions.find(opt => opt.value === job.job_type)?.label || job.job_type}
              </div>
            </div>
            <div className="detail-row" style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Industry:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.industry || 'Not specified'}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Salary Range:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.salary_range || 'Not specified'}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Application Deadline:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{formatDate(job.application_deadline)}</div>
            </div>
            {job.posting_url && (
              <div className="detail-row" style={{ marginBottom: '16px' }}>
                <strong style={{ color: '#374151', fontSize: '15px' }}>Posting URL:</strong>
                <div style={{ marginTop: '4px' }}>
                  <a 
                    href={job.posting_url} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ 
                      color: '#667eea', 
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '16px'
                    }}
                  >
                    View Posting <Icon name="link" size="sm" />
                  </a>
                </div>
              </div>
            )}
            {job.description && (
              <div className="detail-row" style={{ marginTop: '20px' }}>
                <strong style={{ color: '#374151', fontSize: '15px' }}>Description:</strong>
                <div style={{ 
                  whiteSpace: 'pre-wrap', 
                  marginTop: '8px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  fontSize: '15px',
                  color: '#4b5563',
                  lineHeight: '1.6'
                }}>
                  {job.description}
                </div>
              </div>
              )}
              </div>
            )}
          </div>
        </div>
        {companyInfo && (
          <div style={{ width: '100%' }}>
            <CompanyInfo companyInfo={companyInfo} jobId={job.id} />
          </div>
        )}
      </div>

      {/* Contact Information */}
      <div className="education-form-card">
        <div className="form-header">
          <h3>Contact Information</h3>
        </div>
        
        {editMode ? (
          <form className="education-form">
            <h4 style={{ color: '#111827', fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Recruiter</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="recruiter_name">Name</label>
                <input id="recruiter_name" name="recruiter_name" value={formData.recruiter_name} onChange={onChange} />
              </div>
              <div className="form-group">
                <label htmlFor="recruiter_email">Email</label>
                <input id="recruiter_email" type="email" name="recruiter_email" value={formData.recruiter_email} onChange={onChange} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="recruiter_phone">Phone</label>
              <input id="recruiter_phone" name="recruiter_phone" value={formData.recruiter_phone} onChange={onChange} />
            </div>

            <h4 style={{ color: '#111827', fontSize: '18px', fontWeight: '600', marginTop: '32px', marginBottom: '16px' }}>Hiring Manager</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="hiring_manager_name">Name</label>
                <input id="hiring_manager_name" name="hiring_manager_name" value={formData.hiring_manager_name} onChange={onChange} />
              </div>
              <div className="form-group">
                <label htmlFor="hiring_manager_email">Email</label>
                <input id="hiring_manager_email" type="email" name="hiring_manager_email" value={formData.hiring_manager_email} onChange={onChange} />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '24px' }}>
              <button 
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="save-button"
                style={{
                  padding: '12px 28px',
                  fontSize: '15px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  width: '100%'
                }}
              >
                {saving ? 'Saving...' : 'Save Contact Information'}
              </button>
            </div>
          </form>
        ) : (
          <div className="education-form" style={{ padding: '32px' }}>
            <h4 style={{ color: '#111827', fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Recruiter</h4>
            <div className="detail-row" style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Name:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.recruiter_name || 'Not specified'}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Email:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.recruiter_email || 'Not specified'}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Phone:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.recruiter_phone || 'Not specified'}</div>
            </div>

            <h4 style={{ color: '#111827', fontSize: '18px', fontWeight: '600', marginTop: '32px', marginBottom: '16px' }}>Hiring Manager</h4>
            <div className="detail-row" style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Name:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.hiring_manager_name || 'Not specified'}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Email:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.hiring_manager_email || 'Not specified'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Follow-up Reminders */}
      <div className="education-form-card followup-card">
        <div className="form-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            Follow-up reminders
            {job?.status && (
              <span className="followup-pill">
                Stage: {job.status.replace('_', ' ')}
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="add-education-button"
              onClick={() => loadFollowupData(job.id, job.status)}
              disabled={loadingFollowup}
              style={{ background: '#f3f4f6', color: '#111827' }}
            >
              <Icon name="refresh-cw" size="sm" /> Refresh
            </button>
            <button
              className="add-education-button"
              onClick={handleScheduleFollowup}
              disabled={loadingFollowup || job?.status === 'rejected'}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white',
                border: 'none'
              }}
            >
              {loadingFollowup ? 'Working...' : 'Schedule suggested reminder'}
            </button>
          </div>
        </div>

        {followupError && <div className="error-banner" style={{ marginBottom: '12px' }}>{followupError}</div>}

        <div className="followup-grid">
          <div className="followup-panel">
            <p className="followup-label">Suggested timing</p>
            <h4 style={{ margin: '4px 0 8px' }}>
              {followupPlan?.scheduled_datetime ? formatTimestamp(followupPlan.scheduled_datetime) : 'Not available'}
            </h4>
            <p className="followup-meta">
              {followupPlan?.recommendation_reason || 'Uses stage-aware etiquette (1 week post-application, 3 days post-interview).'}
            </p>
            <div className="followup-meta-row">
              <span>Reminder type: <strong>{followupPlan?.reminder_type || 'follow-up'}</strong></span>
              {followupPlan?.interval_days && (
                <span>Cadence: every {followupPlan.interval_days} days</span>
              )}
            </div>
          </div>

          <div className="followup-panel">
            <p className="followup-label">Template preview</p>
            <div className="followup-template">
              <div className="template-subject">Subject: {followupPlan?.subject || 'Follow-up about your application'}</div>
              <div className="template-body">
                {(followupPlan?.message_template || 'Friendly follow-up message tailored to your current stage.').slice(0, 380)}...
              </div>
            </div>
          </div>
        </div>

        <div className="followup-tips">
          <p className="followup-label">Etiquette tips</p>
          <div className="followup-chips">
            {(followupPlan?.etiquette_tips || []).map((tip, idx) => (
              <span key={idx} className="followup-chip">{tip}</span>
            ))}
          </div>
        </div>

        <div className="followup-reminders">
          <div className="followup-reminders-header">
            <p className="followup-label">Scheduled reminders</p>
            <span className="followup-count">{(followupReminders || []).length} for this job</span>
          </div>
          {(followupReminders || []).length === 0 ? (
            <div className="followup-empty">
              <Icon name="bell-off" size="sm" />
              <div>No reminders yet. Use “Schedule suggested reminder” to add one.</div>
            </div>
          ) : (
            <div className="followup-list">
              {followupReminders.map((reminder) => (
                <div key={reminder.id} className="followup-reminder-card">
                  <div className="followup-reminder-main">
                    <div>
                      <div className="followup-reminder-title">{reminder.subject}</div>
                      <div className="followup-reminder-meta">
                        {reminder.reminder_type} • {reminder.followup_stage || job.status}
                      </div>
                      <div className="followup-reminder-meta">
                        Scheduled: {formatTimestamp(reminder.scheduled_datetime)}
                      </div>
                      <div className="followup-reminder-meta">
                        Status: <span className={`pill pill-${reminder.status}`}>{reminder.status}</span>
                      </div>
                    </div>
                    {reminder.status === 'pending' && (
                      <div className="followup-reminder-actions">
                        <button onClick={() => handleSnoozeReminder(reminder.id, 48)} disabled={loadingFollowup}>
                          Snooze 2d
                        </button>
                        <button onClick={() => handleCompleteReminder(reminder.id)} disabled={loadingFollowup}>
                          Mark done
                        </button>
                        <button onClick={() => handleDismissReminder(reminder.id)} disabled={loadingFollowup} className="ghost">
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="followup-reminder-body">
                    {(reminder.message_template || '').slice(0, 260)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notes Sections */}
      <div className="education-form-card">
        <div className="form-header">
          <h3>Notes</h3>
        </div>
        
        {editMode ? (
          <form className="education-form">
            <div className="form-group">
              <label htmlFor="personal_notes">Personal Observations</label>
              <textarea
                id="personal_notes"
                name="personal_notes"
                value={formData.personal_notes}
                onChange={onChange}
                rows={4}
                placeholder="Your personal notes and observations about this opportunity..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="salary_negotiation_notes">Salary Negotiation Notes</label>
              <textarea
                id="salary_negotiation_notes"
                name="salary_negotiation_notes"
                value={formData.salary_negotiation_notes}
                onChange={onChange}
                rows={4}
                placeholder="Notes about salary discussions and negotiations..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="interview_notes">Interview Notes & Feedback</label>
              <textarea
                id="interview_notes"
                name="interview_notes"
                value={formData.interview_notes}
                onChange={onChange}
                rows={4}
                placeholder="Notes from interviews, feedback received, impressions..."
              />
            </div>

            <div className="form-actions" style={{ marginTop: '24px' }}>
              <button 
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="save-button"
                style={{
                  padding: '12px 28px',
                  fontSize: '15px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  width: '100%'
                }}
              >
                {saving ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="education-form" style={{ padding: '32px' }}>
            <div className="detail-row" style={{ marginBottom: '20px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Personal Observations:</strong>
              <div style={{ 
                whiteSpace: 'pre-wrap', 
                marginTop: '8px',
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                fontSize: '15px',
                color: '#4b5563',
                lineHeight: '1.6',
                minHeight: '60px'
              }}>
                {job.personal_notes || 'No notes yet'}
              </div>
            </div>
            
            <div className="detail-row" style={{ marginBottom: '20px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Salary Negotiation Notes:</strong>
              <div style={{ 
                whiteSpace: 'pre-wrap', 
                marginTop: '8px',
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                fontSize: '15px',
                color: '#4b5563',
                lineHeight: '1.6',
                minHeight: '60px'
              }}>
                {job.salary_negotiation_notes || 'No notes yet'}
              </div>
            </div>
            
            <div className="detail-row">
              <strong style={{ color: '#374151', fontSize: '15px' }}>Interview Notes & Feedback:</strong>
              <div style={{ 
                whiteSpace: 'pre-wrap', 
                marginTop: '8px',
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                fontSize: '15px',
                color: '#4b5563',
                lineHeight: '1.6',
                minHeight: '60px'
              }}>
                {job.interview_notes || 'No notes yet'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Application History */}
      <div className="education-form-card">
        <div className="form-header">
          <h3>Application History</h3>
          {editMode && (
            <button 
              className="add-education-button" 
              onClick={addHistoryEntry} 
              type="button"
              style={{ 
                padding: '8px 20px',
                fontSize: '14px',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            >
              + Add Entry
            </button>
          )}
        </div>
        
        {(!formData.application_history || formData.application_history.length === 0) ? (
          <div className="education-form" style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '15px' }}>No history entries yet</p>
          </div>
        ) : (
          <div className="education-form" style={{ padding: '32px' }}>
            {formData.application_history.map((entry, index) => (
              <div key={index} style={{ 
                padding: '20px', 
                marginBottom: '16px', 
                borderLeft: '4px solid #667eea',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '16px', color: '#111827' }}>{entry.action}</strong>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                      {formatTimestamp(entry.timestamp)}
                    </div>
                    {entry.notes && (
                      <div style={{ 
                        marginTop: '12px', 
                        whiteSpace: 'pre-wrap',
                        fontSize: '15px',
                        color: '#4b5563',
                        lineHeight: '1.5'
                      }}>
                        {entry.notes}
                      </div>
                    )}
                  </div>
                  {editMode && (
                    <button 
                      onClick={() => removeHistoryEntry(index)}
                      className="delete-button"
                      type="button"
                      style={{ 
                        marginLeft: '16px',
                        padding: '8px',
                        background: '#fee',
                        border: '1px solid #fcc',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Icon name="trash" size="sm" ariaLabel="Remove" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {editMode && (
              <div className="form-actions" style={{ marginTop: '24px' }}>
                <button 
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="save-button"
                  style={{
                    padding: '12px 28px',
                    fontSize: '15px',
                    fontWeight: '600',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                    width: '100%'
                  }}
                >
                  {saving ? 'Saving...' : 'Save Application History'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Application Emails - Rendered as sidebar at top level */}

      {/* Metadata */}
      <div className="education-form-card">
        <div className="form-header">
          <h3>Metadata</h3>
        </div>
        <div className="education-form" style={{ padding: '32px' }}>
          <div className="detail-row" style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#374151', fontSize: '15px' }}>Created:</strong>
            <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{formatTimestamp(job.created_at)}</div>
          </div>
          <div className="detail-row">
            <strong style={{ color: '#374151', fontSize: '15px' }}>Last Updated:</strong>
            <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{formatTimestamp(job.updated_at)}</div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Tab Content - Salary Research */}
      {activeTab === 'salary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <SalaryResearch jobId={id} embedded={true} />
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '32px' }}>
            <SalaryNegotiation jobId={id} embedded={true} />
          </div>
        </div>
      )}

      {/* Tab Content - Interview Insights */}
      {activeTab === 'interview' && (
        <>
          {/* Card 1: Interview Insights (Process, Timeline, etc.) */}
          {interviewInsights ? (
            <InterviewInsights
              insights={interviewInsights}
            />
          ) : (
            <div className="education-form-card">
              <div className="education-form" style={{ padding: '40px', textAlign: 'center' }}>
                <Icon name="info" size="lg" color="#9ca3af" />
                <p style={{ color: '#9ca3af', marginTop: '16px', fontSize: '15px' }}>
                  No interview insights available for this job yet.
                </p>
              </div>
            </div>
          )}

          {/* Card 2: Interview Research Brief (UC-074) */}
          <div className="education-form-card">
            <div className="form-header">
              <h3>
                <Icon name="book-open" size="md" /> Company Research Brief
              </h3>
            </div>
            <div className="education-form" style={{ padding: '32px' }}>
              <p style={{ color: '#6b7280', marginBottom: '20px' }}>
                Get comprehensive company research, talking points, and intelligent questions for your interview.
              </p>
              <button
                onClick={() => navigate(`/interview-research/${id}`)}
                style={{
                  padding: '12px 24px',
                  fontSize: '15px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Icon name="book-open" size="sm" /> View Research Brief
              </button>
            </div>
          </div>
        </>
      )}

      {/* Tab Content - Interview Prep */}
      {activeTab === 'interview-prep' && (
        <>
          {/* Card 1: Preparation Checklist */}
          {interviewInsights?.preparation_checklist && (
            <div className="education-form-card">
              <div className="form-header">
                <h3>
                  <Icon name="check-circle" size="md" /> Preparation Checklist
                </h3>
              </div>
              <div className="education-form" style={{ padding: '32px' }}>
                <JobPreparationChecklist
                  checklist={interviewInsights.preparation_checklist}
                  onToggleChecklistItem={handleToggleChecklistItem}
                  savingChecklistId={savingChecklistId}
                />
              </div>
            </div>
          )}

          {/* Card 2: Question Bank */}
          <div className="education-form-card">
            <div className="form-header">
              <h3>
                <Icon name="layers" size="md" /> Role-Specific Question Bank
              </h3>
            </div>
            <div className="education-form" style={{ padding: '32px' }}>
              {questionBankError && (
                <div className="error-banner" style={{ margin: 0, marginBottom: '16px' }}>{questionBankError}</div>
              )}
              
              {questionBank && (
                <RoleQuestionBank
                  bank={questionBank}
                  loading={loadingQuestionBank}
                  savingQuestionId={savingPracticeQuestion}
                  onLogPractice={handleLogQuestionPractice}
                  jobId={job?.id}
                  onPracticeStatusUpdate={handlePracticeStatusUpdate}
                  embedded={true}
                />
              )}

              {!questionBank && loadingQuestionBank && (
                <div style={{ textAlign: 'center', color: '#6b7280' }}>
                  Loading question bank...
                </div>
              )}

              {!questionBank && !loadingQuestionBank && !questionBankError && (
                <div style={{ color: '#6b7280' }}>
                  Question bank is not available for this job yet.
                </div>
              )}

              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => navigate(`/question-bank/${id}`)}
                  style={{
                    padding: '12px 24px',
                    fontSize: '15px',
                    fontWeight: '600',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Icon name="layers" size="sm" /> Open Full Question Bank
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Interview Practice Tools (UC-076, UC-077) */}
          <div className="education-form-card">
            <div className="form-header">
              <h3>
                <Icon name="mic" size="md" /> Interview Practice
              </h3>
            </div>
            <div className="education-form" style={{ padding: '32px' }}>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{
                  padding: '20px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
                    <Icon name="message-circle" size="sm" /> AI Response Coaching
                  </h4>
                  <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 16px 0' }}>
                    Get detailed AI feedback on your interview responses with STAR framework analysis.
                  </p>
                  <p style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic', marginBottom: '16px' }}>
                    Note: Response coaching is accessed from individual questions in the Question Bank above.
                  </p>
                </div>

                <div style={{
                  padding: '20px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
                    <Icon name="mic" size="sm" /> Mock Interview Sessions
                  </h4>
                  <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 16px 0' }}>
                    Practice complete interview sessions with sequential questions and performance feedback.
                  </p>
                  <button
                    onClick={() => navigate('/mock-interview')}
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Icon name="play" size="sm" /> Start Mock Interview
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tab Content - Match Analysis */}
      {activeTab === 'match' && (
        <>
          <JobMatchAnalysis 
            job={job} 
            onError={setError}
          />
        </>
      )}

      {activeTab === 'quality' && (
        <ApplicationQualityScore job={job} />
      )}

      {/* Tab Content - Skills Gap Analysis */}
      {activeTab === 'skills' && (
        <>
          {skillsGapAnalysis ? (
            <SkillGapAnalysis
              analysis={skillsGapAnalysis}
              skillProgress={skillProgress}
              onRefresh={handleRefreshSkillsGap}
              onLogProgress={handleLogSkillProgress}
              onAddSkill={handleAddSkill}
            />
          ) : (
            <div className="education-form-card">
              <div className="education-form" style={{ padding: '40px', textAlign: 'center' }}>
                <Icon name="info" size="lg" color="#9ca3af" />
                <p style={{ color: '#9ca3af', marginTop: '16px', fontSize: '15px' }}>
                  No skills gap analysis available for this job yet.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'technical-prep' && (
        <TechnicalPrepSuite
          data={technicalPrep}
          loading={loadingTechnicalPrep}
          error={technicalPrepError}
          onRefresh={handleRefreshTechnicalPrep}
          onPoll={handlePollTechnicalPrep}
          onLogAttempt={handleLogTechnicalAttempt}
          loggingAttemptId={loggingTechnicalAttemptId}
        />
      )}

      {activeTab === 'success-forecast' && (
        <InterviewSuccessForecast
          data={successForecast}
          loading={loadingSuccessForecast}
          error={successForecastError}
          onRefresh={() => loadSuccessForecast(true)}
        />
      )}

      {/* Tab Content - Scheduled Interviews */}
      {activeTab === 'scheduled-interviews' && (
        <div className="education-form-card" id="scheduled-interviews-section">
          <div className="education-form" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                <Icon name="calendar" size="sm" /> Scheduled Interviews
              </h3>
            </div>

            {loadingInterviews ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ color: '#9ca3af' }}>Loading interviews...</p>
              </div>
            ) : jobInterviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Icon name="calendar" size="lg" color="#9ca3af" />
                <p style={{ color: '#9ca3af', marginTop: '16px', fontSize: '15px' }}>
                  No interviews scheduled for this job yet.
                </p>
                <button
                  onClick={() => setShowInterviewScheduler(true)}
                  className="btn-primary"
                  style={{ marginTop: '16px' }}
                >
                  <Icon name="plus" size="sm" /> Schedule Interview
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {jobInterviews.map((interview) => {
                  const scheduledDate = new Date(interview.scheduled_at);
                  const isPast = scheduledDate < new Date();
                  const interviewTypeLabels = {
                    phone: 'Phone Interview',
                    video: 'Video Interview',
                    in_person: 'In-Person Interview'
                  };
                  const interviewTypeColors = {
                    phone: '#8b5cf6',
                    video: '#3b82f6',
                    in_person: '#10b981'
                  };

                  return (
                    <div
                      key={interview.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '20px',
                        background: isPast ? '#f9fafb' : '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: '16px',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#ffffff',
                                background: interviewTypeColors[interview.interview_type] || '#6b7280'
                              }}
                            >
                              {interviewTypeLabels[interview.interview_type] || interview.interview_type}
                            </span>
                            {interview.status && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '4px 12px',
                                  borderRadius: '16px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: interview.status === 'completed' ? '#059669' : interview.status === 'cancelled' ? '#dc2626' : '#6b7280',
                                  background: interview.status === 'completed' ? '#d1fae5' : interview.status === 'cancelled' ? '#fee2e2' : '#f3f4f6'
                                }}
                              >
                                {interview.status}
                              </span>
                            )}
                          </div>
                          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', margin: '0 0 4px 0' }}>
                            {scheduledDate.toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </h4>
                          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                            {scheduledDate.toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit',
                              hour12: true 
                            })}
                            {interview.duration && ` • ${interview.duration} minutes`}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setSelectedInterviewForChecklist(interview);
                              setShowPreparationChecklist(true);
                            }}
                            className="btn-secondary"
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: '13px',
                              color: '#667eea',
                              borderColor: '#667eea'
                            }}
                          >
                            <Icon name="check-square" size="sm" /> Prep Checklist
                          </button>
                          <button
                            onClick={() => {
                              setSelectedInterviewForFollowUp(interview);
                              setShowFollowUpModal(true);
                            }}
                            className="btn-secondary"
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: '13px',
                              color: '#2563eb',
                              borderColor: '#2563eb'
                            }}
                          >
                            <Icon name="mail" size="sm" /> Follow-up
                          </button>
                          <button
                            onClick={() => {
                              setEditingInterviewId(interview.id);
                              setShowInterviewScheduler(true);
                            }}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '13px' }}
                          >
                            <Icon name="edit" size="sm" /> Edit
                          </button>
                          <button
                            onClick={() => setInterviewToDelete(interview)}
                            className="btn-secondary"
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: '13px',
                              color: '#dc2626',
                              borderColor: '#dc2626'
                            }}
                          >
                            <Icon name="trash" size="sm" /> Delete
                          </button>
                        </div>
                      </div>

                      {/* Interview Details */}
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                        {interview.interviewer_name && (
                          <div style={{ marginBottom: '8px' }}>
                            <strong style={{ fontSize: '14px', color: '#4b5563' }}>Interviewer: </strong>
                            <span style={{ fontSize: '14px', color: '#1f2937' }}>{interview.interviewer_name}</span>
                            {interview.interviewer_title && (
                              <span style={{ fontSize: '14px', color: '#6b7280' }}> ({interview.interviewer_title})</span>
                            )}
                          </div>
                        )}
                        {interview.interviewer_email && (
                          <div style={{ marginBottom: '8px' }}>
                            <strong style={{ fontSize: '14px', color: '#4b5563' }}>Email: </strong>
                            <a 
                              href={`mailto:${interview.interviewer_email}`}
                              style={{ fontSize: '14px', color: '#667eea', textDecoration: 'none' }}
                            >
                              {interview.interviewer_email}
                            </a>
                          </div>
                        )}
                        {interview.interview_type === 'in_person' && interview.location && (
                          <div style={{ marginBottom: '8px' }}>
                            <strong style={{ fontSize: '14px', color: '#4b5563' }}>Location: </strong>
                            <span style={{ fontSize: '14px', color: '#1f2937' }}>{interview.location}</span>
                          </div>
                        )}
                        {interview.interview_type === 'video' && interview.meeting_link && (
                          <div style={{ marginBottom: '8px' }}>
                            <strong style={{ fontSize: '14px', color: '#4b5563' }}>Meeting Link: </strong>
                            <a 
                              href={interview.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '14px', color: '#667eea', textDecoration: 'none' }}
                            >
                              Join Meeting
                            </a>
                          </div>
                        )}
                        {interview.preparation_notes && (
                          <div style={{ marginTop: '12px' }}>
                            <strong style={{ fontSize: '14px', color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                              Preparation Notes:
                            </strong>
                            <p style={{ fontSize: '14px', color: '#1f2937', margin: 0, whiteSpace: 'pre-wrap' }}>
                              {interview.preparation_notes}
                            </p>
                          </div>
                        )}
                        {interview.outcome && (
                          <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', borderRadius: '6px' }}>
                            <strong style={{ fontSize: '14px', color: '#059669', display: 'block', marginBottom: '4px' }}>
                              Outcome: {interview.outcome}
                            </strong>
                            {interview.outcome_notes && (
                              <p style={{ fontSize: '14px', color: '#065f46', margin: 0, whiteSpace: 'pre-wrap' }}>
                                {interview.outcome_notes}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interview Scheduler Modal */}
      {showInterviewScheduler && job && (
        <InterviewScheduler
          job={job}
          existingInterview={editingInterviewId ? jobInterviews.find(i => i.id === editingInterviewId) : null}
          onClose={() => {
            setShowInterviewScheduler(false);
            setEditingInterviewId(null);
          }}
          onSuccess={() => {
            setShowInterviewScheduler(false);
            setEditingInterviewId(null);
            setSuccess(editingInterviewId ? 'Interview updated successfully!' : 'Interview scheduled successfully!');
            setTimeout(() => setSuccess(''), 3000);
            // Reload interviews if we're on that tab
            if (activeTab === 'scheduled-interviews') {
              loadInterviews();
            }
          }}
        />
      )}

      {/* UC-081: Preparation Checklist Modal */}
      {showPreparationChecklist && selectedInterviewForChecklist && (
        <PreparationChecklist
          interview={selectedInterviewForChecklist}
          onClose={() => {
            setShowPreparationChecklist(false);
            setSelectedInterviewForChecklist(null);
          }}
        />
      )}

      {/* UC-082: Interview Follow-up Modal */}
      {showFollowUpModal && selectedInterviewForFollowUp && (
        <InterviewFollowUp
          job={job}
          interview={selectedInterviewForFollowUp}
          onClose={() => {
            setShowFollowUpModal(false);
            setSelectedInterviewForFollowUp(null);
          }}
        />
      )}

      {/* Delete Interview Confirmation Modal */}
      {interviewToDelete && (
        <div className="modal-overlay" onClick={() => setInterviewToDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="alert-triangle" size="md" color="#dc2626" />
                Delete Interview
              </h3>
              <button className="modal-close" onClick={() => setInterviewToDelete(null)} aria-label="Close">
                <Icon name="x" size="sm" />
              </button>
            </div>
            <div className="modal-body" style={{ paddingTop: '8px' }}>
              <p style={{ color: '#4b5563', marginBottom: '16px' }}>
                Are you sure you want to delete this interview? This action cannot be undone.
              </p>
              <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', marginBottom: '20px' }}>
                <p style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#1f2937', fontWeight: '600' }}>
                  {interviewToDelete.job_title || job?.title}
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                  {new Date(interviewToDelete.scheduled_at).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  className="btn-secondary"
                  onClick={() => setInterviewToDelete(null)}
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                >
                  Cancel
                </button>
                <button
                  className="btn-danger"
                  onClick={async () => {
                    try {
                      await interviewsAPI.deleteInterview(interviewToDelete.id);
                      setInterviewToDelete(null);
                      setSuccess('Interview deleted successfully!');
                      setTimeout(() => setSuccess(''), 3000);
                      loadInterviews();
                    } catch (err) {
                      setError(err?.message || 'Failed to delete interview');
                      setTimeout(() => setError(''), 3000);
                    }
                  }}
                  style={{ padding: '8px 16px', fontSize: '14px', background: '#dc2626', borderColor: '#dc2626' }}
                >
                  Delete Interview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
        
        {/* Email Sidebar */}
        <div className="job-detail-sidebar">
          <div className="sidebar-sticky">
            <ApplicationEmails jobId={id} showSearch={true} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetailView;
