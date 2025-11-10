import React, { useState, useEffect } from 'react';
import { coverLetterTemplateAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './common/LoadingSpinner';
import './CoverLetterTemplates.css';

const CoverLetterTemplates = () => {
  const { currentUser } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [filters, setFilters] = useState({
    type: '',
    industry: '',
    search: ''
  });
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState({});
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [customizingTemplate, setCustomizingTemplate] = useState(null);
  const [customizing, setCustomizing] = useState(false);
  const [deleting, setDeleting] = useState({});
  const [customizationData, setCustomizationData] = useState({
    header_text: '',
    header_color: '#2c5aa0',
    font_family: 'Arial',
    header_font_size: 14,
    body_font_size: 12
  });

  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        loadTemplates(),
        loadCurrentUserData()
      ]);
    };
    initializeData();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadCurrentUserData();
    }
  }, [currentUser]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await coverLetterTemplateAPI.getTemplates();
      setTemplates(data);
      setError(null);
    } catch (err) {
      setError('Failed to load templates. Please try again.');
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUserData = async () => {
    if (!currentUser) return;
    
    try {
      const userData = await authAPI.getCurrentUser();
      setCurrentUserData(userData);
    } catch (err) {
      console.error('Error loading current user data:', err);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesType = !filters.type || template.template_type === filters.type;
    const matchesIndustry = !filters.industry || template.industry === filters.industry;
    const matchesSearch = !filters.search || 
      template.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      template.description.toLowerCase().includes(filters.search.toLowerCase());
    
    return matchesType && matchesIndustry && matchesSearch;
  });

  const handlePreview = async (template) => {
    try {
      // Track analytics for preview
      await coverLetterTemplateAPI.trackUsage(template.id);
      setPreviewTemplate(template);
      setShowPreview(true);
    } catch (err) {
      console.error('Error tracking template usage:', err);
      // Still show preview even if analytics fails
      setPreviewTemplate(template);
      setShowPreview(true);
    }
  };

  const handleDownload = async (template, format) => {
    try {
      setDownloading({ ...downloading, [`${template.id}-${format}`]: true });
      await coverLetterTemplateAPI.downloadTemplate(template.id, format);
      // Download is handled in the API function
    } catch (err) {
      setError(`Failed to download template in ${format.toUpperCase()} format.`);
      console.error('Error downloading template:', err);
    } finally {
      setDownloading({ ...downloading, [`${template.id}-${format}`]: false });
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['.txt', '.docx'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      setError('Please upload a .txt or .docx file.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name.replace(/\.[^/.]+$/, "")); // Remove extension
      formData.append('template_type', 'custom');
      formData.append('description', `Uploaded template from ${file.name}`);

      await coverLetterTemplateAPI.importTemplate(formData);
      await loadTemplates(); // Refresh template list
      setShowUpload(false);
      setError(null);
      
      // Reset file input
      event.target.value = '';
      
    } catch (err) {
      setError('Failed to upload template file.');
      console.error('Error uploading template:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleCustomize = (template) => {
    setCustomizingTemplate(template);
    // Load existing customization options if available
    const existing = template.customization_options || {};
    setCustomizationData({
      header_text: existing.header_text || '',
      header_color: existing.header_color || '#2c5aa0',
      font_family: existing.font_family || 'Arial',
      header_font_size: existing.header_font_size || 14,
      body_font_size: existing.body_font_size || 12
    });
    setShowCustomization(true);
  };

  const handleCustomizationSubmit = async () => {
    if (!customizingTemplate) return;

    try {
      setCustomizing(true);
      console.log('Submitting customization:', customizationData);
      console.log('Template ID:', customizingTemplate.id);
      
      const response = await coverLetterTemplateAPI.customize(customizingTemplate.id, customizationData);
      console.log('Customization response:', response);
      
      // Update the template in the list
      setTemplates(templates.map(t => 
        t.id === customizingTemplate.id ? response.template : t
      ));
      
      setShowCustomization(false);
      setCustomizingTemplate(null);
      setError(null);
      
    } catch (err) {
      console.error('Customization error:', err);
      setError('Failed to save customization settings.');
      console.error('Error customizing template:', err);
    } finally {
      setCustomizing(false);
    }
  };

  const handleCustomizationChange = (field, value) => {
    setCustomizationData({
      ...customizationData,
      [field]: value
    });
  };

  const handleDeleteTemplate = async (template) => {
    // Check if user owns this template
    if (!currentUserData || template.owner !== currentUserData.id) {
      setError('You can only delete your own templates.');
      return;
    }

    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete "${template.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting({ ...deleting, [template.id]: true });
      await coverLetterTemplateAPI.deleteTemplate(template.id);
      
      // Remove from local state
      setTemplates(templates.filter(t => t.id !== template.id));
      setError(null);
      
      // Close preview modal if this template was being previewed
      if (previewTemplate && previewTemplate.id === template.id) {
        setShowPreview(false);
        setPreviewTemplate(null);
      }
      
    } catch (err) {
      setError('Failed to delete template. Please try again.');
      console.error('Error deleting template:', err);
    } finally {
      setDeleting({ ...deleting, [template.id]: false });
    }
  };

  const isUserTemplate = (template) => {
    return currentUserData && template.owner === currentUserData.id;
  };

  const templateTypes = ['formal', 'creative', 'technical', 'industry'];
  const industries = [...new Set(templates.filter(t => t.industry).map(t => t.industry))];

  if (loading) {
    return (
      <div className="cover-letter-templates">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="cover-letter-templates">
      <div className="templates-header">
        <h1>Cover Letter Template Library</h1>
        <p>Browse and download professional cover letter templates for different industries and styles.</p>
        <div className="header-actions">
          <button 
            onClick={() => setShowUpload(!showUpload)}
            className="upload-toggle-btn"
          >
            📤 Upload Template
          </button>
        </div>
      </div>

      {/* File Upload Section */}
      {showUpload && (
        <div className="upload-section">
          <h3>Upload Your Template</h3>
          <p>Upload a .txt or .docx file to add it to the template library.</p>
          <div className="upload-form">
            <input
              type="file"
              accept=".txt,.docx"
              onChange={handleFileUpload}
              disabled={uploading}
              className="file-input"
            />
            {uploading && <span className="upload-status">Uploading... ⏳</span>}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="templates-filters">
        <div className="filter-group">
          <label htmlFor="search">Search templates:</label>
          <input
            id="search"
            type="text"
            placeholder="Search by name or description..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="type">Template Type:</label>
          <select
            id="type"
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="filter-select"
          >
            <option value="">All Types</option>
            {templateTypes.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="industry">Industry:</label>
          <select
            id="industry"
            value={filters.industry}
            onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
            className="filter-select"
          >
            <option value="">All Industries</option>
            {industries.map(industry => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </div>

        <button 
          onClick={() => setFilters({ type: '', industry: '', search: '' })}
          className="clear-filters-btn"
        >
          Clear Filters
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Template Grid */}
      <div className="templates-grid">
        {filteredTemplates.length === 0 ? (
          <div className="no-templates">
            <p>No templates found matching your criteria.</p>
          </div>
        ) : (
          filteredTemplates.map(template => (
            <div key={template.id} className="template-card">
              <div className="template-header">
                <h3>{template.name}</h3>
                <div className="template-badges">
                  <span className={`template-type-badge ${template.template_type}`}>
                    {template.template_type}
                  </span>
                  {template.industry && (
                    <span className="industry-badge">
                      {template.industry}
                    </span>
                  )}
                </div>
              </div>

              <p className="template-description">{template.description}</p>

              <div className="template-stats">
                <span className="usage-count">
                  📥 {template.usage_count} downloads
                </span>
              </div>

              <div className="template-actions">
                <button
                  onClick={() => handlePreview(template)}
                  className="preview-btn"
                >
                  👁️ Preview
                </button>

                <button
                  onClick={() => handleCustomize(template)}
                  className="customize-btn"
                  title="Customize styling"
                >
                  🎨 Customize
                </button>

                <div className="download-buttons">
                  <button
                    onClick={() => handleDownload(template, 'txt')}
                    disabled={downloading[`${template.id}-txt`]}
                    className="download-btn txt"
                    title="Download as plain text"
                  >
                    {downloading[`${template.id}-txt`] ? '⏳' : '📄'} TXT
                  </button>

                  <button
                    onClick={() => handleDownload(template, 'docx')}
                    disabled={downloading[`${template.id}-docx`]}
                    className="download-btn docx"
                    title="Download as Word document"
                  >
                    {downloading[`${template.id}-docx`] ? '⏳' : '📘'} DOCX
                  </button>
                </div>

                {/* Delete button - only for user's own templates */}
                {isUserTemplate(template) && (
                  <button
                    onClick={() => handleDeleteTemplate(template)}
                    disabled={deleting[template.id]}
                    className="delete-btn"
                    title="Delete this template"
                  >
                    {deleting[template.id] ? '⏳' : '🗑️'} Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && previewTemplate && (
        <div className="preview-modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <h2>{previewTemplate.name}</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="close-btn"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>

            <div className="preview-content">
              <div className="preview-meta">
                <span className="template-type">{previewTemplate.template_type}</span>
                {previewTemplate.industry && (
                  <span className="template-industry">{previewTemplate.industry}</span>
                )}
              </div>

              <div className="preview-text">
                <h4>Sample Content:</h4>
                <div className="sample-content">
                  {previewTemplate.sample_content || previewTemplate.content}
                </div>
              </div>

              <div className="preview-actions">
                <button
                  onClick={() => handleDownload(previewTemplate, 'txt')}
                  disabled={downloading[`${previewTemplate.id}-txt`]}
                  className="download-btn txt"
                >
                  {downloading[`${previewTemplate.id}-txt`] ? 'Downloading...' : 'Download TXT'}
                </button>

                <button
                  onClick={() => handleDownload(previewTemplate, 'docx')}
                  disabled={downloading[`${previewTemplate.id}-docx`]}
                  className="download-btn docx"
                >
                  {downloading[`${previewTemplate.id}-docx`] ? 'Downloading...' : 'Download DOCX'}
                </button>

                {/* Delete button in preview modal - only for user's own templates */}
                {isUserTemplate(previewTemplate) && (
                  <button
                    onClick={() => handleDeleteTemplate(previewTemplate)}
                    disabled={deleting[previewTemplate.id]}
                    className="delete-btn preview-delete"
                    title="Delete this template"
                  >
                    {deleting[previewTemplate.id] ? 'Deleting...' : '🗑️ Delete'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customization Modal */}
      {showCustomization && customizingTemplate && (
        <div className="modal-overlay" onClick={() => setShowCustomization(false)}>
          <div className="customization-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Customize Template: {customizingTemplate.name}</h3>
              <button 
                className="close-btn" 
                onClick={() => setShowCustomization(false)}
              >
                ✕
              </button>
            </div>

            <div className="customization-form">
              <div className="form-group">
                <label htmlFor="header_text">Header Text (Optional)</label>
                <input
                  type="text"
                  id="header_text"
                  value={customizationData.header_text}
                  onChange={(e) => handleCustomizationChange('header_text', e.target.value)}
                  placeholder="e.g., Your Name or Company Name"
                  maxLength="200"
                />
                <small>Add a custom header to appear at the top of your cover letter</small>
              </div>

              <div className="form-group">
                <label htmlFor="header_color">Header Color</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    id="header_color"
                    value={customizationData.header_color}
                    onChange={(e) => handleCustomizationChange('header_color', e.target.value)}
                  />
                  <input
                    type="text"
                    value={customizationData.header_color}
                    onChange={(e) => handleCustomizationChange('header_color', e.target.value)}
                    placeholder="#2c5aa0"
                    className="color-text-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="font_family">Font Family</label>
                <select
                  id="font_family"
                  value={customizationData.font_family}
                  onChange={(e) => handleCustomizationChange('font_family', e.target.value)}
                >
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Calibri">Calibri</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="header_font_size">Header Font Size</label>
                  <input
                    type="number"
                    id="header_font_size"
                    value={customizationData.header_font_size}
                    onChange={(e) => handleCustomizationChange('header_font_size', parseInt(e.target.value))}
                    min="10"
                    max="24"
                  />
                  <small>10-24 pts</small>
                </div>

                <div className="form-group">
                  <label htmlFor="body_font_size">Body Font Size</label>
                  <input
                    type="number"
                    id="body_font_size"
                    value={customizationData.body_font_size}
                    onChange={(e) => handleCustomizationChange('body_font_size', parseInt(e.target.value))}
                    min="8"
                    max="18"
                  />
                  <small>8-18 pts</small>
                </div>
              </div>

              <div className="preview-section">
                <h4>Preview</h4>
                <div className="style-preview">
                  {customizationData.header_text && (
                    <div 
                      className="header-preview"
                      style={{
                        color: customizationData.header_color,
                        fontFamily: customizationData.font_family,
                        fontSize: `${customizationData.header_font_size}px`,
                        fontWeight: 'bold',
                        textAlign: 'center',
                        marginBottom: '10px'
                      }}
                    >
                      {customizationData.header_text}
                    </div>
                  )}
                  <div 
                    className="body-preview"
                    style={{
                      fontFamily: customizationData.font_family,
                      fontSize: `${customizationData.body_font_size}px`,
                      lineHeight: '1.4'
                    }}
                  >
                    Dear Hiring Manager,<br/>
                    <br/>
                    This is a preview of how your cover letter will look with the selected styling options...
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  onClick={() => setShowCustomization(false)}
                  className="btn-secondary"
                  disabled={customizing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomizationSubmit}
                  className="btn-primary"
                  disabled={customizing}
                >
                  {customizing ? 'Saving...' : 'Save Customization'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoverLetterTemplates;