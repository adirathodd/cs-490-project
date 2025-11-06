import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsAPI } from '../services/api';
import Icon from './Icon';
import DeadlineCalendar from './DeadlineCalendar';
import './Education.css';

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
  job_type: 'ft'
};

const jobTypeOptions = [
  { value: 'ft', label: 'Full-time' },
  { value: 'pt', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Internship' },
  { value: 'temp', label: 'Temporary' }
];

const industryOptions = [
  'Software',
  'Finance',
  'Healthcare',
  'Education',
  'Retail',
  'Manufacturing',
  'Government',
  'Other'
];

const MAX_DESC = 2000;

const jobTypeLabel = (value) => jobTypeOptions.find((opt) => opt.value === value)?.label || value;

const escapeRegExp = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const highlightText = (text, query) => {
  const safeText = escapeHtml(text);
  if (!query) return safeText;
  const pattern = escapeRegExp(query);
  if (!pattern) return safeText;
  const regex = new RegExp(`(${pattern})`, 'ig');
  return safeText.replace(regex, '<mark>$1</mark>');
};

const formatSalaryString = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return String(value);
  const rounded = Math.round(numberValue * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
};

const mapServerFieldErrors = (details) => {
  if (!details || typeof details !== 'object') return {};
  const mapped = {};
  Object.entries(details).forEach(([field, messages]) => {
    if (Array.isArray(messages) && messages.length) mapped[field] = messages.join(' ');
    else if (typeof messages === 'string') mapped[field] = messages;
  });
  return mapped;
};

const Jobs = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [showForm, setShowForm] = useState(false);

  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [importedFields, setImportedFields] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    industry: '',
    location: '',
    job_type: '',
    salary_min: '',
    salary_max: '',
    deadline_from: '',
    deadline_to: ''
  });
  const [sortBy, setSortBy] = useState('date_added');
  const [showFilters, setShowFilters] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
  const titleInputRef = useRef(null);

  useEffect(() => {
    try {
      const savedPrefs = localStorage.getItem('jobSearchPreferences');
      if (!savedPrefs) return;
      const prefs = JSON.parse(savedPrefs);
      if (prefs.searchQuery) setSearchQuery(prefs.searchQuery);
      if (prefs.filters) setFilters((prev) => ({ ...prev, ...prefs.filters }));
      if (prefs.sortBy) setSortBy(prefs.sortBy);
      if (typeof prefs.showFilters === 'boolean') setShowFilters(prefs.showFilters);
    } catch (e) {
      console.warn('Failed to load saved search preferences:', e);
    }
  }, []);

  useEffect(() => {
    try {
      const prefs = { searchQuery, filters, sortBy, showFilters };
      localStorage.setItem('jobSearchPreferences', JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save search preferences:', e);
    }
  }, [searchQuery, filters, sortBy, showFilters]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = {
          q: searchQuery,
          industry: filters.industry,
          location: filters.location,
          job_type: filters.job_type,
          salary_min: filters.salary_min,
          salary_max: filters.salary_max,
          deadline_from: filters.deadline_from,
          deadline_to: filters.deadline_to,
          sort: sortBy
        };
        const response = await jobsAPI.getJobs(params);
        const list = response?.results || response || [];
        setItems(Array.isArray(list) ? list : []);
        setError('');
      } catch (e) {
        const message = e?.message || e?.error?.message || 'Failed to load jobs';
        if (e?.status === 401) {
          setError('Please log in to view your jobs.');
        } else if (Array.isArray(e?.messages) && e.messages.length) {
          setError(e.messages.join(' • '));
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [searchQuery, filters, sortBy]);

  useEffect(() => {
    if (showForm) {
      requestAnimationFrame(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
      });
    }
  }, [showForm]);
  // Helper: days difference (deadline - today), and urgency color
  const daysUntil = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };
  const deadlineColor = (diff) => {
    if (diff == null) return '#94a3b8';
    if (diff < 0) return '#dc2626'; // overdue
    if (diff <= 3) return '#f59e0b'; // urgent
    return '#059669'; // safe
  };

  const resetForm = () => {
    setForm(defaultForm);
    setFieldErrors({});
    setEditingId(null);
    setCharCount(0);
    setShowForm(false);
    setImportUrl('');
    setImporting(false);
    setImportStatus(null);
    setImportedFields([]);
  };

  const handleAddJobClick = () => {
    setForm(defaultForm);
    setEditingId(null);
    setFieldErrors({});
    setCharCount(0);
    setSuccess('');
    setError('');
    setShowForm(true);
    setImportUrl('');
    setImportStatus(null);
    setImportedFields([]);
  };

  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) {
      setError('Please enter a job posting URL');
      return;
    }

    setImporting(true);
    setError('');
    setSuccess('');
    setImportStatus(null);
    setImportedFields([]);

    try {
      const result = await jobsAPI.importFromUrl(importUrl);

      if (result.status === 'success' || result.status === 'partial') {
        setForm((prev) => ({ ...prev, ...result.data }));
        if (result.data?.description) {
          setCharCount(result.data.description.length);
        }

        setImportStatus(result.status);
        setImportedFields(result.fields_extracted || []);

        if (result.status === 'success') {
          setSuccess('Job details imported successfully! Review and edit as needed.');
        } else {
          setSuccess('Job details partially imported. Please fill in the remaining fields.');
        }
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(result.error || 'Failed to import job details');
        setImportStatus('failed');
      }
    } catch (e) {
      const message = e?.message || 'Failed to import job from URL';
      setError(message);
      setImportStatus('failed');
    } finally {
      setImporting(false);
    }
  };

  const isFieldImported = (field) => importedFields.includes(field);

  const getFieldStyle = (field) => {
    if (!isFieldImported(field)) return {};
    return { background: 'rgba(16, 185, 129, 0.05)', borderColor: '#10b981' };
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      industry: '',
      location: '',
      job_type: '',
      salary_min: '',
      salary_max: '',
      deadline_from: '',
      deadline_to: ''
    });
    setSortBy('date_added');
  };

  const onFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
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
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = () => {
    const errors = {};

    if (!form.title.trim()) errors.title = 'Job title is required';
    if (!form.company_name.trim()) errors.company_name = 'Company name is required';

    if (form.description && form.description.length > MAX_DESC) {
      errors.description = `Description must be ${MAX_DESC} characters or less`;
    }

    const salaryMin = form.salary_min === '' ? '' : Number(form.salary_min);
    const salaryMax = form.salary_max === '' ? '' : Number(form.salary_max);

    if (form.salary_min && Number.isNaN(salaryMin)) {
      errors.salary_min = 'Please enter a valid number';
    }

    if (form.salary_max && Number.isNaN(salaryMax)) {
      errors.salary_max = 'Please enter a valid number';
    }

    if (!Number.isNaN(salaryMin) && salaryMin < 0) {
      errors.salary_min = 'Salary cannot be negative';
    }

    if (!Number.isNaN(salaryMax) && salaryMax < 0) {
      errors.salary_max = 'Salary cannot be negative';
    }

    if (
      form.salary_min &&
      form.salary_max &&
      !Number.isNaN(salaryMin) &&
      !Number.isNaN(salaryMax) &&
      salaryMin > salaryMax
    ) {
      errors.salary_min = 'Minimum salary must be less than or equal to maximum salary';
    }

    if (form.application_deadline) {
      const deadlineDate = new Date(form.application_deadline);
      if (Number.isNaN(deadlineDate.getTime())) {
        errors.application_deadline = 'Please enter a valid date';
      }
    }

    if (form.posting_url && form.posting_url.trim()) {
      try {
        // eslint-disable-next-line no-new
        new URL(form.posting_url);
      } catch (e) {
        errors.posting_url = 'Please enter a valid URL (e.g., https://example.com)';
      }
    }

    if (form.salary_currency && form.salary_currency.length > 3) {
      errors.salary_currency = 'Currency code must be 3 characters or less';
    }

    return errors;
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      company_name: item.company_name || '',
      location: item.location || '',
      salary_min: item.salary_min !== null && item.salary_min !== undefined ? formatSalaryString(item.salary_min) : '',
      salary_max: item.salary_max !== null && item.salary_max !== undefined ? formatSalaryString(item.salary_max) : '',
      salary_currency: item.salary_currency || 'USD',
      posting_url: item.posting_url || '',
      application_deadline: item.application_deadline || '',
      description: item.description || '',
      industry: item.industry || '',
      job_type: item.job_type || 'ft'
    });
    setFieldErrors({});
    setCharCount((item.description || '').length);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this job entry?')) return;
    try {
      await jobsAPI.deleteJob(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setSuccess('Job deleted.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      const message = e?.message || e?.error?.message || 'Failed to delete job';
      setError(message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form };

      ['salary_min', 'salary_max'].forEach((field) => {
        if (payload[field] === '') {
          payload[field] = null;
        } else if (payload[field] !== null && payload[field] !== undefined) {
          const numeric = parseFloat(String(payload[field]));
          if (Number.isNaN(numeric)) {
            payload[field] = null;
          } else {
            const rounded = Math.round(numeric * 100) / 100;
            payload[field] = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
          }
        }
      });

      if (!payload.posting_url) payload.posting_url = '';
      if (!payload.industry) payload.industry = '';
      if (!payload.location) payload.location = '';
      if (!payload.description) payload.description = '';
      if (!payload.application_deadline) payload.application_deadline = null;

      let saved;
      if (editingId) {
        saved = await jobsAPI.updateJob(editingId, payload);
        setItems((prev) => prev.map((item) => (item.id === editingId ? saved : item)));
        setSuccess('Job updated.');
      } else {
        saved = await jobsAPI.addJob(payload);
        setItems((prev) => [saved, ...(prev || [])]);
        setSuccess('Job saved.');
      }

      resetForm();
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      if (e?.details) setFieldErrors(mapServerFieldErrors(e.details));
      const message = Array.isArray(e?.messages) && e.messages.length
        ? e.messages.join(' • ')
        : (e?.message || e?.error?.message || 'Failed to save');
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const hasActiveFilters = searchQuery || Object.values(filters).some((value) => value);

  const renderSalaryRange = (item) => {
    if (item.salary_range) return item.salary_range;
    const min = item.salary_min;
    const max = item.salary_max;
    if (min && max) return `${formatSalaryString(min)} - ${formatSalaryString(max)} ${item.salary_currency || 'USD'}`;
    if (min) return `${formatSalaryString(min)}+ ${item.salary_currency || 'USD'}`;
    if (max) return `Up to ${formatSalaryString(max)} ${item.salary_currency || 'USD'}`;
    return null;
  };

  return (
    <div className="education-container">
      <div className="page-backbar">
        <a className="btn-back" href="/dashboard" aria-label="Back to dashboard" title="Back to dashboard">
          ← Back to Dashboard
        </a>
      </div>

      <h2>Job Tracker</h2>

      <div className="education-header">
        <h2><Icon name="briefcase" size="md" /> Your Job Entries</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <a
            className="btn-back"
            href="/jobs/pipeline"
            title="Open Pipeline"
            aria-label="Open job status pipeline"
            style={{ textDecoration: 'none' }}
          >
            Pipeline →
          </a>
          <button
            className="add-education-button"
            onClick={handleAddJobClick}
          >
            + Add Job
          </button>
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

      <div className="education-form-card" style={{ marginBottom: '20px' }}>
        <button
          type="button"
          className="cancel-button"
          onClick={() => setShowCalendar((prev) => !prev)}
          style={{ width: '100%', justifyContent: 'space-between', display: 'flex', alignItems: 'center', fontWeight: 600 }}
          aria-expanded={showCalendar}
          aria-controls="jobs-deadline-calendar"
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="calendar" size="md" /> Upcoming Deadlines
          </span>
          <span>{showCalendar ? '▲ Collapse' : '▼ Expand'}</span>
        </button>
        {showCalendar && (
          <div id="jobs-deadline-calendar" style={{ marginTop: 16 }}>
            <DeadlineCalendar items={items} />
          </div>
        )}
      </div>
      {/* UC-039: Search and Filter Section */}
      {!showForm && (
        <div className="education-form-card" style={{ marginBottom: '20px' }}>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px', minWidth: '250px', display: 'flex', alignItems: 'stretch' }}>
                <input
                  type="text"
                  placeholder="🔍 Search by job title, company, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #d1d5db',
                    borderRadius: '10px',
                    fontSize: '15px',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit',
                    background: 'var(--white)',
                    marginBottom: 0
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowFilters((prev) => !prev)}
                  style={{ whiteSpace: 'nowrap', minWidth: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {showFilters ? '▲ Hide' : '▼ Show'} Filters
                </button>
                <button
                  type="button"
                  className="delete-button"
                  onClick={clearFilters}
                  title="Clear All Filters"
                  style={{ whiteSpace: 'nowrap', minWidth: '48px', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Icon name="clear" size="md" />
                </button>
              </div>
            </div>

            {showFilters && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group">
                    <label>Industry</label>
                    <select name="industry" value={filters.industry} onChange={onFilterChange}>
                      <option value="">All Industries</option>
                      {industryOptions.map((ind) => (<option key={ind} value={ind}>{ind}</option>))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <input name="location" value={filters.location} onChange={onFilterChange} placeholder="City, State or Remote" />
                  </div>
                  <div className="form-group">
                    <label>Job Type</label>
                    <select name="job_type" value={filters.job_type} onChange={onFilterChange}>
                      <option value="">All Types</option>
                      {jobTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group">
                    <label>Min Salary</label>
                    <input type="number" name="salary_min" value={filters.salary_min} onChange={onFilterChange} placeholder="e.g., 100000" />
                  </div>
                  <div className="form-group">
                    <label>Max Salary</label>
                    <input type="number" name="salary_max" value={filters.salary_max} onChange={onFilterChange} placeholder="e.g., 150000" />
                  </div>
                  <div className="form-group">
                    <label>Sort By</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                      <option value="date_added">Date Added (Newest)</option>
                      <option value="deadline">Application Deadline</option>
                      <option value="salary">Salary (Highest)</option>
                      <option value="company_name">Company Name (A-Z)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div className="form-group">
                    <label>Deadline From</label>
                    <input type="date" name="deadline_from" value={filters.deadline_from} onChange={onFilterChange} />
                  </div>
                  <div className="form-group">
                    <label>Deadline To</label>
                    <input type="date" name="deadline_to" value={filters.deadline_to} onChange={onFilterChange} />
                  </div>
                  <div className="form-group" style={{ visibility: 'hidden' }} />
                </div>

                <div style={{ marginTop: '12px', fontSize: '13px', color: '#666', fontWeight: '500' }}>
                  Showing {items.length} result{items.length !== 1 ? 's' : ''}
                  {searchQuery && ` for "${searchQuery}"`}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="education-form-card">
          <div className="form-header">
            <h3>{editingId ? 'Edit Job' : 'Add Job'}</h3>
            <button className="close-button" onClick={resetForm}>
              <Icon name="trash" size="sm" ariaLabel="Close" />
            </button>
          </div>

          <form className="education-form" onSubmit={handleSubmit}>
            {!editingId && (
              <div
                className="form-section"
                style={{
                  padding: '20px',
                  marginBottom: '24px',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                  borderRadius: '10px',
                  border: '2px dashed #667eea'
                }}
              >
                <h4
                  style={{
                    marginTop: 0,
                    marginBottom: '12px',
                    color: '#667eea',
                    fontSize: '16px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Icon name="link" size="sm" />
                  Quick Import from Job Posting URL
                </h4>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '16px',
                    lineHeight: '1.5'
                  }}
                >
                  Paste a job posting URL from <strong>LinkedIn</strong>, <strong>Indeed</strong>, or <strong>Glassdoor</strong> to automatically fill in details
                </p>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 260px' }}>
                    <input
                      type="url"
                      placeholder="https://www.linkedin.com/jobs/view/..."
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      disabled={importing}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '15px',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleImportFromUrl}
                    disabled={importing || !importUrl.trim()}
                    style={{
                      padding: '12px 24px',
                      fontSize: '15px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      border: 'none',
                      background: importing ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      cursor: importing || !importUrl.trim() ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                    }}
                  >
                    {importing ? (
                      <>
                        <span
                          style={{
                            display: 'inline-block',
                            width: '14px',
                            height: '14px',
                            border: '2px solid white',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 0.6s linear infinite'
                          }}
                        />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Icon name="download" size="sm" />
                        Import
                      </>
                    )}
                  </button>
                </div>

                {importStatus && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background:
                        importStatus === 'success'
                          ? '#ecfdf5'
                          : importStatus === 'partial'
                          ? '#fef3c7'
                          : '#fee2e2',
                      border:
                        importStatus === 'success'
                          ? '1px solid #10b981'
                          : importStatus === 'partial'
                          ? '1px solid #f59e0b'
                          : '1px solid #ef4444',
                      color:
                        importStatus === 'success'
                          ? '#065f46'
                          : importStatus === 'partial'
                          ? '#92400e'
                          : '#991b1b'
                    }}
                  >
                    {importStatus === 'success' && '✓ Successfully imported'}
                    {importStatus === 'partial' && '⚠ Partially imported'}
                    {importStatus === 'failed' && '✗ Import failed'}
                    {importedFields.length > 0 && ` (${importedFields.length} field${importedFields.length > 1 ? 's' : ''})`}
                  </div>
                )}

                <style>{`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="title">
                  Job Title <span className="required">*</span>
                  {isFieldImported('title') && (
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: '#10b981', fontWeight: '600' }}>✓ Imported</span>
                  )}
                </label>
                <input
                  id="title"
                  name="title"
                  ref={titleInputRef}
                  value={form.title}
                  onChange={onChange}
                  placeholder="e.g., Software Engineer"
                  className={fieldErrors.title ? 'error' : ''}
                  style={getFieldStyle('title')}
                />
                {fieldErrors.title && <div className="error-message">{fieldErrors.title}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="company_name">
                  Company <span className="required">*</span>
                  {isFieldImported('company_name') && (
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: '#10b981', fontWeight: '600' }}>✓ Imported</span>
                  )}
                </label>
                <input
                  id="company_name"
                  name="company_name"
                  value={form.company_name}
                  onChange={onChange}
                  placeholder="e.g., Acme Inc"
                  className={fieldErrors.company_name ? 'error' : ''}
                  style={getFieldStyle('company_name')}
                />
                {fieldErrors.company_name && <div className="error-message">{fieldErrors.company_name}</div>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="location">
                  Location
                  {isFieldImported('location') && (
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: '#10b981', fontWeight: '600' }}>✓ Imported</span>
                  )}
                </label>
                <input
                  id="location"
                  name="location"
                  value={form.location}
                  onChange={onChange}
                  placeholder="City, State or Remote"
                  className={fieldErrors.location ? 'error' : ''}
                  style={getFieldStyle('location')}
                />
                {fieldErrors.location && <div className="error-message">{fieldErrors.location}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="job_type">
                  Job Type
                  {isFieldImported('job_type') && (
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: '#10b981', fontWeight: '600' }}>✓ Imported</span>
                  )}
                </label>
                <select
                  id="job_type"
                  name="job_type"
                  value={form.job_type}
                  onChange={onChange}
                  className={fieldErrors.job_type ? 'error' : ''}
                  style={getFieldStyle('job_type')}
                >
                  {jobTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {fieldErrors.job_type && <div className="error-message">{fieldErrors.job_type}</div>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="industry">Industry</label>
                <select
                  id="industry"
                  name="industry"
                  value={form.industry}
                  onChange={onChange}
                  className={fieldErrors.industry ? 'error' : ''}
                >
                  <option value="">Select...</option>
                  {industryOptions.map((ind) => (<option key={ind} value={ind}>{ind}</option>))}
                </select>
                {fieldErrors.industry && <div className="error-message">{fieldErrors.industry}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="posting_url">Job Posting URL</label>
                <input
                  id="posting_url"
                  name="posting_url"
                  value={form.posting_url}
                  onChange={onChange}
                  placeholder="https://..."
                  className={fieldErrors.posting_url ? 'error' : ''}
                />
                {fieldErrors.posting_url && <div className="error-message">{fieldErrors.posting_url}</div>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="application_deadline">Application Deadline</label>
                <input
                  id="application_deadline"
                  type="date"
                  name="application_deadline"
                  value={form.application_deadline}
                  onChange={onChange}
                  className={fieldErrors.application_deadline ? 'error' : ''}
                />
                {fieldErrors.application_deadline && <div className="error-message">{fieldErrors.application_deadline}</div>}
              </div>
              <div className="form-group" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="salary_min">Salary Min</label>
                <input
                  id="salary_min"
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
                <label htmlFor="salary_max">Salary Max</label>
                <input
                  id="salary_max"
                  type="number"
                  step="0.01"
                  name="salary_max"
                  value={form.salary_max}
                  onChange={onChange}
                  placeholder="e.g., 150000"
                  className={fieldErrors.salary_max ? 'error' : ''}
                />
                {fieldErrors.salary_max && <div className="error-message">{fieldErrors.salary_max}</div>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="salary_currency">Currency</label>
                <input
                  id="salary_currency"
                  name="salary_currency"
                  value={form.salary_currency}
                  onChange={onChange}
                  placeholder="USD"
                  maxLength={3}
                  className={fieldErrors.salary_currency ? 'error' : ''}
                />
                {fieldErrors.salary_currency && <div className="error-message">{fieldErrors.salary_currency}</div>}
              </div>
              <div className="form-group" />
            </div>

            <div className="form-group">
              <label htmlFor="description">
                Description / Notes
                {isFieldImported('description') && (
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#10b981', fontWeight: '600' }}>✓ Imported</span>
                )}
                <span className={`char-counter ${charCount === MAX_DESC ? 'limit-reached' : ''}`}>
                  {charCount}/{MAX_DESC}
                </span>
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={onChange}
                rows={6}
                placeholder="Paste description or your notes (max 2000)"
                className={fieldErrors.description ? 'error' : ''}
                style={getFieldStyle('description')}
              />
              {fieldErrors.description && <div className="error-message">{fieldErrors.description}</div>}
            </div>

            <div className="form-actions">
              <button type="button" className="cancel-button" onClick={resetForm} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="save-button" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update Job' : 'Add Job'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && !showForm ? (
        <div className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#666' }}>Loading your job entries…</p>
        </div>
      ) : (items || []).length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-icon"><Icon name="briefcase" size="xl" ariaLabel="No jobs" /></div>
          {hasActiveFilters ? (
            <>
              <h3>No Jobs Match Your Search</h3>
              <p>Try adjusting your filters or search terms.</p>
              <button className="add-education-button" onClick={clearFilters}>Clear Filters</button>
            </>
          ) : (
            <>
              <h3>No Job Entries Yet</h3>
              <p>Track jobs you're interested in and keep key details handy.</p>
              <button
                className="add-education-button"
                onClick={handleAddJobClick}
              >
                + Add Your First Job
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="education-list">
          {(items || []).map((item) => {
            const diff = item.application_deadline ? daysUntil(item.application_deadline) : null;
            const color = deadlineColor(diff);
            const salaryRange = renderSalaryRange(item);
            return (
              <div key={item.id} className="education-item">
                <div className="education-item-header">
                  <div
                    className="education-item-main"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/jobs/${item.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') navigate(`/jobs/${item.id}`);
                    }}
                  >
                    <div className="education-item-title">
                      <span dangerouslySetInnerHTML={{ __html: highlightText(item.title || '', searchQuery) }} />
                    </div>
                    <div className="education-item-sub">
                      <span dangerouslySetInnerHTML={{ __html: highlightText(item.company_name || '', searchQuery) }} />
                      {item.location && <span> • {item.location}</span>}
                      {item.job_type && <span> • {jobTypeLabel(item.job_type)}</span>}
                      {item.industry && <span> • {item.industry}</span>}
                    </div>
                    {salaryRange && (
                      <div className="education-item-dates">
                        <span className="status">{salaryRange}</span>
                      </div>
                    )}
                    {item.application_deadline && (
                      <div className="education-item-dates" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 4, background: color }} aria-hidden />
                        {/* Keep this exact text for existing tests */}
                        <span className="status">Deadline: {item.application_deadline}</span>
                        {diff != null && (
                          <span style={{ fontSize: 12, color: '#444' }}>
                            {diff < 0 ? `Overdue by ${Math.abs(diff)}d` : `${diff}d left`}
                          </span>
                        )}
                      </div>
                    )}
                    {item.description && searchQuery && item.description.toLowerCase().includes(searchQuery.toLowerCase()) && (
                      <div className="education-item-dates" style={{ marginTop: '4px' }}>
                        <span
                          style={{ color: '#666', fontSize: '13px' }}
                          dangerouslySetInnerHTML={{
                            __html: highlightText(item.description.substring(0, 150), searchQuery)
                          }}
                        />
                        {item.description.length > 150 && '...'}
                      </div>
                    )}
                  </div>
                  <div className="education-item-actions">
                    <button
                      className="view-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/jobs/${item.id}`);
                      }}
                      title="View Details"
                      aria-label="View Details"
                    >
                      <Icon name="eye" size="sm" ariaLabel="View" />
                    </button>
                    <button
                      className="edit-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(item);
                      }}
                      title="Edit"
                      aria-label="Edit"
                    >
                      <Icon name="edit" size="sm" ariaLabel="Edit" />
                    </button>
                    <button
                      className="delete-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      title="Delete"
                      aria-label="Delete"
                    >
                      <Icon name="trash" size="sm" ariaLabel="Delete" />
                    </button>
                    {item.posting_url && (
                      <a
                        className="view-button"
                        href={item.posting_url}
                        target="_blank"
                        rel="noreferrer"
                        title="View Job Posting"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Icon name="link" size="sm" ariaLabel="View" />
                      </a>
                    )}
                  </div>
                </div>
                {(item.industry || item.description) && (
                  <div className="education-item-details">
                    {item.industry && <div><strong>Industry:</strong> {item.industry}</div>}
                    {item.description && <div><strong>Notes:</strong> {item.description}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Jobs;
