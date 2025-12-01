import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Icon from '../common/Icon';

const card = { padding: 12, borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb' };

export default function JobStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1); // use last completed month for stability
  });

  const load = async (opts = {}) => {
    setLoading(true);
    try {
      const params = {};
      const monthStr = opts.month || month.toISOString().slice(0, 7);
      params.month = monthStr;
      const s = await jobsAPI.getJobStats(params);
      setStats(s);
      setError('');
    } catch (e) {
      setError('Failed to load job statistics');
    } finally {
      setLoading(false);
    }
  };

  const { loading: authLoading } = useAuth();

  // Only load stats after auth/profile initialization completes. This avoids
  // an initial race where the server returns fallback yearly data before the
  // authenticated profile is recognized.
  useEffect(() => {
    if (!authLoading) {
      load({ month: month.toISOString().slice(0, 7) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, month]);

  const downloadCsv = async () => {
    try {
      const base = (process.env.REACT_APP_API_URL || '') + '/jobs/stats';
      const monthParam = `&month=${month.toISOString().slice(0, 7)}`;
      const url = `${base}?export=csv${monthParam}`;
      const token = localStorage.getItem('firebaseToken') || '';
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = 'job_statistics.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      setError('Failed to export CSV');
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading job statistics...</div>
  if (error) return <div style={{ padding: 20, color: '#b91c1c' }}>{error}</div>;
  if (!stats) return null;

  const counts = stats.counts || {};
  const monthly = stats.monthly_applications || [];
  const avgStage = stats.avg_time_in_stage_days || {};
  const respRate = stats.response_rate_percent;
  const adherence = stats.deadline_adherence || {};
  const tto = stats.time_to_offer || null;

  const daily = stats.daily_applications || null;

  // simple monthly bar heights
  const maxMonth = Math.max(1, ...monthly.map(m => m.count || 0));

  const prevMonth = () => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const newDate = new Date(y, m - 1, 1);
    setMonth(newDate);
  };
  const nextMonth = () => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const newDate = new Date(y, m + 1, 1);
    setMonth(newDate);
  };

  // Keyboard navigation: allow left/right arrows to navigate months when
  // the monthly chart area or its buttons are focused.
  const onKeyDownNav = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevMonth();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextMonth();
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12, padding: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {Object.keys(counts).map((k) => (
          <div key={k} style={{ ...card, minWidth: 120 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{k.replace('_', ' ').toUpperCase()}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{counts[k]}</div>
          </div>
        ))}
        <div style={{ ...card, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Response rate</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{respRate !== null && respRate !== undefined ? `${respRate}%` : '—'}</div>
        </div>
        <div style={{ ...card, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Deadline adherence</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{adherence.adhered ?? 0} of {adherence.total_with_deadline ?? 0} ({adherence.adherence_percent ?? '—'}%)</div>
        </div>
        <div style={{ ...card, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Time to offer</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{tto ? `${tto.avg_days}d (median ${tto.median_days}d)` : '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>
        <div style={{ ...card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>Monthly applications</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="calendar-nav" onClick={prevMonth} title="Previous month" aria-label="Previous month"><Icon name="chevronLeft" /></button>
              <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
              <button className="calendar-nav" onClick={nextMonth} title="Next month" aria-label="Next month"><Icon name="chevronRight" /></button>
              <button className="back-button" onClick={downloadCsv} title="Export CSV"><Icon name="download" /> Export CSV</button>
            </div>
          </div>
            <div
              style={{ display: 'flex', gap: 6, alignItems: 'end', height: 140, paddingTop: 12 }}
              tabIndex={0}
              role="region"
              onKeyDown={onKeyDownNav}
              aria-label="Monthly applications chart"
              aria-live="polite"
            >
              {/* Focusable chart container: ArrowLeft/ArrowRight move months */}
            {daily ? (
              // per-day bars for the selected month
              (() => {
                const maxDay = Math.max(1, ...daily.map(d => d.count || 0));
                return daily.map((d) => (
                  <div key={d.date} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ height: `${(d.count || 0) / maxDay * 100}%`, background: '#60a5fa', borderRadius: 4, margin: '0 4px' }} />
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>{new Date(d.date).getDate()}</div>
                  </div>
                ));
              })()
            ) : (
              // fallback: monthly bars (last 12 months)
              monthly.map((m) => (
                <div key={m.month} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: `${(m.count || 0) / maxMonth * 100}%`, background: '#60a5fa', borderRadius: 4, margin: '0 6px' }} />
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>{new Date(m.month).toLocaleString(undefined, { month: 'short', year: '2-digit' })}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ ...card }}>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>Average time in stages (days)</div>
          {Object.keys(avgStage).length === 0 && <div style={{ color: '#6b7280' }}>No data</div>}
          {Object.entries(avgStage).map(([st, days]) => (
            <div key={st} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #eef2ff' }}>
              <div style={{ color: '#374151' }}>{st.replace('_', ' ')}</div>
              <div style={{ fontWeight: 700 }}>{days}d</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card }}>
        <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>Deadline adherence detail</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#6b7280' }}>Total with deadline</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{adherence.total_with_deadline ?? 0}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#6b7280' }}>Adhered</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{adherence.adhered ?? 0}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#6b7280' }}>Missed</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{adherence.missed ?? 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
