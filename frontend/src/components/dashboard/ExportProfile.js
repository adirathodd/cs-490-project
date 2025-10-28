import React from 'react';

const ExportProfile = ({ payload }) => {
  const onExport = () => {
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'profile-summary.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {}
  };

  return (
    <button onClick={onExport} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
      Export Summary
    </button>
  );
};

export default ExportProfile;

