import React, { useState, useEffect } from 'react';
import { linkedInAPI } from '../../services/api';
import Icon from '../common/Icon';
import LoadingSpinner from '../common/LoadingSpinner';
import GuidanceRenderer from '../common/GuidanceRenderer';
import './LinkedIn.css';

const ProfileOptimization = () => {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [integrationStatus, setIntegrationStatus] = useState(null);

  const checkIntegrationStatus = async () => {
    try {
      const status = await linkedInAPI.getIntegrationStatus();
      setIntegrationStatus(status);
      return status;
    } catch (err) {
      console.error('Failed to check LinkedIn integration status:', err);
      return null;
    }
  };

  const fetchSuggestions = async () => {
    setLoading(true);
    setError('');

    try {
      // Check if LinkedIn is connected first
      const status = integrationStatus || await checkIntegrationStatus();
      
      if (!status?.connected) {
        setError('');
        setLoading(false);
        return;
      }

      const data = await linkedInAPI.getProfileOptimization();
      console.log('Profile optimization data received:', data);
      setSuggestions(data);
    } catch (err) {
      console.error('Profile optimization error:', err);
      setError(err.message || 'Failed to load optimization suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const status = await checkIntegrationStatus();
      if (status?.connected) {
        fetchSuggestions();
      }
    };
    init();
  }, []);

  if (loading) {
    return (
      <div className="linkedin-optimization-loading">
        <LoadingSpinner />
        <p>Analyzing your profile...</p>
      </div>
    );
  }

  // Show not connected message if LinkedIn isn't connected
  if (integrationStatus && !integrationStatus.connected) {
    return (
      <div className="linkedin-not-connected">
        <Icon name="link-off" size="lg" />
        <h3>LinkedIn Profile Not Connected</h3>
        <p>Please connect your LinkedIn profile first to get personalized optimization suggestions.</p>
        <button 
          onClick={() => window.location.href = '/linkedin'} 
          className="primary-btn"
        >
          <Icon name="linkedin" size="sm" />
          Go to Connect Profile
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="linkedin-error">
        <Icon name="alert-circle" size="lg" />
        <p>{error}</p>
        <button onClick={fetchSuggestions} className="retry-btn">
          <Icon name="refresh-cw" size="sm" />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="linkedin-profile-optimization">
      <div className="optimization-header">
        <h2>
          <Icon name="linkedin" size="lg" />
          LinkedIn Profile Optimization
        </h2>
        <button onClick={fetchSuggestions} className="refresh-btn">
          <Icon name="refresh-cw" size="sm" />
          Refresh Suggestions
        </button>
      </div>

      {suggestions && (
        <div className="optimization-content">
          <GuidanceRenderer text={suggestions.suggestions} />
          
          {suggestions.generated_by === 'ai' && (
            <div className="ai-badge">
              <Icon name="sparkles" size="sm" />
              AI-Powered Suggestions
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileOptimization;
