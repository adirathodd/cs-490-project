import React, { useState } from 'react';
import { referralAPI } from '../../services/api';
import Icon from '../common/Icon';
import GuidanceRenderer from '../common/GuidanceRenderer';
import ReferralForm from './ReferralForm';
import './ReferralDetailModal.css';

const ReferralDetailModal = ({ referral, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showEditForm, setShowEditForm] = useState(false);
  const [showGratitudeModal, setShowGratitudeModal] = useState(false);
  const [gratitudeMessage, setGratitudeMessage] = useState('');
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [outcomeData, setOutcomeData] = useState({
    application_submitted: false,
    interview_received: false,
    offer_received: false,
    success_score: 5
  });

  const handleMarkSent = async () => {
    try {
      setLoading(true);
      await referralAPI.markSent(referral.id);
      setSuccess('Marked as sent!');
      onUpdate();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to update status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkResponse = async (accepted) => {
    try {
      setLoading(true);
      await referralAPI.markResponse(referral.id, { accepted });
      setSuccess(`Marked as ${accepted ? 'accepted' : 'declined'}!`);
      onUpdate();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to update status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkCompleted = async () => {
    try {
      setLoading(true);
      await referralAPI.markCompleted(referral.id);
      setSuccess('Marked as completed!');
      onUpdate();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to update status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExpressGratitude = async () => {
    try {
      setLoading(true);
      const result = await referralAPI.expressGratitude(referral.id, {
        generate_message: true,
        outcome: referral.status === 'completed' ? 'referral_given' : 'declined'
      });
      setGratitudeMessage(result.thank_you_message);
      setShowGratitudeModal(true);
      onUpdate();
    } catch (err) {
      setError('Failed to generate gratitude message: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestFollowUp = async () => {
    try {
      setLoading(true);
      const suggestion = await referralAPI.suggestFollowUp(referral.id);
      alert(`Follow-up Suggestion:\n\n${suggestion.guidance}\n\nSuggested Message:\n${suggestion.message_template}`);
    } catch (err) {
      setError('Failed to get follow-up suggestion: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOutcome = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await referralAPI.updateOutcome(referral.id, outcomeData);
      setSuccess('Outcome updated successfully!');
      setShowOutcomeForm(false);
      onUpdate();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to update outcome: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
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

  if (showEditForm) {
    return (
      <ReferralForm
        editingReferral={referral}
        onClose={() => setShowEditForm(false)}
        onSuccess={(updated) => {
          setShowEditForm(false);
          onUpdate && onUpdate(updated);
          setSuccess('Referral updated successfully!');
          setTimeout(() => setSuccess(''), 2000);
        }}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content referral-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{referral.job_title}</h2>
            <p className="company-name">{referral.job_company}</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* Status Section */}
          <div className="detail-section">
            <h3>Status</h3>
            <div className="status-info">
              <span className={getStatusBadgeClass(referral.status)}>
                {referral.status}
              </span>
              <div className="status-actions">
                {referral.status === 'draft' && (
                  <button className="btn btn-sm btn-primary" onClick={handleMarkSent}>
                    Mark as Sent
                  </button>
                )}
                {referral.status === 'sent' && (
                  <>
                    <button className="btn btn-sm btn-success" onClick={() => handleMarkResponse(true)}>
                      Mark Accepted
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleMarkResponse(false)}>
                      Mark Declined
                    </button>
                  </>
                )}
                {referral.status === 'accepted' && (
                  <>
                    <button className="btn btn-sm btn-primary" onClick={handleMarkCompleted}>
                      Mark Completed
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleMarkResponse(false)}>
                      Mark Declined
                    </button>
                  </>
                )}
                {referral.status === 'completed' && (
                  <>
                    <button className="btn btn-sm btn-secondary" onClick={async () => {
                      try {
                        setLoading(true);
                        await referralAPI.unmarkCompleted(referral.id);
                        setSuccess('Marked as active!');
                        onUpdate();
                        setTimeout(() => setSuccess(''), 2000);
                      } catch (err) {
                        setError('Failed to revert completion: ' + err.message);
                      } finally {
                        setLoading(false);
                      }
                    }}>
                      Mark Active
                    </button>
                  </>
                )}
                {referral.status === 'declined' && (
                  <>
                    <button className="btn btn-sm btn-success" onClick={() => handleMarkResponse(true)}>
                      Mark Accepted
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Referral Source */}
          <div className="detail-section">
            <h3>Referral Source</h3>
            <div className="source-info">
              <div className="info-row">
                <Icon name="user" />
                <span><strong>{referral.referral_source_display_name}</strong></span>
              </div>
              {referral.referral_source_title && (
                <div className="info-row">
                  <Icon name="briefcase" size="16" />
                  <span>{referral.referral_source_title}</span>
                </div>
              )}
              {referral.referral_source_email && (
                <div className="info-row">
                  <Icon name="mail" size="16" />
                  <span>{referral.referral_source_email}</span>
                </div>
              )}
              <div className="info-row">
                <Icon name="star" size="16" />
                <span>Relationship: {referral.relationship_strength}</span>
              </div>
            </div>
          </div>

          {/* Request Message */}
          {referral.request_message && (
            <div className="detail-section">
              <h3>Request Message</h3>
              <div className="message-box">
                <pre>{referral.request_message}</pre>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="detail-section">
            <h3>Timeline</h3>
            <div className="timeline">
              <div className="timeline-item">
                <Icon name="plus-circle" size="16" />
                <span>Created: {formatDate(referral.created_at)}</span>
              </div>
              {referral.request_sent_date && (
                <div className="timeline-item">
                  <Icon name="send" size="16" />
                  <span>Sent: {formatDate(referral.request_sent_date)} ({referral.days_since_sent} days ago)</span>
                </div>
              )}
              {referral.response_received_date && (
                <div className="timeline-item">
                  <Icon name="message-circle" size="16" />
                  <span>Response: {formatDate(referral.response_received_date)}</span>
                </div>
              )}
              {referral.referral_given_date && (
                <div className="timeline-item">
                  <Icon name="check-circle" size="16" />
                  <span>Completed: {formatDate(referral.referral_given_date)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Guidance Sections */}
          {referral.optimal_timing_suggestion && (
            <div className="detail-section">
              <details>
                <summary>Timing Guidance</summary>
                <div className="guidance-content">
                  <GuidanceRenderer text={referral.optimal_timing_suggestion} />
                </div>
              </details>
            </div>
          )}

          {referral.etiquette_guidance && (
            <div className="detail-section">
              <details>
                <summary>Etiquette Guidelines</summary>
                <div className="guidance-content">
                  <GuidanceRenderer text={referral.etiquette_guidance} />
                </div>
              </details>
            </div>
          )}

          {/* Follow-up Management */}
          {referral.status === 'sent' && (
            <div className="detail-section">
              <h3>Follow-up</h3>
              {referral.follow_up_scheduled_date && (
                <div className="info-row">
                  <Icon name="calendar" size="16" />
                  <span>Scheduled: {formatDate(referral.follow_up_scheduled_date)}</span>
                </div>
              )}
              <button className="btn btn-sm btn-outline" onClick={handleSuggestFollowUp}>
                <Icon name="lightbulb" size="16" />
                Get Follow-up Suggestion
              </button>
            </div>
          )}

          {/* Gratitude Tracking */}
          {(referral.status === 'accepted' || referral.status === 'completed') && !referral.gratitude_expressed && (
            <div className="detail-section gratitude-section">
              <h3>Express Gratitude</h3>
              <p>Don't forget to thank your referrer! Click below to generate a thank you message.</p>
              <button className="btn btn-primary" onClick={handleExpressGratitude} disabled={loading}>
                <Icon name="heart" />
                Generate Thank You Message
              </button>
            </div>
          )}

          {referral.gratitude_expressed && (
            <div className="detail-section">
              <div className="gratitude-expressed">
                <Icon name="check-circle" size="20" />
                <span>Gratitude expressed on {formatDate(referral.gratitude_date)}</span>
              </div>
            </div>
          )}

          {/* Outcome Tracking */}
          <div className="detail-section">
            <h3>Outcome Tracking</h3>
            {!showOutcomeForm ? (
              <button className="btn btn-sm btn-outline" onClick={() => setShowOutcomeForm(true)}>
                <Icon name="bar-chart" size="16" />
                {referral.outcome ? 'Update Outcome' : 'Track Outcome'}
              </button>
            ) : (
              <form onSubmit={handleSubmitOutcome} className="outcome-form">
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={outcomeData.application_submitted}
                      onChange={(e) => setOutcomeData(prev => ({ ...prev, application_submitted: e.target.checked }))}
                    />
                    Application Submitted
                  </label>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={outcomeData.interview_received}
                      onChange={(e) => setOutcomeData(prev => ({ ...prev, interview_received: e.target.checked }))}
                    />
                    Interview Received
                  </label>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={outcomeData.offer_received}
                      onChange={(e) => setOutcomeData(prev => ({ ...prev, offer_received: e.target.checked }))}
                    />
                    Offer Received
                  </label>
                </div>
                <div className="form-group">
                  <label>Success Score (1-10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={outcomeData.success_score}
                    onChange={(e) => setOutcomeData(prev => ({ ...prev, success_score: parseInt(e.target.value) }))}
                    className="form-control"
                  />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowOutcomeForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={loading}>
                    Save Outcome
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Notes */}
          {referral.notes && (
            <div className="detail-section">
              <h3>Notes</h3>
              <div className="notes-box">
                <pre>{referral.notes}</pre>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-outline" onClick={() => setShowEditForm(true)}>
            <Icon name="edit" size="16" />
            Edit
          </button>
        </div>
      </div>

      {/* Gratitude Message Modal */}
      {showGratitudeModal && (
        <div className="modal-overlay" onClick={() => setShowGratitudeModal(false)}>
          <div className="modal-content gratitude-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Thank You Message</h3>
              <button className="close-btn" onClick={() => setShowGratitudeModal(false)}>
                <Icon name="x" />
              </button>
            </div>
            <div className="modal-body">
              <p>Copy this message and send it to your referrer:</p>
              <div className="message-box">
                <pre>{gratitudeMessage}</pre>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={() => {
                  navigator.clipboard.writeText(gratitudeMessage);
                  alert('Copied to clipboard!');
                }}
              >
                <Icon name="copy" />
                Copy Message
              </button>
              <button className="btn btn-secondary" onClick={() => setShowGratitudeModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralDetailModal;
