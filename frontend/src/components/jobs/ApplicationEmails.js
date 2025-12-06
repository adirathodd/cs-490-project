import React, { useState, useEffect } from 'react';
import emailAPI from '../../services/emailAPI';
import Toast from '../common/Toast';
import './ApplicationEmails.css';

const ApplicationEmails = ({ jobId, onRefresh }) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'info' });

  useEffect(() => {
    loadEmails();
  }, [jobId]);

  const loadEmails = async () => {
    setLoading(true);
    try {
      const params = jobId ? { job_id: jobId } : {};
      const data = await emailAPI.getEmails(params);
      setEmails(data);
    } catch (error) {
      console.error('Failed to load emails:', error);
      // Don't show error toast - just set empty array and let UI show "no emails found"
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyStatus = async (emailId) => {
    try {
      await emailAPI.applyStatusSuggestion(emailId);
      await loadEmails();
      setToast({
        isOpen: true,
        message: 'Status applied successfully',
        type: 'success'
      });
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to apply status:', error);
      setToast({
        isOpen: true,
        message: 'Failed to apply status',
        type: 'error'
      });
    }
  };

  const handleDismiss = async (emailId) => {
    try {
      await emailAPI.dismissEmail(emailId);
      await loadEmails();
      setToast({
        isOpen: true,
        message: 'Email suggestion dismissed',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to dismiss email:', error);
      setToast({
        isOpen: true,
        message: 'Failed to dismiss email',
        type: 'error'
      });
    }
  };

  if (loading) {
    return <div className="emails-loading">Loading emails...</div>;
  }

  if (emails.length === 0) {
    return (
      <>
        <div className="application-emails">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            Related Emails (0)
          </h3>
          <div className="no-emails">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <p>No related emails found for this application.</p>
            <small>Emails will appear here automatically when detected by our scanner.</small>
          </div>
        </div>
        <Toast
          isOpen={toast.isOpen}
          onClose={() => setToast({ ...toast, isOpen: false })}
          message={toast.message}
          type={toast.type}
        />
      </>
    );
  }

  return (
    <>
    <div className="application-emails">
      <h3>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
        Related Emails ({emails.length})
      </h3>
      <div className="emails-list">
        {emails.map((email) => (
          <div key={email.id} className={`email-card ${email.suggested_job_status ? 'has-suggestion' : ''} email-type-${email.email_type}`}>
            <div className="email-header">
              <div className="email-meta">
                <strong>{email.sender_name || email.sender_email}</strong>
                {email.sender_email && email.sender_name && (
                  <span className="sender-email"> ({email.sender_email})</span>
                )}
                <span className="email-date">
                  {new Date(email.received_at).toLocaleDateString()}
                </span>
              </div>
              {email.suggested_job_status && (
                <span className={`status-badge status-${email.suggested_job_status}`}>
                  Suggested: {email.suggested_job_status}
                </span>
              )}
            </div>
            
            <div className="email-subject">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              {email.subject}
            </div>
            
            {email.snippet && (
              <div className="email-snippet">{email.snippet}</div>
            )}
            
            {email.suggested_job_status && (
              <div className="email-actions">
                <button 
                  onClick={() => handleApplyStatus(email.id)}
                  className="btn-apply-status"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Apply Suggested Status
                </button>
                <button 
                  onClick={() => handleDismiss(email.id)}
                  className="btn-dismiss"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"></path>
                  </svg>
                  Dismiss
                </button>
              </div>
            )}
            
            <div className="email-footer">
              {email.confidence_score && (
                <span className="confidence-score">
                  Confidence: {(email.confidence_score * 100).toFixed(0)}%
                </span>
              )}
              <a 
                href={email.gmail_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="view-in-gmail"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                View in Gmail
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
    
    <Toast
      isOpen={toast.isOpen}
      onClose={() => setToast({ ...toast, isOpen: false })}
      message={toast.message}
      type={toast.type}
    />
    </>
  );
};

export default ApplicationEmails;
