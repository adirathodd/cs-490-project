import React, { useState } from 'react';
import Icon from '../common/Icon';
import './ApplicationPackages.css';
import { automationAPI } from '../../services/automationAPI';

const ApplicationPackages = ({ packages, onRefresh }) => {
  const [showMenu, setShowMenu] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMenuToggle = (packageId) => {
    setShowMenu(showMenu === packageId ? null : packageId);
    const pkg = packages.find(p => p.id === packageId);
    setSelectedPackage(pkg);
  };

  const handleViewPackage = async (pkg) => {
    try {
      const packageDetails = await automationAPI.getApplicationPackageDetails(pkg.id);
      console.log('Package details:', packageDetails);
      // TODO: Navigate to detailed package view or show modal with package details
      alert(`Package Details:\nJob: ${pkg.job?.title}\nCompany: ${pkg.job?.company_name}\nDocuments: ${packageDetails.documents?.length || 0} files`);
    } catch (err) {
      console.error('Failed to view package:', err);
      setError('Failed to view package');
    }
    setShowMenu(null);
  };

  const handleRegeneratePackage = async (pkg) => {
    setLoading(true);
    try {
      await automationAPI.regenerateApplicationPackage(pkg.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to regenerate package:', err);
      setError('Failed to regenerate package');
    } finally {
      setLoading(false);
    }
    setShowMenu(null);
  };

  const handleDownloadPackage = async (pkg) => {
    try {
      const downloadUrl = await automationAPI.downloadApplicationPackage(pkg.id);
      
      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `application-package-${pkg.job?.title || 'package'}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to download package:', err);
      setError('Failed to download package');
    }
    setShowMenu(null);
  };

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
                {/* Simple direct download button */}
                <button 
                  onClick={async () => {
                    try {
                      const response = await fetch(`http://localhost:8000/api/automation/packages/${pkg.id}/download/`, {
                        headers: {
                          'Authorization': `Bearer ${localStorage.getItem('firebaseToken') || ''}`,
                        },
                      });
                      
                      if (!response.ok) {
                        throw new Error('Download failed');
                      }
                      
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `package-${pkg.id}.zip`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                      
                      alert('Download started!');
                    } catch (error) {
                      console.error('Download error:', error);
                      alert('Download failed: ' + error.message);
                    }
                  }}
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
                
                {/* Simple regenerate button */}
                <button 
                  onClick={async () => {
                    try {
                      if (!window.confirm('Regenerate this package? This will create new AI documents.')) return;
                      
                      const response = await fetch(`http://localhost:8000/api/automation/packages/${pkg.id}/regenerate/`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${localStorage.getItem('firebaseToken') || ''}`,
                          'Content-Type': 'application/json',
                        },
                      });
                      
                      if (!response.ok) {
                        throw new Error('Regeneration failed');
                      }
                      
                      alert('Package regenerated successfully! Try downloading now.');
                      window.location.reload(); // Refresh the page
                    } catch (error) {
                      console.error('Regeneration error:', error);
                      alert('Regeneration failed: ' + error.message);
                    }
                  }}
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