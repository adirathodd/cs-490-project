import React, { useState, useEffect, useCallback } from 'react';
import { networkingAPI } from '../../services/api';
import Icon from '../common/Icon';
import LoadingSpinner from '../common/LoadingSpinner';
import './NetworkingEvents.css';

const NetworkingEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState({
    event_type: '',
    attendance_status: '',
    is_virtual: '',
  });

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    event_type: 'other',
    description: '',
    location: '',
    is_virtual: false,
    virtual_link: '',
    event_date: '',
    end_date: '',
    registration_deadline: '',
    organizer: '',
    industry: '',
    event_url: '',
    attendance_status: 'planned',
    registration_fee: '',
    pre_event_notes: '',
  });

  const [goals, setGoals] = useState([]);
  const [connections, setConnections] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [goalFormVisible, setGoalFormVisible] = useState(false);
  const [connectionFormVisible, setConnectionFormVisible] = useState(false);
  const [followUpFormVisible, setFollowUpFormVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [goalForm, setGoalForm] = useState({ goal_type: 'connections', description: '', target_value: '' });
  const [connectionForm, setConnectionForm] = useState({
    name: '',
    title: '',
    company: '',
    potential_value: 'medium',
    email: '',
    phone: '',
    linkedin_url: '',
    conversation_notes: '',
  });
  const [followUpForm, setFollowUpForm] = useState({
    action_type: 'email',
    description: '',
    due_date: '',
    connection: '',
  });

  const buildPayloadForApi = () => {
    const normalizeDate = (value) => (value && value.trim() !== '' ? value : null);
    const normalizeFee = (value) => {
      if (value === '' || value === null || value === undefined) {
        return null;
      }
      const parsed = Number(value);
      return Number.isNaN(parsed) ? null : parsed;
    };

    return {
      ...formData,
      event_date: formData.event_date,
      end_date: normalizeDate(formData.end_date),
      registration_deadline: normalizeDate(formData.registration_deadline),
      registration_fee: normalizeFee(formData.registration_fee),
      virtual_link: formData.is_virtual ? formData.virtual_link : '',
      location: formData.is_virtual ? '' : formData.location,
    };
  };

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await networkingAPI.getEvents(filters);
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events:', err);
      setError('Failed to load networking events');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await networkingAPI.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    loadAnalytics();
  }, [loadEvents, loadAnalytics]);

  useEffect(() => {
    if (!selectedEvent) {
      setGoalFormVisible(false);
      setConnectionFormVisible(false);
      setFollowUpFormVisible(false);
    }
  }, [selectedEvent]);

  const loadEventDetails = async (eventId, tabOverride = null) => {
    try {
      const event = await networkingAPI.getEvent(eventId);
      setSelectedEvent(event);
      setGoals(event.goals || []);
      setConnections(event.connections || []);
      setFollowUps(event.follow_ups || []);
      setActiveTab(tabOverride || 'goals');
      setGoalFormVisible(false);
      setConnectionFormVisible(false);
      setFollowUpFormVisible(false);
      resetGoalForm();
      resetConnectionForm();
      resetFollowUpForm();
    } catch (err) {
      console.error('Failed to load event details:', err);
      setError('Failed to load event details');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = buildPayloadForApi();
      if (selectedEvent) {
        await networkingAPI.updateEvent(selectedEvent.id, payload);
      } else {
        await networkingAPI.createEvent(payload);
      }
      setShowAddForm(false);
      resetForm();
      loadEvents();
      loadAnalytics();
    } catch (err) {
      console.error('Failed to save event:', err);
      setError('Failed to save event');
    }
  };

  const requestDeleteEvent = (event) => {
    setDeleteTarget(event);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    try {
      await networkingAPI.deleteEvent(deleteTarget.id);
      loadEvents();
      loadAnalytics();
      if (selectedEvent?.id === deleteTarget.id) {
        setSelectedEvent(null);
      }
    } catch (err) {
      console.error('Failed to delete event:', err);
      setError('Failed to delete event');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleGoalSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;
    try {
      setError('');
      await networkingAPI.createGoal(selectedEvent.id, {
        goal_type: goalForm.goal_type,
        description: goalForm.description,
        target_value: goalForm.target_value ? Number(goalForm.target_value) : null,
      });
      resetGoalForm();
      setGoalFormVisible(false);
      loadEventDetails(selectedEvent.id, 'goals');
      loadEvents();
      loadAnalytics();
    } catch (err) {
      console.error('Failed to add goal:', err);
      setError('Failed to add goal');
    }
  };

  const toggleGoalAchieved = async (goalId, currentStatus) => {
    try {
      await networkingAPI.updateGoal(selectedEvent.id, goalId, {
        achieved: !currentStatus,
      });
      loadEventDetails(selectedEvent.id, activeTab || 'goals');
      loadEvents();
      loadAnalytics();
    } catch (err) {
      console.error('Failed to update goal:', err);
      setError('Failed to update goal');
    }
  };

  const handleConnectionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;
    if (!connectionForm.name.trim()) {
      setError('Connection name is required');
      return;
    }
    try {
      setError('');
      await networkingAPI.createConnection(selectedEvent.id, {
        ...connectionForm,
        potential_value: connectionForm.potential_value || 'medium',
      });
      resetConnectionForm();
      setConnectionFormVisible(false);
      loadEventDetails(selectedEvent.id, 'connections');
      loadEvents();
      loadAnalytics();
    } catch (err) {
      console.error('Failed to add connection:', err);
      setError('Failed to add connection');
    }
  };

  const handleFollowUpSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;
    try {
      setError('');
      await networkingAPI.createFollowUp(selectedEvent.id, {
        action_type: followUpForm.action_type,
        description: followUpForm.description,
        due_date: followUpForm.due_date,
        connection: followUpForm.connection || null,
      });
      resetFollowUpForm();
      setFollowUpFormVisible(false);
      loadEventDetails(selectedEvent.id, 'followups');
      loadEvents();
      loadAnalytics();
    } catch (err) {
      console.error('Failed to add follow-up:', err);
      setError('Failed to add follow-up');
    }
  };

  const toggleFollowUpComplete = async (followUpId, currentStatus) => {
    try {
      if (!currentStatus) {
        await networkingAPI.completeFollowUp(selectedEvent.id, followUpId);
      } else {
        await networkingAPI.updateFollowUp(selectedEvent.id, followUpId, {
          completed: false,
        });
      }
      loadEventDetails(selectedEvent.id, 'followups');
      loadEvents();
      loadAnalytics();
    } catch (err) {
      console.error('Failed to update follow-up:', err);
      setError('Failed to update follow-up');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      event_type: 'other',
      description: '',
      location: '',
      is_virtual: false,
      virtual_link: '',
      event_date: '',
      end_date: '',
      registration_deadline: '',
      organizer: '',
      industry: '',
      event_url: '',
      attendance_status: 'planned',
      registration_fee: '',
      pre_event_notes: '',
    });
    setSelectedEvent(null);
  };

  const resetGoalForm = () => {
    setGoalForm({ goal_type: 'connections', description: '', target_value: '' });
  };

  const resetConnectionForm = () => {
    setConnectionForm({
      name: '',
      title: '',
      company: '',
      potential_value: 'medium',
      email: '',
      phone: '',
      linkedin_url: '',
      conversation_notes: '',
    });
  };

  const resetFollowUpForm = () => {
    setFollowUpForm({ action_type: 'email', description: '', due_date: '', connection: '' });
  };

  const handleEditEvent = (event) => {
    setFormData({
      name: event.name,
      event_type: event.event_type,
      description: event.description || '',
      location: event.location || '',
      is_virtual: event.is_virtual,
      virtual_link: event.virtual_link || '',
      event_date: event.event_date ? event.event_date.slice(0, 16) : '',
      end_date: event.end_date ? event.end_date.slice(0, 16) : '',
      registration_deadline: event.registration_deadline ? event.registration_deadline.slice(0, 16) : '',
      organizer: event.organizer || '',
      industry: event.industry || '',
      event_url: event.event_url || '',
      attendance_status: event.attendance_status,
      registration_fee: event.registration_fee || '',
      pre_event_notes: event.pre_event_notes || '',
    });
    setSelectedEvent(event);
    setShowAddForm(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDueDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatBadgeLabel = (value) => {
    if (!value) return '';
    return value
      .split('_')
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
  };

  const formatPercent = (value) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return '0%';
    const rounded = Math.round(numeric);
    return `${rounded}%`;
  };

  const formatCurrency = (value) => {
    const numeric = Number(value) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: numeric >= 100 ? 0 : 2,
    }).format(numeric);
  };

  const formatTrend = (value) => {
    const numeric = Number(value) || 0;
    if (numeric === 0) return 'Flat';
    return numeric > 0 ? `+${numeric}` : `${numeric}`;
  };

  const relationshipHealth = analytics?.relationship_health || {};
  const activityVolume = analytics?.activity_volume || {};
  const referralPipeline = analytics?.referral_pipeline || {};
  const eventRoi = analytics?.event_roi || {};
  const conversionRates = analytics?.conversion_rates || {};
  const insights = analytics?.insights || {};
  const benchmarks = analytics?.industry_benchmarks || {};
  const bestChannel = analytics?.best_channel;
  const bestChannelLabel = bestChannel ? formatBadgeLabel(bestChannel.event_type) : '';
  // eslint-disable-next-line no-unused-vars
  const strengthsList = insights?.strengths?.length
    ? insights.strengths
    : ['You are building momentum—keep follow-ups within 48 hours to compound trust.'];
  // eslint-disable-next-line no-unused-vars
  const focusList = insights?.focus?.length
    ? insights.focus
    : ['Increase high-value intros by targeting decision makers and asking for mutual value.'];
  // eslint-disable-next-line no-unused-vars
  const recommendationsList = insights?.recommendations?.length
    ? insights.recommendations
    : ['Pilot 2 low-cost niche events and track high-value introductions per dollar.'];

  return (
    <div className="employment-container">
      <div className="employment-page-header">
        <div className="page-backbar">
          <a className="btn-back" href="/dashboard" aria-label="Back to dashboard" title="Back to dashboard">
            ← Back to Dashboard
          </a>
        </div>
        <h1 className="employment-page-title">Networking Events</h1>
      </div>

      {error && (
        <div className="error-banner">
          <Icon name="alert-circle" size="sm" />
          {error}
        </div>
      )}

      {/* Analytics Overview */}
      {analytics && (
        <div className="networking-analytics-card">
          <div className="analytics-top">
            <div>
              <h3><Icon name="trending-up" size="md" /> Networking Analytics</h3>
              <p className="analytics-subtitle">Volume, relationship quality, referrals, and ROI in one view.</p>
            </div>
            {benchmarks?.industry && (
              <span className="benchmark-pill">
                Benchmarks: {formatBadgeLabel(benchmarks.industry)}
              </span>
            )}
          </div>

          <div className="analytics-grid analytics-grid--summary">
            <div className="stat-card">
              <div className="stat-value">{analytics.overview.total_events}</div>
              <div className="stat-label">Total Events</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{analytics.overview.attended_events}</div>
              <div className="stat-label">Events Attended</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{analytics.overview.total_connections}</div>
              <div className="stat-label">Connections</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{analytics.overview.high_value_connections}</div>
              <div className="stat-label">High-Value Intros</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatPercent(relationshipHealth.high_value_ratio)}</div>
              <div className="stat-label">High-Value Ratio</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatPercent(analytics.overview.follow_up_completion_rate)}</div>
              <div className="stat-label">Follow-Up Completion</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatPercent(analytics.overview.goals_achievement_rate)}</div>
              <div className="stat-label">Goals Met</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{analytics.overview.manual_outreach_attempts_30d}</div>
              <div className="stat-label">Manual Outreach (30d)</div>
            </div>
          </div>

          <div className="panel-grid">
            <div className="panel-card">
              <div className="panel-header">
                <div>
                  <h4>Activity & Relationship Progress</h4>
                  <p className="panel-subtitle">Track volume, quality, and reciprocity momentum.</p>
                </div>
                <span className={`trend-pill ${relationshipHealth.relationship_trend >= 0 ? 'trend-positive' : 'trend-negative'}`}>
                  {formatTrend(relationshipHealth.relationship_trend)} relationship strength
                </span>
              </div>
              <div className="metric-grid">
                <div className="metric-card">
                  <div className="metric-label">Connections (60d)</div>
                  <div className="metric-value">{activityVolume.connections_added_60d || 0}</div>
                  <div className="metric-subtext">New people added recently</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Engaged Contacts</div>
                  <div className="metric-value">{relationshipHealth.engaged_contacts_60d || 0}</div>
                  <div className="metric-subtext">Touched in the last 60 days</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Avg Strength</div>
                  <div className="metric-value">{relationshipHealth.avg_relationship_strength?.toFixed(1) || '0.0'}</div>
                  <div className="metric-subtext">Recent: {relationshipHealth.recent_relationship_strength?.toFixed(1) || '0.0'}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Interactions Logged</div>
                  <div className="metric-value">{activityVolume.interactions_logged_30d || 0}</div>
                  <div className="metric-subtext">Conversations captured (30d)</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Outreach Attempts</div>
                  <div className="metric-value">{activityVolume.outreach_attempts_30d || 0}</div>
                  <div className="metric-subtext">Manual networking + follow-ups (30d)</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Follow-Ups Open</div>
                  <div className="metric-value">{activityVolume.followups_open || 0}</div>
                  <div className="metric-subtext">Outstanding next steps</div>
                </div>
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-header">
                <div>
                  <h4>ROI & Conversion</h4>
                  <p className="panel-subtitle">See how networking time and spend turn into outcomes.</p>
                </div>
                {bestChannel && (
                  <span className="trend-pill">
                    Best channel: {bestChannelLabel || bestChannel.event_type} ({bestChannel.high_value_connections} high-value)
                  </span>
                )}
              </div>
              <div className="metric-grid">
                <div className="metric-card">
                  <div className="metric-label">Cost / Connection</div>
                  <div className="metric-value">{formatCurrency(eventRoi.cost_per_connection)}</div>
                  <div className="metric-subtext">Total spend: {formatCurrency(eventRoi.total_spend)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Cost / High-Value</div>
                  <div className="metric-value">{formatCurrency(eventRoi.cost_per_high_value_connection)}</div>
                  <div className="metric-subtext">High-value from paid events</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Connections / Event</div>
                  <div className="metric-value">{eventRoi.connections_per_event || 0}</div>
                  <div className="metric-subtext">Follow-ups per connection: {eventRoi.followups_per_connection || 0}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Follow-Ups Started</div>
                  <div className="metric-value">{formatPercent(conversionRates.connection_to_followup_rate)}</div>
                  <div className="metric-subtext">Follow-Up completion: {formatPercent(conversionRates.follow_up_completion_rate)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Outreach Response</div>
                  <div className="metric-value">{formatPercent(conversionRates.outreach_response_rate)}</div>
                  <div className="metric-subtext">Warm replies and meetings</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Network → Opportunities</div>
                  <div className="metric-value">{formatPercent(conversionRates.networking_to_application_rate)}</div>
                  <div className="metric-subtext">Applications tied to networking</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Referral Reciprocity</div>
                  <div className="metric-value">{formatPercent(conversionRates.referral_conversion_rate)}</div>
                  <div className="metric-subtext">Referrals fulfilled vs requested</div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel-grid">
            <div className="panel-card">
              <div className="panel-header">
                <div>
                  <h4>Referrals & Opportunity Sourcing</h4>
                  <p className="panel-subtitle">Monitor how the network fuels jobs and introductions.</p>
                </div>
              </div>
              <div className="metric-grid">
                <div className="metric-card">
                  <div className="metric-label">Referrals Requested</div>
                  <div className="metric-value">{referralPipeline.referrals_requested || 0}</div>
                  <div className="metric-subtext">Pending asks to your network</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Referrals Received</div>
                  <div className="metric-value">{referralPipeline.referrals_received || 0}</div>
                  <div className="metric-subtext">Warm intros back to you</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Referrals Used</div>
                  <div className="metric-value">{referralPipeline.referrals_used || 0}</div>
                  <div className="metric-subtext">Reciprocity in action</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Network-Sourced Jobs</div>
                  <div className="metric-value">{referralPipeline.networking_sourced_jobs || 0}</div>
                  <div className="metric-subtext">Opportunities from your relationships</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Offers from Network</div>
                  <div className="metric-value">{referralPipeline.networking_offers || 0}</div>
                  <div className="metric-subtext">Offers tied to referrals/events</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Introductions Created</div>
                  <div className="metric-value">{referralPipeline.introductions_created || 0}</div>
                  <div className="metric-subtext">Mutual value you facilitated</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Opportunities via Interviews</div>
                  <div className="metric-value">{referralPipeline.opportunities_from_interviews || 0}</div>
                  <div className="metric-subtext">Informational interviews that led to jobs</div>
                </div>
              </div>
            </div>

            <div className="panel-card insights-card">
              <div className="panel-header">
                <div>
                  <h4>Insights & Benchmarks</h4>
                  <p className="panel-subtitle">Double down on what works; shore up gaps with best practices.</p>
                </div>
              </div>
              <div className="insights-grid">
                <div>
                  <div className="insight-title">Strengths</div>
                  <ul className="insights-list">
                    {(insights.strengths || ['Keep logging interactions to surface patterns.']).map((item, idx) => (
                      <li key={`strength-${idx}`}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="insight-title">Focus Areas</div>
                  <ul className="insights-list">
                    {(insights.focus || ['Increase warm follow-ups within 48 hours of each event.']).map((item, idx) => (
                      <li key={`focus-${idx}`}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="insight-title">Next Bets</div>
                  <ul className="insights-list">
                    {(insights.recommendations || ['Experiment with smaller niche events for deeper connections.']).map((item, idx) => (
                      <li key={`rec-${idx}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="benchmarks-grid">
                {benchmarks?.benchmarks && Object.entries(benchmarks.benchmarks).map(([label, value]) => (
                  <div key={label} className="benchmark-card">
                    <div className="metric-label">{formatBadgeLabel(label.replace(/_/g, ' '))}</div>
                    <div className="metric-value">{formatPercent(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Add Button */}
      <div className="employment-header">
        <h2><Icon name="calendar" size="md" /> Your Networking Events</h2>
        <button className="add-button" onClick={() => { resetForm(); setShowAddForm(true); }}>
          + Add Event
        </button>
      </div>

      <div className="filters-bar">
        <select value={filters.event_type} onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}>
          <option value="">All Event Types</option>
          <option value="conference">Conference</option>
          <option value="meetup">Meetup</option>
          <option value="workshop">Workshop</option>
          <option value="webinar">Webinar</option>
          <option value="career_fair">Career Fair</option>
          <option value="networking_mixer">Networking Mixer</option>
          <option value="panel">Panel Discussion</option>
          <option value="virtual">Virtual Event</option>
          <option value="other">Other</option>
        </select>

        <select value={filters.attendance_status} onChange={(e) => setFilters({ ...filters, attendance_status: e.target.value })}>
          <option value="">All Attendance Status</option>
          <option value="planned">Planning to Attend</option>
          <option value="registered">Registered</option>
          <option value="attended">Attended</option>
          <option value="missed">Missed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select value={filters.is_virtual} onChange={(e) => setFilters({ ...filters, is_virtual: e.target.value })}>
          <option value="">All Locations</option>
          <option value="true">Virtual Only</option>
          <option value="false">In-Person Only</option>
        </select>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEvent ? 'Edit Event' : 'Add Networking Event'}</h2>
              <button className="close-button" onClick={() => setShowAddForm(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="event-form">
              <div className="form-row">
                <label>
                  Event Name *
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Event Type *
                  <select
                    value={formData.event_type}
                    onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                    required
                  >
                    <option value="conference">Conference</option>
                    <option value="meetup">Meetup</option>
                    <option value="workshop">Workshop</option>
                    <option value="webinar">Webinar</option>
                    <option value="career_fair">Career Fair</option>
                    <option value="networking_mixer">Networking Mixer</option>
                    <option value="panel">Panel Discussion</option>
                    <option value="virtual">Virtual Event</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>

              <label>
                Description
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </label>

              <div className="form-row location-row">
                <div className="location-field-group">
                  <label>
                    {formData.is_virtual ? 'Virtual Link' : 'Location'}
                    <input
                      type={formData.is_virtual ? 'url' : 'text'}
                      value={formData.is_virtual ? formData.virtual_link : formData.location}
                      onChange={(e) =>
                        formData.is_virtual
                          ? setFormData({ ...formData, virtual_link: e.target.value })
                          : setFormData({ ...formData, location: e.target.value })
                      }
                    />
                  </label>
                  <label className="checkbox-field virtual-toggle">
                    <input
                      type="checkbox"
                      checked={formData.is_virtual}
                      onChange={(e) => setFormData({ ...formData, is_virtual: e.target.checked })}
                    />
                    <span>Virtual Event</span>
                  </label>
                </div>
                <label>
                  Organizer
                  <input
                    type="text"
                    value={formData.organizer}
                    onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Event Date *
                  <input
                    type="datetime-local"
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                    required
                  />
                </label>
                <label>
                  End Date
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Industry
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  />
                </label>
                <label>
                  Attendance Status *
                  <select
                    value={formData.attendance_status}
                    onChange={(e) => setFormData({ ...formData, attendance_status: e.target.value })}
                    required
                  >
                    <option value="planned">Planning to Attend</option>
                    <option value="registered">Registered</option>
                    <option value="attended">Attended</option>
                    <option value="missed">Missed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Event URL
                  <input
                    type="url"
                    value={formData.event_url}
                    onChange={(e) => setFormData({ ...formData, event_url: e.target.value })}
                  />
                </label>
                <label>
                  Registration Fee ($)
                  <input
                    type="number"
                    step="0.01"
                    value={formData.registration_fee}
                    onChange={(e) => setFormData({ ...formData, registration_fee: e.target.value })}
                  />
                </label>
              </div>

              <label>
                Pre-Event Notes
                <textarea
                  value={formData.pre_event_notes}
                  onChange={(e) => setFormData({ ...formData, pre_event_notes: e.target.value })}
                  rows={4}
                  placeholder="Research notes, people to meet, preparation tasks..."
                />
              </label>

              <div className="form-actions">
                <button type="button" onClick={() => setShowAddForm(false)} className="cancel-button">
                  Cancel
                </button>
                <button type="submit" className="submit-button">
                  {selectedEvent ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <LoadingSpinner size={40} />
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <Icon name="calendar" size="xl" />
          <p>No networking events yet. Add your first event to start tracking!</p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map((event) => (
            <div key={event.id} className="event-card">
              <div className="event-card-header">
                <h3>{event.name}</h3>
                <div className="event-card-actions">
                  <button onClick={() => handleEditEvent(event)} className="icon-button" title="Edit">
                    <Icon name="edit" size="sm" />
                  </button>
                  <button onClick={() => loadEventDetails(event.id, 'goals')} className="icon-button" title="View Details">
                    <Icon name="eye" size="sm" />
                  </button>
                  <button onClick={() => requestDeleteEvent(event)} className="icon-button" title="Delete">
                    <Icon name="trash" size="sm" />
                  </button>
                </div>
              </div>
              <div className="event-card-body">
                <div className="event-meta">
                  <span className={`badge badge-${event.event_type}`}>{formatBadgeLabel(event.event_type)}</span>
                  <span className={`badge badge-${event.attendance_status}`}>{formatBadgeLabel(event.attendance_status)}</span>
                  {event.is_virtual && <span className="badge badge-virtual">Virtual</span>}
                </div>
                <p><Icon name="calendar" size="sm" /> {formatDate(event.event_date)}</p>
                {event.location && <p><Icon name="location" size="sm" /> {event.location}</p>}
                <div className="event-stats">
                  <span><Icon name="users" size="sm" /> {event.connections_count} connections</span>
                  <span><Icon name="check-circle" size="sm" /> {event.pending_follow_ups_count} pending follow-ups</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal-content danger-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Event</h2>
              <button className="close-button" onClick={closeDeleteModal}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this event? This action cannot be undone.</p>
              <div className="confirmation-details">
                <strong>{deleteTarget.name}</strong>
                <span>
                  {formatBadgeLabel(deleteTarget.event_type)} • {formatDate(deleteTarget.event_date)}
                </span>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="cancel-button" onClick={closeDeleteModal}>
                Cancel
              </button>
              <button type="button" className="danger-button" onClick={handleDeleteConfirmed}>
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && !showAddForm && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEvent.name}</h2>
              <button className="close-button" onClick={() => setSelectedEvent(null)}>×</button>
            </div>

            <div className="tabs-container">
              <div className="tabs">
                <button
                  className={activeTab === 'goals' ? 'tab active' : 'tab'}
                  onClick={() => setActiveTab('goals')}
                >
                  Goals ({goals.length})
                </button>
                <button
                  className={activeTab === 'connections' ? 'tab active' : 'tab'}
                  onClick={() => setActiveTab('connections')}
                >
                  Connections ({connections.length})
                </button>
                <button
                  className={activeTab === 'followups' ? 'tab active' : 'tab'}
                  onClick={() => setActiveTab('followups')}
                >
                  Follow-Ups ({followUps.length})
                </button>
              </div>

              <div className="tab-content">
                {activeTab === 'goals' && (
                  <div className="detail-section-card">
                    <div className="section-header">
                      <div className="section-copy">
                        <h3>Networking Goals</h3>
                        <p className="section-subtitle">Set clear targets so you know what success looks like at this event.</p>
                      </div>
                      <button
                        onClick={() => setGoalFormVisible((prev) => !prev)}
                        className="add-button-sm"
                      >
                        {goalFormVisible ? 'Close Form' : '+ Add Goal'}
                      </button>
                    </div>

                    {goalFormVisible && (
                      <div className="inline-form-card">
                        <form className="inline-form" onSubmit={handleGoalSubmit}>
                          <div className="inline-form-grid">
                            <label>
                              Goal Type
                              <select
                                value={goalForm.goal_type}
                                onChange={(e) => setGoalForm({ ...goalForm, goal_type: e.target.value })}
                                required
                              >
                                <option value="connections">Connections</option>
                                <option value="leads">Leads</option>
                                <option value="learning">Learning</option>
                                <option value="visibility">Visibility</option>
                                <option value="skills">Skills</option>
                                <option value="other">Other</option>
                              </select>
                            </label>
                            <label>
                              Target Value
                              <input
                                type="number"
                                min="0"
                                value={goalForm.target_value}
                                onChange={(e) => setGoalForm({ ...goalForm, target_value: e.target.value })}
                                placeholder="Optional"
                              />
                            </label>
                          </div>
                          <label>
                            Description
                            <textarea
                              rows={3}
                              value={goalForm.description}
                              onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                              placeholder="Ex: Meet 5 engineers working on AI products"
                              required
                            />
                          </label>
                          <div className="inline-form-actions">
                            <button
                              type="button"
                              className="cancel-button"
                              onClick={() => {
                                setGoalFormVisible(false);
                                resetGoalForm();
                              }}
                            >
                              Cancel
                            </button>
                            <button type="submit" className="submit-button">Save Goal</button>
                          </div>
                        </form>
                      </div>
                    )}
                    {goals.length === 0 ? (
                      <p className="empty-message">No goals set for this event.</p>
                    ) : (
                      <ul className="goals-list">
                        {goals.map((goal) => (
                          <li key={goal.id} className={goal.achieved ? 'goal-item achieved' : 'goal-item'}>
                            <input
                              type="checkbox"
                              checked={goal.achieved}
                              onChange={() => toggleGoalAchieved(goal.id, goal.achieved)}
                            />
                            <div className="item-content">
                              <strong>{goal.goal_type}</strong>: {goal.description}
                              {goal.target_value && <span> (Target: {goal.target_value})</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {activeTab === 'connections' && (
                  <div className="detail-section-card">
                    <div className="section-header">
                      <div className="section-copy">
                        <h3>Connections Made</h3>
                        <p className="section-subtitle">Capture who you met so you can follow up with confidence.</p>
                      </div>
                      <button
                        onClick={() => setConnectionFormVisible((prev) => !prev)}
                        className="add-button-sm"
                      >
                        {connectionFormVisible ? 'Close Form' : '+ Add Connection'}
                      </button>
                    </div>

                    {connectionFormVisible && (
                      <div className="inline-form-card">
                        <form className="inline-form" onSubmit={handleConnectionSubmit}>
                          <div className="inline-form-grid two-column">
                            <label>
                              Name *
                              <input
                                type="text"
                                value={connectionForm.name}
                                onChange={(e) => setConnectionForm({ ...connectionForm, name: e.target.value })}
                                required
                              />
                            </label>
                            <label>
                              Title
                              <input
                                type="text"
                                value={connectionForm.title}
                                onChange={(e) => setConnectionForm({ ...connectionForm, title: e.target.value })}
                              />
                            </label>
                            <label>
                              Company
                              <input
                                type="text"
                                value={connectionForm.company}
                                onChange={(e) => setConnectionForm({ ...connectionForm, company: e.target.value })}
                              />
                            </label>
                            <label>
                              Potential Value
                              <select
                                value={connectionForm.potential_value}
                                onChange={(e) => setConnectionForm({ ...connectionForm, potential_value: e.target.value })}
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="strategic">Strategic</option>
                              </select>
                            </label>
                          </div>

                          <div className="inline-form-grid two-column">
                            <label>
                              Email
                              <input
                                type="email"
                                value={connectionForm.email}
                                onChange={(e) => setConnectionForm({ ...connectionForm, email: e.target.value })}
                              />
                            </label>
                            <label>
                              Phone
                              <input
                                type="tel"
                                value={connectionForm.phone}
                                onChange={(e) => setConnectionForm({ ...connectionForm, phone: e.target.value })}
                              />
                            </label>
                            <label>
                              LinkedIn URL
                              <input
                                type="url"
                                value={connectionForm.linkedin_url}
                                onChange={(e) => setConnectionForm({ ...connectionForm, linkedin_url: e.target.value })}
                              />
                            </label>
                            <label>
                              Notes
                              <input
                                type="text"
                                value={connectionForm.conversation_notes}
                                onChange={(e) => setConnectionForm({ ...connectionForm, conversation_notes: e.target.value })}
                                placeholder="Conversation highlights"
                              />
                            </label>
                          </div>
                          <div className="inline-form-actions">
                            <button
                              type="button"
                              className="cancel-button"
                              onClick={() => {
                                setConnectionFormVisible(false);
                                resetConnectionForm();
                              }}
                            >
                              Cancel
                            </button>
                            <button type="submit" className="submit-button">Save Connection</button>
                          </div>
                        </form>
                      </div>
                    )}
                    {connections.length === 0 ? (
                      <p className="empty-message">No connections recorded yet.</p>
                    ) : (
                      <div className="connections-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Title</th>
                              <th>Company</th>
                              <th>Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {connections.map((conn) => (
                              <tr key={conn.id}>
                                <td>{conn.name}</td>
                                <td>{conn.title || 'N/A'}</td>
                                <td>{conn.company || 'N/A'}</td>
                                <td>
                                  <span className={`badge badge-value-${conn.potential_value}`}>
                                    {conn.potential_value}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'followups' && (
                  <div className="detail-section-card">
                    <div className="section-header">
                      <div className="section-copy">
                        <h3>Follow-Up Actions</h3>
                        <p className="section-subtitle">Stay on top of next steps while details are still fresh.</p>
                      </div>
                      <button
                        onClick={() => setFollowUpFormVisible((prev) => !prev)}
                        className="add-button-sm"
                      >
                        {followUpFormVisible ? 'Close Form' : '+ Add Follow-Up'}
                      </button>
                    </div>

                    {followUpFormVisible && (
                      <div className="inline-form-card">
                        <form className="inline-form" onSubmit={handleFollowUpSubmit}>
                          <div className="inline-form-grid two-column">
                            <label>
                              Action Type
                              <select
                                value={followUpForm.action_type}
                                onChange={(e) => setFollowUpForm({ ...followUpForm, action_type: e.target.value })}
                                required
                              >
                                <option value="email">Email</option>
                                <option value="linkedin">LinkedIn</option>
                                <option value="phone">Phone Call</option>
                                <option value="meeting">Meeting</option>
                                <option value="application">Application</option>
                                <option value="thank_you">Thank You</option>
                                <option value="other">Other</option>
                              </select>
                            </label>
                            <label>
                              Due Date
                              <input
                                type="date"
                                value={followUpForm.due_date}
                                onChange={(e) => setFollowUpForm({ ...followUpForm, due_date: e.target.value })}
                                required
                              />
                            </label>
                            <label>
                              Related Connection
                              <select
                                value={followUpForm.connection}
                                onChange={(e) => setFollowUpForm({ ...followUpForm, connection: e.target.value })}
                              >
                                <option value="">General</option>
                                {connections.map((conn) => (
                                  <option key={conn.id} value={conn.id}>{conn.name}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <label>
                            Description
                            <textarea
                              rows={3}
                              value={followUpForm.description}
                              onChange={(e) => setFollowUpForm({ ...followUpForm, description: e.target.value })}
                              placeholder="Ex: Send thank-you note with resume"
                              required
                            />
                          </label>
                          <div className="inline-form-actions">
                            <button
                              type="button"
                              className="cancel-button"
                              onClick={() => {
                                setFollowUpFormVisible(false);
                                resetFollowUpForm();
                              }}
                            >
                              Cancel
                            </button>
                            <button type="submit" className="submit-button">Save Follow-Up</button>
                          </div>
                        </form>
                      </div>
                    )}
                    {followUps.length === 0 ? (
                      <p className="empty-message">No follow-up actions scheduled.</p>
                    ) : (
                      <ul className="followups-list">
                        {followUps.map((followUp) => (
                          <li key={followUp.id} className={followUp.completed ? 'followup-item completed' : 'followup-item'}>
                            <input
                              type="checkbox"
                              checked={followUp.completed}
                              onChange={() => toggleFollowUpComplete(followUp.id, followUp.completed)}
                            />
                            <div className="item-content">
                              <strong>{followUp.action_type}</strong>: {followUp.description}
                              <div className="followup-meta">
                                Due: {formatDueDate(followUp.due_date)}
                                {followUp.connection_name && ` • For: ${followUp.connection_name}`}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkingEvents;
