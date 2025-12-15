import React, { useState } from 'react';
import Icon from '../common/Icon';
import './ApplicationPackages.css';
import { automationAPI } from '../../services/automationAPI';

const ApplicationPackages = ({ packages = [], onRefresh }) => {
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const error = status.state === 'error' ? status.message : null;
  const setError = (msg) => setStatus(prev => ({ ...prev, state: msg ? 'error' : 'idle', message: msg || '' }));

  const runWithStatus = async (label, action) => {
    setStatus({ state: 'loading', message: label });
    try {
      await action();
      setStatus({ state: 'success', message: '' });
    } catch (error) {
      console.error(label, error);
      setStatus({ state: 'error', message: label });
    }
  };

  const handleRegeneratePackage = (pkg) => runWithStatus('Regenerating package', async () => {
    await automationAPI.regenerateApplicationPackage(pkg.id);
    onRefresh?.();
  });

  const handleDownloadPackage = (pkg) => runWithStatus('Preparing download', async () => {
    const downloadUrl = await automationAPI.downloadApplicationPackage(pkg.id);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `application-package-${pkg.job?.title || 'package'}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  });

  const getStatusClass = (status) => {
    return `status status-${status}`;
  };

  const getStatusIcon = (status) => {
    const icons = {
      'generating': 'sync-alt',
      'ready': 'folder-open',
      'failed': 'times-circle',
      'updating': 'sync-alt'
    };
    return icons[status] || 'file';
  };

  const formatDateTime = (dateTimeString) => {
    return new Date(dateTimeString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getMatchScoreClass = (score) => {
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-medium';
    return 'score-low';
  };

  if (packages.length === 0) {
    return (
      <div className="packages-empty">
        <Icon name="folder-open" size="xl" color="var(--gray-400)" />
        <h3>No Application Packages</h3>
        <p>Generated application packages will appear here when automation rules create them.</p>
      </div>
    );
  }

  return (
    <div className="application-packages">
      {error && (
        <div className="error-alert">
          <Icon name="times-circle" size="sm" />
          {error}
          <button onClick={() => setError('')} className="close-btn">
            <Icon name="times" size="sm" />
          </button>
        </div>
      )}

      <div className="packages-grid">
        {packages.map((pkg) => (
          <div key={pkg.id} className="package-card">
            <div className="package-header">
              <div className="package-info">
                <h4 className="job-title">{pkg.job?.title || 'Unknown Position'}</h4>
                <p className="company-name">{pkg.job?.company_name || 'Unknown Company'}</p>
              </div>
              <div className="package-actions">
                <button 
                  onClick={() => handleDownloadPackage(pkg)}
                  style={{
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    marginRight: '8px'
                  }}
                >
                  💾 DOWNLOAD ZIP
                </button>
                
                <button 
                  onClick={() => handleRegeneratePackage(pkg)}
                  style={{
                    background: '#ffc107',
                    color: 'black',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  🔄 REGENERATE
                </button>
              </div>
            </div>

            <div className="package-status">
              <span className={getStatusClass(pkg.status)}>
                <Icon name={getStatusIcon(pkg.status)} size="sm" />
                {pkg.status.replace('_', ' ')}
              </span>
            </div>

            <div className="package-meta">
              <div className="meta-item">
                <Icon name="calendar" size="sm" />
                <span>Created: {formatDateTime(pkg.created_at)}</span>
              </div>
              {pkg.match_score && (
                <div className="meta-item">
                  <Icon name="chart-line" size="sm" />
                  <span className={`match-score ${getMatchScoreClass(pkg.match_score)}`}>
                    {pkg.match_score}% match
                  </span>
                </div>
              )}
            </div>

            {pkg.documents && pkg.documents.length > 0 && (
              <div className="package-documents">
                <h5>Documents</h5>
                <div className="documents-list">
                  {pkg.documents.map((doc, index) => (
                    <div key={index} className="document-item">
                      <Icon name="file" size="sm" />
                      <span>{doc.type}</span>
                      <span className="document-status">{doc.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pkg.status === 'generating' && (
              <div className="progress-section">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pkg.generation_progress || 0}%` }}></div>
                </div>
                <span className="progress-text">Generating package...</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApplicationPackages;
