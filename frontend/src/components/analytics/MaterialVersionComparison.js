/**
 * Material Version Performance Comparison
 * 
 * Allows users to compare resume and cover letter versions (A/B testing)
 * to identify which materials work best for job applications.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { materialVersionAPI, jobsAPI, materialsAPI } from '../../services/api';
import Icon from '../common/Icon';
import './MaterialVersionComparison.css';

const OUTCOME_OPTIONS = [
  { value: 'pending', label: 'Pending', color: '#6b7280' },
  { value: 'no_response', label: 'No Response', color: '#9ca3af' },
  { value: 'response_received', label: 'Response Received', color: '#3b82f6' },
  { value: 'interview', label: 'Interview', color: '#8b5cf6' },
  { value: 'offer', label: 'Offer', color: '#10b981' },
  { value: 'rejection', label: 'Rejection', color: '#ef4444' },
];

const MATERIAL_TYPES = [
  { value: 'resume', label: 'Resume' },
  { value: 'cover_letter', label: 'Cover Letter' },
];

export default function MaterialVersionComparison() {
  const [activeTab, setActiveTab] = useState('comparison');
  const [materialType, setMaterialType] = useState('resume');
  const [includeArchived, setIncludeArchived] = useState(false);
  
  // Data states
  const [comparison, setComparison] = useState(null);
  const [versions, setVersions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  
  // Existing data for import
  const [existingJobs, setExistingJobs] = useState([]);
  const [existingDocuments, setExistingDocuments] = useState([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showApplicationsModal, setShowApplicationsModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [versionApplications, setVersionApplications] = useState([]);

  // Load existing jobs and documents for import
  const loadExistingData = useCallback(async () => {
    try {
      const [jobsData, docsData] = await Promise.all([
        jobsAPI.getJobs({ limit: 1000 }),
        materialsAPI.listDocuments(),
      ]);
      setExistingJobs(jobsData.jobs || jobsData.results || jobsData || []);
      setExistingDocuments(docsData.documents || docsData || []);
    } catch (err) {
      console.error('Failed to load existing data for import:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [comparisonData, versionsData, analyticsData] = await Promise.all([
        materialVersionAPI.getComparison({ material_type: materialType, include_archived: includeArchived }),
        materialVersionAPI.listVersions({ material_type: materialType, include_archived: includeArchived }),
        materialVersionAPI.getAnalytics(),
      ]);
      setComparison(comparisonData);
      setVersions(versionsData.versions || []);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [materialType, includeArchived]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load existing jobs and documents on mount
  useEffect(() => {
    loadExistingData();
  }, [loadExistingData]);

  const handleCreateVersion = async (formData) => {
    try {
      const result = await materialVersionAPI.createVersion(formData);
      if (result.auto_imported_count > 0) {
        setSuccess(`Version created! ${result.auto_imported_count} job applications were auto-imported.`);
      } else {
        setSuccess('Version created successfully');
      }
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to create version');
    }
  };

  const handleArchiveVersion = async (versionId) => {
    try {
      await materialVersionAPI.archiveVersion(versionId);
      setSuccess('Version archived successfully');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to archive version');
    }
  };

  const handleRestoreVersion = async (versionId) => {
    try {
      await materialVersionAPI.restoreVersion(versionId);
      setSuccess('Version restored successfully');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to restore version');
    }
  };

  const handleTrackApplication = async (formData) => {
    const versionId = selectedVersion.id || selectedVersion.version_id;
    try {
      await materialVersionAPI.trackApplication(versionId, formData);
      setSuccess('Application tracked successfully');
      setShowTrackModal(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to track application');
    }
  };

  const handleViewApplications = async (version) => {
    setSelectedVersion(version);
    const versionId = version.id || version.version_id;
    try {
      const data = await materialVersionAPI.listApplications(versionId);
      setVersionApplications(data.applications || []);
      setShowApplicationsModal(true);
    } catch (err) {
      setError(err.message || 'Failed to load applications');
    }
  };

  const handleUpdateOutcome = async (applicationId, outcome, outcomeDate) => {
    try {
      await materialVersionAPI.updateOutcome(applicationId, { 
        outcome, 
        outcome_date: outcomeDate || null 
      });
      setSuccess('Outcome updated successfully');
      // Refresh applications list
      if (selectedVersion) {
        const versionId = selectedVersion.id || selectedVersion.version_id;
        const data = await materialVersionAPI.listApplications(versionId);
        setVersionApplications(data.applications || []);
      }
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to update outcome');
    }
  };

  const handleBulkImport = async (version) => {
    setSelectedVersion(version);
    setShowBulkImportModal(true);
  };

  const handleBulkImportSubmit = async (jobIds) => {
    const versionId = selectedVersion.id || selectedVersion.version_id;
    try {
      const result = await materialVersionAPI.bulkImportJobs(versionId, jobIds);
      setSuccess(`Imported ${result.imported_count} applications`);
      if (result.skipped_count > 0) {
        setSuccess(`Imported ${result.imported_count} applications (${result.skipped_count} already tracked)`);
      }
      setShowBulkImportModal(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to import applications');
    }
  };

  // Clear messages after 3 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  if (loading) {
    return (
      <div className="mvc-loading">
        <Icon name="loader" className="mvc-spinner" />
        Loading material version data...
      </div>
    );
  }

  return (
    <div className="mvc-container">
      {/* Header */}
      <div className="mvc-header">
        <div className="mvc-header-content">
          <div className="mvc-header-icon">
            <Icon name="bar-chart" size={22} color="#fff" />
          </div>
          <div>
            <h1 className="mvc-title">Material Version Comparison</h1>
            <p className="mvc-subtitle">
              Compare resume and cover letter performance to identify what works best
            </p>
          </div>
        </div>
        <button 
          className="mvc-btn mvc-btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Icon name="plus" size={16} />
          Create Version
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="mvc-message mvc-message-error">
          <Icon name="alert-circle" size={16} />
          {error}
        </div>
      )}
      {success && (
        <div className="mvc-message mvc-message-success">
          <Icon name="check-circle" size={16} />
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="mvc-filters">
        <div className="mvc-filter-group">
          <label>Material Type</label>
          <div className="mvc-toggle-group">
            {MATERIAL_TYPES.map(type => (
              <button
                key={type.value}
                className={`mvc-toggle-btn ${materialType === type.value ? 'active' : ''}`}
                onClick={() => setMaterialType(type.value)}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
        <label className="mvc-checkbox-label">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Include archived versions
        </label>
      </div>

      {/* Tabs */}
      <div className="mvc-tabs">
        <button
          className={`mvc-tab ${activeTab === 'comparison' ? 'active' : ''}`}
          onClick={() => setActiveTab('comparison')}
        >
          <Icon name="bar-chart" size={16} />
          Comparison
        </button>
        <button
          className={`mvc-tab ${activeTab === 'versions' ? 'active' : ''}`}
          onClick={() => setActiveTab('versions')}
        >
          <Icon name="layers" size={16} />
          Versions
        </button>
        <button
          className={`mvc-tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <Icon name="activity" size={16} />
          Analytics
        </button>
      </div>

      {/* Tab Content */}
      <div className="mvc-content">
        {activeTab === 'comparison' && (
          <ComparisonView 
            comparison={comparison} 
            onViewApplications={handleViewApplications}
            onTrackApplication={(version) => {
              setSelectedVersion(version);
              setShowTrackModal(true);
            }}
          />
        )}
        {activeTab === 'versions' && (
          <VersionsView 
            versions={versions}
            onArchive={handleArchiveVersion}
            onRestore={handleRestoreVersion}
            onViewApplications={handleViewApplications}
            onTrackApplication={(version) => {
              setSelectedVersion(version);
              setShowTrackModal(true);
            }}
            onBulkImport={handleBulkImport}
            hasExistingJobs={existingJobs.length > 0}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsView analytics={analytics} />
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateVersionModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateVersion}
          materialType={materialType}
          existingDocuments={existingDocuments}
        />
      )}

      {showTrackModal && selectedVersion && (
        <TrackApplicationModal
          version={selectedVersion}
          onClose={() => {
            setShowTrackModal(false);
            setSelectedVersion(null);
          }}
          onTrack={handleTrackApplication}
          existingJobs={existingJobs}
        />
      )}

      {showApplicationsModal && selectedVersion && (
        <ApplicationsModal
          version={selectedVersion}
          applications={versionApplications}
          onClose={() => {
            setShowApplicationsModal(false);
            setSelectedVersion(null);
            setVersionApplications([]);
          }}
          onUpdateOutcome={handleUpdateOutcome}
        />
      )}

      {showBulkImportModal && selectedVersion && (
        <BulkImportModal
          version={selectedVersion}
          existingJobs={existingJobs}
          onClose={() => {
            setShowBulkImportModal(false);
            setSelectedVersion(null);
          }}
          onImport={handleBulkImportSubmit}
        />
      )}
    </div>
  );
}

// Comparison View Component
function ComparisonView({ comparison, onViewApplications, onTrackApplication }) {
  if (!comparison?.versions?.length) {
    return (
      <div className="mvc-empty">
        <Icon name="bar-chart" size={48} className="mvc-empty-icon" />
        <h3>No Versions to Compare</h3>
        <p>Create at least two versions to compare their performance.</p>
      </div>
    );
  }

  const { versions, note } = comparison;

  return (
    <div className="mvc-comparison">
      {/* Note about statistical significance */}
      <div className="mvc-note">
        <Icon name="info" size={16} />
        {note}
      </div>

      {/* Comparison Chart */}
      <div className="mvc-chart-section">
        <h3 className="mvc-section-title">Performance Chart</h3>
        <div className="mvc-chart">
          {versions.map((version, index) => (
            <div key={version.version_id} className="mvc-chart-bar-group">
              <div className="mvc-chart-label">{version.version_label}</div>
              <div className="mvc-chart-bars">
                <div className="mvc-chart-bar-container">
                  <div 
                    className="mvc-chart-bar response"
                    style={{ width: `${Math.min(version.response_rate, 100)}%` }}
                    title={`Response: ${version.response_rate}%`}
                  />
                  <span className="mvc-chart-value">{version.response_rate}%</span>
                </div>
                <div className="mvc-chart-bar-container">
                  <div 
                    className="mvc-chart-bar interview"
                    style={{ width: `${Math.min(version.interview_rate, 100)}%` }}
                    title={`Interview: ${version.interview_rate}%`}
                  />
                  <span className="mvc-chart-value">{version.interview_rate}%</span>
                </div>
                <div className="mvc-chart-bar-container">
                  <div 
                    className="mvc-chart-bar offer"
                    style={{ width: `${Math.min(version.offer_rate, 100)}%` }}
                    title={`Offer: ${version.offer_rate}%`}
                  />
                  <span className="mvc-chart-value">{version.offer_rate}%</span>
                </div>
              </div>
              {!version.has_sufficient_data && (
                <span className="mvc-insufficient-data">Needs more data</span>
              )}
            </div>
          ))}
        </div>
        <div className="mvc-chart-legend">
          <span className="mvc-legend-item"><span className="response"></span> Response Rate</span>
          <span className="mvc-legend-item"><span className="interview"></span> Interview Rate</span>
          <span className="mvc-legend-item"><span className="offer"></span> Offer Rate</span>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="mvc-table-section">
        <h3 className="mvc-section-title">Detailed Comparison</h3>
        <div className="mvc-table-wrapper">
          <table className="mvc-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Applications</th>
                <th>Response %</th>
                <th>Interview %</th>
                <th>Offer %</th>
                <th>Avg Days to Response</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {versions.map(version => (
                <tr key={version.version_id} className={version.is_archived ? 'archived' : ''}>
                  <td>
                    <div className="mvc-version-cell">
                      <strong>{version.version_label}</strong>
                      {version.is_archived && <span className="mvc-badge archived">Archived</span>}
                      {!version.has_sufficient_data && (
                        <span className="mvc-badge warning">Low Data</span>
                      )}
                    </div>
                  </td>
                  <td>{version.total_applications}</td>
                  <td className="mvc-rate">{version.response_rate}%</td>
                  <td className="mvc-rate">{version.interview_rate}%</td>
                  <td className="mvc-rate">{version.offer_rate}%</td>
                  <td>{version.avg_days_to_response ? `${version.avg_days_to_response} days` : '—'}</td>
                  <td>
                    <div className="mvc-actions">
                      <button 
                        className="mvc-action-btn"
                        onClick={() => onViewApplications(version)}
                        title="View Applications"
                      >
                        <Icon name="eye" size={14} />
                      </button>
                      <button 
                        className="mvc-action-btn"
                        onClick={() => onTrackApplication(version)}
                        title="Track Application"
                      >
                        <Icon name="plus" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Versions List View
function VersionsView({ versions, onArchive, onRestore, onViewApplications, onTrackApplication, onBulkImport, hasExistingJobs }) {
  if (!versions?.length) {
    return (
      <div className="mvc-empty">
        <Icon name="layers" size={48} className="mvc-empty-icon" />
        <h3>No Versions Yet</h3>
        <p>Create your first version to start tracking performance.</p>
      </div>
    );
  }

  return (
    <div className="mvc-versions-grid">
      {versions.map(version => (
        <div 
          key={version.id} 
          className={`mvc-version-card ${version.is_archived ? 'archived' : ''}`}
        >
          <div className="mvc-version-header">
            <h4>{version.version_label}</h4>
            <span className="mvc-version-type">
              {version.material_type === 'resume' ? 'Resume' : 'Cover Letter'}
            </span>
          </div>
          {version.description && (
            <p className="mvc-version-description">{version.description}</p>
          )}
          <div className="mvc-version-stats">
            <div className="mvc-stat">
              <span className="mvc-stat-value">{version.application_count}</span>
              <span className="mvc-stat-label">Applications</span>
            </div>
          </div>
          <div className="mvc-version-meta">
            <span>Created {new Date(version.created_at).toLocaleDateString()}</span>
            {version.is_archived && <span className="mvc-badge archived">Archived</span>}
          </div>
          <div className="mvc-version-actions">
            <button 
              className="mvc-btn mvc-btn-secondary mvc-btn-sm"
              onClick={() => onViewApplications(version)}
            >
              <Icon name="eye" size={14} />
              View
            </button>
            <button 
              className="mvc-btn mvc-btn-primary mvc-btn-sm"
              onClick={() => onTrackApplication(version)}
            >
              <Icon name="plus" size={14} />
              Track
            </button>
            {hasExistingJobs && (
              <button 
                className="mvc-btn mvc-btn-secondary mvc-btn-sm"
                onClick={() => onBulkImport(version)}
                title="Import from existing job applications"
              >
                <Icon name="download" size={14} />
                Import
              </button>
            )}
            {version.is_archived ? (
              <button 
                className="mvc-btn mvc-btn-secondary mvc-btn-sm"
                onClick={() => onRestore(version.id)}
              >
                <Icon name="restore" size={14} />
              </button>
            ) : (
              <button 
                className="mvc-btn mvc-btn-secondary mvc-btn-sm"
                onClick={() => onArchive(version.id)}
              >
                <Icon name="archive" size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Analytics View
function AnalyticsView({ analytics }) {
  if (!analytics) {
    return (
      <div className="mvc-empty">
        <Icon name="activity" size={48} className="mvc-empty-icon" />
        <h3>No Analytics Available</h3>
        <p>Start tracking applications to see analytics.</p>
      </div>
    );
  }

  const { summary, outcome_breakdown, best_performing, recommendations } = analytics;

  return (
    <div className="mvc-analytics">
      {/* Summary Cards */}
      <div className="mvc-summary-grid">
        <div className="mvc-summary-card">
          <div className="mvc-summary-icon resume">
            <Icon name="file-text" size={20} />
          </div>
          <div className="mvc-summary-content">
            <div className="mvc-summary-value">{summary.resume_versions}</div>
            <div className="mvc-summary-label">Resume Versions</div>
          </div>
        </div>
        <div className="mvc-summary-card">
          <div className="mvc-summary-icon cover-letter">
            <Icon name="mail" size={20} />
          </div>
          <div className="mvc-summary-content">
            <div className="mvc-summary-value">{summary.cover_letter_versions}</div>
            <div className="mvc-summary-label">Cover Letter Versions</div>
          </div>
        </div>
        <div className="mvc-summary-card">
          <div className="mvc-summary-icon applications">
            <Icon name="briefcase" size={20} />
          </div>
          <div className="mvc-summary-content">
            <div className="mvc-summary-value">{summary.total_tracked_applications}</div>
            <div className="mvc-summary-label">Tracked Applications</div>
          </div>
        </div>
      </div>

      {/* Outcome Breakdown */}
      <div className="mvc-card">
        <h3 className="mvc-section-title">Outcome Breakdown</h3>
        <div className="mvc-outcome-grid">
          {OUTCOME_OPTIONS.map(option => (
            <div key={option.value} className="mvc-outcome-item">
              <div 
                className="mvc-outcome-dot" 
                style={{ backgroundColor: option.color }}
              />
              <span className="mvc-outcome-label">{option.label}</span>
              <span className="mvc-outcome-count">
                {outcome_breakdown[option.value] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Best Performing */}
      <div className="mvc-card">
        <h3 className="mvc-section-title">Best Performing Versions</h3>
        <div className="mvc-best-grid">
          <div className="mvc-best-item">
            <div className="mvc-best-type">
              <Icon name="file-text" size={16} />
              Resume
            </div>
            {best_performing.resume ? (
              <div className="mvc-best-content">
                <strong>{best_performing.resume.version_label}</strong>
                <span>{best_performing.resume.score}% interview rate</span>
              </div>
            ) : (
              <span className="mvc-best-none">Not enough data</span>
            )}
          </div>
          <div className="mvc-best-item">
            <div className="mvc-best-type">
              <Icon name="mail" size={16} />
              Cover Letter
            </div>
            {best_performing.cover_letter ? (
              <div className="mvc-best-content">
                <strong>{best_performing.cover_letter.version_label}</strong>
                <span>{best_performing.cover_letter.score}% interview rate</span>
              </div>
            ) : (
              <span className="mvc-best-none">Not enough data</span>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="mvc-card">
        <h3 className="mvc-section-title">Recommendations</h3>
        <ul className="mvc-recommendations">
          {recommendations.map((rec, index) => (
            <li key={index}>
              <Icon name="lightbulb" size={14} />
              {rec}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Create Version Modal
function CreateVersionModal({ onClose, onCreate, materialType, existingDocuments = [] }) {
  const [formData, setFormData] = useState({
    material_type: materialType,
    version_label: '',
    description: '',
    document_id: '',
  });
  const [saving, setSaving] = useState(false);

  // Filter documents by the selected material type
  const filteredDocuments = existingDocuments.filter(doc => {
    const docType = doc.doc_type || doc.document_type;
    if (formData.material_type === 'resume') {
      return docType === 'resume';
    } else if (formData.material_type === 'cover_letter') {
      return docType === 'cover_letter';
    }
    return false;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.version_label.trim()) return;
    
    setSaving(true);
    await onCreate(formData);
    setSaving(false);
  };

  return (
    <div className="mvc-modal-overlay" onClick={onClose}>
      <div className="mvc-modal" onClick={e => e.stopPropagation()}>
        <div className="mvc-modal-header">
          <h2>Create New Version</h2>
          <button className="mvc-modal-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mvc-modal-body">
            <div className="mvc-form-group">
              <label>Material Type</label>
              <select
                value={formData.material_type}
                onChange={e => setFormData({...formData, material_type: e.target.value, document_id: ''})}
              >
                {MATERIAL_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div className="mvc-form-group">
              <label>Link to Existing Document</label>
              <select
                value={formData.document_id}
                onChange={e => setFormData({...formData, document_id: e.target.value})}
              >
                <option value="">-- No document linked --</option>
                {filteredDocuments.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.document_name || doc.name || `${doc.doc_type || doc.document_type} v${doc.version || doc.version_number || 1}`}
                  </option>
                ))}
              </select>
              <small className="mvc-form-help">
                Optionally link this version to an existing document from your library
              </small>
            </div>
            <div className="mvc-form-group">
              <label>Version Label *</label>
              <input
                type="text"
                value={formData.version_label}
                onChange={e => setFormData({...formData, version_label: e.target.value})}
                placeholder="e.g., Version A, Technical Focus, Startup Edition"
                required
              />
            </div>
            <div className="mvc-form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="What makes this version unique?"
                rows={3}
              />
            </div>
          </div>
          <div className="mvc-modal-footer">
            <button type="button" className="mvc-btn mvc-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="mvc-btn mvc-btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Version'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Track Application Modal
function TrackApplicationModal({ version, onClose, onTrack, existingJobs = [] }) {
  const [formData, setFormData] = useState({
    job_id: '',
    company_name: '',
    job_title: '',
    applied_date: new Date().toISOString().split('T')[0],
    outcome: 'pending',
  });
  const [saving, setSaving] = useState(false);

  // Handle job selection from dropdown
  const handleJobSelect = (jobId) => {
    if (!jobId) {
      setFormData({
        ...formData,
        job_id: '',
        company_name: '',
        job_title: '',
      });
      return;
    }
    
    const job = existingJobs.find(j => String(j.id) === String(jobId));
    if (job) {
      setFormData({
        ...formData,
        job_id: jobId,
        company_name: job.company_name || job.company || '',
        job_title: job.title || job.job_title || '',
        applied_date: job.application_submitted_at 
          ? new Date(job.application_submitted_at).toISOString().split('T')[0] 
          : job.created_at 
            ? new Date(job.created_at).toISOString().split('T')[0]
            : formData.applied_date,
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onTrack(formData);
    setSaving(false);
  };

  return (
    <div className="mvc-modal-overlay" onClick={onClose}>
      <div className="mvc-modal" onClick={e => e.stopPropagation()}>
        <div className="mvc-modal-header">
          <h2>Track Application</h2>
          <button className="mvc-modal-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mvc-modal-body">
            <div className="mvc-info-banner">
              <Icon name="info" size={16} />
              Tracking for: <strong>{version.version_label}</strong>
            </div>
            
            {/* Import from existing job */}
            {existingJobs.length > 0 && (
              <div className="mvc-form-group">
                <label>Import from Existing Job</label>
                <select
                  value={formData.job_id}
                  onChange={e => handleJobSelect(e.target.value)}
                >
                  <option value="">-- Enter manually --</option>
                  {existingJobs.map(job => (
                    <option key={job.id} value={job.id}>
                      {job.company_name || job.company} - {job.title || job.job_title}
                    </option>
                  ))}
                </select>
                <small className="mvc-form-help">
                  Select an existing job to auto-fill details, or enter manually below
                </small>
              </div>
            )}
            
            <div className="mvc-form-group">
              <label>Company Name</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={e => setFormData({...formData, company_name: e.target.value})}
                placeholder="e.g., Google, Microsoft"
              />
            </div>
            <div className="mvc-form-group">
              <label>Job Title</label>
              <input
                type="text"
                value={formData.job_title}
                onChange={e => setFormData({...formData, job_title: e.target.value})}
                placeholder="e.g., Software Engineer"
              />
            </div>
            <div className="mvc-form-group">
              <label>Applied Date</label>
              <input
                type="date"
                value={formData.applied_date}
                onChange={e => setFormData({...formData, applied_date: e.target.value})}
              />
            </div>
            <div className="mvc-form-group">
              <label>Current Outcome</label>
              <select
                value={formData.outcome}
                onChange={e => setFormData({...formData, outcome: e.target.value})}
              >
                {OUTCOME_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mvc-modal-footer">
            <button type="button" className="mvc-btn mvc-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="mvc-btn mvc-btn-primary" disabled={saving}>
              {saving ? 'Tracking...' : 'Track Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Applications List Modal
function ApplicationsModal({ version, applications, onClose, onUpdateOutcome }) {
  const [editingId, setEditingId] = useState(null);
  const [editOutcome, setEditOutcome] = useState('');
  const [editOutcomeDate, setEditOutcomeDate] = useState('');

  const handleSaveOutcome = async (appId) => {
    await onUpdateOutcome(appId, editOutcome, editOutcomeDate);
    setEditingId(null);
    setEditOutcome('');
    setEditOutcomeDate('');
  };

  return (
    <div className="mvc-modal-overlay" onClick={onClose}>
      <div className="mvc-modal mvc-modal-large" onClick={e => e.stopPropagation()}>
        <div className="mvc-modal-header">
          <h2>Applications - {version.version_label}</h2>
          <button className="mvc-modal-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="mvc-modal-body">
          {applications.length === 0 ? (
            <div className="mvc-empty-small">
              <p>No applications tracked for this version yet.</p>
            </div>
          ) : (
            <div className="mvc-applications-list">
              {applications.map(app => {
                const outcomeOption = OUTCOME_OPTIONS.find(o => o.value === app.outcome);
                return (
                  <div key={app.id} className="mvc-application-item">
                    <div className="mvc-app-info">
                      <strong>{app.company_name || 'Unknown Company'}</strong>
                      <span>{app.job_title || 'Unknown Role'}</span>
                      <span className="mvc-app-date">
                        Applied: {new Date(app.applied_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mvc-app-outcome">
                      {editingId === app.id ? (
                        <div className="mvc-outcome-edit">
                          <select
                            value={editOutcome}
                            onChange={e => setEditOutcome(e.target.value)}
                          >
                            {OUTCOME_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={editOutcomeDate}
                            onChange={e => setEditOutcomeDate(e.target.value)}
                            placeholder="Outcome date"
                          />
                          <button 
                            className="mvc-btn mvc-btn-primary mvc-btn-xs"
                            onClick={() => handleSaveOutcome(app.id)}
                          >
                            Save
                          </button>
                          <button 
                            className="mvc-btn mvc-btn-secondary mvc-btn-xs"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span 
                            className="mvc-outcome-badge"
                            style={{ backgroundColor: outcomeOption?.color || '#6b7280' }}
                          >
                            {outcomeOption?.label || app.outcome}
                          </span>
                          {app.days_to_response && (
                            <span className="mvc-days">{app.days_to_response} days</span>
                          )}
                          <button 
                            className="mvc-btn mvc-btn-secondary mvc-btn-xs"
                            onClick={() => {
                              setEditingId(app.id);
                              setEditOutcome(app.outcome);
                              setEditOutcomeDate(app.outcome_date || '');
                            }}
                          >
                            <Icon name="edit" size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="mvc-modal-footer">
          <button className="mvc-btn mvc-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
// Bulk Import Modal
function BulkImportModal({ version, existingJobs, onClose, onImport }) {
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter jobs by search term
  const filteredJobs = existingJobs.filter(job => {
    const search = searchTerm.toLowerCase();
    const company = (job.company_name || job.company || '').toLowerCase();
    const title = (job.title || job.job_title || '').toLowerCase();
    return company.includes(search) || title.includes(search);
  });

  const handleToggleJob = (jobId) => {
    setSelectedJobIds(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const handleSelectAll = () => {
    if (selectedJobIds.length === filteredJobs.length) {
      setSelectedJobIds([]);
    } else {
      setSelectedJobIds(filteredJobs.map(j => j.id));
    }
  };

  const handleSubmit = async () => {
    if (selectedJobIds.length === 0) return;
    setImporting(true);
    await onImport(selectedJobIds);
    setImporting(false);
  };

  return (
    <div className="mvc-modal-overlay" onClick={onClose}>
      <div className="mvc-modal mvc-modal-large" onClick={e => e.stopPropagation()}>
        <div className="mvc-modal-header">
          <h2>Import Existing Applications</h2>
          <button className="mvc-modal-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="mvc-modal-body">
          <div className="mvc-info-banner">
            <Icon name="info" size={16} />
            Import applications for: <strong>{version.version_label}</strong>
          </div>
          
          <div className="mvc-import-search">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Search jobs by company or title..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="mvc-import-actions">
            <button 
              className="mvc-btn mvc-btn-secondary mvc-btn-sm"
              onClick={handleSelectAll}
            >
              {selectedJobIds.length === filteredJobs.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="mvc-import-count">
              {selectedJobIds.length} selected
            </span>
          </div>

          <div className="mvc-import-list">
            {filteredJobs.length === 0 ? (
              <div className="mvc-empty-small">
                <p>No jobs found. Create some job entries first.</p>
              </div>
            ) : (
              filteredJobs.map(job => (
                <label key={job.id} className="mvc-import-item">
                  <input
                    type="checkbox"
                    checked={selectedJobIds.includes(job.id)}
                    onChange={() => handleToggleJob(job.id)}
                  />
                  <div className="mvc-import-item-info">
                    <strong>{job.company_name || job.company}</strong>
                    <span>{job.title || job.job_title}</span>
                    {job.application_submitted_at && (
                      <small>Applied: {new Date(job.application_submitted_at).toLocaleDateString()}</small>
                    )}
                    {!job.application_submitted_at && job.created_at && (
                      <small>Created: {new Date(job.created_at).toLocaleDateString()}</small>
                    )}
                  </div>
                  <span className={`mvc-job-status ${job.status || 'interested'}`}>
                    {job.status || 'interested'}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
        <div className="mvc-modal-footer">
          <button className="mvc-btn mvc-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="mvc-btn mvc-btn-primary" 
            onClick={handleSubmit}
            disabled={selectedJobIds.length === 0 || importing}
          >
            {importing ? 'Importing...' : `Import ${selectedJobIds.length} Application${selectedJobIds.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}