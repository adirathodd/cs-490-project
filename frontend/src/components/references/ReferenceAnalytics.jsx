import React, { useState, useEffect } from 'react';
import { referencesAPI } from '../../services/referencesAPI';
import Icon from '../common/Icon';

const ReferenceAnalytics = ({ onClose }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const data = await referencesAPI.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h2><Icon name="bar-chart-2" size="md" /> Reference Analytics</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="analytics-content" style={{ padding: '20px' }}>
          {/* Overview Stats */}
          <div className="stats-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '32px'
          }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#dbeafe' }}>
                <Icon name="users" size="md" style={{ color: '#2563eb' }} />
              </div>
              <div className="stat-value">{analytics?.total_references || 0}</div>
              <div className="stat-label">Total References</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#dcfce7' }}>
                <Icon name="check-circle" size="md" style={{ color: '#16a34a' }} />
              </div>
              <div className="stat-value">{analytics?.available_references || 0}</div>
              <div className="stat-label">Available</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#fef3c7' }}>
                <Icon name="clock" size="md" style={{ color: '#d97706' }} />
              </div>
              <div className="stat-value">{analytics?.pending_requests || 0}</div>
              <div className="stat-label">Pending Requests</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#fae8ff' }}>
                <Icon name="trending-up" size="md" style={{ color: '#a855f7' }} />
              </div>
              <div className="stat-value">{analytics?.success_rate || 0}%</div>
              <div className="stat-label">Success Rate</div>
            </div>
          </div>

          {/* Most Used References */}
          {analytics?.most_used_references && analytics.most_used_references.length > 0 && (
            <div className="analytics-section" style={{ marginBottom: '32px' }}>
              <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="star" size="sm" /> Most Used References
              </h3>
              <div className="references-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Company</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Times Used</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Last Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.most_used_references.map((ref, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px' }}>{ref.name}</td>
                        <td style={{ padding: '12px' }}>{ref.company}</td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                          {ref.times_used}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {ref.last_used_date 
                            ? new Date(ref.last_used_date).toLocaleDateString()
                            : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* References by Relationship Type */}
          {analytics?.references_by_relationship && Object.keys(analytics.references_by_relationship).length > 0 && (
            <div className="analytics-section" style={{ marginBottom: '32px' }}>
              <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="pie-chart" size="sm" /> References by Relationship Type
              </h3>
              <div className="relationship-chart" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px'
              }}>
                {Object.entries(analytics.references_by_relationship).map(([type, count]) => (
                  <div key={type} className="chart-item" style={{
                    padding: '16px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb', marginBottom: '4px' }}>
                      {count}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280', textTransform: 'capitalize' }}>
                      {type.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Requests by Status */}
          {analytics?.requests_by_status && Object.keys(analytics.requests_by_status).length > 0 && (
            <div className="analytics-section" style={{ marginBottom: '32px' }}>
              <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="activity" size="sm" /> Requests by Status
              </h3>
              <div className="status-chart" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '12px'
              }}>
                {Object.entries(analytics.requests_by_status).map(([status, count]) => {
                  const colors = {
                    pending: '#f59e0b',
                    sent: '#3b82f6',
                    completed: '#10b981',
                    declined: '#ef4444',
                    expired: '#6b7280',
                  };
                  const color = colors[status] || '#6b7280';
                  return (
                    <div key={status} className="chart-item" style={{
                      padding: '16px',
                      background: `${color}10`,
                      borderRadius: '8px',
                      textAlign: 'center',
                      border: `2px solid ${color}30`
                    }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color, marginBottom: '4px' }}>
                        {count}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6b7280', textTransform: 'capitalize' }}>
                        {status}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Check-ins */}
          {analytics?.upcoming_check_ins && analytics.upcoming_check_ins.length > 0 && (
            <div className="analytics-section">
              <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="calendar" size="sm" /> Upcoming Check-ins (Next 30 Days)
              </h3>
              <div className="checkins-list">
                {analytics.upcoming_check_ins.map((ref, idx) => (
                  <div key={idx} style={{
                    padding: '12px',
                    background: '#fef3c7',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <strong>{ref.name}</strong>
                      <span style={{ color: '#6b7280', marginLeft: '8px' }}>at {ref.company}</span>
                    </div>
                    <div style={{ 
                      padding: '4px 12px', 
                      background: '#fbbf24', 
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      {new Date(ref.next_check_in_date).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReferenceAnalytics;
