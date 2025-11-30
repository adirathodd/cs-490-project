import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jobsAPI } from '../../services/api';
import './InterviewResearchBrief.css';

/**
 * UC-074: Company Research Automation for Interviews
 * 
 * Displays interview-ready company research including:
 * - Company overview and history
 * - Recent developments and strategic initiatives
 * - Potential interviewers (executives)
 * - Competitive landscape
 * - Talking points for interviews
 * - Intelligent questions to ask
 * - Downloadable research summary
 */
export const InterviewResearchBrief = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [job, setJob] = useState(null);
  const [research, setResearch] = useState(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    loadResearch();
  }, [jobId]);

  const loadResearch = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get job details which should include company research
      const jobData = await jobsAPI.getJob(jobId);
      setJob(jobData);
      
      // Check if we have research data
      if (jobData.company_info?.research) {
        setResearch(jobData.company_info.research);
      } else if (jobData.company_id) {
        // If no research yet, might need to trigger it
        setError('Company research not available yet. Please run company research from the job details page.');
      } else {
        setError('No company information available for this job.');
      }
    } catch (err) {
      console.error('Failed to load research:', err);
      setError(err.message || 'Failed to load interview research');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyExportSummary = async () => {
    if (!research?.export_summary) return;
    
    try {
      setCopying(true);
      await navigator.clipboard.writeText(research.export_summary);
      setTimeout(() => setCopying(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setCopying(false);
    }
  };

  const handleDownloadSummary = () => {
    if (!research?.export_summary) return;
    
    const blob = new Blob([research.export_summary], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${job.company_name || 'company'}-interview-research.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="research-brief-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading interview research...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="research-brief-container">
        <div className="error-state">
          <h2>Unable to Load Research</h2>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={() => navigate(-1)} className="btn-outline">
              Go Back
            </button>
            <button onClick={loadResearch} className="btn-primary">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!research) {
    return null;
  }

  return (
    <div className="research-brief-container">
      <div className="research-header">
        <button onClick={() => navigate(-1)} className="back-button">
          ← Back to Job
        </button>
        <div className="header-content">
          <h1>Interview Research Brief</h1>
          <div className="job-context">
            <h2>{job.title}</h2>
            <p>{job.company_name}</p>
          </div>
        </div>
        <div className="header-actions">
          <button 
            onClick={handleCopyExportSummary} 
            className="btn-outline"
            disabled={!research.export_summary}
          >
            {copying ? '✓ Copied!' : '📋 Copy Summary'}
          </button>
          <button 
            onClick={handleDownloadSummary} 
            className="btn-primary"
            disabled={!research.export_summary}
          >
            ⬇ Download
          </button>
        </div>
      </div>

      <div className="research-content">
        {/* Company Overview */}
        {research.profile_overview && (
          <section className="research-section overview-section">
            <h3>📊 Company Overview</h3>
            <div className="section-content">
              <p className="overview-text">{research.profile_overview}</p>
            </div>
          </section>
        )}

        {/* Company History */}
        {research.company_history && (
          <section className="research-section">
            <h3>📖 Company History</h3>
            <div className="section-content">
              <p>{research.company_history}</p>
            </div>
          </section>
        )}

        {/* Two-column layout for developments and initiatives */}
        <div className="two-column-grid">
          {/* Recent Developments */}
          {research.recent_developments?.length > 0 && (
            <section className="research-section">
              <h3>📰 Recent Developments</h3>
              <div className="section-content">
                <div className="developments-list">
                  {research.recent_developments.map((dev, idx) => (
                    <div key={idx} className="development-item">
                      <div className="development-header">
                        <h4>{dev.title}</h4>
                        {dev.category && (
                          <span className="category-badge">{dev.category}</span>
                        )}
                      </div>
                      {dev.summary && <p className="development-summary">{dev.summary}</p>}
                      <div className="development-meta">
                        {dev.date && <span className="date">{formatDate(dev.date)}</span>}
                        {dev.source && <span className="source">{dev.source}</span>}
                      </div>
                      {dev.key_points?.length > 0 && (
                        <ul className="key-points">
                          {dev.key_points.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Strategic Initiatives */}
          {research.strategic_initiatives?.length > 0 && (
            <section className="research-section">
              <h3>🎯 Strategic Initiatives</h3>
              <div className="section-content">
                <div className="initiatives-list">
                  {research.strategic_initiatives.map((initiative, idx) => (
                    <div key={idx} className="initiative-item">
                      <div className="initiative-header">
                        <h4>{initiative.title}</h4>
                        {initiative.category && (
                          <span className="category-badge">{initiative.category}</span>
                        )}
                      </div>
                      {initiative.summary && <p>{initiative.summary}</p>}
                      <div className="initiative-meta">
                        {initiative.date && <span className="date">{formatDate(initiative.date)}</span>}
                        {initiative.source && <span className="source">{initiative.source}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Competitive Landscape */}
        {research.competitive_landscape && (
          <section className="research-section landscape-section">
            <h3>🏆 Competitive Landscape</h3>
            <div className="section-content">
              <p className="landscape-text">{research.competitive_landscape}</p>
            </div>
          </section>
        )}

        {/* Potential Interviewers */}
        {research.potential_interviewers?.length > 0 && (
          <section className="research-section">
            <h3>👥 Potential Interviewers</h3>
            <div className="section-content">
              <div className="interviewers-grid">
                {research.potential_interviewers.map((person, idx) => (
                  <div key={idx} className="interviewer-card">
                    <div className="interviewer-info">
                      <h4>{person.name}</h4>
                      <p className="interviewer-title">{person.title}</p>
                    </div>
                    {person.linkedin_url && (
                      <a 
                        href={person.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="linkedin-link"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                        </svg>
                        LinkedIn
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Talking Points */}
        {research.talking_points?.length > 0 && (
          <section className="research-section talking-points-section">
            <h3>💬 Key Talking Points</h3>
            <div className="section-content">
              <div className="talking-points-list">
                {research.talking_points.map((point, idx) => (
                  <div key={idx} className="talking-point">
                    <span className="point-number">{idx + 1}</span>
                    <p>{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Intelligent Questions */}
        {research.interview_questions?.length > 0 && (
          <section className="research-section questions-section">
            <h3>❓ Intelligent Questions to Ask</h3>
            <div className="section-content">
              <p className="section-intro">
                Use these questions to demonstrate your research and engagement during the interview:
              </p>
              <div className="questions-list">
                {research.interview_questions.map((question, idx) => (
                  <div key={idx} className="question-item">
                    <span className="question-icon">💡</span>
                    <p>{question}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Export Summary Preview */}
        {research.export_summary && (
          <section className="research-section export-section">
            <h3>📄 Exportable Summary</h3>
            <div className="section-content">
              <p className="section-intro">
                Use the buttons above to copy or download this formatted research summary.
              </p>
              <pre className="export-preview">{research.export_summary}</pre>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default InterviewResearchBrief;
