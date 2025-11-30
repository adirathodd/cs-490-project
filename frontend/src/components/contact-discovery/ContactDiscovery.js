import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import DiscoverySearchForm from './DiscoverySearchForm';
import ContactSuggestionCard from './ContactSuggestionCard';
import './ContactDiscovery.css';

const ContactDiscovery = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('search'); // Start with search form, not old suggestions
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('suggested');
  const [analytics, setAnalytics] = useState(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false); // Track if showing all or just recent

  useEffect(() => {
    // Don't auto-load suggestions on mount or filter changes
    // Suggestions should only be loaded via explicit actions:
    // 1. Creating a new search (handleNewSearch)
    // 2. Clicking "Load All Historical Suggestions" button
    if (showAllSuggestions) {
      loadSuggestions();
    }
    // Always load searches and analytics
    if (view !== 'search') {
      loadSearches();
      loadAnalytics();
    }
  }, [showAllSuggestions]); // Removed filterType and filterStatus from dependencies

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (filterType !== 'all') params.type = filterType;
      if (filterStatus !== 'all') params.status = filterStatus;
      
      const response = await api.get('/contact-suggestions', { params });
      setSuggestions(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error loading suggestions:', err);
      
      // Check if it's an authentication error
      if (err?.error?.code === 'authentication_failed' || err?.response?.status === 401) {
        setError('Please log in to view suggestions');
      }
      // For other errors, show the backend message or generic message
      else if (err?.error) {
        setError(err.error.message || 'Failed to load suggestions. Please try again.');
      }
      // Don't show error for network issues that might be transient
      else if (err?.response?.status >= 500) {
        setError('Server error. Please try again later.');
      }
      // For 404 and empty responses, don't show an error
      
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSearches = async () => {
    try {
      const response = await api.get('/discovery-searches');
      setSearches(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Failed to load searches:', err);
      setSearches([]);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await api.get('/discovery/analytics');
      setAnalytics(response.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setAnalytics(null);
    }
  };

  const handleNewSearch = async (searchCriteria) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Submitting search criteria:', searchCriteria);
      
      // Clear current suggestions immediately to avoid showing stale data
      setSuggestions([]);
      
      const response = await api.post('/discovery-searches', searchCriteria);
      console.log('Search response:', response.data);
      console.log('New suggestions:', response.data.suggestions);
      
      // Verify suggestions match the search criteria
      const newSuggestions = response.data.suggestions || [];
      console.log('Companies in suggestions:', newSuggestions.map(s => s.suggested_company));
      
      // Replace suggestions with only the new ones from this search
      // This ensures we don't show old suggestions from previous searches
      setSuggestions(newSuggestions);
      setSearches([response.data.search, ...searches]);
      setShowAllSuggestions(false); // We're showing specific search results, not all
      setView('suggestions');
      
      // Update analytics with new suggestions
      loadAnalytics();
    } catch (err) {
      const errorMsg = err?.error?.message || err?.message || 'Failed to generate suggestions';
      setError(errorMsg);
      console.error('Generate suggestions error:', err);
      console.error('Error details:', err?.error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkContacted = async (suggestionId) => {
    try {
      await api.patch(`/contact-suggestions/${suggestionId}`, { status: 'contacted' });
      
      // Update the suggestion in the current list immediately
      setSuggestions(suggestions.map(s => 
        s.id === suggestionId ? { ...s, status: 'contacted', contacted_at: new Date().toISOString() } : s
      ));
      
      // Reload full data and analytics
      loadAnalytics();
    } catch (err) {
      setError('Failed to mark as contacted');
      console.error(err);
    }
  };

  const handleConvertToContact = async (suggestionId) => {
    try {
      const response = await api.post(`/contact-suggestions/${suggestionId}/convert`);
      
      // Update the suggestion in the current list immediately
      setSuggestions(suggestions.map(s => 
        s.id === suggestionId ? { ...s, status: 'connected', connected_contact: response.data.contact } : s
      ));
      
      // Reload analytics
      loadAnalytics();
    } catch (err) {
      setError('Failed to convert to contact');
      console.error(err);
    }
  };

  const handleDismiss = async (suggestionId) => {
    try {
      await api.patch(`/contact-suggestions/${suggestionId}`, { status: 'dismissed' });
      
      // Update the suggestion in the current list immediately
      setSuggestions(suggestions.map(s => 
        s.id === suggestionId ? { ...s, status: 'dismissed' } : s
      ));
      
      // Reload analytics
      loadAnalytics();
    } catch (err) {
      setError('Failed to dismiss suggestion');
      console.error(err);
    }
  };

  const renderSuggestions = () => (
    <div className="contact-discovery-suggestions">
      <div className="suggestions-header">
        <h2>Contact Suggestions</h2>
        <div className="suggestions-filters">
          {!showAllSuggestions && suggestions.length > 0 && (
            <button 
              onClick={() => {
                setShowAllSuggestions(true);
                loadSuggestions();
              }} 
              className="btn-secondary"
              style={{ marginRight: '10px' }}
            >
              Load All Historical Suggestions
            </button>
          )}
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="target_company">Target Company</option>
            <option value="alumni">Alumni</option>
            <option value="industry_leader">Industry Leader</option>
            <option value="mutual_connection">Mutual Connection</option>
            <option value="conference_speaker">Conference Speaker</option>
            <option value="similar_role">Similar Role</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="suggested">Suggested</option>
            <option value="contacted">Contacted</option>
            <option value="connected">Connected</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading suggestions...</div>
      ) : suggestions.length === 0 ? (
        <div className="no-suggestions">
          <p>No suggestions yet. Create a search to discover contacts!</p>
          <button onClick={() => setView('search')} className="btn-primary">
            New Search
          </button>
        </div>
      ) : (
        <div className="suggestions-grid">
          {suggestions.map((suggestion) => (
            <ContactSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onMarkContacted={handleMarkContacted}
              onConvertToContact={handleConvertToContact}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => (
    <div className="discovery-analytics">
      <h2>Discovery Analytics</h2>
      {analytics ? (
        <>
          <div className="analytics-overview">
            <div className="stat-card">
              <div className="stat-value">{analytics.overview.total_suggestions}</div>
              <div className="stat-label">Total Suggestions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{analytics.overview.contacted}</div>
              <div className="stat-label">Contacted</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{analytics.overview.connected}</div>
              <div className="stat-label">Connected</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {analytics.overview.connection_rate.toFixed(1)}%
              </div>
              <div className="stat-label">Connection Rate</div>
            </div>
          </div>

          <div className="analytics-by-type">
            <h3>By Suggestion Type</h3>
            <table className="type-breakdown-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Total</th>
                  <th>Connected</th>
                  <th>Conversion Rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(analytics.by_type).map(([key, data]) => (
                  <tr key={key}>
                    <td>{data.label}</td>
                    <td>{data.total}</td>
                    <td>{data.connected}</td>
                    <td>{data.conversion_rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {analytics.recent_connections.length > 0 && (
            <div className="recent-connections">
              <h3>Recent Connections</h3>
              <div className="connections-list">
                {analytics.recent_connections.map((conn) => (
                  <div key={conn.id} className="connection-item">
                    <div className="connection-name">{conn.suggested_name}</div>
                    <div className="connection-company">{conn.suggested_company}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="loading">Loading analytics...</div>
      )}
    </div>
  );

  return (
    <div className="contact-discovery">
      <div className="discovery-header">
        <h1>Contact Discovery</h1>
        <div className="view-tabs">
          <button
            className={view === 'suggestions' ? 'active' : ''}
            onClick={() => setView('suggestions')}
          >
            Suggestions
          </button>
          <button
            className={view === 'search' ? 'active' : ''}
            onClick={() => setView('search')}
          >
            New Search
          </button>
          <button
            className={view === 'analytics' ? 'active' : ''}
            onClick={() => setView('analytics')}
          >
            Analytics
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {view === 'suggestions' && renderSuggestions()}
      {view === 'search' && (
        <DiscoverySearchForm onSubmit={handleNewSearch} onCancel={() => setView('suggestions')} />
      )}
      {view === 'analytics' && renderAnalytics()}
    </div>
  );
};

export default ContactDiscovery;
