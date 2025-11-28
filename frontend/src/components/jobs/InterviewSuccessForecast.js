import React from 'react';
import Icon from '../common/Icon';
import './InterviewSuccessForecast.css';

const FACTOR_CONFIG = [
  { key: 'preparation', label: 'Preparation', description: 'Checklist & prep tasks', accent: '#6366f1' },
  { key: 'match', label: 'Role Match', description: 'Job fit & skill alignment', accent: '#0ea5e9' },
  { key: 'research', label: 'Company Research', description: 'Mission / news coverage', accent: '#f97316' },
  { key: 'practice', label: 'Practice Hours', description: 'Mock interviews & drills', accent: '#10b981' },
  { key: 'historical', label: 'Historical Trends', description: 'Past interview outcomes', accent: '#a855f7' },
];

const confidenceCopy = {
  high: 'High confidence',
  moderate: 'Moderate confidence',
  developing: 'Data still forming',
};

export default function InterviewSuccessForecast({ data, loading, error, onRefresh }) {
  const interviews = data?.interviews || [];
  const selected = interviews[0] || null;

  if (loading) {
    return (
      <div className="forecast-card forecast-loading">
        <Icon name="loader" size="lg" className="spin" />
        <p>Calculating interview readiness...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="forecast-card forecast-error">
        <Icon name="alert-triangle" size="lg" />
        <p>{typeof error === 'string' ? error : 'Unable to load forecast'}</p>
        <button className="ghost-button ghost-button--primary" onClick={() => onRefresh?.(true)}>
          <Icon name="refresh" size="sm" /> Try again
        </button>
      </div>
    );
  }

  if (!interviews.length) {
    return (
      <div className="forecast-card forecast-empty">
        <Icon name="calendar" size="lg" />
        <p>No upcoming interviews found. Schedule an interview to unlock predictions.</p>
        <button className="cta-button" onClick={() => onRefresh?.(true)}>Refresh</button>
      </div>
    );
  }

  const summary = data?.summary || {};
  const accuracy = data?.accuracy || {};

  return (
    <div className="forecast-container">
      <div className="forecast-summary">
        <div>
          <p className="summary-eyebrow">Average probability</p>
          <div className="summary-stat">{summary.average_probability ?? 0}%</div>
        </div>
        <div>
          <p className="summary-eyebrow">Interviews tracked</p>
          <div className="summary-stat">{summary.total_upcoming || 0}</div>
        </div>
        <div>
          <p className="summary-eyebrow">Confidence</p>
          <div className="summary-chip">{summary.confidence_snapshot || 'n/a'}</div>
        </div>
        <div className="summary-actions">
          <button className="ghost-button" onClick={() => onRefresh?.(true)}>
            <Icon name="refresh" size="sm" /> Refresh forecast
          </button>
        </div>
      </div>

      <div className="forecast-body">
        <section className="forecast-detail full-width">
          {selected && (
            <>
              <div className="forecast-scorecard">
                <div className="scorecard-left">
                  <p className="eyebrow">Success probability</p>
                  <div className="score-value">{Math.round(selected.probability)}%</div>
                  <div className={`confidence-chip confidence-${selected.confidence_label}`}>
                    {confidenceCopy[selected.confidence_label] || 'Confidence updated'}
                  </div>
                  <p className="trend-text">
                    {selected.trend?.direction === 'up' && 'Trending up '}
                    {selected.trend?.direction === 'down' && 'Trending down '}
                    {selected.trend?.direction === 'steady' && 'Stable forecast '}
                    ({selected.trend?.change ?? 0}% vs last prediction)
                  </p>
                </div>
                <div className="scorecard-right">
                  <p className="eyebrow">Scheduled</p>
                  <div>{new Date(selected.scheduled_at).toLocaleString()}</div>
                  <p className="eyebrow">Interview type</p>
                  <div>{selected.interview_type?.replace('_', ' ')}</div>
                </div>
              </div>

              <div className="forecast-factors">
                {FACTOR_CONFIG.map((config) => (
                  <div className="forecast-factor" key={config.key}>
                    <div className="factor-label" style={{ color: config.accent }}>{config.label}</div>
                    <div className="factor-score">
                      {Math.round((selected[config.key]?.score ?? selected[config.key]?.factors?.score ?? 0))}%
                    </div>
                    <p>{config.description}</p>
                  </div>
                ))}
              </div>

              <div className="forecast-panels">
                <div className="forecast-panel">
                  <div className="panel-header">
                    <Icon name="target" size="sm" /> Recommendations
                  </div>
                  {selected.recommendations?.length ? (
                    <ul>
                      {selected.recommendations.map((rec, idx) => (
                        <li key={idx}>
                          <strong>{rec.title}</strong>
                          <p>{rec.detail}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted-text">No recommendations right now.</p>
                  )}
                </div>
                <div className="forecast-panel">
                  <div className="panel-header">
                    <Icon name="check-circle" size="sm" /> Action items
                  </div>
                  {selected.action_items?.length ? (
                    <ul>
                      {selected.action_items.map((action, idx) => (
                        <li key={idx}>
                          <strong>{action.title}</strong>
                          <p>{action.detail}</p>
                          <span className={`priority priority-${action.priority}`}>{action.priority}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted-text">All action items completed.</p>
                  )}
                </div>
                {selected.ai_insights && (
                  <div className="forecast-panel">
                    <div className="panel-header">
                      <Icon name="sparkles" size="sm" /> AI Coach
                    </div>
                    <p className="ai-summary">{selected.ai_insights.summary}</p>
                    {selected.ai_insights.focus_points?.length > 0 && (
                      <div className="ai-section">
                        <p className="ai-section__title">Focus points</p>
                        <ul className="ai-list">
                          {selected.ai_insights.focus_points.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selected.ai_insights.risk_alerts?.length > 0 && (
                      <div className="ai-section">
                        <p className="ai-section__title">Watch outs</p>
                        <ul className="ai-list">
                          {selected.ai_insights.risk_alerts.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selected.ai_insights.confidence_context && (
                      <p className="ai-context">{selected.ai_insights.confidence_context}</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="forecast-meta">
        <div>
          <p className="eyebrow">Accuracy tracking</p>
          {accuracy.tracked_predictions ? (
            <p>
              {accuracy.tracked_predictions} predictions evaluated • MAE {accuracy.mean_absolute_error}
            </p>
          ) : (
            <p>No completed interviews evaluated yet.</p>
          )}
        </div>
        <div>
          <p className="eyebrow">Upcoming comparison</p>
          <div className="comparison-list">
            {summary.comparison?.map((item) => (
              <span key={item.interview_id}>
                {item.job_title} • {Math.round(item.probability)}%
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
