import React, { useState } from 'react';
import { coverLetterAIAPI, jobsAPI } from '../../../services/api';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import Icon from '../../../components/common/Icon';
// Reuse the polished styles from the resume generator for visual parity
import '../../resume/AiResumeGenerator/AiResumeGenerator.css';
import './AiCoverLetterGenerator.css';

const tones = [
  { value: 'professional', label: 'Professional', hint: 'Polished, formal tone' },
  { value: 'warm', label: 'Warm', hint: 'Human, friendly voice' },
  { value: 'innovative', label: 'Innovative', hint: 'Forward-looking and creative' },
  { value: 'customer_centric', label: 'Customer-centric', hint: 'Empathy and user impact' },
  { value: 'data_driven', label: 'Data-driven', hint: 'Metrics and outcomes focused' },
  { value: 'concise', label: 'Concise', hint: 'Tight, to the point' },
  { value: 'balanced', label: 'Balanced', hint: 'Even blend of style and substance' },
];

const variationChoices = [1, 2, 3];

// Lightweight helpers copied from the resume generator for consistent display
const sanitizeText = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const lowered = trimmed.toLowerCase();
    if (['null', 'undefined', 'n/a', 'na'].includes(lowered)) {
      return '';
    }
    return trimmed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}`;
  }
  return '';
};

const formatDate = (value) => {
  const normalized = sanitizeText(value);
  if (!normalized) return '—';
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString();
};

const chipify = (items) => (items || []).map((i) => sanitizeText(i)).filter(Boolean);

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

// Normalize any backend-provided "highlight" shape into a readable string
const normalizeHighlight = (h) => {
  if (h === null || h === undefined) return '';
  if (typeof h === 'string') return h.trim();
  if (typeof h === 'number' || typeof h === 'boolean') return String(h);
  if (Array.isArray(h)) {
    return h.map((x) => normalizeHighlight(x)).filter(Boolean).join(' · ');
  }
  if (typeof h === 'object') {
    // Prefer common text-like fields first
    const preferred = ['text', 'title', 'label', 'name', 'summary', 'description', 'value'];
    for (const key of preferred) {
      if (typeof h[key] === 'string' && h[key].trim()) return h[key].trim();
    }

    // Handle common highlight container shapes (e.g., achievements, keywords_used, news_citations)
    const containerKeys = ['achievements', 'highlights', 'items', 'points', 'keywords_used', 'keywords', 'news_citations', 'news'];
    const collected = [];
    for (const k of containerKeys) {
      if (Array.isArray(h[k])) {
        collected.push(
          ...h[k]
            .map((v) => normalizeHighlight(v))
            .filter(Boolean)
        );
      }
    }
    if (collected.length) return collected.join(' · ');

    // Fallback: join primitive child values
    const joined = Object.values(h)
      .map((v) => normalizeHighlight(v))
      .filter(Boolean)
      .join(' · ');
    if (joined) return joined;
  }
  // As a last resort, don't emit raw JSON blobs in UI; hide empty/opaque objects
  return '';
};

// Cache functions for persistent results
const CACHE_KEY = 'ai_cover_letter_cache';

const loadCachedResult = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (e) {
    console.warn('Failed to load cached cover letter:', e);
    return null;
  }
};

const saveCachedResult = (data) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save cover letter cache:', e);
  }
};

const clearCachedResult = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {
    console.warn('Failed to clear cover letter cache:', e);
  }
};

const AiCoverLetterGenerator = () => {
  // Jobs data
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [tone, setTone] = useState('balanced');
  const [variations, setVariations] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState(null);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);
  const [copiedVariationId, setCopiedVariationId] = useState('');
  
  // Simplified insights derived from result + job detail
  const buildInsights = () => {
    if (!result || !selectedJobDetail) return null;
    // Try to infer focus keywords by intersecting highlights with job keywords
    const jobKeywords = chipify(selectedJobDetail?.keywords);
    const allHighlights = (result.variations || []).flatMap((v) => toArray(v.highlights));
    const normalizedHighlights = allHighlights
      .map((h) => normalizeHighlight(h).toLowerCase())
      .filter(Boolean);
    const focusMatches = jobKeywords.filter((kw) => normalizedHighlights.includes(kw.toLowerCase()));
    const uniqueHighlights = Array.from(new Set(allHighlights.map((h) => normalizeHighlight(h)))).filter(Boolean);
    return {
      focusCount: focusMatches.length,
      focusMatches,
      totalHighlights: uniqueHighlights.length,
      sampleHighlight: uniqueHighlights[0] || null,
    };
  };
  const insights = buildInsights();

  // Load cached result on mount
  React.useEffect(() => {
    const cached = loadCachedResult();
    if (cached) {
      setResult(cached.result);
      setSelectedJobId(cached.selectedJobId || '');
      setTone(cached.tone || 'balanced');
      setVariations(cached.variations || 2);
    }
  }, []);

  // Save result to cache whenever it changes
  React.useEffect(() => {
    if (result) {
      saveCachedResult({
        result,
        selectedJobId,
        tone,
        variations,
      });
    }
  }, [result, selectedJobId, tone, variations]);

  React.useEffect(() => {
    const load = async () => {
      setJobsLoading(true);
      setJobsError('');
      try {
        const response = await jobsAPI.getJobs();
        const list = Array.isArray(response) ? response : response?.results || [];
        setJobs(list);
        if (!list.length) {
          setJobsError('Add a job in the Jobs workspace or import from a URL below.');
        }
      } catch (e) {
        setJobsError(e?.message || 'Unable to load your jobs.');
      } finally {
        setJobsLoading(false);
      }
    };
    load();
  }, []);

  React.useEffect(() => {
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
        // Best-effort fallback from list item
        const fallback = (jobs || []).find((j) => String(j.id) === String(selectedJobId));
        setSelectedJobDetail(fallback || null);
      } finally {
        setJobDetailLoading(false);
      }
    };
    hydrate();
  }, [selectedJobId, jobs]);

  const onSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    setResult(null);
    if (!selectedJobId) {
      setError('Please select a job to generate a cover letter.');
      return;
    }
    setLoading(true);
    try {
      const data = await coverLetterAIAPI.generateForJob(selectedJobId, { tone, variation_count: Number(variations) });
      setResult(data);
    } catch (err) {
      const msg = err?.message || err?.error?.message || 'Failed to generate cover letter.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = async (variation) => {
    if (!variation) return;
    
    // Combine all parts of the cover letter
    const fullText = [
      variation.opening_paragraph,
      ...(variation.body_paragraphs || []),
      variation.closing_paragraph,
    ]
      .filter(Boolean)
      .join('\n\n');
    
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedVariationId(variation.id || `variation-${Math.random()}`);
      setTimeout(() => setCopiedVariationId(''), 1800);
    } catch {
      setError('Clipboard permissions blocked. Try downloading instead.');
    }
  };

  const handleDownloadText = (variation) => {
    if (!variation) return;
    
    // Combine all parts of the cover letter
    const fullText = [
      variation.opening_paragraph,
      ...(variation.body_paragraphs || []),
      variation.closing_paragraph,
    ]
      .filter(Boolean)
      .join('\n\n');
    
    // Generate filename
    let filename = 'cover_letter.txt';
    if (selectedJobDetail?.title && selectedJobDetail?.company_name) {
      const title = selectedJobDetail.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const company = selectedJobDetail.company_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      filename = `Cover_Letter_${company}_${title}.txt`;
    }
    
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ai-resume-page ai-clr-page">
      <section className="ai-resume-card hero">
        <div className="eyebrow">AI assistant</div>
        <h1>AI Cover Letters</h1>
        <p className="lead">Generate tailored cover-letter content for any job you’ve saved. Paste a Job ID from your Jobs page and pick a tone.</p>
        <ul className="hero-checklist">
          <li><Icon name="sparkles" /> Personalized opening</li>
          <li><Icon name="file-text" /> Role-aligned body</li>
          <li><Icon name="heart" /> Polite, confident closing</li>
        </ul>
      </section>

      <div className="ai-resume-grid">
        <section className="ai-resume-card controls">
          <div className="control-group">
            <label htmlFor="job-search">Find a job posting</label>
            <div className="job-search">
              <Icon name="search" />
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
            <label htmlFor="job-select"><span>Select job <span className="required-star">*</span></span></label>
            <div className="select-wrapper">
              {jobsLoading ? (
                <div className="inline-hint"><LoadingSpinner size="sm" /> Loading your pipeline…</div>
              ) : (
                <select
                  id="job-select"
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  aria-required
                >
                  <option value="">— Choose a job —</option>
                  {(jobs || [])
                    .filter((job) => {
                      if (!jobSearch) return true;
                      const q = jobSearch.toLowerCase();
                      return `${job.title} ${job.company_name}`.toLowerCase().includes(q);
                    })
                    .map((job) => (
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
            <span>Writing tone</span>
            <div className="tone-grid">
              {tones.map((t) => (
                <button
                  type="button"
                  key={t.value}
                  className={`tone-chip ${tone === t.value ? 'active' : ''}`}
                  onClick={() => setTone(t.value)}
                  aria-pressed={tone === t.value}
                >
                  <strong>{t.label}</strong>
                  <small>{t.hint}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="control-group inline">
            <label htmlFor="variationCount">Variations</label>
            <select id="variationCount" value={variations} onChange={(e) => setVariations(e.target.value)}>
              {variationChoices.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div className={`control-actions`}>
            <button type="button" className={`primary ${loading ? 'loading' : ''}`} onClick={onSubmit} disabled={loading}>
              <Icon name={loading ? 'loader' : 'sparkles'} />
              {loading ? 'Generating…' : 'Generate cover letters'}
            </button>
            <button type="button" className="ghost" onClick={() => { clearCachedResult(); setError(''); setResult(null); }} disabled={loading}>
              <Icon name="rotate-ccw" /> Reset
            </button>
          </div>

          <div className={`progress-bar ${loading ? 'active' : ''}`} aria-hidden={!loading}>
            <span />
          </div>
          <div className="generation-status" role="status">
            {loading ? 'Crafting compelling opening, quantified wins, and a confident close…' : 'Ready'}
          </div>

          {error && <div className="inline-error" role="alert">{error}</div>}
        </section>

        <section className="ai-resume-card job-preview">
          <header>
            <div>
              <p className="eyebrow">Job context</p>
              <h2>{sanitizeText(selectedJobDetail?.title) || 'Choose a job to preview details'}</h2>
              {sanitizeText(selectedJobDetail?.company_name) && (
                <p className="company-line">{sanitizeText(selectedJobDetail?.company_name)}</p>
              )}
            </div>
            {jobDetailLoading && <LoadingSpinner size="sm" />}
          </header>
          {selectedJobDetail ? (
            <>
              <dl className="meta-grid">
                <div>
                  <dt>Location</dt>
                  <dd>{sanitizeText(selectedJobDetail?.location) || 'Remote / TBD'}</dd>
                </div>
                <div>
                  <dt>Job Type</dt>
                  <dd>{sanitizeText(selectedJobDetail?.job_type) || '—'}</dd>
                </div>
                <div>
                  <dt>Industry</dt>
                  <dd>{sanitizeText(selectedJobDetail?.industry) || '—'}</dd>
                </div>
                <div>
                  <dt>Deadline</dt>
                  <dd>{formatDate(selectedJobDetail?.application_deadline)}</dd>
                </div>
              </dl>
              <article className="job-description">
                <h3>Key requirements</h3>
                <p>{sanitizeText(selectedJobDetail?.description) || 'No job description provided yet.'}</p>
              </article>
              {chipify(selectedJobDetail?.keywords).length > 0 && (
                <div className="chip-row">
                  {chipify(selectedJobDetail?.keywords).map((kw) => (
                    <span key={kw} className="chip">{kw}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="placeholder">Select a job to see its description, deadlines, and keywords the AI will leverage.</p>
          )}
        </section>
      </div>

      {result && (
        <>
          <section className="ai-resume-card insights">
            <div>
              <p className="eyebrow">AI insights</p>
              <h2>How this letter aligns with the role</h2>
            </div>
            <div className="insight-grid">
              <div>
                <strong>Role focus</strong>
                <p>{sanitizeText(selectedJobDetail?.title) || 'Target role'}</p>
              </div>
              <div>
                <strong>Company</strong>
                <p>{sanitizeText(selectedJobDetail?.company_name) || 'Target company'}</p>
              </div>
              <div>
                <strong>Tone applied</strong>
                <p className="capitalize">{tone}</p>
              </div>
              {chipify(selectedJobDetail?.keywords).length > 0 && (
                <div>
                  <strong>Key role requirements</strong>
                  <div className="chip-row">
                    {chipify(selectedJobDetail?.keywords).slice(0, 3).map((kw) => (
                      <span key={kw} className="chip">{kw}</span>
                    ))}
                    {chipify(selectedJobDetail?.keywords).length > 3 && (
                      <span className="chip">+{chipify(selectedJobDetail?.keywords).length - 3}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="variation-section">
            {Array.isArray(result?.variations) && result.variations.length > 1 && (
              <div className="variation-header">
                <h3>Choose a variation</h3>
                <p className="hint">Generated {result.variations.length} different versions - click to compare</p>
              </div>
            )}
            <div className="variation-tabs-bar">
              <div className="variation-tabs">
                {Array.isArray(result?.variations) &&
                  result.variations.map((v, idx) => (
                    <button
                      type="button"
                      key={idx}
                      className={idx === 0 ? 'active' : ''}
                      onClick={() => {
                        const selected = document.querySelector(`[data-variation-index="${idx}"]`);
                        if (selected) selected.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      <strong>Variation {idx + 1}</strong>
                      <span>{tone.toUpperCase()}</span>
                    </button>
                  ))}
              </div>
            </div>

            {Array.isArray(result?.variations) && result.variations.length > 0 ? (
              result.variations.map((v, idx) => (
                <article
                  key={idx}
                  className="ai-resume-card variation-card"
                  data-variation-index={idx}
                >
                  <header>
                    <div>
                      <h3>Variation {idx + 1}</h3>
                      <div className="variation-chip-row">
                        {tone && (
                          <span className="chip tone">Tone: {tone}</span>
                        )}
                      </div>
                    </div>
                    <div className="variation-action-stack">
                      <button type="button" onClick={() => handleCopyText(v)}>
                        {copiedVariationId === (v.id || `variation-${idx}`) ? (
                          <>
                            <Icon name="check" size="sm" /> Copied
                          </>
                        ) : (
                          <>
                            <Icon name="clipboard" size="sm" /> Copy text
                          </>
                        )}
                      </button>
                      <button type="button" onClick={() => handleDownloadText(v)}>
                        <Icon name="download" size="sm" /> Download .txt
                      </button>
                    </div>
                  </header>

                  <div className="ai-clr-section">
                    <h4>Opening</h4>
                    <p>{v.opening_paragraph}</p>
                  </div>

                  <div className="ai-clr-section">
                    <h4>Body</h4>
                    {(v.body_paragraphs || []).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>

                  <div className="ai-clr-section">
                    <h4>Closing</h4>
                    <p>{v.closing_paragraph}</p>
                  </div>

                  {toArray(v.highlights).length > 0 && (
                    <div className="highlights-section">
                      <strong>Key highlights in this version</strong>
                      <div className="chip-row">
                        {toArray(v.highlights)
                          .map((h) => normalizeHighlight(h))
                          .filter(Boolean)
                          .map((h, i) => (
                            <span key={`${h}-${i}`} className="chip accent">
                              {h}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <p className="placeholder">No variations returned.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default AiCoverLetterGenerator;
