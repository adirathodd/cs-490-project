import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Icon from '../common/Icon';

const card = { padding: 16, borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb', marginBottom: 16 };
const sectionTitle = { fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#1f2937' };

export default function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { loading: authLoading } = useAuth();

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Use the analytics endpoint that includes cover letter performance
      const data = await jobsAPI.getAnalytics();
      console.log('Analytics data received:', data);
      setAnalytics(data);
      setError('');
    } catch (e) {
      setError('Failed to load analytics data');
      console.error('Analytics error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadAnalytics();
    }
  }, [authLoading]);

  const exportAnalytics = async () => {
    try {
      const response = await fetch('/api/jobs/stats?export=csv', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('firebaseToken') || ''}`,
        },
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = 'analytics_report.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      setError('Failed to export analytics report');
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading analytics dashboard…</div>;
  if (error) return <div style={{ padding: 20, color: '#b91c1c' }}>{error}</div>;
  if (!analytics) return null;

  const { funnel_analytics, industry_benchmarks, response_trends, volume_patterns, goal_progress, insights_recommendations } = analytics;

  return (
    <div style={{ display: 'grid', gap: 16, padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Application Analytics Dashboard</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280' }}>
            Comprehensive insights into your job search performance
          </p>
        </div>
        <button 
          className="back-button" 
          onClick={exportAnalytics}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Icon name="download" />
          Export Report
        </button>
      </div>

      {/* Key Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>TOTAL APPLICATIONS</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{funnel_analytics?.total_applications || 0}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>SUCCESS RATE</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: funnel_analytics?.success_rate > 10 ? '#059669' : '#dc2626' }}>
            {funnel_analytics?.success_rate || 0}%
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>WEEKLY GOAL PROGRESS</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: goal_progress?.weekly_goal?.progress_percent >= 100 ? '#059669' : '#f59e0b' }}>
            {goal_progress?.weekly_goal?.current || 0}/{goal_progress?.weekly_goal?.target || 5}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            {goal_progress?.weekly_goal?.progress_percent || 0}% complete
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>RESPONSE RATE</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {funnel_analytics?.response_rate || 0}%
          </div>
        </div>
      </div>

      {/* Application Funnel */}
      <div style={card}>
        <h2 style={sectionTitle}>Application Funnel Analytics</h2>
        <ApplicationFunnel funnel={funnel_analytics} />
      </div>

      {/* Goal Progress */}
      <div style={{ display: 'grid', gridTemplateColumns: goal_progress?.monthly_goal ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div style={card}>
          <h2 style={sectionTitle}>Weekly Goal Progress</h2>
          <GoalProgress goal={goal_progress?.weekly_goal} />
        </div>
        {goal_progress?.monthly_goal && (
          <div style={card}>
            <h2 style={sectionTitle}>Monthly Goal Progress</h2>
            <GoalProgress goal={goal_progress?.monthly_goal} />
          </div>
        )}
      </div>

      {/* Industry Benchmarks */}
      <div style={card}>
        <h2 style={sectionTitle}>Performance vs Industry Benchmarks</h2>
        <BenchmarkComparison benchmarks={industry_benchmarks} analytics={analytics} />
      </div>

      {/* Response Rate Trends */}
      <div style={card}>
        <h2 style={sectionTitle}>Response Rate Trends</h2>
        <ResponseRateTrends trends={response_trends?.monthly_trends} />
      </div>

      {/* Volume Patterns */}
      <div style={card}>
        <h2 style={sectionTitle}>Application Volume Patterns</h2>
        <VolumePatterns patterns={volume_patterns} />
      </div>

      {/* Cover Letter Performance */}
      {analytics.cover_letter_performance && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="document" style={{ marginRight: 8 }} />
            Cover Letter Performance
          </h2>
          <CoverLetterPerformancePanel analytics={analytics.cover_letter_performance} />
        </div>
      )}

      {/* Insights & Recommendations */}
      <div style={card}>
        <h2 style={sectionTitle}>Insights & Recommendations</h2>
        <InsightsPanel insights={insights_recommendations} />
      </div>
    </div>
  );
}

// Application Funnel Component
function ApplicationFunnel({ funnel }) {
  if (!funnel) return <div>No funnel data available</div>;

  const counts = funnel.status_breakdown || {};
  
  // Use the same structure as JobStats - iterate over actual keys
  const stages = Object.keys(counts).map(key => ({
    name: key.replace('_', ' ').toUpperCase(),
    count: counts[key],
    color: getStageColor(key)
  }));

  // Helper function to assign colors to stages
  function getStageColor(stageName) {
    const colorMap = {
      'interested': '#e5e7eb',
      'applied': '#60a5fa',
      'phone_screen': '#34d399',
      'interview': '#fbbf24',
      'offer': '#10b981'
    };
    return colorMap[stageName] || '#9ca3af';
  }

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
        {stages.map((stage, index) => (
          <div key={stage.name} style={{ textAlign: 'center' }}>
            <div 
              style={{ 
                height: 80, 
                backgroundColor: stage.color, 
                borderRadius: 4,
                display: 'flex',
                alignItems: 'end',
                justifyContent: 'center',
                paddingBottom: 8,
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                position: 'relative',
                opacity: maxCount > 0 ? Math.max(0.3, stage.count / maxCount) : 0.3
              }}
            >
              {stage.count}
            </div>
            <div style={{ fontSize: 12, marginTop: 4, color: '#6b7280' }}>{stage.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Goal Progress Component
function GoalProgress({ goal }) {
  if (!goal) return <div>No goal data available</div>;

  const progress = goal.progress_percent || 0;
  const isCompleted = progress >= 100;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{goal.current}/{goal.target}</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{progress.toFixed(1)}%</span>
      </div>
      <div style={{ 
        width: '100%', 
        height: 8, 
        backgroundColor: '#e5e7eb', 
        borderRadius: 4, 
        overflow: 'hidden',
        marginBottom: 8
      }}>
        <div 
          style={{ 
            width: `${Math.min(100, progress)}%`, 
            height: '100%', 
            backgroundColor: isCompleted ? '#10b981' : progress > 70 ? '#f59e0b' : '#60a5fa',
            transition: 'width 0.3s ease'
          }} 
        />
      </div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>
        Period: {goal.period}
      </div>
    </div>
  );
}

// Benchmark Comparison Component
function BenchmarkComparison({ benchmarks, analytics }) {
  if (!benchmarks || !analytics) return <div>No benchmark data available</div>;

  const userSuccess = analytics.funnel_analytics?.success_rate || 0;
  const industryAvg = benchmarks.industry_standards?.conversion_rates?.overall_success_rate || 10;
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
      <div style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 6 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>YOUR SUCCESS RATE</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: userSuccess > industryAvg ? '#059669' : '#dc2626' }}>
          {userSuccess}%
        </div>
      </div>
      <div style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 6 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>INDUSTRY AVERAGE</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{industryAvg}%</div>
      </div>
      <div style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 6 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>RECOMMENDED WEEKLY APPS</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          {benchmarks.industry_standards?.application_volume?.applications_per_week || 5}
        </div>
      </div>
    </div>
  );
}

// Response Rate Trends Component
function ResponseRateTrends({ trends }) {
  if (!trends || !Array.isArray(trends) || trends.length === 0) {
    return <div>No trend data available</div>;
  }

  const maxRate = Math.max(...trends.map(t => t.response_rate || 0), 1);

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'end', height: 120, marginBottom: 16 }}>
        {trends.slice(-6).map((trend, index) => {
          // Parse the date properly
          let monthLabel = 'N/A';
          try {
            if (trend.month) {
              // Handle both ISO date strings and YYYY-MM format
              const dateStr = trend.month.includes('-01') ? trend.month : `${trend.month}-01`;
              const date = new Date(dateStr);
              if (!isNaN(date.getTime())) {
                monthLabel = date.toLocaleDateString('en', { month: 'short' });
              }
            }
          } catch (e) {
            console.warn('Date parsing error:', e);
          }

          return (
            <div key={trend.month || index} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div 
                  style={{ 
                    height: `${maxRate > 0 ? (trend.response_rate / maxRate) * 80 : 4}px`,
                    minHeight: '4px',
                    backgroundColor: trend.response_rate > 20 ? '#10b981' : '#60a5fa',
                    width: '20px',
                    borderRadius: '2px 2px 0 0'
                  }}
                />
                <div style={{ fontSize: 10, color: '#6b7280' }}>
                  {monthLabel}
                </div>
              </div>
              <div style={{ fontSize: 9, color: '#059669', marginTop: 2 }}>
                {trend.response_rate}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Volume Patterns Component  
function VolumePatterns({ patterns }) {
  // Always show a bar graph, even if no data - create empty data structure
  let dailyData = [];
  
  if (patterns && patterns.weekly_volume && patterns.weekly_volume.length > 0) {
    dailyData = patterns.weekly_volume.map(item => ({
      date: item.week,
      count: item.count
    }));
  } else {
    // Create empty data for the last 8 weeks if no data available
    const today = new Date();
    for (let i = 7; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - (i * 7));
      dailyData.push({
        date: date.toISOString().split('T')[0],
        count: 0
      });
    }
  }

  const maxApplications = Math.max(...dailyData.map(d => d.count || 0), 1);

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Applications by Day</h3>
      <div style={{ display: 'flex', gap: 2, alignItems: 'end', height: 80, marginBottom: 8 }}>
        {dailyData.map((day, index) => {
          const date = new Date(day.date);
          const dayOfMonth = date.getDate();
          
          return (
            <div key={day.date || index} style={{ flex: 1, textAlign: 'center' }}>
              <div 
                style={{ 
                  height: `${Math.max(4, (day.count / maxApplications) * 60)}px`,
                  backgroundColor: day.count > 0 ? '#60a5fa' : '#e5e7eb',
                  width: '100%',
                  borderRadius: '2px 2px 0 0',
                  display: 'flex',
                  alignItems: 'end',
                  justifyContent: 'center',
                  color: day.count > 0 ? '#fff' : 'transparent',
                  fontSize: 10,
                  fontWeight: 600,
                  paddingBottom: 2,
                }}
              >
                {day.count > 0 ? day.count : ''}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                {dayOfMonth}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Insights Panel Component
function InsightsPanel({ insights }) {
  if (!insights) return <div>No insights available</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#059669' }}>
          <Icon name="lightBulb" style={{ marginRight: 4 }} />
          Key Insights
        </h3>
        {insights.insights?.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {insights.insights.map((insight, index) => (
              <li key={index} style={{ fontSize: 13, marginBottom: 4, color: '#374151' }}>
                {insight}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Apply to more positions to generate insights
          </p>
        )}
      </div>
      
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#dc2626' }}>
          <Icon name="target" style={{ marginRight: 4 }} />
          Recommendations
        </h3>
        {insights.recommendations?.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {insights.recommendations.map((rec, index) => (
              <li key={index} style={{ fontSize: 13, marginBottom: 4, color: '#374151' }}>
                {rec}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Keep tracking applications for personalized recommendations
          </p>
        )}
      </div>
    </div>
  );
}

// Cover Letter Performance Panel Component
function CoverLetterPerformancePanel({ analytics }) {
  if (!analytics || !analytics.performance_by_tone) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
      No cover letter analytics data available. Start applying with AI-generated cover letters to see performance insights.
    </div>;
  }

  const { 
    total_cover_letters, 
    performance_by_tone, 
    best_performing_tone, 
    insights 
  } = analytics;

  const getPerformanceColor = (rate) => {
    if (rate >= 75) return '#059669';
    if (rate >= 50) return '#d97706';
    if (rate >= 25) return '#dc2626';
    return '#6b7280';
  };

  return (
    <div>
      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ textAlign: 'center', padding: 12, background: '#f9fafb', borderRadius: 6 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#059669' }}>
            {total_cover_letters}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Cover Letters Tracked</div>
        </div>
        <div style={{ textAlign: 'center', padding: 12, background: '#f9fafb', borderRadius: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626', textTransform: 'capitalize' }}>
            {best_performing_tone || 'N/A'}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Best Performing Tone</div>
        </div>
      </div>

      {/* Performance by Tone */}
      {Object.keys(performance_by_tone).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Performance by Tone</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {Object.entries(performance_by_tone).map(([tone, stats]) => (
              <div 
                key={tone}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: 12, 
                  border: tone === best_performing_tone ? '2px solid #059669' : '1px solid #e5e7eb',
                  borderRadius: 6,
                  background: tone === best_performing_tone ? '#f0fdf4' : '#fff'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize', marginBottom: 4 }}>
                    {tone}
                    {tone === best_performing_tone && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: '#059669' }}>🏆 Best</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {stats.total_applications} applications → {stats.responses} responses → {stats.interviews} interviews → {stats.offers} offers
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: getPerformanceColor(stats.response_rate) }}>
                      {stats.response_rate}%
                    </div>
                    <div style={{ color: '#6b7280' }}>Response</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: getPerformanceColor(stats.interview_rate) }}>
                      {stats.interview_rate}%
                    </div>
                    <div style={{ color: '#6b7280' }}>Interview</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: getPerformanceColor(stats.offer_rate) }}>
                      {stats.offer_rate}%
                    </div>
                    <div style={{ color: '#6b7280' }}>Offer</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {insights && insights.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Insights</h4>
          {insights.map((insight, index) => (
            <div 
              key={index}
              style={{ 
                padding: 8, 
                background: '#f0f9ff', 
                border: '1px solid #0ea5e9', 
                borderRadius: 4,
                fontSize: 13,
                color: '#0c4a6e',
                marginBottom: 6
              }}
            >
              💡 {insight}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}