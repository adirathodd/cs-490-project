import React, { useState, useEffect } from 'react';
import { coverLetterTemplateAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import './CoverLetterTemplates.css';

const CoverLetterTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    type: '',
    industry: '',
    search: ''
  });
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState({});

  useEffect(() => {
    loadTemplates();
  }, []);

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
      </div>

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

                  <button
                    onClick={() => handleDownload(template, 'pdf')}
                    disabled={downloading[`${template.id}-pdf`]}
                    className="download-btn pdf"
                    title="Download as PDF"
                  >
                    {downloading[`${template.id}-pdf`] ? '⏳' : '📕'} PDF
                  </button>
                </div>
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

                <button
                  onClick={() => handleDownload(previewTemplate, 'pdf')}
                  disabled={downloading[`${previewTemplate.id}-pdf`]}
                  className="download-btn pdf"
                >
                  {downloading[`${previewTemplate.id}-pdf`] ? 'Downloading...' : 'Download PDF'}
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