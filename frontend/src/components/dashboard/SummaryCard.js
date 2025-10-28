import React from 'react';

const cardStyle = {
  width: '100%',
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
};

const titleStyle = { fontSize: 12, color: '#6b7280', margin: 0 };
const valueStyle = { fontSize: 22, fontWeight: 600, margin: 0, color: '#111827' };
const hintStyle = { fontSize: 12, color: '#6b7280', marginTop: 2 };

const SummaryCard = ({ title, value, hint, action }) => {
  return (
    <div style={cardStyle}>
      <p style={titleStyle}>{title}</p>
      <p style={valueStyle}>{value}</p>
      {hint && <p style={hintStyle}>{hint}</p>}
      {action}
    </div>
  );
};

export default SummaryCard;
