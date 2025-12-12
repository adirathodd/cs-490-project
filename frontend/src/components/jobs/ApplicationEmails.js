import React, { useState, useEffect } from 'react';
import emailAPI from '../../services/emailAPI';
import Toast from '../common/Toast';
import './ApplicationEmails.css';

const ApplicationEmails = ({ jobId, onRefresh, showSearch = false }) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'info' });
  
  // Search filters (UC-113)
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sender, setSender] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadEmails();
  }, [jobId, searchQuery, sender, dateFrom, dateTo]);

  const loadEmails = async () => {
    setLoading(true);
    try {
      const params = {};
      if (jobId) params.job_id = jobId;
      if (searchQuery) params.search = searchQuery;
      if (sender) params.sender = sender;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      
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
  
  const handleClearFilters = () => {
    setSearchQuery('');
    setSender('');
    setDateFrom('');
    setDateTo('');
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
      <div className="emails-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          Related Emails ({emails.length})
        </h3>
        {showSearch && (
          <button 
            className="toggle-filters-btn"
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"></path>
            </svg>
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        )}
      </div>

      {showSearch && showFilters && (
        <div className="email-filters">
          <div className="filter-row">
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filter-row">
            <input
              type="text"
              placeholder="Filter by sender..."
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="filter-input"
            />
            <input
              type="date"
              placeholder="From date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="filter-input"
            />
            <input
              type="date"
              placeholder="To date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="filter-input"
            />
            <button onClick={handleClearFilters} className="clear-filters-btn">
              Clear
            </button>
          </div>
        </div>
      )}

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
            
            <div className="email-footer">
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
