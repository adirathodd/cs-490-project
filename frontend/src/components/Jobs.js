import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../services/api';
import Icon from './Icon';
// Reuse the ProfileForm styling system for a consistent look-and-feel
import './ProfileForm.css';

const defaultForm = {
  title: '',
  company_name: '',
  location: '',
  salary_min: '',
  salary_max: '',
  salary_currency: 'USD',
  posting_url: '',
  application_deadline: '',
  description: '',
  industry: '',
  job_type: 'ft',
};

const jobTypeOptions = [
  { value: 'ft', label: 'Full-time' },
  { value: 'pt', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Internship' },
  { value: 'temp', label: 'Temporary' },
];

const industryOptions = [
  'Software', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing', 'Government', 'Other'
];

const MAX_DESC = 2000;

const Jobs = () => {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const list = await jobsAPI.getJobs();
        setItems(Array.isArray(list) ? list : []);
        setError('');
      } catch (e) {
        const msg = e?.message || e?.error?.message || 'Failed to load jobs';
        if (e?.status === 401) {
          setError('Please log in to view your jobs.');
        } else if (Array.isArray(e?.messages) && e.messages.length) {
          setError(e.messages.join(' • '));
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const resetForm = () => {
    setForm(defaultForm);
    setFieldErrors({});
    setEditingId(null);
    setCharCount(0);
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    if (name === 'description') {
      if (value.length > MAX_DESC) return;
      setCharCount(value.length);
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const n = { ...prev };
        delete n[name];
        return n;
      });
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Job title is required';
    if (!form.company_name.trim()) errs.company_name = 'Company name is required';
    if (form.description && form.description.length > MAX_DESC) errs.description = 'Max 2000 characters';
    const smin = parseFloat(form.salary_min);
    const smax = parseFloat(form.salary_max);
    if (!Number.isNaN(smin) && !Number.isNaN(smax) && smin > smax) {
      errs.salary_min = 'Min must be ≤ Max';
    }
    return errs;
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      company_name: item.company_name || '',
      location: item.location || '',
      salary_min: item.salary_min !== null && item.salary_min !== undefined ? String(item.salary_min) : '',
      salary_max: item.salary_max !== null && item.salary_max !== undefined ? String(item.salary_max) : '',
      salary_currency: item.salary_currency || 'USD',
      posting_url: item.posting_url || '',
      application_deadline: item.application_deadline || '',
      description: item.description || '',
      industry: item.industry || '',
      job_type: item.job_type || 'ft',
    });
    setFieldErrors({});
    setCharCount((item.description || '').length);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onDelete = async (id) => {
    const ok = window.confirm('Delete this job entry?');
    if (!ok) return;
    try {
      await jobsAPI.deleteJob(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSuccess('Job deleted.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      const msg = e?.message || e?.error?.message || 'Failed to delete job';
      setError(msg);
    }
  };

  const mapServerFieldErrors = (details) => {
    // Expecting DRF-style { field: [messages] }
    if (!details || typeof details !== 'object') return {};
    const out = {};
    Object.entries(details).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length) out[k] = v.join(' ');
      else if (typeof v === 'string') out[k] = v;
    });
    return out;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const errs = validate();
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      // Normalize empties to nulls where appropriate
      ['salary_min', 'salary_max'].forEach((k) => {
        if (payload[k] === '') payload[k] = null;
        else payload[k] = payload[k] === null ? null : Number(payload[k]);
      });
      if (!payload.posting_url) payload.posting_url = '';
      if (!payload.industry) payload.industry = '';

      let saved;
      if (editingId) {
        saved = await jobsAPI.updateJob(editingId, payload);
        setItems((prev) => prev.map((i) => (i.id === editingId ? saved : i)));
        setSuccess('Job updated.');
      } else {
        saved = await jobsAPI.addJob(payload);
        setItems((prev) => [saved, ...prev]);
        setSuccess('Job saved.');
      }
      resetForm();
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      // Prefer detailed messages and field-level errors if provided
      if (e?.details) setFieldErrors(mapServerFieldErrors(e.details));
      const msg = Array.isArray(e?.messages) && e.messages.length
        ? e.messages.join(' • ')
        : (e?.message || e?.error?.message || 'Failed to save');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-form-container">
      <div className="profile-form-card">
        <div className="page-backbar">
          <button
            className="btn-back"
            onClick={() => (window.location.href = '/dashboard')}
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            ← Back to Dashboard
          </button>
        </div>
        <div className="profile-header">
          <div>
            <h2>Job Tracker</h2>
            <p className="form-subtitle">Track roles you're interested in and keep key details handy.</p>
          </div>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <span className="error-icon">!</span>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="success-banner">
            <span className="success-icon">✓</span>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Job Details */}
          <div className="form-section">
            <h3><Icon name="briefcase" size="sm" /> Job details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>
                  Job Title <span className="required">*</span>
                </label>
                <input
                  name="title"
                  value={form.title}
                  onChange={onChange}
                  placeholder="e.g., Software Engineer"
                  className={fieldErrors.title ? 'error' : ''}
                />
                {fieldErrors.title && <div className="error-message">{fieldErrors.title}</div>}
              </div>
              <div className="form-group">
                <label>
                  Company <span className="required">*</span>
                </label>
                <input
                  name="company_name"
                  value={form.company_name}
                  onChange={onChange}
                  placeholder="e.g., Acme Inc"
                  className={fieldErrors.company_name ? 'error' : ''}
                />
                {fieldErrors.company_name && <div className="error-message">{fieldErrors.company_name}</div>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Location</label>
                <input name="location" value={form.location} onChange={onChange} placeholder="City, State or Remote" />
              </div>
              <div className="form-group">
                <label>Job Type</label>
                <select name="job_type" value={form.job_type} onChange={onChange}>
                  {jobTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Industry</label>
                <select name="industry" value={form.industry} onChange={onChange}>
                  <option value="">Select...</option>
                  {industryOptions.map((ind) => (<option key={ind} value={ind}>{ind}</option>))}
                </select>
              </div>
              <div className="form-group">
                <label>Job Posting URL</label>
                <input name="posting_url" value={form.posting_url} onChange={onChange} placeholder="https://..." />
                <span className="field-help">Link to the external job post (optional)</span>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Application Deadline</label>
                <input type="date" name="application_deadline" value={form.application_deadline} onChange={onChange} />
              </div>
              <div className="form-group" />
            </div>
          </div>

          {/* Compensation */}
          <div className="form-section">
            <h3><Icon name="briefcase" size="sm" /> Compensation</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Salary Min</label>
                <input
                  type="number"
                  step="0.01"
                  name="salary_min"
                  value={form.salary_min}
                  onChange={onChange}
                  placeholder="e.g., 100000"
                  className={fieldErrors.salary_min ? 'error' : ''}
                />
                {fieldErrors.salary_min && <div className="error-message">{fieldErrors.salary_min}</div>}
              </div>
              <div className="form-group">
                <label>Salary Max</label>
                <input type="number" step="0.01" name="salary_max" value={form.salary_max} onChange={onChange} placeholder="e.g., 150000" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Currency</label>
                <input name="salary_currency" value={form.salary_currency} onChange={onChange} placeholder="USD" maxLength={3} />
              </div>
              <div className="form-group" />
            </div>
          </div>

          {/* Description / Notes */}
          <div className="form-section">
            <h3><Icon name="edit" size="sm" /> Description / Notes</h3>
            <div className="form-group">
              <label>
                Description
                <span className={`char-counter ${charCount === MAX_DESC ? 'limit-reached' : ''}`}>
                  {charCount}/{MAX_DESC}
                </span>
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={onChange}
                rows={6}
                placeholder="Paste description or your notes (max 2000)"
                className={fieldErrors.description ? 'error' : ''}
              />
              {fieldErrors.description && <div className="error-message">{fieldErrors.description}</div>}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="cancel-button" onClick={resetForm} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="save-button" disabled={saving}>
              {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Save Job')}
            </button>
          </div>
        </form>
      </div>

      {/* Entries list */}
      <div className="profile-form-card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}><Icon name="list" size="sm" /> Your Job Entries</h3>
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <div className="error-banner" role="alert">{error}</div>
        ) : (items && items.length > 0 ? (
          <div className="items-list">
            {items.map((item) => (
              <div key={item.id} className="item-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}>
                <div className="item-main">
                  <div className="item-title" style={{ fontWeight: 600 }}>{item.title} <span style={{ color: '#666', fontWeight: 400 }}>@ {item.company_name}</span></div>
                  <div className="item-sub" style={{ color: '#666' }}>{item.location || '—'} • {item.job_type?.toUpperCase()} {item.salary_range ? `• ${item.salary_range}` : ''}</div>
                  {item.application_deadline && <div className="item-sub" style={{ color: '#666' }}>Deadline: {item.application_deadline}</div>}
                </div>
                <div className="item-actions" style={{ display: 'flex', gap: 12 }}>
                  <button className="back-button" onClick={() => startEdit(item)} style={{ padding: '6px 10px' }}>Edit</button>
                  <button className="back-button" onClick={() => onDelete(item.id)} style={{ padding: '6px 10px', borderColor: '#e53e3e', color: '#b91c1c' }}>Delete</button>
                  {item.posting_url && <a className="back-button" href={item.posting_url} target="_blank" rel="noreferrer" style={{ padding: '6px 10px', textDecoration: 'none' }}>View</a>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No job entries yet. Use the form above to add one.</p>
        ))}
      </div>
    </div>
  );
};

export default Jobs;
