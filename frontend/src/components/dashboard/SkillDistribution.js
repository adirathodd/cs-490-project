import React from 'react';
const row = { display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' };
const label = { width: 140, fontSize: 12, color: '#374151' };
const segmentsWrap = { flex: 1, display: 'flex', gap: 4, minWidth: 200 };
const seg = (filled, idx, total) => ({
  flex: 1,
  height: 14,
  background: filled ? '#10b981' : '#e5e7eb',
  border: '1px solid #d1d5db',
  borderRadius: idx === 0 ? '6px 0 0 6px' : idx === total - 1 ? '0 6px 6px 0' : 0,
});
const levelText = { width: 80, textAlign: 'right', fontSize: 11, color: '#6b7280' };

const levelToSegments = (lvl, value) => {
  const l = (lvl || '').toLowerCase();
  if (l) {
    switch (l) {
      case 'beginner': return 1;
      case 'intermediate': return 2;
      case 'advanced': return 3;
      case 'expert': return 4;
      default: break;
    }
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    // Derive from numeric 0-100 if provided
    return Math.max(1, Math.min(4, Math.round(value / 25)));
  }
  // Fallback: show a minimal bar so skills are visible even without level
  return 1;
};

const prettyLevel = (lvl) => {
  const x = (lvl || '').toLowerCase();
  if (!x) return '';
  return x.charAt(0).toUpperCase() + x.slice(1);
};

const SkillDistribution = ({ data = [] }) => {
  // data: [{ name, level?, value? }]
  return (
    <div className="dashboard-card" style={{ padding: 14 }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Skills Distribution</div>
      {data.length === 0 && <div style={{ fontSize: 13, color: '#6b7280' }}>No skills yet</div>}
      {data.map((d) => {
        const filled = levelToSegments(d.level, d.value);
        return (
          <div style={row} key={d.name}>
            <div style={label}>{d.name}</div>
            <div style={segmentsWrap}>
              {[0,1,2,3].map((i) => (
                <div key={i} style={seg(i < filled, i, 4)} role="presentation" />
              ))}
            </div>
            <div style={levelText}>{prettyLevel(d.level)}</div>
          </div>
        );
      })}
    </div>
  );
};

export default SkillDistribution;
