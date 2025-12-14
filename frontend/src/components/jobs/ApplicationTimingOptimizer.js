/**
 * UC-124: Job Application Timing Optimizer
 * 
 * Main component for scheduling applications, managing reminders,
 * and viewing timing analytics
 */

import React, { useState, useEffect } from 'react';
import { timingAPI } from '../../services/timingAPI';
import ConfirmDialog from '../common/ConfirmDialog';
import './ApplicationTimingOptimizer.css';

const ApplicationTimingOptimizer = () => {
  const [activeTab, setActiveTab] = useState('schedule'); // schedule | reminders | analytics | calendar
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="timing-optimizer">
      <div className="timing-optimizer-header">
        <h1>Application Timing Optimizer</h1>
        <p>Schedule submissions, set reminders, and optimize your application timing</p>
      </div>

      <div className="timing-optimizer-tabs">
        <button
          className={activeTab === 'schedule' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('schedule')}
        >
          Scheduled Submissions
        </button>
        <button
          className={activeTab === 'reminders' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('reminders')}
        >
          Reminders
        </button>
        <button
          className={activeTab === 'analytics' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('analytics')}
        >
          Timing Analytics
        </button>
        <button
          className={activeTab === 'calendar' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('calendar')}
        >
          Calendar View
        </button>
      </div>

      {error && (
        <div className="timing-optimizer-error">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="timing-optimizer-content">
        {activeTab === 'schedule' && <ScheduledSubmissions setError={setError} />}
        {activeTab === 'reminders' && <RemindersList setError={setError} />}
        {activeTab === 'analytics' && <TimingAnalytics setError={setError} />}
        {activeTab === 'calendar' && <CalendarView setError={setError} />}
      </div>
    </div>
  );
};

// ========================================
// Scheduled Submissions Component
// ========================================

const ScheduledSubmissions = ({ setError }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | scheduled | submitted | cancelled
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [confirmExecute, setConfirmExecute] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingSubmission, setEditingSubmission] = useState(null);

  useEffect(() => {
    loadSubmissions();
  }, [filter]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const data = await timingAPI.getScheduledSubmissions(params);
      setSubmissions(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load scheduled submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!confirmExecute) return;
    
    try {
      await timingAPI.executeScheduledSubmission(confirmExecute.id);
      setError('');
      setConfirmExecute(null);
      loadSubmissions();
    } catch (err) {
      setError(err.message || 'Failed to execute submission');
      setConfirmExecute(null);
    }
  };

  const handleCancel = async () => {
    if (!confirmCancel) return;
    
    try {
      await timingAPI.cancelScheduledSubmission(confirmCancel.id, 'Cancelled by user');
      setError('');
      setConfirmCancel(null);
      loadSubmissions();
    } catch (err) {
      setError(err.message || 'Failed to cancel submission');
      setConfirmCancel(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    
    try {
      await timingAPI.deleteScheduledSubmission(confirmDelete.id);
      setError('');
      setConfirmDelete(null);
      loadSubmissions();
    } catch (err) {
      setError(err.message || 'Failed to delete submission');
      setConfirmDelete(null);
    }
  };

  if (loading) {
    return <div className="loading">Loading scheduled submissions...</div>;
  }

  return (
    <div className="scheduled-submissions">
      <div className="submissions-header">
        <h2>Scheduled Submissions</h2>
        <div className="submissions-actions">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="submitted">Submitted</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowScheduleModal(true)}>
            Schedule New Submission
          </button>
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className="empty-state">
          <p>No scheduled submissions found.</p>
          <button className="btn btn-primary" onClick={() => setShowScheduleModal(true)}>
            Schedule Your First Submission
          </button>
        </div>
      ) : (
        <div className="submissions-list">
          {submissions.map((submission) => (
            <SubmissionCard
              key={submission.id}
              submission={submission}
              onExecute={(sub) => setConfirmExecute(sub)}
              onCancel={(sub) => setConfirmCancel(sub)}
              onDelete={(sub) => setConfirmDelete(sub)}
              onEdit={(sub) => setEditingSubmission(sub)}
              onRefresh={loadSubmissions}
            />
          ))}
        </div>
      )}

      {showScheduleModal && (
        <ScheduleSubmissionModal
          onClose={() => setShowScheduleModal(false)}
          onSuccess={() => {
            setShowScheduleModal(false);
            loadSubmissions();
          }}
          setError={setError}
        />
      )}

      {editingSubmission && (
        <EditScheduleSubmissionModal
          submission={editingSubmission}
          onClose={() => setEditingSubmission(null)}
          onSuccess={() => {
            setEditingSubmission(null);
            loadSubmissions();
          }}
          setError={setError}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmExecute}
        onClose={() => setConfirmExecute(null)}
        onConfirm={handleExecute}
        title="Execute Submission Now"
        message={`Are you sure you want to submit the application for "${confirmExecute?.job_title}" at "${confirmExecute?.company_name}" immediately?`}
        confirmText="Submit Now"
        cancelText="Cancel"
        variant="info"
      />

      <ConfirmDialog
        isOpen={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={handleCancel}
        title="Cancel Scheduled Submission"
        message={`Are you sure you want to cancel the scheduled submission for "${confirmCancel?.job_title}"? You can reschedule it later if needed.`}
        confirmText="Cancel Submission"
        cancelText="Keep Scheduled"
        variant="warning"
      />

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Scheduled Submission"
        message={`Are you sure you want to delete the scheduled submission for "${confirmDelete?.job_title}" at "${confirmDelete?.company_name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

const SubmissionCard = ({ submission, onExecute, onCancel, onDelete, onEdit, onRefresh }) => {
  const scheduledDate = new Date(submission.scheduled_datetime);
  const isPast = scheduledDate < new Date();
  
  const getStatusClass = (status) => {
    const classes = {
      scheduled: 'status-scheduled',
      pending: 'status-pending',
      submitted: 'status-submitted',
      cancelled: 'status-cancelled',
      failed: 'status-failed',
    };
    return classes[status] || 'status-default';
  };

  return (
    <div className={`submission-card ${getStatusClass(submission.status)}`}>
      <div className="submission-card-header">
        <div className="submission-info">
          <h3>{submission.job_title}</h3>
          <p className="company-name">{submission.company_name}</p>
          <div className="submission-meta">
            <span className={`status-badge ${getStatusClass(submission.status)}`}>
              ● {submission.status}
            </span>
            <span className="scheduled-time">
              {scheduledDate.toLocaleString()}
              {isPast && submission.status === 'scheduled' && ' (Overdue)'}
            </span>
          </div>
        </div>
        
        <div className="submission-actions">
          {submission.can_execute && (
            <button
              className="btn btn-sm btn-success"
              onClick={() => onExecute(submission)}
              title="Submit now"
            >
              Submit Now
            </button>
          )}
          {submission.can_reschedule && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => onEdit(submission)}
              title="Edit schedule"
            >
              Edit
            </button>
          )}
          {submission.status === 'scheduled' && (
            <button
              className="btn btn-sm btn-warning"
              onClick={() => onCancel(submission)}
              title="Cancel"
            >
              Cancel
            </button>
          )}
          <button
            className="btn btn-sm btn-danger"
            onClick={() => onDelete(submission)}
            title="Delete"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="submission-details">
        <p><strong>Method:</strong> {submission.submission_method}</p>
        <p><strong>Priority:</strong> {submission.priority}</p>
        <p><strong>Timezone:</strong> {submission.timezone}</p>
        {submission.submitted_at && (
          <p><strong>Submitted:</strong> {new Date(submission.submitted_at).toLocaleString()}</p>
        )}
        {submission.error_message && (
          <p className="error-message"><strong>Error:</strong> {submission.error_message}</p>
        )}
      </div>
    </div>
  );
};

// ========================================
// Schedule Submission Modal
// ========================================

const ScheduleSubmissionModal = ({ onClose, onSuccess, setError }) => {
  const [formData, setFormData] = useState({
    job: '',
    application_package: '',
    scheduled_datetime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    submission_method: 'email',
    priority: 5,
  });
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    // Load available jobs
    loadJobsAndPackages();
  }, []);

  useEffect(() => {
    // Load application packages when a job is selected
    if (formData.job) {
      loadApplicationPackages(formData.job);
    } else {
      setPackages([]);
    }
  }, [formData.job]);

  const loadJobsAndPackages = async () => {
    try {
      // Import the jobsAPI
      const { jobsAPI } = await import('../../services/api');
      
      // Fetch jobs
      const jobsData = await jobsAPI.getJobs();
      setJobs(Array.isArray(jobsData) ? jobsData : []);
    } catch (err) {
      console.error('Failed to load jobs:', err);
      setJobs([]);
    }
  };

  const loadApplicationPackages = async (jobId) => {
    try {
      const { materialsAPI } = await import('../../services/api');
      
      // Fetch application packages for the job
      const packagesData = await materialsAPI.getApplicationPackages(jobId);
      setPackages(Array.isArray(packagesData) ? packagesData : []);
    } catch (err) {
      console.error('Failed to load application packages:', err);
      setPackages([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepare data - convert empty string to null for optional fields
      const submitData = {
        ...formData,
        application_package: formData.application_package || null,
      };
      await timingAPI.createScheduledSubmission(submitData);
      onSuccess();
    } catch (err) {
      if (err?.quality) {
        const score = err.quality?.score ? ` (score ${Math.round(err.quality.score)}%)` : '';
        setError((err.message || 'Quality gate blocked this submission') + score + '. Open the job Quality Score tab to improve it.');
      } else {
        setError(err.message || 'Failed to schedule submission');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Schedule Application Submission</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Job *</label>
            <select
              value={formData.job}
              onChange={(e) => setFormData({ ...formData, job: e.target.value })}
              required
            >
              <option value="">Select a job</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} at {job.company_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Application Package {packages.length > 0 ? '*' : '(Optional)'}</label>
            <select
              value={formData.application_package}
              onChange={(e) => setFormData({ ...formData, application_package: e.target.value })}
              required={packages.length > 0}
              disabled={!formData.job}
            >
              <option value="">
                {!formData.job ? 'Select a job first' : packages.length === 0 ? 'No packages available' : 'Select a package'}
              </option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.resume_doc_name || 'Resume'} + {pkg.cover_letter_doc_name || 'Cover Letter'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Scheduled Date & Time *</label>
            <input
              type="datetime-local"
              value={formData.scheduled_datetime}
              onChange={(e) => setFormData({ ...formData, scheduled_datetime: e.target.value })}
              required
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          <div className="form-group">
            <label>Submission Method</label>
            <select
              value={formData.submission_method}
              onChange={(e) => setFormData({ ...formData, submission_method: e.target.value })}
            >
              <option value="email">Email</option>
              <option value="portal">Online Portal</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Priority (1-10)</label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              min="1"
              max="10"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Scheduling...' : 'Schedule Submission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========================================
// Edit Schedule Submission Modal
// ========================================

const EditScheduleSubmissionModal = ({ submission, onClose, onSuccess, setError }) => {
  const [formData, setFormData] = useState({
    job: submission.job || '',
    application_package: submission.application_package || '',
    scheduled_datetime: submission.scheduled_datetime ? new Date(submission.scheduled_datetime).toISOString().slice(0, 16) : '',
    timezone: submission.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    submission_method: submission.submission_method || 'email',
    priority: submission.priority || 5,
  });
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    loadJobsAndPackages();
  }, []);

  useEffect(() => {
    if (formData.job) {
      loadApplicationPackages(formData.job);
    } else {
      setPackages([]);
    }
  }, [formData.job]);

  const loadJobsAndPackages = async () => {
    try {
      const { jobsAPI } = await import('../../services/api');
      const jobsData = await jobsAPI.getJobs();
      setJobs(Array.isArray(jobsData) ? jobsData : []);
    } catch (err) {
      console.error('Failed to load jobs:', err);
      setJobs([]);
    }
  };

  const loadApplicationPackages = async (jobId) => {
    try {
      const { materialsAPI } = await import('../../services/api');
      const packagesData = await materialsAPI.getApplicationPackages(jobId);
      setPackages(Array.isArray(packagesData) ? packagesData : []);
    } catch (err) {
      console.error('Failed to load application packages:', err);
      setPackages([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        application_package: formData.application_package || null,
      };
      await timingAPI.updateScheduledSubmission(submission.id, submitData);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to update scheduled submission');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Scheduled Submission</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Job *</label>
            <select
              value={formData.job}
              onChange={(e) => setFormData({ ...formData, job: e.target.value })}
              required
            >
              <option value="">Select a job</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} at {job.company_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Application Package {packages.length > 0 ? '*' : '(Optional)'}</label>
            <select
              value={formData.application_package}
              onChange={(e) => setFormData({ ...formData, application_package: e.target.value })}
              required={packages.length > 0}
              disabled={!formData.job}
            >
              <option value="">
                {!formData.job ? 'Select a job first' : packages.length === 0 ? 'No packages available' : 'Select a package'}
              </option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.resume_doc_name || 'Resume'} + {pkg.cover_letter_doc_name || 'Cover Letter'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Scheduled Date & Time *</label>
            <input
              type="datetime-local"
              value={formData.scheduled_datetime}
              onChange={(e) => setFormData({ ...formData, scheduled_datetime: e.target.value })}
              required
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          <div className="form-group">
            <label>Submission Method *</label>
            <select
              value={formData.submission_method}
              onChange={(e) => setFormData({ ...formData, submission_method: e.target.value })}
              required
            >
              <option value="email">Email</option>
              <option value="portal">Job Portal</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>

          <div className="form-group">
            <label>Timezone *</label>
            <input
              type="text"
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Priority (1-10)</label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              min="1"
              max="10"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Update Submission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========================================
// Reminders List Component
// ========================================

const RemindersList = ({ setError }) => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadReminders();
  }, [filter]);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const data = await timingAPI.getReminders(params);
      setReminders(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load reminders');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await timingAPI.dismissReminder(id);
      loadReminders();
    } catch (err) {
      setError(err.message || 'Failed to dismiss reminder');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    
    try {
      await timingAPI.deleteReminder(confirmDelete.id);
      setConfirmDelete(null);
      loadReminders();
    } catch (err) {
      setError(err.message || 'Failed to delete reminder');
      setConfirmDelete(null);
    }
  };

  if (loading) {
    return <div className="loading">Loading reminders...</div>;
  }

  return (
    <div className="reminders-list">
      <div className="reminders-header">
        <h2>Reminders</h2>
        <div className="reminders-actions">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            Create Reminder
          </button>
        </div>
      </div>

      {reminders.length === 0 ? (
        <div className="empty-state">
          <p>No reminders found.</p>
        </div>
      ) : (
        <div className="reminders-grid">
          {reminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              onDismiss={handleDismiss}
              onDelete={(reminder) => setConfirmDelete(reminder)}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateReminderModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadReminders();
          }}
          setError={setError}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Reminder"
        message={`Are you sure you want to delete the reminder "${confirmDelete?.subject}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

const ReminderCard = ({ reminder, onDismiss, onDelete }) => {
  const scheduledDate = new Date(reminder.scheduled_datetime);
  const isOverdue = reminder.is_overdue;

  return (
    <div className={`reminder-card ${isOverdue ? 'overdue' : ''}`}>
      <div className="reminder-header">
        <span className={`reminder-type ${reminder.reminder_type}`}>
          {reminder.reminder_type.replace('_', ' ')}
        </span>
        <span className={`reminder-status status-${reminder.status}`}>
          {reminder.status}
        </span>
      </div>
      
      <h3>{reminder.subject}</h3>
      <p className="reminder-job">
        {reminder.job_title} at {reminder.company_name}
      </p>
      
      <div className="reminder-time">
        <strong>Scheduled:</strong> {scheduledDate.toLocaleString()}
        {isOverdue && <span className="overdue-badge">Overdue</span>}
      </div>
      
      {reminder.is_recurring && (
        <div className="reminder-recurring">
          Recurring every {reminder.interval_days} days
          ({reminder.occurrence_count}/{reminder.max_occurrences})
        </div>
      )}
      
      <div className="reminder-actions">
        {reminder.status === 'pending' && (
          <button className="btn btn-sm btn-secondary" onClick={() => onDismiss(reminder.id)}>
            Dismiss
          </button>
        )}
        <button className="btn btn-sm btn-danger" onClick={() => onDelete(reminder)}>
          Delete
        </button>
      </div>
    </div>
  );
};

// ========================================
// Create Reminder Modal
// ========================================

const CreateReminderModal = ({ onClose, onSuccess, setError }) => {
  const [formData, setFormData] = useState({
    job: '',
    reminder_type: 'application_deadline',
    subject: '',
    message_template: '',
    scheduled_datetime: '',
    is_recurring: false,
    interval_days: 7,
    max_occurrences: 1,
  });
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const { jobsAPI } = await import('../../services/api');
      const jobsData = await jobsAPI.getJobs();
      setJobs(Array.isArray(jobsData) ? jobsData : []);
    } catch (err) {
      console.error('Failed to load jobs:', err);
      setJobs([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Transform formData to handle optional fields properly
      const data = {
        ...formData,
        job: formData.job || null,
        // Set interval_days to null if not recurring
        interval_days: formData.is_recurring ? (formData.interval_days || null) : null,
      };
      
      await timingAPI.createReminder(data);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to create reminder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Reminder</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Job *</label>
            <select
              value={formData.job}
              onChange={(e) => setFormData({ ...formData, job: e.target.value })}
              required
            >
              <option value="">Select a job</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} at {job.company_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Reminder Type *</label>
            <select
              value={formData.reminder_type}
              onChange={(e) => setFormData({ ...formData, reminder_type: e.target.value })}
              required
            >
              <option value="application_deadline">Application Deadline</option>
              <option value="application_followup">Application Follow-up</option>
              <option value="interview_followup">Interview Follow-up</option>
              <option value="offer_response">Offer Response</option>
              <option value="thank_you">Thank You Note</option>
              <option value="status_inquiry">Status Inquiry</option>
            </select>
          </div>

          <div className="form-group">
            <label>Subject *</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Reminder subject"
              required
            />
          </div>

          <div className="form-group">
            <label>Message *</label>
            <textarea
              value={formData.message_template}
              onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
              placeholder="Reminder message (use {user_name}, {job_title}, {company_name} as placeholders)"
              rows={4}
              required
            />
          </div>

          <div className="form-group">
            <label>Scheduled Date & Time *</label>
            <input
              type="datetime-local"
              value={formData.scheduled_datetime}
              onChange={(e) => setFormData({ ...formData, scheduled_datetime: e.target.value })}
              required
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
              />
              Recurring reminder
            </label>
          </div>

          {formData.is_recurring && (
            <>
              <div className="form-group">
                <label>Repeat every (days)</label>
                <input
                  type="number"
                  value={formData.interval_days}
                  onChange={(e) => setFormData({ ...formData, interval_days: parseInt(e.target.value) })}
                  min="1"
                />
              </div>

              <div className="form-group">
                <label>Maximum occurrences</label>
                <input
                  type="number"
                  value={formData.max_occurrences}
                  onChange={(e) => setFormData({ ...formData, max_occurrences: parseInt(e.target.value) })}
                  min="1"
                />
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========================================
// Timing Analytics Component
// ========================================

const TimingAnalytics = ({ setError }) => {
  const [analytics, setAnalytics] = useState(null);
  const [bestPractices, setBestPractices] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [analyticsData, practicesData] = await Promise.all([
        timingAPI.getTimingAnalytics(),
        timingAPI.getBestPractices(),
      ]);
      setAnalytics(analyticsData);
      setBestPractices(practicesData);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading analytics...</div>;
  }

  return (
    <div className="timing-analytics">
      <h2>Application Timing Analytics</h2>

      {/* Best Practices Section */}
      {bestPractices && (
        <div className="best-practices-section">
          <h3>Best Practices</h3>
          <div className="practices-grid">
            <div className="practice-card">
              <h4>Best Days to Apply</h4>
              <ul>
                {bestPractices.best_days.map((day, idx) => (
                  <li key={idx}>
                    <strong>{day.day}:</strong> {day.reason}
                  </li>
                ))}
              </ul>
            </div>

            <div className="practice-card">
              <h4>Best Times to Apply</h4>
              <ul>
                {bestPractices.best_hours.map((time, idx) => (
                  <li key={idx}>
                    <strong>{time.time_range}:</strong> {time.reason}
                  </li>
                ))}
              </ul>
            </div>

            <div className="practice-card">
              <h4>Avoid These Times</h4>
              <ul>
                {bestPractices.avoid_times.map((time, idx) => (
                  <li key={idx}>{time}</li>
                ))}
              </ul>
            </div>

            <div className="practice-card">
              <h4>General Tips</h4>
              <ul>
                {bestPractices.general_tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Personal Analytics Section */}
      {analytics && analytics.total_applications > 0 && (
        <div className="personal-analytics-section">
          <h3>Your Performance</h3>
          
          <div className="analytics-summary">
            <div className="stat-card">
              <div className="stat-value">{analytics.total_applications}</div>
              <div className="stat-label">Total Applications</div>
            </div>
            
            {analytics.avg_days_to_response && (
              <div className="stat-card">
                <div className="stat-value">{analytics.avg_days_to_response}</div>
                <div className="stat-label">Avg Days to Response</div>
              </div>
            )}
            
            {analytics.best_performing_day && (
              <div className="stat-card highlight">
                <div className="stat-value">{analytics.best_performing_day.day}</div>
                <div className="stat-label">Best Day ({analytics.best_performing_day.rate}% response)</div>
              </div>
            )}
            
            {analytics.best_performing_hour && (
              <div className="stat-card highlight">
                <div className="stat-value">{analytics.best_performing_hour.hour}</div>
                <div className="stat-label">Best Time ({analytics.best_performing_hour.rate}% response)</div>
              </div>
            )}
          </div>

          {analytics.recommendations && analytics.recommendations.length > 0 && (
            <div className="recommendations">
              <h4>Recommendations</h4>
              <ul>
                {analytics.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Charts would go here */}
          <div className="charts-section">
            <div className="chart-card">
              <h4>Response Rate by Day of Week</h4>
              {/* Add chart visualization */}
              <div className="simple-bar-chart">
                {Object.entries(analytics.response_rate_by_day).map(([day, rate]) => (
                  <div key={day} className="bar-item">
                    <div className="bar-label">{day}</div>
                    <div className="bar-container">
                      <div className="bar-fill" style={{ width: `${rate}%` }}></div>
                    </div>
                    <div className="bar-value">{rate}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card">
              <h4>Submissions by Day of Week</h4>
              <div className="simple-bar-chart">
                {Object.entries(analytics.submissions_by_day).map(([day, count]) => (
                  <div key={day} className="bar-item">
                    <div className="bar-label">{day}</div>
                    <div className="bar-container">
                      <div className="bar-fill" style={{ width: `${(count / Math.max(...Object.values(analytics.submissions_by_day))) * 100}%` }}></div>
                    </div>
                    <div className="bar-value">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {analytics && analytics.total_applications === 0 && (
        <div className="empty-state">
          <p>No application data available yet. Start applying to jobs to see your personalized timing analytics!</p>
        </div>
      )}
    </div>
  );
};

// ========================================
// Calendar View Component
// ========================================

const CalendarView = ({ setError }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadCalendar();
  }, [currentMonth]);

  const loadCalendar = async () => {
    setLoading(true);
    try {
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const data = await timingAPI.getCalendarView(
        startDate.toISOString(),
        endDate.toISOString()
      );
      setEvents(data.events || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ day: null, events: [] });
    }
    
    // Add actual days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate.getDate() === day && 
               eventDate.getMonth() === month && 
               eventDate.getFullYear() === year;
      });
      
      days.push({ day, date, events: dayEvents });
    }
    
    return days;
  };
  
  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  if (loading) {
    return <div className="loading">Loading calendar...</div>;
  }

  const calendarDays = generateCalendarDays();

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <button onClick={() => navigateMonth(-1)}>←</button>
        <h2>
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={() => navigateMonth(1)}>→</button>
      </div>

      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="calendar-day-header">{day}</div>
        ))}
        
        {calendarDays.map((dayInfo, index) => (
          <div 
            key={index} 
            className={`calendar-day ${!dayInfo.day ? 'empty' : ''} ${isToday(dayInfo.date) ? 'today' : ''} ${dayInfo.events.length > 0 ? 'has-events' : ''}`}
          >
            {dayInfo.day && (
              <>
                <div className="day-number">{dayInfo.day}</div>
                {dayInfo.events.length > 0 && (
                  <div className="day-events">
                    {dayInfo.events.map((event) => (
                      <div 
                        key={event.id} 
                        className={`event-dot ${event.type}`}
                        title={`${event.title} - ${event.company}`}
                      >
                        <span className="event-mini">{event.type === 'scheduled' ? '📅' : '✓'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {events.length > 0 && (
        <div className="calendar-events-list">
          <h3>Events This Month</h3>
          <ul>
            {events.map((event) => (
              <li key={event.id}>
                <span className={`event-type ${event.type}`}>
                  {event.type === 'scheduled' ? '📅' : '✓'}
                </span>
                <span className="event-title">{event.title}</span>
                <span className="event-company">{event.company}</span>
                <span className="event-date">
                  {new Date(event.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {events.length === 0 && (
        <div className="empty-state">
          <p>No scheduled submissions or applications this month.</p>
          <p>Use the "Scheduled Submissions" tab to schedule your first submission!</p>
        </div>
      )}
    </div>
  );
};

export default ApplicationTimingOptimizer;
