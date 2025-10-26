import React, { useEffect, useState } from 'react';
import { projectsAPI } from '../services/api';
import './Projects.css';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

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
  };

  const onChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'file') {
      setForm((prev) => ({ ...prev, media: Array.from(files || []) }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

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

  const remove = async (id) => {
    if (!window.confirm('Delete this project?')) return;
    try {
      await projectsAPI.deleteProject(id);
      setItems((prev) => (prev || []).filter((i) => i.id !== id));
      if (editingId === id) resetForm();
    } catch (e) {
      setError(e?.message || 'Failed to delete project');
    }
  };

  if (loading) {
    return <div className="projects-container">Loading projects...</div>;
  }

  return (
    <div className="projects-container">
      <div className="page-backbar">
        <a className="btn-back" href="/dashboard" aria-label="Back to dashboard" title="Back to dashboard">← Back to Dashboard</a>
      </div>

  <h2>Projects</h2>
      {error && <div className="error-banner">{error}</div>}

      <form className="projects-form" onSubmit={handleSubmit}>
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
            <input id="start_date" type="date" name="start_date" value={form.start_date} onChange={onChange} />
          </div>
          <div className="form-group">
            <label htmlFor="end_date">End Date</label>
            <input id="end_date" type="date" name="end_date" value={form.end_date} onChange={onChange} />
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
          <input id="media" type="file" name="media" multiple accept="image/*" onChange={onChange} />
          {form.media?.length > 0 && (
            <div className="preview-grid">
              {form.media.map((file, idx) => (
                <div key={idx} className="preview-item">{file.name}</div>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          {editingId && (
            <button type="button" className="cancel-button" onClick={resetForm} disabled={saving}>
              Cancel
            </button>
          )}
          <button type="submit" className="save-button" disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update Project' : 'Add Project'}
          </button>
        </div>
      </form>

      <div className="projects-list">
        {(items || []).length === 0 ? (
          <div className="empty-state">No projects yet. Add your first one above.</div>
        ) : (
          (items || []).map((item) => (
            <div key={item.id} className={`project-item status-${item.status}`}>
              <div className="project-header">
                <div className="project-title">
                  <h3>{item.name}</h3>
                  {item.status && <span className={`badge ${item.status}`}>{statusOptions.find(s => s.value === item.status)?.label || item.status}</span>}
                </div>
                <div className="project-actions">
                  <button className="edit-button" onClick={() => startEdit(item)}>Edit</button>
                  <button className="delete-button" onClick={() => remove(item.id)}>Delete</button>
                </div>
              </div>
              <div className="project-meta">
                {item.role && <span>👤 {item.role}</span>}
                {(item.start_date || item.end_date) && (
                  <span>🗓️ {item.start_date || '—'} to {item.end_date || '—'}</span>
                )}
                {item.team_size != null && <span>👥 Team size: {item.team_size}</span>}
                {item.project_url && <a href={item.project_url} target="_blank" rel="noreferrer">🔗 View</a>}
              </div>
              {(item.technologies && item.technologies.length > 0) && (
                <div className="project-tech">
                  {item.technologies.map((t, i) => <span className="tag" key={`${t}-${i}`}>{t}</span>)}
                </div>
              )}
              {item.description && <div className="project-section"><strong>Description:</strong> {item.description}</div>}
              {item.collaboration_details && <div className="project-section"><strong>Collaboration:</strong> {item.collaboration_details}</div>}
              {item.outcomes && <div className="project-section"><strong>Outcomes:</strong> {item.outcomes}</div>}
              {(item.media && item.media.length > 0) && (
                <div className="project-media-grid">
                  {item.media.map((m) => (
                    <div key={m.id} className="media-item">
                      <img src={m.image_url} alt={m.caption || 'screenshot'} />
                    </div>
                  ))}
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
