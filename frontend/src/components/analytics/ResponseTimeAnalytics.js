import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../../services/api';
import Icon from '../common/Icon';

const card = { padding: 16, borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb', marginBottom: 16 };
const sectionTitle = { fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#1f2937' };
const statGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 };
const statItem = { padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb' };
const label = { fontSize: 12, color: '#6b7280' };
const value = { fontSize: 20, fontWeight: 700, color: '#111827' };

export default function ResponseTimeAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await jobsAPI.getResponseTimeAnalytics();
        if (mounted) setData(res);
        setError('');
      } catch (e) {
        setError('Failed to load response-time analytics');
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return <div style={card}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="loader" /><span>Loading response-time analytics…</span></div></div>;
  }
  if (error) {
    return <div style={card}><div style={{ color: '#b91c1c' }}>{error}</div></div>;
  }
  if (!data) {
    return <div style={card}><div>No data available.</div></div>;
  }

  const { summary = {}, trend = [], pending = [] } = data;

  return (
    <div>
      <div style={card}>
        <div style={sectionTitle}>Response-Time Overview</div>
        <div style={statGrid}>
          <div style={statItem}>
            <div style={label}>Applied</div>
            <div style={value}>{summary.applied_count || 0}</div>
          </div>
          <div style={statItem}>
            <div style={label}>Responded</div>
            <div style={value}>{summary.responded_count || 0}</div>
          </div>
          <div style={statItem}>
            <div style={label}>Response Rate</div>
            <div style={value}>{summary.response_rate_percent != null ? `${summary.response_rate_percent}%` : '—'}</div>
          </div>
          <div style={statItem}>
            <div style={label}>Avg Days to Response</div>
            <div style={value}>
              {summary.avg_days_to_response == null
                ? '—'
                : (Number(summary.avg_days_to_response) >= 1
                    ? `${summary.avg_days_to_response} days`
                    : `${(Number(summary.avg_days_to_response) * 24).toFixed(1)} hrs`)}
            </div>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={sectionTitle}>Fastest & Slowest</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div style={{ ...statItem, background: '#ecfdf5', borderColor: '#d1fae5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="zap" color="#059669" />
              <strong>Fastest Response</strong>
            </div>
            {summary.fastest ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600 }}>{summary.fastest.company_name} — {summary.fastest.title}</div>
                <div style={{ fontSize: 12, color: '#065f46' }}>
                  {Number(summary.fastest.days_to_response) >= 1
                    ? `${summary.fastest.days_to_response} days`
                    : `${(Number(summary.fastest.days_to_response) * 24).toFixed(1)} hrs`}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 8, color: '#6b7280' }}>No responded applications yet.</div>
            )}
          </div>
          <div style={{ ...statItem, background: '#fef3c7', borderColor: '#fde68a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="timer" color="#b45309" />
              <strong>Slowest Response</strong>
            </div>
            {summary.slowest ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600 }}>{summary.slowest.company_name} — {summary.slowest.title}</div>
                <div style={{ fontSize: 12, color: '#92400e' }}>
                  {Number(summary.slowest.days_to_response) >= 1
                    ? `${summary.slowest.days_to_response} days`
                    : `${(Number(summary.slowest.days_to_response) * 24).toFixed(1)} hrs`}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 8, color: '#6b7280' }}>No responded applications yet.</div>
            )}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={sectionTitle}>Monthly Trend</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          {trend.length === 0 ? (
            <div style={{ color: '#6b7280' }}>No trend data.</div>
          ) : (
            trend.map((row) => (
              <div key={row.month} style={{ ...statItem, background: '#f3f4f6' }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{row.month}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{row.avg_days_to_response} days</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{row.count} applications</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={card}>
        <div style={sectionTitle}>Pending Applications</div>
        {pending.length === 0 ? (
          <div style={{ color: '#6b7280' }}>No pending applications awaiting responses.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {pending.map((j) => (
              <div key={j.id} style={{ ...statItem, background: j.exceeds_avg ? '#fee2e2' : '#f9fafb', borderColor: j.exceeds_avg ? '#fecaca' : '#e5e7eb' }}>
                <div style={{ fontWeight: 600 }}>{j.company_name} — {j.title}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Applied: {j.created_at || '—'}</div>
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: '#374151' }}>Days since applied: </span>
                  <strong>{j.days_since_applied != null ? j.days_since_applied : '—'}</strong>
                  {j.exceeds_avg && <span style={{ marginLeft: 8, fontSize: 12, color: '#b91c1c' }}>Above avg</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
