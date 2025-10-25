import React, { useEffect, useState } from 'react';
import { educationAPI } from '../services/api';
import './Education.css';

const defaultForm = {
  institution: '',
  degree_type: '',
  field_of_study: '',
  start_date: '',
  graduation_date: '',
  currently_enrolled: false,
  gpa: '',
  gpa_private: false,
  honors: '',
  achievements: '',
  description: ''
};

const Education = () => {
  const [levels, setLevels] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const sortEducations = (arr) => {
    if (!Array.isArray(arr)) return [];
    const toNum = (d) => (d ? Date.parse(d) : 0);
    return [...arr].sort((a, b) => {
      // Currently enrolled first
      if (!!a.currently_enrolled !== !!b.currently_enrolled) {
        return a.currently_enrolled ? -1 : 1;
      }
      const aDate = toNum(a.graduation_date || a.start_date);
      const bDate = toNum(b.graduation_date || b.start_date);
      if (aDate !== bDate) return bDate - aDate; // desc
      return (b.id || 0) - (a.id || 0);
    });
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [levelsResp, itemsResp] = await Promise.all([
          educationAPI.getLevels(),
          educationAPI.getEducations()
        ]);
        setLevels(levelsResp);
        setItems(sortEducations(itemsResp));
      } catch (e) {
        setError(e?.message || 'Failed to load education data');
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
  };

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.institution.trim()) errs.institution = 'Institution is required';
    if (!form.degree_type) errs.degree_type = 'Education level is required';
    if (!form.currently_enrolled && !form.graduation_date) {
      errs.graduation_date = 'Graduation date required unless currently enrolled';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const toPayload = (data) => {
    const payload = { ...data };
    // Normalize empty strings to null where appropriate
    if (payload.gpa === '') delete payload.gpa;
    if (!payload.graduation_date) payload.graduation_date = null;
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await educationAPI.updateEducation(editingId, toPayload(form));
        setItems((prev) => sortEducations((prev || []).map((i) => (i.id === editingId ? updated : i))));
      } else {
        const created = await educationAPI.addEducation(toPayload(form));
        setItems((prev) => sortEducations([...(prev || []), created]));
      }
      resetForm();
    } catch (e) {
      if (e?.details) {
        setFieldErrors(e.details);
      }
      setError(e?.message || 'Failed to save education');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      institution: item.institution || '',
      degree_type: item.degree_type || '',
      field_of_study: item.field_of_study || '',
      start_date: item.start_date || '',
      graduation_date: item.graduation_date || '',
      currently_enrolled: !!item.currently_enrolled,
      gpa: item.gpa ?? '',
      gpa_private: !!item.gpa_private,
      honors: item.honors || '',
      achievements: item.achievements || '',
      description: item.description || ''
    });
    setFieldErrors({});
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this education entry?')) return;
    try {
      await educationAPI.deleteEducation(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (editingId === id) resetForm();
    } catch (e) {
      setError(e?.message || 'Failed to delete');
    }
  };

  if (loading) {
    return <div className="education-container">Loading education...</div>;
  }

  return (
    <div className="education-container">
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

      <h2>Education</h2>

      {error && <div className="error-banner">{error}</div>}

      <form className="education-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="institution">Institution <span className="required">*</span></label>
            <input id="institution" name="institution" value={form.institution} onChange={onChange} className={fieldErrors.institution ? 'error' : ''} />
            {fieldErrors.institution && <div className="error-message">{fieldErrors.institution}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="degree_type">Education Level <span className="required">*</span></label>
            <select id="degree_type" name="degree_type" value={form.degree_type} onChange={onChange} className={fieldErrors.degree_type ? 'error' : ''}>
              <option value="">Select level</option>
              {(levels || []).map((lvl) => (
                <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
              ))}
            </select>
            {fieldErrors.degree_type && <div className="error-message">{fieldErrors.degree_type}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="field_of_study">Field of Study</label>
            <input id="field_of_study" name="field_of_study" value={form.field_of_study} onChange={onChange} />
          </div>
          <div className="form-group">
            <label htmlFor="gpa">GPA (optional)</label>
            <input id="gpa" type="number" step="0.01" min="0" max="4" name="gpa" value={form.gpa} onChange={onChange} />
            <label className="inline-checkbox" htmlFor="gpa_private">
              <input id="gpa_private" type="checkbox" name="gpa_private" checked={form.gpa_private} onChange={onChange} />
              <span className="checkbox-label-text">Hide GPA from others</span>
            </label>
            {fieldErrors.gpa && <div className="error-message">{fieldErrors.gpa}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="start_date">Start Date</label>
            <input id="start_date" type="date" name="start_date" value={form.start_date} onChange={onChange} />
          </div>
          <div className="form-group">
            <label htmlFor="graduation_date">Graduation Date {form.currently_enrolled ? '' : <span className="required">*</span>}</label>
            <input id="graduation_date" type="date" name="graduation_date" value={form.graduation_date || ''} onChange={onChange} disabled={form.currently_enrolled} className={fieldErrors.graduation_date ? 'error' : ''} />
            {fieldErrors.graduation_date && <div className="error-message">{fieldErrors.graduation_date}</div>}
            <label className="inline-checkbox" htmlFor="currently_enrolled">
              <input id="currently_enrolled" type="checkbox" name="currently_enrolled" checked={form.currently_enrolled} onChange={onChange} />
              <span className="checkbox-label-text">Currently enrolled</span>
            </label>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="honors">Honors</label>
          <input id="honors" name="honors" value={form.honors} onChange={onChange} placeholder="e.g., Summa Cum Laude, Dean's List" />
        </div>

        <div className="form-group">
          <label htmlFor="achievements">Achievements / Honors</label>
          <textarea id="achievements" name="achievements" rows={3} value={form.achievements} onChange={onChange} placeholder="Dean's list, scholarships, awards..." />
        </div>

        <div className="form-group">
          <label htmlFor="description">Additional Details</label>
          <textarea id="description" name="description" rows={3} value={form.description} onChange={onChange} placeholder="Coursework, projects, activities..." />
        </div>

        <div className="form-actions">
          {editingId && (
            <button type="button" className="cancel-button" onClick={resetForm} disabled={saving}>
              Cancel
            </button>
          )}
          <button type="submit" className="save-button" disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update Education' : 'Add Education'}
          </button>
        </div>
      </form>

      <div className="education-list timeline">
        {(items || []).length === 0 ? (
          <div className="empty-state">No education entries yet. Add your first one above.</div>
        ) : (
          (items || []).map((item) => (
            <div key={item.id} className={`education-item ${item.currently_enrolled ? 'ongoing' : 'completed'}`}>
              <div className="education-item-main">
                <div className="education-item-title">{item.institution}</div>
                <div className="education-item-sub">
                  <span>{(levels || []).find((l) => l.value === item.degree_type)?.label || item.degree_type}</span>
                  {item.field_of_study && <span> • {item.field_of_study}</span>}
                  {item.honors && <span className="honors-badge">{item.honors}</span>}
                </div>
                <div className="education-item-dates">
                  {item.currently_enrolled ? (
                    <span className="status ongoing">Enrolled</span>
                  ) : (
                    <span className="status completed">Graduated {item.graduation_date}</span>
                  )}
                </div>
              </div>
              {(item.gpa != null || item.achievements || item.description) && (
                <div className="education-item-details">
                  {item.gpa != null && (
                    <div className={`gpa-badge ${item.gpa_private ? 'private' : ''}`}>
                      GPA {item.gpa}{item.gpa_private ? ' 🔒' : ''}
                    </div>
                  )}
                  {item.achievements && <div><strong>Achievements:</strong> {item.achievements}</div>}
                  {item.description && <div><strong>Details:</strong> {item.description}</div>}
                </div>
              )}
              <div className="education-item-actions">
                <button className="edit-button" onClick={() => startEdit(item)}>Edit</button>
                <button className="delete-button" onClick={() => remove(item.id)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Education;
