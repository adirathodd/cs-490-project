/**
 * UC-052: Feedback Panel
 * Display and manage feedback on shared resumes
 */
import React, { useState, useEffect } from 'react';
import { feedbackAPI, commentAPI, resumeVersionAPI } from '../../services/api';
import Icon from '../common/Icon';
import './FeedbackPanel.css';

const FeedbackPanel = ({ versionId, onClose }) => {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [filter, setFilter] = useState('all'); // all, pending, resolved
  // eslint-disable-next-line no-unused-vars
  const [showComments, setShowComments] = useState(true);
  
  // Resolution modal states
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [feedbackToResolve, setFeedbackToResolve] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    loadFeedback();
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId, filter]);

  const loadVersions = async () => {
    try {
      const data = await resumeVersionAPI.listVersions(false);
      setVersions(data.versions || []);
    } catch (err) {
      console.error('Failed to load versions:', err);
    }
  };

  const loadFeedback = async () => {
    setLoading(true);
    setError('');
    try {
      const filters = { version_id: versionId };
      
      if (filter === 'pending') {
        filters.is_resolved = false;
      } else if (filter === 'resolved') {
        filters.is_resolved = true;
      }

      const data = await feedbackAPI.listFeedback(filters);
      setFeedback(data.feedback || []);
    } catch (err) {
      setError(err.message || 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFeedback = async (fb) => {
    try {
      const detailed = await feedbackAPI.getFeedback(fb.id);
      setSelectedFeedback(detailed);
    } catch (err) {
      setError(err.message || 'Failed to load feedback details');
    }
  };

  const handleResolveFeedback = async (feedbackItem) => {
    // Show modal for version selection
    setFeedbackToResolve(feedbackItem);
    setResolutionNotes('');
    setSelectedVersionId('');
    setShowResolveModal(true);
  };

  const confirmResolveFeedback = async () => {
    if (!feedbackToResolve) return;
    
    try {
      await feedbackAPI.resolveFeedback(
        feedbackToResolve.id,
        resolutionNotes,
        selectedVersionId || null
      );
      
      setShowResolveModal(false);
      setFeedbackToResolve(null);
      setResolutionNotes('');
      setSelectedVersionId('');
      
      loadFeedback();
      if (selectedFeedback && selectedFeedback.id === feedbackToResolve.id) {
        const updated = await feedbackAPI.getFeedback(feedbackToResolve.id);
        setSelectedFeedback(updated);
      }
    } catch (err) {
      setError(err.message || 'Failed to resolve feedback');
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    if (!window.confirm('Are you sure you want to delete this feedback?')) {
      return;
    }

    try {
      await feedbackAPI.deleteFeedback(feedbackId);
      loadFeedback();
      if (selectedFeedback && selectedFeedback.id === feedbackId) {
        setSelectedFeedback(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete feedback');
    }
  };

  const handleResolveComment = async (commentId) => {
    try {
      await commentAPI.resolveComment(commentId);
      // Reload feedback details to get updated comments
      if (selectedFeedback) {
        const updated = await feedbackAPI.getFeedback(selectedFeedback.id);
        setSelectedFeedback(updated);
      }
    } catch (err) {
      setError(err.message || 'Failed to resolve comment');
    }
  };

  const renderStars = (rating) => {
    if (!rating) return null;
    
    return (
      <div className="star-rating">
        {[1, 2, 3, 4, 5].map(star => (
          <Icon
            key={star}
            name="star"
            size="sm"
            className={star <= rating ? 'star-filled' : 'star-empty'}
          />
        ))}
      </div>
    );
  };

  const renderCommentThread = (comment, depth = 0) => {
    return (
      <div key={comment.id} className={`comment-item depth-${depth}`}>
        <div className="comment-header">
          <div className="commenter-info">
            <Icon name="user" size="sm" />
            <strong>{comment.commenter_name}</strong>
            {comment.is_owner && <span className="owner-badge">You</span>}
          </div>
          <div className="comment-meta">
            <span className="comment-type">{comment.comment_type}</span>
            <span className="comment-date">
              {new Date(comment.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="comment-body">
          {comment.section && (
            <div className="comment-section">
              <Icon name="link" size="sm" />
              Section: {comment.section}
              {comment.section_index !== null && ` (item ${comment.section_index})`}
            </div>
          )}

          {comment.highlighted_text && (
            <div className="highlighted-text">
              <Icon name="quote" size="sm" />
              "{comment.highlighted_text}"
            </div>
          )}

          <p className="comment-text">{comment.comment_text}</p>
        </div>

        <div className="comment-actions">
          {!comment.is_resolved && (
            <button
              className="action-link"
              onClick={() => handleResolveComment(comment.id)}
            >
              <Icon name="check" size="sm" /> Mark Resolved
            </button>
          )}
          {comment.is_resolved && (
            <span className="resolved-badge">
              <Icon name="check-circle" size="sm" /> Resolved
            </span>
          )}
        </div>

        {comment.replies && comment.replies.length > 0 && (
          <div className="comment-replies">
            {comment.replies.map(reply => renderCommentThread(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="feedback-panel">
      <div className="panel-header">
        <h2>
          <Icon name="clipboard" size="md" /> Feedback & Comments
        </h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      {error && (
        <div className="error-message">
          <Icon name="info" size="sm" /> {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="panel-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({feedback.length})
        </button>
        <button
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          <Icon name="clock" size="sm" /> Pending
        </button>
        <button
          className={`filter-btn ${filter === 'resolved' ? 'active' : ''}`}
          onClick={() => setFilter('resolved')}
        >
          <Icon name="check-circle" size="sm" /> Resolved
        </button>
      </div>

      <div className="panel-content">
        {loading ? (
          <div className="loading-state">
            <Icon name="loader" size="lg" />
            <p>Loading feedback...</p>
          </div>
        ) : feedback.length === 0 ? (
          <div className="empty-state">
            <Icon name="clipboard" size="lg" />
            <h3>No Feedback Yet</h3>
            <p>Share your resume to receive feedback from reviewers</p>
          </div>
        ) : (
          <div className="feedback-list">
            {feedback.map(fb => (
              <div
                key={fb.id}
                className={`feedback-item ${selectedFeedback?.id === fb.id ? 'selected' : ''} ${fb.is_resolved ? 'resolved' : ''}`}
                onClick={() => handleSelectFeedback(fb)}
              >
                <div className="feedback-header">
                  <div className="reviewer-info">
                    <Icon name="user" size="sm" />
                    <div>
                      <strong>{fb.reviewer_name || 'Anonymous'}</strong>
                      {fb.reviewer_title && (
                        <span className="reviewer-title">{fb.reviewer_title}</span>
                      )}
                    </div>
                  </div>
                  {renderStars(fb.rating)}
                </div>

                <div className="feedback-meta">
                  <span className={`status-badge status-${fb.status}`}>
                    {fb.status}
                  </span>
                  <span className="feedback-date">
                    {new Date(fb.created_at).toLocaleDateString()}
                  </span>
                  {fb.comment_count > 0 && (
                    <span className="comment-count">
                      <Icon name="comment" size="sm" /> {fb.comment_count}
                    </span>
                  )}
                </div>

                {fb.incorporated_in_version && (
                  <div className="incorporated-version-badge">
                    <Icon name="git-merge" size="sm" />
                    <span>
                      Incorporated in: <strong>{fb.incorporated_in_version.version_name}</strong>
                    </span>
                  </div>
                )}

                <div className="feedback-actions">
                  {!fb.is_resolved && (
                    <button
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResolveFeedback(fb);
                      }}
                    >
                      <Icon name="check" size="sm" /> Resolve
                    </button>
                  )}
                  <button
                    className="action-btn delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFeedback(fb.id);
                    }}
                  >
                    <Icon name="trash" size="sm" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedFeedback && (
        <div className="feedback-details-panel">
          <div className="details-header">
            <h3>Feedback Details</h3>
            <button
              className="close-details-btn"
              onClick={() => setSelectedFeedback(null)}
            >
              <Icon name="chevronRight" size="sm" />
            </button>
          </div>

          <div className="details-content">
            <div className="feedback-overview">
              <div className="reviewer-details">
                <Icon name="user" size="md" />
                <div>
                  <h4>{selectedFeedback.reviewer_name || 'Anonymous'}</h4>
                  {selectedFeedback.reviewer_title && (
                    <p className="title">{selectedFeedback.reviewer_title}</p>
                  )}
                  <p className="email">{selectedFeedback.reviewer_email}</p>
                </div>
              </div>

              {selectedFeedback.rating && (
                <div className="rating-display">
                  {renderStars(selectedFeedback.rating)}
                  <span className="rating-text">
                    {selectedFeedback.rating} out of 5
                  </span>
                </div>
              )}

              <div className="overall-feedback">
                <h5>Overall Feedback</h5>
                <p>{selectedFeedback.overall_feedback}</p>
              </div>

              {selectedFeedback.incorporated_in_version && (
                <div className="incorporated-version-info">
                  <h5>
                    <Icon name="git-merge" size="sm" /> Incorporated In
                  </h5>
                  <div className="version-details">
                    <p><strong>{selectedFeedback.incorporated_in_version.version_name}</strong></p>
                    {selectedFeedback.incorporated_in_version.description && (
                      <p className="version-description">
                        {selectedFeedback.incorporated_in_version.description}
                      </p>
                    )}
                    {selectedFeedback.resolved_at && (
                      <p className="resolved-date">
                        Resolved on {new Date(selectedFeedback.resolved_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedFeedback.resolution_notes && (
                <div className="resolution-notes">
                  <h5>Resolution Notes</h5>
                  <p>{selectedFeedback.resolution_notes}</p>
                </div>
              )}
            </div>

            {showComments && selectedFeedback.comments && selectedFeedback.comments.length > 0 && (
              <div className="comments-section">
                <h5>
                  <Icon name="comment" size="sm" /> 
                  Comments ({selectedFeedback.comments.length})
                </h5>
                <div className="comments-list">
                  {selectedFeedback.comments
                    .filter(c => !c.parent_comment) // Only top-level comments
                    .map(comment => renderCommentThread(comment))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resolve Feedback Modal */}
      {showResolveModal && (
        <div className="modal-overlay" onClick={() => setShowResolveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="check-circle" size="md" /> Resolve Feedback
              </h3>
              <button className="close-btn" onClick={() => setShowResolveModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-description">
                Mark this feedback as resolved and optionally indicate which resume version incorporated the changes.
              </p>

              <div className="form-group">
                <label htmlFor="incorporated-version">
                  <Icon name="file-text" size="sm" /> Incorporated in Version (Optional)
                </label>
                <select
                  id="incorporated-version"
                  value={selectedVersionId}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  className="form-select"
                >
                  <option value="">-- No version selected --</option>
                  {versions.map(version => (
                    <option key={version.id} value={version.id}>
                      {version.version_name}
                      {version.is_default && ' (Default)'}
                      {version.description && ` - ${version.description}`}
                    </option>
                  ))}
                </select>
                <small className="form-hint">
                  Select the resume version where you incorporated this feedback
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="resolution-notes">
                  <Icon name="edit" size="sm" /> Resolution Notes (Optional)
                </label>
                <textarea
                  id="resolution-notes"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add notes about how you addressed this feedback..."
                  rows="4"
                  className="form-textarea"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowResolveModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={confirmResolveFeedback}
              >
                <Icon name="check" size="sm" /> Mark as Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackPanel;
