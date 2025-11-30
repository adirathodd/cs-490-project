// UC-097: Application Success Rate Analysis
import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../../services/api';
import Icon from '../common/Icon';

const card = { 
  padding: 16, 
  borderRadius: 8, 
  background: '#fff', 
  border: '1px solid #e5e7eb', 
  marginBottom: 16 
};

const sectionTitle = { 
  fontSize: 18, 
  fontWeight: 700, 
  marginBottom: 12, 
  color: '#1f2937' 
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

  useEffect(() => {
    loadAnalysis();
  }, []);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      const data = await jobsAPI.getSuccessAnalysis();
      setAnalysis(data);
      setError('');
    } catch (err) {
      setError('Failed to load success analysis');
      console.error('Success analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <Icon name="refresh" style={{ marginRight: 8 }} />
      Loading application success analysis…
    </div>
  );
  
  if (error) return (
    <div style={{ padding: 20, color: '#b91c1c', textAlign: 'center' }}>
      <Icon name="exclamationTriangle" style={{ marginRight: 8 }} />
      {error}
    </div>
  );
  
  if (!analysis?.overall_metrics) return (
    <div style={{ padding: 20, color: '#6b7280', textAlign: 'center' }}>
      No application data available. Start tracking your applications to see success patterns!
    </div>
  );

  const { overall_metrics, recommendations } = analysis;

  return (
    <div style={{ display: 'grid', gap: 16, padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
          Application Success Analysis
        </h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280' }}>
          Understand what drives your application success and optimize your job search strategy
        </p>
      </div>

      {/* Key Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="lightbulb" style={{ marginRight: 8 }} />
            Key Recommendations
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {recommendations.map((rec, idx) => (
              <div 
                key={idx}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: rec.type === 'high_impact' ? '#fef3c7' : rec.type === 'medium_impact' ? '#dbeafe' : '#f3f4f6',
                  border: `1px solid ${rec.type === 'high_impact' ? '#fbbf24' : rec.type === 'medium_impact' ? '#60a5fa' : '#d1d5db'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{
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
                }}>
                  {rec.type === 'high_impact' ? '!' : rec.type === 'medium_impact' ? '↑' : 'i'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#1f2937' }}>
                    {rec.category.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 14, color: '#4b5563' }}>
                    {rec.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overall Metrics */}
      <div style={card}>
        <h2 style={sectionTitle}>
          <Icon name="chartBar" style={{ marginRight: 8 }} />
          Overall Success Metrics
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div style={statCard}>
            <div style={{ ...statValue, color: '#3b82f6' }}>
              {overall_metrics.total_applications}
            </div>
            <div style={statLabel}>Total Applications</div>
          </div>
          <div style={statCard}>
            <div style={{ ...statValue, color: '#10b981' }}>
              {overall_metrics.response_rate}%
            </div>
            <div style={statLabel}>Response Rate</div>
          </div>
          <div style={statCard}>
            <div style={{ ...statValue, color: '#8b5cf6' }}>
              {overall_metrics.interview_rate}%
            </div>
            <div style={statLabel}>Interview Rate</div>
          </div>
          <div style={statCard}>
            <div style={{ ...statValue, color: '#f59e0b' }}>
              {overall_metrics.offer_rate}%
            </div>
            <div style={statLabel}>Offer Rate</div>
          </div>
          <div style={statCard}>
            <div style={{ ...statValue, color: '#6366f1' }}>
              {overall_metrics.avg_days_to_response}
            </div>
            <div style={statLabel}>Avg Days to Response</div>
          </div>
        </div>
      </div>

      {/* By Industry */}
      {analysis.by_industry && analysis.by_industry.length > 0 && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="briefcase" style={{ marginRight: 8 }} />
            Success Rate by Industry
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
                {analysis.by_industry.slice(0, 5).map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 12 }}>{item.industry}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>{item.applied_count}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{ color: item.response_rate > 30 ? '#10b981' : '#6b7280' }}>
                        {item.response_rate}%
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{ color: item.interview_rate > 20 ? '#8b5cf6' : '#6b7280' }}>
                        {item.interview_rate}%
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{ color: item.offer_rate > 5 ? '#f59e0b' : '#6b7280', fontWeight: 600 }}>
                        {item.offer_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By Company Size */}
      {analysis.by_company_size && analysis.by_company_size.length > 0 && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="building" style={{ marginRight: 8 }} />
            Success Rate by Company Size
          </h2>
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
                      <span style={{ color: item.response_rate > 30 ? '#10b981' : '#6b7280' }}>
                        {item.response_rate}%
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{ color: item.interview_rate > 20 ? '#8b5cf6' : '#6b7280' }}>
                        {item.interview_rate}%
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{ color: item.offer_rate > 5 ? '#f59e0b' : '#6b7280', fontWeight: 600 }}>
                        {item.offer_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Two-column layout for sources and methods */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
        
        {/* By Application Source */}
        {analysis.by_application_source && analysis.by_application_source.length > 0 && (
          <div style={card}>
            <h2 style={sectionTitle}>
              <Icon name="globe" style={{ marginRight: 8 }} />
              By Application Source
            </h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {analysis.by_application_source.slice(0, 5).map((item, idx) => (
                <div key={idx} style={{ 
                  padding: 12, 
                  background: '#f9fafb', 
                  borderRadius: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ fontWeight: 500 }}>{item.source}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                    <span style={{ color: '#10b981' }}>{item.response_rate}%</span>
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>{item.offer_rate}% offers</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By Application Method */}
        {analysis.by_application_method && analysis.by_application_method.length > 0 && (
          <div style={card}>
            <h2 style={sectionTitle}>
              <Icon name="paperPlane" style={{ marginRight: 8 }} />
              By Application Method
            </h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {analysis.by_application_method.slice(0, 5).map((item, idx) => (
                <div key={idx} style={{ 
                  padding: 12, 
                  background: '#f9fafb', 
                  borderRadius: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ fontWeight: 500 }}>{item.method}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                    <span style={{ color: '#10b981' }}>{item.response_rate}%</span>
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>{item.offer_rate}% offers</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Customization Impact */}
      {analysis.customization_impact && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="pencil" style={{ marginRight: 8 }} />
            Impact of Customization
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            
            {/* Resume Customization */}
            {analysis.customization_impact.resume_customization?.customized && (
              <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Resume Customization</div>
                <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>✅ Customized:</span>
                    <span style={{ fontWeight: 600, color: '#16a34a' }}>
                      {analysis.customization_impact.resume_customization.customized.offer_rate}% offer rate
                    </span>
                  </div>
                  {analysis.customization_impact.resume_customization.not_customized && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>❌ Not Customized:</span>
                      <span style={{ fontWeight: 600, color: '#dc2626' }}>
                        {analysis.customization_impact.resume_customization.not_customized.offer_rate}% offer rate
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cover Letter Customization */}
            {analysis.customization_impact.cover_letter_customization?.customized && (
              <div style={{ padding: 16, background: '#eff6ff', borderRadius: 8, border: '1px solid #93c5fd' }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Cover Letter Customization</div>
                <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>✅ Customized:</span>
                    <span style={{ fontWeight: 600, color: '#2563eb' }}>
                      {analysis.customization_impact.cover_letter_customization.customized.offer_rate}% offer rate
                    </span>
                  </div>
                  {analysis.customization_impact.cover_letter_customization.not_customized && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>❌ Not Customized:</span>
                      <span style={{ fontWeight: 600, color: '#dc2626' }}>
                        {analysis.customization_impact.cover_letter_customization.not_customized.offer_rate}% offer rate
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Both Customized */}
            {analysis.customization_impact.both_customized?.both_customized && (
              <div style={{ padding: 16, background: '#fefce8', borderRadius: 8, border: '1px solid #fde047' }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Both Customized</div>
                <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>✅ Both:</span>
                    <span style={{ fontWeight: 600, color: '#ca8a04' }}>
                      {analysis.customization_impact.both_customized.both_customized.offer_rate}% offer rate
                    </span>
                  </div>
                  {analysis.customization_impact.both_customized.neither_customized && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>❌ Neither:</span>
                      <span style={{ fontWeight: 600, color: '#dc2626' }}>
                        {analysis.customization_impact.both_customized.neither_customized.offer_rate}% offer rate
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timing Patterns */}
      {analysis.timing_patterns?.best_day && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="calendar" style={{ marginRight: 8 }} />
            Optimal Application Timing
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            
            {/* Best Day */}
            {analysis.timing_patterns.best_day && (
              <div style={{ padding: 16, background: '#faf5ff', borderRadius: 8, border: '1px solid #d8b4fe' }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  🗓️ Best Day to Apply
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>
                  {analysis.timing_patterns.best_day.day}
                </div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>
                  {analysis.timing_patterns.best_day.offer_rate}% offer rate 
                  ({analysis.timing_patterns.best_day.total_applications} applications)
                </div>
              </div>
            )}

            {/* Best Time */}
            {analysis.timing_patterns.best_time && (
              <div style={{ padding: 16, background: '#fef3c7', borderRadius: 8, border: '1px solid #fcd34d' }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  🕐 Best Time to Apply
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706', marginBottom: 4, textTransform: 'capitalize' }}>
                  {analysis.timing_patterns.best_time.time_slot}
                </div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>
                  {analysis.timing_patterns.best_time.offer_rate}% offer rate 
                  ({analysis.timing_patterns.best_time.total_applications} applications)
                </div>
              </div>
            )}
          </div>

          {/* Day of Week Breakdown */}
          {analysis.timing_patterns.by_day_of_week && analysis.timing_patterns.by_day_of_week.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Success Rate by Day</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {analysis.timing_patterns.by_day_of_week.map((day, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: 8,
                    background: '#f9fafb',
                    borderRadius: 6,
                  }}>
                    <div style={{ width: 100, fontWeight: 500, fontSize: 13 }}>{day.day}</div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ 
                        width: `${day.offer_rate * 10}%`, 
                        height: 20, 
                        background: '#8b5cf6',
                        borderRadius: 4,
                        minWidth: 20,
                      }}></div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{day.offer_rate}%</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                      ({day.total_applications} apps)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
