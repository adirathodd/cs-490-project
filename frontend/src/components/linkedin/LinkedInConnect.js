import React, { useState, useEffect } from 'react';
import { linkedInAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Icon from '../common/Icon';
import LoadingSpinner from '../common/LoadingSpinner';
import './LinkedIn.css';

const LinkedInConnect = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [integrationStatus, setIntegrationStatus] = useState(null);
  const { refreshUserProfile } = useAuth();

  useEffect(() => {
    // Check integration status on mount
    checkIntegrationStatus();

    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      handleOAuthCallback(code, state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkIntegrationStatus = async () => {
    try {
      const status = await linkedInAPI.getIntegrationStatus();
      setIntegrationStatus(status);
    } catch (err) {
      console.error('Failed to check LinkedIn integration status:', err);
    }
  };

  const handleOAuthCallback = async (code, state) => {
    setLoading(true);
    setError('');

    try {
      const result = await linkedInAPI.completeOAuth(code, state);
      await refreshUserProfile();
      
      if (onSuccess) {
        onSuccess(result);
      }

      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Update integration status
      await checkIntegrationStatus();
    } catch (err) {
      setError(err.message || 'Failed to connect LinkedIn account');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setError('');

    try {
      const { auth_url } = await linkedInAPI.initiateOAuth();
      window.location.href = auth_url;
    } catch (err) {
      setError(err.message || 'Failed to initiate LinkedIn connection');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="linkedin-connect-loading">
        <LoadingSpinner />
        <p>Connecting to LinkedIn...</p>
      </div>
    );
  }

  // Show connected status if already connected
  if (integrationStatus?.connected) {
    return (
      <div className="linkedin-connected">
        <div className="linkedin-connected-badge">
          <Icon name="check-circle" size="md" className="success-icon" />
          <div className="connected-info">
            <h4>LinkedIn Connected</h4>
            <p>Your profile was imported {integrationStatus.last_sync_date ? `on ${new Date(integrationStatus.last_sync_date).toLocaleDateString()}` : 'successfully'}</p>
            {integrationStatus.linkedin_profile_url && (
              <a 
                href={integrationStatus.linkedin_profile_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="view-profile-link"
              >
                View LinkedIn Profile →
              </a>
            )}
          </div>
        </div>
        
        <div className="reconnect-section">
          <button
            className="reconnect-btn"
            onClick={handleConnect}
            disabled={loading}
          >
            <Icon name="refresh-cw" size="sm" />
            Reconnect LinkedIn Profile
          </button>
          <p className="reconnect-info">
            Connect a different LinkedIn account or refresh your profile data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="linkedin-connect">
      <button
        className="linkedin-connect-btn"
        onClick={handleConnect}
        disabled={loading}
      >
        <Icon name="linkedin" size="md" />
        Connect LinkedIn Profile
      </button>

      {error && (
        <div className="error-message">
          <Icon name="alert-circle" size="sm" />
          {error}
        </div>
      )}

      <p className="linkedin-connect-info">
        Import your profile information and get personalized optimization tips
      </p>
    </div>
  );
};

export default LinkedInConnect;
