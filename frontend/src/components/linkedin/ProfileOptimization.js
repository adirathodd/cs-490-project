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

  const fetchSuggestions = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await linkedInAPI.getProfileOptimization();
      setSuggestions(data);
    } catch (err) {
      setError(err.message || 'Failed to load optimization suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  if (loading) {
    return (
      <div className="linkedin-optimization-loading">
        <LoadingSpinner />
        <p>Analyzing your profile...</p>
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
          <GuidanceRenderer content={suggestions.suggestions} />
          
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
