import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, signOut } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const confirmRef = useRef(null);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (e) => {
      if (confirmRef.current && !confirmRef.current.contains(e.target)) {
        setShowConfirm(false);
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

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h1>ATS Candidate System</h1>
        </div>
        <div className="nav-user">
          <span className="user-name">
            {userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : currentUser?.email}
          </span>
          <div className="signout-wrapper" ref={confirmRef}>
            <button onClick={handleSignOutClick} className="sign-out-button">
              Sign Out
            </button>
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
        <div className="welcome-section">
          <h2>Welcome to Your Dashboard</h2>
          <p>Manage your job search and applications all in one place.</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">📝</div>
            <h3>Profile</h3>
            <p>Complete your professional profile</p>
            <button className="card-button">Update Profile</button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">💼</div>
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

        <div className="user-info-section">
          <h3>Account Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value">{currentUser?.email}</span>
            </div>
            {userProfile && (
              <>
                <div className="info-item">
                  <span className="info-label">Name:</span>
                  <span className="info-value">
                    {userProfile.first_name} {userProfile.last_name}
                  </span>
                </div>
                {userProfile.phone && (
                  <div className="info-item">
                    <span className="info-label">Phone:</span>
                    <span className="info-value">{userProfile.phone}</span>
                  </div>
                )}
                {userProfile.location && (
                  <div className="info-item">
                    <span className="info-label">Location:</span>
                    <span className="info-value">{userProfile.location}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
