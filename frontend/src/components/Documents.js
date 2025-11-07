import React, { useEffect, useState } from 'react';
import { materialsAPI } from '../services/api';
import './Education.css'; // Reuse Education styling
import Icon from './Icon';

const defaultForm = {
  document_type: 'resume',
  document_name: '',
  version_number: '1',
  file: null
};

const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [filteredDocs, setFilteredDocs] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'resume', 'cover_letter'
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    // Apply filter
    if (filter === 'all') {
      setFilteredDocs(documents);
    } else {
      setFilteredDocs(documents.filter(doc => doc.document_type === filter));
    }
  }, [documents, filter]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await materialsAPI.listDocuments();
      setDocuments(data);
    } catch (e) {
      setError(e?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(defaultForm);
    setFieldErrors({});
    setShowForm(false);
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = (file) => {
    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      setFieldErrors((prev) => ({ ...prev, file: 'Only PDF and Word documents are allowed' }));
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, file: 'File size must be less than 10MB' }));
      return;
    }

    setForm((prev) => ({ ...prev, file }));
    if (fieldErrors.file) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n.file; return n; });
    }

    // Auto-fill document name if empty
    if (!form.document_name) {
      setForm((prev) => ({ ...prev, document_name: file.name.replace(/\.[^/.]+$/, '') }));
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.document_name.trim()) errs.document_name = 'Document name is required';
    if (!form.document_type) errs.document_type = 'Document type is required';
    if (!form.file) errs.file = 'Please select a file';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setError('');

    try {
      await materialsAPI.uploadDocument(form);
      await loadDocuments();
      resetForm();
    } catch (e) {
      setError(e?.message || 'Failed to upload document');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }

    try {
      await materialsAPI.deleteDocument(id);
      await loadDocuments();
      setDeleteConfirm(null);
    } catch (e) {
      setError(e?.message || 'Failed to delete document');
    }
  };

  const handleDownload = (doc) => {
    const url = materialsAPI.getDownloadUrl(doc.id);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.document_name || 'document';
    // Add auth token to the request
    const token = localStorage.getItem('firebaseToken');
    if (token) {
      fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => response.blob())
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch(err => {
        setError('Failed to download document');
        console.error('Download error:', err);
      });
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const getTypeLabel = (type) => {
    const labels = {
      resume: 'Resume',
      cover_letter: 'Cover Letter',
      portfolio: 'Portfolio',
      cert: 'Certificate'
    };
    return labels[type] || type;
  };

  const getTypeBadgeClass = (type) => {
    const classes = {
      resume: 'badge-resume',
      cover_letter: 'badge-cover',
      portfolio: 'badge-portfolio',
      cert: 'badge-cert'
    };
    return classes[type] || 'badge-default';
  };

  if (loading) {
    return (
      <div className="education-container">
        <div className="loading-spinner">
          <Icon name="spinner" size="lg" className="spin" />
          <p>Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="education-container">
      <div className="education-header">
        <h1><Icon name="file-text" size="lg" /> Application Materials</h1>
        <button
          className="btn-primary"
          onClick={() => setShowForm(!showForm)}
          disabled={saving}
        >
          <Icon name={showForm ? 'clear' : 'upload'} />
          {showForm ? 'Cancel' : 'Upload Document'}
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <Icon name="info" /> {error}
          <button onClick={() => setError('')} className="btn-icon">
            <Icon name="clear" size="sm" />
          </button>
        </div>
      )}

      {showForm && (
        <div className="education-form-card">
          <h2>Upload New Document</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="document_type">
                  Document Type <span className="required">*</span>
                </label>
                <select
                  id="document_type"
                  name="document_type"
                  value={form.document_type}
                  onChange={onChange}
                  className={fieldErrors.document_type ? 'error' : ''}
                >
                  <option value="resume">Resume</option>
                  <option value="cover_letter">Cover Letter</option>
                  <option value="portfolio">Portfolio</option>
                  <option value="cert">Certificate</option>
                </select>
                {fieldErrors.document_type && (
                  <span className="error-text">{fieldErrors.document_type}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="version_number">Version Number</label>
                <input
                  type="text"
                  id="version_number"
                  name="version_number"
                  value={form.version_number}
                  onChange={onChange}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="document_name">
                Document Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="document_name"
                name="document_name"
                value={form.document_name}
                onChange={onChange}
                placeholder="e.g., Software Engineer Resume 2024"
                className={fieldErrors.document_name ? 'error' : ''}
              />
              {fieldErrors.document_name && (
                <span className="error-text">{fieldErrors.document_name}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="file">
                File <span className="required">*</span>
              </label>
              <div
                className={`file-upload-zone ${dragActive ? 'drag-active' : ''} ${fieldErrors.file ? 'error' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="file"
                  name="file"
                  onChange={onFileChange}
                  accept=".pdf,.doc,.docx"
                  style={{ display: 'none' }}
                />
                <label htmlFor="file" className="file-upload-label">
                  <Icon name="upload" size="xl" />
                  <p>
                    {form.file ? (
                      <>
                        <strong>{form.file.name}</strong>
                        <br />
                        {formatFileSize(form.file.size)}
                      </>
                    ) : (
                      <>
                        Drag and drop your file here or click to browse
                        <br />
                        <small>PDF or Word documents only, max 10MB</small>
                      </>
                    )}
                  </p>
                </label>
              </div>
              {fieldErrors.file && (
                <span className="error-text">{fieldErrors.file}</span>
              )}
            </div>

            <div className="form-actions">
              <button type="button" onClick={resetForm} className="btn-secondary" disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    <Icon name="spinner" className="spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <Icon name="upload" /> Upload
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="education-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Documents ({documents.length})
        </button>
        <button
          className={`filter-btn ${filter === 'resume' ? 'active' : ''}`}
          onClick={() => setFilter('resume')}
        >
          Resumes ({documents.filter(d => d.document_type === 'resume').length})
        </button>
        <button
          className={`filter-btn ${filter === 'cover_letter' ? 'active' : ''}`}
          onClick={() => setFilter('cover_letter')}
        >
          Cover Letters ({documents.filter(d => d.document_type === 'cover_letter').length})
        </button>
      </div>

      <div className="education-list">
        {filteredDocs.length === 0 ? (
          <div className="empty-state">
            <Icon name="file-text" size="xl" />
            <p>No {filter !== 'all' ? getTypeLabel(filter).toLowerCase() + 's' : 'documents'} yet</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              <Icon name="upload" /> Upload Your First Document
            </button>
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div key={doc.id} className="education-item">
              <div className="education-item-header">
                <div className="education-title">
                  <Icon name="file" size="md" />
                  <h3>{doc.document_name}</h3>
                  <span className={`badge ${getTypeBadgeClass(doc.document_type)}`}>
                    {getTypeLabel(doc.document_type)} v{doc.version_number}
                  </span>
                </div>
                <div className="education-actions">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="btn-icon"
                    title="Download"
                  >
                    <Icon name="download" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className={`btn-icon ${deleteConfirm === doc.id ? 'confirm-delete' : ''}`}
                    title={deleteConfirm === doc.id ? 'Click again to confirm' : 'Delete'}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
              <div className="education-item-details">
                <p className="education-date">
                  <Icon name="calendar" size="sm" /> Uploaded {formatDate(doc.uploaded_at)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Documents;
