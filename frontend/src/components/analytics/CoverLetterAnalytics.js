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

export default function CoverLetterAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await jobsAPI.getAnalytics();
      setAnalytics(data);
      setError('');
    } catch (err) {
      setError('Failed to load cover letter analytics');
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <Icon name="refresh" style={{ marginRight: 8 }} />
      Loading cover letter analytics…
    </div>
  );
  
  if (error) return (
    <div style={{ padding: 20, color: '#b91c1c', textAlign: 'center' }}>
      <Icon name="exclamationTriangle" style={{ marginRight: 8 }} />
      {error}
    </div>
  );
  
  if (!analytics?.cover_letter_performance) return (
    <div style={{ padding: 20, color: '#6b7280', textAlign: 'center' }}>
      No cover letter analytics data available
    </div>
  );

  const { cover_letter_performance } = analytics;
  const { 
    total_cover_letters, 
    performance_by_tone, 
    best_performing_tone, 
    insights 
  } = cover_letter_performance;

  return (
    <div style={{ display: 'grid', gap: 16, padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
          Cover Letter Performance Analytics
        </h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280' }}>
          Track which cover letter styles and tones perform best for your applications
        </p>
      </div>

      {/* Overview Stats */}
      <div style={card}>
        <h2 style={sectionTitle}>
          <Icon name="document" style={{ marginRight: 8 }} />
          Overview
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div style={{ textAlign: 'center', padding: 16, background: '#f9fafb', borderRadius: 8 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#059669' }}>
              {total_cover_letters}
            </div>
            <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
              Total Cover Letters Tracked
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: '#f9fafb', borderRadius: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>
              {best_performing_tone ? best_performing_tone.toUpperCase() : 'N/A'}
            </div>
            <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
              Best Performing Tone
            </div>
          </div>
        </div>
      </div>

      {/* Performance by Tone */}
      {Object.keys(performance_by_tone || {}).length > 0 && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="chartBar" style={{ marginRight: 8 }} />
            Performance by Tone
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {Object.entries(performance_by_tone).map(([tone, stats]) => (
              <TonePerformanceCard 
                key={tone} 
                tone={tone} 
                stats={stats}
                isBest={tone === best_performing_tone}
              />
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {insights && insights.length > 0 && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="lightBulb" style={{ marginRight: 8 }} />
            Insights & Recommendations
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {insights.map((insight, index) => (
              <div 
                key={index}
                style={{ 
                  padding: 12, 
                  background: '#f0f9ff', 
                  border: '1px solid #0ea5e9', 
                  borderRadius: 6,
                  fontSize: 14,
                  color: '#0c4a6e'
                }}
              >
                <Icon name="info" style={{ marginRight: 8, verticalAlign: 'middle' }} />
                {insight}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Data State */}
      {total_cover_letters === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <Icon name="document" style={{ fontSize: 48, color: '#d1d5db', marginBottom: 16 }} />
          <h3 style={{ margin: 0, fontSize: 18, color: '#374151' }}>
            No Cover Letter Analytics Yet
          </h3>
          <p style={{ margin: '8px 0 16px', color: '#6b7280' }}>
            Start applying to jobs with AI-generated cover letters to see performance analytics
          </p>
          <button 
            className="primary-button"
            onClick={() => window.location.href = '/jobs'}
          >
            Browse Jobs
          </button>
        </div>
      )}
    </div>
  );
}

// Component for individual tone performance cards
function TonePerformanceCard({ tone, stats, isBest }) {
  const { total_applications, response_rate, interview_rate, offer_rate, responses, interviews, offers } = stats;

  const getPerformanceColor = (rate) => {
    if (rate >= 75) return '#059669';
    if (rate >= 50) return '#d97706';
    if (rate >= 25) return '#dc2626';
    return '#6b7280';
  };

  const cardStyle = {
    padding: 16,
    border: isBest ? '2px solid #059669' : '1px solid #e5e7eb',
    borderRadius: 8,
    background: isBest ? '#f0fdf4' : '#fff',
    position: 'relative'
  };

  return (
    <div style={cardStyle}>
      {isBest && (
        <div style={{
          position: 'absolute',
          top: -8,
          right: 12,
          background: '#059669',
          color: 'white',
          padding: '4px 8px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 600
        }}>
          🏆 Best Performing
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, textTransform: 'capitalize' }}>
            {tone} Tone
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>
            {total_applications} application{total_applications !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Performance Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: getPerformanceColor(response_rate) }}>
            {response_rate}%
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Response Rate</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{responses} responses</div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: getPerformanceColor(interview_rate) }}>
            {interview_rate}%
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Interview Rate</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{interviews} interviews</div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: getPerformanceColor(offer_rate) }}>
            {offer_rate}%
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Offer Rate</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{offers} offers</div>
        </div>
      </div>

      {/* Performance Bar */}
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Application Pipeline</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>
            {total_applications} → {responses} → {interviews} → {offers}
          </span>
        </div>
        <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
          <div 
            style={{ 
              height: '100%', 
              background: `linear-gradient(to right, 
                ${getPerformanceColor(response_rate)} 0%, 
                ${getPerformanceColor(response_rate)} ${response_rate}%, 
                #e5e7eb ${response_rate}%)`,
              borderRadius: 2 
            }} 
          />
        </div>
      </div>
    </div>
  );
}