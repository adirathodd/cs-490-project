import React from 'react';
const item = { padding: '8px 0', borderBottom: '1px solid #f3f4f6' };
const title = { fontSize: 13, color: '#111827', margin: 0 };
const meta = { fontSize: 12, color: '#6b7280', margin: 0 };

const ActivityTimeline = ({ events = [] }) => {
  return (
    <div className="dashboard-card" style={{ padding: 14 }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Recent Activity</div>
      {events.length === 0 && <div style={{ fontSize: 13, color: '#6b7280' }}>No recent activity</div>}
      {events.map((e, idx) => (
        <div key={idx} style={item}>
          <p style={title}>{e.title}</p>
          <p style={meta}>{e.time}</p>
        </div>
      ))}
    </div>
  );
};

export default ActivityTimeline;
