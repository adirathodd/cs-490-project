import React, { useState, useEffect, useRef } from 'react';
import { informationalInterviewsAPI, contactsAPI } from '../../services/api';
import './InformationalInterviews.css';

const InformationalInterviews = () => {
  const isMounted = useRef(true);
  const [interviews, setInterviews] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [notification, setNotification] = useState(null);
  const notificationTimer = useRef(null);

  const setInterviewsSafe = (value) => {
    if (isMounted.current) setInterviews(value);
  };
  const setContactsSafe = (value) => {
    if (isMounted.current) setContacts(value);
  };
  const setAnalyticsSafe = (value) => {
    if (isMounted.current) setAnalytics(value);
  };
  const setErrorSafe = (value) => {
    if (isMounted.current) setError(value);
  };
  const setLoadingSafe = (value) => {
    if (isMounted.current) setLoading(value);
  };

  const statusOptions = [
    { value: 'identified', label: 'Identified', color: '#6c757d' },
    { value: 'outreach_sent', label: 'Outreach Sent', color: '#007bff' },
    { value: 'scheduled', label: 'Scheduled', color: '#28a745' },
    { value: 'completed', label: 'Completed', color: '#17a2b8' },
    { value: 'declined', label: 'Declined', color: '#dc3545' },
    { value: 'no_response', label: 'No Response', color: '#ffc107' }
  ];

  const outcomeOptions = [
    { value: '', label: 'Not Set' },
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'average', label: 'Average' },
    { value: 'poor', label: 'Poor' }
  ];

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoadingSafe(true);
        const [data, contactsData, analyticsData] = await Promise.all([
          informationalInterviewsAPI.getInterviews({}),
          contactsAPI.list(),
          informationalInterviewsAPI.getAnalytics(),
        ]);
        setInterviewsSafe(data);
        setContactsSafe(contactsData);
        setAnalyticsSafe(analyticsData);
        setErrorSafe('');
      } catch (err) {
        setErrorSafe(err.message || 'Failed to load informational interviews');
      } finally {
        setLoadingSafe(false);
      }
    };

    loadAll();
    return () => {
      isMounted.current = false;
      if (notificationTimer.current) {
        clearTimeout(notificationTimer.current);
        notificationTimer.current = null;
      }
    };
  }, []);

  const loadData = async (statusFilter = null) => {
    try {
      setLoadingSafe(true);
      const filters = statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {};
      const data = await informationalInterviewsAPI.getInterviews(filters);
      setInterviewsSafe(data);
      setErrorSafe('');
    } catch (err) {
      setErrorSafe(err.message || 'Failed to load informational interviews');
    } finally {
      setLoadingSafe(false);
    }
  };

  const loadContacts = async () => {
    try {
      const data = await contactsAPI.list();
      setContactsSafe(data);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  };

  const loadAnalytics = async () => {
    try {
      const data = await informationalInterviewsAPI.getAnalytics();
      setAnalyticsSafe(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    loadData(newFilter);
  };

  const handleViewInterview = (interview) => {
    setSelectedInterview(interview);
  };

  const handleCloseDetails = () => {
    setSelectedInterview(null);
  };

  const getStatusLabel = (status) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option ? option.label : status;
  };

  const getStatusColor = (status) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option ? option.color : '#6c757d';
  };

  const getOutcomeLabel = (outcome) => {
    const option = outcomeOptions.find(opt => opt.value === outcome);
    return option ? option.label : outcome;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const showNotification = (message, type = 'success') => {
    if (!isMounted.current) return;
    setNotification({ message, type });
    if (notificationTimer.current) {
      clearTimeout(notificationTimer.current);
    }
    notificationTimer.current = setTimeout(() => {
      if (isMounted.current) {
        setNotification(null);
      }
      notificationTimer.current = null;
    }, 4000);
  };

  if (loading && interviews.length === 0) {
    return (
      <div className="informational-interviews-container">
        <div className="loading">Loading informational interviews...</div>
      </div>
    );
  }

  return (
    <div className="informational-interviews-container">
      <div className="informational-interviews-header">
        <h1>Informational Interviews</h1>
        <p className="subtitle">Request and manage informational interviews to gain industry insights and build relationships</p>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + New Interview Request
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Analytics Summary */}
      {analytics && (
        <div className="analytics-summary">
          <div className="analytics-card">
            <div className="analytics-value">{analytics.overview?.total || 0}</div>
            <div className="analytics-label">Total Interviews</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-value">{analytics.success_metrics?.scheduled || 0}</div>
            <div className="analytics-label">Scheduled</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-value">{analytics.success_metrics?.completed || 0}</div>
            <div className="analytics-label">Completed</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-value">{analytics.success_metrics?.response_rate || 0}%</div>
            <div className="analytics-label">Response Rate</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-value">{analytics.impact?.led_to_job_application || 0}</div>
            <div className="analytics-label">Led to Applications</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button 
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => handleFilterChange('all')}
        >
          All
        </button>
        {statusOptions.map(status => (
          <button 
            key={status.value}
            className={`filter-tab ${filter === status.value ? 'active' : ''}`}
            onClick={() => handleFilterChange(status.value)}
          >
            {status.label}
          </button>
        ))}
      </div>

      {/* Interviews List */}
      <div className="interviews-list">
        {!interviews || interviews.length === 0 ? (
          <div className="empty-state">
            <p>No informational interviews found.</p>
            <p>Create your first interview request to start building relationships!</p>
          </div>
        ) : (
          interviews.map(interview => (
            <div key={interview.id} className="interview-card">
              <div className="interview-header">
                <div className="interview-contact">
                  <h3>{interview.contact_name || interview.contact_details?.display_name || 'Unknown Contact'}</h3>
                  <p className="contact-title">{interview.contact_title || interview.contact_details?.title || 'No title'}</p>
                  <p className="contact-company">{interview.contact_company || interview.contact_details?.company_name || 'No company'}</p>
                </div>
                <div className="interview-status">
                  <span 
                    className="status-badge" 
                    style={{ backgroundColor: getStatusColor(interview.status) }}
                  >
                    {getStatusLabel(interview.status)}
                  </span>
                  {interview.outcome && (
                    <span className="outcome-badge">
                      {outcomeOptions.find(o => o.value === interview.outcome)?.label}
                    </span>
                  )}
                </div>
              </div>

              <div className="interview-details">
                {interview.scheduled_at && (
                  <div className="detail-item">
                    <strong>Scheduled:</strong> {formatDate(interview.scheduled_at)}
                  </div>
                )}
                {interview.completed_at && (
                  <div className="detail-item">
                    <strong>Completed:</strong> {formatDate(interview.completed_at)}
                  </div>
                )}
                <div className="detail-item">
                  <strong>Created:</strong> {formatDate(interview.created_at)}
                </div>
              </div>

              {(interview.led_to_job_application || interview.led_to_referral || interview.led_to_introduction) && (
                <div className="impact-indicators">
                  {interview.led_to_job_application && <span className="impact-badge">📝 Job Application</span>}
                  {interview.led_to_referral && <span className="impact-badge">🤝 Referral</span>}
                  {interview.led_to_introduction && <span className="impact-badge">👥 Introduction</span>}
                </div>
              )}

              <div className="interview-actions">
                <button 
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleViewInterview(interview)}
                >
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateInterviewModal
          contacts={contacts}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadData(filter);
            loadAnalytics();
          }}
        />
      )}

      {/* Interview Details Modal */}
      {selectedInterview && (
        <InterviewDetailsModal
          interview={selectedInterview}
          statusOptions={statusOptions}
          outcomeOptions={outcomeOptions}
          onClose={handleCloseDetails}
          onUpdate={() => {
            loadData(filter);
            loadAnalytics();
            handleCloseDetails();
          }}
        />
      )}
    </div>
  );
};

const CreateInterviewModal = ({ contacts, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    contact: '',
    preparation_notes: '',
    questions_to_ask: [],
    goals: []
  });
  const [newQuestion, setNewQuestion] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await informationalInterviewsAPI.createInterview({
        ...formData,
        status: 'identified'
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to create interview request');
      setSubmitting(false);
    }
  };

  const addQuestion = () => {
    if (newQuestion.trim()) {
      setFormData({
        ...formData,
        questions_to_ask: [...formData.questions_to_ask, newQuestion.trim()]
      });
      setNewQuestion('');
    }
  };

  const removeQuestion = (index) => {
    setFormData({
      ...formData,
      questions_to_ask: formData.questions_to_ask.filter((_, i) => i !== index)
    });
  };

  const addGoal = () => {
    if (newGoal.trim()) {
      setFormData({
        ...formData,
        goals: [...formData.goals, newGoal.trim()]
      });
      setNewGoal('');
    }
  };

  const removeGoal = (index) => {
    setFormData({
      ...formData,
      goals: formData.goals.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Interview Request</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Contact *</label>
            <select
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              required
            >
              <option value="">Select a contact...</option>
              {contacts.map(contact => (
                <option key={contact.id} value={contact.id}>
                  {contact.display_name} - {contact.company_name || 'No company'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Preparation Notes</label>
            <textarea
              value={formData.preparation_notes}
              onChange={(e) => setFormData({ ...formData, preparation_notes: e.target.value })}
              rows={3}
              placeholder="Any notes for preparing for this interview..."
            />
          </div>

          <div className="form-group">
            <label>Questions to Ask</label>
            <div className="list-input">
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Add a question..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addQuestion())}
              />
              <button type="button" onClick={addQuestion} className="btn btn-sm btn-secondary">
                Add
              </button>
            </div>
            <ul className="items-list">
              {formData.questions_to_ask.map((question, index) => (
                <li key={index}>
                  {question}
                  <button type="button" onClick={() => removeQuestion(index)} className="remove-btn">
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="form-group">
            <label>Goals</label>
            <div className="list-input">
              <input
                type="text"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="Add a goal..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addGoal())}
              />
              <button type="button" onClick={addGoal} className="btn btn-sm btn-secondary">
                Add
              </button>
            </div>
            <ul className="items-list">
              {formData.goals.map((goal, index) => (
                <li key={index}>
                  {goal}
                  <button type="button" onClick={() => removeGoal(index)} className="remove-btn">
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Interview Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const InterviewDetailsModal = ({ interview, statusOptions, outcomeOptions, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [outreachTemplate, setOutreachTemplate] = useState(null);
  const [preparationFramework, setPreparationFramework] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [notification, setNotification] = useState(null);

  const getStatusLabel = (status) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option ? option.label : status;
  };

  const getOutcomeLabel = (outcome) => {
    const option = outcomeOptions.find(opt => opt.value === outcome);
    return option ? option.label : outcome;
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleGenerateOutreach = async (style = 'professional') => {
    try {
      setLoading(true);
      const data = await informationalInterviewsAPI.generateOutreach(interview.id, style);
      setOutreachTemplate(data);
      showNotification('Outreach template generated successfully!');
    } catch (err) {
      showNotification(err.message || 'Failed to generate outreach template', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreparation = async () => {
    try {
      setLoading(true);
      const data = await informationalInterviewsAPI.generatePreparation(interview.id);
      setPreparationFramework(data);
      showNotification('Preparation framework generated successfully!');
    } catch (err) {
      showNotification(err.message || 'Failed to generate preparation framework', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkOutreachSent = async () => {
    try {
      await informationalInterviewsAPI.markOutreachSent(interview.id);
      showNotification('Marked as outreach sent!');
      onUpdate();
    } catch (err) {
      showNotification(err.message || 'Failed to update status', 'error');
    }
  };

  const handleMarkScheduled = async (scheduledDateTime) => {
    try {
      await informationalInterviewsAPI.markScheduled(interview.id, scheduledDateTime);
      showNotification('Interview scheduled successfully!');
      setShowScheduleModal(false);
      onUpdate();
    } catch (err) {
      showNotification(err.message || 'Failed to update status', 'error');
    }
  };

  const handleMarkCompleted = async (completionData) => {
    try {
      await informationalInterviewsAPI.markCompleted(interview.id, completionData);
      showNotification('Interview marked as completed!');
      setShowCompleteModal(false);
      onUpdate();
    } catch (err) {
      showNotification(err.message || 'Failed to update status', 'error');
    }
  };

  return (
    <>
    <div className="modal-overlay large" onClick={onClose}>
      <div className="modal-content large" onClick={e => e.stopPropagation()}>
        {notification && (
          <div className={`notification notification-${notification.type}`}>
            {notification.message}
          </div>
        )}
        <div className="modal-header">
          <h2>{interview.contact_name || interview.contact_details?.display_name || 'Unknown Contact'} - Interview Details</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab ${activeTab === 'outreach' ? 'active' : ''}`}
            onClick={() => setActiveTab('outreach')}
          >
            Outreach
          </button>
          <button 
            className={`tab ${activeTab === 'preparation' ? 'active' : ''}`}
            onClick={() => setActiveTab('preparation')}
          >
            Preparation
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="detail-section">
                <h3>Contact Information</h3>
                <p><strong>Name:</strong> {interview.contact_name || interview.contact_details?.display_name || 'Not available'}</p>
                <p><strong>Title:</strong> {interview.contact_title || interview.contact_details?.title || 'Not specified'}</p>
                <p><strong>Company:</strong> {interview.contact_company || interview.contact_details?.company_name || 'Not specified'}</p>
                <p><strong>Email:</strong> {interview.contact_details?.email || 'Not specified'}</p>
                {interview.contact_details?.phone && <p><strong>Phone:</strong> {interview.contact_details.phone}</p>}
                {interview.contact_details?.linkedin_url && (
                  <p><strong>LinkedIn:</strong> <a href={interview.contact_details.linkedin_url} target="_blank" rel="noopener noreferrer">View Profile</a></p>
                )}
              </div>

              <div className="detail-section">
                <h3>Interview Status</h3>
                <p><strong>Current Status:</strong> {getStatusLabel(interview.status)}</p>
                {interview.outcome && <p><strong>Outcome:</strong> {getOutcomeLabel(interview.outcome)}</p>}
                <div className="status-actions">
                  {interview.status === 'identified' && (
                    <button className="btn btn-sm btn-primary" onClick={handleMarkOutreachSent}>
                      Mark Outreach Sent
                    </button>
                  )}
                  {interview.status === 'outreach_sent' && (
                    <button className="btn btn-sm btn-primary" onClick={() => setShowScheduleModal(true)}>
                      Mark as Scheduled
                    </button>
                  )}
                  {interview.status === 'scheduled' && (
                    <button className="btn btn-sm btn-primary" onClick={() => setShowCompleteModal(true)}>
                      Mark as Completed
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'outreach' && (
            <div className="outreach-tab">
              <div className="template-generator">
                <h3>Generate Outreach Template</h3>
                <p>Choose a style for your outreach message:</p>
                <div className="style-buttons">
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleGenerateOutreach('professional')}
                    disabled={loading}
                  >
                    Professional
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleGenerateOutreach('casual')}
                    disabled={loading}
                  >
                    Casual
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleGenerateOutreach('mutual_connection')}
                    disabled={loading}
                  >
                    Mutual Connection
                  </button>
                </div>

                {outreachTemplate && (
                  <div className="generated-template">
                    <h4>Generated Template ({outreachTemplate.style})</h4>
                    <textarea
                      value={outreachTemplate.template}
                      readOnly
                      rows={15}
                      className="template-text"
                    />
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={() => navigator.clipboard.writeText(outreachTemplate.template)}
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'preparation' && (
            <div className="preparation-tab">
              <button 
                className="btn btn-primary"
                onClick={handleGeneratePreparation}
                disabled={loading || preparationFramework}
              >
                {loading ? 'Generating...' : 'Generate Preparation Framework'}
              </button>

              {preparationFramework && (
                <div className="preparation-framework">
                  <div className="framework-section">
                    <h3>Suggested Questions</h3>
                    <ul>
                      {preparationFramework.suggested_questions?.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="framework-section">
                    <h3>Research Checklist</h3>
                    <ul>
                      {preparationFramework.research_checklist?.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="framework-section">
                    <h3>Suggested Goals</h3>
                    <ul>
                      {preparationFramework.suggested_goals?.map((goal, i) => (
                        <li key={i}>{goal}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>

    {showScheduleModal && (
      <ScheduleModal
        onClose={() => setShowScheduleModal(false)}
        onSubmit={handleMarkScheduled}
      />
    )}

    {showCompleteModal && (
      <CompleteModal
        onClose={() => setShowCompleteModal(false)}
        onSubmit={handleMarkCompleted}
      />
    )}
    </>
  );
};

const ScheduleModal = ({ onClose, onSubmit }) => {
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (scheduledDate && scheduledTime) {
      onSubmit(`${scheduledDate}T${scheduledTime}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Schedule Interview</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Date *</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Time *</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Schedule Interview
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CompleteModal = ({ onClose, onSubmit }) => {
  const [outcome, setOutcome] = useState('good');
  const [keyInsights, setKeyInsights] = useState('');
  const [followUpActions, setFollowUpActions] = useState('');
  const [ledToJobApplication, setLedToJobApplication] = useState(false);
  const [ledToReferral, setLedToReferral] = useState(false);
  const [ledToIntroduction, setLedToIntroduction] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      outcome,
      key_insights: keyInsights,
      follow_up_actions: followUpActions,
      led_to_job_application: ledToJobApplication,
      led_to_referral: ledToReferral,
      led_to_introduction: ledToIntroduction
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Complete Interview</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Outcome *</label>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)} required>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="average">Average</option>
              <option value="poor">Poor</option>
            </select>
          </div>
          <div className="form-group">
            <label>Key Insights</label>
            <textarea
              value={keyInsights}
              onChange={(e) => setKeyInsights(e.target.value)}
              rows={4}
              placeholder="What did you learn from this interview?"
            />
          </div>
          <div className="form-group">
            <label>Follow-up Actions</label>
            <textarea
              value={followUpActions}
              onChange={(e) => setFollowUpActions(e.target.value)}
              rows={3}
              placeholder="What are your next steps?"
            />
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={ledToJobApplication}
                onChange={(e) => setLedToJobApplication(e.target.checked)}
              />
              Led to job application
            </label>
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={ledToReferral}
                onChange={(e) => setLedToReferral(e.target.checked)}
              />
              Led to referral
            </label>
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={ledToIntroduction}
                onChange={(e) => setLedToIntroduction(e.target.checked)}
              />
              Led to introduction
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Mark as Completed
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InformationalInterviews;
