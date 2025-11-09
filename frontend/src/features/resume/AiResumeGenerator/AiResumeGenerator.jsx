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

const variationChoices = [1, 2, 3];

const formatDate = (value) => {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString();
};

const chipify = (items) => (items || []).filter(Boolean);

const generationHints = [
  'Analyzing the job description and keywords…',
  'Matching verified achievements from your profile…',
  'Authoring succinct ATS-ready bullet points…',
];

const CACHE_KEY = 'resumerocket_ai_resume_cache';
const CACHE_VERSION = 1;

const loadCachedResult = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (parsed.version !== CACHE_VERSION) return null;
    // Check if cache is less than 24 hours old
    const cacheAge = Date.now() - (parsed.timestamp || 0);
    if (cacheAge > 24 * 60 * 60 * 1000) return null;
    return parsed.data;
  } catch (err) {
    console.error('Failed to load cached resume:', err);
    return null;
  }
};

const saveCachedResult = (data) => {
  try {
    const cacheData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (err) {
    console.error('Failed to cache resume:', err);
  }
};

const clearCachedResult = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (err) {
    console.error('Failed to clear cache:', err);
  }
};

const AiResumeGenerator = () => {
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedJobDetail, setSelectedJobDetail] = useState(null);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);

  const [tone, setTone] = useState('balanced');
  const [variationCount, setVariationCount] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [hintIndex, setHintIndex] = useState(0);

  const [result, setResult] = useState(null);
  const [activeVariationId, setActiveVariationId] = useState('');
  const [copiedVariationId, setCopiedVariationId] = useState('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');

  const variationSectionRef = useRef(null);
  const pdfUrlRef = useRef('');

  // Load cached result on mount
  useEffect(() => {
    const cached = loadCachedResult();
    if (cached) {
      setResult(cached.result);
      setSelectedJobId(cached.selectedJobId || '');
      setActiveVariationId(cached.activeVariationId || cached.result?.variations?.[0]?.id || '');
      setTone(cached.tone || 'balanced');
      setVariationCount(cached.variationCount || 2);
      setStatusMessage('✓ Restored your previous resume session');
      // Scroll to variations after a short delay
      setTimeout(() => {
        if (variationSectionRef.current) {
          variationSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    }
  }, []);

  // Save result to cache whenever it changes
  useEffect(() => {
    if (result) {
      saveCachedResult({
        result,
        selectedJobId,
        activeVariationId,
        tone,
        variationCount,
      });
    }
  }, [result, selectedJobId, activeVariationId, tone, variationCount]);

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
    return jobs.filter((job) => `${job.title} ${job.company_name}`.toLowerCase().includes(query));
  }, [jobSearch, jobs]);

  const activeVariation = useMemo(() => {
    if (!result?.variations?.length) return null;
    return (
      result.variations.find((variation) => variation.id === activeVariationId) ||
      result.variations[0]
    );
  }, [result, activeVariationId]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!activeVariation?.pdf_document) {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = '';
      }
      setPdfPreviewUrl('');
      return undefined;
    }
    try {
      const byteCharacters = window.atob(activeVariation.pdf_document);
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
      console.error('Failed to render PDF preview', err); // eslint-disable-line no-console
      setPdfPreviewUrl('');
    }
    return undefined;
  }, [activeVariation]);

  useEffect(
    () => () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
      }
    },
    [],
  );

  const handleGenerate = async () => {
    if (!selectedJobId) {
      setGenerationError('Select a job before generating a resume.');
      return;
    }
    setGenerating(true);
    setGenerationError('');
    setStatusMessage('Generating a tailored resume for this role…');
    setHintIndex(0);
    try {
      const data = await resumeAIAPI.generateForJob(selectedJobId, {
        tone,
        variation_count: variationCount,
      });
      console.log('Received resume data:', {
        variation_count: data?.variation_count,
        variations_length: data?.variations?.length,
        variation_labels: data?.variations?.map(v => v.label),
      });
      setResult(data);
      const firstVariation = data?.variations?.[0];
      setActiveVariationId(firstVariation?.id || '');
      setStatusMessage('Resume ready! Scroll down to preview.');
      setTimeout(() => {
        variationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } catch (err) {
      const message = err?.message || err?.code || 'Failed to generate resume.';
      setGenerationError(message);
      setStatusMessage('Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const regenerate = () => {
    if (generating) return;
    setStatusMessage('Regenerating fresh variations…');
    handleGenerate();
  };

  const handleStartFresh = () => {
    clearCachedResult();
    setResult(null);
    setSelectedJobId('');
    setActiveVariationId('');
    setPdfPreviewUrl('');
    setGenerationError('');
    setStatusMessage('');
    setTone('balanced');
    setVariationCount(2);
  };

  const handleCopyLatex = async (variation) => {
    if (!variation?.latex_document) return;
    try {
      await navigator.clipboard.writeText(variation.latex_document);
      setCopiedVariationId(variation.id);
      setTimeout(() => setCopiedVariationId(''), 1800);
    } catch {
      setGenerationError('Clipboard permissions blocked. Try downloading instead.');
    }
  };

  const handleDownload = (variation) => {
    if (!variation?.latex_document) return;
    const blob = new Blob([variation.latex_document], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = variation.download_filename || 'resume.tex';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const jobKeywords = chipify(
    result?.job?.derived_keywords ||
      result?.shared_analysis?.keyword_strategy ||
      selectedJobDetail?.derived_keywords,
  );
  const analysis = result?.shared_analysis || {};
  const profile = result?.profile;
  const activeHint = generating ? generationHints[hintIndex] : '';

  return (
    <div className="ai-resume-page">
      <section className="ai-resume-card hero">
        <div>
          <h1>Tailored Resume Generator</h1>
          <p className="lead">
            Select a job from your pipeline and let ResumeRocket craft a role-aligned resume grounded
            in your verified profile data.
          </p>
          <ul className="hero-checklist">
            <li>
              <Icon name="sparkles" size="sm" /> Generates 1–3 curated variations
            </li>
            <li>
              <Icon name="file-text" size="sm" /> Outputs ATS-friendly LaTeX plus an inline PDF preview
            </li>
            <li>
              <Icon name="briefcase" size="sm" /> Surfaces priority skills and role-specific gaps
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
                  className={`tone-chip ${tone === option.value ? 'active' : ''}`}
                  onClick={() => setTone(option.value)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="control-group inline">
            <label htmlFor="variation-count">Variations</label>
            <select
              id="variation-count"
              value={variationCount}
              onChange={(e) => setVariationCount(Number(e.target.value))}
            >
              {variationChoices.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="control-actions">
            <button
              type="button"
              className={`primary ${generating ? 'loading' : ''}`}
              onClick={handleGenerate}
              disabled={generating || !selectedJobId}
              aria-busy={generating}
            >
              {generating ? (
                <>
                  <LoadingSpinner size="sm" /> Generating tailored resume…
                </>
              ) : (
                <>
                  <Icon name="sparkles" size="sm" /> Generate tailored resume
                </>
              )}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={regenerate}
              disabled={!result || generating}
            >
              <Icon name="refresh" size="sm" /> Regenerate content
            </button>
            {result && (
              <button
                type="button"
                className="ghost"
                onClick={handleStartFresh}
                disabled={generating}
                title="Clear cached results and start over"
              >
                <Icon name="x" size="sm" /> Start fresh
              </button>
            )}
          </div>
          <div className={`progress-bar ${generating ? 'active' : ''}`}>
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

      {result && (
        <>
          <section className="ai-resume-card insights">
            <div>
              <p className="eyebrow">AI insights</p>
              <h2>
                How your profile maps to “{result.job?.title || 'target role'}” at{' '}
                {result.job?.company_name || 'this company'}
              </h2>
            </div>
            <div className="insight-grid">
              <div>
                <strong>Job focus</strong>
                <p>
                  {analysis.job_focus_summary ||
                    'The model will emphasize the core requirements of this role.'}
                </p>
              </div>
              <div>
                <strong>Profile match</strong>
                <p>
                  {analysis.skill_match_notes ||
                    'ResumeRocket AI will highlight the strongest overlapping stories.'}
                </p>
              </div>
              {analysis.skill_gaps?.length ? (
                <div>
                  <strong>Skill gaps to monitor</strong>
                  <ul>
                    {analysis.skill_gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {profile && (
                <div className="profile-preview">
                  <strong>{profile.name}</strong>
                  {profile.headline && <p>{profile.headline}</p>}
                  {profile.location && <p>{profile.location}</p>}
                  {profile.top_skills?.length > 0 && (
                    <div className="chip-row">
                      {profile.top_skills.map((skill) => (
                        <span key={skill} className="chip">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="variation-section" ref={variationSectionRef}>
            {result.variations.length > 1 && (
              <div className="variation-header">
                <h3>Choose a variation</h3>
                <p className="hint">Generated {result.variations.length} different versions - click to compare</p>
              </div>
            )}
            <div className="variation-tabs">
              {result.variations.map((variation) => (
                <button
                  type="button"
                  key={variation.id}
                  className={variation.id === activeVariation?.id ? 'active' : ''}
                  onClick={() => setActiveVariationId(variation.id)}
                >
                  <strong>{variation.label}</strong>
                  <span>{variation.tone?.toUpperCase()}</span>
                </button>
              ))}
            </div>
            {activeVariation && (
              <article className="ai-resume-card variation-card">
                <header>
                  <div>
                    <p className="eyebrow">Variation</p>
                    <h3>{activeVariation.summary_headline || activeVariation.label}</h3>
                    <p>{activeVariation.summary}</p>
                  </div>
                  <div className="variation-actions">
                    <button type="button" onClick={() => handleCopyLatex(activeVariation)}>
                      {copiedVariationId === activeVariation.id ? (
                        <>
                          <Icon name="check" size="sm" /> Copied
                        </>
                      ) : (
                        <>
                          <Icon name="clipboard" size="sm" /> Copy LaTeX
                        </>
                      )}
                    </button>
                    <button type="button" className="primary ghost" onClick={() => handleDownload(activeVariation)}>
                      <Icon name="download" size="sm" /> Download .tex
                    </button>
                  </div>
                </header>

                <div className="variation-body">
                  <section className="skills-panel">
                    <h4>Key skills for this role</h4>
                    <div className="skill-badges">
                      {chipify(activeVariation.skills_to_highlight).map((skill) => (
                        <span key={skill} className="skill-pill">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h4>Experiences to spotlight</h4>
                    <ol className="experience-list">
                      {(activeVariation.experience_sections || []).map((exp, idx) => (
                        <li key={`${exp.source_experience_id}-${exp.role}`}>
                          <div className="experience-card">
                            <div className="experience-header">
                              <span className="experience-rank">#{idx + 1}</span>
                              <div>
                                <strong>{exp.role}</strong>
                                <span>{exp.company}</span>
                                <small>
                                  {exp.location || 'Remote'} · {exp.dates}
                                </small>
                              </div>
                            </div>
                            <ul>
                              {(exp.bullets || []).map((bullet, bulletIdx) => (
                                <li key={bulletIdx}>{bullet}</li>
                              ))}
                            </ul>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>

                  {activeVariation.project_sections?.length > 0 && (
                    <section>
                      <h4>Projects & initiatives</h4>
                      <div className="experience-grid projects">
                        {activeVariation.project_sections.map((proj) => (
                          <div key={`${proj.source_project_id}-${proj.name}`} className="experience-card project">
                            <div className="experience-header">
                              <strong>{proj.name}</strong>
                              <small>{proj.notes || 'Project highlight'}</small>
                            </div>
                            <ul>
                              {(proj.bullets || []).map((bullet, idx) => (
                                <li key={idx}>{bullet}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {activeVariation.education_highlights?.length > 0 && (
                    <section>
                      <h4>Education</h4>
                      <ul className="education-list">
                        {(activeVariation.education_highlights || []).map((edu) => (
                          <li key={`${edu.source_education_id}-${edu.notes}`}>{edu.notes}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <section>
                    <h4>ATS keywords</h4>
                    <div className="chip-row">
                      {chipify(activeVariation.ats_keywords || analysis.keyword_strategy).map((keyword) => (
                        <span key={keyword} className="chip neutral">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h4>Resume preview (PDF)</h4>
                    {pdfPreviewUrl ? (
                      <div className="pdf-frame-wrapper">
                        <iframe
                          src={pdfPreviewUrl}
                          title="Resume PDF preview"
                          className="pdf-preview-frame"
                        />
                      </div>
                    ) : (
                      <p className="placeholder">PDF preview will appear here once ready.</p>
                    )}
                    <details className="latex-toggle">
                      <summary>View LaTeX source</summary>
                      <textarea readOnly value={activeVariation.latex_document || ''} />
                    </details>
                  </section>
                </div>
              </article>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default AiResumeGenerator;
