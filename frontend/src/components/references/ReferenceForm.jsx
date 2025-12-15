import React, { useState } from 'react';

const ReferenceForm = ({ reference, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: reference?.name || '',
    title: reference?.title || '',
    company: reference?.company || '',
    email: reference?.email || '',
    phone: reference?.phone || '',
    linkedin_url: reference?.linkedin_url || '',
    relationship_type: reference?.relationship_type || 'colleague',
    relationship_description: reference?.relationship_description || '',
    years_known: reference?.years_known || 1,
    availability_status: reference?.availability_status || 'pending_permission',
    preferred_contact_method: reference?.preferred_contact_method || 'email',
    best_for_roles: reference?.best_for_roles || [],
    best_for_industries: reference?.best_for_industries || [],
    key_strengths_to_highlight: reference?.key_strengths_to_highlight || '',
    projects_worked_together: reference?.projects_worked_together || '',
    talking_points: reference?.talking_points || [],
    notes: reference?.notes || '',
    is_active: reference?.is_active !== undefined ? reference.is_active : true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleArrayChange = (field, value) => {
    const items = value.split(',').map(s => s.trim()).filter(s => s);
    setFormData(prev => ({ ...prev, [field]: items }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSave(formData);
    } catch (err) {
      setError(err.message || 'Failed to save reference');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2>{reference ? 'Edit Reference' : 'Add New Reference'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="reference-form">
          {error && (
            <div className="error-message" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div className="form-section">
            <h3>Contact Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="title">Title/Position *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="company">Company *</label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phone">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="linkedin_url">LinkedIn URL</label>
                <input
                  type="url"
                  id="linkedin_url"
                  name="linkedin_url"
                  value={formData.linkedin_url}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Relationship Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="relationship_type">Relationship Type *</label>
                <select
                  id="relationship_type"
                  name="relationship_type"
                  value={formData.relationship_type}
                  onChange={handleChange}
                  required
                >
                  <option value="supervisor">Direct Supervisor</option>
                  <option value="manager">Manager</option>
                  <option value="colleague">Colleague</option>
                  <option value="mentor">Mentor</option>
                  <option value="professor">Professor/Academic</option>
                  <option value="client">Client</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="years_known">Years Known</label>
                <input
                  type="number"
                  id="years_known"
                  name="years_known"
                  value={formData.years_known}
                  onChange={handleChange}
                  min="0"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="relationship_description">Relationship Description</label>
              <textarea
                id="relationship_description"
                name="relationship_description"
                value={formData.relationship_description}
                onChange={handleChange}
                rows="3"
                placeholder="How did you work together?"
              />
            </div>

            <div className="form-group">
              <label htmlFor="projects_worked_together">Projects Worked Together</label>
              <textarea
                id="projects_worked_together"
                name="projects_worked_together"
                value={formData.projects_worked_together}
                onChange={handleChange}
                rows="3"
                placeholder="Describe specific projects or achievements"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Availability & Preferences</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="availability_status">Availability Status *</label>
                <select
                  id="availability_status"
                  name="availability_status"
                  value={formData.availability_status}
                  onChange={handleChange}
                  required
                >
                  <option value="pending_permission">Pending Permission</option>
                  <option value="available">Available</option>
                  <option value="limited">Limited Availability</option>
                  <option value="unavailable">Currently Unavailable</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="preferred_contact_method">Preferred Contact Method</label>
                <select
                  id="preferred_contact_method"
                  name="preferred_contact_method"
                  value={formData.preferred_contact_method}
                  onChange={handleChange}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="either">Either</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="best_for_roles">Best For Role Types (comma-separated)</label>
                <input
                  type="text"
                  id="best_for_roles"
                  value={(formData.best_for_roles || []).join(', ')}
                  onChange={(e) => handleArrayChange('best_for_roles', e.target.value)}
                  placeholder="Software Engineer, Manager, etc."
                />
              </div>
              <div className="form-group">
                <label htmlFor="best_for_industries">Best For Industries (comma-separated)</label>
                <input
                  type="text"
                  id="best_for_industries"
                  value={(formData.best_for_industries || []).join(', ')}
                  onChange={(e) => handleArrayChange('best_for_industries', e.target.value)}
                  placeholder="Tech, Finance, Healthcare, etc."
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Reference Details</h3>
            <div className="form-group">
              <label htmlFor="key_strengths_to_highlight">Key Strengths to Highlight</label>
              <textarea
                id="key_strengths_to_highlight"
                name="key_strengths_to_highlight"
                value={formData.key_strengths_to_highlight}
                onChange={handleChange}
                rows="3"
                placeholder="What strengths can this reference speak to?"
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Private Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                placeholder="Any private notes about this reference"
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                <span>Active Reference</span>
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : (reference ? 'Update Reference' : 'Add Reference')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReferenceForm;
