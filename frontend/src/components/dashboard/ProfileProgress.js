import React from 'react';

const container = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 };
const label = { fontSize: 12, color: '#6b7280', marginBottom: 6 };
const barWrap = { width: '100%', height: 10, background: '#e5e7eb', borderRadius: 6, overflow: 'hidden' };

const bar = (pct) => ({ width: `${pct}%`, height: '100%', background: '#2563eb', transition: 'width .3s ease' });

const ProfileProgress = ({ percent = 0, suggestions = [] }) => {
  return (
    <div style={container}>
      <div style={label}>Profile Completion</div>
      <div style={barWrap}><div style={bar(Math.min(100, Math.max(0, percent)))} /></div>
      {suggestions?.length > 0 && (
        <ul style={{ marginTop: 10, paddingLeft: 18, color: '#374151', fontSize: 13 }}>
          {suggestions.map((s, i) => (<li key={i}>{s}</li>))}
        </ul>
      )}
    </div>
  );
};

export default ProfileProgress;

