import React, { useState, useEffect } from 'react';
import { interviewsAPI } from '../../services/api';
import Icon from '../common/Icon';
import './InterviewScheduler.css';

export default function InterviewScheduler({ job, onClose, onSuccess, existingInterview = null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState([]);

  const withRetry = async (fn, retries = 2, delay = 0) => {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        const isNetwork = err?.message === 'Network error' || err?.name === 'TypeError';
        if (!isNetwork || attempt === retries) {
          throw err;
        }
        if (delay) {
          await new Promise((res) => setTimeout(res, delay));
        }
      }
    }
  };
  
  const [formData, setFormData] = useState({
    interview_type: 'video',
    scheduled_at: '',
    duration_minutes: 60,
    location: '',
    meeting_link: '',
    interviewer_name: '',
    interviewer_email: '',
    interviewer_title: '',
    preparation_notes: '',
  });

  useEffect(() => {
    if (existingInterview) {
      // Populate form with existing interview data
      setFormData({
        interview_type: existingInterview.interview_type || 'video',
        scheduled_at: existingInterview.scheduled_at?.slice(0, 16) || '', // Format for datetime-local input
        duration_minutes: existingInterview.duration_minutes || 60,
        location: existingInterview.location || '',
        meeting_link: existingInterview.meeting_link || '',
        interviewer_name: existingInterview.interviewer_name || '',
        interviewer_email: existingInterview.interviewer_email || '',
        interviewer_title: existingInterview.interviewer_title || '',
        preparation_notes: existingInterview.preparation_notes || '',
      });
    }
  }, [existingInterview]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    setConflicts([]);
  };

  const validateForm = () => {
    if (!formData.scheduled_at) {
      setError('Please select a date and time');
      return false;
    }
    
    if (formData.interview_type === 'in_person' && !formData.location) {
      setError('Location is required for in-person interviews');
      return false;
    }
    
    if (formData.interview_type === 'video' && !formData.meeting_link) {
      setError('Meeting link is required for video interviews');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Convert datetime-local format to ISO string
      const scheduledDate = new Date(formData.scheduled_at);
      const payload = {
        ...formData,
        job: job.id,
        scheduled_at: scheduledDate.toISOString(),
      };

      if (existingInterview) {
        // Update existing interview
        await withRetry(() => interviewsAPI.updateInterview(existingInterview.id, payload));
      } else {
        // Create new interview
        await withRetry(() => interviewsAPI.createInterview(payload));
      }
      
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      console.error('Interview scheduling error:', err);
      if (err) {
        try {
          console.error('Error keys:', Object.keys(err));
          console.error('Error structure:', JSON.stringify(err, null, 2));
        } catch (e) {
          console.error('Unable to inspect error object:', e);
        }
      }
      
      // Check for conflicts
      if (err.conflicts && err.conflicts.length > 0) {
        setConflicts(err.conflicts);
        setError('Scheduling conflict detected. See details below.');
      } else if (err.scheduled_at) {
        // Field-specific error from backend (likely a conflict message)
        // DRF can return errors as arrays or strings
        const errorMsg = Array.isArray(err.scheduled_at) ? err.scheduled_at[0] : err.scheduled_at;
        setError(errorMsg);
      } else if (err.non_field_errors) {
        // General validation errors
        const errorMsg = Array.isArray(err.non_field_errors) ? err.non_field_errors[0] : err.non_field_errors;
        setError(errorMsg);
      } else if (err.error) {
        // Check for generic error field that backend might return
        const errorMsg = Array.isArray(err.error) ? err.error[0] : err.error;
        setError(errorMsg);
      } else if (err?.message === 'Network error' || err?.name === 'TypeError') {
        setError('Network error: Unable to schedule interview due to network issues. Please try again later.');
      } else {
        // Extract first available error message from any field
        let errorMsg = err.message || (existingInterview ? 'Failed to update interview' : 'Failed to create interview');
        
        // Try to find any error message in the error object
        if (typeof err === 'object' && err !== null) {
          for (const key in err) {
            if (err[key] && typeof err[key] === 'string') {
              errorMsg = err[key];
              break;
            } else if (Array.isArray(err[key]) && err[key].length > 0 && typeof err[key][0] === 'string') {
              errorMsg = err[key][0];
              break;
            }
          }
        }
        
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const interviewTypeOptions = [
    { value: 'phone', label: 'Phone Screen', icon: 'phone' },
    { value: 'video', label: 'Video Interview', icon: 'video' },
    { value: 'in_person', label: 'In-Person Interview', icon: 'map-pin' },
    { value: 'assessment', label: 'Technical Assessment', icon: 'file-text' },
    { value: 'group', label: 'Group Interview', icon: 'users' },
  ];

  const durationOptions = [30, 45, 60, 90, 120, 180];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content interview-scheduler" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <Icon name="calendar" size="md" />
            {existingInterview ? 'Reschedule Interview' : 'Schedule Interview'}
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="x" size="sm" />
          </button>
        </div>

        <div className="modal-body">
          <div className="job-info">
            <h4>{job.title}</h4>
            <p>{job.company_name}</p>
          </div>

          {error && (
            <div className="error-banner">
              <Icon name="alert-circle" size="sm" />
              {error}
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="conflict-warning">
              <Icon name="alert-triangle" size="sm" />
              <div>
                <strong>Scheduling Conflicts:</strong>
                <ul>
                  {conflicts.map((conflict, idx) => (
                    <li key={idx}>
                      {conflict.job_title} @ {conflict.job_company} - {new Date(conflict.scheduled_at).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Interview Type */}
            <div className="form-group">
              <label htmlFor="interview_type">
                Interview Type <span className="required">*</span>
              </label>
              <div className="interview-type-grid">
                {interviewTypeOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={`interview-type-btn ${formData.interview_type === option.value ? 'active' : ''}`}
                    onClick={() => handleChange({ target: { name: 'interview_type', value: option.value } })}
                  >
                    <Icon name={option.icon} size="md" />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Time */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="scheduled_at">
                  Date & Time <span className="required">*</span>
                </label>
                <input
                  type="datetime-local"
                  id="scheduled_at"
                  name="scheduled_at"
                  value={formData.scheduled_at}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="duration_minutes">Duration (minutes)</label>
                <select
                  id="duration_minutes"
                  name="duration_minutes"
                  value={formData.duration_minutes}
                  onChange={handleChange}
                >
                  {durationOptions.map(duration => (
                    <option key={duration} value={duration}>{duration} min</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Conditional fields based on interview type */}
            {formData.interview_type === 'in_person' && (
              <div className="form-group">
                <label htmlFor="location">
                  Location <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., 123 Main St, Suite 500, New York, NY"
                  required
                />
              </div>
            )}

            {formData.interview_type === 'video' && (
              <div className="form-group">
                <label htmlFor="meeting_link">
                  Meeting Link <span className="required">*</span>
                </label>
                <input
                  type="url"
                  id="meeting_link"
                  name="meeting_link"
                  value={formData.meeting_link}
                  onChange={handleChange}
                  placeholder="https://zoom.us/j/..."
                  required
                />
              </div>
            )}

            {(formData.interview_type === 'phone' || formData.interview_type === 'video') && (
              <div className="form-group">
                <label htmlFor="location">Location / Notes (optional)</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Additional location or call-in details"
                />
              </div>
            )}

            {/* Interviewer Details */}
            <div className="form-section-header">
              <Icon name="user" size="sm" /> Interviewer Information
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="interviewer_name">Name</label>
                <input
                  type="text"
                  id="interviewer_name"
                  name="interviewer_name"
                  value={formData.interviewer_name}
                  onChange={handleChange}
                  placeholder="John Doe"
                />
              </div>

              <div className="form-group">
                <label htmlFor="interviewer_title">Title</label>
                <input
                  type="text"
                  id="interviewer_title"
                  name="interviewer_title"
                  value={formData.interviewer_title}
                  onChange={handleChange}
                  placeholder="Senior Engineer"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="interviewer_email">Email</label>
              <input
                type="email"
                id="interviewer_email"
                name="interviewer_email"
                value={formData.interviewer_email}
                onChange={handleChange}
                placeholder="interviewer@company.com"
              />
            </div>

            {/* Preparation Notes */}
            <div className="form-group">
              <label htmlFor="preparation_notes">
                <Icon name="file-text" size="xs" /> Preparation Notes
              </label>
              <textarea
                id="preparation_notes"
                name="preparation_notes"
                value={formData.preparation_notes}
                onChange={handleChange}
                rows={4}
                placeholder="Key points to prepare, questions to ask, topics to review..."
              />
            </div>

            {/* Action Buttons */}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Saving...' : existingInterview ? 'Update Interview' : 'Schedule Interview'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
