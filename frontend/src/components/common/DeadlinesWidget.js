import React, { useEffect, useState, useMemo } from 'react';
import { jobsAPI } from '../../services/api';
import Icon from './Icon';

export default function DeadlinesWidget() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await jobsAPI.getUpcomingDeadlines(5);
        if (mounted) setItems(data || []);
      } catch (e) {}
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const daysDiff = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const urgencyColor = (diff) => {
    if (diff == null) return '#94a3b8';
    if (diff < 0) return '#dc2626';
    if (diff <= 3) return '#f59e0b';
    return '#059669';
  };

  // Ensure we only show up to 5 upcoming (non-overdue) deadlines and skip overdue ones entirely
  const upcomingItems = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return (items || [])
      .filter((j) => {
        if (!j.application_deadline) return false;
        const d = new Date(j.application_deadline);
        const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff >= 0; // exclude overdue
      })
      .slice(0, 5);
  }, [items]);

  return (
    <div className="dashboard-card deadlines-widget" role="region" aria-label="Upcoming application deadlines">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, width: '100%' }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="calendar" size="sm" /> Upcoming application deadlines</h4>
        <div className="widget-badge" aria-hidden style={{ background: '#6366f1', color: '#fff', padding: '4px 8px', borderRadius: 20, fontSize: 12 }}>{upcomingItems.length}</div>
      </div>

      <div style={{ marginTop: 10 }}>
        {loading ? (
          <div style={{ color: '#666' }}>Loading…</div>
        ) : (
          <ul className="deadlines-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {upcomingItems.length === 0 && <li className="deadlines-empty" style={{ color: '#666' }}>No upcoming deadlines</li>}
            {upcomingItems.map((j) => {
              const diff = daysDiff(j.application_deadline);
              return (
                <li key={j.id} className="deadlines-item" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed #eef2ff' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 4, background: urgencyColor(diff), flexShrink: 0 }} aria-hidden />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{j.title}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{j.company_name} • {j.application_deadline} {diff != null ? (diff < 0 ? `(Overdue ${Math.abs(diff)}d)` : `(${diff}d left)`) : ''}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
