import React from 'react';

const wrap = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 };
const row = { display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' };
const label = { width: 140, fontSize: 12, color: '#374151' };
const segmentsWrap = { flex: 1, display: 'flex', gap: 4 };
const seg = (filled, idx, total) => ({
  flex: 1,
  height: 10,
  background: filled ? '#10b981' : '#e5e7eb',
  borderRadius: idx === 0 ? '6px 0 0 6px' : idx === total - 1 ? '0 6px 6px 0' : 0,
});
const levelText = { width: 80, textAlign: 'right', fontSize: 11, color: '#6b7280' };

const levelToSegments = (lvl, value) => {
  if (typeof value === 'number') {
    // Fallback: derive from value 0-100
    return Math.max(0, Math.min(4, Math.round(value / 25)));
  }
  switch ((lvl || '').toLowerCase()) {
    case 'beginner': return 1;
    case 'intermediate': return 2;
    case 'advanced': return 3;
    case 'expert': return 4;
    default: return 0;
  }
};

const prettyLevel = (lvl) => {
  const x = (lvl || '').toLowerCase();
  if (!x) return '';
  return x.charAt(0).toUpperCase() + x.slice(1);
};

const SkillDistribution = ({ data = [] }) => {
  // data: [{ name, level?, value? }]
  return (
    <div style={wrap}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Skills Distribution</div>
      {data.length === 0 && <div style={{ fontSize: 13, color: '#6b7280' }}>No skills yet</div>}
      {data.map((d) => {
        const filled = levelToSegments(d.level, d.value);
        return (
          <div style={row} key={d.name}>
            <div style={label}>{d.name}</div>
            <div style={segmentsWrap}>
              {[0,1,2,3].map((i) => (
                <div key={i} style={seg(i < filled, i, 4)} />
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
