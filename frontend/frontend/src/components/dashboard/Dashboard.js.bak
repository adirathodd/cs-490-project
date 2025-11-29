import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import './Dashboard.css';
import LoadingSpinner from '../common/LoadingSpinner';
import Icon from '../common/Icon';
import DeadlinesWidget from '../common/DeadlinesWidget';

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, signOut, loading: authLoading } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const confirmRef = useRef(null);
  const userMenuRef = useRef(null);

  // Prefer the user's saved profile name first (what they edited),
  // then fall back to the Firebase provider displayName, then email.
  const displayName = (
    (userProfile?.full_name && userProfile.full_name.trim()) ||
    (((userProfile?.first_name || userProfile?.last_name) && `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()) || '') ||
    (currentUser?.displayName && currentUser.displayName.trim()) ||
    currentUser?.email
  );

  // Avoid showing the email twice: if the computed displayName is the same as the account email,
  // don't show it as the 'name' — the email will still appear in the account-email row below.
  const displayNameToShow = (displayName && currentUser?.email && displayName === currentUser.email)
    ? ''
    : displayName;

  useEffect(() => {
    // Fetch profile picture
    const fetchProfilePicture = async () => {
      if (currentUser) {
        try {
          const response = await authAPI.getProfilePicture();
          console.log('Profile picture response:', response);

          // The response from authAPI.getProfilePicture is already response.data
          if (response.profile_picture_url) {
            // Build full URL - the backend returns relative path like /media/profile_pictures/...
            const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
            const fullUrl = response.profile_picture_url.startsWith('http') 
              ? response.profile_picture_url 
              : `${apiBaseUrl}${response.profile_picture_url}`;
            setProfilePictureUrl(fullUrl);
            return;
          }

          // Fallback: if backend has no uploaded profile picture, use portfolio_url (we store Google photo there)
          if (userProfile && userProfile.portfolio_url) {
            const photo = userProfile.portfolio_url;
            const fullPhoto = photo.startsWith('http') ? photo : `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${photo}`;
            setProfilePictureUrl(fullPhoto);
            return;
          }

          // No picture available
          setProfilePictureUrl(null);
        } catch (error) {
          console.log('Profile picture fetch error:', error);
          // Silently handle 404 or 400 - no profile picture exists
          if (error.response && (error.response.status === 404 || error.response.status === 400)) {
            // Fallback to portfolio_url if available
            if (userProfile && userProfile.portfolio_url) {
              const photo = userProfile.portfolio_url;
              const fullPhoto = photo.startsWith('http') ? photo : `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${photo}`;
              setProfilePictureUrl(fullPhoto);
            } else {
              setProfilePictureUrl(null);
            }
          }
        }
      }
    };

    fetchProfilePicture();
  }, [currentUser]);

  useEffect(() => {
    // Close dropdowns when clicking outside
    const handleClickOutside = (e) => {
      if (confirmRef.current && !confirmRef.current.contains(e.target)) {
        setShowConfirm(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSignOutClick = () => {
    setShowConfirm((s) => !s);
  };

  const handleConfirm = async (confirm) => {
    if (confirm) {
      await handleSignOut();
    } else {
      setShowConfirm(false);
    }
  };

  const handleUpdateProfile = () => {
    if (!authLoading && currentUser) {
      navigate('/profile/edit');
    }
  };

  const handleProfile = () => {
    setShowUserMenu(false);
    navigate('/profile');
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  if (authLoading) {
    return (
      <div className="dashboard-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', transform: 'translateY(5vh)' }}>
          <LoadingSpinner size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      

      <div className="dashboard-content">
        {/* Account Information Banner */}
        <div className="account-banner">
          <div className="account-banner-content">
            <div className="account-profile-section">
              <div className="account-avatar">
                {profilePictureUrl ? (
                  <img src={profilePictureUrl} alt="Profile" className="account-avatar-img" />
                ) : (
                  <div className="account-avatar-placeholder">
                    {userProfile?.first_name?.[0]?.toUpperCase() || currentUser?.email?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="account-details">
                <h2 className="account-name">
                  {displayNameToShow || 'Welcome'}
                </h2>
                <p className="account-email">{currentUser?.email}</p>
                {userProfile && (
                  <div className="account-info-row">
                        {userProfile.phone && (
                          <span className="account-info-item"><Icon name="camera" size="sm" /> {userProfile.phone}</span>
                        )}
                        {userProfile.location && (
                          <span className="account-info-item"><Icon name="location" size="sm" /> {userProfile.location}</span>
                        )}
                        {userProfile.city && userProfile.state && (
                          <span className="account-info-item"><Icon name="home" size="sm" /> {userProfile.city}, {userProfile.state}</span>
                        )}
                  </div>
                )}
              </div>
            </div>
            <button className="edit-profile-button" onClick={handleUpdateProfile}>
              <Icon name="edit" size="sm" /> Edit Profile
            </button>
          </div>
        </div>

        <div className="welcome-section">
          <h2>Your Dashboard</h2>
          <p>Manage your professional profile and showcase your experience.</p>
        </div>

        {/* Profile Overview (UC-033) */}

        {/* Sidebar widget (left) — absolutely positioned so it doesn't shift the card grid */}
        <div className="deadlines-sidebar"><DeadlinesWidget /></div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
              <div className="card-icon" aria-label="Skills">
                <Icon name="idea" size="lg" color="#000000" ariaLabel="Skills" />
              </div>
            <h3>Skills</h3>
            <p>Add and manage your skills</p>
            <button className="card-button" onClick={() => navigate('/skills')}>Manage Skills</button>
            <button className="card-button card-button-secondary" onClick={() => navigate('/skills/organized')}>
              Organize by Category
            </button>
          </div>

          <div className="dashboard-card">
              <div className="card-icon"><Icon name="briefcase" size="lg" ariaLabel="Employment" /></div>
            <h3>Employment History</h3>
            <p>Add and manage your work experience</p>
            <button className="card-button" onClick={() => navigate('/employment')}>View/Edit Employment</button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon"><Icon name="education" size="lg" ariaLabel="Education" /></div>
            <h3>Education</h3>
            <p>Add and manage your educational background</p>
            <button className="card-button" onClick={() => navigate('/education')}>Manage Education</button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon" aria-label="Certifications"><Icon name="cert" size="lg" ariaLabel="Certifications" /></div>
            <h3>Certifications</h3>
            <p>Add and manage your professional certifications</p>
            <button className="card-button" onClick={() => navigate('/certifications')}>Manage Certifications</button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon" aria-label="Projects"><Icon name="project" size="lg" ariaLabel="Projects" /></div>
            <h3>Projects</h3>
            <p>Showcase significant work beyond employment</p>
            <button className="card-button" onClick={() => navigate('/projects')}>Manage Projects</button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon" aria-label="Jobs"><Icon name="briefcase" size="lg" ariaLabel="Jobs" /></div>
            <h3>Jobs</h3>
            <p>Track opportunities you want to apply for</p>
            <button className="card-button" onClick={() => navigate('/jobs')}>Add Job Entry</button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon" aria-label="Documents"><Icon name="file-text" size="lg" ariaLabel="Documents" /></div>
            <h3>Documents</h3>
            <p>Manage resumes, cover letters, and application materials</p>
            <button className="card-button" onClick={() => navigate('/documents')}>Manage Documents</button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon"><Icon name="users" size="lg" ariaLabel="Contacts" /></div>
            <h3>Contacts</h3>
            <p>Manage your professional contacts, notes and reminders</p>
            <button className="card-button" onClick={() => navigate('/contacts')}>Manage Contacts</button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon"><Icon name="calendar" size="lg" ariaLabel="Networking Events" /></div>
            <h3>Networking Events</h3>
            <p>Track events, set goals, and manage professional connections</p>
            <button className="card-button" onClick={() => navigate('/networking')}>Manage Events</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
