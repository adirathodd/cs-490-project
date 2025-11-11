import React, { useState } from 'react';
import Icon from '../common/Icon';
import './ScheduledSubmissions.css';
import { automationAPI } from '../../services/automationAPI';

const ScheduledSubmissions = ({ submissions, onRefresh }) => {
  const [showMenu, setShowMenu] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [submissionToCancel, setSubmissionToCancel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMenuToggle = (submissionId) => {
    setShowMenu(showMenu === submissionId ? null : submissionId);
    const submission = submissions.find(s => s.id === submissionId);
    setSelectedSubmission(submission);
  };

  const handleExecuteNow = async (submission) => {
    setLoading(true);
    setShowMenu(null);
    try {
      await automationAPI.executeScheduledSubmission(submission.id);
      setError('');
      onRefresh();
    } catch (error) {
      setError('Failed to execute submission now');
      console.error('Execute submission error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = (submission) => {
    setSubmissionToCancel(submission);
    setShowCancelDialog(true);
    setShowMenu(null);
  };

  const handleCancelConfirm = async () => {
    if (submissionToCancel) {
      setLoading(true);
      try {
        await automationAPI.cancelScheduledSubmission(submissionToCancel.id);
        setShowCancelDialog(false);
        setSubmissionToCancel(null);
        setError('');
        onRefresh();
      } catch (error) {
        setError('Failed to cancel submission');
        console.error('Cancel submission error:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatDateTime = (datetime) => {
    return new Date(datetime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusIcon = (status) => {
    const icons = {
      'pending': 'calendar',
      'executing': 'sync-alt',
      'completed': 'check',
      'failed': 'times-circle',
      'cancelled': 'times-circle'
    };
    return icons[status] || 'calendar';
  };

  const getStatusClass = (status) => {
    return `status status-${status}`;
  };

  const getMethodLabel = (method) => {
    const methods = {
      'email': 'Email',
      'portal': 'Company Portal',
      'linkedin': 'LinkedIn',
      'manual': 'Manual Review'
    };
    return methods[method] || method;
  };

  const isOverdue = (scheduledTime, status) => {
    if (status !== 'pending') return false;
    return new Date(scheduledTime) < new Date();
  };

  if (submissions.length === 0) {
    return (
      <div className="submissions-empty">
        <Icon name="calendar" size="xl" color="var(--gray-400)" />
        <h3>No Scheduled Submissions</h3>
        <p>Automated application submissions will appear here when scheduled.</p>
      </div>
    );
  }

  return (
    <div className="scheduled-submissions">
      {error && (
        <div className="error-alert">
          <Icon name="times-circle" size="sm" />
          {error}
          <button onClick={() => setError('')} className="close-btn">
            <Icon name="times" size="sm" />
          </button>
        </div>
      )}

      <div className="submissions-table-container">
        <table className="submissions-table">
          <thead>
            <tr>
              <th>Job Details</th>
              <th>Scheduled Time</th>
              <th>Method</th>
              <th>Package</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((submission) => (
              <tr 
                key={submission.id}
                className={isOverdue(submission.scheduled_datetime, submission.status) ? 'overdue' : ''}
              >
                <td className="job-details">
                  <div className="job-title">{submission.job?.title || 'Unknown Position'}</div>
                  <div className="company-name">{submission.job?.company_name || 'Unknown Company'}</div>
                </td>
                
                <td className="scheduled-time">
                  <div className="datetime">{formatDateTime(submission.scheduled_datetime)}</div>
                  {isOverdue(submission.scheduled_datetime, submission.status) && (
                    <div className="overdue-badge">Overdue</div>
                  )}
                </td>
                
                <td className="method">
                  {getMethodLabel(submission.submission_method)}
                </td>
                
                <td className="package">
                  {submission.application_package ? (
                    <button className="package-link">
                      <Icon name="folder-open" size="sm" />
                      View Package
                    </button>
                  ) : (
                    <span className="no-package">No Package</span>
                  )}
                </td>
                
                <td className="status">
                  <span className={getStatusClass(submission.status)}>
                    <Icon name={getStatusIcon(submission.status)} size="sm" />
                    {submission.status.replace('_', ' ')}
                  </span>
                </td>
                
                <td className="actions">
                  <div className="actions-menu">
                    <button 
                      className="menu-trigger"
                      onClick={() => handleMenuToggle(submission.id)}
                      disabled={loading}
                    >
                      <Icon name="chevron-down" size="sm" />
                    </button>
                    
                    {showMenu === submission.id && (
                      <div className="menu-dropdown">
                        {submission.status === 'pending' && (
                          <button 
                            className="menu-item"
                            onClick={() => handleExecuteNow(submission)}
                          >
                            <Icon name="sync-alt" size="sm" />
                            Execute Now
                          </button>
                        )}
                        {submission.status === 'pending' && (
                          <button 
                            className="menu-item danger"
                            onClick={() => handleCancelClick(submission)}
                          >
                            <Icon name="times-circle" size="sm" />
                            Cancel Submission
                          </button>
                        )}
                        {submission.application_package && (
                          <button className="menu-item">
                            <Icon name="eye" size="sm" />
                            View Package
                          </button>
                        )}
                        <button className="menu-item">
                          <Icon name="edit" size="sm" />
                          Edit Schedule
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <div className="modal-overlay" onClick={() => setShowCancelDialog(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cancel Scheduled Submission</h3>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to cancel the scheduled submission for{' '}
                "<strong>{submissionToCancel?.job?.title}</strong>" at "<strong>{submissionToCancel?.job?.company_name}</strong>"?
                This action cannot be undone.
              </p>
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => setShowCancelDialog(false)}
                className="btn-secondary"
              >
                Keep Scheduled
              </button>
              <button 
                onClick={handleCancelConfirm}
                className="btn-danger"
                disabled={loading}
              >
                <Icon name="times-circle" size="sm" />
                Cancel Submission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduledSubmissions;