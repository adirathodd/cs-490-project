/**
 * UC-052: Shared Resume Viewer
 * Public page for viewing shared resumes with access control
 */
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resumeSharingAPI, feedbackAPI, commentAPI } from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { auth } from '../../services/firebase';
import Icon from '../common/Icon';
import LaTeXRenderer from './LaTeXRenderer';
import './SharedResumeView.css';

const SharedResumeView = () => {
  const { shareToken } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile, loading: authLoading, signOut } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareData, setShareData] = useState(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  
  // Form states
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Name/Email collection states
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerEmail, setReviewerEmail] = useState('');
  
  // Feedback states
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [reviewerTitle, setReviewerTitle] = useState('');
  const [existingFeedback, setExistingFeedback] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  useEffect(() => {
    // Wait for auth to load before attempting to load the resume
    if (!authLoading) {
      // Always require login first - if not logged in, redirect to login
      if (!currentUser) {
        console.log('No user logged in - redirecting to login');
        setRequiresLogin(true);
        setLoading(false);
        return;
      }
      
      // User is logged in, now try to load the resume
      loadSharedResume();
    }
  }, [shareToken, currentUser, authLoading]); // Reload when user changes (after login)

  const loadSharedResume = async (accessData = {}) => {
    setLoading(true);
    setError('');
    setAccessDenied(false);
    
    // User must be authenticated at this point (checked in useEffect)
    // Include user's info automatically
    const userName = userProfile?.name || 
                    currentUser.displayName || 
                    currentUser.email?.split('@')[0] || 
                    'User';
    
    accessData.reviewer_name = userName;
    accessData.reviewer_email = currentUser.email;
    
    try {
      const data = await resumeSharingAPI.viewSharedResume(shareToken, accessData);
      setShareData(data);
      setRequiresPassword(false);
      setAccessDenied(false);
      setLoading(false);
      
      // Load existing feedback if comments are allowed
      if (data.share?.allow_comments) {
        loadFeedback(data.share.id);
      }
    } catch (err) {
      console.error('Error loading shared resume:', err);
      console.log('Error status:', err.status);
      console.log('Error message:', err.message);
      console.log('Error flags:', {
        requires_password: err.requires_password,
        requires_email: err.requires_email,
        requires_reviewer_info: err.requires_reviewer_info
      });
      console.log('Access data sent:', accessData);
      console.log('Current user email:', currentUser?.email);
      
      setLoading(false);
      
      // Check if password is required (this blocks viewing)
      if (err.status === 401 && err.requires_password) {
        console.log('Password required');
        setRequiresPassword(true);
        setError('');
        return;
      }
      
      // Check if access is denied (wrong email/domain) - user is logged in but not authorized
      if (err.status === 403 || (err.status === 401 && err.requires_email)) {
        console.log('Access denied - user email not authorized');
        setAccessDenied(true);
        setError(err.message || 'Your email is not authorized to access this resume');
        return;
      }
      
      // Fallback for password
      if (err.requires_password) {
        console.log('Password required (fallback)');
        setRequiresPassword(true);
        setError('');
        return;
      }
      
      // Any other 401/403 is treated as access denied since user is logged in
      if (err.status === 401 || err.status === 403) {
        console.log('Access denied - unauthorized');
        setAccessDenied(true);
        setError(err.message || 'You are not authorized to access this resume');
        return;
      }
      
      // Show actual error with more details for other errors
      console.log('Showing generic error to user');
      console.log('Full error object:', err);
      const errorMsg = err.message || err.error || 'Failed to load shared resume';
      setError(errorMsg);
    }
  };

  const loadFeedback = async (shareId) => {
    if (!shareId) return;
    
    setLoadingFeedback(true);
    try {
      // Note: We would need a new API endpoint to get feedback by share_id
      // For now, this is a placeholder. The backend should add:
      // GET /feedback/?share_id=<shareId>
      const response = await feedbackAPI.listFeedback({ share_id: shareId });
      setExistingFeedback(response.feedback || []);
    } catch (err) {
      console.error('Error loading feedback:', err);
      // Non-critical error, just log it
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleAccessSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const accessData = {};
    
    // Handle password requirement
    if (requiresPassword && password) {
      accessData.password = password;
    }
    
    console.log('Submitting access form with data:', accessData);

    try {
      await loadSharedResume(accessData);
    } catch (err) {
      // Error is already handled in loadSharedResume
      console.error('Access submit error:', err);
      // Set error on form if it failed
      if (err.message) {
        setError(err.message);
      }
    }
    setIsSubmitting(false);
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    if (!feedbackText.trim()) {
      setError('Please enter your feedback');
      setIsSubmitting(false);
      return;
    }

    try {
      // Determine reviewer info based on context
      let userName, userEmail;
      
      // Check if the share requires reviewer info
      const requiresInfo = shareData?.share?.require_reviewer_info;
      
      if (currentUser) {
        // User is authenticated - use their info
        userName = userProfile?.name || 
                  currentUser.displayName || 
                  currentUser.email?.split('@')[0] || 
                  'User';
        userEmail = currentUser.email;
      } else if (reviewerName && reviewerEmail) {
        // User provided name/email
        userName = reviewerName;
        userEmail = reviewerEmail;
      } else if (requiresInfo) {
        // Share requires info but user hasn't provided it
        setError('Please provide your name and email to leave feedback');
        setIsSubmitting(false);
        return;
      } else {
        // Anonymous feedback allowed
        userName = reviewerName.trim() || 'Anonymous';
        userEmail = reviewerEmail || 'anonymous@feedback.local';
      }

      const feedbackData = {
        share_token: shareToken,
        reviewer_name: userName,
        reviewer_email: userEmail,
        reviewer_title: reviewerTitle,
        overall_feedback: feedbackText,
        rating: feedbackRating > 0 ? feedbackRating : null,
      };

      if (requiresPassword && password) {
        feedbackData.password = password;
      }

      await feedbackAPI.createFeedback(feedbackData);
      
      // Clear form and reload feedback
      setFeedbackText('');
      setFeedbackRating(0);
      setReviewerTitle('');
      setShowFeedbackForm(false);
      
      // Reload feedback list
      if (shareData?.share?.id) {
        await loadFeedback(shareData.share.id);
      }
      
      // Show success message
      alert('Thank you! Your feedback has been submitted successfully.');
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="shared-resume-container">
        <div className="loading-state">
          <Icon name="loader" size="lg" />
          <p>Loading shared resume...</p>
        </div>
      </div>
    );
  }

  // Show login requirement screen
  if (requiresLogin) {
    return (
      <div className="shared-resume-container">
        <div className="access-form-container">
          <div className="access-form-card">
            <div className="access-form-header">
              <Icon name="lock" size="lg" />
              <h2>Login Required</h2>
              <p>This resume requires you to be logged in with an authorized email address.</p>
            </div>

            <div className="info-banner">
              <Icon name="info" size="sm" />
              <p>
                Please log in to verify your email address and access this shared resume.
              </p>
            </div>

            <button
              onClick={() => {
                localStorage.setItem('returnUrl', `/shared-resume/${shareToken}`);
                navigate('/login');
              }}
              className="btn-primary"
              style={{ marginTop: '1rem' }}
            >
              <Icon name="log-in" size="sm" /> Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied screen
  if (accessDenied) {
    return (
      <div className="shared-resume-container">
        <div className="error-state">
          <Icon name="x-circle" size="lg" />
          <h2>Access Denied</h2>
          <p>{error}</p>
          {currentUser && (
            <div className="info-banner" style={{ marginTop: '1rem' }}>
              <Icon name="info" size="sm" />
              <p>
                You are logged in as <strong>{currentUser.email}</strong>.
                {' '}This email address is not authorized to view this resume.
              </p>
            </div>
          )}
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={async () => {
                // Sign out and then redirect to login
                await signOut();
                localStorage.setItem('returnUrl', `/shared-resume/${shareToken}`);
                navigate('/login');
              }}
              className="btn-secondary"
            >
              <Icon name="log-in" size="sm" /> Login with Different Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error && !requiresPassword && !requiresLogin && !accessDenied) {
    return (
      <div className="shared-resume-container">
        <div className="error-state">
          <Icon name="alert-circle" size="lg" />
          <h2>Unable to Load Resume</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="shared-resume-container">
        <div className="access-form-container">
          <div className="access-form-card">
            <div className="access-form-header">
              <Icon name="lock" size="lg" />
              <h2>Access Required</h2>
              <p>Please provide the required information to view this resume.</p>
            </div>

            <form onSubmit={handleAccessSubmit} className="access-form">
              <div className="form-group">
                <label htmlFor="password">
                  Password <span className="required">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {error && (
                <div className="error-message">
                  <Icon name="alert-circle" size="sm" /> {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Icon name="loader" size="sm" /> Accessing...
                  </>
                ) : (
                  <>
                    <Icon name="unlock" size="sm" /> View Resume
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (!shareData) {
    return null;
  }

  const { share, resume } = shareData;

  return (
    <div className="shared-resume-container">
      <div className="shared-resume-content">
        <div className="resume-header">
          <h1>{share.version_name}</h1>
          {share.share_message && (
            <div className="share-message">
              <Icon name="info" size="sm" />
              <p>{share.share_message}</p>
            </div>
          )}
        </div>

        <div className="resume-body">
          <div className="resume-section">
            <h3>Resume Information</h3>
            <p><strong>Version:</strong> {resume.version_name}</p>
            {resume.description && <p><strong>Description:</strong> {resume.description}</p>}
            <p><strong>Created:</strong> {new Date(resume.created_at).toLocaleDateString()}</p>
            {resume.last_modified_at && (
              <p><strong>Last Modified:</strong> {new Date(resume.last_modified_at).toLocaleDateString()}</p>
            )}
          </div>

          {/* Display PDF if available */}
          {resume.pdf_url && (
            <div className="resume-section">
              <h3>Resume Preview</h3>
              <div className="pdf-preview">
                <iframe
                  src={resume.pdf_url}
                  title="Resume Preview"
                  style={{
                    width: '100%',
                    height: '600px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px'
                  }}
                />
              </div>
            </div>
          )}

          {/* Only show LaTeX if no PDF is available */}
          {!resume.pdf_url && resume.latex_content && (
            <div className="resume-section">
              <h3>Resume Content</h3>
              <LaTeXRenderer latexContent={resume.latex_content} />
            </div>
          )}

          {/* Download and feedback actions */}
          <div className="resume-actions-container">
            {resume.pdf_url && share.allow_download && (
              <div className="resume-actions">
                <a
                  href={resume.pdf_url}
                  download
                  className="btn-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="download" size="sm" /> Download PDF
                </a>
              </div>
            )}

            {share.allow_comments && (
              <div className="feedback-section">
                {!showFeedbackForm ? (
                  <div className="feedback-info">
                    <Icon name="message-square" size="md" />
                    <div style={{ flex: 1 }}>
                      <p>Feedback is enabled for this resume. Share your thoughts with the owner!</p>
                      <button 
                        className="btn-secondary"
                        onClick={() => setShowFeedbackForm(true)}
                        style={{ marginTop: '12px' }}
                      >
                        <Icon name="edit" size="sm" /> Leave Feedback
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="feedback-form-container">
                    <h3>Leave Your Feedback</h3>
                    
                    {/* Show name/email form if required and not provided */}
                    {shareData?.share?.require_reviewer_info && !reviewerName && !reviewerEmail && !currentUser && (
                      <div className="reviewer-info-section" style={{ 
                        backgroundColor: '#f9fafb', 
                        padding: '1rem', 
                        borderRadius: '0.5rem',
                        marginBottom: '1rem',
                        border: '1px solid #e5e7eb'
                      }}>
                        <p style={{ marginBottom: '0.75rem', color: '#6b7280' }}>
                          This resume owner requires your name and email to leave feedback:
                        </p>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                          <input
                            type="text"
                            placeholder="Your Name *"
                            value={reviewerName}
                            onChange={(e) => setReviewerName(e.target.value)}
                            className="input"
                            required
                          />
                          <input
                            type="email"
                            placeholder="Your Email *"
                            value={reviewerEmail}
                            onChange={(e) => setReviewerEmail(e.target.value)}
                            className="input"
                            required
                          />
                        </div>
                      </div>
                    )}

                    {/* Optional name/email for anonymous feedback */}
                    {!shareData?.share?.require_reviewer_info && !currentUser && (
                      <div className="reviewer-info-section" style={{ 
                        backgroundColor: '#f9fafb', 
                        padding: '1rem', 
                        borderRadius: '0.5rem',
                        marginBottom: '1rem',
                        border: '1px solid #e5e7eb'
                      }}>
                        <p style={{ marginBottom: '0.75rem', color: '#6b7280' }}>
                          Optionally provide your name and email (leave blank for anonymous feedback):
                        </p>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                          <input
                            type="text"
                            placeholder="Your Name (optional)"
                            value={reviewerName}
                            onChange={(e) => setReviewerName(e.target.value)}
                            className="input"
                          />
                          <input
                            type="email"
                            placeholder="Your Email (optional)"
                            value={reviewerEmail}
                            onChange={(e) => setReviewerEmail(e.target.value)}
                            className="input"
                          />
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleFeedbackSubmit} className="feedback-form">
                      <div className="form-group">
                        <label htmlFor="reviewerTitle">Your Title (Optional)</label>
                        <input
                          id="reviewerTitle"
                          type="text"
                          value={reviewerTitle}
                          onChange={(e) => setReviewerTitle(e.target.value)}
                          placeholder="e.g., Senior Recruiter at TechCorp"
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="feedbackRating">Rating (Optional)</label>
                        <div className="rating-input">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              className={`star-button ${feedbackRating >= star ? 'active' : ''}`}
                              onClick={() => setFeedbackRating(star)}
                              disabled={isSubmitting}
                            >
                              <Icon name="star" size="md" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="feedbackText">
                          Your Feedback <span className="required">*</span>
                        </label>
                        <textarea
                          id="feedbackText"
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder="Share your thoughts, suggestions, or comments about this resume..."
                          rows="6"
                          disabled={isSubmitting}
                          required
                        />
                      </div>

                      {error && (
                        <div className="error-message">
                          <Icon name="alert-circle" size="sm" /> {error}
                        </div>
                      )}

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <>
                              <Icon name="loader" size="sm" /> Submitting...
                            </>
                          ) : (
                            <>
                              <Icon name="send" size="sm" /> Submit Feedback
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setShowFeedbackForm(false);
                            setFeedbackText('');
                            setFeedbackRating(0);
                            setReviewerTitle('');
                            setError('');
                          }}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Display existing feedback */}
                {existingFeedback.length > 0 && (
                  <div className="existing-feedback">
                    <h3>Feedback from Reviewers</h3>
                    {loadingFeedback ? (
                      <div className="loading-feedback">
                        <Icon name="loader" size="sm" /> Loading feedback...
                      </div>
                    ) : (
                      <div className="feedback-list">
                        {existingFeedback.map((feedback) => (
                          <div key={feedback.id} className="feedback-item">
                            <div className="feedback-header">
                              <div className="reviewer-info">
                                <Icon name="user" size="sm" />
                                <div>
                                  <strong>{feedback.reviewer_name || 'Anonymous'}</strong>
                                  {feedback.reviewer_title && (
                                    <span className="reviewer-title"> • {feedback.reviewer_title}</span>
                                  )}
                                </div>
                              </div>
                              <div className="feedback-meta">
                                {feedback.rating && (
                                  <div className="rating-display">
                                    {[...Array(feedback.rating)].map((_, i) => (
                                      <Icon key={i} name="star" size="sm" className="star-filled" />
                                    ))}
                                  </div>
                                )}
                                <span className="feedback-date">
                                  {new Date(feedback.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="feedback-body">
                              <p>{feedback.overall_feedback}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="resume-footer">
          <p className="powered-by">
            Powered by ATS Candidate System
          </p>
        </div>
      </div>
    </div>
  );
};

export default SharedResumeView;
