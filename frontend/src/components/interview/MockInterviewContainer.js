// frontend/src/components/interview/MockInterviewContainer.js
import React, { useState, useEffect } from 'react';
import MockInterviewStart from './MockInterviewStart';
import MockInterviewSession from './MockInterviewSession';
import MockInterviewSummary from './MockInterviewSummary';
import ConfirmDialog from '../common/ConfirmDialog';
import Toast from '../common/Toast';
import { mockInterviewAPI } from '../../services/api';
import './MockInterview.css';

const MockInterviewContainer = ({ jobs = [] }) => {
  const [stage, setStage] = useState('start'); // 'start', 'session', 'summary', 'history'
  const [currentSession, setCurrentSession] = useState(null);
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null); // Track which menu is open
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null, title: '', variant: 'danger' });
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'info' });

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await mockInterviewAPI.listSessions({ limit: 20 });
      setSessions(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleSessionStart = (session) => {
    setCurrentSession(session);
    setStage('session');
  };

  const handleComplete = (summaryData) => {
    setSummary(summaryData);
    setStage('summary');
    loadSessions(); // Refresh sessions list
  };

  const handleNewInterview = () => {
    setCurrentSession(null);
    setSummary(null);
    setStage('start');
  };

  const handleViewSessions = () => {
    setStage('history');
  };

  const handleResumeSession = async (session) => {
    try {
      setLoadingSession(true);
      setError(null);
      
      // Fetch full session details with questions
      const fullSession = await mockInterviewAPI.getSession(session.id);
      
      if (session.status === 'completed') {
        // Try to get summary for completed sessions
        try {
          const summaryData = await mockInterviewAPI.getSummary(session.id);
          setSummary(summaryData);
          setCurrentSession(fullSession);
          setStage('summary');
        } catch (summaryErr) {
          // Summary doesn't exist, offer to regenerate
          if (summaryErr.error?.code === 'not_found' || summaryErr.message?.includes('not found')) {
            setConfirmDialog({
              isOpen: true,
              title: 'Generate Summary',
              message: 'This interview is completed but the summary is missing. Would you like to generate it now?',
              variant: 'info',
              onConfirm: async () => {
                try {
                  const newSummary = await mockInterviewAPI.completeSession(session.id);
                  setSummary(newSummary);
                  setCurrentSession(fullSession);
                  setStage('summary');
                } catch (regenerateErr) {
                  setError('Failed to generate summary. The session may be incomplete.');
                  console.error('Failed to regenerate summary:', regenerateErr);
                }
              }
            });
            return;
          } else {
            throw summaryErr;
          }
        }
      } else {
        // Resume in-progress session
        setCurrentSession(fullSession);
        setStage('session');
      }
    } catch (err) {
      console.error('Failed to load session:', err);
      setError(err.message || 'Failed to load session. Please try again.');
    } finally {
      setLoadingSession(false);
    }
  };

  const getSessionStatusLabel = (session) => {
    if (session.status === 'completed') {
      return session.overall_score ? `${Math.round(session.overall_score)}/100` : 'Completed';
    }
    return 'In Progress';
  };

  const getSessionStatusClass = (session) => {
    if (session.status === 'completed') {
      return 'status-completed';
    }
    return 'status-in-progress';
  };

  const handleDeleteSession = async (sessionId, event) => {
    event.stopPropagation(); // Prevent card click
    setMenuOpen(null);
    
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Interview Session',
      message: 'Are you sure you want to delete this interview session? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await mockInterviewAPI.deleteSession(sessionId);
          await loadSessions();
          setToast({ isOpen: true, message: 'Interview session deleted successfully', type: 'success' });
        } catch (err) {
          console.error('Failed to delete session:', err);
          setToast({ isOpen: true, message: 'Failed to delete session. Please try again.', type: 'error' });
        }
      }
    });
  };

  const toggleMenu = (sessionId, event) => {
    event.stopPropagation(); // Prevent card click
    setMenuOpen(menuOpen === sessionId ? null : sessionId);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (menuOpen !== null) {
        setMenuOpen(null);
      }
    };
    
    if (menuOpen !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <div className="mock-interview-container">
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
      />

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />

      {loadingSession && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Loading session...</p>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          {error}
          <button onClick={() => setError(null)} className="close-error">×</button>
        </div>
      )}

      {stage === 'start' && (
        <MockInterviewStart
          onSessionStart={handleSessionStart}
          jobs={jobs}
        />
      )}

      {stage === 'session' && currentSession && (
        <MockInterviewSession
          session={currentSession}
          onComplete={handleComplete}
        />
      )}

      {stage === 'summary' && summary && (
        <MockInterviewSummary
          summary={summary}
          onNewInterview={handleNewInterview}
          onViewSessions={handleViewSessions}
        />
      )}

      {/* Sessions History View */}
      {stage === 'history' && (
        <div className="sessions-history">
          <div className="history-header">
            <button onClick={() => setStage('start')} className="back-button">
              ← Back
            </button>
            <h2>Mock Interview History</h2>
            <button onClick={handleNewInterview} className="btn btn-primary">
              New Interview
            </button>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <h3>No Interview Sessions Yet</h3>
              <p>Start your first mock interview to build your practice history.</p>
              <button onClick={handleNewInterview} className="btn btn-primary btn-large">
                Start First Interview
              </button>
            </div>
          ) : (
            <div className="sessions-grid">
              {sessions.map(session => (
                <div 
                  key={session.id} 
                  className={`session-card ${getSessionStatusClass(session)}`}
                  onClick={() => handleResumeSession(session)}
                >
                  <div className="session-card-header">
                    <div className="session-type-badge">
                      {session.interview_type.replace('_', ' ')}
                    </div>
                    <div className="session-header-right">
                      <div className={`session-status ${getSessionStatusClass(session)}`}>
                        {session.status === 'completed' ? '✓ Completed' : '⏱ In Progress'}
                      </div>
                      <div className="session-menu">
                        <button 
                          className="menu-button"
                          onClick={(e) => toggleMenu(session.id, e)}
                          aria-label="More options"
                        >
                          ⋮
                        </button>
                        {menuOpen === session.id && (
                          <div className="menu-dropdown">
                            <button 
                              className="menu-item delete"
                              onClick={(e) => handleDeleteSession(session.id, e)}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="session-card-body">
                    <div className="session-meta">
                      <span className="session-difficulty">{session.difficulty_level} level</span>
                      <span className="session-questions">{session.question_count} questions</span>
                    </div>

                    {session.focus_areas && session.focus_areas.length > 0 && (
                      <div className="session-focus">
                        {session.focus_areas.slice(0, 3).map((area, idx) => (
                          <span key={idx} className="focus-tag">{area}</span>
                        ))}
                        {session.focus_areas.length > 3 && (
                          <span className="focus-tag">+{session.focus_areas.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="session-card-footer">
                    <div className="session-date">
                      {new Date(session.started_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    <div className="session-score">
                      {getSessionStatusLabel(session)}
                    </div>
                  </div>

                  <div className="session-action-hint">
                    {session.status === 'completed' ? 'Click to review' : 'Click to resume'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Sessions Sidebar */}
      {stage === 'start' && sessions.length > 0 && (
        <div className="recent-sessions-sidebar">
          <div className="sidebar-header">
            <h3>Recent Sessions</h3>
            <button onClick={handleViewSessions} className="view-all-link">
              View All →
            </button>
          </div>
          <ul className="sessions-list">
            {sessions.slice(0, 5).map(session => (
              <li 
                key={session.id} 
                className={`session-item ${getSessionStatusClass(session)}`}
              >
                <div 
                  className="session-item-content"
                  onClick={() => handleResumeSession(session)}
                >
                  <div className="session-type">
                    {session.interview_type.replace('_', ' ')}
                  </div>
                  <div className="session-score">
                    {getSessionStatusLabel(session)}
                  </div>
                  <div className="session-date">
                    {new Date(session.started_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="session-item-actions">
                  <span className="session-item-action">
                    {session.status === 'completed' ? '👁' : '▶'}
                  </span>
                  <div className="session-menu-small">
                    <button 
                      className="menu-button"
                      onClick={(e) => toggleMenu(session.id, e)}
                      aria-label="More options"
                    >
                      ⋮
                    </button>
                    {menuOpen === session.id && (
                      <div className="menu-dropdown">
                        <button 
                          className="menu-item delete"
                          onClick={(e) => handleDeleteSession(session.id, e)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MockInterviewContainer;
