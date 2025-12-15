import React, { useState } from 'react';
import LinkedInConnect from './LinkedInConnect';
import ProfileOptimization from './ProfileOptimization';
import NetworkingMessageGenerator from './NetworkingMessageGenerator';
import GuidanceRenderer from '../common/GuidanceRenderer';
import Icon from '../common/Icon';
import APIErrorBanner from '../common/APIErrorBanner'; // UC-117: User-facing API error handling
import './LinkedIn.css';

const LinkedInIntegration = () => {
  const [activeTab, setActiveTab] = useState('connect');
  const [showMessageGenerator, setShowMessageGenerator] = useState(false);

  console.log('LinkedInIntegration - activeTab:', activeTab);

  const tabs = [
    { id: 'connect', label: 'Connect Profile', icon: 'link' },
    { id: 'optimize', label: 'Profile Optimization', icon: 'trending-up' },
    { id: 'networking', label: 'Networking Messages', icon: 'message-square' },
    { id: 'strategy', label: 'Content Strategy', icon: 'layout' }
  ];

  return (
    <div className="linkedin-integration-page">
      <div className="page-header">
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
            {console.log('Rendering ContentStrategyView')}
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
  const [integrationStatus, setIntegrationStatus] = useState(null);

  const checkIntegrationStatus = async () => {
    try {
      const { linkedInAPI } = require('../../services/api');
      const status = await linkedInAPI.getIntegrationStatus();
      setIntegrationStatus(status);
      return status;
    } catch (err) {
      console.error('Failed to check LinkedIn integration status:', err);
      return null;
    }
  };

  const fetchStrategy = async () => {
    console.log('fetchStrategy called');
    setLoading(true);
    setError('');

    try {
      // Check if LinkedIn is connected first
      const status = integrationStatus || await checkIntegrationStatus();
      console.log('Integration status:', status);
      
      if (!status?.connected) {
        console.log('LinkedIn not connected, skipping fetch');
        setError('');
        setLoading(false);
        return;
      }

      console.log('Fetching content strategy...');
      const { linkedInAPI } = require('../../services/api');
      const data = await linkedInAPI.getContentStrategy();
      console.log('Content strategy data:', data);
      console.log('Strategy text type:', typeof data.strategy);
      console.log('Strategy text preview:', data.strategy?.substring(0, 100));
      setStrategy(data);
    } catch (err) {
      console.error('Error fetching strategy:', err);
      // UC-117: Set structured error for user-facing display
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    console.log('ContentStrategyView mounted');
    const init = async () => {
      console.log('Initializing content strategy...');
      const status = await checkIntegrationStatus();
      console.log('Init status check:', status);
      if (status?.connected) {
        fetchStrategy();
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="loading-state">
        <Icon name="loader" size="lg" className="spinning" />
        <p>Loading content strategy...</p>
      </div>
    );
  }

  // Show not connected message if LinkedIn isn't connected
  if (integrationStatus && !integrationStatus.connected) {
    return (
      <div className="linkedin-not-connected">
        <Icon name="link-off" size="lg" />
        <h3>LinkedIn Profile Not Connected</h3>
        <p>Please connect your LinkedIn profile first to get content strategy recommendations.</p>
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
    // UC-117: User-facing error message with graceful degradation
    return (
      <div className="content-strategy-error-container">
        <APIErrorBanner 
          serviceName="LinkedIn API"
          error={error}
          severity="warning"
          onRetry={fetchStrategy}
          dismissible={false}
        />
        <div className="fallback-content">
          <h3>Content Strategy Tips</h3>
          <p>While we work to restore LinkedIn integration, here are some general content strategies:</p>
          <ul style={{ textAlign: 'left', marginTop: '16px' }}>
            <li>Share industry insights and professional achievements regularly</li>
            <li>Engage with your network's content through thoughtful comments</li>
            <li>Post 2-3 times per week for optimal visibility</li>
            <li>Use relevant hashtags to increase post reach</li>
            <li>Share articles and resources valuable to your network</li>
          </ul>
        </div>
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
          <GuidanceRenderer text={strategy.strategy} />
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
