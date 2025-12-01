// UC-097: Application Success Rate Analysis (cleaned formatting)

import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../../services/api';
import Icon from '../common/Icon';

const card = {
  padding: 16,
  borderRadius: 8,
  background: '#fff',
  border: '1px solid #e5e7eb',
  marginBottom: 16,
};

const sectionTitle = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 12,
  color: '#1f2937',
};

const statCard = {
  textAlign: 'center',
  padding: 16,
  background: '#f9fafb',
  borderRadius: 8,
};

const statValue = {
  fontSize: 28,
  fontWeight: 700,
  marginBottom: 4,
};

const statLabel = {
  fontSize: 14,
  color: '#6b7280',
};

export default function ApplicationSuccessAnalysis() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topMatches, setTopMatches] = useState([]);

  useEffect(() => {
    loadAnalysis();
  }, []);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      const [data, matchesResp] = await Promise.all([
        jobsAPI.getSuccessAnalysis(),
        jobsAPI.getBulkJobMatchScores({ limit: 3, sort_by: 'score', order: 'desc' }).catch(() => null),
      ]);
      setAnalysis(data);
      if (matchesResp) {
        const raw = matchesResp.data?.jobs || matchesResp.data?.results || [];
        const mapped = (Array.isArray(raw) ? raw : [])
          .slice(0, 3)
          .map((item) => ({
            id: item.job_id || item.id,
            title: item.title || item.job_title || 'Role',
            company: item.company_name || item.company || '',
            score: Math.round(Number(item.overall_score ?? item.match_score ?? item.score ?? 0)),
          }));
        setTopMatches(mapped);
      } else {
        setTopMatches([]);
      }
      setError('');
    } catch (err) {
      setError('Failed to load success analysis');
      console.error('Success analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <Icon name="refresh" style={{ marginRight: 8 }} /> Loading application success analysis...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: '#b91c1c', textAlign: 'center' }}>
        <Icon name="exclamationTriangle" style={{ marginRight: 8 }} /> {error}
      </div>
    );
  }

  if (!analysis?.overall_metrics) {
    return (
      <div style={{ padding: 20, color: '#6b7280', textAlign: 'center' }}>
        No application data available. Start tracking your applications to see success patterns!
      </div>
    );
  }

  const { overall_metrics, recommendations } = analysis;
  const pf = analysis.pattern_factors || {};
  const bestIndustries = Array.isArray(pf.best_industries)
    ? Array.from(new Map(pf.best_industries.map((i) => [i.industry || 'Unknown', i])).values()).slice(0, 2)
    : [];

  return (
    <div style={{ display: 'grid', gap: 16, padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Application Success Analysis</h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280' }}>
          Understand what drives your application success and optimize your job search strategy
        </p>
      </div>

      {/* Key Recommendations */}
      <div style={card}>
        <h2 style={sectionTitle}>
          <Icon name="lightbulb" style={{ marginRight: 8 }} /> Key Recommendations
        </h2>
        {recommendations && recommendations.length > 0 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background:
                    rec.type === 'high_impact' ? '#fef3c7' : rec.type === 'medium_impact' ? '#dbeafe' : '#f3f4f6',
                  border: `1px solid ${
                    rec.type === 'high_impact' ? '#fbbf24' : rec.type === 'medium_impact' ? '#60a5fa' : '#d1d5db'
                  }`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: rec.type === 'high_impact' ? '#fbbf24' : rec.type === 'medium_impact' ? '#60a5fa' : '#9ca3af',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {rec.type === 'high_impact' ? '!' : rec.type === 'medium_impact' ? '?' : 'i'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#1f2937' }}>
                    {rec.category?.toUpperCase?.() || 'RECOMMENDATION'}
                  </div>
                  <div style={{ fontSize: 14, color: '#4b5563' }}>{rec.message}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#6b7280', margin: 0 }}>No recommendations yet. Keep applying to generate insights.</p>
        )}
      </div>

      {/* Predicted Success */}
      {analysis.predicted_success && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="chartBar" style={{ marginRight: 8 }} /> Predicted Success
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'center' }}>
            <div style={{ textAlign: 'center', padding: 16, background: '#ecfeff', borderRadius: 12, border: '1px solid #a5f3fc' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#155e75' }}>Career Preparedness Score</div>
              <div style={{ fontSize: 42, fontWeight: 800, color: '#0e7490' }}>{analysis.predicted_success.score}</div>
              <div style={{ fontSize: 12, color: '#155e75', marginBottom: 6 }}>/ 100</div>
              <div style={{ fontSize: 11, lineHeight: '14px', color: '#0c4a6e' }}>Reflects readiness based on past outcomes and preparation.</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Top Drivers</div>
              {Array.isArray(analysis.predicted_success.drivers) && analysis.predicted_success.drivers.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, color: '#374151', fontSize: 14 }}>
                  {analysis.predicted_success.drivers.slice(0, 3).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: '#6b7280', fontSize: 14 }}>Not enough data for drivers yet.</div>
              )}
              {topMatches.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Top Matches</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {topMatches.map((m) => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px' }}>
                        <div style={{ fontSize: 13, color: '#374151' }}>
                          <span style={{ fontWeight: 600 }}>{m.title}</span>
                          {m.company ? <span style={{ color: '#6b7280' }}> • {m.company}</span> : null}
                        </div>
                        <div style={{ fontSize: 13, color: '#0ea5e9', fontWeight: 600 }}>{m.score}%</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#9ca3af' }}>Shown as success probability for top matches</div>
                </div>
              )}
              {Array.isArray(analysis.predicted_success.caveats) && analysis.predicted_success.caveats.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                  {analysis.predicted_success.caveats.join(' • ')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Personal Success Factors */}
      {analysis.pattern_factors && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="trendingUp" style={{ marginRight: 8 }} /> Personal Success Factors
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {/* Best Industries */}
            <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Best Industries</div>
              {bestIndustries.length > 0 ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  {bestIndustries.map((ind, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span>{ind.industry}</span>
                      <span style={{ fontWeight: 600, color: '#f59e0b' }}>{ind.offer_rate}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#6b7280', fontSize: 14 }}>No clear industry winners yet.</div>
              )}
            </div>

            {/* Best Timing */}
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Optimal Timing</div>
              {analysis.pattern_factors.best_timing ? (
                <div style={{ display: 'grid', gap: 6, fontSize: 14 }}>
                  <div>
                    <strong>Day:</strong>{' '}
                    {typeof analysis.pattern_factors.best_timing.day === 'object'
                      ? analysis.pattern_factors.best_timing.day?.day || '—'
                      : analysis.pattern_factors.best_timing.day || '—'}
                  </div>
                  <div>
                    <strong>Time:</strong>{' '}
                    {typeof analysis.pattern_factors.best_timing.time === 'object'
                      ? analysis.pattern_factors.best_timing.time?.time_slot || '—'
                      : analysis.pattern_factors.best_timing.time || '—'}
                  </div>
                </div>
              ) : (
                <div style={{ color: '#6b7280', fontSize: 14 }}>No timing patterns yet.</div>
              )}
            </div>

            {/* Key Skills */}
            <div style={{ padding: 12, background: '#eff6ff', borderRadius: 8, border: '1px solid #93c5fd' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Key Skills</div>
              {Array.isArray(analysis.pattern_factors.key_skills) && analysis.pattern_factors.key_skills.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {analysis.pattern_factors.key_skills.map((kw, i) => (
                    <span key={i} style={{ padding: '4px 10px', background: '#dbeafe', borderRadius: 999, fontSize: 13 }}>
                      {kw.keyword}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#6b7280', fontSize: 14 }}>No standout skills yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overall Metrics */}
      <div style={card}>
        <h2 style={sectionTitle}>
          <Icon name="chartBar" style={{ marginRight: 8 }} /> Overall Success Metrics
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div style={statCard}>
            <div style={{ ...statValue, color: '#3b82f6' }}>{overall_metrics.total_applications}</div>
            <div style={statLabel}>Total Applications</div>
          </div>
          <div style={statCard}>
            <div style={{ ...statValue, color: '#10b981' }}>{overall_metrics.response_rate}%</div>
            <div style={statLabel}>Response Rate</div>
          </div>
          <div style={statCard}>
            <div style={{ ...statValue, color: '#8b5cf6' }}>{overall_metrics.interview_rate}%</div>
            <div style={statLabel}>Interview Rate</div>
          </div>
          <div style={statCard}>
            <div style={{ ...statValue, color: '#f59e0b' }}>{overall_metrics.offer_rate}%</div>
            <div style={statLabel}>Offer Rate</div>
          </div>
          <div style={statCard}>
            <div style={{ ...statValue, color: '#6366f1' }}>{overall_metrics.avg_days_to_response}</div>
            <div style={statLabel}>Avg Days to Response</div>
          </div>
        </div>
      </div>

      {/* By Industry */}
      {analysis.by_industry && analysis.by_industry.length > 0 && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="briefcase" style={{ marginRight: 8 }} /> Success Rate by Industry
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Industry</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Applications</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Response Rate</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Interview Rate</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Offer Rate</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const seen = new Set();
                  const unique = [];
                  for (const item of analysis.by_industry) {
                    const key = item.industry || 'Unknown';
                    if (seen.has(key)) continue;
                    seen.add(key);
                    unique.push(item);
                    if (unique.length >= 5) break;
                  }
                  return unique;
                })().map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 12 }}>{item.industry}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>{item.applied_count}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{ color: item.response_rate > 30 ? '#10b981' : '#6b7280' }}>{item.response_rate}%</span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{ color: item.interview_rate > 20 ? '#8b5cf6' : '#6b7280' }}>{item.interview_rate}%</span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{ color: item.offer_rate > 5 ? '#f59e0b' : '#6b7280', fontWeight: 600 }}>{item.offer_rate}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By Company Size */}
      {analysis.by_company_size && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="building" style={{ marginRight: 8 }} /> Success Rate by Company Size
          </h2>
          {analysis.by_company_size.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Company Size</th>
                    <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Applications</th>
                    <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Response Rate</th>
                    <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Interview Rate</th>
                    <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Offer Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.by_company_size.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 12 }}>{item.company_size}</td>
                      <td style={{ padding: 12, textAlign: 'center' }}>{item.applied_count}</td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <span style={{ color: item.response_rate > 30 ? '#10b981' : '#6b7280' }}>{item.response_rate}%</span>
                      </td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <span style={{ color: item.interview_rate > 20 ? '#8b5cf6' : '#6b7280' }}>{item.interview_rate}%</span>
                      </td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <span style={{ color: item.offer_rate > 5 ? '#f59e0b' : '#6b7280', fontWeight: 600 }}>{item.offer_rate}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: '#6b7280', margin: 0 }}>No company size breakdown yet.</p>
          )}
        </div>
      )}

      {/* Sources & Methods */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
        {/* By Application Source */}
        {analysis.by_application_source && (
          <div style={card}>
            <h2 style={sectionTitle}>
              <Icon name="globe" style={{ marginRight: 8 }} /> By Application Source
            </h2>
            {analysis.by_application_source.length > 0 ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {analysis.by_application_source.slice(0, 5).map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 12,
                      background: '#f9fafb',
                      borderRadius: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{item.source}</div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                      <span style={{ color: '#10b981' }}>{item.response_rate}%</span>
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>{item.offer_rate}% offers</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280', margin: 0 }}>No application source data yet.</p>
            )}
          </div>
        )}

        {/* By Application Method */}
        {analysis.by_application_method && (
          <div style={card}>
            <h2 style={sectionTitle}>
              <Icon name="paperPlane" style={{ marginRight: 8 }} /> By Application Method
            </h2>
            {analysis.by_application_method.length > 0 ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {analysis.by_application_method.slice(0, 5).map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 12,
                      background: '#f9fafb',
                      borderRadius: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{item.method}</div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                      <span style={{ color: '#10b981' }}>{item.response_rate}%</span>
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>{item.offer_rate}% offers</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280', margin: 0 }}>No application method data yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Customization Impact */}
      {analysis.customization_impact && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="pencil" style={{ marginRight: 8 }} /> Impact of Customization
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {(() => {
              const resume = analysis.customization_impact.resume_customization || {};
              const cover = analysis.customization_impact.cover_letter_customization || {};
              const both = analysis.customization_impact.both_customized || {};
              const hasAny =
                resume.customized ||
                resume.not_customized ||
                cover.customized ||
                cover.not_customized ||
                both.both_customized ||
                both.neither_customized;
              if (!hasAny) return <p style={{ color: '#6b7280', margin: 0 }}>Not enough customization data yet.</p>;

              return (
                <>
                  <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Resume Customization</div>
                    <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Customized:</span>
                        <span style={{ fontWeight: 600, color: '#16a34a' }}>{resume.customized?.offer_rate ?? 0}% offer rate</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Not Customized:</span>
                        <span style={{ fontWeight: 600, color: '#dc2626' }}>{resume.not_customized?.offer_rate ?? 0}% offer rate</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: 16, background: '#eff6ff', borderRadius: 8, border: '1px solid #93c5fd' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Cover Letter Customization</div>
                    <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Customized:</span>
                        <span style={{ fontWeight: 600, color: '#2563eb' }}>{cover.customized?.offer_rate ?? 0}% offer rate</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Not Customized:</span>
                        <span style={{ fontWeight: 600, color: '#dc2626' }}>{cover.not_customized?.offer_rate ?? 0}% offer rate</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: 16, background: '#fefce8', borderRadius: 8, border: '1px solid #fde047' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Both Customized</div>
                    <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Both:</span>
                        <span style={{ fontWeight: 600, color: '#ca8a04' }}>{both.both_customized?.offer_rate ?? 0}% offer rate</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Neither:</span>
                        <span style={{ fontWeight: 600, color: '#dc2626' }}>{both.neither_customized?.offer_rate ?? 0}% offer rate</span>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Timing Patterns */}
      {analysis.timing_patterns && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="calendar" style={{ marginRight: 8 }} /> Optimal Application Timing
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {analysis.timing_patterns.best_day ? (
              <div style={{ padding: 16, background: '#faf5ff', borderRadius: 8, border: '1px solid #d8b4fe' }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Best Day to Apply</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>
                  {analysis.timing_patterns.best_day.day}
                </div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>
                  {analysis.timing_patterns.best_day.offer_rate}% offer rate ({analysis.timing_patterns.best_day.total_applications} applications)
                </div>
              </div>
            ) : (
              <div style={{ padding: 16, background: '#faf5ff', borderRadius: 8, border: '1px solid #d8b4fe' }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Best Day to Apply</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Not enough data yet.</div>
              </div>
            )}

            {analysis.timing_patterns.best_time ? (
              <div style={{ padding: 16, background: '#fef3c7', borderRadius: 8, border: '1px solid #fcd34d' }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Best Time to Apply</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706', marginBottom: 4, textTransform: 'capitalize' }}>
                  {analysis.timing_patterns.best_time.time_slot}
                </div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>
                  {analysis.timing_patterns.best_time.offer_rate}% offer rate ({analysis.timing_patterns.best_time.total_applications} applications)
                </div>
              </div>
            ) : (
              <div style={{ padding: 16, background: '#fef3c7', borderRadius: 8, border: '1px solid #fcd34d' }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Best Time to Apply</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Not enough data yet.</div>
              </div>
            )}
          </div>

          {analysis.timing_patterns.by_day_of_week && analysis.timing_patterns.by_day_of_week.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Success Rate by Day</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {analysis.timing_patterns.by_day_of_week.map((day, idx) => (
                  <div
                    key={idx}
                    style={{ display: 'flex', alignItems: 'center', padding: 8, background: '#f9fafb', borderRadius: 6 }}
                  >
                    <div style={{ width: 100, fontWeight: 500, fontSize: 13 }}>{day.day}</div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: `${Math.max(day.offer_rate, 1)}%`,
                          height: 20,
                          background: '#8b5cf6',
                          borderRadius: 4,
                          minWidth: 20,
                        }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{day.offer_rate}%</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>({day.total_applications} apps)</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12, color: '#6b7280' }}>Not enough data for day-of-week patterns yet.</div>
          )}
        </div>
      )}

      {/* Pattern Evolution (Trend Over Time) */}
      {Array.isArray(analysis.success_trend) && analysis.success_trend.length > 0 && (() => {
        const uniqueTrend = analysis.success_trend.reduce((acc, cur) => {
          const key = cur.month?.slice(0, 7);
          if (!key) return acc;
          if (!acc.find(x => x.month?.slice(0, 7) === key)) acc.push(cur);
          return acc;
        }, []);
        return (
          <div style={card}>
            <h2 style={sectionTitle}>
              <Icon name="trendingUp" style={{ marginRight: 8 }} /> Pattern Evolution
            </h2>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              Monthly response and offer rates (last {uniqueTrend.length} distinct months)
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {uniqueTrend.map((m, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                  <div style={{ fontSize: 13, color: '#374151', width: 110 }}>{m.month?.slice(0, 7) || '—'}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                    <span style={{ color: '#60a5fa' }}>Response: {m.response_rate}%</span>
                    <span style={{ color: '#f59e0b' }}>Offer: {m.offer_rate}%</span>
                    <span style={{ color: '#6b7280' }}>({m.total} apps)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Success Patterns & Strategy */}
      {(analysis.prep_correlations?.length > 0 ||
        (analysis.apply_response_patterns &&
          ((analysis.apply_response_patterns.apply_speed?.length || 0) > 0 ||
            (analysis.apply_response_patterns.response_speed?.length || 0) > 0)) ||
        (analysis.keyword_signals && analysis.keyword_signals.length > 0)) && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="trendingUp" style={{ marginRight: 8 }} /> Success Patterns & Strategy
          </h2>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Preparation impact</div>
            {analysis.prep_correlations && analysis.prep_correlations.length > 0 ? (
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Practice → interview success</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {analysis.prep_correlations.map((p, idx) => (
                      <div key={idx} style={{ padding: 10, background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                        <div style={{ fontWeight: 600 }}>{p.prep_type.replace('_', ' ')}</div>
                        <div style={{ fontSize: 13, color: '#6b7280', display: 'grid', gap: 2 }}>
                          <span>Sessions: {p.count}</span>
                          <span>Interview rate: {Math.round((p.interview_rate || 0) * 100)}%</span>
                          <span>Uplift: {Math.round((p.uplift || 0) * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#6b7280', fontSize: 13 }}>Not enough prep data yet.</div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Key Skills</div>
            {analysis.keyword_signals && analysis.keyword_signals.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {analysis.keyword_signals.slice(0, 8).map((kw, idx) => (
                  <div
                    key={idx}
                    style={{ padding: 10, borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb', textAlign: 'center' }}
                  >
                    <div style={{ fontWeight: 700, color: '#111827' }}>{kw.keyword}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#6b7280', fontSize: 13 }}>No clear key skills yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Pattern‑Based Recommendations derived from patterns */}
      {Array.isArray(analysis.pattern_recommendations) && analysis.pattern_recommendations.length > 0 && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="lightbulb" style={{ marginRight: 8 }} /> Pattern‑Based Recommendations
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {analysis.pattern_recommendations.map((rec, idx) => (
              <div key={idx} style={{ padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{rec.title}</div>
                <div style={{ fontSize: 14, color: '#4b5563' }}>{rec.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}




