import React, { useEffect, useMemo, useRef, useState } from 'react';
import { projectsAPI } from '../services/api';
import './Projects.css';
import Icon from './Icon';

const emptyForm = {
  name: '',
  description: '',
  role: '',
  start_date: '',
  end_date: '',
  project_url: '',
  team_size: '',
  collaboration_details: '',
  outcomes: '',
  industry: '',
  category: '',
  status: 'completed',
  technologies_input: '', // comma-separated user input
  technologies: [],
  media: [],
};

const statusOptions = [
  { value: 'completed', label: 'Completed' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'planned', label: 'Planned' },
];

const Projects = () => {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const MAX_MEDIA_FILES = 12; // soft cap for previews

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const data = await projectsAPI.getProjects();
        setItems(sortProjects(data));
      } catch (e) {
        setError(e?.message || 'Failed to load projects');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const sortProjects = (arr) => {
    const toNum = (d) => (d ? Date.parse(d) : 0);
    return [...(arr || [])].sort((a, b) => {
      const aDate = toNum(a.start_date) || toNum(a.end_date);
      const bDate = toNum(b.start_date) || toNum(b.end_date);
      if (aDate !== bDate) return bDate - aDate;
      return (b.id || 0) - (a.id || 0);
    });
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setFieldErrors({});
    setEditingId(null);
    setShowForm(false);
  };

  const onChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'file') {
      // Append newly selected files (images only), dedupe, and cap
      const addFiles = (incoming) => {
        const next = [...(form.media || []), ...Array.from(incoming || [])].filter(
          (f) => f && f.type && f.type.startsWith('image/')
        );
        // Dedupe by name+size+lastModified
        const seen = new Set();
        const deduped = [];
        for (const f of next) {
          const key = `${f.name}-${f.size}-${f.lastModified}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(f);
          }
        }
        return deduped.slice(0, MAX_MEDIA_FILES);
      };
      setForm((prev) => ({ ...prev, media: addFiles(files) }));
      return;
    }
    if (name === 'status') {
      // Adjust dates based on selected status
      setForm((prev) => {
        const next = { ...prev, status: value };
        if (value === 'planned') {
          next.start_date = '';
          next.end_date = '';
        } else if (value === 'ongoing') {
          next.end_date = '';
        }
        return next;
      });
      // Clear any date-related field errors when status changes
      setFieldErrors((prev) => { const n = { ...prev }; delete n.start_date; delete n.end_date; return n; });
      return;
    }

    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  // Drag & drop handlers for media upload
  const onDropFiles = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    setIsDragging(false);
    const dt = ev.dataTransfer;
    if (!dt) return;
    const dropped = Array.from(dt.files || []).filter((f) => f.type?.startsWith('image/'));
    if (dropped.length === 0) return;
    setForm((prev) => {
      const existing = prev.media || [];
      const combined = [...existing, ...dropped];
      const seen = new Set();
      const deduped = [];
      for (const f of combined) {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(f);
        }
      }
      return { ...prev, media: deduped.slice(0, MAX_MEDIA_FILES) };
    });
  };

  const onDragOver = (ev) => {
    ev.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const onDragLeave = (ev) => {
    ev.preventDefault();
    setIsDragging(false);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const removeMediaAt = (idx) => {
    setForm((prev) => ({ ...prev, media: (prev.media || []).filter((_, i) => i !== idx) }));
  };

  const clearAllMedia = () => {
    setForm((prev) => ({ ...prev, media: [] }));
  };

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let i = -1;
    do {
      bytes = bytes / 1024;
      i++;
    } while (bytes >= 1024 && i < units.length - 1);
    return `${bytes.toFixed(bytes >= 100 ? 0 : bytes >= 10 ? 1 : 2)} ${units[i]}`;
  };

  // Generate preview URLs for selected images
  const previews = useMemo(() => {
    return (form.media || []).map((file) => ({ file, url: URL.createObjectURL(file) }));
  }, [form.media]);

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  const parseTechnologies = (input) => {
    if (!input) return [];
    return input.split(',').map((s) => s.trim()).filter(Boolean);
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Project name is required';
    // Dates: if both provided, start <= end
    if (form.start_date && form.end_date) {
      if (new Date(form.start_date) > new Date(form.end_date)) {
        errs.start_date = 'Start date cannot be after end date';
      }
    }
    if (form.team_size && Number(form.team_size) <= 0) {
      errs.team_size = 'Team size must be positive';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const toPayload = (data) => {
    const payload = { ...data };
    payload.technologies = parseTechnologies(payload.technologies_input);
    // Normalize numeric
    if (payload.team_size === '') delete payload.team_size;
    // Remove dates if disabled by status
    if (payload.status === 'planned') {
      delete payload.start_date;
      delete payload.end_date;
    } else if (payload.status === 'ongoing') {
      delete payload.end_date;
    }
    // Remove local-only fields
    delete payload.technologies_input;
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (editingId) {
        const updated = await projectsAPI.updateProject(editingId, payload);
        setItems((prev) => sortProjects((prev || []).map((i) => (i.id === editingId ? updated : i))));
      } else {
        const created = await projectsAPI.addProject(payload);
        setItems((prev) => sortProjects([...(prev || []), created]));
      }
      resetForm();
    } catch (e) {
      if (e?.details) setFieldErrors(e.details);
      setError(e?.message || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setShowForm(true);
    setForm({
      ...emptyForm,
      name: item.name || '',
      description: item.description || '',
      role: item.role || '',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      project_url: item.project_url || '',
      team_size: item.team_size ?? '',
      collaboration_details: item.collaboration_details || '',
      outcomes: item.outcomes || '',
      industry: item.industry || '',
      category: item.category || '',
      status: item.status || 'completed',
      technologies_input: (item.technologies || []).join(', '),
      technologies: item.technologies || [],
      media: [],
    });
    setFieldErrors({});
  };

  const handleDelete = async (id) => {
    try {
      await projectsAPI.deleteProject(id);
      setItems((prev) => (prev || []).filter((i) => i.id !== id));
      if (editingId === id) resetForm();
      setDeleteConfirm(null);
    } catch (e) {
      setError(e?.message || 'Failed to delete project');
    }
  };

  if (loading) {
    return <div className="projects-container">Loading projects...</div>;
  }

  return (
    <div className="projects-container">
      <div className="projects-page-header">
        <div className="page-backbar">
        <a
          className="btn-back"
          href="/dashboard"
          aria-label="Back to dashboard"
          title="Back to dashboard"
        >
          ← Back to Dashboard
        </a>
      </div>
        <h1 className="projects-page-title">Projects</h1>
        <div style={{ marginLeft: 'auto', marginTop: '6px' }}>
          <a className="btn-back" href="/projects/portfolio" title="View Portfolio" style={{ display: 'inline-block', marginTop: '6px' }}>
            View Portfolio →
          </a>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {!showForm && (
        <div className="projects-header">
          <h2><Icon name="folder" size="md" /> Your Projects</h2>
          <button
            className="add-button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            + Add Project
          </button>
        </div>
      )}

      {showForm && (
        <div className="projects-form-card">
          <div className="form-header">
            <h3>{editingId ? 'Edit Project' : 'Add New Project'}</h3>
            <button
              type="button"
              className="close-button"
              onClick={resetForm}
              aria-label="Close form"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">Project Name <span className="required">*</span></label>
            <input id="name" name="name" value={form.name} onChange={onChange} className={fieldErrors.name ? 'error' : ''} />
            {fieldErrors.name && <div className="error-message">{fieldErrors.name}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="role">Your Role</label>
            <input id="role" name="role" value={form.role} onChange={onChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="start_date">Start Date</label>
            <input
              id="start_date"
              type="date"
              name="start_date"
              value={form.start_date}
              onChange={onChange}
              disabled={form.status === 'planned'}
            />
          </div>
          <div className="form-group">
            <label htmlFor="end_date">End Date</label>
            <input
              id="end_date"
              type="date"
              name="end_date"
              value={form.end_date}
              onChange={onChange}
              disabled={form.status === 'planned' || form.status === 'ongoing'}
            />
            {fieldErrors.start_date && <div className="error-message">{fieldErrors.start_date}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" value={form.status} onChange={onChange}>
              {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="team_size">Team Size</label>
            <input id="team_size" type="number" min="1" name="team_size" value={form.team_size} onChange={onChange} />
            {fieldErrors.team_size && <div className="error-message">{fieldErrors.team_size}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="industry">Industry</label>
            <input id="industry" name="industry" value={form.industry} onChange={onChange} placeholder="e.g., Healthcare, Finance" />
          </div>
          <div className="form-group">
            <label htmlFor="category">Project Type</label>
            <input id="category" name="category" value={form.category} onChange={onChange} placeholder="e.g., Web App, Data Pipeline" />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="project_url">Project URL / Repository</label>
          <input id="project_url" name="project_url" value={form.project_url} onChange={onChange} placeholder="https://..." />
        </div>

        <div className="form-group">
          <label htmlFor="technologies_input">Technologies / Skills Used</label>
          <input id="technologies_input" name="technologies_input" value={form.technologies_input} onChange={onChange} placeholder="e.g., React, Django, PostgreSQL" />
          <div className="hint">Comma-separated list; we'll display them as tags.</div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={3} value={form.description} onChange={onChange} placeholder="High-level summary of the project" />
        </div>

        <div className="form-group">
          <label htmlFor="collaboration_details">Team & Collaboration Details</label>
          <textarea id="collaboration_details" name="collaboration_details" rows={3} value={form.collaboration_details} onChange={onChange} placeholder="Collaboration patterns, tools, responsibilities" />
        </div>

        <div className="form-group">
          <label htmlFor="outcomes">Outcomes & Achievements</label>
          <textarea id="outcomes" name="outcomes" rows={3} value={form.outcomes} onChange={onChange} placeholder="Results, metrics, impact" />
        </div>

        <div className="form-group">
          <label htmlFor="media">Screenshots (images)</label>
          <input
            id="media"
            ref={fileInputRef}
            type="file"
            name="media"
            multiple
            accept="image/*"
            onChange={onChange}
            style={{ display: 'none' }}
          />

          <div
            className={`upload-dropzone ${isDragging ? 'dragover' : ''}`}
            onClick={openFileDialog}
            onDragEnter={onDragOver}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDropFiles}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openFileDialog()}
            aria-label="Upload images by click or drag and drop"
          >
            <div className="upload-illustration" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7.5 10.5L12 6l4.5 4.5M12 6v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="upload-copy">
              <div className="upload-title">Drag & drop images here</div>
              <div className="upload-subtitle">or click to browse</div>
              <div className="upload-hint">PNG, JPG up to ~10MB each • {MAX_MEDIA_FILES} files max</div>
            </div>
            <div className="upload-actions">
              <button type="button" className="upload-browse" onClick={openFileDialog} aria-label="Browse files">
                Browse Files
              </button>
              {(form.media?.length || 0) > 0 && (
                <button type="button" className="upload-clear" onClick={clearAllMedia} aria-label="Clear selected images">
                  Clear
                </button>
              )}
            </div>
          </div>

          {(previews.length > 0) && (
            <div className="upload-previews">
              {previews.map((p, idx) => (
                <div key={`${p.file.name}-${p.file.size}-${p.file.lastModified}`} className="upload-preview-card">
                  <div className="upload-thumb">
                    <img src={p.url} alt={p.file.name} />
                    <button
                      type="button"
                      className="thumb-remove"
                      title="Remove image"
                      aria-label={`Remove ${p.file.name}`}
                      onClick={() => removeMediaAt(idx)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="thumb-meta">
                    <div className="thumb-name" title={p.file.name}>{p.file.name}</div>
                    <div className="thumb-size">{formatBytes(p.file.size)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={resetForm} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="save-button" disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update Project' : 'Add Project'}
          </button>
        </div>
          </form>
        </div>
      )}

      <div className="projects-list">
        {(items || []).length === 0 && !showForm ? (
          <div className="empty-state">
            <div className="empty-icon"><Icon name="folder" size="xl" ariaLabel="No projects" /></div>
            <h3>No Projects Yet</h3>
            <p>Start building your portfolio by adding your first project.</p>
            <button
              className="add-button"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              + Add Your First Project
            </button>
          </div>
        ) : (items || []).length === 0 ? null : (
          (items || []).map((item) => (
            <div key={item.id} className={`project-item status-${item.status}`}>
              <div className="project-header">
                <div className="project-title">
                  <div className="project-main">
                    <h3>{item.name}</h3>
                    <div className="project-meta">
                      {item.role && <span><Icon name="users" size="sm" /> {item.role}</span>}
                      {(item.start_date || item.end_date) && (
                        <span className="dates"><Icon name="calendar" size="sm" /> {item.start_date || '—'} to {item.end_date || '—'}</span>
                      )}
                      {item.status && <span className={`badge ${item.status}`}>{statusOptions.find(s => s.value === item.status)?.label || item.status}</span>}
                    </div>
                  </div>
                </div>
                <div className="project-actions">
                  <button 
                    className="action-button edit" 
                    onClick={() => startEdit(item)}
                    aria-label="Edit project"
                    title="Edit project"
                  >
                    <Icon name="edit" size="sm" />
                  </button>
                  <button 
                    className="action-button delete" 
                    onClick={() => setDeleteConfirm(item.id)}
                    aria-label="Delete project"
                    title="Delete project"
                  >
                    <Icon name="trash" size="sm" />
                  </button>
                </div>
              </div>

              {(item.team_size != null || item.industry || item.category || item.project_url) && (
                <div className="project-details">
                  {item.team_size != null && <span>👥 Team size: {item.team_size}</span>}
                  {item.industry && <span>🏷️ Industry: {item.industry}</span>}
                  {item.category && <span>📂 Type: {item.category}</span>}
                  {item.project_url && <a href={item.project_url} target="_blank" rel="noreferrer">🔗 View Project</a>}
                </div>
              )}

              {(item.technologies && item.technologies.length > 0) && (
                <div className="project-section">
                  <strong>Technologies</strong>
                  <div className="project-tech">
                    {item.technologies.map((t, i) => <span className="tag" key={`${t}-${i}`}>{t}</span>)}
                  </div>
                </div>
              )}

              {item.description && (
                <div className="project-section">
                  <strong>Description</strong>
                  <p>{item.description}</p>
                </div>
              )}

              {item.collaboration_details && (
                <div className="project-section">
                  <strong>Team & Collaboration</strong>
                  <p>{item.collaboration_details}</p>
                </div>
              )}

              {item.outcomes && (
                <div className="project-section">
                  <strong>Outcomes & Achievements</strong>
                  <p>{item.outcomes}</p>
                </div>
              )}

              {(item.media && item.media.length > 0) && (
                <div className="project-section">
                  <strong>Screenshots</strong>
                  <div className="project-media-grid">
                    {item.media.map((m) => (
                      <div key={m.id} className="media-item">
                        <img src={m.image_url} alt={m.caption || 'screenshot'} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {deleteConfirm === item.id && (
                <div className="delete-confirm">
                  <p>Are you sure you want to delete this project?</p>
                  <div className="confirm-actions">
                    <button 
                      className="confirm-yes"
                      onClick={() => handleDelete(item.id)}
                    >
                      Yes, Delete
                    </button>
                    <button 
                      className="confirm-no"
                      onClick={() => setDeleteConfirm(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Projects;
