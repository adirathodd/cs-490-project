import React, { useState, useEffect } from 'react';
import { referencesAPI } from '../../services/referencesAPI';
import Icon from '../common/Icon';

const ReferenceTemplates = ({ onClose, onSelectTemplate }) => {
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  const [formData, setFormData] = useState({
    name: '',
    template_type: 'request_email',
    subject_line: '',
    content: '',
    for_relationship_types: [],
    for_role_types: [],
    is_default: false,
  });

  useEffect(() => {
    loadTemplates();
  }, [filterType]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params = filterType !== 'all' ? { type: filterType } : {};
      const data = await referencesAPI.getTemplates(params);
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      template_type: template.template_type,
      subject_line: template.subject_line || '',
      content: template.content,
      for_relationship_types: template.for_relationship_types || [],
      for_role_types: template.for_role_types || [],
      is_default: template.is_default,
    });
    setShowForm(true);
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await referencesAPI.deleteTemplate(templateId);
      loadTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert('Failed to delete template');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedTemplate) {
        await referencesAPI.updateTemplate(selectedTemplate.id, formData);
      } else {
        await referencesAPI.createTemplate(formData);
      }
      setShowForm(false);
      setSelectedTemplate(null);
      loadTemplates();
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('Failed to save template');
    }
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setFormData({
      name: '',
      template_type: 'request_email',
      subject_line: '',
      content: '',
      for_relationship_types: [],
      for_role_types: [],
      is_default: false,
    });
    setShowForm(true);
  };

  const templateTypeDisplay = {
    request_email: 'Reference Request Email',
    preparation_guide: 'Preparation Guide',
    talking_points: 'Talking Points',
    thank_you: 'Thank You Note',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
        <div className="modal-header">
          <h2><Icon name="file-text" size="md" /> Reference Templates</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
        {!showForm ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div className="tabs-container">
                <button className={`tab-button ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>
                  All Templates
                </button>
                <button className={`tab-button ${filterType === 'request_email' ? 'active' : ''}`} onClick={() => setFilterType('request_email')}>
                  Request Emails
                </button>
                <button className={`tab-button ${filterType === 'preparation_guide' ? 'active' : ''}`} onClick={() => setFilterType('preparation_guide')}>
                  Prep Guides
                </button>
                <button className={`tab-button ${filterType === 'thank_you' ? 'active' : ''}`} onClick={() => setFilterType('thank_you')}>
                  Thank You
                </button>
              </div>
              <button className="add-button" onClick={handleCreate}>
                + New Template
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>Loading templates...</div>
            ) : templates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <Icon name="file-text" size="xl" />
                <p style={{ marginTop: '16px' }}>No templates yet. Create your first template!</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {templates.map(template => (
                  <div key={template.id} className="card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <h3 style={{ margin: 0 }}>{template.name}</h3>
                          {template.is_default && (
                            <span style={{ 
                              padding: '2px 8px', 
                              background: '#dbeafe', 
                              color: '#1e40af', 
                              borderRadius: '4px', 
                              fontSize: '12px' 
                            }}>
                              Default
                            </span>
                          )}
                        </div>
                        <p style={{ color: '#666', fontSize: '14px', margin: '4px 0' }}>
                          {templateTypeDisplay[template.template_type]}
                        </p>
                        {template.subject_line && (
                          <p style={{ color: '#888', fontSize: '13px', fontStyle: 'italic', margin: '4px 0' }}>
                            Subject: {template.subject_line}
                          </p>
                        )}
                        <p style={{ color: '#666', fontSize: '13px', marginTop: '8px', lineHeight: '1.5' }}>
                          {template.content.substring(0, 150)}...
                        </p>
                        <p style={{ color: '#888', fontSize: '12px', marginTop: '8px' }}>
                          Used {template.times_used} times
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {onSelectTemplate && (
                          <button 
                            className="btn-secondary"
                            onClick={() => onSelectTemplate(template)}
                            style={{ padding: '6px 12px', fontSize: '14px' }}
                          >
                            Use
                          </button>
                        )}
                        <button 
                          className="btn-secondary"
                          onClick={() => handleEdit(template)}
                          style={{ padding: '6px 12px', fontSize: '14px' }}
                        >
                          <Icon name="edit" size="sm" />
                        </button>
                        <button 
                          className="btn-danger"
                          onClick={() => handleDelete(template.id)}
                          style={{ padding: '6px 12px', fontSize: '14px' }}
                        >
                          <Icon name="trash" size="sm" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
            <div className="form-group">
              <label>Template Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Software Engineering Request"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Template Type *</label>
                <select
                  value={formData.template_type}
                  onChange={(e) => setFormData({ ...formData, template_type: e.target.value })}
                  required
                >
                  <option value="request_email">Reference Request Email</option>
                  <option value="preparation_guide">Preparation Guide</option>
                  <option value="talking_points">Talking Points</option>
                  <option value="thank_you">Thank You Note</option>
                </select>
              </div>
              <div className="form-group" style={{ marginTop: '20px' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  />
                  <span>Set as Default Template</span>
                </label>
              </div>
            </div>

            {formData.template_type === 'request_email' && (
              <div className="form-group">
                <label>Email Subject Line</label>
                <input
                  type="text"
                  value={formData.subject_line}
                  onChange={(e) => setFormData({ ...formData, subject_line: e.target.value })}
                  placeholder="Reference Request for {{position}} at {{company}}"
                />
              </div>
            )}

            <div className="form-group">
              <label>Template Content *</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                required
                rows="10"
                placeholder="Use placeholders like {{reference_name}}, {{position}}, {{company}}, {{your_name}}"
              />
              <small style={{ color: '#666', fontSize: '12px' }}>
                Available placeholders: {'{{reference_name}}'}, {'{{position}}'}, {'{{company}}'}, {'{{your_name}}'}, {'{{relationship}}'}
              </small>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {selectedTemplate ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
};

export default ReferenceTemplates;
