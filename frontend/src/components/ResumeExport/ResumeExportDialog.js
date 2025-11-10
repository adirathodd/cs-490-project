/**
 * UC-051: Resume Export Dialog
 * Modal dialog for exporting resumes in multiple formats
 */
import React, { useState, useEffect } from 'react';
import { resumeExportAPI } from '../../services/api';
import './ResumeExportDialog.css';

const ResumeExportDialog = ({ isOpen, onClose }) => {
  const [format, setFormat] = useState('docx');
  const [theme, setTheme] = useState('professional');
  const [themes, setThemes] = useState([]);
  const [watermark, setWatermark] = useState('');
  const [filename, setFilename] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load available themes on mount
  useEffect(() => {
    if (isOpen) {
      loadThemes();
    }
  }, [isOpen]);

  const loadThemes = async () => {
    try {
      const data = await resumeExportAPI.getThemes();
      setThemes(data.themes || []);
    } catch (err) {
      console.error('Failed to load themes:', err);
      // Use default themes if API fails
      setThemes([
        { id: 'professional', name: 'Professional', description: 'Classic business style' },
        { id: 'modern', name: 'Modern', description: 'Contemporary design' },
        { id: 'minimal', name: 'Minimal', description: 'Clean and simple' },
        { id: 'creative', name: 'Creative', description: 'Bold and distinctive' },
      ]);
    }
  };

  const handleExport = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await resumeExportAPI.exportResume(format, theme, watermark, filename);
      setSuccess(`Successfully exported ${result.filename}`);
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to export resume. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      setSuccess('');
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  const selectedTheme = themes.find(t => t.id === theme) || themes[0];

  return (
    <div className="resume-export-overlay" onClick={handleClose}>
      <div className="resume-export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="resume-export-header">
          <h2>Export Resume</h2>
          <button
            className="resume-export-close"
            onClick={handleClose}
            disabled={loading}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="resume-export-body">
          {error && (
            <div className="resume-export-alert resume-export-alert-error">
              {error}
            </div>
          )}

          {success && (
            <div className="resume-export-alert resume-export-alert-success">
              {success}
            </div>
          )}

          {/* Format Selection */}
          <div className="resume-export-section">
            <label className="resume-export-label">
              Export Format <span className="required">*</span>
            </label>
            <div className="resume-export-format-grid">
              <button
                className={`resume-export-format-card ${format === 'docx' ? 'selected' : ''}`}
                onClick={() => setFormat('docx')}
                disabled={loading}
              >
                <div className="format-icon">📄</div>
                <div className="format-name">Word</div>
                <div className="format-desc">(.docx)</div>
              </button>

              <button
                className={`resume-export-format-card ${format === 'html' ? 'selected' : ''}`}
                onClick={() => setFormat('html')}
                disabled={loading}
              >
                <div className="format-icon">🌐</div>
                <div className="format-name">HTML</div>
                <div className="format-desc">Web Portfolio</div>
              </button>

              <button
                className={`resume-export-format-card ${format === 'txt' ? 'selected' : ''}`}
                onClick={() => setFormat('txt')}
                disabled={loading}
              >
                <div className="format-icon">📝</div>
                <div className="format-name">Plain Text</div>
                <div className="format-desc">ATS-Friendly</div>
              </button>
            </div>
            <p className="resume-export-hint">
              {format === 'docx' && 'Word documents are editable and widely accepted by employers.'}
              {format === 'html' && 'HTML format is ideal for online portfolios and personal websites.'}
              {format === 'txt' && 'Plain text format works best for online application forms and ATS systems.'}
            </p>
          </div>

          {/* Theme Selection */}
          {(format === 'docx' || format === 'html') && (
            <div className="resume-export-section">
              <label className="resume-export-label" htmlFor="theme-select">
                Theme Style
              </label>
              <select
                id="theme-select"
                className="resume-export-input"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                disabled={loading}
              >
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {selectedTheme && (
                <p className="resume-export-hint">{selectedTheme.description}</p>
              )}
            </div>
          )}

          {/* Custom Filename */}
          <div className="resume-export-section">
            <label className="resume-export-label" htmlFor="filename-input">
              Custom Filename (Optional)
            </label>
            <input
              id="filename-input"
              type="text"
              className="resume-export-input"
              placeholder="e.g., John_Doe_Resume"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              disabled={loading}
            />
            <p className="resume-export-hint">
              Leave blank to auto-generate from your name
            </p>
          </div>

          {/* Watermark */}
          {(format === 'docx' || format === 'html') && (
            <div className="resume-export-section">
              <label className="resume-export-label" htmlFor="watermark-input">
                Watermark (Optional)
              </label>
              <input
                id="watermark-input"
                type="text"
                className="resume-export-input"
                placeholder="e.g., DRAFT, CONFIDENTIAL"
                value={watermark}
                onChange={(e) => setWatermark(e.target.value)}
                disabled={loading}
                maxLength={50}
              />
              <p className="resume-export-hint">
                Add a watermark for drafts or internal versions
              </p>
            </div>
          )}
        </div>

        <div className="resume-export-footer">
          <button
            className="resume-export-button resume-export-button-secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="resume-export-button resume-export-button-primary"
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="resume-export-spinner"></span>
                Exporting...
              </>
            ) : (
              <>Export Resume</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumeExportDialog;
