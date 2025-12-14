import React, { useEffect, useMemo, useState } from 'react';
import { jobsAPI } from '../../services/api';
import Icon from '../common/Icon';
import './ApplicationQualityScore.css';

const priorityOrder = { high: 0, medium: 1, low: 2 };

const formatDateTime = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch (e) {
    return value;
  }
};

const toPercent = (value) => {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value)}%`;
};

const ApplicationQualityScore = ({ job }) => {
  const [quality, setQuality] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (job?.id) {
      fetchQuality();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  const fetchQuality = async (refresh = false) => {
    if (!job?.id) return;
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await jobsAPI.getApplicationQuality(job.id, { refresh });
      setQuality(data);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load quality score');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const rerunAnalysis = async () => {
    try {
      setRefreshing(true);
      const data = await jobsAPI.refreshApplicationQuality(job.id);
      setQuality(data);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to refresh quality score');
    } finally {
      setRefreshing(false);
    }
  };

  const sortedSuggestions = useMemo(() => {
    const suggestions = quality?.suggestions || [];
    return [...suggestions].sort((a, b) => {
      return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
    });
  }, [quality]);

  const renderChips = (items, emptyLabel) => {
    if (!items || items.length === 0) {
      return <span className="quality-chip muted">{emptyLabel}</span>;
    }
    return items.map((item, idx) => (
      <span key={`${item}-${idx}`} className="quality-chip">{item}</span>
    ));
  };

  const getScoreTone = (score, threshold) => {
    if (score >= Math.max(threshold, 80)) return 'good';
    if (score >= threshold) return 'warn';
    return 'bad';
  };

  const scoreTone = getScoreTone(quality?.score ?? 0, quality?.threshold ?? 70);

  if (!job) return null;

  if (loading) {
    return (
      <div className="quality-panel">
        <div className="quality-card centered">
          <Icon name="spinner" size="lg" className="spin" />
          <p className="quality-muted">Analyzing your materials...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quality-panel">
        <div className="quality-card centered">
          <Icon name="alert-triangle" size="md" color="#dc2626" />
          <p className="quality-muted">{error}</p>
          <button className="quality-button" onClick={() => fetchQuality(true)}>Try again</button>
        </div>
      </div>
    );
  }

  if (!quality) return null;

  return (
    <div className="quality-panel">
      <div className="quality-header">
        <div>
          <p className="quality-eyebrow">Submission Readiness</p>
          <h3>Application Quality Score</h3>
          <p className="quality-muted">
            Alignment between your resume, cover letter, LinkedIn, and this job. Score must meet the gate before submitting.
          </p>
        </div>
        <div className="quality-actions">
          <span className={`quality-threshold quality-threshold--${quality.meets_threshold ? 'pass' : 'fail'}`}>
            <Icon name={quality.meets_threshold ? 'check-circle' : 'alert-triangle'} size="sm" />
            Minimum {quality.threshold}% required
          </span>
          <button className="quality-button" onClick={rerunAnalysis} disabled={refreshing}>
            {refreshing ? 'Re-running...' : 'Re-run analysis'}
          </button>
        </div>
      </div>

      <div className="quality-grid">
        <div className={`quality-card score-card tone-${scoreTone}`}>
          <div className="score-ring">
            <div className="score-ring__value">{Math.round(quality.score)}%</div>
            <div className="score-ring__label">Overall quality</div>
          </div>
          <div className="score-meta">
            <div>
              <p className="quality-muted">Last scored</p>
              <p className="quality-strong">{formatDateTime(quality.last_reviewed_at)}</p>
            </div>
            <div>
              <p className="quality-muted">Trend</p>
              <p className="quality-strong">
                {quality.score_delta === null || quality.score_delta === undefined
                  ? '—'
                  : quality.score_delta >= 0
                    ? `▲ +${quality.score_delta}`
                    : `▼ ${quality.score_delta}`}
              </p>
            </div>
            <div>
              <p className="quality-muted">Submission gate</p>
              <p className="quality-strong">
                {quality.meets_threshold ? 'Ready to submit' : 'Needs improvement'}
              </p>
            </div>
          </div>
          {quality.comparison && (
            <div className="quality-comparison">
              <div>
                <p className="quality-muted">Your average</p>
                <p className="quality-strong">{toPercent(quality.comparison.average_score)}</p>
              </div>
              <div>
                <p className="quality-muted">Top application</p>
                <p className="quality-strong">{toPercent(quality.comparison.top_score)}</p>
              </div>
              <div>
                <p className="quality-muted">vs. average</p>
                <p className="quality-strong">
                  {quality.comparison.delta_from_average === null || quality.comparison.delta_from_average === undefined
                    ? '—'
                    : quality.comparison.delta_from_average >= 0
                      ? `+${Math.round(quality.comparison.delta_from_average)} pts`
                      : `${Math.round(quality.comparison.delta_from_average)} pts`}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="quality-card breakdown-card">
          <div className="quality-card-header">
            <h4>Alignment breakdown</h4>
            {quality.meets_threshold ? (
              <span className="pill pill-success">On track</span>
            ) : (
              <span className="pill pill-warn">Below gate</span>
            )}
          </div>
          <div className="breakdown-grid">
            <div className="breakdown-row">
              <span>Role alignment</span>
              <span className="breakdown-score">{toPercent(quality.alignment_score)}</span>
            </div>
            <div className="breakdown-row">
              <span>Keyword coverage</span>
              <span className="breakdown-score">{toPercent(quality.keyword_score)}</span>
            </div>
            <div className="breakdown-row">
              <span>Consistency</span>
              <span className="breakdown-score">{toPercent(quality.consistency_score)}</span>
            </div>
            <div className="breakdown-row">
              <span>Formatting + hygiene</span>
              <span className="breakdown-score">{toPercent(quality.formatting_score)}</span>
            </div>
          </div>
          <div className="quality-footnote">
            Scores reflect resume, cover letter, and LinkedIn readiness for <strong>{job.title}</strong> at <strong>{job.company_name}</strong>.
          </div>
        </div>

        <div className="quality-card">
          <div className="quality-card-header">
            <h4>Missing keywords</h4>
            <span className="pill">ATS</span>
          </div>
          <div className="chip-row">
            {renderChips(quality.missing_keywords, 'No major gaps detected')}
          </div>
          <div className="quality-card-header" style={{ marginTop: '12px' }}>
            <h4>Skill gaps</h4>
            <span className="pill">Fit</span>
          </div>
          <div className="chip-row">
            {renderChips(quality.missing_skills, 'All required skills covered')}
          </div>
        </div>

        <div className="quality-card">
          <div className="quality-card-header">
            <h4>Actionable suggestions</h4>
            <span className="pill pill-outline">{sortedSuggestions.length} items</span>
          </div>
          {sortedSuggestions.length === 0 && (
            <p className="quality-muted" style={{ margin: 0 }}>No suggestions right now. Re-run after you tweak your materials.</p>
          )}
          <div className="suggestions-list">
            {sortedSuggestions.map((suggestion, idx) => (
              <div key={`${suggestion.title}-${idx}`} className="suggestion-row">
                <span className={`priority priority-${suggestion.priority || 'low'}`}>
                  {suggestion.priority || 'low'}
                </span>
                <div>
                  <p className="suggestion-title">{suggestion.title}</p>
                  <p className="quality-muted">{suggestion.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="quality-card">
          <div className="quality-card-header">
            <h4>Formatting + consistency</h4>
            <span className="pill">Hygiene</span>
          </div>
          {quality.formatting_issues && quality.formatting_issues.length > 0 ? (
            <ul className="issue-list">
              {quality.formatting_issues.map((issue, idx) => (
                <li key={`${issue}-${idx}`}>
                  <Icon name="alert-circle" size="sm" /> {issue}
                </li>
              ))}
            </ul>
          ) : (
            <p className="quality-muted">No formatting issues flagged.</p>
          )}
        </div>

        <div className="quality-card">
          <div className="quality-card-header">
            <h4>History & improvement</h4>
            <span className="pill pill-outline">{(quality.history || []).length} runs</span>
          </div>
          <div className="history-list">
            {(quality.history || []).map((entry) => (
              <div key={entry.id} className="history-row">
                <div>
                  <p className="quality-strong">{toPercent(entry.score)}</p>
                  <p className="quality-muted">{formatDateTime(entry.created_at)}</p>
                </div>
                {(() => {
                  const delta = entry.score_delta;
                  const deltaClass = delta === null || delta === undefined ? '' : delta >= 0 ? 'up' : 'down';
                  return (
                    <div className={`history-delta ${deltaClass}`}>
                      {delta === null || delta === undefined ? '—' : delta >= 0 ? `+${delta}` : delta}
                    </div>
                  );
                })()}
              </div>
            ))}
            {(quality.history || []).length === 0 && (
              <p className="quality-muted" style={{ margin: 0 }}>Run the analysis to start tracking improvements.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationQualityScore;
