import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../../services/api';
import Icon from '../common/Icon';

export default function JobsCalendar() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await jobsAPI.getUpcomingDeadlines(50);
      // group by date
      const groups = {};
      (data || []).forEach((j) => {
        const d = j.application_deadline || 'No deadline';
        if (!groups[d]) groups[d] = [];
        groups[d].push(j);
      });
      const list = Object.keys(groups).sort().map((d) => ({ date: d, jobs: groups[d] }));
      setItems(list);
      setError('');
    } catch (e) {
      setError('Failed to load deadlines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 12 }}>
      <h2><Icon name="calendar" size="sm" /> Deadlines</h2>
      {loading && <p>Loading…</p>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {!loading && items.length === 0 && <p>No upcoming deadlines</p>}
      <div>
        {items.map((g) => (
          <div key={g.date} style={{ marginBottom: 12 }}>
            <h4 style={{ marginBottom: 6 }}>{g.date}</h4>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {g.jobs.map((j) => {
                const isApplied = j.status && j.status !== 'interested';
                const pillStyle = isApplied
                  ? { background: '#e5e7eb', color: '#374151', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }
                  : { background: '#60a5fa', color: '#ffffff', padding: '4px 8px', borderRadius: 6, display: 'inline-block' };
                return (
                  <li key={j.id} style={{ marginBottom: 6 }}>
                    <span style={pillStyle}>{j.title}</span>
                    <span style={{ marginLeft: 8, color: '#6b7280' }}>@ {j.company_name} {j.application_deadline ? `(${j.application_deadline})` : ''}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
