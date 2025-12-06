import React, { useEffect, useMemo, useRef, useState } from 'react';
import { certificationsAPI } from '../../services/api';
import './Certifications.css';
import Icon from '../common/Icon';

const defaultForm = {
  name: '',
  issuing_organization: '',
  issue_date: '',
  expiry_date: '',
  does_not_expire: false,
  credential_id: '',
  credential_url: '',
  category: '',
  verification_status: 'unverified',
  renewal_reminder_enabled: false,
  reminder_days_before: 30,
  document: null,
};

const statusBadge = (status) => {
  switch (status) {
    case 'verified':
      return <span className="badge verified">Verified</span>;
    case 'pending':
      return <span className="badge pending">Pending</span>;
    case 'rejected':
      return <span className="badge rejected">Rejected</span>;
    default:
      return <span className="badge unverified">Unverified</span>;
  }
};

const Certifications = () => {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [orgQuery, setOrgQuery] = useState('');
  const [orgSuggestions, setOrgSuggestions] = useState([]);
  const [showOrgSuggestions, setShowOrgSuggestions] = useState(false);
  const [orgActiveIndex, setOrgActiveIndex] = useState(-1);
  const orgBoxRef = useRef(null);
  const orgInputRef = useRef(null);
  const docInputRef = useRef(null);
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [cats, certs] = await Promise.all([
          certificationsAPI.getCategories(),
          certificationsAPI.getCertifications(),
        ]);
        setCategories(cats || []);
        setItems(sortCerts(certs || []));
      } catch (e) {
        setError(e?.message || 'Failed to load certifications');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const q = form.issuing_organization.trim();
    setOrgQuery(q);
  }, [form.issuing_organization]);

  useEffect(() => {
    let active = true;
    const fetch = async () => {
      if (orgQuery.length < 2) { setOrgSuggestions([]); return; }
      try {
        const res = await certificationsAPI.searchOrganizations(orgQuery, 8);
        if (active) setOrgSuggestions(res || []);
      } catch (_) {
        if (active) setOrgSuggestions([]);
      }
    };
    fetch();
    return () => { active = false; };
  }, [orgQuery]);

  // Reset active index when suggestions change
  useEffect(() => {
    setOrgActiveIndex(-1);
  }, [orgSuggestions]);

  // Close suggestions on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (orgBoxRef.current && !orgBoxRef.current.contains(e.target)) {
        setShowOrgSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const sortCerts = (arr) => {
    const toNum = (d) => (d ? Date.parse(d) : 0);
    return [...(arr || [])].sort((a, b) => {
      // sort by expiry proximity: expired first? We'll sort by days until expiration ascending; never expires last
      const aNever = !!a.does_not_expire;
      const bNever = !!b.does_not_expire;
      if (aNever !== bNever) return aNever ? 1 : -1;
      const aDays = a.days_until_expiration ?? 999999;
      const bDays = b.days_until_expiration ?? 999999;
      if (aDays !== bDays) return aDays - bDays;
      // fallback to issue_date desc
      return toNum(b.issue_date) - toNum(a.issue_date);
    });
  };

  const resetForm = () => {
    setForm(defaultForm);
    setFieldErrors({});
    setEditingId(null);
    setShowForm(false);
    setOrgSuggestions([]);
    setShowOrgSuggestions(false);
  };

  const onChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'file') {
      setForm((prev) => ({ ...prev, [name]: files && files.length ? files[0] : null }));
    } else {
      setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
      if (fieldErrors[name]) {
        setFieldErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
      }
    }
  };

  // Upload helpers for document drag & drop (single file)
  const openDocDialog = () => docInputRef.current?.click();

  const onDocDragOver = (ev) => {
    ev.preventDefault();
    if (!isDraggingDoc) setIsDraggingDoc(true);
  };

  const onDocDragLeave = (ev) => {
    ev.preventDefault();
    setIsDraggingDoc(false);
  };

  const onDocDrop = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    setIsDraggingDoc(false);
    const dt = ev.dataTransfer;
    if (!dt) return;
    const file = (dt.files && dt.files[0]) || null;
    if (!file) return;
    const ok = [
      'application/pdf',
      'image/png',
      'image/jpeg',
    ];
    if (!ok.includes(file.type)) return;
    setForm((prev) => ({ ...prev, document: file }));
  };

  const removeDocument = () => setForm((prev) => ({ ...prev, document: null }));

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let i = -1;
    do { bytes = bytes / 1024; i++; } while (bytes >= 1024 && i < units.length - 1);
    return `${bytes.toFixed(bytes >= 100 ? 0 : bytes >= 10 ? 1 : 2)} ${units[i]}`;
  };

  const docPreview = useMemo(() => {
    if (!form.document) return null;
    if (form.document.type?.startsWith('image/')) {
      const url = URL.createObjectURL(form.document);
      return { kind: 'image', url };
    }
    return { kind: 'file' };
  }, [form.document]);

  useEffect(() => {
    return () => {
      if (docPreview?.kind === 'image' && docPreview.url) {
        URL.revokeObjectURL(docPreview.url);
      }
    };
  }, [docPreview]);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Certification name is required';
    if (!form.issuing_organization.trim()) errs.issuing_organization = 'Issuing organization is required';
    if (!form.issue_date) errs.issue_date = 'Date earned is required';
    if (!form.does_not_expire && !form.expiry_date) {
      errs.expiry_date = 'Expiration date required unless does not expire';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const toPayload = (data) => {
    const payload = { ...data };
    if (payload.does_not_expire) payload.expiry_date = null;
    if (!payload.category) delete payload.category;
    if (!payload.credential_id) delete payload.credential_id;
    if (!payload.credential_url) delete payload.credential_url;
    // Don't send document if none
    if (!payload.document) delete payload.document;
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await certificationsAPI.updateCertification(editingId, toPayload(form));
        setItems((prev) => sortCerts((prev || []).map((i) => (i.id === editingId ? updated : i))));
      } else {
        const created = await certificationsAPI.addCertification(toPayload(form));
        setItems((prev) => sortCerts([...(prev || []), created]));
      }
      resetForm();
    } catch (e2) {
      if (e2?.details) setFieldErrors(e2.details);
      setError(e2?.message || 'Failed to save certification');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      issuing_organization: item.issuing_organization || '',
      issue_date: item.issue_date || '',
      expiry_date: item.expiry_date || '',
      does_not_expire: !!item.does_not_expire,
      credential_id: item.credential_id || '',
      credential_url: item.credential_url || '',
      category: item.category || '',
      verification_status: item.verification_status || 'unverified',
      renewal_reminder_enabled: !!item.renewal_reminder_enabled,
      reminder_days_before: item.reminder_days_before ?? 30,
      document: null,
    });
    setFieldErrors({});
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      await certificationsAPI.deleteCertification(id);
      setItems((prev) => (prev || []).filter((i) => i.id !== id));
      if (editingId === id) resetForm();
      setDeleteConfirm(null);
    } catch (e) {
      setError(e?.message || 'Failed to delete');
    }
  };

  const pickSuggestion = (value) => {
    setForm((prev) => ({ ...prev, issuing_organization: value }));
    setShowOrgSuggestions(false);
  };

  const handleOrgKeyDown = (e) => {
    if (!showOrgSuggestions && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setShowOrgSuggestions(true);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOrgActiveIndex((idx) => Math.min(idx + 1, (orgSuggestions?.length || 1) - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOrgActiveIndex((idx) => Math.max(idx - 1, 0));
    } else if (e.key === 'Enter') {
      if (showOrgSuggestions && orgActiveIndex >= 0 && orgSuggestions[orgActiveIndex]) {
        e.preventDefault();
        pickSuggestion(orgSuggestions[orgActiveIndex]);
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setShowOrgSuggestions(false);
    }
  };

  if (loading) return <div className="certifications-container">Loading certifications...</div>;

  return (
    <div className="certifications-container">
      <div className="certifications-page-header">
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
      </div>

      <div className="certifications-header">
        <h2><Icon name="cert" size="md" /> Your Professional Certifications</h2>
        <button 
          className="add-certification-button"
          onClick={() => {
            setForm(defaultForm);
            setEditingId(null);
            setFieldErrors({});
            setShowForm(true);
          }}
        >
          + Add Certification
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showForm && (
        <div className="certification-form-card">
          <div className="form-header">
            <h3>{editingId ? 'Edit Certification' : 'Add Certification'}</h3>
            <button className="close-button" onClick={resetForm}><Icon name="trash" size="sm" ariaLabel="Close" /></button>
          </div>

          <form className="certification-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">Certification Name <span className="required">*</span></label>
            <input id="name" name="name" value={form.name} onChange={onChange} className={fieldErrors.name ? 'error' : ''} />
            {fieldErrors.name && <div className="error-message">{fieldErrors.name}</div>}
          </div>
          <div className="form-group org-group" ref={orgBoxRef}>
            <label htmlFor="issuing_organization">Issuing Organization <span className="required">*</span></label>
            <input
              id="issuing_organization"
              name="issuing_organization"
              value={form.issuing_organization}
              onChange={(e) => { onChange(e); setShowOrgSuggestions(true); }}
              autoComplete="off"
              className={fieldErrors.issuing_organization ? 'error' : ''}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showOrgSuggestions}
              aria-controls="org-listbox"
              aria-activedescendant={orgActiveIndex >= 0 ? `org-option-${orgActiveIndex}` : undefined}
              onKeyDown={handleOrgKeyDown}
              onFocus={() => setShowOrgSuggestions(true)}
              ref={orgInputRef}
            />
            {showOrgSuggestions && (
              <div className="suggestions" role="listbox" id="org-listbox">
                {orgQuery.length < 2 && (
                  <div className="suggestion disabled" aria-disabled="true">Type at least 2 characters…</div>
                )}
                {orgQuery.length >= 2 && orgSuggestions.length === 0 && (
                  <div className="suggestion disabled" aria-disabled="true">No organizations found</div>
                )}
                {orgSuggestions.map((s, idx) => (
                  <div
                    key={`${s}-${idx}`}
                    id={`org-option-${idx}`}
                    role="option"
                    aria-selected={idx === orgActiveIndex}
                    className={`suggestion ${idx === orgActiveIndex ? 'active' : ''}`}
                    onMouseEnter={() => setOrgActiveIndex(idx)}
                    onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
            {fieldErrors.issuing_organization && <div className="error-message">{fieldErrors.issuing_organization}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="issue_date">Date Earned <span className="required">*</span></label>
            <input id="issue_date" type="date" name="issue_date" value={form.issue_date} onChange={onChange} className={fieldErrors.issue_date ? 'error' : ''} />
            {fieldErrors.issue_date && <div className="error-message">{fieldErrors.issue_date}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="expiry_date">Expiration Date {form.does_not_expire ? '' : <span className="required">*</span>}</label>
            <input id="expiry_date" type="date" name="expiry_date" value={form.expiry_date || ''} onChange={onChange} disabled={form.does_not_expire} className={fieldErrors.expiry_date ? 'error' : ''} />
            {fieldErrors.expiry_date && <div className="error-message">{fieldErrors.expiry_date}</div>}
            <label className="inline-checkbox" htmlFor="does_not_expire">
              <input id="does_not_expire" type="checkbox" name="does_not_expire" checked={form.does_not_expire} onChange={onChange} />
              <span className="checkbox-label-text">Does not expire</span>
            </label>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="credential_id">Certification ID/Number</label>
            <input id="credential_id" name="credential_id" value={form.credential_id} onChange={onChange} />
          </div>
          <div className="form-group">
            <label htmlFor="credential_url">Credential URL</label>
            <input id="credential_url" name="credential_url" value={form.credential_url} onChange={onChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select id="category" name="category" value={form.category} onChange={onChange}>
              <option value="">Select category</option>
              {(categories || []).map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Verification Status</label>
            <div>
              {statusBadge(form.verification_status)}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="renewal_reminder_enabled">Renewal Reminder</label>
            <label className="inline-checkbox" htmlFor="renewal_reminder_enabled">
              <input id="renewal_reminder_enabled" type="checkbox" name="renewal_reminder_enabled" checked={form.renewal_reminder_enabled} onChange={onChange} />
              <span className="checkbox-label-text">Enable reminder</span>
            </label>
            {form.renewal_reminder_enabled && (
              <div className="inline-input">
                <label htmlFor="reminder_days_before">Days before expiration</label>
                <input id="reminder_days_before" type="number" min="1" max="365" name="reminder_days_before" value={form.reminder_days_before} onChange={onChange} />
              </div>
            )}
          </div>
        </div>

        {/* Document Upload - moved to bottom */}
        <div className="form-row">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="document">Upload Document</label>
            <input
              id="document"
              name="document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={onChange}
              ref={docInputRef}
              style={{ display: 'none' }}
            />

            <div
              className={`upload-dropzone ${isDraggingDoc ? 'dragover' : ''}`}
              onClick={openDocDialog}
              onDragEnter={onDocDragOver}
              onDragOver={onDocDragOver}
              onDragLeave={onDocDragLeave}
              onDrop={onDocDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openDocDialog()}
              aria-label="Upload certification document by click or drag and drop"
            >
              <div className="upload-illustration" aria-hidden="true">
                {/* Document icon */}
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                  <path d="M7 3.75A2.25 2.25 0 0 1 9.25 1.5h3.879c.597 0 1.17.237 1.591.659l3.121 3.121c.422.421.659.994.659 1.591V18.75A2.25 2.25 0 0 1 16.25 21H9.75A2.25 2.25 0 0 1 7.5 18.75V3.75z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M12 1.5v3.75c0 .621.504 1.125 1.125 1.125H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M8.75 12h6.5M8.75 15.25h6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="upload-copy">
                <div className="upload-title">Drag & drop your document</div>
                <div className="upload-subtitle">or click to browse</div>
                <div className="upload-hint">PDF, JPG, PNG up to ~10MB</div>
              </div>
              <div className="upload-actions">
                <button type="button" className="upload-browse" onClick={openDocDialog} aria-label="Browse files">
                  Browse File
                </button>
                {form.document && (
                  <button type="button" className="upload-clear" onClick={removeDocument} aria-label="Clear selected file">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {form.document && (
              <div className="upload-previews" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                <div className="upload-preview-card">
                  <div className="upload-thumb">
                    {docPreview?.kind === 'image' ? (
                      <img src={docPreview.url} alt={form.document.name} />
                    ) : (
                      <div className="doc-fallback" aria-hidden="true">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7 3.75A2.25 2.25 0 0 1 9.25 1.5h3.879c.597 0 1.17.237 1.591.659l3.121 3.121c.422.421.659.994.659 1.591V18.75A2.25 2.25 0 0 1 16.25 21H9.75A2.25 2.25 0 0 1 7.5 18.75V3.75z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                          <path d="M12 1.5v3.75c0 .621.504 1.125 1.125 1.125H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                    <button
                      type="button"
                      className="thumb-remove"
                      title="Remove file"
                      aria-label="Remove file"
                      onClick={removeDocument}
                    >
                      ×
                    </button>
                  </div>
                  <div className="thumb-meta">
                    <div className="thumb-name" title={form.document.name}>{form.document.name}</div>
                    <div className="thumb-size">{formatBytes(form.document.size)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={resetForm} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="save-button" disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update Certification' : 'Add Certification'}
          </button>
        </div>
      </form>
        </div>
      )}

      {(items || []).length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-icon"><Icon name="cert" size="xl" ariaLabel="No certifications" /></div>
          <h3>No Certifications Yet</h3>
          <p>Add your professional certifications to showcase your expertise.</p>
          <button className="add-certification-button" onClick={() => {
            setForm(defaultForm);
            setEditingId(null);
            setFieldErrors({});
            setShowForm(true);
          }}>
            + Add Your First Certification
          </button>
        </div>
      ) : (
        <div className="certifications-list">
          {(items || []).map((item) => (
            <div key={item.id} className={`certification-item ${item.is_expired ? 'expired' : ''}`}>
              <div className="certification-item-header">
                <div className="certification-item-main">
                  <div className="certification-item-title">
                    {item.name}
                  </div>
                  <div className="certification-item-sub">
                    <span className="organization"><Icon name="link" size="sm" /> {item.issuing_organization}</span>
                    {item.category && <span className="cert-category-badge">{item.category}</span>}
                    {statusBadge(item.verification_status)}
                  </div>
                  <div className="certification-item-dates">
                    <span className="dates">Earned {item.issue_date}</span>
                    {item.does_not_expire ? (
                      <span className="no-expiry"> • Does not expire</span>
                    ) : item.expiry_date ? (
                      <>
                        <span> • Expires {item.expiry_date}</span>
                        {item.is_expired ? (
                          <span className="status-badge expired">Expired</span>
                        ) : item.days_until_expiration != null && (
                          <span className="status-badge expiring-soon">{item.days_until_expiration} days left</span>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="certification-item-actions">
                  <button 
                    className="edit-button"
                    onClick={() => startEdit(item)}
                    title="Edit"
                  >
                    <Icon name="edit" size="sm" ariaLabel="Edit" />
                  </button>
                  <button 
                    className="delete-button"
                    onClick={() => setDeleteConfirm(item.id)}
                    title="Delete"
                  >
                    <Icon name="trash" size="sm" ariaLabel="Delete" />
                  </button>
                </div>
              </div>
              {(item.credential_id || item.credential_url || item.document_url) && (
                <div className="certification-item-details">
                  {item.credential_id && (
                    <div><strong>Credential ID:</strong> {item.credential_id}</div>
                  )}
                  {item.credential_url && (
                    <div><a href={item.credential_url} target="_blank" rel="noreferrer">🔗 View Credential</a></div>
                  )}
                  {item.document_url && (
                    <div><a href={item.document_url} target="_blank" rel="noreferrer">📄 Download Document</a></div>
                  )}
                </div>
              )}

              {deleteConfirm === item.id && (
                <div className="delete-confirm">
                  <p>Are you sure you want to delete this certification?</p>
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
          ))}
        </div>
      )}
    </div>
  );
};

export default Certifications;
