// UC-098: Interview Performance Tracking
import React, { useEffect, useState } from 'react';
import { interviewsAPI } from '../../services/api';
import Icon from '../common/Icon';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

const card = {
  padding: 20,
  borderRadius: 8,
  background: '#fff',
  border: '1px solid #e5e7eb',
  marginBottom: 20,
};

const sectionTitle = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 16,
  color: '#1f2937',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const statCard = {
  padding: 16,
  borderRadius: 8,
  background: '#f9fafb',
  textAlign: 'center',
};

const statValue = {
  fontSize: 32,
  fontWeight: 700,
  marginBottom: 4,
};

const statLabel = {
  fontSize: 14,
  color: '#6b7280',
};

export default function InterviewPerformanceTracking() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAnalysis();
  }, []);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      const data = await interviewsAPI.getPerformanceTracking();
      setAnalysis(data);
      setError('');
    } catch (err) {
      setError('Failed to load interview performance tracking');
      console.error('Performance tracking error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <Icon name="refresh" style={{ marginRight: 8 }} />
        Loading interview performance tracking…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: '#b91c1c', textAlign: 'center' }}>
        <Icon name="exclamationTriangle" style={{ marginRight: 8 }} />
        {error}
      </div>
    );
  }

  if (!analysis) {
    return (
      <div style={{ padding: 20, color: '#6b7280', textAlign: 'center' }}>
        No interview data available. Start tracking your interviews to see performance insights!
      </div>
    );
  }

  const {
    conversion_rates_over_time,
    performance_by_format,
    mock_to_real_improvement,
    performance_by_industry,
    feedback_themes,
    confidence_progression,
    coaching_recommendations,
    benchmark_comparison,
  } = analysis;

  // Prepare chart data
  const conversionChartData = conversion_rates_over_time?.filter(item => item.period).map((item) => ({
    period: new Date(item.period).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    'Conversion Rate': item.conversion_rate,
    'Rejection Rate': item.rejection_rate || 0,
  })) || [];

  const formatChartData = performance_by_format?.map((item) => ({
    format: item.format_label,
    'Conversion Rate': item.conversion_rate,
    'Avg Confidence': (item.avg_confidence || 0) * 20, // Scale to 100 for visual comparison
  })) || [];

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>
          Interview Performance Tracking
        </h1>
        <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 16 }}>
          Track your improvement, identify patterns, and optimize your interview performance
        </p>
      </div>

      {/* Coaching Recommendations */}
      {coaching_recommendations && coaching_recommendations.length > 0 && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="lightbulb" />
            Personalized Coaching Recommendations
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {coaching_recommendations.map((rec, idx) => (
              <div
                key={idx}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: rec.priority === 'high' ? '#fef3c7' : '#dbeafe',
                  border: `2px solid ${rec.priority === 'high' ? '#fbbf24' : '#60a5fa'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: rec.priority === 'high' ? '#fbbf24' : '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {rec.priority === 'high' ? '!' : 'i'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' }}>
                      {rec.area} • {rec.priority} priority
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', marginBottom: 6 }}>
                      {rec.recommendation}
                    </div>
                    {rec.action_items && rec.action_items.length > 0 && (
                      <div style={{ fontSize: 14, color: '#4b5563', marginTop: 8 }}>
                        <strong>Action Items:</strong>
                        <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                          {rec.action_items.map((item, i) => (
                            <li key={i} style={{ marginBottom: 4 }}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Benchmark Comparison */}
      {benchmark_comparison && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="chartBar" />
            Performance Benchmarking
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            {Object.entries(benchmark_comparison).map(([metric, data]) => {
              const userValue = data.user || 0;
              const average = data.average || 0;
              const topPerformers = data.top_performers || 0;
              
              let color = '#6b7280';
              let status = 'needs improvement';
              if (userValue >= topPerformers) {
                color = '#10b981';
                status = 'excellent';
              } else if (userValue >= average) {
                color = '#3b82f6';
                status = 'good';
              } else if (userValue >= average * 0.7) {
                color = '#f59e0b';
                status = 'fair';
              } else {
                color = '#ef4444';
              }

              return (
                <div key={metric} style={{ ...statCard, border: `2px solid ${color}` }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'capitalize' }}>
                    {metric.replace(/_/g, ' ')}
                  </div>
                  <div style={{ ...statValue, color, fontSize: 28 }}>
                    {userValue}{metric === 'conversion_rate' ? '%' : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
                    Avg: {average}{metric === 'conversion_rate' ? '%' : ''} | Top: {topPerformers}{metric === 'conversion_rate' ? '%' : ''}
                  </div>
                  <div style={{ fontSize: 13, color: '#4b5563', fontWeight: 500, textTransform: 'capitalize' }}>
                    {status}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Conversion Rates Over Time */}
      {conversionChartData.length > 0 && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="trendingUp" />
            Interview Success Rate Trends
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={conversionChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Conversion Rate" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="Rejection Rate" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Performance by Format */}
      {formatChartData.length > 0 && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="video" />
            Performance by Interview Format
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={formatChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="format" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Conversion Rate" fill="#3b82f6" />
              <Bar dataKey="Avg Confidence" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 16 }}>
            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: 12, textAlign: 'left' }}>Format</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>Interviews</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>Conversion Rate</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>Avg Confidence</th>
                </tr>
              </thead>
              <tbody>
                {performance_by_format.map((format, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 12 }}>{format.format_label}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>{format.total_interviews}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{ color: format.conversion_rate > 20 ? '#10b981' : '#6b7280', fontWeight: 600 }}>
                        {format.conversion_rate}%
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>{format.avg_confidence}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mock to Real Improvement */}
      {mock_to_real_improvement && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="academicCap" />
            Practice to Performance Journey
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={statCard}>
              <div style={{ ...statValue, color: '#8b5cf6' }}>
                {mock_to_real_improvement.total_mock_sessions}
              </div>
              <div style={statLabel}>Mock Sessions</div>
            </div>
            <div style={statCard}>
              <div style={{ ...statValue, color: '#3b82f6' }}>
                {mock_to_real_improvement.total_real_interviews}
              </div>
              <div style={statLabel}>Real Interviews</div>
            </div>
            <div style={statCard}>
              <div style={{ ...statValue, color: '#f59e0b' }}>
                {mock_to_real_improvement.mock_average_score}
              </div>
              <div style={statLabel}>Avg Mock Score</div>
            </div>
            <div style={statCard}>
              <div style={{ ...statValue, color: '#10b981' }}>
                {mock_to_real_improvement.real_average_score}
              </div>
              <div style={statLabel}>Avg Real Score</div>
            </div>
          </div>
          {mock_to_real_improvement.improvement_trend !== 0 && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: mock_to_real_improvement.improvement_trend > 0 ? '#d1fae5' : '#fee2e2',
                textAlign: 'center',
                fontSize: 14,
              }}
            >
              <strong>Trend:</strong> {mock_to_real_improvement.improvement_trend > 0 ? '↑' : '↓'}{' '}
              {Math.abs(mock_to_real_improvement.improvement_trend)}% improvement in mock sessions
            </div>
          )}
        </div>
      )}

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
        {/* Performance by Industry */}
        {performance_by_industry && performance_by_industry.length > 0 && (
          <div style={card}>
            <h2 style={sectionTitle}>
              <Icon name="briefcase" />
              Performance by Industry
            </h2>
            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: 12, textAlign: 'left' }}>Industry</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>Rate</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {performance_by_industry.slice(0, 5).map((industry, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 12 }}>{industry.industry}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{ color: industry.conversion_rate > 20 ? '#10b981' : '#6b7280', fontWeight: 600 }}>
                        {industry.conversion_rate}%
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>{industry.avg_confidence}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Feedback Themes */}
        {feedback_themes && (
          <div style={card}>
            <h2 style={sectionTitle}>
              <Icon name="chatAlt2" />
              Common Feedback Themes
            </h2>
            {feedback_themes.improvement_areas && feedback_themes.improvement_areas.length > 0 ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', marginBottom: 12 }}>
                  Areas for Improvement
                </div>
                {feedback_themes.improvement_areas.map((area, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 12,
                      marginBottom: 8,
                      borderRadius: 6,
                      background: '#fef3c7',
                      border: '1px solid #fbbf24',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{area.area}</span>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>{area.percentage}% of feedback</span>
                    </div>
                  </div>
                ))}
                {feedback_themes.positive_themes && feedback_themes.positive_themes.length > 0 && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', marginTop: 16, marginBottom: 12 }}>
                      Positive Strengths
                    </div>
                    {feedback_themes.positive_themes.map((theme, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 12,
                          marginBottom: 8,
                          borderRadius: 6,
                          background: '#d1fae5',
                          border: '1px solid #10b981',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{theme.theme}</span>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
                Complete mock interviews to start tracking feedback themes
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confidence Progression */}
      {confidence_progression && confidence_progression.confidence_progression && confidence_progression.confidence_progression.length > 0 && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="sparkles" />
            Confidence Progression
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={statCard}>
              <div style={{ ...statValue, color: '#3b82f6' }}>
                {confidence_progression.current_avg_confidence}
              </div>
              <div style={statLabel}>Current Avg (Last 30 Days)</div>
            </div>
            <div style={statCard}>
              <div style={{ ...statValue, color: '#6b7280' }}>
                {confidence_progression.previous_avg_confidence}
              </div>
              <div style={statLabel}>Previous Avg (30-60 Days)</div>
            </div>
            <div style={statCard}>
              <div
                style={{
                  ...statValue,
                  color: confidence_progression.trend_percentage > 0 ? '#10b981' : '#ef4444',
                }}
              >
                {confidence_progression.trend_percentage > 0 ? '+' : ''}
                {confidence_progression.trend_percentage}%
              </div>
              <div style={statLabel}>Trend</div>
            </div>
          </div>
          <div style={{ padding: 16, background: '#f9fafb', borderRadius: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Recent Confidence Levels</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {confidence_progression.confidence_progression.slice(-10).reverse().map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#fff',
                    borderRadius: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>{item.date}</span>
                    <span style={{ fontSize: 13, color: '#374151', textTransform: 'capitalize' }}>
                      {item.interview_type.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{'⭐'.repeat(item.confidence_level)}</span>
                    {(() => {
                      const normalizedOutcome = (item.outcome || 'pending').toLowerCase();
                      const positiveOutcomes = new Set(['excellent', 'good', 'offer_received']);
                      const neutralOutcomes = new Set(['pending', 'average', 'withdrew']);
                      let background = '#fee2e2';
                      let color = '#991b1b';
                      if (positiveOutcomes.has(normalizedOutcome)) {
                        background = '#d1fae5';
                        color = '#065f46';
                      } else if (neutralOutcomes.has(normalizedOutcome)) {
                        background = '#f3f4f6';
                        color = '#4b5563';
                      }
                      const label = (item.outcome || 'pending').replace('_', ' ');
                      return (
                        <span
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background,
                            color,
                            textTransform: 'capitalize',
                          }}
                        >
                          {label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
