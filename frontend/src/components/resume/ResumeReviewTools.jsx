import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { resumeSharingAPI, resumeVersionAPI, mentorshipAPI, feedbackAPI, materialsAPI } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import './ResumeReviewTools.css';
import { AuthContext } from '../../context/AuthContext';

const DEFAULT_FORM = {
  materialType: 'resume',
  versionId: '',
  coverLetterId: '',
  accessLevel: 'comment',
  reviewerType: 'mentor',
  mentorId: '',
  customEmail: '',
  deadline: '',
  message: ''
};

const formatDateTime = (value) => {
  try {
    return value ? new Date(value).toLocaleString() : null;
  } catch {
    return null;
  }
};

const REVIEWER_HIDDEN_STORAGE_KEY = 'ats_resume_review_hidden_shares';
const getInitialHiddenShareIds = () => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = window.localStorage.getItem(REVIEWER_HIDDEN_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const ResumeReviewTools = () => {
  const [loading, setLoading] = useState(true);
  const [shares, setShares] = useState([]);
  const [versions, setVersions] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [status, setStatus] = useState({ error: '', success: '' });
  const [sharing, setSharing] = useState(false);
  const [coverLetters, setCoverLetters] = useState([]);
  const [reviewerShares, setReviewerShares] = useState([]);
  const [reviewerLoading, setReviewerLoading] = useState(true);
  const [reviewerError, setReviewerError] = useState('');
  const [previewShare, setPreviewShare] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewBlobUrl, setPreviewBlobUrl] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [commentSuccess, setCommentSuccess] = useState('');
  const { currentUser, userProfile } = useContext(AuthContext);
  const [copiedShareId, setCopiedShareId] = useState(null);
  const [hiddenReviewerShareIds, setHiddenReviewerShareIds] = useState(getInitialHiddenShareIds);
  const [showHiddenReviewerShares, setShowHiddenReviewerShares] = useState(false);
  const [feedbackActionStatus, setFeedbackActionStatus] = useState({});
  const [feedbackActionLoadingId, setFeedbackActionLoadingId] = useState(null);
  const [reviewerStats, setReviewerStats] = useState({
    reviews_given: 0,
    reviews_implemented: 0
  });
  const [reviewFeedbackActionStatus, setReviewFeedbackActionStatus] = useState({});
  const [reviewFeedbackActionLoadingId, setReviewFeedbackActionLoadingId] = useState(null);
  const [deletingShareId, setDeletingShareId] = useState(null);
  const [shareDeleteStatus, setShareDeleteStatus] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setStatus((prev) => ({ ...prev, error: '' }));
    try {
      const [versionPayload, sharePayload, relationshipPayload, coverLetterPayload] = await Promise.all([
        resumeVersionAPI.listVersions(false),
        resumeSharingAPI.listShares(),
        mentorshipAPI.getRelationships(),
        materialsAPI.listDocuments('cover_letter')
      ]);

      setVersions(versionPayload?.versions || []);
      setShares(sharePayload?.shares || []);
      setMentors(relationshipPayload?.mentors || []);
      setCoverLetters(coverLetterPayload || []);
    } catch (err) {
      const message = err?.message || 'Unable to load resume review data.';
      setStatus({ error: message, success: '' });
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshShares = useCallback(async () => {
    try {
      const response = await resumeSharingAPI.listShares();
      setShares(response?.shares || []);
    } catch (err) {
      console.error('Failed to refresh resume shares', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadReviewerShares = useCallback(async () => {
    setReviewerLoading(true);
    setReviewerError('');
    try {
      const response = await resumeSharingAPI.listReviewerShares();
      setReviewerShares(response.shares || []);
    } catch (err) {
      setReviewerError(err?.message || 'Unable to load your review requests.');
    } finally {
      setReviewerLoading(false);
    }
  }, []);

  const buildReviewerAccessData = () => ({
    reviewer_name:
      userProfile?.name ||
      currentUser?.displayName ||
      currentUser?.email?.split('@')[0] ||
      'Reviewer',
    reviewer_email: currentUser?.email || ''
  });

  const handlePreviewShare = async (share) => {
    if (!share.share_url) {
      setPreviewError('Share link missing');
      setPreviewShare(null);
      return;
    }
    const token = share.share_url.trim().split('/').filter(Boolean).pop();
    if (!token) {
      setPreviewError('Invalid share link');
      setPreviewShare(null);
      return;
    }

    setPreviewLoading(true);
    setPreviewError('');
    try {
    const accessData = buildReviewerAccessData();
      const sharedData = await resumeSharingAPI.viewSharedResume(token, accessData);
      const pdfArray = await resumeSharingAPI.previewSharePdf(token, accessData);
      const blobUrl = URL.createObjectURL(new Blob([pdfArray], { type: 'application/pdf' }));
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
      setPreviewBlobUrl(blobUrl);
      setPreviewShare({
        shareId: share.id,
        pdfUrl: blobUrl,
        share: sharedData.share,
        resume: sharedData.resume,
        document: sharedData.document,
      });
    } catch (error) {
      setPreviewShare(null);
      setPreviewError(error?.message || 'Unable to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    loadReviewerShares();
  }, [loadReviewerShares]);

  const loadReviewerStats = useCallback(async () => {
    try {
      const response = await resumeSharingAPI.getReviewerStats();
      setReviewerStats({
        reviews_given: response.reviews_given || 0,
        reviews_implemented: response.reviews_implemented || 0
      });
    } catch (err) {
      // Swallow; stats are non-critical
    }
  }, []);

  useEffect(() => {
    loadReviewerStats();
  }, [loadReviewerStats]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(REVIEWER_HIDDEN_STORAGE_KEY, JSON.stringify(hiddenReviewerShareIds));
    } catch {
      // Ignore write errors
    }
  }, [hiddenReviewerShareIds]);

  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  useEffect(() => {
    if (!form.versionId && versions.length) {
      setForm((prev) => ({ ...prev, versionId: versions[0].id }));
    }
  }, [versions, form.versionId]);

  useEffect(() => {
    if (!form.mentorId && mentors.length) {
      setForm((prev) => ({ ...prev, mentorId: mentors[0].id }));
    }
  }, [mentors, form.mentorId]);

  useEffect(() => {
    if (!form.coverLetterId && coverLetters.length) {
      setForm((prev) => ({ ...prev, coverLetterId: coverLetters[0].id }));
    }
  }, [coverLetters, form.coverLetterId]);

  const mentorOptions = useMemo(
    () =>
      mentors.map((item) => {
        const contact = item?.mentor || item?.collaborator || {};
        return {
          id: item.id,
          name: contact.full_name || contact.email || 'Mentor',
          email: contact.email || ''
        };
      }),
    [mentors]
  );

  useEffect(() => {
    if (!mentorOptions.length && form.reviewerType === 'mentor') {
      setForm((prev) => ({ ...prev, reviewerType: 'manual' }));
    }
  }, [mentorOptions.length, form.reviewerType]);

  const selectedMentor = mentorOptions.find((mentor) => mentor.id === form.mentorId);
  const reviewerEmail =
    form.reviewerType === 'mentor' ? selectedMentor?.email || '' : form.customEmail.trim();

  const handleFormChange = (field, value) => {
    setStatus({ error: '', success: '' });
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleShareSubmit = async (event) => {
    event.preventDefault();
    if (form.materialType === 'resume' && !form.versionId) {
      setStatus({ error: 'Please select a resume version.', success: '' });
      return;
    }
    if (form.materialType === 'cover_letter' && !form.coverLetterId) {
      setStatus({ error: 'Please select a cover letter to share.', success: '' });
      return;
    }

    if (form.reviewerType === 'mentor' && !reviewerEmail) {
      setStatus({ error: 'Selected mentor must have an email address.', success: '' });
      return;
    }

    if (form.reviewerType === 'manual' && !reviewerEmail) {
      setStatus({ error: 'Please enter a reviewer email.', success: '' });
      return;
    }

    setSharing(true);
    try {
      const payload = {
        privacy_level: 'email_verified',
        allowed_emails: reviewerEmail ? [reviewerEmail] : [],
        allow_comments: true,
        allow_download: form.accessLevel === 'edit',
        allow_edit: form.accessLevel === 'edit',
        require_reviewer_info: false,
        share_message: form.message.trim()
      };

      if (form.materialType === 'resume') {
        payload.resume_version_id = form.versionId;
      } else {
        payload.cover_letter_document_id = form.coverLetterId;
      }

      if (form.deadline) {
        const deadlineIso = new Date(form.deadline);
        if (!Number.isNaN(deadlineIso.getTime())) {
          payload.expires_at = deadlineIso.toISOString();
        }
      }

      await resumeSharingAPI.createShare(payload);
      setStatus({
        success: `Review request sent to ${reviewerEmail || 'your reviewer'}.`,
        error: ''
      });
      setForm((prev) => ({
        ...prev,
        accessLevel: 'comment',
        message: '',
        customEmail: '',
        deadline: ''
      }));
      await loadData();
    } catch (err) {
      const message = err?.message || 'Unable to create review share.';
      setStatus({ error: message, success: '' });
    } finally {
      setSharing(false);
    }
  };

  const handleDeleteShare = async (shareId) => {
    if (!shareId) return;
    if (!window.confirm('Remove this review request? This cannot be undone.')) {
      return;
    }
    setDeletingShareId(shareId);
    setShareDeleteStatus((prev) => ({
      ...prev,
      [shareId]: { message: '', type: '' }
    }));

    try {
      await resumeSharingAPI.deleteShare(shareId);
      setShareDeleteStatus((prev) => ({
        ...prev,
        [shareId]: { message: 'Review request removed.', type: 'success' }
      }));
      await loadData();
    } catch (err) {
      setShareDeleteStatus((prev) => ({
        ...prev,
        [shareId]: {
          message: err?.message || 'Unable to remove review request.',
          type: 'error'
        }
      }));
    } finally {
      setDeletingShareId(null);
    }
  };

  const handleReviewerMarkFeedbackUsed = async (feedbackId) => {
    if (!feedbackId || !previewShare?.share?.share_token) return;
    setReviewFeedbackActionLoadingId(feedbackId);
    setReviewFeedbackActionStatus((prev) => ({
      ...prev,
      [feedbackId]: { message: '', type: '' }
    }));

    try {
      await feedbackAPI.resolveFeedback(feedbackId);
      const refreshedShare = await resumeSharingAPI.viewSharedResume(
        previewShare.share.share_token,
        buildReviewerAccessData()
      );
      setPreviewShare((prev) => ({
        ...prev,
        share: refreshedShare.share
      }));
      setReviewFeedbackActionStatus((prev) => ({
        ...prev,
        [feedbackId]: { message: 'Feedback marked as used.', type: 'success' }
      }));
    } catch (err) {
      setReviewFeedbackActionStatus((prev) => ({
        ...prev,
        [feedbackId]: {
          message: err?.message || 'Unable to mark review as used.',
          type: 'error'
        }
      }));
    } finally {
      setReviewFeedbackActionLoadingId(null);
    }
  };

  const handleMarkFeedbackUsed = async (shareId, feedbackId) => {
    if (!feedbackId) return;
    setFeedbackActionLoadingId(feedbackId);
    setFeedbackActionStatus((prev) => ({
      ...prev,
      [shareId]: { message: '', type: '' }
    }));

    try {
      await feedbackAPI.resolveFeedback(feedbackId);
      await refreshShares();
      await loadReviewerShares();
      setFeedbackActionStatus((prev) => ({
        ...prev,
        [shareId]: { message: 'Feedback marked as used.', type: 'success' }
      }));
    } catch (err) {
      const message = err?.message || 'Unable to mark feedback as used.';
      setFeedbackActionStatus((prev) => ({
        ...prev,
        [shareId]: { message, type: 'error' }
      }));
    } finally {
      setFeedbackActionLoadingId(null);
    }
  };

  const handleMarkShareDone = (shareId) => {
    setHiddenReviewerShareIds((prev) => (prev.includes(shareId) ? prev : [...prev, shareId]));
  };

  const handleRestoreHiddenShare = (shareId) => {
    setHiddenReviewerShareIds((prev) => prev.filter((id) => id !== shareId));
  };

  const resolvedRate = (share) => {
    const total = share.feedback_count || 0;
    if (!total) return 0;
    const resolved = Math.max(total - (share.pending_feedback_count || 0), 0);
    return Math.round((resolved / total) * 100);
  };

  const renderForm = () => (
    <section className="review-form-card">
      <header>
        <p className="eyebrow">Tools / Document Review</p>
        <h2>Send a collaborative review request</h2>
        <p className="muted">
          Pick a generated resume or cover letter version, invite a mentor or reviewer, and
          grant them comment or edit access.
        </p>
      </header>

      <form className="review-form" onSubmit={handleShareSubmit}>
        <label className="review-form__field">
          <span>Document type</span>
          <div className="material-type-options">
            <label
              className={`radio-label ${form.materialType === 'resume' ? 'radio-label--active' : ''}`}
            >
              <input
                type="radio"
                name="materialType"
                value="resume"
                checked={form.materialType === 'resume'}
                onChange={() => handleFormChange('materialType', 'resume')}
              />
              Resume
            </label>
            <label
              className={`radio-label ${form.materialType === 'cover_letter' ? 'radio-label--active' : ''}`}
            >
              <input
                type="radio"
                name="materialType"
                value="cover_letter"
                checked={form.materialType === 'cover_letter'}
                onChange={() => handleFormChange('materialType', 'cover_letter')}
              />
              Cover letter
            </label>
          </div>
        </label>

        {form.materialType === 'resume' ? (
          <label className="review-form__field">
            <span>Resume version</span>
            <select
              className="input"
              value={form.versionId}
              onChange={(event) => handleFormChange('versionId', event.target.value)}
              disabled={!versions.length || sharing}
            >
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.version_name || 'Untitled'} {version.is_default ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="review-form__field">
            <span>Cover letter</span>
            <select
              className="input"
              value={form.coverLetterId}
              onChange={(event) => handleFormChange('coverLetterId', event.target.value)}
              disabled={!coverLetters.length || sharing}
            >
              {coverLetters.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.document_name || 'Untitled cover letter'} (v{doc.version_number || doc.version})
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="review-form__field">
          <span>Reviewer contact</span>
          <div className="review-form__radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="reviewerType"
                value="mentor"
                checked={form.reviewerType === 'mentor'}
                onChange={() => handleFormChange('reviewerType', 'mentor')}
                disabled={!mentorOptions.length}
              />
              Use a mentor
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="reviewerType"
                value="manual"
                checked={form.reviewerType === 'manual'}
                onChange={() => handleFormChange('reviewerType', 'manual')}
              />
              Enter email
            </label>
          </div>

          {form.reviewerType === 'mentor' && (
            <select
              className="input"
              value={form.mentorId}
              onChange={(event) => handleFormChange('mentorId', event.target.value)}
              disabled={!mentorOptions.length || sharing}
            >
              {mentorOptions.map((mentor) => (
                <option key={mentor.id} value={mentor.id}>
                  {mentor.name}
                </option>
              ))}
            </select>
          )}

          {form.reviewerType === 'manual' && (
            <input
              className="input"
              type="email"
              placeholder="reviewer@example.com"
              value={form.customEmail}
              onChange={(event) => handleFormChange('customEmail', event.target.value)}
              disabled={sharing}
            />
          )}
        </label>

        <label className="review-form__field">
          <span>Deadline (optional)</span>
          <input
            className="input"
            type="datetime-local"
            value={form.deadline}
            onChange={(event) => handleFormChange('deadline', event.target.value)}
            disabled={sharing}
          />
        </label>

        <label className="review-form__field">
          <span>Message to reviewer</span>
          <textarea
            className="input"
            rows="3"
            placeholder="Share context, highlight what to look at, or remind them about deadlines."
            value={form.message}
            onChange={(event) => handleFormChange('message', event.target.value)}
            disabled={sharing}
          />
        </label>

        {status.error && <p className="form-status form-status--error">{status.error}</p>}
        {status.success && <p className="form-status form-status--success">{status.success}</p>}

        <button type="submit" className="btn-primary" disabled={sharing || !reviewerEmail}>
          {sharing ? (
            <>
              <LoadingSpinner size="sm" className="inline-spinner" /> Sending…
            </>
          ) : (
            'Share for review'
          )}
        </button>
      </form>
    </section>
  );

const renderShareCard = (share) => {
    const deadline = formatDateTime(share.expires_at);
    const badgeText = share.is_accessible ? 'Active' : share.is_expired ? 'Expired' : 'Inactive';
    const resolvedPercentage = resolvedRate(share);

    return (
      <article key={share.id} className="review-share-card">
        <div className="review-share-card__head">
          <div>
            <p className="eyebrow">Version</p>
            <h3>{share.version_name || 'Untitled version'}</h3>
            <p className="muted">
              Shared {formatDateTime(share.created_at) || 'recently'}
            </p>
          </div>
          <span className={`badge ${share.is_accessible ? 'badge--success' : 'badge--muted'}`}>
            {badgeText}
          </span>
        </div>

        {share.share_message && (
          <p className="review-share-card__message">{share.share_message}</p>
        )}

        <div className="review-share-card__meta">
          <div>
            <small>Reviewer emails</small>
            <p>{share.allowed_emails?.length ? share.allowed_emails.join(', ') : 'Open link'}</p>
          </div>
          <div>
            <small>Deadline</small>
            <p>{deadline || 'No deadline'}</p>
          </div>
          <div>
            <small>Access</small>
            <p>
              {share.allow_comments ? 'Comments' : 'Hidden feedback'}
              {share.allow_download && ' · Download allowed'}
            </p>
          </div>
          <div>
            <small>Document</small>
            <p>{share.share_type === 'cover_letter' ? 'Cover letter' : 'Resume'}</p>
          </div>
        </div>

        <div className="review-share-card__metrics">
          <div>
            <span>Pending feedback</span>
            <strong>{share.pending_feedback_count || 0}</strong>
          </div>
          <div>
            <span>Resolved</span>
            <strong>{resolvedPercentage}%</strong>
          </div>
          <div>
            <span>Total reviews</span>
            <strong>{share.feedback_count || 0}</strong>
          </div>
        </div>

        {share.application_total_count > 0 && (
          <div className="review-share-card__app-stats">
            <span>Applications using this version</span>
            <strong>{share.application_total_count}</strong>
            <span>{share.application_response_rate}% response rate</span>
          </div>
        )}

        <div className="review-share-card__actions">
          {share.share_url && (
            <a
              className="review-share-card__link"
              href={share.share_url}
              target="_blank"
              rel="noreferrer"
            >
              Open share link
            </a>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleDeleteShare(share.id)}
            disabled={deletingShareId === share.id}
          >
            {deletingShareId === share.id ? 'Removing…' : 'Remove request'}
          </button>
        </div>
        {shareDeleteStatus[share.id]?.message && (
          <p
            className={`review-share-card__delete-message ${
              shareDeleteStatus[share.id].type === 'error'
                ? 'review-share-card__delete-message--error'
                : 'review-share-card__delete-message--success'
            }`}
          >
            {shareDeleteStatus[share.id].message}
          </p>
        )}

        {share.recent_feedback?.length > 0 && (
          <div className="review-share-card__feedback">
            <div className="eyebrow">Recent feedback</div>
            {share.recent_feedback.map((feedback) => (
              <div key={feedback.id} className="review-share-card__feedback-item">
                <div className="review-share-card__feedback-meta">
                  <strong>{feedback.reviewer_name || 'Anonymous reviewer'}</strong>
                  <span className="review-share-card__feedback-status-chip">
                    {feedback.is_resolved ? 'Resolved' : feedback.status || 'Pending'}
                  </span>
                  <span>{formatDateTime(feedback.created_at)}</span>
                </div>
                <p>{feedback.overall_feedback || 'No additional comments.'}</p>
                <div className="review-share-card__feedback-actions">
                  {!feedback.is_resolved && (
                    <button
                      type="button"
                      className="btn-secondary tiny"
                      onClick={() => handleMarkFeedbackUsed(share.id, feedback.id)}
                      disabled={feedbackActionLoadingId === feedback.id}
                    >
                      {feedbackActionLoadingId === feedback.id ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        'Mark feedback as used'
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {feedbackActionStatus[share.id]?.message && (
              <p
                className={`review-share-card__feedback-status ${
                  feedbackActionStatus[share.id].type === 'error'
                    ? 'review-share-card__feedback-status--error'
                    : 'review-share-card__feedback-status--success'
                }`}
              >
                {feedbackActionStatus[share.id].message}
              </p>
            )}
          </div>
        )}
    </article>
  );
};

  const visibleReviewerShares = reviewerShares.filter(
    (share) => !hiddenReviewerShareIds.includes(share.id)
  );
  const hiddenReviewerShares = reviewerShares.filter((share) =>
    hiddenReviewerShareIds.includes(share.id)
  );

  const reviewerApplications = useMemo(() => {
    const total = reviewerShares.reduce(
      (acc, share) => acc + (share.application_total_count || 0),
      0
    );
    const responded = reviewerShares.reduce(
      (acc, share) => acc + (share.application_response_count || 0),
      0
    );
    return {
      total,
      responded,
      rate: total ? Math.round((responded / total) * 100) : 0
    };
  }, [reviewerShares]);

  const handleCopyShareLink = async (shareUrl, id) => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareId(id);
      setTimeout(() => setCopiedShareId(null), 2000);
    } catch {
      setCopiedShareId(null);
    }
  };

  const renderReviewerShare = (share) => (
    <article key={share.id} className="reviewer-share-card">
      <div className="review-share-card__head">
        <div>
          <p className="eyebrow">Shared by {share.owner_email || 'mentor'}</p>
          <h3>{share.version_name || 'Resume'}</h3>
          <p className="muted">
            {share.share_type === 'cover_letter' ? 'Cover letter' : 'Resume'} ·{' '}
            {share.allow_edit ? 'Editor access' : 'Comment access'} · Shared on{' '}
            {new Date(share.created_at).toLocaleString()}
          </p>
        </div>
        <span className={`badge ${share.is_accessible ? 'badge--success' : 'badge--muted'}`}>
          {share.is_accessible ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="review-share-card__meta">
        <div>
          <small>Pending</small>
          <p>{share.pending_feedback_count || 0}</p>
        </div>
        <div>
          <small>Resolved</small>
          <p>{resolvedRate(share)}%</p>
        </div>
        <div>
          <small>Total reviews</small>
          <p>{share.feedback_count || 0}</p>
        </div>
        <div>
          <small>Applications</small>
          <p>
            {share.application_total_count
              ? `${share.application_total_count} • ${share.application_response_rate}% responded`
              : 'None'}
          </p>
        </div>
      </div>

      <div className="reviewer-share-card__actions">
        {share.share_url && (
          <>
            <a
              className="review-share-card__link"
              href={share.share_url}
              target="_blank"
              rel="noreferrer"
            >
              Open share link
            </a>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleCopyShareLink(share.share_url, share.id)}
            >
              {copiedShareId === share.id ? 'Link copied' : 'Copy share link'}
            </button>
          </>
        )}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => handlePreviewShare(share)}
        >
          Preview PDF
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => handleMarkShareDone(share.id)}
        >
          Mark as done
        </button>
      </div>
    </article>
  );

  return (
    <div className="resume-review-tools">
      {loading ? (
        <div className="resume-review-tools__loading">
          <LoadingSpinner size={48} />
        </div>
      ) : (
        <>
          <header className="resume-review-tools__header">
            <div>
                <p className="eyebrow">Tools / Document Review</p>
              <h1>Collaborative reviews</h1>
              <p className="muted">
                Track the mentors who shaped your drafts, surface deadlines, and see how feedback
                gets resolved before you submit.
              </p>
            </div>
          </header>

          <div className="resume-review-tools__grid">
            {renderForm()}

            <section className="review-shares-card">
              <header>
                <p className="eyebrow">Existing review shares</p>
                <h2>Impact and status</h2>
                <p className="muted">
                  Each share shows the reviewer list, pending feedback, and resolved rate so you can
                  measure the response impact before reusing a version on new applications.
                </p>
              </header>

              {!shares.length && (
                <p className="review-shares-card__empty">
                  No review sessions yet—create a share to invite mentors or peers.
                </p>
              )}

              <div className="review-shares-card__list">
                {shares.map(renderShareCard)}
              </div>
            </section>

            <section className="reviewer-shares-card">
            <header>
              <p className="eyebrow">Shared with me</p>
              <h2>Review requests</h2>
              <p className="muted">
                When someone sends you a resume, the share link and metadata show up here.
              </p>
            </header>

            <div className="reviewer-stats-panel">
              <div className="reviewer-stats-panel__tile">
                <span>Reviews given</span>
                <strong>{reviewerStats.reviews_given}</strong>
              </div>
              <div className="reviewer-stats-panel__tile">
                <span>Implemented</span>
                <strong>{reviewerStats.reviews_implemented}</strong>
              </div>
              <div className="reviewer-stats-panel__tile">
                <span>Response rate</span>
                <strong>{reviewerApplications.rate}%</strong>
                <p className="muted small">
                  {reviewerApplications.total} applications tracked
                </p>
              </div>
            </div>

            {hiddenReviewerShares.length > 0 && (
              <div className="reviewer-shares-card__hidden-state">
                <p>
                  {hiddenReviewerShares.length}{' '}
                  {hiddenReviewerShares.length > 1 ? 'completed reviews' : 'completed review'} hidden.
                  <button
                    type="button"
                    className="reviewer-shares-card__hidden-toggle"
                    onClick={() => setShowHiddenReviewerShares((prev) => !prev)}
                  >
                    {showHiddenReviewerShares ? 'Hide' : 'Show hidden'}
                  </button>
                </p>
                {showHiddenReviewerShares && (
                  <div className="reviewer-shares-card__hidden-list">
                    {hiddenReviewerShares.map((share) => (
                      <button
                        key={share.id}
                        type="button"
                        className="btn-secondary tiny"
                        onClick={() => handleRestoreHiddenShare(share.id)}
                      >
                        Show {share.version_name || 'resume'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {reviewerLoading && (
            <div className="reviewer-shares-card__loading">
              <LoadingSpinner />
            </div>
          )}

              {reviewerError && (
                <p className="reviewer-shares-card__empty">{reviewerError}</p>
              )}

            {!reviewerLoading && !reviewerShares.length && !reviewerError && (
              <p className="reviewer-shares-card__empty">
                No review requests yet—ask for a share and it will appear here.
              </p>
            )}

            {!reviewerLoading &&
              !visibleReviewerShares.length &&
              hiddenReviewerShares.length &&
              !reviewerError && (
                <p className="reviewer-shares-card__empty">
                  All visible requests are hidden. Toggle the hidden board to restore them.
                </p>
              )}

            <div className="reviewer-shares-card__content">
                <div className="reviewer-shares-card__list">
                  {visibleReviewerShares.map(renderReviewerShare)}
                </div>
                {previewShare && (
                  <div className="reviewer-shares-card__preview">
                    <div className="preview-header">
                      <p className="eyebrow">PDF preview</p>
                      <button
                        className="btn-secondary tiny"
                        type="button"
                        onClick={() => {
                          setPreviewShare(null);
                          setPreviewError('');
                          if (previewBlobUrl) {
                            URL.revokeObjectURL(previewBlobUrl);
                            setPreviewBlobUrl('');
                          }
                        }}
                      >
                        Close
                      </button>
                    </div>
                    <p className="muted preview-share-type">
                      Document:{' '}
                      {previewShare?.share?.share_type === 'cover_letter' ? 'Cover letter' : 'Resume'}
                    </p>
                    {previewLoading ? (
                      <div className="preview-loading">
                        <LoadingSpinner size="sm" /> Loading preview…
                      </div>
                    ) : previewError ? (
                      <p className="inline-error">{previewError}</p>
                    ) : previewShare?.pdfUrl ? (
                      <iframe
                        src={previewShare.pdfUrl}
                        title="Shared Resume PDF"
                        className="reviewer-share-preview"
                      />
                    ) : (
                      <p className="muted">PDF unavailable for this share.</p>
                    )}
                    <div className="preview-feedback">
                      <h4>Leave feedback</h4>
                      <textarea
                        rows={3}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Share a quick note for the owner"
                        disabled={commentLoading}
                      />
                      <div className="preview-feedback__actions">
                        <button
                          type="button"
                          className="btn-secondary tiny"
                          onClick={() => {
                            setCommentText('');
                            setCommentError('');
                            setCommentSuccess('');
                          }}
                          disabled={commentLoading}
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          className="btn-primary tiny"
                          onClick={async () => {
                            if (!commentText.trim()) {
                              setCommentError('Feedback cannot be empty.');
                              setCommentSuccess('');
                              return;
                            }
                            if (!previewShare?.share?.share_token) return;
                            setCommentLoading(true);
                            setCommentError('');
                            setCommentSuccess('');
                            try {
                              await feedbackAPI.createFeedback({
                                share_token: previewShare.share.share_token,
                                reviewer_name:
                                  currentUser?.displayName ||
                                  currentUser?.email?.split('@')[0] ||
                                  'Reviewer',
                                reviewer_email: currentUser?.email || 'reviewer@share.local',
                                overall_feedback: commentText.trim()
                              });
                              setCommentSuccess('Feedback submitted!');
                              setCommentText('');
                              const userName =
                                userProfile?.name ||
                                currentUser?.displayName ||
                                currentUser?.email?.split('@')[0] ||
                                'Reviewer';
                              const updatedShare = await resumeSharingAPI.viewSharedResume(
                                previewShare.share.share_token,
                                {
                                  reviewer_name: userName,
                                  reviewer_email: currentUser?.email || ''
                                }
                              );
                              setPreviewShare((prev) => ({
                                ...prev,
                                share: updatedShare.share
                              }));
                            } catch (err) {
                              setCommentError(err?.message || 'Unable to submit feedback.');
                            } finally {
                              setCommentLoading(false);
                            }
                          }}
                          disabled={commentLoading}
                        >
                          {commentLoading ? (
                            <>
                              <LoadingSpinner size="sm" /> Sending…
                            </>
                          ) : (
                            'Submit feedback'
                          )}
                        </button>
                      </div>
                      {commentError && <p className="inline-error">{commentError}</p>}
                      {commentSuccess && <p className="success-message">{commentSuccess}</p>}
                    </div>
                    {previewShare?.share?.recent_feedback?.length > 0 && (
                      <div className="preview-feedback-list">
                        <h4>Recent feedback</h4>
                        <ul>
                          {previewShare.share.recent_feedback.map((fb) => (
                            <li key={fb.id}>
                              <div className="preview-feedback-item-head">
                                <strong>{fb.reviewer_name || 'Reviewer'}</strong>
                                <span className="preview-feedback-status">
                                  {fb.is_resolved ? 'Resolved' : fb.status || 'Pending'}
                                </span>
                              </div>
                              <p>{fb.overall_feedback}</p>
                              {!fb.is_resolved && (
                                <button
                                  type="button"
                                  className="btn-secondary tiny"
                                  onClick={() => handleReviewerMarkFeedbackUsed(fb.id)}
                                  disabled={reviewFeedbackActionLoadingId === fb.id}
                                >
                                  {reviewFeedbackActionLoadingId === fb.id ? (
                                    <LoadingSpinner size="sm" />
                                  ) : (
                                    'Mark as used'
                                  )}
                                </button>
                              )}
                              {reviewFeedbackActionStatus[fb.id]?.message && (
                                <p
                                  className={`preview-feedback-status-message ${
                                    reviewFeedbackActionStatus[fb.id].type === 'error'
                                      ? 'preview-feedback-status-message--error'
                                      : 'preview-feedback-status-message--success'
                                  }`}
                                >
                                  {reviewFeedbackActionStatus[fb.id].message}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default ResumeReviewTools;
