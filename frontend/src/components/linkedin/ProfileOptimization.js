import React, { useState, useEffect } from 'react';
import { linkedInAPI } from '../../services/api';
import Icon from '../common/Icon';
import LoadingSpinner from '../common/LoadingSpinner';
import GuidanceRenderer from '../common/GuidanceRenderer';
import APIErrorBanner from '../common/APIErrorBanner'; // UC-117: User-facing API error handling
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
      // UC-117: Set structured error for user-facing display
      setError(err);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // UC-117: User-facing error message with graceful fallback
    return (
      <div className="profile-optimization-error-container">
        <APIErrorBanner 
          serviceName="LinkedIn API"
          error={error}
          severity="warning"
          onRetry={fetchSuggestions}
          dismissible={false}
        />
        <div className="fallback-content" style={{ 
          background: '#f8f9fa', 
          padding: '24px', 
          borderRadius: '8px', 
          marginTop: '20px' 
        }}>
          <h3>General Profile Optimization Tips</h3>
          <p>While we work to restore LinkedIn integration, consider these optimization strategies:</p>
          <ul style={{ textAlign: 'left', marginTop: '16px', lineHeight: '1.8' }}>
            <li><strong>Profile Photo:</strong> Use a professional headshot with good lighting</li>
            <li><strong>Headline:</strong> Highlight your key skills and career goals (not just job title)</li>
            <li><strong>Summary:</strong> Write a compelling narrative about your experience and aspirations</li>
            <li><strong>Experience:</strong> Include quantifiable achievements and impact metrics</li>
            <li><strong>Skills:</strong> List 10-15 relevant skills and get endorsements from connections</li>
            <li><strong>Recommendations:</strong> Request recommendations from colleagues and managers</li>
          </ul>
        </div>
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
