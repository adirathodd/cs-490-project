import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../common/Toast';
import api from '../../services/api';
import './ResponseLibrary.css';

export const ResponseLibrary = () => {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState([]);
  const [gapAnalysis, setGapAnalysis] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'info' });

  // Refresh on mount and when page becomes visible
  useEffect(() => {
    loadLibrary();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadLibrary();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [filter, searchQuery]);

  const loadLibrary = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (filter !== 'all') filters.type = filter;
      if (searchQuery) filters.search = searchQuery;
      
      const data = await api.responseLibraryAPI.listResponses(filters);
      setResponses(data.responses || []);
      setGapAnalysis(data.gap_analysis || null);
    } catch (err) {
      setToast({ isOpen: true, message: err.message || 'Failed to load library', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (responseId) => {
    try {
      const data = await api.responseLibraryAPI.getResponse(responseId);
      setSelectedResponse(data);
      setShowDetail(true);
    } catch (err) {
      setToast({ isOpen: true, message: 'Failed to load response details', type: 'error' });
    }
  };

  const handleDelete = async (responseId) => {
    if (!window.confirm('Are you sure you want to delete this response?')) {
      return;
    }

    try {
      await api.responseLibraryAPI.deleteResponse(responseId);
      setToast({ isOpen: true, message: 'Response deleted', type: 'success' });
      setShowDetail(false);
      setSelectedResponse(null);
      loadLibrary();
    } catch (err) {
      setToast({ isOpen: true, message: 'Failed to delete response', type: 'error' });
    }
  };

  const handleExport = async (format = 'text') => {
    try {
      const blob = await api.responseLibraryAPI.exportLibrary(format, filter !== 'all' ? filter : null);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `response_library.${format === 'json' ? 'json' : 'txt'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setToast({ isOpen: true, message: 'Library exported successfully', type: 'success' });
    } catch (err) {
      setToast({ isOpen: true, message: 'Failed to export library', type: 'error' });
    }
  };

  const renderGapAnalysis = () => {
    if (!gapAnalysis) return null;

    return (
      <div className="gap-analysis-card">
        <h2>📊 Library Analysis</h2>
        
        <div className="stats-grid">
          <div className="stat-box">
            <span className="stat-number">{gapAnalysis.total_responses}</span>
            <span className="stat-label">Total Responses</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">{gapAnalysis.by_type?.behavioral || 0}</span>
            <span className="stat-label">Behavioral</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">{gapAnalysis.by_type?.technical || 0}</span>
            <span className="stat-label">Technical</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">{gapAnalysis.by_type?.situational || 0}</span>
            <span className="stat-label">Situational</span>
          </div>
        </div>

        {gapAnalysis.recommendations && gapAnalysis.recommendations.length > 0 && (
          <div className="recommendations-section">
            <h3>💡 Recommendations</h3>
            <div className="recommendations-list">
              {gapAnalysis.recommendations.map((rec, idx) => (
                <div key={idx} className={`recommendation ${rec.priority}`}>
                  <div className="rec-header">
                    <span className={`priority-badge ${rec.priority}`}>{rec.priority}</span>
                    <span className="rec-category">{rec.category}</span>
                  </div>
                  <p className="rec-text">{rec.recommendation}</p>
                  <p className="rec-action"><strong>Action:</strong> {rec.action}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderResponseCard = (response) => {
    const successIcon = response.led_to_offer ? '🎉' : response.led_to_next_round ? '✅' : '';
    
    return (
      <div key={response.id} className="response-card" onClick={() => handleViewDetail(response.id)}>
        <div className="response-header">
          <span className={`type-badge ${response.question_type}`}>
            {response.question_type}
          </span>
          {successIcon && <span className="success-icon">{successIcon}</span>}
        </div>
        
        <h3 className="question-text">{response.question_text}</h3>
        
        <p className="response-preview">
          {response.current_response_text.substring(0, 150)}
          {response.current_response_text.length > 150 && '...'}
        </p>
        
        <div className="response-meta">
          {response.skills && response.skills.length > 0 && (
            <div className="skills-tags">
              {response.skills.slice(0, 3).map((skill, idx) => (
                <span key={idx} className="skill-tag">{skill}</span>
              ))}
              {response.skills.length > 3 && (
                <span className="skill-tag">+{response.skills.length - 3}</span>
              )}
            </div>
          )}
        </div>
        
        <div className="response-stats">
          <div className="stat-item">
            <span className="stat-icon">📊</span>
            <span className="stat-text">{response.success_rate.toFixed(0)}% success</span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">🔄</span>
            <span className="stat-text">{response.times_used} uses</span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">📝</span>
            <span className="stat-text">{response.version_count} versions</span>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailView = () => {
    if (!selectedResponse) return null;

    return (
      <div className="detail-overlay">
        <div className="detail-modal">
          <div className="detail-header">
            <h2>Response Details</h2>
            <button onClick={() => setShowDetail(false)} className="close-btn">×</button>
          </div>
          
          <div className="detail-content">
            <div className="detail-section">
              <h3>Question</h3>
              <p className="question-display">{selectedResponse.question_text}</p>
              <span className={`type-badge ${selectedResponse.question_type}`}>
                {selectedResponse.question_type}
              </span>
              <button
                onClick={() => {
                  setShowDetail(false);
                  loadLibrary();
                }}
                className="refresh-detail-btn"
                title="Refresh library"
              >
                🔄
              </button>
            </div>

            <div className="detail-section">
              <h3>Your Response</h3>
              <p className="response-text">{selectedResponse.current_response_text}</p>
            </div>

            {selectedResponse.current_star_response && 
             Object.values(selectedResponse.current_star_response).some(v => v) && (
              <div className="detail-section star-section">
                <h3>⭐ STAR Breakdown</h3>
                <div className="star-grid">
                  {selectedResponse.current_star_response.situation && (
                    <div className="star-part">
                      <strong>Situation:</strong>
                      <p>{selectedResponse.current_star_response.situation}</p>
                    </div>
                  )}
                  {selectedResponse.current_star_response.task && (
                    <div className="star-part">
                      <strong>Task:</strong>
                      <p>{selectedResponse.current_star_response.task}</p>
                    </div>
                  )}
                  {selectedResponse.current_star_response.action && (
                    <div className="star-part">
                      <strong>Action:</strong>
                      <p>{selectedResponse.current_star_response.action}</p>
                    </div>
                  )}
                  {selectedResponse.current_star_response.result && (
                    <div className="star-part">
                      <strong>Result:</strong>
                      <p>{selectedResponse.current_star_response.result}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="detail-section">
              <h3>Metadata</h3>
              <div className="metadata-grid">
                {selectedResponse.skills && selectedResponse.skills.length > 0 && (
                  <div className="metadata-item">
                    <strong>Skills:</strong>
                    <div className="tags-list">
                      {selectedResponse.skills.map((skill, idx) => (
                        <span key={idx} className="tag">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedResponse.tags && selectedResponse.tags.length > 0 && (
                  <div className="metadata-item">
                    <strong>Tags:</strong>
                    <div className="tags-list">
                      {selectedResponse.tags.map((tag, idx) => (
                        <span key={idx} className="tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedResponse.companies_used_for && selectedResponse.companies_used_for.length > 0 && (
                  <div className="metadata-item">
                    <strong>Used for:</strong>
                    <div className="tags-list">
                      {selectedResponse.companies_used_for.map((company, idx) => (
                        <span key={idx} className="tag">{company}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="detail-section">
              <h3>Performance</h3>
              <div className="performance-stats">
                <div className="perf-stat">
                  <span className="perf-label">Success Rate</span>
                  <span className="perf-value">{selectedResponse.success_rate.toFixed(0)}%</span>
                </div>
                <div className="perf-stat">
                  <span className="perf-label">Times Used</span>
                  <span className="perf-value">{selectedResponse.times_used}</span>
                </div>
                <div className="perf-stat">
                  <span className="perf-label">Led to Offer</span>
                  <span className="perf-value">{selectedResponse.led_to_offer ? 'Yes 🎉' : 'No'}</span>
                </div>
                <div className="perf-stat">
                  <span className="perf-label">Led to Next Round</span>
                  <span className="perf-value">{selectedResponse.led_to_next_round ? 'Yes ✅' : 'No'}</span>
                </div>
              </div>
            </div>

            {selectedResponse.versions && selectedResponse.versions.length > 0 && (
              <div className="detail-section">
                <h3>Version History ({selectedResponse.versions.length})</h3>
                <div className="versions-list">
                  {selectedResponse.versions.map((version) => (
                    <div key={version.version_number} className="version-item">
                      <div className="version-header">
                        <span className="version-number">v{version.version_number}</span>
                        <span className="version-date">
                          {new Date(version.created_at).toLocaleDateString()}
                        </span>
                        {version.coaching_score && (
                          <span className="version-score">Score: {version.coaching_score}</span>
                        )}
                      </div>
                      {version.change_notes && (
                        <p className="version-notes">{version.change_notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="detail-actions">
            <button onClick={() => handleDelete(selectedResponse.id)} className="btn-delete">
              Delete
            </button>
            <button onClick={() => setShowDetail(false)} className="btn-close">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading && responses.length === 0) {
    return (
      <div className="response-library-container">
        <Toast
          isOpen={toast.isOpen}
          onClose={() => setToast({ ...toast, isOpen: false })}
          message={toast.message}
          type={toast.type}
        />
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your response library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="response-library-container">
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />

      <div className="library-header">
        <div className="header-content">
          <h1>📚 Interview Response Library</h1>
          <p>Build and refine your best interview responses</p>
        </div>
        <div className="header-actions">
          <button 
            onClick={() => loadLibrary()} 
            className="btn-refresh"
            title="Refresh library"
            disabled={loading}
          >
            🔄 Refresh
          </button>
          <button onClick={() => handleExport('text')} className="btn-export">
            Export as Text
          </button>
          <button onClick={() => handleExport('json')} className="btn-export">
            Export as JSON
          </button>
        </div>
      </div>

      {renderGapAnalysis()}

      <div className="library-controls">
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({responses.length})
          </button>
          <button
            className={`filter-tab ${filter === 'behavioral' ? 'active' : ''}`}
            onClick={() => setFilter('behavioral')}
          >
            Behavioral
          </button>
          <button
            className={`filter-tab ${filter === 'technical' ? 'active' : ''}`}
            onClick={() => setFilter('technical')}
          >
            Technical
          </button>
          <button
            className={`filter-tab ${filter === 'situational' ? 'active' : ''}`}
            onClick={() => setFilter('situational')}
          >
            Situational
          </button>
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="Search responses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="responses-grid">
        {responses.length > 0 ? (
          responses.map(response => renderResponseCard(response))
        ) : (
          <div className="empty-state">
            <h3>No responses yet</h3>
            <p>Save your practiced responses from the Response Coach to build your library.</p>
          </div>
        )}
      </div>

      {showDetail && renderDetailView()}
    </div>
  );
};

export default ResponseLibrary;
