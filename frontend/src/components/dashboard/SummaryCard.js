import React from 'react';

// Renders a compact metric card using the existing dashboard card styling
const stackStyle = { display: 'flex', flexDirection: 'column', gap: 6 };
const titleStyle = { fontSize: 12, color: '#6b7280', margin: 0 };
const valueStyle = { fontSize: 22, fontWeight: 600, margin: 0 };
const hintStyle = { fontSize: 12, color: '#6b7280', marginTop: 2 };

const SummaryCard = ({ title, value, hint, action }) => {
  return (
    <div className="dashboard-card">
      <div style={stackStyle}>
        <p style={titleStyle}>{title}</p>
        <p style={valueStyle}>{value}</p>
        {hint && <p style={hintStyle}>{hint}</p>}
        {action}
      </div>
    </div>
  );
};

export default SummaryCard;
