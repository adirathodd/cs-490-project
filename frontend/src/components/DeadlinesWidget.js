import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../services/api';
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

  return (
    <div style={{ padding: 12 }}>
      <h4 style={{ margin: '0 0 8px 0' }}><Icon name="calendar" size="sm" /> Upcoming deadlines</h4>
      {loading ? <div style={{ color: '#666' }}>Loading…</div> : (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {items.length === 0 && <li style={{ color: '#666' }}>No upcoming deadlines</li>}
          {items.map((j) => (
            <li key={j.id} style={{ marginBottom: 6 }}>{j.application_deadline} — {j.title} @ {j.company_name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
