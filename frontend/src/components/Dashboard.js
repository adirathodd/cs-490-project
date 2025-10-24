import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authAPI from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, signOut, loading: authLoading } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const confirmRef = useRef(null);
  const userMenuRef = useRef(null);

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
          }
        } catch (error) {
          console.log('Profile picture fetch error:', error);
          // Silently handle 404 or 400 - no profile picture exists
          if (error.response && (error.response.status === 404 || error.response.status === 400)) {
            setProfilePictureUrl(null);
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
      navigate('/profile');
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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h1>ATS Candidate System</h1>
        </div>
        <div className="nav-user">
          <div className="user-menu-wrapper" ref={userMenuRef}>
            <button onClick={toggleUserMenu} className="user-menu-button">
              <span className="user-name">
                {userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : currentUser?.email}
              </span>
              <span className="dropdown-arrow">{showUserMenu ? '▲' : '▼'}</span>
            </button>
            {showUserMenu && (
              <div className="user-dropdown">
                <button className="dropdown-item" onClick={handleProfile}>
                  <span className="dropdown-icon">👤</span>
                  My Profile
                </button>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item sign-out-item" onClick={handleSignOutClick}>
                  <span className="dropdown-icon">🚪</span>
                  Sign Out
                </button>
              </div>
            )}
          </div>
          <div className="signout-wrapper" ref={confirmRef}>
            {showConfirm && (
              <div className="signout-confirm">
                <p>Are you sure you want to sign out?</p>
                <div className="confirm-actions">
                  <button className="confirm-yes" onClick={() => handleConfirm(true)}>Yes</button>
                  <button className="confirm-no" onClick={() => handleConfirm(false)}>No</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

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
                  {userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Welcome'}
                </h2>
                <p className="account-email">{currentUser?.email}</p>
                {userProfile && (
                  <div className="account-info-row">
                    {userProfile.phone && (
                      <span className="account-info-item">
                        📱 {userProfile.phone}
                      </span>
                    )}
                    {userProfile.location && (
                      <span className="account-info-item">
                        📍 {userProfile.location}
                      </span>
                    )}
                    {userProfile.city && userProfile.state && (
                      <span className="account-info-item">
                        🏙️ {userProfile.city}, {userProfile.state}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button className="edit-profile-button" onClick={handleUpdateProfile}>
              ✏️ Edit Profile
            </button>
          </div>
        </div>

        <div className="welcome-section">
          <h2>Your Dashboard</h2>
          <p>Manage your job search and applications all in one place.</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon"></div>
            <h3>Job Opportunities</h3>
            <p>Browse and track job openings</p>
            <button className="card-button">View Jobs</button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📄</div>
            <h3>Applications</h3>
            <p>Track your job applications</p>
            <button className="card-button">View Applications</button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📊</div>
            <h3>Analytics</h3>
            <p>View your job search metrics</p>
            <button className="card-button">View Analytics</button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🤖</div>
            <h3>AI Tools</h3>
            <p>Resume optimization and more</p>
            <button className="card-button">Explore Tools</button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🔔</div>
            <h3>Notifications</h3>
            <p>Stay updated on your applications</p>
            <button className="card-button">View Notifications</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
