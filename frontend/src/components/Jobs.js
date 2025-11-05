import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsAPI } from '../services/api';
import Icon from './Icon';
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

  // UC-039: Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    industry: '',
    location: '',
    job_type: '',
    salary_min: '',
    salary_max: '',
    deadline_from: '',
    deadline_to: '',
  });
  const [sortBy, setSortBy] = useState('date_added');
  const [showFilters, setShowFilters] = useState(false);

  // UC-039: Load saved search preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedPrefs = localStorage.getItem('jobSearchPreferences');
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        if (prefs.searchQuery) setSearchQuery(prefs.searchQuery);
        if (prefs.filters) setFilters(prev => ({ ...prev, ...prefs.filters }));
        if (prefs.sortBy) setSortBy(prefs.sortBy);
        if (prefs.showFilters !== undefined) setShowFilters(prefs.showFilters);
      }
    } catch (e) {
      console.warn('Failed to load saved search preferences:', e);
    }
  }, []);

  // UC-039: Save search preferences to localStorage when they change
  useEffect(() => {
    try {
      const prefs = { searchQuery, filters, sortBy, showFilters };
      localStorage.setItem('jobSearchPreferences', JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save search preferences:', e);
    }
  }, [searchQuery, filters, sortBy, showFilters]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // UC-039: Build query parameters for search and filtering
        const params = {
          q: searchQuery,
          industry: filters.industry,
          location: filters.location,
          job_type: filters.job_type,
          salary_min: filters.salary_min,
          salary_max: filters.salary_max,
          deadline_from: filters.deadline_from,
          deadline_to: filters.deadline_to,
          sort: sortBy,
        };
        
        const response = await jobsAPI.getJobs(params);
        const list = response.results || response || [];
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
  }, [searchQuery, filters, sortBy]);

  const resetForm = () => {
    setForm(defaultForm);
    setFieldErrors({});
    setEditingId(null);
    setCharCount(0);
    setShowForm(false);
  };

  // UC-039: Clear all filters and search
  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      industry: '',
      location: '',
      job_type: '',
      salary_min: '',
      salary_max: '',
      deadline_from: '',
      deadline_to: '',
    });
    setSortBy('date_added');
  };

  // UC-039: Handle filter changes
  const onFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // UC-039: Highlight matching terms in search results
  const highlightText = (text, query) => {
    if (!query || !text) return text;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return text.replace(regex, '<mark style="background: #fef08a; padding: 0 2px;">$1</mark>');
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
    
    // Required fields
    if (!form.title.trim()) {
      errs.title = 'Job title is required';
    }
    
    if (!form.company_name.trim()) {
      errs.company_name = 'Company name is required';
    }
    
    // Description length validation
    if (form.description && form.description.length > MAX_DESC) {
      errs.description = `Description must be ${MAX_DESC} characters or less`;
    }
    
    // Salary validation
    const smin = parseFloat(form.salary_min);
    const smax = parseFloat(form.salary_max);
    
    if (form.salary_min && isNaN(smin)) {
      errs.salary_min = 'Please enter a valid number';
    }
    
    if (form.salary_max && isNaN(smax)) {
      errs.salary_max = 'Please enter a valid number';
    }
    
    if (!isNaN(smin) && smin < 0) {
      errs.salary_min = 'Salary cannot be negative';
    }
    
    if (!isNaN(smax) && smax < 0) {
      errs.salary_max = 'Salary cannot be negative';
    }
    
    if (!isNaN(smin) && !isNaN(smax) && smin > smax) {
      errs.salary_min = 'Minimum salary must be less than or equal to maximum salary';
    }
    
    // Date validation
    if (form.application_deadline) {
      const deadlineDate = new Date(form.application_deadline);
      if (isNaN(deadlineDate.getTime())) {
        errs.application_deadline = 'Please enter a valid date';
      }
    }
    
    // URL validation
    if (form.posting_url && form.posting_url.trim()) {
      try {
        new URL(form.posting_url);
      } catch (e) {
        errs.posting_url = 'Please enter a valid URL (e.g., https://example.com)';
      }
    }
    
    // Currency validation
    if (form.salary_currency && form.salary_currency.length > 3) {
      errs.salary_currency = 'Currency code must be 3 characters or less';
    }
    
    return errs;
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
      job_type: item.job_type || 'ft',
    });
    setFieldErrors({});
    setCharCount((item.description || '').length);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Format salary number for input display: remove unnecessary .00, keep two decimals otherwise
  const formatSalaryString = (v) => {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    // Round to 2 decimals to avoid float artifacts
    const rounded = Math.round(n * 100) / 100;
    if (Number.isInteger(rounded)) return String(rounded);
    return String(rounded.toFixed(2));
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
      
      // Normalize salary fields to null or exact decimal strings to avoid binary float artifacts
      ['salary_min', 'salary_max'].forEach((k) => {
        if (payload[k] === '') {
          payload[k] = null;
        } else if (payload[k] === null) {
          payload[k] = null;
        } else {
          const n = parseFloat(String(payload[k]));
          if (Number.isNaN(n)) {
            payload[k] = null;
          } else {
            // Round to 2 decimals then send as string (Decimal-friendly)
            const rounded = Math.round(n * 100) / 100;
            payload[k] = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
          }
        }
      });
      
      // Normalize optional string fields - send empty string instead of null
      if (!payload.posting_url) payload.posting_url = '';
      if (!payload.industry) payload.industry = '';
      if (!payload.location) payload.location = '';
      if (!payload.description) payload.description = '';
      
      // Normalize date field - send null if empty
      if (!payload.application_deadline || payload.application_deadline === '') {
        payload.application_deadline = null;
      }

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
    <div className="education-container">
      {/* 1. Back to dashboard button */}
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

      <h2>Job Tracker</h2>

      {/* 2. Job Tracker section name and description */}
      <div className="education-header">
        <h2><Icon name="briefcase" size="md" /> Your Job Entries</h2>
        <button 
          className="add-education-button"
          onClick={() => {
            setForm(defaultForm);
            setEditingId(null);
            setFieldErrors({});
            setCharCount(0);
            setShowForm(true);
          }}
        >
          + Add Job
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {/* UC-039: Search and Filter Section */}
      {!showForm && (
        <div className="education-form-card" style={{ marginBottom: '20px' }}>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px', minWidth: '250px' }}>
                <input
                  type="text"
                  placeholder="🔍 Search by job title, company, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px', fontSize: '15px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowFilters(!showFilters)}
                  style={{ padding: '10px 14px', whiteSpace: 'nowrap', height: '40px', minWidth: '92px' }}
                >
                  {showFilters ? '▲ Hide' : '▼ Show'} Filters
                </button>
                <button
                  type="button"
                  className="delete-button"
                  onClick={clearFilters}
                  style={{ padding: '8px 12px', whiteSpace: 'nowrap', height: '40px', minWidth: '92px', backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#ffffff', borderRadius: '6px' }}
                >
                  Clear All
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
                    <input
                      name="location"
                      value={filters.location}
                      onChange={onFilterChange}
                      placeholder="City, State or Remote"
                    />
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
                    <input
                      type="number"
                      name="salary_min"
                      value={filters.salary_min}
                      onChange={onFilterChange}
                      placeholder="e.g., 100000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Salary</label>
                    <input
                      type="number"
                      name="salary_max"
                      value={filters.salary_max}
                      onChange={onFilterChange}
                      placeholder="e.g., 150000"
                    />
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
                    <input
                      type="date"
                      name="deadline_from"
                      value={filters.deadline_from}
                      onChange={onFilterChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Deadline To</label>
                    <input
                      type="date"
                      name="deadline_to"
                      value={filters.deadline_to}
                      onChange={onFilterChange}
                    />
                  </div>
                  <div className="form-group" style={{ visibility: 'hidden' }}>
                    {/* Empty column for alignment */}
                  </div>
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

      {/* 3. Edit/add form if user prompts */}
      {showForm && (
        <div className="education-form-card">
          <div className="form-header">
            <h3>{editingId ? 'Edit Job' : 'Add Job'}</h3>
            <button className="close-button" onClick={resetForm}><Icon name="trash" size="sm" ariaLabel="Close" /></button>
          </div>

          <form className="education-form" onSubmit={handleSubmit}>
            {/* Job Details */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="title">
                  Job Title <span className="required">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  value={form.title}
                  onChange={onChange}
                  placeholder="e.g., Software Engineer"
                  className={fieldErrors.title ? 'error' : ''}
                />
                {fieldErrors.title && <div className="error-message">{fieldErrors.title}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="company_name">
                  Company <span className="required">*</span>
                </label>
                <input
                  id="company_name"
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
                <label htmlFor="location">Location</label>
                <input 
                  id="location" 
                  name="location" 
                  value={form.location} 
                  onChange={onChange} 
                  placeholder="City, State or Remote"
                  className={fieldErrors.location ? 'error' : ''}
                />
                {fieldErrors.location && <div className="error-message">{fieldErrors.location}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="job_type">Job Type</label>
                <select 
                  id="job_type" 
                  name="job_type" 
                  value={form.job_type} 
                  onChange={onChange}
                  className={fieldErrors.job_type ? 'error' : ''}
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
              />
              {fieldErrors.description && <div className="error-message">{fieldErrors.description}</div>}
            </div>

            <div className="form-actions">
              <button type="button" className="cancel-button" onClick={resetForm} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="save-button" disabled={saving}>
                {saving ? 'Saving...' : (editingId ? 'Update Job' : 'Add Job')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Your job entries */}
      {(items || []).length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-icon"><Icon name="briefcase" size="xl" ariaLabel="No jobs" /></div>
          {searchQuery || Object.values(filters).some(v => v) ? (
            <>
              <h3>No Jobs Match Your Search</h3>
              <p>Try adjusting your filters or search terms.</p>
              <button className="add-education-button" onClick={clearFilters}>
                Clear Filters
              </button>
            </>
          ) : (
            <>
              <h3>No Job Entries Yet</h3>
              <p>Track jobs you're interested in and keep key details handy.</p>
              <button className="add-education-button" onClick={() => {
                setForm(defaultForm);
                setEditingId(null);
                setFieldErrors({});
                setCharCount(0);
                setShowForm(true);
              }}>
                + Add Your First Job
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="education-list">
          {(items || []).map((item) => (
            <div key={item.id} className="education-item">
              <div className="education-item-header">
                <div 
                  className="education-item-main" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/jobs/${item.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      navigate(`/jobs/${item.id}`);
                    }
                  }}
                >
                  <div className="education-item-title">
                    <span dangerouslySetInnerHTML={{ __html: highlightText(item.title, searchQuery) }} />
                  </div>
                  <div className="education-item-sub">
                    <span dangerouslySetInnerHTML={{ __html: highlightText(item.company_name, searchQuery) }} />
                    {item.location && <span> • {item.location}</span>}
                    {item.job_type && <span> • {jobTypeOptions.find(opt => opt.value === item.job_type)?.label || item.job_type}</span>}
                    {item.industry && <span> • {item.industry}</span>}
                  </div>
                  {item.salary_range && (
                    <div className="education-item-dates">
                      <span className="status">{item.salary_range}</span>
                    </div>
                  )}
                  {item.application_deadline && (
                    <div className="education-item-dates">
                      <span className="status">Deadline: {item.application_deadline}</span>
                    </div>
                  )}
                  {item.description && searchQuery && item.description.toLowerCase().includes(searchQuery.toLowerCase()) && (
                    <div className="education-item-dates" style={{ marginTop: '4px' }}>
                      <span style={{ color: '#666', fontSize: '13px' }} dangerouslySetInnerHTML={{ 
                        __html: highlightText(item.description.substring(0, 150), searchQuery) 
                      }} />
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
          ))}
        </div>
      )}
    </div>
  );
};

export default Jobs;
