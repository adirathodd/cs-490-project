import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { jobsAPI } from '../../../services/api';
import Icon from '../../../components/common/Icon';
import './CompanyInsights.css';

const categoryLabels = {
  funding: 'Funding',
  product: 'Product Launch',
  hiring: 'Hiring',
  partnership: 'Partnership',
  market: 'Market Expansion',
  culture: 'Culture & Team',
  update: 'General Update',
};

const formatCategoryLabel = (value) => categoryLabels[value] || value?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Update';

const formatDate = (dateString) => {
  if (!dateString) return 'Date TBA';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString();
};

const getSourceFromUrl = (url, fallback) => {
  if (fallback) return fallback;
  if (!url) return 'Company Newsroom';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return 'Company Newsroom';
  }
};

const extractKeyPoints = (summary, fallback) => {
  if (!summary) return [fallback || 'Key takeaway unavailable'];
  const sentences = summary.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length === 0) return [summary];
  return sentences.slice(0, 3);
};

const inferCategory = (title = '', summary = '') => {
  const text = `${title} ${summary}`.toLowerCase();
  if (text.match(/raise|series|funding|investment|ipo/)) return 'funding';
  if (text.match(/launch|product|feature|platform|announce/)) return 'product';
  if (text.match(/hiring|recruit|team|headcount|expand/)) return 'hiring';
  if (text.match(/partner|partnership|alliance|collabor/)) return 'partnership';
  if (text.match(/market|expansion|opens new|global/)) return 'market';
  if (text.match(/culture|diversity|employee/)) return 'culture';
  return 'update';
};

const computePersonalRelevance = (news, job) => {
  let score = Number.isFinite(Number(news?.relevance_score)) ? Number(news.relevance_score) : 55;
  const haystack = `${news?.title || ''} ${news?.summary || ''}`.toLowerCase();
  if (job?.industry && haystack.includes(job.industry.toLowerCase())) score += 10;
  if (job?.title) {
    const token = job.title.split(' ')[0]?.toLowerCase();
    if (token && haystack.includes(token)) score += 8;
  }
  if (job?.location) {
    const city = job.location.split(',')[0]?.toLowerCase();
    if (city && haystack.includes(city)) score += 5;
  }
  if (news?.category === 'hiring') score += 10;
  if (news?.category === 'funding') score += 5;
  return Math.max(15, Math.min(100, Math.round(score)));
};

const enrichNewsItem = (item, job, index = 0) => {
  if (!item) return null;
  const category = item.category || inferCategory(item.title, item.summary);
  const id = item.url || `${item.title || 'news'}-${index}`;
  const keyPoints = (item.key_points && item.key_points.length > 0) ? item.key_points : extractKeyPoints(item.summary, item.title);
  const personalRelevance = computePersonalRelevance({ ...item, category }, job);
  return {
    ...item,
    id,
    category,
    source: getSourceFromUrl(item.url, item.source),
    keyPoints,
    formattedDate: formatDate(item.date),
    personalRelevance,
    impactLevel: personalRelevance >= 80 ? 'High' : personalRelevance >= 60 ? 'Medium' : 'Low',
    isAlert: Boolean(item.is_alert || personalRelevance >= 80),
  };
};

const getCompanyStorageKey = (company) => {
  if (!company) return 'company-unknown';
  if (company.id) return `company-${company.id}`;
  return `company-${(company.name || '').toLowerCase()}`;
};

const sanitizeNewsId = (newsId) => encodeURIComponent(newsId || 'news');

const getSnippetTokens = (newsId) => {
  const safeId = sanitizeNewsId(newsId);
  return {
    start: `[NEWS:${safeId}]`,
    end: `[/NEWS:${safeId}]`,
    safeId,
  };
};

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasNewsSnippet = (notes, newsId) => {
  if (!notes) return false;
  return notes.includes(getSnippetTokens(newsId).start);
};

const stripNewsSnippet = (notes, newsId) => {
  if (!notes) return '';
  const { start, end } = getSnippetTokens(newsId);
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`, 'g');
  return notes.replace(pattern, '').replace(/\n{3,}/g, '\n\n').trim();
};

const PAGE_SIZE = 10;

const CompanyInsights = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [company, setCompany] = useState(null);
  const [newsItems, setNewsItems] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isFollowed, setIsFollowed] = useState(false);
  const [savingNotesFor, setSavingNotesFor] = useState(null);
  const newsSectionRef = useRef(null);
  const hasScrolledNewsRef = useRef(false);

  useEffect(() => {
    const loadInsights = async () => {
      setLoading(true);
      setError('');
      try {
        const jobData = await jobsAPI.getJob(id);
        setJob(jobData);
        let companyData = jobData.company_info;
        try {
          const latestCompany = await jobsAPI.getJobCompanyInsights(id);
          if (latestCompany && latestCompany.name) {
            companyData = latestCompany;
          }
        } catch (innerError) {
          console.warn('Company insights endpoint unavailable:', innerError);
        }
        setCompany(companyData);
        const normalizedNews = (companyData?.recent_news || [])
          .map((item, index) => enrichNewsItem(item, jobData, index))
          .filter(Boolean);
        setNewsItems(normalizedNews);
        setSelectedCategories([]);
        setIsFilterOpen(false);
        setCurrentPage(1);
      } catch (err) {
        const msg = err?.message || err?.error?.message || 'Failed to load company insights.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, [id]);

  useEffect(() => {
    hasScrolledNewsRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!company) return;
    try {
      const stored = JSON.parse(localStorage.getItem('followedCompanies') || '{}');
      setIsFollowed(Boolean(stored[getCompanyStorageKey(company)]));
    } catch {
      setIsFollowed(false);
    }
  }, [company]);

  const categoryCounts = useMemo(() => {
    return newsItems.reduce((acc, item) => {
      const key = item.category || 'update';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [newsItems]);

  const availableCategories = useMemo(() => Object.keys(categoryCounts), [categoryCounts]);

  const filteredNews = useMemo(() => {
    if (!selectedCategories.length) return newsItems;
    return newsItems.filter((item) => selectedCategories.includes(item.category));
  }, [newsItems, selectedCategories]);

  const filterSignature = useMemo(
    () => selectedCategories.slice().sort().join('|'),
    [selectedCategories]
  );

  useEffect(() => {
    setSelectedCategories((prev) => {
      const next = prev.filter((cat) => availableCategories.includes(cat));
      return next.length === prev.length ? prev : next;
    });
  }, [availableCategories]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterSignature]);

  useEffect(() => {
    setCurrentPage((prev) => {
      const maxPage = Math.max(1, Math.ceil((filteredNews.length || 1) / PAGE_SIZE));
      return Math.min(prev, maxPage);
    });
  }, [filteredNews.length]);

  const totalPages = Math.max(1, Math.ceil((filteredNews.length || 1) / PAGE_SIZE));
  const paginatedNews = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredNews.slice(start, start + PAGE_SIZE);
  }, [filteredNews, currentPage]);

  const alertNews = useMemo(() => newsItems.filter((item) => item.isAlert), [newsItems]);
  const hasFiltersApplied = selectedCategories.length > 0;
  const filterSummaryLabel = hasFiltersApplied
    ? `${selectedCategories.length} selected`
    : 'All categories';

  const toggleCategory = (category) => {
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((cat) => cat !== category);
      }
      return [...prev, category];
    });
  };

  const handleClearFilters = () => {
    setSelectedCategories([]);
  };

  const handleSelectAllCategories = () => {
    if (!availableCategories.length) return;
    setSelectedCategories((prev) => {
      if (prev.length === availableCategories.length) {
        return [];
      }
      return availableCategories;
    });
  };

  const handleFollowToggle = () => {
    if (!company) return;
    const key = getCompanyStorageKey(company);
    const existing = JSON.parse(localStorage.getItem('followedCompanies') || '{}');
    if (isFollowed) {
      delete existing[key];
      setIsFollowed(false);
      setStatus('Company removed from alerts.');
    } else {
      existing[key] = { followedAt: new Date().toISOString() };
      setIsFollowed(true);
      setStatus('You will receive alerts for this company.');
    }
    localStorage.setItem('followedCompanies', JSON.stringify(existing));
    setTimeout(() => setStatus(''), 3000);
  };

  const handleCopySummary = async (news) => {
    const snippet = [
      `${news.title} (${news.formattedDate}) - ${news.source}`,
      news.summary,
      '',
      'Key Points:',
      ...news.keyPoints.map((point) => `• ${point}`),
    ].join('\n');

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = snippet;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setStatus('Summary copied to clipboard.');
    } catch (copyError) {
      setStatus('Unable to copy summary.');
    }
    setTimeout(() => setStatus(''), 3000);
  };

  const handleAddNewsToNotes = async (news) => {
    if (!job) return;
    setSavingNotesFor(news.id);
    try {
      const formatted = [
        `Company insight – ${news.title} (${news.formattedDate})`,
        `Category: ${formatCategoryLabel(news.category)}, Source: ${news.source}`,
        news.summary || 'No summary provided.',
        'Key points:',
        ...news.keyPoints.map((point) => `- ${point}`),
        '',
      ].join('\n');
      const { start, end } = getSnippetTokens(news.id);
      const snippetBlock = `${start}\n${formatted}\n${end}`;
      const existing = job.personal_notes?.trim();
      const mergedNotes = [existing, snippetBlock].filter(Boolean).join('\n\n');
      const updatedJob = await jobsAPI.updateJob(job.id, { personal_notes: mergedNotes });
      setJob(updatedJob);
      setStatus('News insight saved to job materials.');
    } catch (err) {
      const msg = err?.message || 'Failed to save news insight.';
      setError(msg);
    } finally {
      setSavingNotesFor(null);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  const handleRemoveNewsFromNotes = async (news) => {
    if (!job) return;
    setSavingNotesFor(news.id);
    try {
      const cleaned = stripNewsSnippet(job.personal_notes || '', news.id);
      const updatedJob = await jobsAPI.updateJob(job.id, { personal_notes: cleaned });
      setJob(updatedJob);
      setStatus('News insight removed from job notes.');
    } catch (err) {
      const msg = err?.message || 'Failed to remove news insight.';
      setError(msg);
    } finally {
      setSavingNotesFor(null);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  const handleExportNews = () => {
    if (!filteredNews.length || !company) return;
    const lines = [
      `# ${company.name} — News Summary`,
      `Generated: ${new Date().toLocaleString()}`,
      `Tracking Job: ${job?.title || 'Unknown role'}`,
      '',
    ];
    filteredNews.forEach((news) => {
      lines.push(`## ${news.title}`);
      lines.push(`- Date: ${news.formattedDate}`);
      lines.push(`- Category: ${formatCategoryLabel(news.category)}`);
      lines.push(`- Source: ${news.source}`);
      lines.push(`- Relevance: ${news.personalRelevance}/100 (${news.impactLevel})`);
      lines.push('');
      lines.push(news.summary || 'No summary provided.');
      lines.push('');
      lines.push('Key Points:');
      news.keyPoints.forEach((point) => lines.push(`- ${point}`));
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${(company.name || 'company').toLowerCase().replace(/\s+/g, '-')}-news.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    setStatus('News summaries exported.');
    setTimeout(() => setStatus(''), 3000);
  };

  useEffect(() => {
    if (!newsSectionRef.current || !filteredNews.length) return;
    if (!hasScrolledNewsRef.current) {
      hasScrolledNewsRef.current = true;
      return;
    }
    newsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentPage, filterSignature, filteredNews.length]);

  if (loading) {
    return (
      <div className="education-container">
        <div className="page-backbar">
          <button className="btn-back" onClick={() => navigate(`/jobs/${id}`)}>
            ← Back to Job
          </button>
        </div>
        <p>Loading company insights...</p>
      </div>
    );
  }

  if (error && !company) {
    return (
      <div className="education-container">
        <div className="page-backbar">
          <button className="btn-back" onClick={() => navigate(`/jobs/${id}`)}>
            ← Back to Job
          </button>
        </div>
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  return (
    <div className="education-container company-insights-page">
      <div className="page-backbar">
        <button className="btn-back" onClick={() => navigate(`/jobs/${id}`)}>
          ← Back to Job
        </button>
      </div>

      {status && <div className="success-banner">{status}</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="education-form-card insights-hero-card">
        <div className="insights-header">
          <div>
            <p className="insights-subtitle">Company Research</p>
            <h2>{company?.name || job?.company_name}</h2>
            <p className="insights-description">
              {company?.description || 'Stay informed with curated news to personalize your outreach.'}
            </p>
          </div>
          <div className="insights-header-actions">
            <button
              className={`btn-secondary follow-button ${isFollowed ? 'is-following' : ''}`}
              onClick={handleFollowToggle}
            >
              <Icon name="bell" size="sm" />
              {isFollowed ? 'Following Alerts' : 'Follow Company'}
            </button>
            <button
              className="btn-secondary export-button"
              onClick={handleExportNews}
              disabled={!filteredNews.length}
            >
              <Icon name="download" size="sm" />
              Export Summaries
            </button>
          </div>
        </div>

        <div className="insight-stats-grid">
          <div className="insight-stat">
            <span>Tracked Job</span>
            <strong>{job?.title || 'Not specified'}</strong>
            <small>{job?.industry || 'Industry unavailable'}</small>
          </div>
          <div className="insight-stat">
            <span>News Items</span>
            <strong>{company?.news_overview?.total_items ?? newsItems.length}</strong>
            <small>{formatDate(company?.news_overview?.latest_published_at)}</small>
          </div>
          <div className="insight-stat">
            <span>High Priority Alerts</span>
            <strong>{company?.news_overview?.high_priority_items ?? alertNews.length}</strong>
            <small>Based on relevance</small>
          </div>
          <div className="insight-stat">
            <span>Application Notes</span>
            <strong>{job?.personal_notes ? 'In Progress' : 'Not Started'}</strong>
            <small>Use Add to Notes to capture insights</small>
          </div>
        </div>
      </div>

      {isFollowed && alertNews.length > 0 && (
        <div className="alert-banner">
          <Icon name="bullhorn" size="sm" />
          <div>
            <strong>{alertNews.length} new alert{alertNews.length > 1 ? 's' : ''} for followed company</strong>
            <p>{alertNews[0].title}</p>
          </div>
        </div>
      )}

      <div className="education-form-card" ref={newsSectionRef}>
        <div className="insights-section-heading">
          <div>
            <h3><Icon name="newspaper" size="md" /> Recent News & Updates</h3>
            <p>Filter by category to find the most relevant talking points.</p>
          </div>
        </div>

        <div className="news-filter-bar">
          <button
            type="button"
            className={`filter-toggle ${isFilterOpen ? 'open' : ''}`}
            onClick={() => setIsFilterOpen((prev) => !prev)}
            aria-expanded={isFilterOpen}
            aria-controls="news-filter-panel"
          >
            <Icon name="filter" size="sm" />
            <span className="filter-toggle-title">Filter updates</span>
            <span className="filter-toggle-summary">{filterSummaryLabel}</span>
            <Icon name={isFilterOpen ? 'chevronUp' : 'chevronDown'} size="sm" />
          </button>
          {hasFiltersApplied && (
            <button
              type="button"
              className="filter-clear"
              onClick={handleClearFilters}
            >
              Clear filters
            </button>
          )}
        </div>

        {isFilterOpen && (
          <div className="filter-dropdown" id="news-filter-panel">
            <div className="filter-dropdown-header">
              <span>Choose categories</span>
              {availableCategories.length > 1 && (
                <button
                  type="button"
                  className="filter-select-all"
                  onClick={handleSelectAllCategories}
                >
                  {selectedCategories.length === availableCategories.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
            <div className="filter-options">
              {availableCategories.length === 0 ? (
                <p className="filter-empty">No category tags yet.</p>
              ) : (
                availableCategories.map((category) => {
                  const inputId = `filter-${category}`;
                  return (
                    <label key={category} htmlFor={inputId} className="filter-option">
                      <input
                        id={inputId}
                        type="checkbox"
                        aria-label={formatCategoryLabel(category)}
                        checked={selectedCategories.includes(category)}
                        onChange={() => toggleCategory(category)}
                      />
                      <span>{formatCategoryLabel(category)}</span>
                      <span className="filter-count-pill">{categoryCounts[category] || 0}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        {filteredNews.length === 0 ? (
          <div className="empty-state-card">
            <Icon name="info" size="lg" />
            <p>No news items match this category yet. Try another filter.</p>
          </div>
        ) : (
          <div className="news-cards">
            {paginatedNews.map((news) => (
              <div key={news.id} className="news-card">
                <div className="news-card-header">
                  <span className={`news-category ${news.category}`}>
                    <Icon name="tag" size="sm" />
                    {formatCategoryLabel(news.category)}
                  </span>
                  <div className="news-meta">
                    <span><Icon name="calendar" size="sm" /> {news.formattedDate}</span>
                    <span><Icon name="newspaper" size="sm" /> {news.source}</span>
                  </div>
                </div>
                <div className="news-card-body">
                  <h4 className="news-title">{news.title}</h4>
                  <p className="news-summary-text">{news.summary || 'No summary provided.'}</p>
                  <div className="news-key-points">
                    <span>Key Points</span>
                    <ul>
                      {news.keyPoints.map((point, idx) => (
                        <li key={`${news.id}-point-${idx}`}>{point}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="news-relevance">
                    <div className="relevance-label">
                      <Icon name="star" size="sm" />
                      <strong>{news.personalRelevance}</strong>/100 relevance — {news.impactLevel} impact
                    </div>
                    <div className="relevance-bar">
                      <div
                        className="relevance-bar-fill"
                        style={{ width: `${news.personalRelevance}%` }}
                      />
                    </div>
                  </div>
                  <div className="news-actions">
                    {news.url && (
                      <a href={news.url} target="_blank" rel="noreferrer" className="btn-link">
                        <Icon name="link" size="sm" />
                        Read Article
                      </a>
                    )}
                    <button className="btn-secondary" onClick={() => handleCopySummary(news)}>
                      <Icon name="clipboard" size="sm" />
                      Copy Summary
                    </button>
                    {hasNewsSnippet(job?.personal_notes, news.id) ? (
                      <button
                        className="remove-notes-button"
                        onClick={() => handleRemoveNewsFromNotes(news)}
                        disabled={savingNotesFor === news.id}
                      >
                        <Icon name="trash" size="sm" />
                        {savingNotesFor === news.id ? 'Removing...' : 'Remove from Notes'}
                      </button>
                    ) : (
                      <button
                        className="add-to-notes-button"
                        onClick={() => handleAddNewsToNotes(news)}
                        disabled={savingNotesFor === news.id}
                      >
                        <Icon name="file-text" size="sm" />
                        {savingNotesFor === news.id ? 'Saving...' : 'Add to Notes'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredNews.length > PAGE_SIZE && (
          <div className="news-pagination">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <Icon name="chevronLeft" size="sm" />
              Previous
            </button>
            <span className="pagination-status">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <Icon name="chevronRight" size="sm" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export {
  formatCategoryLabel,
  formatDate,
  getSourceFromUrl,
  extractKeyPoints,
  inferCategory,
  computePersonalRelevance,
  enrichNewsItem,
  getCompanyStorageKey,
  sanitizeNewsId,
  getSnippetTokens,
  escapeRegExp,
  hasNewsSnippet,
  stripNewsSnippet,
  PAGE_SIZE,
};

export default CompanyInsights;
