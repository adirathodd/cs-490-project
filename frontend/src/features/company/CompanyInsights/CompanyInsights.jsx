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

// Helpers to sanitize AI-provided arrays/objects before rendering
const isValidText = (s) => typeof s === 'string' && s.trim().length >= 2 && s.trim().length <= 200 && !s.includes('\n');

const sanitizeList = (list) => Array.isArray(list) ? list.map(String).map(s => s.trim()).filter(isValidText) : [];

const sanitizeProducts = (products) => {
  if (!Array.isArray(products)) return [];
  return products
    .map((p) => ({
      name: (p && (p.name || p.title || '')).toString().trim(),
      description: (p && (p.description || '')).toString().trim(),
    }))
    .filter((p) => isValidText(p.name));
};

const formatMarketCap = (n) => {
  try {
    if (n === null || n === undefined) return null;
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n);
    if (Math.abs(num) >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    return num.toLocaleString();
  } catch {
    return String(n);
  }
};

const sanitizeDevelopments = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    title: (item && item.title ? String(item.title) : '').trim(),
    summary: (item && item.summary ? String(item.summary) : '').trim(),
    date: item?.date,
    category: item?.category || 'update',
    source: item?.source || '',
    key_points: Array.isArray(item?.key_points) ? item.key_points.slice(0, 3) : [],
  })).filter((item) => isValidText(item.title) || isValidText(item.summary));
};

const sanitizeTalkingPoints = (points) => {
  if (!Array.isArray(points)) return [];
  return points.map((point) => String(point || '').trim()).filter(isValidText);
};

const sanitizeInterviewQuestions = (questions) => {
  if (!Array.isArray(questions)) return [];
  return questions.map((question) => String(question || '').trim()).filter(isValidText);
};

// Robust getters that look in multiple places for legacy/flattened shapes
const getLeadership = (company) => {
  if (!company) return [];
  const candidates = company.leadership || company.executives || (company.research && company.research.executives) || [];
  if (!Array.isArray(candidates)) return [];
  return candidates.map((c) => ({ name: c.name || c.full_name || '', title: c.title || '' })).filter(l => isValidText(l.name));
};

const getProducts = (company) => {
  if (!company) return [];
  const candidates = company.products || (company.research && company.research.products) || [];
  return sanitizeProducts(candidates);
};

const getCompanyValues = (company) => {
  if (!company) return [];
  return sanitizeList(company.company_values || company.values || (company.research && company.research.company_values) || []);
};

const getTechStack = (company) => {
  if (!company) return [];
  return sanitizeList(company.tech_stack || (company.research && company.research.tech_stack) || []);
};

const getCompanyMission = (company) => {
  if (!company) return '';
  return (company.mission || company.mission_statement || (company.research && company.research.mission_statement) || '').trim();
};

const getCompanyHistory = (company) => {
  if (!company) return '';
  return (
    company.history
    || company.company_history
    || (company.research && company.research.company_history)
    || company.description
    || (company.research && company.research.description)
    || ''
  ).trim();
};

const getRecentDevelopments = (company) => {
  if (!company) return [];
  return sanitizeDevelopments(company.recent_developments || (company.research && company.research.recent_developments) || []);
};

const getStrategicInitiatives = (company) => {
  if (!company) return [];
  return sanitizeDevelopments(company.strategic_initiatives || (company.research && company.research.strategic_initiatives) || []);
};

const getTalkingPointsList = (company) => {
  if (!company) return [];
  return sanitizeTalkingPoints(company.talking_points || (company.research && company.research.talking_points) || []);
};

const getInterviewQuestionList = (company) => {
  if (!company) return [];
  return sanitizeInterviewQuestions(company.interview_questions || (company.research && company.research.interview_questions) || []);
};

const getCompetitorsList = (company) => {
  if (!company) return [];
  const data = company.competitors || (company.research && company.research.competitors) || {};
  if (Array.isArray(data.companies) && data.companies.length) {
    return data.companies;
  }
  return [];
};

const getExportSummary = (company) => {
  if (!company) return '';
  return (company.export_summary || (company.research && company.research.export_summary) || '').trim();
};

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
  const [generatingProfile, setGeneratingProfile] = useState(false);
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

        // If the insights API returns a nested `research` object (CompanyResearch),
        // flatten commonly-used research fields onto the top-level so the UI
        // (which expects fields like `mission`, `leadership`, `recent_news`) can
        // display them without additional branching.
        const flattenResearch = (data = {}) => {
          if (!data || typeof data !== 'object') return data;
          const research = data.research || {};
          const flattened = { ...(data || {}) };

          const prefer = (sourceValue, key, targetKey = key) => {
            if (!flattened[targetKey] && sourceValue) {
              flattened[targetKey] = sourceValue;
            }
          };

          // From nested research
          prefer(research.description, 'description');
          prefer(research.profile_overview, 'profile_overview');
          prefer(research.company_history, 'history');
          prefer(research.mission_statement, 'mission');
          prefer(research.company_values, 'company_values');
          prefer(research.culture_keywords, 'culture_keywords');
          prefer(research.tech_stack, 'tech_stack');
          prefer(research.funding_info, 'funding_info');
          prefer(research.employee_count, 'employee_count');
          prefer(research.glassdoor_rating, 'glassdoor_rating');
          prefer(research.competitive_landscape, 'competitive_landscape');
          prefer(research.export_summary, 'export_summary');
          prefer(research.strategic_initiatives, 'strategic_initiatives');
          prefer(research.talking_points, 'talking_points');
          prefer(research.interview_questions, 'interview_questions');
          prefer(research.recent_developments, 'recent_developments');

          if (Array.isArray(research.recent_news) && (!Array.isArray(flattened.recent_news) || !flattened.recent_news.length)) {
            flattened.recent_news = research.recent_news;
          }

          prefer(research.executives, 'leadership');
          prefer(research.executives, 'executives');
          prefer(research.products, 'products');
          prefer(research.competitors, 'competitors');

          // Provide a human-friendly competitive landscape summary if available
          if (!flattened.competitive_landscape && research.competitors) {
            if (research.competitors.market_position) {
              flattened.competitive_landscape = research.competitors.market_position;
            } else if (Array.isArray(research.competitors.companies) && research.competitors.companies.length) {
              flattened.competitive_landscape = research.competitors.companies.slice(0, 5).join(', ');
            }
          }

          // Flatten top-level convenience fields returned by API (outside research key)
          prefer(data.description, 'description');
          prefer(data.profile_overview, 'profile_overview');
          prefer(data.company_history || data.history, 'history');
          prefer(data.mission_statement || data.mission, 'mission');
          prefer(data.company_values || data.values, 'company_values');
          prefer(data.executives, 'leadership');
          prefer(data.executives, 'executives');
          prefer(data.competitors, 'competitors');
          prefer(data.competitive_landscape, 'competitive_landscape');
          prefer(data.recent_developments, 'recent_developments');
          prefer(data.strategic_initiatives, 'strategic_initiatives');
          prefer(data.talking_points, 'talking_points');
          prefer(data.interview_questions, 'interview_questions');
          prefer(data.export_summary, 'export_summary');

          return flattened;
        };

        companyData = flattenResearch(companyData);

        // If there is company info on the Job record, map commonly used keys
        // into the insights shape and merge without overwriting any explicit
        // fields returned by the insights endpoint. This ensures the data
        // shown on the JobDetailView's company card is available here.
        const mapJobCompanyInfoToInsights = (jobInfo = {}) => {
          if (!jobInfo || typeof jobInfo !== 'object') return {};
          const source = flattenResearch(jobInfo) || {};
          const mapped = {};
          if (source.name) mapped.name = source.name;
          if (source.description) mapped.description = source.description;
          if (source.profile_overview) mapped.profile_overview = source.profile_overview;
          if (source.mission_statement) mapped.mission = source.mission_statement;
          if (source.mission && !mapped.mission) mapped.mission = source.mission;
          if (source.history) mapped.history = source.history;
          if (source.size) mapped.size = source.size;
          if (source.hq_location) mapped.hq_location = source.hq_location;
          if (source.domain && !source.website) mapped.website = source.domain.startsWith('http') ? source.domain : `https://${source.domain}`;
          if (source.website) mapped.website = source.website;
          if (source.linkedin_url) mapped.linkedin_url = source.linkedin_url;
          if (source.glassdoor_rating) mapped.glassdoor_rating = source.glassdoor_rating;
          if (source.employee_count) mapped.employee_count = source.employee_count;
          if (Array.isArray(source.recent_news)) mapped.recent_news = source.recent_news;
          if (Array.isArray(source.recent_developments)) mapped.recent_developments = source.recent_developments;
          if (Array.isArray(source.strategic_initiatives)) mapped.strategic_initiatives = source.strategic_initiatives;
          if (Array.isArray(source.talking_points)) mapped.talking_points = source.talking_points;
          if (Array.isArray(source.interview_questions)) mapped.interview_questions = source.interview_questions;
          if (Array.isArray(source.leadership)) mapped.leadership = source.leadership;
          if (source.competitive_landscape) mapped.competitive_landscape = source.competitive_landscape;
          if (source.export_summary) mapped.export_summary = source.export_summary;
          return mapped;
        };

        const jobMapped = mapJobCompanyInfoToInsights(jobData.company_info || {});

        // Merge: start with job-mapped values and overlay any insights API fields
        // so the insights endpoint remains authoritative when available.
        const mergedCompany = { ...(jobMapped || {}), ...(companyData || {}) };

        setCompany(mergedCompany);

        const normalizedNews = ((mergedCompany?.recent_news || companyData?.recent_news || [])
          .map((item, index) => enrichNewsItem(item, jobData, index))
          .filter(Boolean));
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

  const handleExportResearch = () => {
    if (!company) return;
    const filename = `${(company.name || 'company').toLowerCase().replace(/\s+/g, '-')}-research.md`;
    const lines = [
      `# ${company.name} — Interview Research`,
      `Generated: ${new Date().toLocaleString()}`,
      `Tracking Job: ${job?.title || 'Unknown role'}`,
      '',
    ];

    const overview = getExportSummary(company) || company.profile_overview || company.description;
    const products = getProducts(company);
    const techStack = getTechStack(company);
    if (overview) {
      lines.push('## Overview', overview.trim(), '');
    }

    const historyText = getCompanyHistory(company);
    if (historyText) {
      lines.push('## Company History', historyText, '');
    }

    const missionText = getCompanyMission(company);
    const values = getCompanyValues(company);
    if (missionText || values.length) {
      lines.push('## Mission & Values');
      if (missionText) lines.push(`Mission: ${missionText}`);
      if (values.length) lines.push(`Values: ${values.join(', ')}`);
      lines.push('');
    }

    const developments = getRecentDevelopments(company);
    lines.push('## Recent Developments');
    if (developments.length) {
      developments.forEach((dev) => {
        lines.push(`- ${dev.title || dev.summary} (${formatDate(dev.date)} – ${formatCategoryLabel(dev.category)})`);
        if (dev.summary) lines.push(`  ${dev.summary}`);
      });
    } else {
      lines.push('- None available');
    }
    lines.push('');

    const initiatives = getStrategicInitiatives(company);
    lines.push('## Strategic Initiatives');
    if (initiatives.length) {
      initiatives.forEach((item) => {
        lines.push(`- ${item.title} (${formatCategoryLabel(item.category)})`);
        if (item.summary) lines.push(`  ${item.summary}`);
      });
    } else {
      lines.push('- None available');
    }
    lines.push('');

    const talkingPoints = getTalkingPointsList(company);
    lines.push('## Talking Points');
    if (talkingPoints.length) {
      talkingPoints.forEach((point) => lines.push(`- ${point}`));
    } else {
      lines.push('- None available');
    }
    lines.push('');

    const questions = getInterviewQuestionList(company);
    lines.push('## Intelligent Questions');
    if (questions.length) {
      questions.forEach((question) => lines.push(`- ${question}`));
    } else {
      lines.push('- None available');
    }
    lines.push('');

    const leadershipList = getLeadership(company);
    lines.push('## Leadership');
    if (leadershipList.length) {
      leadershipList.forEach((leader) => lines.push(`- ${leader.name}${leader.title ? ` — ${leader.title}` : ''}`));
    } else {
      lines.push('- Not available');
    }
    lines.push('');

    lines.push('## Products / Offerings');
    if (products.length) {
      products.forEach((product) => lines.push(`- ${product.name}${product.description ? ` — ${product.description}` : ''}`));
    } else {
      lines.push('- Not available');
    }
    lines.push('');

    lines.push('## Tech Stack');
    if (techStack.length) {
      lines.push(`- ${techStack.join(', ')}`);
    } else {
      lines.push('- Not available');
    }
    lines.push('');

    lines.push('## Competitive Landscape');
    if (company.competitive_landscape) {
      lines.push(company.competitive_landscape);
    } else {
      lines.push('Not available.');
    }
    const competitorNames = getCompetitorsList(company);
    if (competitorNames.length) {
      lines.push(`Competitors: ${competitorNames.join(', ')}`);
    }
    lines.push('');

    lines.push('## Funding / Market');
    if (company?.funding_info) {
      if (company.funding_info.market_cap) lines.push(`- Market cap: ${formatMarketCap(company.funding_info.market_cap)}`);
      if (company.funding_info.price_to_earnings) lines.push(`- P/E: ${Number(company.funding_info.price_to_earnings).toFixed(2)}`);
      if (company.funding_info.beta) lines.push(`- Beta: ${Number(company.funding_info.beta).toFixed(2)}`);
      if (!company.funding_info.market_cap && !company.funding_info.price_to_earnings && !company.funding_info.beta) {
        lines.push('- Not available');
      }
    } else {
      lines.push('- Not available');
    }
    lines.push('');

    lines.push('## Latest News Insights');
    if (filteredNews.length) {
      filteredNews.forEach((news) => {
        lines.push(`### ${news.title}`);
        lines.push(`- Date: ${news.formattedDate}`);
        lines.push(`- Category: ${formatCategoryLabel(news.category)}`);
        lines.push(`- Source: ${news.source}`);
        lines.push(`- Relevance: ${news.personalRelevance}/100 (${news.impactLevel})`);
        lines.push('');
        lines.push(news.summary || 'No summary provided.');
        if (news.keyPoints?.length) {
          lines.push('');
          lines.push('Key Points:');
          news.keyPoints.forEach((point) => lines.push(`- ${point}`));
        }
        lines.push('');
      });
    } else {
      lines.push('- No news items available.');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    setStatus('Research packet exported.');
    setTimeout(() => setStatus(''), 3000);
  };

  const generateMissingProfile = async () => {
    if (!job) return;
    setGeneratingProfile(true);
    setStatus('Generating missing company profile using AI...');
    try {
      const generated = await jobsAPI.generateCompanyProfile(id);
      // Merge generated fields into company and newsItems if returned
      if (generated) {
        setCompany((prev) => ({ ...(prev || {}), ...generated.company }));
        if (Array.isArray(generated.recent_news) && generated.recent_news.length) {
          const normalizedNews = (generated.recent_news || [])
            .map((item, index) => enrichNewsItem(item, job, index))
            .filter(Boolean);
          setNewsItems((prev) => {
            // merge unique by id
            const existingIds = new Set((prev || []).map((n) => n.id));
            const merged = [...(prev || [])];
            normalizedNews.forEach((n) => { if (!existingIds.has(n.id)) merged.push(n); });
            return merged;
          });
        }
        setStatus('Generated company profile — updated view.');
      }
    } catch (err) {
      const msg = err?.message || 'Failed to generate profile.';
      setError(msg);
      setStatus('');
    } finally {
      setGeneratingProfile(false);
      setTimeout(() => setStatus(''), 3000);
    }
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
              {company?.profile_overview || company?.description || 'Stay informed with curated news to personalize your outreach.'}
            </p>
          </div>
          <div className="insights-header-actions">
            <button
              className="btn-secondary export-button"
              onClick={handleExportResearch}
              disabled={!company}
            >
              <Icon name="download" size="sm" />
              Export Research
            </button>
          </div>
        </div>

        <div className="insights-detail-grid">
          <section className="insights-detail-card">
            <div className="insights-card-header">Mission & Values</div>
            {(() => {
              const mission = getCompanyMission(company);
              const values = getCompanyValues(company);
              return (
                <>
                  <p className="insights-card-body">
                    {mission || <span className="insights-card-empty">Mission not available</span>}
                  </p>
                  {values.length ? (
                    <ul className="insights-bullets">{values.map((value, idx) => <li key={`value-${idx}`}>{value}</li>)}</ul>
                  ) : (
                    <p className="insights-card-empty">Values not available</p>
                  )}
                </>
              );
            })()}
          </section>
          <section className="insights-detail-card">
            <div className="insights-card-header">Company History</div>
            {getCompanyHistory(company) ? (
              <p className="insights-card-body">{getCompanyHistory(company)}</p>
            ) : (
              <p className="insights-card-empty">Not available</p>
            )}
          </section>
        </div>

        <div className="insights-detail-grid insights-detail-grid--three">
          <section className="insights-detail-card">
            <div className="insights-card-header">Leadership</div>
            {(() => {
              const leadershipList = getLeadership(company);
              return leadershipList.length ? (
                <ul className="insights-list">{leadershipList.map((leader, idx) => (
                  <li key={`leader-${idx}`}>
                    <strong>{leader.name}</strong>{leader.title ? ` — ${leader.title}` : ''}
                  </li>
                ))}</ul>
              ) : (
                <p className="insights-card-empty">Not available</p>
              );
            })()}
          </section>
          <section className="insights-detail-card">
            <div className="insights-card-header">Products / Offerings</div>
            {(() => {
              const products = getProducts(company);
              return products.length ? (
                <ul className="insights-list">
                  {products.map((product, idx) => (
                    <li key={`product-${idx}`}>
                      <strong>{product.name}</strong>{product.description ? ` — ${product.description}` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="insights-card-empty">Not available</p>
              );
            })()}
          </section>
          <section className="insights-detail-card">
            <div className="insights-card-header">Tech Stack</div>
            {(() => {
              const stack = getTechStack(company);
              return stack.length ? (
                <div className="tech-stack-tags">
                  {stack.map((tech, idx) => (
                    <span key={`tech-${idx}`}>{tech}</span>
                  ))}
                </div>
              ) : (
                <p className="insights-card-empty">Not available</p>
              );
            })()}
          </section>
        </div>

        <div className="insights-detail-grid insights-detail-grid--three">
          <section className="insights-detail-card">
            <div className="insights-card-header">Competitive Landscape</div>
            {company?.competitive_landscape ? (
              <p className="insights-card-body">{company.competitive_landscape}</p>
            ) : (
              <p className="insights-card-empty">Not available</p>
            )}
            {(() => {
              const competitors = getCompetitorsList(company);
              return competitors.length ? (
                <ul className="insights-bullets">{competitors.map((name, idx) => <li key={`comp-${idx}`}>{name}</li>)}</ul>
              ) : null;
            })()}
          </section>
          <section className="insights-detail-card">
            <div className="insights-card-header">Funding / Market</div>
            {company?.funding_info ? (
              <ul className="insights-list insights-list--compact">
                {company.funding_info.market_cap ? (
                  <li><strong>Market cap</strong> {formatMarketCap(company.funding_info.market_cap)}</li>
                ) : null}
                {company.funding_info.price_to_earnings ? (
                  <li><strong>P/E</strong> {Number(company.funding_info.price_to_earnings).toFixed(2)}</li>
                ) : null}
                {company.funding_info.beta ? (
                  <li><strong>Beta</strong> {Number(company.funding_info.beta).toFixed(2)}</li>
                ) : null}
              </ul>
            ) : (
              <p className="insights-card-empty">Not available</p>
            )}
          </section>
          <section className="insights-detail-card">
            <div className="insights-card-header">Recent Developments</div>
            {(() => {
              const developments = getRecentDevelopments(company);
              return developments.length ? (
                <ul className="insights-list">
                  {developments.map((dev, idx) => (
                    <li key={`dev-${idx}`}>
                      <strong>{dev.title || dev.summary}</strong>
                      <div className="insights-list-meta">
                        <span>{formatDate(dev.date)}</span>
                        <span>{formatCategoryLabel(dev.category)}</span>
                      </div>
                      {dev.summary ? <p>{dev.summary}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="insights-card-empty">Not available</p>
              );
            })()}
          </section>
        </div>

        <div className="insights-detail-grid">
          <section className="insights-detail-card">
            <div className="insights-card-header">Strategic Initiatives</div>
            {(() => {
              const initiatives = getStrategicInitiatives(company);
              return initiatives.length ? (
                <ul className="insights-list">
                  {initiatives.map((item, idx) => (
                    <li key={`initiative-${idx}`}>
                      <strong>{item.title}</strong>
                      <div className="insights-list-meta">
                        <span>{formatDate(item.date)}</span>
                        <span>{formatCategoryLabel(item.category)}</span>
                      </div>
                      {item.summary ? <p>{item.summary}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="insights-card-empty">Not available</p>
              );
            })()}
          </section>
        </div>

        <div className="insights-detail-grid">
          <section className="insights-detail-card">
            <div className="insights-card-header">Talking Points</div>
            {(() => {
              const talkingPoints = getTalkingPointsList(company);
              return talkingPoints.length ? (
                <ul className="insights-bullets">{talkingPoints.map((point, idx) => <li key={`tp-${idx}`}>{point}</li>)}</ul>
              ) : (
                <p className="insights-card-empty">Not available</p>
              );
            })()}
          </section>
          <section className="insights-detail-card">
            <div className="insights-card-header">Intelligent Questions</div>
            {(() => {
              const questions = getInterviewQuestionList(company);
              return questions.length ? (
                <ul className="insights-bullets">{questions.map((question, idx) => <li key={`iq-${idx}`}>{question}</li>)}</ul>
              ) : (
                <p className="insights-card-empty">Not available</p>
              );
            })()}
          </section>
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

      {/* Follow feature removed: alerts are still available in the news list */}

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
  sanitizeNewsId,
  getSnippetTokens,
  escapeRegExp,
  hasNewsSnippet,
  stripNewsSnippet,
  PAGE_SIZE,
};

export default CompanyInsights;
