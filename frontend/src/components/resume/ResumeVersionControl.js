/**
 * UC-052: Resume Version Control
 * Manage multiple versions of resumes with version history and comparison
 */
import React, { useState, useEffect } from 'react';
import { resumeVersionAPI, feedbackAPI } from '../../services/api';
import Icon from '../common/Icon';
import ShareResumeModal from './ShareResumeModal';
import FeedbackPanel from './FeedbackPanel';
import './ResumeVersionControl.css';

// Helper functions exported for unit testing
const groupVersionsByResume = (allVersions) => {
  // Group versions by source_job_id or parent relationships
  const groups = {};

  // First pass: group by job
  allVersions.forEach(version => {
    const key = version.source_job_id || 'generic';
    if (!groups[key]) {
      groups[key] = {
        id: key,
        title: version.source_job_title || 'Generic Resume',
        company: version.source_job_company || '',
        versions: []
      };
    }
    groups[key].versions.push(version);
  });

  // Sort versions within each group by created_at (newest first)
  Object.values(groups).forEach(group => {
    group.versions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  });

  return Object.values(groups);
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatChangeValue = (value) => {
  if (value === null || value === undefined) {
    return '(empty)';
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      if (value.length === 0) return '(empty list)';
      if (value.every(v => typeof v === 'string')) return value.join(', ');
      return `${value.length} item${value.length !== 1 ? 's' : ''}`;
    }
    const keys = Object.keys(value);
    if (keys.length === 0) return '(empty)';
    if (keys.length <= 3) return keys.map(k => `${k}: ${String(value[k]).substring(0, 50)}`).join(', ');
    return `${keys.length} fields`;
  }
  const str = String(value);
  if (str.length > 200) return str.substring(0, 200) + '...';
  return str;
};

const formatFieldName = (field) => {
  return field
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

const ResumeVersionControl = () => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  
  // Grouping and expansion states
  const [groupedResumes, setGroupedResumes] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  
  // Selected versions for operations
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [compareVersion1, setCompareVersion1] = useState(null);
  const [compareVersion2, setCompareVersion2] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showVersionDetailsModal, setShowVersionDetailsModal] = useState(false);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);
  
  // Form states
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDescription, setNewVersionDescription] = useState('');
  const [versionHistory, setVersionHistory] = useState(null);
  const [selectedResumeGroup, setSelectedResumeGroup] = useState(null);
  const [selectedVersionDetails, setSelectedVersionDetails] = useState(null);
  const [revertTarget, setRevertTarget] = useState(null);
  const [versionToShare, setVersionToShare] = useState(null);
  const [versionForFeedback, setVersionForFeedback] = useState(null);
  const [incorporatedFeedback, setIncorporatedFeedback] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  
  // Merge form states
  const [mergeSource, setMergeSource] = useState(null);
  const [mergeTarget, setMergeTarget] = useState(null);
  const [mergeFields, setMergeFields] = useState([]);
  const [createNewOnMerge, setCreateNewOnMerge] = useState(true);
  const [newMergeName, setNewMergeName] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  
  // Edit form states
  const [editingVersion, setEditingVersion] = useState(null);
  const [editVersionName, setEditVersionName] = useState('');
  const [editVersionDescription, setEditVersionDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadVersions();
  }, [includeArchived]);

  useEffect(() => {
    // Group versions by resume (based on job, parent relationships, or content)
    if (versions.length > 0) {
      const groups = groupVersionsByResume(versions);
      setGroupedResumes(groups);
    } else {
      setGroupedResumes([]);
    }
  }, [versions]);

  const toggleGroupExpansion = (groupId) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const loadVersions = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await resumeVersionAPI.listVersions(includeArchived);
      setVersions(data.versions || []);
    } catch (err) {
      setError(err.message || 'Failed to load resume versions');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (versionId) => {
    try {
      await resumeVersionAPI.setDefault(versionId);
      setSuccess('Default version updated successfully');
      loadVersions();
    } catch (err) {
      setError(err.message || 'Failed to set default version');
    }
  };

  const handleArchive = async (versionId) => {
    try {
      await resumeVersionAPI.archiveVersion(versionId);
      setSuccess('Version archived successfully');
      loadVersions();
    } catch (err) {
      // Normalize error message coming from API helper which may throw strings
      const msg = err?.response?.data?.error || err?.message || (typeof err === 'string' ? err : null) || 'Failed to archive version';
      setError(msg);
    }
  };

  const handleRestore = async (versionId) => {
    try {
      await resumeVersionAPI.restoreVersion(versionId);
      setSuccess('Version restored successfully');
      loadVersions();
    } catch (err) {
      setError(err.message || 'Failed to restore version');
    }
  };

  const handleDelete = async (versionId) => {
    if (!window.confirm('Are you sure you want to delete this version? This action cannot be undone.')) {
      return;
    }
    
    try {
      await resumeVersionAPI.deleteVersion(versionId);
      setSuccess('Version deleted successfully');
      loadVersions();
    } catch (err) {
      setError(err.message || 'Failed to delete version');
    }
  };

  const handleDuplicate = async (versionId) => {
    const newName = prompt('Enter name for the duplicated version:');
    if (!newName) return;
    
    try {
      await resumeVersionAPI.duplicateVersion(versionId, newName);
      setSuccess('Version duplicated successfully');
      loadVersions();
    } catch (err) {
      setError(err.message || 'Failed to duplicate version');
    }
  };

  const handleCompare = async () => {
    if (!compareVersion1 || !compareVersion2) {
      setError('Please select two versions to compare');
      return;
    }
    
    try {
      const result = await resumeVersionAPI.compareVersions(compareVersion1, compareVersion2);
      setComparisonResult(result);
      setShowCompareModal(true);
    } catch (err) {
      setError(err.message || 'Failed to compare versions');
    }
  };

  const handleViewHistory = async (versionId) => {
    try {
      const history = await resumeVersionAPI.getVersionHistory(versionId);
      setVersionHistory(history);
      setShowHistoryModal(true);
    } catch (err) {
      setError(err.message || 'Failed to load version history');
    }
  };

  const handleViewVersionDetails = async (version) => {
    setSelectedVersionDetails(version);
    setShowVersionDetailsModal(true);
    
    // Load feedback incorporated in this version
    setLoadingFeedback(true);
    try {
      const data = await feedbackAPI.listFeedback({ 
        incorporated_in_version_id: version.id 
      });
      setIncorporatedFeedback(data.feedback || []);
    } catch (err) {
      console.error('Failed to load incorporated feedback:', err);
      setIncorporatedFeedback([]);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleRevert = (version) => {
    setRevertTarget(version);
    setShowRevertModal(true);
  };

  const handleConfirmRevert = async () => {
    if (!revertTarget) return;

    try {
      // Create a new version based on the revert target
      const newName = prompt('Enter name for the reverted version:', `${revertTarget.version_name} (Reverted)`);
      if (!newName) return;

      await resumeVersionAPI.duplicateVersion(revertTarget.id, newName);
      setSuccess(`Successfully reverted to ${revertTarget.version_name}`);
      setShowRevertModal(false);
      setRevertTarget(null);
      loadVersions();
    } catch (err) {
      setError(err.message || 'Failed to revert version');
    }
  };

  const handleShareResume = (version) => {
    setVersionToShare(version);
    setShowShareModal(true);
  };

  const handleShareCreated = (share) => {
    setSuccess(`Share link created successfully!`);
    setShowShareModal(false);
    setVersionToShare(null);
  };

  const handleViewFeedback = (version) => {
    setVersionForFeedback(version);
    setShowFeedbackPanel(true);
  };

  const handleFeedbackPanelClose = () => {
    setShowFeedbackPanel(false);
    setVersionForFeedback(null);
    // Refresh versions to update notification badges
    loadVersions();
  };

  const handleOpenMergeModal = (version) => {
    setMergeSource(version);
    setMergeTarget(null);
    setMergeFields([]);
    setCreateNewOnMerge(true);
    setNewMergeName(`Merged - ${version.version_name}`);
    setShowMergeModal(true);
  };

  const handleMergeVersions = async () => {
    if (!mergeSource || !mergeTarget) {
      setError('Please select both source and target versions');
      return;
    }

    if (createNewOnMerge && !newMergeName.trim()) {
      setError('Please provide a name for the merged version');
      return;
    }

    setIsMerging(true);
    setError('');

    try {
      await resumeVersionAPI.mergeVersions(
        mergeSource.id,
        mergeTarget.id,
        mergeFields,
        createNewOnMerge,
        createNewOnMerge ? newMergeName.trim() : null
      );

      setSuccess('Versions merged successfully');
      setShowMergeModal(false);
      setMergeSource(null);
      setMergeTarget(null);
      setMergeFields([]);
      setNewMergeName('');
      loadVersions();
    } catch (err) {
      setError(err.message || 'Failed to merge versions');
    } finally {
      setIsMerging(false);
    }
  };

  const handleEditVersion = (version) => {
    setEditingVersion(version);
    setEditVersionName(version.version_name);
    setEditVersionDescription(version.description || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editVersionName.trim()) {
      setError('Version name is required');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await resumeVersionAPI.updateVersion(editingVersion.id, {
        version_name: editVersionName.trim(),
        description: editVersionDescription.trim(),
        // Keep existing content unchanged
        content: editingVersion.content,
        latex_content: editingVersion.latex_content,
      });

      setSuccess('Version updated successfully');
      setShowEditModal(false);
      setEditingVersion(null);
      setEditVersionName('');
      setEditVersionDescription('');
      loadVersions();
    } catch (err) {
      setError(err.message || 'Failed to update version');
    } finally {
      setIsSaving(false);
    }
  };

  

  return (
    <div className="resume-version-control">
      <div className="page-header">
        <div className="header-content">
          <h1><Icon name="file" size="lg" /> Resume Version Control</h1>
          <p>Manage and track different versions of your resume</p>
        </div>
        <div className="header-actions">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Show Archived
          </label>
        </div>
      </div>

      {error && (
        <div className="message error-message">
          <Icon name="info" size="sm" /> {error}
          <button className="close-msg" onClick={() => setError('')}>×</button>
        </div>
      )}

      {success && (
        <div className="message success-message">
          <Icon name="check" size="sm" /> {success}
          <button className="close-msg" onClick={() => setSuccess('')}>×</button>
        </div>
      )}

      {/* Comparison Controls */}
      <div className="compare-section">
        <h3>Compare Versions</h3>
        <div className="compare-controls">
          <select
            value={compareVersion1 || ''}
            onChange={(e) => setCompareVersion1(e.target.value)}
          >
            <option value="">Select first version...</option>
            {versions.map(v => (
              <option key={v.id} value={v.id}>
                {v.version_name} {v.is_default ? '(Default)' : ''}
              </option>
            ))}
          </select>
          
          <span className="vs-text">vs</span>
          
          <select
            value={compareVersion2 || ''}
            onChange={(e) => setCompareVersion2(e.target.value)}
          >
            <option value="">Select second version...</option>
            {versions.map(v => (
              <option key={v.id} value={v.id}>
                {v.version_name} {v.is_default ? '(Default)' : ''}
              </option>
            ))}
          </select>
          
          <button
            className="btn-primary"
            onClick={handleCompare}
            disabled={!compareVersion1 || !compareVersion2}
          >
            <Icon name="compare" size="sm" /> Compare
          </button>
        </div>
      </div>

      {/* Grouped Resumes Display */}
      <div className="resumes-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner-large"></div>
            <p>Loading versions...</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="empty-state">
            <Icon name="file" size="lg" />
            <h3>No Resume Versions Yet</h3>
            <p>Create resume versions from the AI Resume Generator to start tracking different versions.</p>
          </div>
        ) : (
          <div className="resumes-grid">
            {groupedResumes.map(group => {
              const isExpanded = expandedGroups.has(group.id);
              const latestVersion = group.versions[0];
              const versionCount = group.versions.length;
              
              return (
                <div key={group.id} className="resume-group">
                  <div 
                    className="resume-group-header"
                    onClick={() => toggleGroupExpansion(group.id)}
                  >
                    <div className="group-info">
                      <div className="group-title">
                        <Icon name="file" size="md" />
                        <h3>{group.title}</h3>
                      </div>
                      {group.company && (
                        <p className="group-company">{group.company}</p>
                      )}
                      <div className="group-meta">
                        <span className="version-count">
                          <Icon name="layers" size="sm" />
                          {versionCount} version{versionCount !== 1 ? 's' : ''}
                        </span>
                        <span className="last-updated">
                          <Icon name="clock" size="sm" />
                          Last updated {formatDate(latestVersion.updated_at || latestVersion.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="expand-icon">
                      <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} size="md" />
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="versions-list">
                      {group.versions.map((version, idx) => (
                        <div
                          key={version.id}
                          className={`version-item ${version.is_default ? 'default' : ''} ${version.is_archived ? 'archived' : ''}`}
                        >
                          <div className="version-item-header">
                            <div className="version-number">v{group.versions.length - idx}</div>
                            <div className="version-info">
                              <div className="version-title">
                                <h4>{version.version_name}</h4>
                                <div className="version-badges">
                                  {version.is_default && (
                                    <span className="badge default-badge">
                                      <Icon name="star" size="sm" /> Default
                                    </span>
                                  )}
                                  {version.is_archived && (
                                    <span className="badge archived-badge">
                                      <Icon name="archive" size="sm" /> Archived
                                    </span>
                                  )}
                                  {version.generated_by_ai && (
                                    <span className="badge ai-badge">
                                      <Icon name="stars" size="sm" /> AI
                                    </span>
                                  )}
                                </div>
                              </div>
                              {version.description && (
                                <p className="version-desc">{version.description}</p>
                              )}
                              <div className="version-stats">
                                <span>
                                  <Icon name="calendar" size="sm" />
                                  {formatDate(version.created_at)}
                                </span>
                                <span>
                                  <Icon name="link" size="sm" />
                                  {version.application_count} app{version.application_count !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="version-actions">
                            <button
                              className="action-btn share-btn"
                              onClick={() => handleShareResume(version)}
                              title="Share for feedback"
                            >
                              <Icon name="link" size="sm" />
                            </button>
                            
                            <button
                              className="action-btn feedback-btn"
                              onClick={() => handleViewFeedback(version)}
                              title="View feedback"
                            >
                              <Icon name="clipboard" size="sm" />
                              {version.unresolved_feedback_count > 0 && (
                                <span className="notification-badge">
                                  {version.unresolved_feedback_count}
                                </span>
                              )}
                            </button>
                            
                            <button
                              className="action-btn view-btn"
                              onClick={() => handleViewVersionDetails(version)}
                              title="View details"
                            >
                              <Icon name="eye" size="sm" />
                            </button>
                            
                            <button
                              className="action-btn"
                              onClick={() => handleEditVersion(version)}
                              title="Edit"
                            >
                              <Icon name="edit" size="sm" />
                            </button>
                            
                            {!version.is_default && !version.is_archived && (
                              <button
                                className="action-btn"
                                onClick={() => handleSetDefault(version.id)}
                                title="Set as default"
                              >
                                <Icon name="star" size="sm" />
                              </button>
                            )}
                            
                            <button
                              className="action-btn"
                              onClick={() => handleRevert(version)}
                              title="Revert to this version"
                            >
                              <Icon name="rotateLeft" size="sm" />
                            </button>
                            
                            <button
                              className="action-btn"
                              onClick={() => handleOpenMergeModal(version)}
                              title="Merge with another version"
                            >
                              <Icon name="gitMerge" size="sm" />
                            </button>
                            
                            <button
                              className="action-btn"
                              onClick={() => handleViewHistory(version.id)}
                              title="View history"
                            >
                              <Icon name="history" size="sm" />
                            </button>
                            
                            <button
                              className="action-btn"
                              onClick={() => handleDuplicate(version.id)}
                              title="Duplicate"
                            >
                              <Icon name="copy" size="sm" />
                            </button>
                            
                            {!version.is_archived ? (
                              <button
                                className="action-btn"
                                onClick={() => handleArchive(version.id)}
                                title={version.is_default ? "Cannot archive default version" : "Archive"}
                                disabled={version.is_default}
                              >
                                <Icon name="archive" size="sm" />
                              </button>
                            ) : (
                              <button
                                className="action-btn"
                                onClick={() => handleRestore(version.id)}
                                title="Restore"
                              >
                                <Icon name="refresh" size="sm" />
                              </button>
                            )}
                            
                            <button
                              className="action-btn delete-btn"
                              onClick={() => handleDelete(version.id)}
                              title="Delete"
                            >
                              <Icon name="trash" size="sm" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comparison Modal */}
      {showCompareModal && comparisonResult && (
        <div className="modal-overlay" onClick={() => setShowCompareModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Icon name="compare" size="sm" /> Version Comparison</h3>
              <button className="close-btn" onClick={() => setShowCompareModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="comparison-grid">
                <div className="comparison-side">
                  <h4>{comparisonResult.version1.version_name}</h4>
                  <p className="version-date">Created: {formatDate(comparisonResult.version1.created_at)}</p>
                </div>
                <div className="comparison-side">
                  <h4>{comparisonResult.version2.version_name}</h4>
                  <p className="version-date">Created: {formatDate(comparisonResult.version2.created_at)}</p>
                </div>
              </div>
              
              <div className="differences-section">
                <h4><Icon name="info" size="sm" /> Differences ({comparisonResult.diff_count})</h4>
                {comparisonResult.differences.length === 0 ? (
                  <p className="no-diff">No differences found - versions are identical</p>
                ) : (
                  <div className="differences-list">
                    {comparisonResult.differences.map((diff, idx) => (
                      <div key={idx} className={`diff-item ${diff.type}`}>
                        <div className="diff-header">
                          <Icon name="edit" size="sm" />
                          <strong>{formatFieldName(diff.path)}</strong>
                          <span className={`diff-badge ${diff.type}`}>
                            {diff.type === 'changed' ? 'Modified' : diff.type === 'added' ? 'Added' : 'Removed'}
                          </span>
                        </div>
                        <div className="diff-values">
                          {diff.type === 'changed' && (
                            <div className="side-by-side-diff">
                              <div className="diff-column old">
                                <span className="label">Before:</span>
                                <div className="value-box">{formatChangeValue(diff.version1)}</div>
                              </div>
                              <Icon name="arrowRight" size="sm" className="arrow-icon" />
                              <div className="diff-column new">
                                <span className="label">After:</span>
                                <div className="value-box">{formatChangeValue(diff.version2)}</div>
                              </div>
                            </div>
                          )}
                          {diff.type === 'added' && (
                            <div className="diff-column new">
                              <span className="label">Added:</span>
                              <div className="value-box">{formatChangeValue(diff.version2)}</div>
                            </div>
                          )}
                          {diff.type === 'removed' && (
                            <div className="diff-column old">
                              <span className="label">Removed:</span>
                              <div className="value-box">{formatChangeValue(diff.version1)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCompareModal(false)}>
                Close
              </button>
              {comparisonResult.differences.length > 0 && (
                <button 
                  className="btn-primary" 
                  onClick={() => {
                    const v1 = versions.find(v => v.id === compareVersion1);
                    const v2 = versions.find(v => v.id === compareVersion2);
                    setMergeSource(v1);
                    setMergeTarget(v2);
                    setMergeFields([]);
                    setCreateNewOnMerge(true);
                    setNewMergeName(`Merged - ${v1?.version_name} + ${v2?.version_name}`);
                    setShowCompareModal(false);
                    setShowMergeModal(true);
                  }}
                >
                  <Icon name="gitMerge" size="sm" /> Merge These Versions
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Version Modal */}
      {showEditModal && editingVersion && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Icon name="edit" size="sm" /> Edit Version</h3>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="edit-version-name">
                  Version Name <span className="required">*</span>
                </label>
                <input
                  id="edit-version-name"
                  type="text"
                  value={editVersionName}
                  onChange={(e) => setEditVersionName(e.target.value)}
                  placeholder="e.g., Software Engineer - Google v2"
                  maxLength={200}
                  disabled={isSaving}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-version-description">
                  Description
                </label>
                <textarea
                  id="edit-version-description"
                  value={editVersionDescription}
                  onChange={(e) => setEditVersionDescription(e.target.value)}
                  placeholder="Optional notes about this version"
                  rows={4}
                  maxLength={500}
                  disabled={isSaving}
                />
              </div>

              <div className="info-box">
                <Icon name="info" size="sm" />
                <p>Changes to the version name and description will be tracked in the version history.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowEditModal(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSaveEdit}
                disabled={isSaving || !editVersionName.trim()}
              >
                {isSaving ? (
                  <>
                    <Icon name="loader" size="sm" /> Saving...
                  </>
                ) : (
                  <>
                    <Icon name="save" size="sm" /> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && versionHistory && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Icon name="history" size="sm" /> Version History</h3>
              <button className="close-btn" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="history-version-header">
                <h4>{versionHistory.version.version_name}</h4>
                {versionHistory.version.description && (
                  <p className="version-desc">{versionHistory.version.description}</p>
                )}
              </div>
              
              {versionHistory.changes && versionHistory.changes.length > 0 ? (
                <div className="history-section">
                  <h5><Icon name="clock" size="sm" /> Changes Made ({versionHistory.changes.length})</h5>
                  <div className="simple-timeline">
                    {versionHistory.changes.map((change, idx) => (
                      <div key={idx} className="timeline-item">
                        <div className="timeline-marker"></div>
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <span className="timeline-type">
                              {change.change_type === 'created' ? 'Version Created' : 'Version Updated'}
                            </span>
                            <span className="timeline-date">
                              {formatDate(change.created_at)}
                            </span>
                          </div>
                          {change.change_type === 'updated' && Object.keys(change.changes).length > 0 && (
                            <div className="timeline-summary">
                              Modified: {Object.keys(change.changes).map(formatFieldName).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="no-changes-message">
                  <Icon name="info" size="lg" />
                  <p>No changes recorded for this version yet.</p>
                </div>
              )}
              
              {versionHistory.parents.length > 0 && (
                <div className="history-section">
                  <h5><Icon name="gitBranch" size="sm" /> Parent Versions</h5>
                  <ul className="history-list">
                    {versionHistory.parents.map((parent, idx) => (
                      <li key={idx}>
                        <Icon name="file" size="sm" />
                        {parent.version_name} - {formatDate(parent.created_at)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {versionHistory.children.length > 0 && (
                <div className="history-section">
                  <h5><Icon name="gitMerge" size="sm" /> Derived Versions</h5>
                  <ul className="history-list">
                    {versionHistory.children.map((child, idx) => (
                      <li key={idx}>
                        <Icon name="file" size="sm" />
                        {child.version_name} - {formatDate(child.created_at)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowHistoryModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version Details Modal */}
      {showVersionDetailsModal && selectedVersionDetails && (
        <div className="modal-overlay" onClick={() => setShowVersionDetailsModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Icon name="file" size="sm" /> Version Details</h3>
              <button className="close-btn" onClick={() => setShowVersionDetailsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="version-details-grid">
                <div className="detail-section">
                  <h4>{selectedVersionDetails.version_name}</h4>
                  {selectedVersionDetails.description && (
                    <p className="detail-description">{selectedVersionDetails.description}</p>
                  )}
                  
                  <div className="detail-meta">
                    {selectedVersionDetails.source_job_title && (
                      <div className="detail-item">
                        <strong>Job:</strong>
                        <span>{selectedVersionDetails.source_job_company} - {selectedVersionDetails.source_job_title}</span>
                      </div>
                    )}
                    <div className="detail-item">
                      <strong>Created:</strong>
                      <span>{formatDate(selectedVersionDetails.created_at)}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Last Updated:</strong>
                      <span>{formatDate(selectedVersionDetails.updated_at || selectedVersionDetails.created_at)}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Applications:</strong>
                      <span>{selectedVersionDetails.application_count}</span>
                    </div>
                    {selectedVersionDetails.is_default && (
                      <div className="detail-item">
                        <strong>Status:</strong>
                        <span className="badge default-badge"><Icon name="star" size="sm" /> Default Version</span>
                      </div>
                    )}
                    {selectedVersionDetails.generated_by_ai && (
                      <div className="detail-item">
                        <strong>Source:</strong>
                        <span className="badge ai-badge"><Icon name="stars" size="sm" /> AI Generated</span>
                      </div>
                    )}
                  </div>
                  
                  {selectedVersionDetails.content && (
                    <div className="detail-content">
                      <h5>Content Preview</h5>
                      <pre className="content-preview">
                        {JSON.stringify(selectedVersionDetails.content, null, 2).substring(0, 1000)}
                        {JSON.stringify(selectedVersionDetails.content).length > 1000 && '...'}
                      </pre>
                    </div>
                  )}

                  {/* Incorporated Feedback History */}
                  <div className="incorporated-feedback-section">
                    <h5>
                      <Icon name="git-merge" size="sm" /> Feedback Incorporated in This Version
                    </h5>
                    {loadingFeedback ? (
                      <div className="loading-feedback">
                        <Icon name="loader" size="sm" /> Loading feedback...
                      </div>
                    ) : incorporatedFeedback.length === 0 ? (
                      <p className="no-feedback">No feedback has been incorporated in this version yet.</p>
                    ) : (
                      <div className="feedback-history-list">
                        {incorporatedFeedback.map(fb => (
                          <div key={fb.id} className="feedback-history-item">
                            <div className="feedback-history-header">
                              <div className="reviewer-info">
                                <Icon name="user" size="sm" />
                                <strong>{fb.reviewer_name || 'Anonymous'}</strong>
                                {fb.reviewer_title && (
                                  <span className="reviewer-title"> • {fb.reviewer_title}</span>
                                )}
                              </div>
                              {fb.rating && (
                                <div className="rating-display">
                                  {[...Array(fb.rating)].map((_, i) => (
                                    <Icon key={i} name="star" size="sm" className="star-filled" />
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="feedback-history-body">
                              <p>{fb.overall_feedback}</p>
                              {fb.resolution_notes && (
                                <div className="resolution-note">
                                  <Icon name="check-circle" size="sm" />
                                  <span>{fb.resolution_notes}</span>
                                </div>
                              )}
                            </div>
                            <div className="feedback-history-meta">
                              <span className="feedback-date">
                                Resolved: {new Date(fb.resolved_at || fb.created_at).toLocaleDateString()}
                              </span>
                              {fb.comment_count > 0 && (
                                <span className="comment-count">
                                  <Icon name="comment" size="sm" /> {fb.comment_count} comments
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowVersionDetailsModal(false)}>
                Close
              </button>
              <button className="btn-primary" onClick={() => {
                setShowVersionDetailsModal(false);
                handleEditVersion(selectedVersionDetails);
              }}>
                <Icon name="edit" size="sm" /> Edit Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert Confirmation Modal */}
      {showRevertModal && revertTarget && (
        <div className="modal-overlay" onClick={() => setShowRevertModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Icon name="rotateLeft" size="sm" /> Revert to Previous Version</h3>
              <button className="close-btn" onClick={() => setShowRevertModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="warning-box">
                <Icon name="info" size="md" />
                <div>
                  <h4>Are you sure you want to revert?</h4>
                  <p>This will create a new version based on <strong>{revertTarget.version_name}</strong>.</p>
                  <p>Your current versions will not be affected, but the new version will be set as default.</p>
                </div>
              </div>
              
              <div className="revert-details">
                <h5>Version to restore:</h5>
                <div className="version-summary">
                  <strong>{revertTarget.version_name}</strong>
                  {revertTarget.description && <p>{revertTarget.description}</p>}
                  <p className="meta-text">Created: {formatDate(revertTarget.created_at)}</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRevertModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleConfirmRevert}>
                <Icon name="rotateLeft" size="sm" /> Confirm Revert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Merge Modal */}
      {showMergeModal && mergeSource && (
        <div className="modal-overlay" onClick={() => setShowMergeModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Icon name="gitMerge" size="sm" /> Merge Resume Versions</h3>
              <button className="close-btn" onClick={() => setShowMergeModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="merge-form">
                <div className="info-box">
                  <Icon name="info" size="sm" />
                  <p>Merge changes from different versions to create a combined resume. Select which fields to merge.</p>
                </div>
                
                <div className="form-group">
                  <label>Source Version (merge from)</label>
                  <div className="selected-version">
                    <Icon name="file" size="sm" />
                    <strong>{mergeSource.version_name}</strong>
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="merge-target">Target Version (merge into) <span className="required">*</span></label>
                  <select
                    id="merge-target"
                    value={mergeTarget?.id || ''}
                    onChange={(e) => {
                      const target = versions.find(v => v.id === e.target.value);
                      setMergeTarget(target);
                    }}
                    disabled={isMerging}
                  >
                    <option value="">-- Select target version --</option>
                    {versions.filter(v => v.id !== mergeSource.id).map(v => (
                      <option key={v.id} value={v.id}>
                        {v.version_name} {v.is_default ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                {mergeTarget && (
                  <>
                    <div className="form-group">
                      <label>Merge Options</label>
                      <div className="checkbox-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={createNewOnMerge}
                            onChange={(e) => setCreateNewOnMerge(e.target.checked)}
                            disabled={isMerging}
                          />
                          Create new version (recommended)
                        </label>
                        <p className="help-text">
                          {createNewOnMerge 
                            ? 'A new version will be created with merged content' 
                            : 'Target version will be modified directly'}
                        </p>
                      </div>
                    </div>
                    
                    {createNewOnMerge && (
                      <div className="form-group">
                        <label htmlFor="merge-name">New Version Name <span className="required">*</span></label>
                        <input
                          id="merge-name"
                          type="text"
                          value={newMergeName}
                          onChange={(e) => setNewMergeName(e.target.value)}
                          placeholder="Enter name for merged version"
                          maxLength={200}
                          disabled={isMerging}
                        />
                      </div>
                    )}
                    
                    <div className="form-group">
                      <label>Fields to Merge</label>
                      <p className="help-text">
                        Leave empty to merge all fields, or select specific fields to merge
                      </p>
                      <div className="checkbox-group">
                        {['experience', 'education', 'skills', 'projects', 'summary'].map(field => (
                          <label key={field} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={mergeFields.includes(field)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setMergeFields([...mergeFields, field]);
                                } else {
                                  setMergeFields(mergeFields.filter(f => f !== field));
                                }
                              }}
                              disabled={isMerging}
                            />
                            {field.charAt(0).toUpperCase() + field.slice(1)}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowMergeModal(false)}
                disabled={isMerging}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleMergeVersions}
                disabled={isMerging || !mergeTarget || (createNewOnMerge && !newMergeName.trim())}
              >
                {isMerging ? (
                  <>
                    <Icon name="loader" size="sm" /> Merging...
                  </>
                ) : (
                  <>
                    <Icon name="gitMerge" size="sm" /> Merge Versions
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Resume Modal */}
      {showShareModal && versionToShare && (
        <ShareResumeModal
          version={versionToShare}
          onClose={() => {
            setShowShareModal(false);
            setVersionToShare(null);
          }}
          onShareCreated={handleShareCreated}
        />
      )}

      {/* Feedback Panel */}
      {showFeedbackPanel && versionForFeedback && (
        <div className="modal-overlay" onClick={handleFeedbackPanelClose}>
          <div className="modal-content feedback-modal" onClick={(e) => e.stopPropagation()}>
            <FeedbackPanel
              versionId={versionForFeedback.id}
              onClose={handleFeedbackPanelClose}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeVersionControl;
export { groupVersionsByResume, formatDate, formatChangeValue, formatFieldName };
