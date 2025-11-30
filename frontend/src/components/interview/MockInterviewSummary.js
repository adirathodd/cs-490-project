// frontend/src/components/interview/MockInterviewSummary.js
import React from 'react';
import './MockInterview.css';

const MockInterviewSummary = ({ summary, onNewInterview, onViewSessions }) => {
  const { session_details, overall_assessment, readiness_level, estimated_interview_readiness,
    top_strengths, critical_areas, recommended_practice_topics, next_steps,
    performance_by_category, response_quality_score, communication_score, structure_score,
    compared_to_previous_sessions, improvement_trend } = summary;

  const getReadinessColor = (level) => {
    switch (level) {
      case 'ready': return 'green';
      case 'nearly_ready': return 'blue';
      case 'needs_practice': return 'orange';
      case 'not_ready': return 'red';
      default: return 'gray';
    }
  };

  const getReadinessLabel = (level) => {
    switch (level) {
      case 'ready': return '✅ Ready for Interviews';
      case 'nearly_ready': return '🎯 Nearly Ready';
      case 'needs_practice': return '📚 Needs More Practice';
      case 'not_ready': return '⚠️ Needs Significant Practice';
      default: return 'Unknown';
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'improving': return '📈 Improving';
      case 'declining': return '📉 Declining';
      case 'stable': return '➡️ Stable';
      default: return '—';
    }
  };

  return (
    <div className="mock-interview-summary">
      {/* Header */}
      <div className="summary-header">
        <h2>Mock Interview Summary</h2>
        <p className="interview-type">{session_details?.interview_type?.replace('_', ' ').toUpperCase()} Interview</p>
      </div>

      {/* Overall Score */}
      <div className="overall-score-card">
        <div className="score-circle">
          <svg width="200" height="200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="#e0e0e0" strokeWidth="15" />
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke={getReadinessColor(readiness_level)}
              strokeWidth="15"
              strokeDasharray={`${(estimated_interview_readiness / 100) * 565} 565`}
              strokeLinecap="round"
              transform="rotate(-90 100 100)"
            />
          </svg>
          <div className="score-text">
            <div className="score-number">{Math.round(session_details?.overall_score || 0)}</div>
            <div className="score-label">Overall Score</div>
          </div>
        </div>
        <div className="readiness-info">
          <div className={`readiness-badge readiness-${readiness_level}`}>
            {getReadinessLabel(readiness_level)}
          </div>
          <p className="readiness-percentage">
            {estimated_interview_readiness}% Interview Ready
          </p>
          {improvement_trend && (
            <p className="improvement-trend">
              {getTrendIcon(improvement_trend)}
            </p>
          )}
        </div>
      </div>

      {/* Component Scores */}
      <div className="component-scores">
        <div className="score-component">
          <h4>Response Quality</h4>
          <div className="score-bar">
            <div
              className="score-bar-fill"
              style={{ width: `${response_quality_score || 0}%` }}
            ></div>
          </div>
          <span className="score-value">{Math.round(response_quality_score || 0)}%</span>
        </div>
        <div className="score-component">
          <h4>Communication</h4>
          <div className="score-bar">
            <div
              className="score-bar-fill"
              style={{ width: `${communication_score || 0}%` }}
            ></div>
          </div>
          <span className="score-value">{Math.round(communication_score || 0)}%</span>
        </div>
        <div className="score-component">
          <h4>Structure</h4>
          <div className="score-bar">
            <div
              className="score-bar-fill"
              style={{ width: `${structure_score || 0}%` }}
            ></div>
          </div>
          <span className="score-value">{Math.round(structure_score || 0)}%</span>
        </div>
      </div>

      {/* Performance by Category */}
      {performance_by_category && Object.keys(performance_by_category).length > 0 && (
        <div className="category-performance">
          <h3>Performance by Category</h3>
          <div className="category-grid">
            {Object.entries(performance_by_category).map(([category, score]) => (
              <div key={category} className="category-card">
                <h4>{category}</h4>
                <div className="category-score">{Math.round(score)}/100</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overall Assessment */}
      {overall_assessment && (
        <div className="assessment-section">
          <h3>Overall Assessment</h3>
          <p className="assessment-text">{overall_assessment}</p>
        </div>
      )}

      {/* Strengths and Areas for Improvement */}
      <div className="strengths-improvements-grid">
        {top_strengths && top_strengths.length > 0 && (
          <div className="strengths-section">
            <h3>✨ Top Strengths</h3>
            <ul>
              {top_strengths.map((strength, idx) => (
                <li key={idx} className="strength-item">{strength}</li>
              ))}
            </ul>
          </div>
        )}

        {critical_areas && critical_areas.length > 0 && (
          <div className="improvements-section">
            <h3>🎯 Areas to Improve</h3>
            <ul>
              {critical_areas.map((area, idx) => (
                <li key={idx} className="improvement-item">{area}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommended Practice Topics */}
      {recommended_practice_topics && recommended_practice_topics.length > 0 && (
        <div className="recommendations-section">
          <h3>📚 Recommended Practice Topics</h3>
          <div className="topic-tags">
            {recommended_practice_topics.map((topic, idx) => (
              <span key={idx} className="topic-tag">{topic}</span>
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      {next_steps && next_steps.length > 0 && (
        <div className="next-steps-section">
          <h3>🚀 Next Steps</h3>
          <ol className="next-steps-list">
            {next_steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Comparison to Previous Sessions */}
      {compared_to_previous_sessions && compared_to_previous_sessions.average_previous_score && (
        <div className="comparison-section">
          <h3>📊 Progress Tracking</h3>
          <div className="comparison-stats">
            <div className="stat-item">
              <span className="stat-label">Previous Average:</span>
              <span className="stat-value">{Math.round(compared_to_previous_sessions.average_previous_score)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Current Score:</span>
              <span className="stat-value">{Math.round(compared_to_previous_sessions.current_score)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Improvement:</span>
              <span className={`stat-value ${compared_to_previous_sessions.improvement >= 0 ? 'positive' : 'negative'}`}>
                {compared_to_previous_sessions.improvement >= 0 ? '+' : ''}
                {Math.round(compared_to_previous_sessions.improvement)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="summary-actions">
        <button onClick={onNewInterview} className="btn btn-primary btn-large">
          Start New Mock Interview
        </button>
        <button onClick={onViewSessions} className="btn btn-secondary">
          View All Sessions
        </button>
      </div>
    </div>
  );
};

export default MockInterviewSummary;
