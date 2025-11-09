import React, { useEffect, useMemo, useRef, useState } from 'react';
import { jobsAPI, resumeAIAPI } from '../../../services/api';
import Icon from '../../../components/common/Icon';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import './AiResumeGenerator.css';

const toneOptions = [
  { value: 'impact', label: 'Impact', hint: 'Lead with metrics & outcomes' },
  { value: 'technical', label: 'Technical', hint: 'Highlight architecture & tooling depth' },
  { value: 'leadership', label: 'Leadership', hint: 'Spotlight stakeholder and team impact' },
  { value: 'balanced', label: 'Balanced', hint: 'Blend collaboration, delivery, and metrics' },
];

const formatDate = (value) => {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString();
};

const chipify = (items) => (items || []).filter(Boolean);

const generationHints = [
  'Analyzing the job description and keywords…',
  'Generating 6 diverse bullet options per experience…',
  'Crafting ATS-ready achievement statements…',
];

const AiResumeGenerator = () => {
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedJobDetail, setSelectedJobDetail] = useState(null);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);

  const [tone, setTone] = useState('balanced');
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [hintIndex, setHintIndex] = useState(0);

  // Step 1: Bullet options
  const [bulletOptions, setBulletOptions] = useState(null);
  const [selectedBullets, setSelectedBullets] = useState({});
  
  // Step 2: Final PDF
  const [finalPDF, setFinalPDF] = useState(null);
  const [compiling, setCompiling] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');

  const bulletSectionRef = useRef(null);
  const pdfSectionRef = useRef(null);
  const pdfUrlRef = useRef('');

  useEffect(() => {
    const loadJobs = async () => {
      setJobsLoading(true);
      setJobsError('');
      try {
        const response = await jobsAPI.getJobs();
        const list = Array.isArray(response) ? response : response?.results || [];
        setJobs(list);
        if (!list.length) {
          setJobsError('Add a job inside the Jobs workspace to unlock AI resumes.');
        }
      } catch (err) {
        const message = err?.message || err?.code || 'Unable to load your jobs.';
        setJobsError(message);
      } finally {
        setJobsLoading(false);
      }
    };
    loadJobs();
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJobDetail(null);
      return;
    }
    const hydrate = async () => {
      setJobDetailLoading(true);
      try {
        const detail = await jobsAPI.getJob(selectedJobId);
        setSelectedJobDetail(detail);
      } catch (err) {
        const fallback = jobs.find((job) => job.id === Number(selectedJobId));
        setSelectedJobDetail(fallback || null);
        setJobsError(err?.message || 'Unable to load job details.');
      } finally {
        setJobDetailLoading(false);
      }
    };
    hydrate();
  }, [selectedJobId, jobs]);

  useEffect(() => {
    if (!generating) return undefined;
    const interval = setInterval(
      () => setHintIndex((prev) => (prev + 1) % generationHints.length),
      2800,
    );
    return () => clearInterval(interval);
  }, [generating]);

  const filteredJobs = useMemo(() => {
    if (!jobSearch) return jobs;
    const query = jobSearch.toLowerCase();
    return jobs.filter((job) => (\`\${job.title} \${job.company_name}\`).toLowerCase().includes(query));
  }, [jobSearch, jobs]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!finalPDF?.pdf_document) {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = '';
      }
      setPdfPreviewUrl('');
      return undefined;
    }
    try {
      const byteCharacters = window.atob(finalPDF.pdf_document);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i += 1) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const newUrl = URL.createObjectURL(blob);
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
      }
      pdfUrlRef.current = newUrl;
      setPdfPreviewUrl(newUrl);
      return () => {
        if (pdfUrlRef.current === newUrl) {
          URL.revokeObjectURL(pdfUrlRef.current);
          pdfUrlRef.current = '';
        } else {
          URL.revokeObjectURL(newUrl);
        }
      };
    } catch (err) {
      console.error('Failed to render PDF preview', err);
      setPdfPreviewUrl('');
    }
    return undefined;
  }, [finalPDF]);

  useEffect(
    () => () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
      }
    },
    [],
  );

  const handleGenerateBullets = async () => {
    if (!selectedJobId) {
      setGenerationError('Select a job before generating bullet options.');
      return;
    }
    setGenerating(true);
    setGenerationError('');
    setStatusMessage('Generating bullet point options…');
    setHintIndex(0);
    setBulletOptions(null);
    setSelectedBullets({});
    setFinalPDF(null);
    
    try {
      const data = await resumeAIAPI.getBulletOptions(selectedJobId, { tone });
      setBulletOptions(data);
      
      // Initialize with first 3 bullets selected for each experience/project
      const initialSelections = {};
      (data.experience_options || []).forEach((exp) => {
        const key = \`exp-\${exp.source_experience_id}\`;
        initialSelections[key] = [0, 1, 2].filter(i => i < (exp.bullet_options || []).length);
      });
      (data.project_options || []).forEach((proj) => {
        const key = \`proj-\${proj.source_project_id}\`;
        initialSelections[key] = [0, 1].filter(i => i < (proj.bullet_options || []).length);
      });
      setSelectedBullets(initialSelections);
      
      setStatusMessage('Bullet options ready! Select your favorites below.');
      setTimeout(() => {
        bulletSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } catch (err) {
      const message = err?.message || err?.code || 'Failed to generate bullet options.';
      setGenerationError(message);
      setStatusMessage('Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const toggleBullet = (key, index) => {
    setSelectedBullets(prev => {
      const current = prev[key] || [];
      const isSelected = current.includes(index);
      if (isSelected) {
        return { ...prev, [key]: current.filter(i => i !== index) };
      }
      return { ...prev, [key]: [...current, index] };
    });
  };

  const handleCompilePDF = async () => {
    if (!bulletOptions) return;
    
    setCompiling(true);
    setGenerationError('');
    setStatusMessage('Compiling your custom resume PDF…');
    
    try {
      const experienceSections = (bulletOptions.experience_options || []).map(exp => {
        const key = \`exp-\${exp.source_experience_id}\`;
        return {
          source_experience_id: exp.source_experience_id,
          all_bullets: exp.bullet_options,
          selected_bullets: selectedBullets[key] || [],
        };
      });
      
      const projectSections = (bulletOptions.project_options || []).map(proj => {
        const key = \`proj-\${proj.source_project_id}\`;
        return {
          source_project_id: proj.source_project_id,
          all_bullets: proj.bullet_options,
          selected_bullets: selectedBullets[key] || [],
        };
      });
      
      const selections = {
        summary: bulletOptions.summary,
        summary_headline: bulletOptions.summary_headline,
        experience_sections: experienceSections,
        project_sections: projectSections,
        skills_to_highlight: bulletOptions.skills_to_highlight,
        ats_keywords: bulletOptions.ats_keywords,
      };
      
      const pdfResult = await resumeAIAPI.compilePDF(selectedJobId, selections);
      setFinalPDF(pdfResult);
      setStatusMessage('Resume PDF ready!');
      setTimeout(() => {
        pdfSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } catch (err) {
      const message = err?.message || err?.code || 'Failed to compile PDF.';
      setGenerationError(message);
      setStatusMessage('PDF compilation failed. Please try again.');
    } finally {
      setCompiling(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!finalPDF?.pdf_document) return;
    try {
      const byteCharacters = window.atob(finalPDF.pdf_document);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i += 1) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = finalPDF.download_filename || 'resume.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed', err);
      setGenerationError('Failed to download PDF');
    }
  };

  const jobKeywords = chipify(
    bulletOptions?.shared_analysis?.keyword_strategy ||
      selectedJobDetail?.derived_keywords,
  );
  const analysis = bulletOptions?.shared_analysis || {};
  const activeHint = generating ? generationHints[hintIndex] : '';

  return (
    <div className="ai-resume-page">
      <section className="ai-resume-card hero">
        <div>
          <p className="eyebrow">UC-047</p>
          <h1>Tailored Resume Generator</h1>
          <p className="lead">
            Select a job, generate bullet point options, choose your favorites, and get a custom PDF resume.
          </p>
          <ul className="hero-checklist">
            <li>
              <Icon name="sparkles" size="sm" /> Generates 6 bullet options per experience/project
            </li>
            <li>
              <Icon name="check-square" size="sm" /> You select which bullets to include
            </li>
            <li>
              <Icon name="file-text" size="sm" /> Get a polished PDF tailored to the role
            </li>
          </ul>
        </div>
      </section>

      <section className="ai-resume-grid">
        <div className="ai-resume-card controls">
          <div className="control-group">
            <label htmlFor="job-search">Find a job posting</label>
            <div className="job-search">
              <Icon name="search" size="sm" />
              <input
                id="job-search"
                type="text"
                placeholder="Search title or company"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="control-group">
            <label htmlFor="job-select">Select job</label>
            <div className="select-wrapper">
              {jobsLoading ? (
                <div className="inline-hint">
                  <LoadingSpinner size="sm" /> Loading your pipeline…
                </div>
              ) : (
                <select
                  id="job-select"
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                >
                  <option value="">— Choose a job —</option>
                  {filteredJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} · {job.company_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {jobsError && <p className="inline-error">{jobsError}</p>}
          </div>

          <div className="control-group">
            <span>Target tone</span>
            <div className="tone-grid">
              {toneOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={\`tone-chip \${tone === option.value ? 'active' : ''}\`}
                  onClick={() => setTone(option.value)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="control-actions">
            <button
              type="button"
              className={\`primary \${generating ? 'loading' : ''}\`}
              onClick={handleGenerateBullets}
              disabled={generating || !selectedJobId}
              aria-busy={generating}
            >
              {generating ? (
                <>
                  <LoadingSpinner size="sm" /> Generating options…
                </>
              ) : (
                <>
                  <Icon name="sparkles" size="sm" /> Generate bullet options
                </>
              )}
            </button>
          </div>
          <div className={\`progress-bar \${generating ? 'active' : ''}\`}>
            <span />
          </div>
          <p className="generation-status" aria-live="polite">
            {generating ? activeHint : statusMessage}
          </p>
          {generationError && <p className="inline-error">{generationError}</p>}
        </div>

        <div className="ai-resume-card job-preview">
          <header>
            <div>
              <p className="eyebrow">Job context</p>
              <h2>{selectedJobDetail?.title || 'Choose a job to preview details'}</h2>
              {selectedJobDetail?.company_name && (
                <p className="company-line">{selectedJobDetail.company_name}</p>
              )}
            </div>
            {jobDetailLoading && <LoadingSpinner size="sm" />}
          </header>
          {selectedJobDetail ? (
            <>
              <dl className="meta-grid">
                <div>
                  <dt>Location</dt>
                  <dd>{selectedJobDetail.location || 'Remote / TBD'}</dd>
                </div>
                <div>
                  <dt>Job Type</dt>
                  <dd>{selectedJobDetail.job_type?.toUpperCase() || '—'}</dd>
                </div>
                <div>
                  <dt>Industry</dt>
                  <dd>{selectedJobDetail.industry || '—'}</dd>
                </div>
                <div>
                  <dt>Deadline</dt>
                  <dd>{formatDate(selectedJobDetail.application_deadline)}</dd>
                </div>
              </dl>
              <article className="job-description">
                <h3>Key requirements</h3>
                <p>{selectedJobDetail.description || 'No job description provided yet.'}</p>
              </article>
              {jobKeywords.length > 0 && (
                <div className="chip-row">
                  {jobKeywords.map((keyword) => (
                    <span key={keyword} className="chip">
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="placeholder">
              Select a job to see its description, deadlines, and the ATS keywords the AI will focus
              on.
            </p>
          )}
        </div>
      </section>

      {bulletOptions && (
        <>
          <section className="ai-resume-card insights">
            <div>
              <p className="eyebrow">AI insights</p>
              <h2>
                Profile match for "{selectedJobDetail?.title || 'target role'}"
              </h2>
            </div>
            <div className="insight-grid">
              <div>
                <strong>Job focus</strong>
                <p>
                  {analysis.job_focus_summary ||
                    'The AI emphasizes the core requirements of this role.'}
                </p>
              </div>
              <div>
                <strong>Profile match</strong>
                <p>
                  {analysis.skill_match_notes ||
                    'Your strongest overlapping achievements are highlighted.'}
                </p>
              </div>
              {analysis.skill_gaps?.length > 0 && (
                <div>
                  <strong>Skill gaps to monitor</strong>
                  <ul>
                    {analysis.skill_gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <section className="ai-resume-card bullet-selection" ref={bulletSectionRef}>
            <header>
              <div>
                <p className="eyebrow">Step 2: Select your bullets</p>
                <h2>Choose which achievements to highlight</h2>
                <p className="lead">
                  Select 2-3 bullets per experience/project. Click to toggle selection.
                </p>
              </div>
            </header>

            <div className="bullet-selection-body">
              <section>
                <h3>Work Experience</h3>
                {(bulletOptions.experience_options || []).map((exp) => {
                  const key = \`exp-\${exp.source_experience_id}\`;
                  const selected = selectedBullets[key] || [];
                  return (
                    <div key={key} className="experience-bullet-group">
                      <div className="experience-header">
                        <strong>{exp.role}</strong>
                        <span>{exp.company} · {exp.dates}</span>
                      </div>
                      <p className="selection-count">
                        {selected.length} bullet{selected.length !== 1 ? 's' : ''} selected
                      </p>
                      <ul className="bullet-options-list">
                        {(exp.bullet_options || []).map((bullet, idx) => (
                          <li
                            key={idx}
                            className={selected.includes(idx) ? 'selected' : ''}
                            onClick={() => toggleBullet(key, idx)}
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(idx)}
                              readOnly
                            />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </section>

              {bulletOptions.project_options?.length > 0 && (
                <section>
                  <h3>Projects</h3>
                  {bulletOptions.project_options.map((proj) => {
                    const key = \`proj-\${proj.source_project_id}\`;
                    const selected = selectedBullets[key] || [];
                    return (
                      <div key={key} className="experience-bullet-group">
                        <div className="experience-header">
                          <strong>{proj.name}</strong>
                          <span>{proj.notes} · {proj.timeline}</span>
                        </div>
                        <p className="selection-count">
                          {selected.length} bullet{selected.length !== 1 ? 's' : ''} selected
                        </p>
                        <ul className="bullet-options-list">
                          {(proj.bullet_options || []).map((bullet, idx) => (
                            <li
                              key={idx}
                              className={selected.includes(idx) ? 'selected' : ''}
                              onClick={() => toggleBullet(key, idx)}
                            >
                              <input
                                type="checkbox"
                                checked={selected.includes(idx)}
                                readOnly
                              />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </section>
              )}

              <div className="compile-actions">
                <button
                  type="button"
                  className={\`primary large \${compiling ? 'loading' : ''}\`}
                  onClick={handleCompilePDF}
                  disabled={compiling}
                >
                  {compiling ? (
                    <>
                      <LoadingSpinner size="sm" /> Compiling PDF…
                    </>
                  ) : (
                    <>
                      <Icon name="file-text" size="sm" /> Generate my resume PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {finalPDF && (
        <section className="ai-resume-card final-pdf" ref={pdfSectionRef}>
          <header>
            <div>
              <p className="eyebrow">Your custom resume</p>
              <h2>Resume preview</h2>
            </div>
            <button
              type="button"
              className="primary ghost"
              onClick={handleDownloadPDF}
            >
              <Icon name="download" size="sm" /> Download PDF
            </button>
          </header>
          
          {pdfPreviewUrl ? (
            <div className="pdf-frame-wrapper">
              <iframe
                src={pdfPreviewUrl}
                title="Resume PDF preview"
                className="pdf-preview-frame"
              />
            </div>
          ) : (
            <p className="placeholder">PDF preview will appear here.</p>
          )}
          
          <details className="latex-toggle">
            <summary>View LaTeX source</summary>
            <textarea readOnly value={finalPDF.latex_document || ''} />
          </details>
        </section>
      )}
    </div>
  );
};

export default AiResumeGenerator;
