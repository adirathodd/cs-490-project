import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { reauthenticateWithCredential, EmailAuthProvider } from '../services/firebase';
import { authAPI } from '../services/api';
import ProfilePictureUpload from './ProfilePictureUpload';
import './ProfileForm.css';
import Icon from './Icon';

const EXPERIENCE_LEVELS = [
  { value: '', label: 'Select Experience Level' },
  { value: 'entry', label: 'Entry Level' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'senior', label: 'Senior Level' },
  { value: 'executive', label: 'Executive' },
];

const COMMON_INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Retail',
  'Manufacturing',
  'Consulting',
  'Marketing',
  'Real Estate',
  'Legal',
  'Other',
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const ProfileForm = () => {
  const { currentUser, loading: authLoading, signOut, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [originalData, setOriginalData] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    city: '',
    state: '',
    headline: '',
    summary: '',
    industry: '',
    experience_level: '',
  });

  const [characterCount, setCharacterCount] = useState(0);
  const MAX_SUMMARY_LENGTH = 500;
  const MAX_HEADLINE_LENGTH = 160;

  useEffect(() => {
    if (currentUser && !isInitialized) {
      setIsInitialized(true);
      fetchProfile();
    }
  }, [currentUser, isInitialized]);

  const fetchProfile = async () => {
    if (!currentUser) {
      return;
    }
    
    try {
      setFetchingProfile(true);
      const response = await authAPI.getBasicProfile();
      
      const profileData = {
        first_name: response.first_name || '',
        last_name: response.last_name || '',
        phone: response.phone || '',
        city: response.city || '',
        state: response.state || '',
        headline: response.headline || '',
        summary: response.summary || '',
        industry: response.industry || '',
        experience_level: response.experience_level || '',
      };
      
      // Pre-fill form with existing data
      setFormData(profileData);
      setOriginalData(profileData); // Store original data for comparison
      setHasUnsavedChanges(false);
      
      setCharacterCount(response.summary ? response.summary.length : 0);
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (error.response?.status === 401) {
        setApiError('Please log in to view your profile.');
      } else if (error.response?.data?.error?.message) {
        setApiError(error.response.data.error.message);
      } else {
        // Profile doesn't exist yet, that's okay
        setApiError('');
      }
    } finally {
      setFetchingProfile(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Clear field-specific error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    // Handle summary character count
    if (name === 'summary') {
      if (value.length <= MAX_SUMMARY_LENGTH) {
        setFormData(prev => {
          const updated = { ...prev, [name]: value };
          checkForChanges(updated);
          return updated;
        });
        setCharacterCount(value.length);
      }
      return;
    }
    
    // Handle headline length
    if (name === 'headline') {
      if (value.length <= MAX_HEADLINE_LENGTH) {
        setFormData(prev => {
          const updated = { ...prev, [name]: value };
          checkForChanges(updated);
          return updated;
        });
      }
      return;
    }
    
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      checkForChanges(updated);
      return updated;
    });
    setApiError('');
    setSuccessMessage('');
  };

  const checkForChanges = (currentData) => {
    // Compare current data with original data
    const hasChanges = Object.keys(currentData).some(
      key => currentData[key] !== originalData[key]
    );
    setHasUnsavedChanges(hasChanges);
  };

  const validateForm = () => {
    const errors = {};

    // Validate required fields
    if (!formData.first_name.trim()) {
      errors.first_name = 'First name is required';
    }

    if (!formData.last_name.trim()) {
      errors.last_name = 'Last name is required';
    }

    // Validate phone format if provided
    if (formData.phone) {
      const phoneRegex = /^[\d\s\-\(\)\+\.]+$/;
      if (!phoneRegex.test(formData.phone)) {
        errors.phone = 'Please enter a valid phone number';
      }
    }

    // Validate summary length
    if (formData.summary && formData.summary.length > MAX_SUMMARY_LENGTH) {
      errors.summary = `Summary must not exceed ${MAX_SUMMARY_LENGTH} characters`;
    }

    // Validate headline length
    if (formData.headline && formData.headline.length > MAX_HEADLINE_LENGTH) {
      errors.headline = `Headline must not exceed ${MAX_HEADLINE_LENGTH} characters`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    setSuccessMessage('');

    if (!validateForm()) {
      setApiError('Please fix the errors in the form before submitting.');
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.updateBasicProfile(formData);
      setSuccessMessage(response.message || 'Profile updated successfully!');
      
      // Update original data after successful save
      setOriginalData(formData);
      setHasUnsavedChanges(false);

      // Refresh the user profile in AuthContext to update the banner and other views
      if (refreshUserProfile) {
        await refreshUserProfile();
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
      
      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Profile update error:', error);
      
      // Handle validation errors from backend
      if (error.response?.data?.error?.details) {
        const backendErrors = error.response.data.error.details;
        const formattedErrors = {};
        
        Object.keys(backendErrors).forEach(key => {
          // Handle nested user fields (first_name, last_name from user.first_name)
          const fieldName = key.includes('.') ? key.split('.')[1] : key;
          formattedErrors[fieldName] = Array.isArray(backendErrors[key])
            ? backendErrors[key][0]
            : backendErrors[key];
        });
        
        setFieldErrors(formattedErrors);
        setApiError('Please fix the errors highlighted below.');
      } else if (error.response?.data?.error?.message) {
        setApiError(error.response.data.error.message);
      } else if (error.response?.status === 401) {
        setApiError('Your session has expired. Please log in again.');
      } else if (error.response?.status === 500) {
        setApiError('Server error. Please try again later.');
      } else {
        setApiError('Failed to update profile. Please try again.');
      }
      
      // Scroll to top to show error message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };


  const handleCancel = () => {
    // Check if there are unsaved changes
    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
    } else {
      navigate('/dashboard');
    }
  };

  const handleBackClick = () => {
    // Check if there are unsaved changes
    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
    } else {
      navigate('/dashboard');
    }
  };

  const openDeleteDialog = () => {
    setDeleteError('');
    setDeletePassword('');
    setShowDeleteDialog(true);
  };

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false);
    setDeleteError('');
    setDeletePassword('');
  };

  const handleDeleteConfirm = async () => {
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError('Please enter your password to confirm deletion.');
      return;
    }

    if (!currentUser) {
      setDeleteError('No authenticated user found.');
      return;
    }

    setDeleting(true);
    try {
      // Force password-based reauthentication only (no popup flows)
      if (!deletePassword) {
        setDeleteError('Please enter your password to confirm deletion.');
        setDeleting(false);
        return;
      }
      const credential = EmailAuthProvider.credential(currentUser.email, deletePassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Refresh token and store it so backend receives a fresh token
      const token = await currentUser.getIdToken(true);
      localStorage.setItem('firebaseToken', token);

      // Initiate deletion request (email confirmation flow)
      const resp = await authAPI.requestAccountDeletion();
      if (resp && resp.confirm_url) {
        // Helpful during development when emails are printed to console backend
        // Copy/paste this URL in the browser to complete deletion
        // eslint-disable-next-line no-console
        console.log('Account deletion confirm URL (dev):', resp.confirm_url);
      }

      setSuccessMessage("We've sent a confirmation link to your email. Please check your inbox to permanently delete your account.");
      closeDeleteDialog();
    } catch (error) {
      console.error('Account deletion error:', error);
      // Handle common Firebase and API errors with clearer messages
      if (error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential' || error?.response?.status === 401) {
        setDeleteError('Incorrect password. Please try again.');
      } else if (error?.code === 'auth/requires-recent-login') {
        setDeleteError('Please log out and log back in, then try again.');
      } else if (error?.message === 'Network Error' || error?.code === 'ERR_NETWORK') {
        setDeleteError('Network error. Please check your connection and try again.');
      } else if (error?.response?.data?.error?.message) {
        setDeleteError(error.response.data.error.message);
      } else {
        setDeleteError('Failed to initiate deletion. Please try again later.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const confirmDiscard = () => {
    setShowDiscardDialog(false);
    setHasUnsavedChanges(false);
    navigate('/dashboard');
  };

  const cancelDiscard = () => {
    setShowDiscardDialog(false);
  };

  if (authLoading || fetchingProfile || !currentUser) {
    return (
      <div className="profile-form-container">
        <div className="loading-skeleton">
          <div className="skeleton-card">
            {/* Header skeleton */}
            <div className="skeleton skeleton-title" style={{ width: '280px' }} />
            <div className="skeleton skeleton-subtitle" style={{ width: '60%', marginBottom: 24 }} />

            {/* Personal Information section */}
            <div style={{ marginBottom: 24 }}>
              <div className="skeleton skeleton-line" style={{ width: '180px', height: 22, marginBottom: 16 }} />
              <div className="skeleton-row">
                <div className="skeleton skeleton-field" />
                <div className="skeleton skeleton-field" />
              </div>
              <div className="skeleton skeleton-field" style={{ marginTop: 16 }} />
              <div className="skeleton-row" style={{ marginTop: 16 }}>
                <div className="skeleton skeleton-field" />
                <div className="skeleton skeleton-field" />
              </div>
            </div>

            {/* Professional Information section */}
            <div>
              <div className="skeleton skeleton-line" style={{ width: '220px', height: 22, marginBottom: 16 }} />
              <div className="skeleton skeleton-field" style={{ marginBottom: 16 }} />
              <div className="skeleton skeleton-textarea" />
              <div className="skeleton-row" style={{ marginTop: 16 }}>
                <div className="skeleton skeleton-field" />
                <div className="skeleton skeleton-field" />
              </div>
            </div>

            {/* Actions */}
            <div className="skeleton-actions">
              <div className="skeleton skeleton-button" style={{ width: 120 }} />
              <div className="skeleton skeleton-button" style={{ width: 150 }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-form-container">
      <div className="profile-form-card">
        <div className="page-backbar">
          <button
            className="btn-back"
            onClick={handleBackClick}
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            ← Back to Dashboard
          </button>
        </div>

        <div className="profile-header">
          <div>
            <h2>Basic Profile Information</h2>
            <p className="form-subtitle">Complete your professional profile to get started</p>
          </div>
        </div>

        {/* Discard Changes Confirmation Dialog */}
        {showDiscardDialog && (
          <div className="modal-overlay">
            <div className="modal-dialog">
              <h3>Discard Changes?</h3>
              <p>You have unsaved changes. Are you sure you want to leave? All changes will be lost.</p>
              <div className="modal-actions">
                <button 
                  className="modal-cancel-button" 
                  onClick={cancelDiscard}
                >
                  Keep Editing
                </button>
                <button 
                  className="modal-confirm-button" 
                  onClick={confirmDiscard}
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Message Banner */}
        {successMessage && (
          <div className="success-banner">
            <Icon name="cert" size="sm" ariaLabel="Success" />
            {successMessage}
          </div>
        )}

        {/* Error Message Banner */}
        {apiError && (
          <div className="error-banner">
            <Icon name="trash" size="sm" ariaLabel="Error" />
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="profile-form">
          {/* Profile Picture Section (UC-022) */}
          <div className="form-section">
            <h3>
              <Icon name="camera" size="lg" />
              Profile Picture
            </h3>
            <ProfilePictureUpload />
          </div>

          {/* Personal Information Section */}
          <div className="form-section">
            <h3>
              <Icon name="user" size="lg" />
              Personal Information
            </h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first_name">
                  First Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className={fieldErrors.first_name ? 'error' : ''}
                  disabled={loading}
                  placeholder="John"
                />
                {fieldErrors.first_name && (
                  <span className="error-message">{fieldErrors.first_name}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="last_name">
                  Last Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className={fieldErrors.last_name ? 'error' : ''}
                  disabled={loading}
                  placeholder="Doe"
                />
                {fieldErrors.last_name && (
                  <span className="error-message">{fieldErrors.last_name}</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={currentUser?.email || ''}
                disabled
                className="readonly-field"
              />
              <small className="field-help">Email cannot be changed</small>
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={fieldErrors.phone ? 'error' : ''}
                disabled={loading}
                placeholder="+1 (555) 123-4567"
              />
              {fieldErrors.phone && (
                <span className="error-message">{fieldErrors.phone}</span>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="city">City</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className={fieldErrors.city ? 'error' : ''}
                  disabled={loading}
                  placeholder="New York"
                />
                {fieldErrors.city && (
                  <span className="error-message">{fieldErrors.city}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="state">State</label>
                <select
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className={fieldErrors.state ? 'error' : ''}
                  disabled={loading}
                >
                  <option value="">Select State</option>
                  {US_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                {fieldErrors.state && (
                  <span className="error-message">{fieldErrors.state}</span>
                )}
              </div>
            </div>
          </div>

          {/* Professional Information Section */}
          <div className="form-section">
            <h3>
              <Icon name="briefcase" size="lg" />
              Professional Information
            </h3>

            <div className="form-group">
              <label htmlFor="headline">
                Professional Headline
                <span className="char-counter"> ({formData.headline.length}/{MAX_HEADLINE_LENGTH})</span>
              </label>
              <input
                type="text"
                id="headline"
                name="headline"
                value={formData.headline}
                onChange={handleChange}
                className={fieldErrors.headline ? 'error' : ''}
                disabled={loading}
                placeholder="e.g., Senior Software Engineer | Full Stack Developer"
                maxLength={MAX_HEADLINE_LENGTH}
              />
              {fieldErrors.headline && (
                <span className="error-message">{fieldErrors.headline}</span>
              )}
              <small className="field-help">LinkedIn-style professional title</small>
            </div>

              {/* Change Password functionality removed as requested */}

            <div className="form-group">
              <label htmlFor="summary">
                Professional Summary
                <span className={`char-counter ${characterCount >= MAX_SUMMARY_LENGTH ? 'limit-reached' : ''}`}>
                  {characterCount}/{MAX_SUMMARY_LENGTH}
                </span>
              </label>
              <textarea
                id="summary"
                name="summary"
                value={formData.summary}
                onChange={handleChange}
                className={fieldErrors.summary ? 'error' : ''}
                disabled={loading}
                placeholder="Brief overview of your professional background, key skills, and career goals..."
                rows="6"
                maxLength={MAX_SUMMARY_LENGTH}
              />
              {fieldErrors.summary && (
                <span className="error-message">{fieldErrors.summary}</span>
              )}
              <small className="field-help">Brief bio about your professional experience</small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="industry">Industry</label>
                <select
                  id="industry"
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  className={fieldErrors.industry ? 'error' : ''}
                  disabled={loading}
                >
                  <option value="">Select Industry</option>
                  {COMMON_INDUSTRIES.map(industry => (
                    <option key={industry} value={industry}>{industry}</option>
                  ))}
                </select>
                {fieldErrors.industry && (
                  <span className="error-message">{fieldErrors.industry}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="experience_level">Experience Level</label>
                <select
                  id="experience_level"
                  name="experience_level"
                  value={formData.experience_level}
                  onChange={handleChange}
                  className={fieldErrors.experience_level ? 'error' : ''}
                  disabled={loading}
                >
                  {EXPERIENCE_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.experience_level && (
                  <span className="error-message">{fieldErrors.experience_level}</span>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              onClick={handleCancel}
              className="cancel-button"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="save-button"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
            <button
              type="button"
              className="delete-button"
              onClick={openDeleteDialog}
              disabled={loading}
              aria-label="Delete account"
            >
              Delete Account
            </button>
          </div>
        </form>
        {/* Delete Account Confirmation Dialog */}
        {showDeleteDialog && (
          <div className="modal-overlay" onClick={closeDeleteDialog}>
            <div className="modal-dialog delete-account-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-icon-container">
                  <svg className="modal-warning-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="modal-title">Delete Account</h3>
                <p className="modal-subtitle">This action requires confirmation</p>
              </div>
              
              <div className="modal-content">
                <div className="warning-box">
                  <svg className="warning-box-icon" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="warning-box-title">What happens next?</p>
                    <p className="warning-box-text">
                      We'll send a confirmation link to your email. Your account and all associated data will be permanently deleted only after you confirm via that link.
                    </p>
                  </div>
                </div>

                <div className="modal-input-group">
                  <label className="modal-input-label">
                    Confirm your password to continue
                  </label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`modal-password-input ${deleteError ? 'error' : ''}`}
                    autoFocus
                  />
                  {deleteError && (
                    <div className="modal-error-message">
                      <svg className="modal-error-icon" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {deleteError}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button className="modal-cancel-button" onClick={closeDeleteDialog} disabled={deleting}>
                  Cancel
                </button>
                <button className="modal-confirm-button" onClick={handleDeleteConfirm} disabled={deleting}>
                  {deleting ? (
                    <>
                      <svg className="spinner-icon" viewBox="0 0 24 24" fill="none">
                        <circle className="spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="send-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Confirmation Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default ProfileForm;
