/**
 * UC-052: Share Resume Modal
 * Modal for creating and managing resume share links with privacy controls
 */
import React, { useState } from 'react';
import { resumeSharingAPI } from '../../services/api';
import Icon from '../common/Icon';
import './ShareResumeModal.css';

const ShareResumeModal = ({ version, onClose, onShareCreated }) => {
  const [privacyLevel, setPrivacyLevel] = useState('public');
  const [allowedEmails, setAllowedEmails] = useState('');
  const [allowComments, setAllowComments] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [requireReviewerInfo, setRequireReviewerInfo] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [createdShare, setCreatedShare] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCreateShare = async () => {
    setError('');
    setIsCreating(true);

    try {
      // Validate inputs
      if (privacyLevel === 'email_verified' && !allowedEmails.trim()) {
        setError('Please specify at least one email address');
        setIsCreating(false);
        return;
      }

      const shareData = {
        resume_version_id: version.id,
        privacy_level: privacyLevel,
        allow_comments: allowComments,
        allow_download: allowDownload,
        require_reviewer_info: requireReviewerInfo,
        share_message: shareMessage.trim(),
      };

      if (allowedEmails.trim()) {
        shareData.allowed_emails = allowedEmails
          .split(',')
          .map(e => e.trim())
          .filter(e => e);
      }

      if (expiresAt) {
        shareData.expires_at = new Date(expiresAt).toISOString();
      }

      const share = await resumeSharingAPI.createShare(shareData);
      console.log('Share created:', share);
      console.log('Share URL:', share.share_url);
      setCreatedShare(share);
      
      // Don't call onShareCreated here - let user manually close modal
      // if (onShareCreated) {
      //   onShareCreated(share);
      // }
    } catch (err) {
      setError(err.message || 'Failed to create share link');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = async () => {
    if (createdShare && createdShare.share_url) {
      try {
        await navigator.clipboard.writeText(createdShare.share_url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (err) {
        setError('Failed to copy link to clipboard');
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content share-resume-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Icon name="link" size="md" /> Share Resume
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Show created link if available */}
          {createdShare && (
            <div className="share-link-section" style={{
              marginBottom: '24px',
              padding: '16px',
              background: '#e7f7e7',
              borderRadius: '8px',
              border: '2px solid #28a745'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                color: '#28a745',
                fontWeight: '600'
              }}>
                <Icon name="check-circle" size="md" />
                <span>Share Link Created!</span>
              </div>
              
              <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                Share Link:
              </label>
              
              <div style={{
                padding: '12px',
                background: '#ffffff',
                border: '1px solid #28a745',
                borderRadius: '4px',
                marginBottom: '12px',
                wordBreak: 'break-all',
                fontSize: '13px',
                lineHeight: '1.6',
                color: '#000',
                fontFamily: 'monospace'
              }}>
                {createdShare.share_url}
              </div>
              
              <button 
                className="btn-copy" 
                onClick={handleCopyLink}
                style={{ 
                  width: '100%', 
                  justifyContent: 'center', 
                  padding: '10px',
                  background: linkCopied ? '#198754' : '#28a745',
                  border: 'none',
                  transition: 'background 0.3s'
                }}
              >
                <Icon name={linkCopied ? 'check' : 'copy'} size="sm" /> 
                {linkCopied ? 'Link Copied!' : 'Copy Link'}
              </button>
            </div>
          )}

          {!createdShare && (
            <>
              <div className="share-info">
                <h3>{version.version_name}</h3>
                <p className="version-desc">{version.description}</p>
              </div>

              {error && (
                <div className="error-message">
                  <Icon name="info" size="sm" /> {error}
                </div>
              )}

            <div className="form-section">
              <h4>Privacy Settings</h4>
              
              <div className="form-group">
                <label htmlFor="privacy-level">
                  Who can access this resume? <span className="required">*</span>
                </label>
                <select
                  id="privacy-level"
                  value={privacyLevel}
                  onChange={(e) => setPrivacyLevel(e.target.value)}
                  disabled={isCreating}
                >
                  <option value="public">Anyone with the link</option>
                  <option value="email_verified">Specific email addresses only</option>
                </select>
              </div>

              {privacyLevel === 'email_verified' && (
                <div className="form-group">
                  <label htmlFor="allowed-emails">
                    Allowed Email Addresses <span className="required">*</span>
                  </label>
                  <input
                    id="allowed-emails"
                    type="text"
                    value={allowedEmails}
                    onChange={(e) => setAllowedEmails(e.target.value)}
                    placeholder="email1@example.com, email2@example.com"
                    disabled={isCreating}
                  />
                  <small>Separate multiple emails with commas</small>
                </div>
              )}
            </div>

            <div className="form-section">
              <h4>Permissions</h4>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={allowComments}
                    onChange={(e) => setAllowComments(e.target.checked)}
                    disabled={isCreating}
                  />
                  Allow reviewers to leave feedback and comments
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={allowDownload}
                    onChange={(e) => setAllowDownload(e.target.checked)}
                    disabled={isCreating}
                  />
                  Allow reviewers to download the resume
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={requireReviewerInfo}
                    onChange={(e) => setRequireReviewerInfo(e.target.checked)}
                    disabled={isCreating}
                  />
                  Require reviewers to provide their name and email
                </label>
              </div>
            </div>

            <div className="form-section">
              <h4>Additional Options</h4>

              <div className="form-group">
                <label htmlFor="expires-at">
                  Expiration Date (Optional)
                </label>
                <input
                  id="expires-at"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  disabled={isCreating}
                />
                <small>Leave empty for no expiration</small>
              </div>

              <div className="form-group">
                <label htmlFor="share-message">
                  Message to Reviewers (Optional)
                </label>
                <textarea
                  id="share-message"
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  placeholder="Add a message that will be displayed to reviewers..."
                  rows={3}
                  maxLength={500}
                  disabled={isCreating}
                />
              </div>
            </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          {!createdShare && (
            <button
              className="btn-secondary"
              onClick={onClose}
              disabled={isCreating}
            >
              Cancel
            </button>
          )}
          {!createdShare && (
            <button
              className="btn-primary"
              onClick={handleCreateShare}
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Icon name="loader" size="sm" /> Creating...
                </>
              ) : (
                <>
                  <Icon name="link" size="sm" /> Create Share Link
                </>
              )}
            </button>
          )}
          {createdShare && (
            <button
              className="btn-primary"
              onClick={onClose}
              style={{ width: '100%' }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareResumeModal;
