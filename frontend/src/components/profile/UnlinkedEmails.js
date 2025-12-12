import React, { useState, useEffect } from 'react';
import emailAPI from '../../services/emailAPI';
import { jobsAPI } from '../../services/api';
import Toast from '../common/Toast';
import './UnlinkedEmails.css';

const UnlinkedEmails = () => {
  const [emails, setEmails] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linkingEmail, setLinkingEmail] = useState(null);
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'info' });
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  
  // Search filters (UC-113)
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
    
    // Listen for Gmail disconnect events
    const handleGmailDisconnect = () => {
      setEmails([]);
      setIsGmailConnected(false);
      setLoading(false);
    };
    
    // Listen for Gmail scan events to reload emails
    const handleGmailScan = () => {
      loadData();
    };
    
    window.addEventListener('gmail-disconnected', handleGmailDisconnect);
    window.addEventListener('gmail-scan-complete', handleGmailScan);
    
    return () => {
      window.removeEventListener('gmail-disconnected', handleGmailDisconnect);
      window.removeEventListener('gmail-scan-complete', handleGmailScan);
    };
  }, []);

  // Reload when search query changes (with debounce)
  useEffect(() => {
    if (!isGmailConnected) return;
    
    const timeoutId = setTimeout(() => {
      loadData();
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const loadData = async () => {
    setLoading(true);
    try {
      // First check if Gmail is connected
      const status = await emailAPI.getGmailStatus();
      
      if (!status || (status.status !== 'connected' && status.status !== 'scanning')) {
        // Gmail not connected, don't load emails
        setIsGmailConnected(false);
        setEmails([]);
        setLoading(false);
        return;
      }
      
      setIsGmailConnected(true);
      
      // Build params with search filters
      const params = { unlinked_only: true };
      if (searchQuery) params.search = searchQuery;
      
      const [emailsData, jobsData] = await Promise.all([
        emailAPI.getEmails(params),
        jobsAPI.getJobs()
      ]);
      setEmails(emailsData);
      setJobs(jobsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkEmail = async (emailId, jobId) => {
    if (!jobId) return;
    
    setLinkingEmail(emailId);
    try {
      await emailAPI.linkEmailToJob(emailId, jobId);
      await loadData();
      setToast({
        isOpen: true,
        message: 'Email linked to job successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to link email:', error);
      setToast({
        isOpen: true,
        message: 'Failed to link email to job',
        type: 'error'
      });
    } finally {
      setLinkingEmail(null);
    }
  };

  const handleDismiss = async (emailId) => {
    try {
      await emailAPI.dismissEmail(emailId);
      await loadData();
      setToast({
        isOpen: true,
        message: 'Email dismissed',
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
    return (
      <div className="unlinked-emails">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          Unlinked Emails
        </h3>
        <div className="unlinked-emails-loading">Loading unlinked emails...</div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="unlinked-emails">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          Unlinked Emails {isGmailConnected && '(0)'}
        </h3>
        <div className="no-unlinked-emails">
          {!isGmailConnected ? (
            <>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              <p>Connect your Gmail to see unlinked emails</p>
              <small>When you connect Gmail in the Email Integration section above, any application-related emails that can't be automatically linked to jobs will appear here for you to manually link.</small>
            </>
          ) : (
            <>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <p>All emails are linked or dismissed!</p>
              <small>New application-related emails will appear here when detected.</small>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="unlinked-emails">
        <div className="unlinked-emails-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            Unlinked Emails ({emails.length})
          </h3>
          <button 
            className="toggle-filters-btn"
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"></path>
            </svg>
            {showFilters ? 'Hide Search' : 'Show Search'}
          </button>
        </div>
        
        {showFilters && (
          <div className="unlinked-search-bar">
            <input
              type="text"
              placeholder="Search unlinked emails by subject, sender, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="unlinked-search-input"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="clear-search-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
        )}
        
        <div className="unlinked-emails-list">
          {emails.map((email) => (
            <div key={email.id} className="unlinked-email-card">
              <div className="unlinked-email-header">
                <div className="unlinked-email-meta">
                  <strong>{email.sender_name || email.sender_email}</strong>
                  <span className="unlinked-email-date">
                    {new Date(email.received_at).toLocaleDateString()}
                  </span>
                </div>
                {email.email_type_display && (
                  <span className={`email-type-badge type-${email.email_type}`}>
                    {email.email_type_display}
                  </span>
                )}
              </div>
              
              <div className="unlinked-email-subject">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                {email.subject}
              </div>
              
              {email.snippet && (
                <div className="unlinked-email-snippet">{email.snippet}</div>
              )}
              
              <div className="unlinked-email-actions">
                <select
                  className="job-selector"
                  onChange={(e) => handleLinkEmail(email.id, e.target.value)}
                  disabled={linkingEmail === email.id}
                  defaultValue=""
                >
                  <option value="" disabled>Select job to link...</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} at {job.company_name}
                    </option>
                  ))}
                </select>
                
                <button
                  onClick={() => handleDismiss(email.id)}
                  className="btn-dismiss-small"
                  disabled={linkingEmail === email.id}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"></path>
                  </svg>
                  Dismiss
                </button>
              </div>
              
              <div className="unlinked-email-footer">
                <a 
                  href={email.gmail_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="view-in-gmail-small"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

export default UnlinkedEmails;
