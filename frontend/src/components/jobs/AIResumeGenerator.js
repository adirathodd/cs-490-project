/**
 * UC-051: AI Resume Generator with Multi-Format Export
 * Generates AI-tailored resumes for specific jobs and exports them
 */
import React, { useState } from 'react';
import { resumeAIAPI, resumeExportAPI } from '../../services/api';
import Icon from '../common/Icon';
import './AIResumeGenerator.css';

const AIResumeGenerator = ({ jobId, jobTitle, companyName }) => {
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resumeData, setResumeData] = useState(null);
  const [selectedVariation, setSelectedVariation] = useState(0);
  
  // Generation options
  const [tone, setTone] = useState('balanced');
  const [variationCount, setVariationCount] = useState(2);
  
  // Export options
  const [exportFormat, setExportFormat] = useState('docx');
  const [exportTheme, setExportTheme] = useState('professional');
  const [watermark, setWatermark] = useState('');
  const [customFilename, setCustomFilename] = useState('');
  const [themes, setThemes] = useState([]);

  const toneOptions = [
    { value: 'confident', label: 'Confident', description: 'Assertive and achievement-focused' },
    { value: 'balanced', label: 'Balanced', description: 'Professional and well-rounded' },
    { value: 'humble', label: 'Humble', description: 'Modest and collaborative' },
  ];

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setSuccess('');
    setResumeData(null);

    try {
      const result = await resumeAIAPI.generateForJob(jobId, {
        tone,
        variation_count: variationCount,
      });

      setResumeData(result);
      setSuccess('AI resume generated successfully! Review the variations below.');
      
      // Load themes for export
      try {
        const themesData = await resumeExportAPI.getThemes();
        setThemes(themesData.themes || []);
      } catch (err) {
        console.error('Failed to load themes:', err);
      }
    } catch (err) {
      setError(err.message || 'Failed to generate AI resume. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (format) => {
    if (!resumeData || !resumeData.variations || !resumeData.variations[selectedVariation]) {
      setError('No resume content to export');
      return;
    }

    setExporting(true);
    setError('');

    try {
      const variation = resumeData.variations[selectedVariation];
      const filename = customFilename || `${companyName}_${jobTitle}_Resume`.replace(/[^a-zA-Z0-9_]/g, '_');
      
      // Use the new AI resume export endpoint
      await resumeExportAPI.exportAIResume(
        variation.latex_content,
        format,
        exportTheme,
        watermark,
        filename,
        null // profile_data - will be extracted from LaTeX
      );
      
      setSuccess(`Successfully exported ${filename}.${format}`);
    } catch (err) {
      setError(err.message || 'Failed to export resume. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="ai-resume-generator">
      <div className="generator-header">
        <h3><Icon name="stars" size="sm" /> AI Resume Generator</h3>
        <p>Generate a tailored resume specifically optimized for this job posting</p>
      </div>

      {/* Generation Options */}
      <div className="generation-options">
        <div className="option-group">
          <label>Tone</label>
          <select value={tone} onChange={(e) => setTone(e.target.value)}>
            {toneOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} - {opt.description}
              </option>
            ))}
          </select>
        </div>

        <div className="option-group">
          <label>Number of Variations</label>
          <select value={variationCount} onChange={(e) => setVariationCount(parseInt(e.target.value))}>
            <option value="1">1 variation</option>
            <option value="2">2 variations</option>
            <option value="3">3 variations</option>
          </select>
        </div>

        <button
          className="generate-btn"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <span className="spinner"></span> Generating AI Resume...
            </>
          ) : (
            <>
              <Icon name="stars" size="sm" /> Generate Resume
            </>
          )}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="message error-message">
          <Icon name="info" size="sm" /> {error}
        </div>
      )}
      {success && (
        <div className="message success-message">
          <Icon name="check" size="sm" /> {success}
        </div>
      )}

      {/* Resume Variations */}
      {resumeData && resumeData.variations && (
        <div className="resume-variations">
          <h4>Generated Variations</h4>
          
          <div className="variation-tabs">
            {resumeData.variations.map((_, index) => (
              <button
                key={index}
                className={`variation-tab ${selectedVariation === index ? 'active' : ''}`}
                onClick={() => setSelectedVariation(index)}
              >
                Variation {index + 1}
              </button>
            ))}
          </div>

          <div className="variation-content">
            {resumeData.variations[selectedVariation] && (
              <div className="resume-preview">
                <div className="latex-preview">
                  <pre>{resumeData.variations[selectedVariation].latex_content}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Export Options */}
          <div className="export-section">
            <h4><Icon name="download" size="sm" /> Export Resume</h4>
            
            <div className="export-options">
              <div className="option-group">
                <label>Format</label>
                <div className="format-buttons">
                  <button
                    className={`format-btn ${exportFormat === 'pdf' ? 'active' : ''}`}
                    onClick={() => setExportFormat('pdf')}
                  >
                    <Icon name="file" size="sm" /> PDF
                  </button>
                  <button
                    className={`format-btn ${exportFormat === 'docx' ? 'active' : ''}`}
                    onClick={() => setExportFormat('docx')}
                  >
                    <Icon name="file" size="sm" /> DOCX
                  </button>
                  <button
                    className={`format-btn ${exportFormat === 'html' ? 'active' : ''}`}
                    onClick={() => setExportFormat('html')}
                  >
                    <Icon name="globe" size="sm" /> HTML
                  </button>
                  <button
                    className={`format-btn ${exportFormat === 'txt' ? 'active' : ''}`}
                    onClick={() => setExportFormat('txt')}
                  >
                    <Icon name="file" size="sm" /> TXT
                  </button>
                </div>
              </div>

              {exportFormat !== 'pdf' && themes.length > 0 && (
                <div className="option-group">
                  <label>Theme</label>
                  <select value={exportTheme} onChange={(e) => setExportTheme(e.target.value)}>
                    {themes.map(theme => (
                      <option key={theme.id} value={theme.id}>
                        {theme.name} - {theme.description}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="option-group">
                <label>Watermark (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., CONFIDENTIAL, DRAFT"
                  value={watermark}
                  onChange={(e) => setWatermark(e.target.value)}
                />
              </div>

              <div className="option-group">
                <label>Custom Filename (optional)</label>
                <input
                  type="text"
                  placeholder="Leave blank for auto-generated name"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                />
              </div>

              <button
                className="export-btn"
                onClick={() => handleExport(exportFormat)}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <span className="spinner"></span> Exporting...
                  </>
                ) : (
                  <>
                    <Icon name="download" size="sm" /> Export as {exportFormat.toUpperCase()}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIResumeGenerator;
