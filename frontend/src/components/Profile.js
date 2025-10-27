import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { authAPI, profileAPI } from '../services/api';
import './Profile.css';

const Profile = () => {
  const { currentUser, userProfile } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const navigate = useNavigate();
  const { userId } = useParams();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!currentUser) {
          navigate('/login');
          return;
        }

        // If no userId provided or if userId matches current user, show own profile
        if (!userId || userId === currentUser.uid) {
          setProfile(userProfile);
          setLoading(false);
          return;
        }

        // If trying to access another user's profile, verify permissions via backend
        const me = await authAPI.getCurrentUser();
        const isAdmin = !!(me?.user?.is_staff || me?.user?.is_superuser);

        if (!isAdmin) {
          setError('Unauthorized: You can only view your own profile');
          navigate('/profile');
          return;
        }

        // Admin: fetch the requested user's profile
        try {
          const res = await profileAPI.getUserProfile(userId);
          setProfile(res.profile);
        } catch (err) {
          const msg = err?.error?.message || err?.message || 'Error loading user profile';
          setError(msg);
        } finally {
          setLoading(false);
        }
      } catch (error) {
        setError('Error loading profile: ' + error.message);
        setLoading(false);
      }
    };

    fetchProfile();
  }, [currentUser, userId, navigate, userProfile]);

  useEffect(() => {
    const fetchProfilePicture = async () => {
      if (currentUser && profile) {
        try {
          const response = await authAPI.getProfilePicture();
          if (response.profile_picture_url) {
            const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
            const fullUrl = response.profile_picture_url.startsWith('http') 
              ? response.profile_picture_url 
              : `${apiBaseUrl}${response.profile_picture_url}`;
            setProfilePictureUrl(fullUrl);
          }
        } catch (error) {
          console.log('Profile picture fetch error:', error);
        }
      }
    };

    fetchProfilePicture();
  }, [currentUser, profile]);

  if (loading) {
    return (
      <div className="profile-container">
        <div className="profile-loading">
          <div className="profile-loading-spinner"></div>
          <div className="profile-loading-text">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-container">
        <div className="page-backbar">
          <button className="btn-back" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
        </div>
        <div className="profile-error">
          <div className="profile-error-icon">⚠️</div>
          <div className="profile-error-message">{error}</div>
        </div>
      </div>
    );
  }

  const displayName = profile?.full_name || 
    `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
    'No name provided';

  return (
    <div className="profile-container">
      <div className="page-backbar">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
      </div>

      {/* Profile Header */}
      <div className="profile-header-section">
        <div className="profile-header-content">
          <div className="profile-avatar-large">
            {profilePictureUrl ? (
              <img src={profilePictureUrl} alt={displayName} />
            ) : (
              <div className="profile-avatar-placeholder">
                {profile?.first_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div className="profile-header-info">
            <h1 className="profile-name">{displayName}</h1>
            {profile?.job_title && (
              <div className="profile-title">{profile.job_title}</div>
            )}
            {profile?.headline && (
              <div className="profile-title">{profile.headline}</div>
            )}
            <div className="profile-meta">
              {profile?.email && (
                <div className="profile-meta-item">
                  📧 {profile.email}
                </div>
              )}
              {profile?.phone && (
                <div className="profile-meta-item">
                  📱 {profile.phone}
                </div>
              )}
              {(profile?.city || profile?.state) && (
                <div className="profile-meta-item">
                  📍 {profile.city && profile.state ? `${profile.city}, ${profile.state}` : profile.city || profile.state}
                </div>
              )}
            </div>
            <div className="profile-actions">
              <button 
                className="profile-action-btn"
                onClick={() => navigate('/profile/edit')}
              >
                ✏️ Edit Profile
              </button>
              <button 
                className="profile-action-btn secondary"
                onClick={() => navigate('/dashboard')}
              >
                🏠 Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="profile-content">
        {/* Personal Information */}
        <div className="profile-section">
          <div className="profile-section-header">
            <h2 className="profile-section-title">
              <span className="profile-section-icon">👤</span>
              Personal Information
            </h2>
          </div>
          <div className="profile-detail-grid">
            <div className="profile-detail-item">
              <div className="profile-detail-label">First Name</div>
              <div className="profile-detail-value">
                {profile?.first_name || <span className="empty">Not provided</span>}
              </div>
            </div>
            <div className="profile-detail-item">
              <div className="profile-detail-label">Last Name</div>
              <div className="profile-detail-value">
                {profile?.last_name || <span className="empty">Not provided</span>}
              </div>
            </div>
            <div className="profile-detail-item">
              <div className="profile-detail-label">Email</div>
              <div className="profile-detail-value">{profile?.email}</div>
            </div>
            <div className="profile-detail-item">
              <div className="profile-detail-label">Phone</div>
              <div className="profile-detail-value">
                {profile?.phone || <span className="empty">Not provided</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Professional Information */}
        <div className="profile-section">
          <div className="profile-section-header">
            <h2 className="profile-section-title">
              <span className="profile-section-icon">💼</span>
              Professional Information
            </h2>
          </div>
          <div className="profile-detail-grid">
            {profile?.headline && (
              <div className="profile-detail-item" style={{gridColumn: '1 / -1'}}>
                <div className="profile-detail-label">Professional Headline</div>
                <div className="profile-detail-value">{profile.headline}</div>
              </div>
            )}
            {profile?.summary && (
              <div className="profile-detail-item" style={{gridColumn: '1 / -1'}}>
                <div className="profile-detail-label">Professional Summary</div>
                <div className="profile-detail-value" style={{whiteSpace: 'pre-wrap'}}>{profile.summary}</div>
              </div>
            )}
            <div className="profile-detail-item">
              <div className="profile-detail-label">Industry</div>
              <div className="profile-detail-value">
                {profile?.industry || <span className="empty">Not provided</span>}
              </div>
            </div>
            <div className="profile-detail-item">
              <div className="profile-detail-label">Experience Level</div>
              <div className="profile-detail-value">
                {profile?.experience_level ? 
                  profile.experience_level.charAt(0).toUpperCase() + profile.experience_level.slice(1) 
                  : <span className="empty">Not provided</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Location */}
        {(profile?.city || profile?.state) && (
          <div className="profile-section">
            <div className="profile-section-header">
              <h2 className="profile-section-title">
                <span className="profile-section-icon">📍</span>
                Location
              </h2>
            </div>
            <div className="profile-detail-grid">
              {profile?.city && (
                <div className="profile-detail-item">
                  <div className="profile-detail-label">City</div>
                  <div className="profile-detail-value">{profile.city}</div>
                </div>
              )}
              {profile?.state && (
                <div className="profile-detail-item">
                  <div className="profile-detail-label">State</div>
                  <div className="profile-detail-value">{profile.state}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;