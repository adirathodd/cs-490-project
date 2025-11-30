import React, { useState, useEffect } from 'react';
import { referencesAPI } from '../../services/referencesAPI';
import Icon from '../common/Icon';

const ReferenceRequestForm = ({ reference, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    reference: reference?.id || '',
    company_name: '',
    position_title: '',
    due_date: '',
    custom_message: '',
    preparation_materials_sent: false,
  });
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await referencesAPI.getTemplates({ type: 'request_email' });
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      let message = template.content;
      // Replace placeholders
      message = message.replace('{reference_name}', reference?.name || '');
      message = message.replace('{company_name}', formData.company_name);
      message = message.replace('{position_title}', formData.position_title);
      setFormData(prev => ({ ...prev, custom_message: message }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const requestData = {
        ...formData,
        reference: reference.id,
      };
      if (selectedTemplate) {
        requestData.use_template = selectedTemplate;
      }
      await onSave(requestData);
    } catch (err) {
      setError(err.message || 'Failed to create reference request');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Request Reference from {reference?.name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit} className="reference-request-form">
          {error && (
            <div className="error-message" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="company_name">Company Name *</label>
            <input
              type="text"
              id="company_name"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="position_title">Position Title *</label>
            <input
              type="text"
              id="position_title"
              name="position_title"
              value={formData.position_title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="due_date">Due Date</label>
            <input
              type="date"
              id="due_date"
              name="due_date"
              value={formData.due_date}
              onChange={handleChange}
            />
          </div>

          {templates.length > 0 && (
            <div className="form-group">
              <label htmlFor="template">Use Template</label>
              <select
                id="template"
                value={selectedTemplate}
                onChange={(e) => handleTemplateSelect(e.target.value)}
              >
                <option value="">-- Select a template --</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="custom_message">Message to Reference</label>
            <textarea
              id="custom_message"
              name="custom_message"
              value={formData.custom_message}
              onChange={handleChange}
              rows="8"
              placeholder="Personalized message for this reference request"
            />
            <small style={{ color: '#6b7280', display: 'block', marginTop: '4px' }}>
              Tip: Include details about the role, company, and why you'd like them as a reference
            </small>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                name="preparation_materials_sent"
                checked={formData.preparation_materials_sent}
                onChange={handleChange}
              />
              <span>I've sent preparation materials to this reference</span>
            </label>
          </div>

          <div className="info-box" style={{
            padding: '12px',
            background: '#f0f9ff',
            borderRadius: '8px',
            border: '1px solid #bae6fd',
            marginTop: '16px'
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <Icon name="info" size="sm" style={{ color: '#0284c7', marginTop: '2px' }} />
              <div style={{ fontSize: '14px', color: '#0c4a6e' }}>
                <strong>Reference Details:</strong>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>{reference?.title} at {reference?.company}</li>
                  <li>Contact: {reference?.email}</li>
                  <li>Preferred method: {reference?.preferred_contact_method}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '24px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating Request...' : 'Create Request'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default ReferenceRequestForm;
