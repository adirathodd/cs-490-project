// frontend/src/components/interview/MockInterviewContainer.js
import React, { useState, useEffect } from 'react';
import MockInterviewStart from './MockInterviewStart';
import MockInterviewSession from './MockInterviewSession';
import MockInterviewSummary from './MockInterviewSummary';
import { mockInterviewAPI } from '../../services/api';
import './MockInterview.css';

const MockInterviewContainer = ({ jobs = [] }) => {
  const [stage, setStage] = useState('start'); // 'start', 'session', 'summary'
  const [currentSession, setCurrentSession] = useState(null);
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await mockInterviewAPI.listSessions({ limit: 10 });
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions:', err);
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
    // Could navigate to sessions list or show modal
    alert('Sessions list feature - navigate to history view');
  };

  return (
    <div className="mock-interview-container">
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

      {/* Recent Sessions Sidebar (optional) */}
      {stage === 'start' && sessions.length > 0 && (
        <div className="recent-sessions-sidebar">
          <h3>Recent Sessions</h3>
          <ul className="sessions-list">
            {sessions.slice(0, 5).map(session => (
              <li key={session.id} className="session-item">
                <div className="session-type">{session.interview_type}</div>
                <div className="session-score">
                  {session.overall_score ? `${Math.round(session.overall_score)}/100` : 'In Progress'}
                </div>
                <div className="session-date">
                  {new Date(session.started_at).toLocaleDateString()}
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
