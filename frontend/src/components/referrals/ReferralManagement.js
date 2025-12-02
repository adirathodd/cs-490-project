import React, { useState, useEffect } from 'react';
import { referralAPI } from '../../services/api';
import './ReferralManagement.css';
import Icon from '../common/Icon';
import ReferralForm from './ReferralForm';
import ReferralDetailModal from './ReferralDetailModal';

const ReferralManagement = () => {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // active, completed, all
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [cardLoading, setCardLoading] = useState({});


  useEffect(() => {
    fetchReferrals();
    fetchAnalytics();
  }, [activeTab]);

  const fetchReferrals = async (tabOverride) => {
    try {
      setLoading(true);
      const params = {};
      const tab = tabOverride || activeTab;
      if (tab === 'active') {
        params.status = 'draft,pending,sent';
      } else if (tab === 'completed') {
        params.status = 'completed,declined,cancelled';
      }

      const data = await referralAPI.list(params);
      setReferrals(data);
      return data;
    } catch (err) {
      setError('Failed to load referrals: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await referralAPI.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  const handleViewDetails = (referral) => {
    setSelectedReferral(referral);
    setShowDetailModal(true);
  };

  const cardActionMarkSent = async (id) => {
    if (!window.confirm('Mark this referral as sent?')) return;
    setCardLoading((s) => ({ ...s, [id]: true }));
    try {
      await referralAPI.markSent(id);
      await fetchReferrals();
      setSuccess('Marked as sent!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to update status: ' + err.message);
    } finally {
      setCardLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const cardActionMarkResponse = async (id, accepted) => {
    const verb = accepted ? 'accept' : 'decline';
    if (!window.confirm(`Mark this referral as ${verb}?`)) return;
    setCardLoading((s) => ({ ...s, [id]: true }));
    try {
      await referralAPI.markResponse(id, { accepted });
      await fetchReferrals();
      setSuccess(accepted ? 'Marked as accepted!' : 'Marked as declined!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to update status: ' + err.message);
    } finally {
      setCardLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const cardActionMarkCompleted = async (id) => {
    if (!window.confirm('Mark this referral as completed?')) return;
    setCardLoading((s) => ({ ...s, [id]: true }));
    try {
      await referralAPI.markCompleted(id);
      await fetchReferrals();
      setSuccess('Marked as completed!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to update status: ' + err.message);
    } finally {
      setCardLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const cardActionUnmarkCompleted = async (id) => {
    if (!window.confirm('Revert this referral to active status?')) return;
    setCardLoading((s) => ({ ...s, [id]: true }));
    try {
      await referralAPI.unmarkCompleted(id);
      await fetchReferrals();
      setSuccess('Marked as active!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to update status: ' + err.message);
    } finally {
      setCardLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const handleDelete = async (id, jobTitle) => {
    if (!window.confirm(`Are you sure you want to delete the referral request for ${jobTitle}? This action cannot be undone.`)) {
      return;
    }
    
    setCardLoading((s) => ({ ...s, [id]: true }));
    try {
      await referralAPI.remove(id);
      await fetchReferrals();
      await fetchAnalytics();
      setSuccess('Referral deleted successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to delete referral: ' + err.message);
    } finally {
      setCardLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const handleCreateNew = () => {
    setShowForm(true);
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      draft: 'badge-secondary',
      pending: 'badge-warning',
      sent: 'badge-info',
      accepted: 'badge-success',
      declined: 'badge-danger',
      completed: 'badge-primary',
      cancelled: 'badge-secondary'
    };
    return `status-badge ${statusMap[status] || 'badge-secondary'}`;
  };

  const getRelationshipIcon = (strength) => {
    const iconMap = {
      strong: '⭐⭐⭐',
      moderate: '⭐⭐',
      weak: '⭐',
      minimal: '☆'
    };
    return iconMap[strength] || '☆';
  };

  // Don't replace the whole page during loading (prevents blinking when switching tabs).
  // Instead show an inline/overlay spinner while keeping the existing content visible.

  return (
    <div className="referral-management">
      <div className="referral-header">
        <h1>Referral Request Management</h1>
        <button className="btn btn-primary" onClick={handleCreateNew}>
          <Icon name="plus" /> New Referral Request
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Analytics Dashboard */}
      {analytics && (
        <div className="analytics-overview">
          <div className="stat-card">
            <div className="stat-value">{analytics.overview.total_requests}</div>
            <div className="stat-label">Total Requests</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{analytics.overview.success_rate}%</div>
            <div className="stat-label">Success Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{analytics.overview.accepted_requests}</div>
            <div className="stat-label">Accepted</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{analytics.follow_ups.pending}</div>
            <div className="stat-label">Pending Follow-ups</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{analytics.gratitude_tracking.pending}</div>
            <div className="stat-label">Gratitude Pending</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="referral-tabs">
        <button
          className={`tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
          disabled={loading}
        >
          Active Requests
        </button>
        <button
          className={`tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
          disabled={loading}
        >
          Completed
        </button>
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
          disabled={loading}
        >
          All
        </button>
      </div>

      {/* Inline loading indicator: keep page content while fetching to avoid blink */}
      {loading && (
        <div className="referral-loading-indicator">
          <div className="loading-spinner">Loading referrals...</div>
        </div>
      )}

      {/* Referral List */}
      <div className="referral-list">
        {referrals.length === 0 ? (
          <div className="empty-state">
            <Icon name="users" size="64" />
            <h3>No referral requests yet</h3>
            <p>Start tracking your referral requests to leverage your professional network.</p>
            <button className="btn btn-primary" onClick={handleCreateNew}>
              Create Your First Referral Request
            </button>
          </div>
        ) : (
          <div className="referral-cards">
            {referrals.map((referral) => (
              <div id={`referral-${referral.id}`} key={referral.id} className="referral-card">
                <div className="card-header">
                  <div className="card-title">
                    <h3>{referral.job_title}</h3>
                    <span className="company-name">{referral.job_company}</span>
                  </div>
                  <span className={getStatusBadgeClass(referral.status)}>
                    {referral.status}
                  </span>
                </div>

                <div className="card-body">
                  <div className="referral-source">
                    <Icon name="user" />
                    <div>
                      <strong>{referral.referral_source_display_name}</strong>
                      <span className="relationship-strength">
                        {getRelationshipIcon(referral.relationship_strength)}
                        {' '}{referral.relationship_strength}
                      </span>
                    </div>
                  </div>

                  <div className="referral-meta">
                    {referral.request_sent_date && (
                      <div className="meta-item">
                        <Icon name="calendar" size="14" />
                        Sent {referral.days_since_sent} days ago
                      </div>
                    )}
                    {referral.follow_up_scheduled_date && !referral.follow_up_completed && (
                      <div className="meta-item warning">
                        <Icon name="clock" size="14" />
                        Follow-up {referral.needs_follow_up ? 'overdue' : `in ${Math.abs(referral.days_until_follow_up)} days`}
                      </div>
                    )}
                    {!referral.gratitude_expressed && referral.status === 'accepted' && (
                      <div className="meta-item info">
                        <Icon name="heart" size="14" />
                        Express gratitude
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-actions">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => handleViewDetails(referral)}
                  >
                    View Details
                  </button>

                  {/* Quick actions on the card for convenience */}
                  {referral.status === 'draft' && (
                    <button className="btn btn-sm btn-primary" onClick={() => cardActionMarkSent(referral.id)} disabled={cardLoading[referral.id]}>
                      {cardLoading[referral.id] ? 'Working...' : 'Mark Sent'}
                    </button>
                  )}

                  {referral.status === 'sent' && (
                    <>
                      <button className="btn btn-sm btn-success" onClick={() => cardActionMarkResponse(referral.id, true)} disabled={cardLoading[referral.id]}>
                        {cardLoading[referral.id] ? 'Working...' : 'Accept'}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => cardActionMarkResponse(referral.id, false)} disabled={cardLoading[referral.id]}>
                        {cardLoading[referral.id] ? 'Working...' : 'Decline'}
                      </button>
                    </>
                  )}

                  {referral.status === 'accepted' && (
                    <button className="btn btn-sm btn-primary" onClick={() => cardActionMarkCompleted(referral.id)} disabled={cardLoading[referral.id]}>
                      {cardLoading[referral.id] ? 'Working...' : 'Complete'}
                    </button>
                  )}

                  {referral.status === 'completed' && (
                    <button className="btn btn-sm btn-secondary" onClick={() => cardActionUnmarkCompleted(referral.id)} disabled={cardLoading[referral.id]}>
                      {cardLoading[referral.id] ? 'Working...' : 'Make Active'}
                    </button>
                  )}

                  {/* Delete button available for all statuses */}
                  <button 
                    className="btn btn-sm btn-danger-outline" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(referral.id, referral.job_title);
                    }} 
                    disabled={cardLoading[referral.id]}
                    title="Delete referral request"
                  >
                    <Icon name="trash" size="14" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <ReferralForm
          onClose={() => setShowForm(false)}
          onSuccess={async (created) => {
            setShowForm(false);
            // Switch to the 'All' tab and refresh data so the newly created request appears there immediately
            setActiveTab('all');
            const data = await fetchReferrals('all');
            fetchAnalytics();
            setSuccess('Referral request created successfully!');

            // If we have the created referral id, scroll to and highlight it
            const id = created?.id;
            if (id) {
              // Give the list a moment to render
              setTimeout(() => {
                const el = document.getElementById(`referral-${id}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('highlight');
                  // Remove highlight after 3s
                  setTimeout(() => el.classList.remove('highlight'), 3000);
                }
              }, 200);
            }

            setTimeout(() => setSuccess(''), 3000);
          }}
        />
      )}

      {showDetailModal && selectedReferral && (
        <ReferralDetailModal
          referral={selectedReferral}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedReferral(null);
          }}
          onUpdate={async (updated) => {
            await fetchReferrals();
            fetchAnalytics();
            // If the updated referral was provided, scroll to and highlight it
            const id = updated?.id;
            if (id) {
              setTimeout(() => {
                const el = document.getElementById(`referral-${id}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('highlight');
                  setTimeout(() => el.classList.remove('highlight'), 2000);
                }
              }, 200);
            }
          }}
        />
      )}
    </div>
  );
};

export default ReferralManagement;
