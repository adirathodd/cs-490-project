import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LinkedInConnect from './LinkedInConnect';
import ProfileOptimization from './ProfileOptimization';
import NetworkingMessageGenerator from './NetworkingMessageGenerator';
import Icon from '../common/Icon';
import './LinkedIn.css';

const LinkedInIntegration = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('connect');
  const [showMessageGenerator, setShowMessageGenerator] = useState(false);

  const tabs = [
    { id: 'connect', label: 'Connect Profile', icon: 'link' },
    { id: 'optimize', label: 'Profile Optimization', icon: 'trending-up' },
    { id: 'networking', label: 'Networking Messages', icon: 'message-square' },
    { id: 'strategy', label: 'Content Strategy', icon: 'layout' }
  ];

  return (
    <div className="linkedin-integration-page">
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <Icon name="arrow-left" size="sm" />
          Back to Dashboard
        </button>
        <h1>
          <Icon name="linkedin" size="lg" />
          LinkedIn Integration
        </h1>
        <p className="page-description">
          Connect your LinkedIn profile, get optimization tips, and generate professional networking messages
        </p>
      </div>

      <div className="tab-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon name={tab.icon} size="sm" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'connect' && (
          <div className="tab-panel">
            <h2>Connect Your LinkedIn Profile</h2>
            <p>Import your LinkedIn profile information to enhance your application materials and get personalized suggestions.</p>
            <LinkedInConnect onSuccess={() => setActiveTab('optimize')} />
          </div>
        )}

        {activeTab === 'optimize' && (
          <div className="tab-panel">
            <ProfileOptimization />
          </div>
        )}

        {activeTab === 'networking' && (
          <div className="tab-panel">
            <div className="networking-header">
              <h2>LinkedIn Networking Messages</h2>
              <button
                className="primary-btn"
                onClick={() => setShowMessageGenerator(true)}
              >
                <Icon name="plus" size="sm" />
                Generate New Message
              </button>
            </div>
            <p>Create personalized LinkedIn messages for various networking purposes.</p>
            
            {showMessageGenerator ? (
              <NetworkingMessageGenerator 
                onClose={() => setShowMessageGenerator(false)}
              />
            ) : (
              <div className="networking-guide">
                <h3>Networking Message Types</h3>
                <div className="message-types-grid">
                  <div className="message-type-card">
                    <Icon name="user-plus" size="md" />
                    <h4>Connection Request</h4>
                    <p>Expand your professional network with personalized connection requests</p>
                  </div>
                  <div className="message-type-card">
                    <Icon name="coffee" size="md" />
                    <h4>Informational Interview</h4>
                    <p>Request conversations to learn from professionals in your field</p>
                  </div>
                  <div className="message-type-card">
                    <Icon name="briefcase" size="md" />
                    <h4>Job Inquiry</h4>
                    <p>Express interest in opportunities at specific companies</p>
                  </div>
                  <div className="message-type-card">
                    <Icon name="users" size="md" />
                    <h4>Referral Request</h4>
                    <p>Ask for referrals to positions at companies where you have connections</p>
                  </div>
                </div>
                <button
                  className="secondary-btn"
                  onClick={() => setShowMessageGenerator(true)}
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'strategy' && (
          <div className="tab-panel">
            <ContentStrategyView />
          </div>
        )}
      </div>
    </div>
  );
};

// Content Strategy Component
const ContentStrategyView = () => {
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStrategy = async () => {
    setLoading(true);
    setError('');

    try {
      const { linkedInAPI } = require('../../services/api');
      const data = await linkedInAPI.getContentStrategy();
      setStrategy(data);
    } catch (err) {
      setError(err.message || 'Failed to load content strategy');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchStrategy();
  }, []);

  if (loading) {
    return (
      <div className="loading-state">
        <Icon name="loader" size="lg" className="spinning" />
        <p>Loading content strategy...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <Icon name="alert-circle" size="lg" />
        <p>{error}</p>
        <button onClick={fetchStrategy} className="retry-btn">
          Try Again
        </button>
      </div>
    );
  }

  if (!strategy) return null;

  return (
    <div className="content-strategy">
      <div className="strategy-header">
        <h2>
          <Icon name="layout" size="lg" />
          LinkedIn Content Strategy
        </h2>
        <button onClick={fetchStrategy} className="refresh-btn">
          <Icon name="refresh-cw" size="sm" />
          Refresh
        </button>
      </div>

      <div className="strategy-content">
        <div className="strategy-main">
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
            {strategy.strategy}
          </pre>
        </div>

        <div className="strategy-sidebar">
          <h3>Key Tips</h3>
          <ul className="tips-list">
            {strategy.key_tips.map((tip, index) => (
              <li key={index}>
                <Icon name="check-circle" size="sm" />
                {tip}
              </li>
            ))}
          </ul>
          {strategy.recommended_frequency && (
            <div className="frequency-badge">
              <Icon name="calendar" size="sm" />
              <span>Recommended: {strategy.recommended_frequency}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkedInIntegration;
