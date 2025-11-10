import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { jobsAPI, resumeAIAPI } from '../../../services/api';
import Icon from '../../../components/common/Icon';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import './AiResumeGenerator.css';

const RequiredMark = () => (
  <span className="required-star" aria-hidden="true">
    *
  </span>
);

const toneOptions = [
  { value: 'impact', label: 'Impact', hint: 'Lead with metrics & outcomes' },
  { value: 'technical', label: 'Technical', hint: 'Highlight architecture & tooling depth' },
  { value: 'leadership', label: 'Leadership', hint: 'Spotlight stakeholder and team impact' },
  { value: 'balanced', label: 'Balanced', hint: 'Blend collaboration, delivery, and metrics' },
];

const variationChoices = [1, 2, 3];
const EXPERIENCE_VARIATION_TARGET = 3;

const SECTION_IDS = ['summary', 'skills', 'experience', 'projects', 'education', 'keywords', 'preview'];
const rotateArray = (list = [], shift = 0) => {
  if (!list.length) return list;
  const offset = ((shift % list.length) + list.length) % list.length;
  if (offset === 0) return list;
  return [...list.slice(offset), ...list.slice(0, offset)];
};


const ACTION_VERB_LIBRARY = {
  default: ['Drove', 'Accelerated', 'Optimized', 'Championed', 'Delivered', 'Scaled'],
  software: ['Shipped', 'Refactored', 'Scaled', 'Automated', 'Instrumented', 'Hardened'],
  product: ['Launched', 'Prioritized', 'Roadmapped', 'Tested', 'Validated'],
  marketing: ['Amplified', 'Orchestrated', 'Positioned', 'Activated'],
  finance: ['Modeled', 'Audited', 'Forecasted', 'Balanced'],
  operations: ['Streamlined', 'Standardized', 'Systematized'],
  healthcare: ['Coordinated', 'Standardized', 'Improved compliance'],
  education: ['Facilitated', 'Designed curriculum for', 'Assessed'],
  sales: ['Negotiated', 'Accelerated', 'Expanded'],
};

const INDUSTRY_TERM_LIBRARY = {
  software: ['platform reliability', 'latency budgets', 'CI/CD health'],
  product: ['roadmap confidence', 'research-backed bets', 'launch criteria'],
  marketing: ['funnel efficiency', 'campaign lift', 'brand resonance'],
  finance: ['risk controls', 'audit readiness', 'portfolio hygiene'],
  operations: ['throughput', 'capacity planning', 'SLA adherence'],
  healthcare: ['clinical workflows', 'EMR compliance', 'patient safety'],
  education: ['learning outcomes', 'assessment rigor', 'curriculum alignment'],
  sales: ['pipeline velocity', 'win-rate uplift', 'account expansion'],
  default: ['cross-functional alignment', 'stakeholder visibility', 'measurable impact'],
};

const EXPERIENCE_TAILOR_CACHE_KEY = 'resumerocket_experience_tailor_v1';

const slugify = (value, fallback = 'entry') => {
  if (!value) return fallback;
  return value
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 48) || fallback;
};

const getIndustryBucket = (value = '') => {
  const normalized = value.toLowerCase();
  if (/software|engineer|developer|tech/.test(normalized)) return 'software';
  if (/product/.test(normalized)) return 'product';
  if (/marketing|brand|growth/.test(normalized)) return 'marketing';
  if (/finance|bank|account/.test(normalized)) return 'finance';
  if (/operation|supply|logistic/.test(normalized)) return 'operations';
  if (/health|med|clinic|pharma/.test(normalized)) return 'healthcare';
  if (/edu|school|learning/.test(normalized)) return 'education';
  if (/sales|revenue|bizdev|business development/.test(normalized)) return 'sales';
  return 'default';
};

const getExperienceGroupId = (exp = {}, fallbackIndex = 0) => {
  if (exp.source_experience_id) return `experience-${exp.source_experience_id}`;
  const slug = slugify(`${exp.role || 'experience'}-${exp.company || fallbackIndex}`);
  return `experience-${slug}-${fallbackIndex}`;
};

const getExperienceUniqueId = (exp = {}, fallbackIndex = 0) => {
  if (exp.source_experience_id) return `experience-${exp.source_experience_id}`;
  const slug = slugify(`${exp.role || 'role'}-${exp.company || fallbackIndex}`);
  return `experience-${slug}-${fallbackIndex}`;
};

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseYearRange = (dates) => {
  if (!dates) {
    return { startYear: null, endYear: null, ongoing: false };
  }
  const normalized = dates.toString();
  const matches = normalized.match(/(20\d{2}|19\d{2})/g) || [];
  const startYear = matches.length ? Number(matches[0]) : null;
  const ongoing = /present/i.test(normalized);
  const endYear = ongoing ? new Date().getFullYear() : matches.length > 1 ? Number(matches[1]) : startYear;
  return { startYear, endYear, ongoing };
};

const getBulletOrderKey = (sectionId, groupId) => `${sectionId}::${groupId}`;
const buildBulletKey = (sectionId, groupId, idx) => `${sectionId}::${groupId}::${idx}`;
const getOrderedBulletItems = (sectionId, groupId, items, bulletOrderOverrides) => {
  const orderKey = getBulletOrderKey(sectionId, groupId);
  const savedOrder = bulletOrderOverrides[orderKey];
  if (!savedOrder) return items;
  const map = new Map(items.map((item) => [item.key, item]));
  const ordered = [];
  savedOrder.forEach((key) => {
    if (map.has(key)) {
      ordered.push(map.get(key));
      map.delete(key);
    }
  });
  return [...ordered, ...Array.from(map.values())];
};

const rewriteSentence = (text = '') => {
  if (!text) return text;
  let sentence = text.trim();
  if (!sentence) return sentence;
  const replacements = [
    ['Led', 'Spearheaded'],
    ['Responsible for', 'Accountable for'],
    ['Worked on', 'Delivered'],
    ['Improved', 'Lifted'],
  ];
  replacements.forEach(([from, to]) => {
    const regex = new RegExp(`^${from}`, 'i');
    if (regex.test(sentence)) {
      sentence = sentence.replace(regex, to);
    }
  });
  return sentence.endsWith('.') ? sentence : `${sentence}.`;
};

const generateBulletRewrite = (text, jobTitle, companyName) => {
  const base = rewriteSentence(text);
  const context = jobTitle || companyName ? ` (${[jobTitle, companyName].filter(Boolean).join(' · ')})` : '';
  return `Refined${context}: ${base}`;
};

const normalizeBulletText = (text = '') => {
  const candidate = text == null ? '' : text;
  return candidate.toString().replace(/\*\*(.*?)\*\*/g, '$1');
};

const latexEscape = (text = '') =>
  normalizeBulletText(text)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([%#$&_{}])/g, '\\$1')
    .replace(/\^/g, '\\^{}')
    .replace(/~/g, '\\textasciitilde{}');

const buildItemizedLatex = (items = []) => {
  if (!items.length) return '';
  const lines = ['\\begin{itemize}'];
  items.forEach((item) => {
    lines.push(`  \\item ${latexEscape(item)}`);
  });
  lines.push('\\end{itemize}');
  return lines.join('\n');
};

const createDefaultSectionConfig = () => ({
  order: [...SECTION_IDS],
  visibility: SECTION_IDS.reduce((acc, id) => ({ ...acc, [id]: true }), {}),
  formatting: {
    summary: { style: 'paragraph' },
    skills: { style: 'pill' },
    experience: { density: 'detailed' },
    projects: { emphasis: 'impact' },
    education: { style: 'stacked' },
    keywords: { badgeStyle: 'neutral' },
    preview: { zoom: 'fit' },
  },
});

const ensureOrderIncludesAll = (order = []) => {
  const filtered = order.filter((id) => SECTION_IDS.includes(id));
  const missing = SECTION_IDS.filter((id) => !filtered.includes(id));
  return [...filtered, ...missing];
};

const mergeFormatting = (baseFormatting, nextFormatting = {}) =>
  SECTION_IDS.reduce((acc, id) => {
    acc[id] = { ...(baseFormatting[id] || {}), ...(nextFormatting[id] || {}) };
    return acc;
  }, {});

const hydrateSectionConfig = (incomingConfig = {}) => {
  const base = createDefaultSectionConfig();
  return {
    order: ensureOrderIncludesAll(incomingConfig.order || base.order),
    visibility: { ...base.visibility, ...(incomingConfig.visibility || {}) },
    formatting: mergeFormatting(base.formatting, incomingConfig.formatting || {}),
  };
};

const sectionTemplates = [
  {
    id: 'balanced',
    label: 'Balanced ATS',
    description: 'Skills + Experience ordered for general full-time roles.',
    config: createDefaultSectionConfig(),
  },
  {
    id: 'projectSpotlight',
    label: 'Project spotlight',
    description: 'Showcase high-impact projects before work experience.',
    config: {
      order: ['summary', 'projects', 'experience', 'skills', 'education', 'keywords'],
      visibility: { education: false },
      formatting: {
        projects: { emphasis: 'technical' },
        experience: { density: 'compact' },
      },
    },
  },
  {
    id: 'academic',
    label: 'Academic / early career',
    description: 'Lead with education achievements and capstone work.',
    config: {
      order: ['summary', 'education', 'projects', 'experience', 'skills', 'keywords'],
      formatting: {
        education: { style: 'inline' },
        summary: { style: 'bullet' },
      },
    },
  },
  {
    id: 'skillsFirst',
    label: 'Skills-first consulting',
    description: 'Prioritize core skill blocks before experience.',
    config: {
      order: ['summary', 'skills', 'keywords', 'experience', 'projects', 'education'],
      visibility: { education: false },
      formatting: {
        skills: { style: 'list' },
        keywords: { badgeStyle: 'accent' },
      },
    },
  },
];

const jobTypeTemplateMap = {
  internship: 'projectSpotlight',
  intern: 'projectSpotlight',
  contractor: 'skillsFirst',
  contract: 'skillsFirst',
  freelance: 'skillsFirst',
  consultant: 'skillsFirst',
  consulting: 'skillsFirst',
  part_time: 'balanced',
  parttime: 'balanced',
  full_time: 'balanced',
  fulltime: 'balanced',
};

const resumeSectionMeta = {
  summary: {
    label: 'Summary & Tone',
    icon: 'file-text',
    description: 'Lead statement with tone guidance.',
    formatOptions: [
      {
        field: 'style',
        label: 'Presentation',
        options: [
          { value: 'paragraph', label: 'Narrative paragraph' },
          { value: 'bullet', label: 'Bullet highlights' },
        ],
      },
    ],
  },
  skills: {
    label: 'Skills',
    icon: 'sparkles',
    description: 'Top highlighted skills for this role.',
    formatOptions: [
      {
        field: 'style',
        label: 'Badge style',
        options: [
          { value: 'pill', label: 'Pills (default)' },
          { value: 'list', label: 'Compact list' },
        ],
      },
    ],
  },
  experience: {
    label: 'Experience',
    icon: 'briefcase',
    description: 'Role-specific achievements to spotlight.',
    formatOptions: [
      {
        field: 'density',
        label: 'Detail level',
        options: [
          { value: 'detailed', label: 'Detailed (all bullets)' },
          { value: 'compact', label: 'Compact (top bullet only)' },
        ],
      },
    ],
  },
  projects: {
    label: 'Projects',
    icon: 'project',
    description: 'Internal or personal initiatives.',
    formatOptions: [
      {
        field: 'emphasis',
        label: 'Emphasis',
        options: [
          { value: 'impact', label: 'Impact narrative' },
          { value: 'technical', label: 'Technical deep-dive' },
        ],
      },
    ],
  },
  education: {
    label: 'Education',
    icon: 'education',
    description: 'Degrees, certifications, and notable coursework.',
    formatOptions: [
      {
        field: 'style',
        label: 'Layout',
        options: [
          { value: 'stacked', label: 'Stacked' },
          { value: 'inline', label: 'Inline summary' },
        ],
      },
    ],
  },
  keywords: {
    label: 'ATS Keywords',
    icon: 'filter',
    description: 'Exact phrase matches the AI is reinforcing.',
    formatOptions: [
      {
        field: 'badgeStyle',
        label: 'Badge color',
        options: [
          { value: 'neutral', label: 'Neutral blue' },
          { value: 'accent', label: 'Accent green' },
        ],
      },
    ],
  },
  preview: {
    label: 'PDF Preview',
    icon: 'eye',
    description: 'Inline PDF reader of the generated resume.',
    formatOptions: [
      {
        field: 'zoom',
        label: 'Fit mode',
        options: [
          { value: 'fit', label: 'Fit to width' },
          { value: 'fill', label: 'Fill height' },
        ],
      },
    ],
  },
};

const resolveSectionStatus = (sectionId, { variation, analysis, pdfPreviewUrl }) => {
  switch (sectionId) {
    case 'summary':
      if (!variation) return 'pending';
      if (variation.summary) return 'complete';
      if (variation.summary_headline) return 'partial';
      return 'empty';
    case 'skills':
      return chipify(variation?.skills_to_highlight).length > 0 ? 'complete' : 'empty';
    case 'experience':
      return variation?.experience_sections?.length ? 'complete' : 'empty';
    case 'projects':
      return variation?.project_sections?.length ? 'complete' : 'empty';
    case 'education':
      return variation?.education_highlights?.length ? 'complete' : 'partial';
    case 'keywords': {
      const keywords = chipify(variation?.ats_keywords || analysis?.keyword_strategy);
      if (keywords.length > 0) return 'complete';
      return analysis?.keyword_strategy ? 'partial' : 'empty';
    }
    case 'preview':
      return pdfPreviewUrl ? 'complete' : variation?.pdf_document ? 'pending' : 'empty';
    default:
      return 'pending';
  }
};

const sectionStatusCopy = {
  complete: 'Ready',
  partial: 'Needs details',
  empty: 'No content yet',
  pending: 'Waiting on AI',
};

const SortableSectionRow = ({
  sectionId,
  meta,
  isVisible,
  status,
  statusLabel,
  onToggle,
  expanded,
  onExpandToggle,
  formatting,
  onFormatChange,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sectionId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className={`section-row ${isDragging ? 'dragging' : ''}`}
      style={style}
    >
      <button
        type="button"
        className="drag-handle"
        aria-label={`Reorder ${meta.label}`}
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" size="sm" />
      </button>
      <div className="section-row-content">
        <div className="section-row-header">
          <div className="section-row-title">
            <Icon name={meta.icon} size="sm" />
            <div>
              <strong>{meta.label}</strong>
              <p>{meta.description}</p>
            </div>
          </div>
          <div className="section-row-tags">
            <span className={`section-status-pill ${status}`}>{statusLabel}</span>
            <label className="section-toggle">
              <input type="checkbox" checked={isVisible} onChange={() => onToggle(sectionId)} />
              <span>{isVisible ? 'Visible' : 'Hidden'}</span>
            </label>
          </div>
        </div>
        {meta.formatOptions?.length > 0 && (
          <div className="section-row-format">
            <button type="button" className="format-toggle" onClick={() => onExpandToggle(sectionId)}>
              <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size="sm" />
              <span>Formatting</span>
            </button>
          </div>
        )}
        {expanded && meta.formatOptions?.length > 0 && (
          <div className="formatting-controls">
            {meta.formatOptions.map((option) => (
              <label key={`${sectionId}-${option.field}`}>
                <span>{option.label}</span>
                <select
                  value={formatting?.[option.field] || option.options[0].value}
                  onChange={(e) => onFormatChange(sectionId, option.field, e.target.value)}
                >
                  {option.options.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const PreviewSectionBlock = ({
  sectionId,
  meta,
  onToggleCollapse,
  isCollapsed,
  isVisible,
  onToggleVisibility,
  children,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sectionId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`preview-section-block ${isDragging ? 'dragging' : ''} ${isCollapsed ? 'collapsed' : ''} ${!isVisible ? 'hidden-section' : ''}`}
    >
      <div className="preview-section-toolbar">
        <button
          type="button"
          className="drag-handle"
          aria-label={`Reorder ${meta.label} in preview`}
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" size="sm" />
        </button>
        <div className="preview-section-info">
          <strong>{meta.label}</strong>
          <small>{meta.description}</small>
        </div>
        <div className="preview-section-actions">
          <label className="section-visibility-toggle">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={() => onToggleVisibility(sectionId)}
            />
            <span>{isVisible ? 'Include' : 'Exclude'}</span>
          </label>
          <button type="button" onClick={() => onToggleCollapse(sectionId)}>
            <Icon name={isCollapsed ? 'chevronDown' : 'chevronUp'} size="sm" /> {isCollapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
      </div>
      {!isCollapsed && children}
    </div>
  );
};

const SortableBulletList = ({
  sectionId,
  groupId,
  items,
  bulletOrderOverrides,
  setBulletOrderOverrides,
  bulletOverrides,
  onBulletOverride,
}) => {
  const orderedItems = useMemo(
    () => getOrderedBulletItems(sectionId, groupId, items, bulletOrderOverrides),
    [sectionId, groupId, items, bulletOrderOverrides],
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentOrder = orderedItems.map((item) => item.key);
    const oldIndex = currentOrder.indexOf(active.id);
    const newIndex = currentOrder.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const nextOrder = arrayMove(currentOrder, oldIndex, newIndex);
    setBulletOrderOverrides((prev) => ({
      ...prev,
      [getBulletOrderKey(sectionId, groupId)]: nextOrder,
    }));
  };

  if (!orderedItems.length) return null;

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedItems.map((item) => item.key)} strategy={verticalListSortingStrategy}>
        <div className="bullet-list">
          {orderedItems.map((item) => (
            <SortableBulletItem
              key={item.key}
              itemKey={item.key}
              text={bulletOverrides[item.key] ?? item.text}
              originalText={item.text}
              onManualSave={(value) => onBulletOverride(item.key, value)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

const SortableBulletItem = ({ itemKey, text, originalText, onManualSave }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: itemKey });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  useEffect(() => {
    setDraft(text);
  }, [text]);

  return (
    <div ref={setNodeRef} style={style} className={`bullet-row ${isDragging ? 'dragging' : ''}`}>
      <button
        type="button"
        className="bullet-drag-handle"
        aria-label="Reorder bullet"
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" size="sm" />
      </button>
      <div className="bullet-content">
        {editing ? (
          <div className="bullet-edit-form">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="bullet-edit-actions">
              <button type="button" onClick={() => { onManualSave(draft); setEditing(false); }}>
                <Icon name="check" size="sm" /> Save
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setDraft(text);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p>{text}</p>
        )}
      </div>
      <div className="bullet-actions">
        <button type="button" onClick={() => setEditing((prev) => !prev)}>
          <Icon name="edit" size="sm" /> {editing ? 'Close' : 'Edit'}
        </button>
      </div>
    </div>
  );
};

const sanitizeText = (value) => {
  if (value === null || value === undefined) return '';
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

const chipify = (items) =>
  (items || [])
    .map((item) => sanitizeText(item))
    .filter(Boolean);

const buildTerminologySuggestions = (industryBucket, keywords = []) => {
  const base = INDUSTRY_TERM_LIBRARY[industryBucket] || INDUSTRY_TERM_LIBRARY.default;
  const normalizedKeywords = keywords.slice(0, 4).map((keyword) => keyword?.toLowerCase()).filter(Boolean);
  const merged = [...new Set([...normalizedKeywords, ...base])];
  return merged.slice(0, 5).map((term) => term.replace(/\b([a-z])/g, (match) => match.toUpperCase()));
};

const computeRelevanceScore = (experience = {}, keywords = []) => {
  if (!experience) return 50;
  const haystack = `${experience.role || ''} ${experience.company || ''} ${(experience.bullets || []).join(' ')}`.toLowerCase();
  if (!haystack.trim()) return 45;
  const trimmedKeywords = keywords.slice(0, 8).map((keyword) => keyword.toLowerCase());
  const matches = new Set();
  trimmedKeywords.forEach((keyword) => {
    if (keyword && haystack.includes(keyword)) {
      matches.add(keyword);
    }
  });
  const keywordFactor = trimmedKeywords.length ? matches.size / Math.min(trimmedKeywords.length, 6) : 0.4;
  const metricFactor = (experience.bullets || []).some((bullet) => /\d/.test(bullet)) ? 0.25 : 0;
  const score = Math.round((0.55 * keywordFactor + metricFactor + 0.25) * 100);
  return Math.max(35, Math.min(100, score));
};

const computeMetricCoverage = (bullets = []) => {
  if (!bullets.length) return 0;
  const numeric = bullets.filter((bullet) => /\d/.test(bullet)).length;
  return Math.round((numeric / bullets.length) * 100);
};

const buildExperienceInsight = (experience = {}, idx = 0, jobContext = {}) => {
  const keywords = chipify(jobContext.keywords || []);
  const industryBucket = getIndustryBucket(jobContext.industry || jobContext.jobTitle || '');
  const experienceId = getExperienceUniqueId(experience, idx);
  const groupId = getExperienceGroupId(experience, idx);
  const chronology = parseYearRange(experience.dates);
  const relevanceScore = computeRelevanceScore(experience, keywords);
  const metricCoverage = computeMetricCoverage(experience.bullets);
  const actionVerbs = (ACTION_VERB_LIBRARY[industryBucket] || ACTION_VERB_LIBRARY.default).slice(0, 3);
  const terminology = buildTerminologySuggestions(industryBucket, keywords);
  return {
    experience,
    experienceId,
    groupId,
    variations: [],
    chronology: { ...chronology, label: experience.dates || 'Timeline TBD' },
    relevanceScore,
    metricCoverage,
    actionVerbs,
    terminology,
  };
};

export const ExperienceTailoringLab = ({
  experiences = [],
  jobContext = {},
  selectedJobId = '',
  onApply,
  onSave,
  onDeleteSaved,
  savedVariants = {},
  onApplySaved,
  onNotify,
  externalVariations = {},
  isLoading = false,
  loadingError = '',
  onRegenerateBullet,
  regeneratingBullet = null,
}) => {
  const insights = useMemo(
    () => experiences.map((experience, idx) => buildExperienceInsight(experience, idx, jobContext)),
    [experiences, jobContext],
  );
  const [selectedVariants, setSelectedVariants] = useState({});
  useEffect(() => {
    setSelectedVariants((prev) => {
      const next = {};
      insights.forEach((insight) => {
        const experienceKey = insight.experienceId;
        const serverEntry =
          externalVariations[experienceKey] ||
          externalVariations[insight.experience?.source_experience_id];
        const fallbackId = `profile-${experienceKey}`;
        const defaultVariant = serverEntry?.variations?.[0]?.id || fallbackId;
        next[experienceKey] = prev[experienceKey] || defaultVariant;
      });
      return next;
    });
  }, [insights, externalVariations]);

  const savedList = useMemo(() => {
    return Object.entries(savedVariants || {})
      .flatMap(([experienceId, versions = []]) =>
        versions.map((entry) => ({ ...entry, experienceId })),
      )
      .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
  }, [savedVariants]);

  if (!insights.length) return null;

  const keywords = chipify(jobContext.keywords || []);

  const handleApply = (insight, variant) => {
    if (!variant?.bullets?.length) {
      onNotify?.('No tailored bullets available yet.');
      return;
    }
    onApply?.(insight.experience, variant, insight);
  };

  const handleSave = (insight, variant) => {
    if (!selectedJobId) {
      onNotify?.('Select a job to save tailored versions.');
      return;
    }
    if (!variant?.bullets?.length) {
      onNotify?.('Generate a variation before saving.');
      return;
    }
    onSave?.(insight, variant);
  };

  const handleVariationChange = (experienceId, variantId) => {
    setSelectedVariants((prev) => ({ ...prev, [experienceId]: variantId }));
  };

  return (
    <section className="ai-resume-card experience-tailor-lab">
      <div className="tailor-header">
        <div>
          <h2>Fine-tune your work experience for this job</h2>
          <p className="customizer-subtitle">
            Compare AI-authored variations for each role, reinforce metrics, and apply the most relevant bullets directly into the resume preview.
          </p>
        </div>
      </div>
      {isLoading && <p className="placeholder">Generating Gemini rewrites for each experience…</p>}
      {loadingError && <p className="inline-error">{loadingError}</p>}
      {isLoading && <p className="placeholder">Generating Gemini rewrites for each experience…</p>}
      {loadingError && <p className="inline-error">{loadingError}</p>}

      <div className="tailor-context-grid">
        <div className="context-card">
          <strong>Target company</strong>
          <p>{sanitizeText(jobContext.company) || '—'}</p>
        </div>
        <div className="context-card">
          <strong>Keywords emphasized</strong>
          {keywords.length ? (
            <div className="chip-row compact">
              {keywords.slice(0, 6).map((keyword) => (
                <span key={`keyword-${keyword}`} className="chip">
                  {keyword}
                </span>
              ))}
            </div>
          ) : (
            <p className="placeholder">Job keywords will appear after selecting a job posting.</p>
          )}
        </div>
        <div className="context-card timeline-card">
          <strong>Chronological timeline</strong>
          <div className="experience-timeline" aria-label="Experience timeline">
            {insights.map((insight, idx) => (
              <div key={insight.experienceId} className="timeline-item">
                <span className="timeline-dot" />
                <div>
                  <p>{insight.experience.role || `Experience ${idx + 1}`}</p>
                  <small>{insight.chronology.label}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="experience-tailor-list">
        {insights.map((insight) => {
          const experienceKey = insight.experienceId;
          const sourceId = insight.experience?.source_experience_id;
          console.log('[ExperienceTailoringLab] Looking up variations:', {
            experienceKey,
            sourceId,
            hasKeyLookup: !!externalVariations[experienceKey],
            hasSourceLookup: !!externalVariations[sourceId],
            allKeys: Object.keys(externalVariations),
          });
          const serverEntry =
            externalVariations[experienceKey] ||
            externalVariations[sourceId] ||
            externalVariations[`experience-${sourceId}`];
          const serverVariations = serverEntry?.variations;
          const fallbackVariantId = `profile-${experienceKey}`;
          const fallbackVariant = {
            id: fallbackVariantId,
            label: 'Profile bullets',
            description: 'Bullets pulled directly from your saved experience.',
            bullets: insight.experience.bullets || [],
          };
          const variationList = [
            ...(fallbackVariant.bullets.length ? [fallbackVariant] : []),
            ...(serverVariations?.length ? serverVariations : []),
          ];
          const hasVariants = variationList.length > 0;
          const selectedVariantId = hasVariants
            ? selectedVariants[experienceKey] || variationList[0]?.id
            : '';
          const currentVariant = hasVariants
            ? variationList.find((variant) => variant.id === selectedVariantId) || variationList[0]
            : null;
          const serverVariantIds = new Set((serverVariations || []).map((variant) => variant.id));
          const isServerVariant = currentVariant ? serverVariantIds.has(currentVariant.id) : false;
          const canRegenerate = Boolean(onRegenerateBullet && isServerVariant);
          const showLoadingState = isLoading && !serverVariations?.length;
          const scoreClass = insight.relevanceScore >= 75 ? 'high' : insight.relevanceScore >= 55 ? 'medium' : 'low';
          return (
            <article key={insight.experienceId} className="experience-tailor-card">
              <header>
                <div>
                  <h4>{insight.experience.role}</h4>
                  <p>{insight.experience.company}</p>
                  <small>{insight.chronology.label}</small>
                </div>
                <div className="relevance-pill-wrapper">
                  <span className={`relevance-pill ${scoreClass}`}>{insight.relevanceScore}% match</span>
                  <div className="relevance-bar">
                    <span style={{ width: `${insight.relevanceScore}%` }} />
                  </div>
                  <small>Metric coverage: {insight.metricCoverage}%</small>
                </div>
              </header>

              {hasVariants ? (
                <div className="variation-tabs-row">
                  {variationList.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      className={variant.id === selectedVariantId ? 'active' : ''}
                      onClick={() => handleVariationChange(insight.experienceId, variant.id)}
                    >
                      <span>{variant.label}</span>
                      <small>{variant.tags?.length ? variant.tags.join(' · ') : 'Profile source'}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="variation-tabs-row">
                  <p className="placeholder">Add at least one bullet to unlock tailored variations.</p>
                </div>
              )}

              <div className="variation-body">
                <p>
                  {currentVariant?.description ||
                    (serverVariations?.length
                      ? 'Gemini variation'
                      : fallbackVariant.bullets.length
                        ? 'Bullets from your saved profile.'
                        : 'Provide achievements so tailoring can begin.')}
                </p>
                {showLoadingState ? (
                  <p className="placeholder">Fetching tailored bullets…</p>
                ) : currentVariant?.bullets?.length ? (
                  <ul>
                    {currentVariant.bullets.map((bullet, idx) => {
                      const isRegenerating =
                        regeneratingBullet &&
                        regeneratingBullet.experienceId === insight.experienceId &&
                        regeneratingBullet.variantId === currentVariant?.id &&
                        regeneratingBullet.bulletIndex === idx;
                      const displayBullet = normalizeBulletText(bullet);
                      return (
                        <li key={`${currentVariant.id}-${idx}`} className="bullet-with-action">
                          <span>{displayBullet}</span>
                          {canRegenerate && (
                            <button
                              type="button"
                              className="ghost regen-button"
                              onClick={() => onRegenerateBullet(insight.experienceId, currentVariant.id, idx)}
                              disabled={isRegenerating}
                              title="Regenerate this bullet"
                            >
                              <Icon name="refresh" size={12} className="regen-icon" />
                              <span>Regenerate</span>
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="placeholder">This experience is missing bullet points. Add bullets to enable tailoring.</p>
                )}
              </div>

              <div className="experience-tailor-actions">
                <button type="button" className="primary" onClick={() => handleApply(insight, currentVariant)}>
                  <Icon name="sparkles" size="sm" /> Apply to resume preview
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={!selectedJobId || !currentVariant?.bullets?.length}
                  onClick={() => handleSave(insight, currentVariant)}
                >
                  <Icon name="clipboard" size="sm" /> Save tailored version
                </button>
              </div>

              <div className="suggestion-row">
                <div>
                  <strong>Action verbs to try</strong>
                  <div className="chip-row compact">
                    {insight.actionVerbs.map((verb) => (
                      <span key={`verb-${verb}`} className="chip neutral">
                        {verb}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <strong>Industry terminology</strong>
                  <div className="chip-row compact">
                    {insight.terminology.map((term) => (
                      <span key={`term-${term}`} className="chip accent">
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {savedList.length > 0 && (
        <div className="saved-tailored-panel">
          <div className="saved-header">
            <h3>Saved tailored versions</h3>
            <p>Reuse previously approved bullets for this job without regenerating content.</p>
          </div>
          <div className="saved-list">
            {savedList.map((entry) => (
              <div key={entry.id} className="saved-row">
                <div>
                  <strong>
                    {entry.role}
                    <span> · {entry.company}</span>
                  </strong>
                  <p>{entry.label}</p>
                  <small>Saved {formatDate(entry.savedAt)} · {entry.relevanceScore}% match</small>
                </div>
                <div className="saved-actions">
                  <button type="button" onClick={() => onApplySaved?.(entry.experienceId, entry)}>
                    <Icon name="sparkles" size="sm" /> Apply
                  </button>
                  <button type="button" className="ghost" onClick={() => onDeleteSaved?.(entry.experienceId, entry.id)}>
                    <Icon name="trash" size="sm" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

const generationHints = [
  'Analyzing the job description and keywords…',
  'Matching verified achievements from your profile…',
  'Authoring succinct ATS-ready bullet points…',
];

const CACHE_KEY = 'resumerocket_ai_resume_cache';
const CACHE_VERSION = 2;

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
  const [sectionConfig, setSectionConfig] = useState(() => hydrateSectionConfig());
  const [layoutSource, setLayoutSource] = useState({
    type: 'template',
    id: 'balanced',
    label: 'Balanced ATS',
  });
  const [hasManualSectionOverrides, setHasManualSectionOverrides] = useState(false);
  const [expandedSectionId, setExpandedSectionId] = useState('');
  const [lastAutoJobType, setLastAutoJobType] = useState('');
  const [layoutHint, setLayoutHint] = useState('');
  const [sectionRewrites, setSectionRewrites] = useState({});
  const [bulletOverrides, setBulletOverrides] = useState({});
  const [bulletOrderOverrides, setBulletOrderOverrides] = useState({});
  const [collapsedSections, setCollapsedSections] = useState({});
  const [latexCopied, setLatexCopied] = useState(false);
  const [livePreviewPdfUrl, setLivePreviewPdfUrl] = useState('');
  const [livePreviewLoading, setLivePreviewLoading] = useState(false);
  const [livePreviewError, setLivePreviewError] = useState('');
  const [experienceVariations, setExperienceVariations] = useState({});
  const [experienceVariationsLoading, setExperienceVariationsLoading] = useState(false);
  const [experienceVariationsError, setExperienceVariationsError] = useState('');
  const [regeneratingBullet, setRegeneratingBullet] = useState(null);
  const [savedExperienceVersions, setSavedExperienceVersions] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem(EXPERIENCE_TAILOR_CACHE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  
  // Template management state
  const [customTemplates, setCustomTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('resumerocket_custom_templates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  const variationSectionRef = useRef(null);
  const pdfUrlRef = useRef('');
  const livePreviewPdfRef = useRef('');

  const applyLayoutConfig = useCallback((config, sourceMeta) => {
    setSectionConfig(hydrateSectionConfig(config));
    setLayoutSource(sourceMeta);
    setHasManualSectionOverrides(sourceMeta?.type === 'custom');
  }, []);

  const markLayoutCustom = useCallback(() => {
    setHasManualSectionOverrides(true);
    setLayoutSource((prev) => (prev.type === 'custom' ? prev : { type: 'custom', id: '', label: 'Custom layout' }));
  }, []);

  // Load cached result on mount
  useEffect(() => {
    const cached = loadCachedResult();
    if (cached) {
      setResult(cached.result);
      setSelectedJobId(cached.selectedJobId || '');
      setActiveVariationId(cached.activeVariationId || cached.result?.variations?.[0]?.id || '');
      setTone(cached.tone || 'balanced');
      setVariationCount(cached.variationCount || 2);
      if (cached.sectionConfig) {
        setSectionConfig(hydrateSectionConfig(cached.sectionConfig));
      }
      if (cached.layoutSource) {
        setLayoutSource(cached.layoutSource);
        setHasManualSectionOverrides(cached.layoutSource?.type === 'custom');
      }
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
        sectionConfig,
        layoutSource,
      });
    }
  }, [result, selectedJobId, activeVariationId, tone, variationCount, sectionConfig, layoutSource]);

  useEffect(() => {
    if (!layoutHint) return undefined;
    const timeout = setTimeout(() => setLayoutHint(''), 4200);
    return () => clearTimeout(timeout);
  }, [layoutHint]);

  useEffect(() => {
    setCollapsedSections((prev) => {
      const next = {};
      sectionConfig.order.forEach((id) => {
        if (prev[id]) next[id] = true;
      });
      return next;
    });
  }, [sectionConfig.order]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(EXPERIENCE_TAILOR_CACHE_KEY, JSON.stringify(savedExperienceVersions));
    } catch {
      // ignore storage failures
    }
  }, [savedExperienceVersions]);

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

  useEffect(() => {
    const jobTypeValue = sanitizeText(selectedJobDetail?.job_type);
    if (!jobTypeValue) return undefined;
    const normalized = jobTypeValue.toLowerCase().replace(/\s+/g, '_');
    const templateId = jobTypeTemplateMap[normalized];
    if (!templateId) return undefined;
    if (hasManualSectionOverrides) return undefined;
    if (lastAutoJobType === normalized && layoutSource.id === templateId) return undefined;
    const template = sectionTemplates.find((tpl) => tpl.id === templateId);
    if (!template) return undefined;
    applyLayoutConfig(template.config, {
      type: 'template',
      id: template.id,
      label: template.label,
    });
    setLastAutoJobType(normalized);
    setLayoutHint(`Applied ${template.label} layout for ${jobTypeValue} roles`);
    return undefined;
  }, [
    selectedJobDetail?.job_type,
    hasManualSectionOverrides,
    lastAutoJobType,
    layoutSource.id,
    applyLayoutConfig,
  ]);

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
    console.log('[ExperienceVariations] useEffect triggered:', {
      selectedJobId,
      hasActiveVariation: !!activeVariation,
      experienceSections: activeVariation?.experience_sections,
      experienceCount: activeVariation?.experience_sections?.length
    });
    
    if (!selectedJobId || !activeVariation) {
      console.log('[ExperienceVariations] Skipping - no job or variation');
      setExperienceVariations({});
      setExperienceVariationsError('');
      return;
    }
    const experiences = (activeVariation.experience_sections || [])
      .filter((exp) => exp.source_experience_id);
    console.log('[ExperienceVariations] Filtered experiences:', {
      total: activeVariation.experience_sections?.length,
      withSourceId: experiences.length,
      experiences: experiences.map(exp => ({
        source_experience_id: exp.source_experience_id,
        role: exp.role,
        company: exp.company
      }))
    });
    
    if (!experiences.length) {
      console.log('[ExperienceVariations] Skipping - no experiences with source_experience_id');
      setExperienceVariations({});
      setExperienceVariationsError('');
      return;
    }

    let cancelled = false;

    const loadExperienceVariations = async () => {
      console.log('[ExperienceVariations] Starting to load variations for experiences:', experiences.map(e => e.source_experience_id));
      setExperienceVariationsLoading(true);
      setExperienceVariationsError('');
      try {
        console.log('[ExperienceVariations] Making API calls...');
        const results = await Promise.all(
          experiences.map(async (exp, idx) => {
            console.log(`[ExperienceVariations] Calling API for experience ${idx}:`, exp.source_experience_id);
            try {
              const result = await resumeAIAPI.generateExperienceVariations(selectedJobId, exp.source_experience_id, {
                tone,
                variation_count: EXPERIENCE_VARIATION_TARGET,
              });
              console.log(`[ExperienceVariations] API call ${idx} completed:`, result);
              return result;
            } catch (err) {
              console.error(`[ExperienceVariations] API call ${idx} failed:`, err);
              throw err;
            }
          }),
        );
        console.log('[ExperienceVariations] All API calls completed');
        if (cancelled) return;
        console.log('[ExperienceVariations] Raw API results:', results);
        const map = {};
        results.forEach((entry, idx) => {
          console.log(`[ExperienceVariations] Processing result ${idx}:`, {
            experience_id: entry?.experience_id,
            variations_count: entry?.variations?.length,
            entry
          });
          if (entry?.experience_id) {
            const key = `experience-${entry.experience_id}`;
            map[entry.experience_id] = entry;
            map[key] = entry;
            console.log(`[ExperienceVariations] Stored variation with keys: ${entry.experience_id} and ${key}`);
          }
        });
        console.log('[ExperienceVariations] Final map keys:', Object.keys(map));
        console.log('[ExperienceVariations] Loaded variations:', { experiences: experiences.length, results: results.length, map });
        setExperienceVariations(map);
      } catch (err) {
        console.error('[ExperienceVariations] Error loading variations:', err);
        if (!cancelled) {
          setExperienceVariationsError(err?.message || 'Unable to fetch tailored variations.');
        }
      } finally {
        if (!cancelled) {
          setExperienceVariationsLoading(false);
        }
      }
    };

    loadExperienceVariations();

    return () => {
      cancelled = true;
      setExperienceVariationsLoading(false);
    };
  }, [selectedJobId, activeVariation, tone]);

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
      if (livePreviewPdfRef.current) {
        URL.revokeObjectURL(livePreviewPdfRef.current);
      }
    },
    [],
  );

  const handleSectionDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSectionConfig((prev) => {
      const oldIndex = prev.order.indexOf(active.id);
      const newIndex = prev.order.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) {
        return prev;
      }
      return {
        ...prev,
        order: arrayMove(prev.order, oldIndex, newIndex),
      };
    });
    markLayoutCustom();
  };

  const handleSectionToggle = (sectionId) => {
    let updated = false;
    setSectionConfig((prev) => {
      const currentlyVisible = !!prev.visibility[sectionId];
      if (currentlyVisible) {
        const otherVisible = SECTION_IDS.filter((id) => id !== sectionId && prev.visibility[id]);
        if (otherVisible.length === 0) {
          setLayoutHint('Keep at least one section visible.');
          return prev;
        }
      }
      updated = true;
      return {
        ...prev,
        visibility: {
          ...prev.visibility,
          [sectionId]: !currentlyVisible,
        },
      };
    });
    if (updated) {
      markLayoutCustom();
    }
  };

  const handleFormattingChange = (sectionId, field, value) => {
    setSectionConfig((prev) => ({
      ...prev,
      formatting: {
        ...prev.formatting,
        [sectionId]: {
          ...(prev.formatting[sectionId] || {}),
          [field]: value,
        },
      },
    }));
    markLayoutCustom();
  };

  const handleResetLayout = () => {
    applyLayoutConfig(createDefaultSectionConfig(), {
      type: 'template',
      id: 'balanced',
      label: 'Balanced ATS',
    });
    setLastAutoJobType('');
    setLayoutHint('Restored balanced default layout');
  };

  const handleApplyRecommendedTemplate = () => {
    const jobTypeValue = sanitizeText(selectedJobDetail?.job_type);
    if (!jobTypeValue) return;
    const normalized = jobTypeValue.toLowerCase().replace(/\s+/g, '_');
    const templateId = jobTypeTemplateMap[normalized];
    if (!templateId) return;
    const template = sectionTemplates.find((tpl) => tpl.id === templateId);
    if (!template) return;
    applyLayoutConfig(template.config, { type: 'template', id: template.id, label: template.label });
    setLastAutoJobType(normalized);
    setLayoutHint(`Applied ${template.label} layout for ${jobTypeValue}`);
  };

  const toggleExpandedSection = (sectionId) => {
    setExpandedSectionId((prev) => (prev === sectionId ? '' : sectionId));
  };

  const handleSectionRewriteAction = (sectionId, action) => {
    setSectionRewrites((prev) => ({
      ...prev,
      [sectionId]: {
        regenerate: action === 'regenerate' ? (prev[sectionId]?.regenerate || 0) + 1 : prev[sectionId]?.regenerate || 0,
      },
    }));
    setLayoutHint(`Regenerated ${resumeSectionMeta[sectionId]?.label || 'section'}`);
  };

  const handleSectionRegenerate = (sectionId) => handleSectionRewriteAction(sectionId, 'regenerate');

  const handlePreviewSectionDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSectionConfig((prev) => {
      const visibleIds = prev.order.filter((id) => prev.visibility[id]);
      const oldIndex = visibleIds.indexOf(active.id);
      const newIndex = visibleIds.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reorderedVisible = arrayMove(visibleIds, oldIndex, newIndex);
      const queue = [...reorderedVisible];
      const nextOrder = prev.order.map((id) => (prev.visibility[id] ? queue.shift() : id));
      return {
        ...prev,
        order: nextOrder,
      };
    });
    markLayoutCustom();
  };

  const handleBulletOverride = (bulletKey, newValue) => {
    setBulletOverrides((prev) => ({
      ...prev,
      [bulletKey]: newValue,
    }));
  };

  const applyTailoredBulletsToExperience = (experience, tailoredBullets = []) => {
    if (!experience) return;
    const experiencesList = activeVariation?.experience_sections || [];
    const fallbackIndex = Math.max(0, experiencesList.indexOf(experience));
    const groupId = getExperienceGroupId(experience, fallbackIndex);
    const baseBullets = experience.bullets || [];
    const nextBullets = tailoredBullets?.length ? tailoredBullets : baseBullets;
    baseBullets.forEach((original, idx) => {
      const bulletKey = buildBulletKey('experience', groupId, idx);
      handleBulletOverride(bulletKey, nextBullets[idx] || original);
    });
  };

  const handleApplyExperienceVariant = (experience, variant) => {
    if (!experience || !variant) return;
    applyTailoredBulletsToExperience(experience, variant.bullets);
    setLayoutHint(`Applied ${variant.label} variation to ${experience.role || 'experience'}`);
  };

  const handleSaveExperienceVariant = (insight, variant) => {
    if (!insight || !variant || !selectedJobId) return;
    setSavedExperienceVersions((prev) => {
      const jobEntry = prev[selectedJobId] || {};
      const existing = jobEntry[insight.experienceId] || [];
      const nextVersion = {
        id: `tailored_${Date.now()}`,
        label: variant.label,
        variationId: variant.id,
        bullets: variant.bullets,
        savedAt: new Date().toISOString(),
        role: insight.experience.role,
        company: insight.experience.company,
        relevanceScore: insight.relevanceScore,
      };
      const nextJobEntry = {
        ...jobEntry,
        [insight.experienceId]: [nextVersion, ...existing].slice(0, 5),
      };
      return {
        ...prev,
        [selectedJobId]: nextJobEntry,
      };
    });
    setLayoutHint(`Saved ${variant.label} for ${insight.experience.role || 'experience'}`);
  };

  const handleRegenerateBullet = async (experienceId, variantId, bulletIndex) => {
    if (!selectedJobId) return;
    setRegeneratingBullet({ experienceId, variantId, bulletIndex });
    try {
      // Extract numeric ID from "experience-X" format
      const numericId = experienceId.startsWith('experience-') 
        ? experienceId.split('-')[1] 
        : experienceId;
      
      const payload = await resumeAIAPI.regenerateExperienceBullet(selectedJobId, numericId, {
        tone,
        variant_id: variantId,
        bullet_index: bulletIndex,
      });
      const nextBullet = payload?.bullet;
      if (nextBullet) {
        setExperienceVariations((prev) => {
          const entry = prev[experienceId];
          if (!entry) return prev;
          const nextVariations = entry.variations.map((variant) => {
            if (variant.id !== variantId) return variant;
            const updatedBullets = variant.bullets.map((text, idx) => (idx === bulletIndex ? nextBullet : text));
            return { ...variant, bullets: updatedBullets };
          });
          return {
            ...prev,
            [experienceId]: {
              ...entry,
              variations: nextVariations,
            },
          };
        });
        setLayoutHint('Regenerated a tailored bullet with Gemini.');
      }
    } catch (err) {
      setLayoutHint(err?.message || 'Unable to regenerate bullet.');
    } finally {
      setRegeneratingBullet(null);
    }
  };

  const handleDeleteSavedExperienceVariant = (experienceId, versionId) => {
    if (!selectedJobId) return;
    setSavedExperienceVersions((prev) => {
      const jobEntry = prev[selectedJobId];
      if (!jobEntry || !jobEntry[experienceId]) return prev;
      const remaining = jobEntry[experienceId].filter((entry) => entry.id !== versionId);
      if (remaining.length === jobEntry[experienceId].length) return prev;
      const nextJobEntry = { ...jobEntry };
      if (remaining.length) {
        nextJobEntry[experienceId] = remaining;
      } else {
        delete nextJobEntry[experienceId];
      }
      const nextState = { ...prev };
      if (Object.keys(nextJobEntry).length) {
        nextState[selectedJobId] = nextJobEntry;
      } else {
        delete nextState[selectedJobId];
      }
      return nextState;
    });
    setLayoutHint('Removed saved tailored version');
  };

  const handleApplySavedExperienceVariant = (experienceId, version) => {
    if (!version) return;
    const experiencesList = activeVariation?.experience_sections || [];
    const target = experiencesList.find((experience, idx) => getExperienceUniqueId(experience, idx) === experienceId);
    if (!target) {
      setLayoutHint('Saved experience is not part of this variation.');
      return;
    }
    applyTailoredBulletsToExperience(target, version.bullets);
    setLayoutHint(`Applied saved version “${version.label}”.`);
  };

  const handleBulletRegenerate = (sectionId, bulletKey, originalText) => {
    const suggestion = generateBulletRewrite(
      originalText,
      sanitizeText(result?.job?.title),
      sanitizeText(result?.job?.company_name),
    );
    handleBulletOverride(bulletKey, suggestion);
    setLayoutHint(`Regenerated bullet in ${resumeSectionMeta[sectionId]?.label || 'section'}`);
  };

  const handleSectionCollapseToggle = (sectionId) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleCollapseAll = (shouldCollapse) => {
    setCollapsedSections((prev) => {
      const next = { ...prev };
      visibleSections.forEach((id) => {
        next[id] = shouldCollapse;
      });
      return next;
    });
  };

  const handleApplyTemplate = (template) => {
    applyLayoutConfig(template.config, {
      type: template.type || 'template',
      id: template.id,
      label: template.label,
    });
    setLayoutHint(`Applied ${template.label} template`);
  };

  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) {
      setLayoutHint('Please enter a template name');
      return;
    }
    
    const newTemplate = {
      id: `custom_${Date.now()}`,
      label: newTemplateName.trim(),
      description: 'Custom template',
      type: 'custom',
      config: {
        order: [...sectionConfig.order],
        visibility: { ...sectionConfig.visibility },
        formatting: { ...sectionConfig.formatting },
      },
    };
    
    const updated = [...customTemplates, newTemplate];
    setCustomTemplates(updated);
    localStorage.setItem('resumerocket_custom_templates', JSON.stringify(updated));
    setNewTemplateName('');
    setShowSaveTemplateDialog(false);
    setLayoutHint(`Saved template "${newTemplate.label}"`);
  };

  const handleDeleteTemplate = (templateId) => {
    const updated = customTemplates.filter(t => t.id !== templateId);
    setCustomTemplates(updated);
    localStorage.setItem('resumerocket_custom_templates', JSON.stringify(updated));
    setLayoutHint('Template deleted');
  };

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
    applyLayoutConfig(createDefaultSectionConfig(), {
      type: 'template',
      id: 'balanced',
      label: 'Balanced ATS',
    });
    setExpandedSectionId('');
    setLayoutHint('');
    setLastAutoJobType('');
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
    
    // Generate filename from profile name
    let filename = 'resume.tex';
    if (result?.profile?.name) {
      const name = result.profile.name.trim();
      const nameParts = name.split(/\s+/);
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        filename = `${firstName}_${lastName}_Resume.tex`;
      } else {
        // If only one name part, use it
        filename = `${name.replace(/\s+/g, '_')}_Resume.tex`;
      }
    }
    
    const blob = new Blob([variation.latex_document], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = (variation) => {
    if (!variation?.pdf_document) return;
    
    // Generate filename from profile name
    let filename = 'resume.pdf';
    if (result?.profile?.name) {
      const name = result.profile.name.trim();
      const nameParts = name.split(/\s+/);
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        filename = `${firstName}_${lastName}_Resume.pdf`;
      } else {
        // If only one name part, use it
        filename = `${name.replace(/\s+/g, '_')}_Resume.pdf`;
      }
    }
    
    try {
      const byteCharacters = window.atob(variation.pdf_document);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i += 1) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      setGenerationError('Failed to download PDF. Please try again.');
    }
  };

  const jobKeywords = chipify(
    result?.job?.derived_keywords ||
      result?.shared_analysis?.keyword_strategy ||
      selectedJobDetail?.derived_keywords,
  );
  const analysis = result?.shared_analysis || {};
  const profile = result?.profile;
  const activeHint = generating ? generationHints[hintIndex] : '';
  const jobTypeSource = sanitizeText(selectedJobDetail?.job_type);
  const normalizedJobType = (jobTypeSource || '').toLowerCase().replace(/\s+/g, '_');
  const jobTitle = sanitizeText(selectedJobDetail?.title);
  const jobCompanyName = sanitizeText(selectedJobDetail?.company_name);
  const jobLocation = sanitizeText(selectedJobDetail?.location);
  const jobIndustry = sanitizeText(selectedJobDetail?.industry);
  const jobDescription = sanitizeText(selectedJobDetail?.description);
  const jobTypeDisplay = jobTypeSource ? jobTypeSource.toUpperCase() : '';
  const resultJobTitle = sanitizeText(result?.job?.title) || 'target role';
  const resultJobCompany = sanitizeText(result?.job?.company_name) || 'this company';
  const recommendedTemplateId = jobTypeTemplateMap[normalizedJobType];
  const recommendedTemplate = useMemo(
    () => sectionTemplates.find((tpl) => tpl.id === recommendedTemplateId),
    [recommendedTemplateId],
  );
  const allSections = useMemo(
    () => sectionConfig.order,
    [sectionConfig],
  );
  const visibleSections = useMemo(
    () => sectionConfig.order.filter((sectionId) => sectionConfig.visibility[sectionId]),
    [sectionConfig],
  );
  const allVisibleCollapsed = allSections.length > 0 && allSections.every((id) => collapsedSections[id]);
  const sectionStatuses = useMemo(() => {
    const context = { variation: activeVariation, analysis, pdfPreviewUrl };
    return SECTION_IDS.reduce((acc, id) => {
      acc[id] = resolveSectionStatus(id, context);
      return acc;
    }, {});
  }, [activeVariation, analysis, pdfPreviewUrl]);

  const sectionSnapshots = useMemo(() => {
    if (!activeVariation) return {};
    const map = {};
    visibleSections.forEach((sectionId) => {
      map[sectionId] = buildSectionSnapshot(sectionId);
    });
    return map;
  }, [
    activeVariation,
    visibleSections,
    sectionConfig,
    bulletOverrides,
    bulletOrderOverrides,
    sectionRewrites,
    analysis,
    pdfPreviewUrl,
  ]);

  const renderSectionById = (sectionId) => sectionSnapshots[sectionId]?.jsx || null;

  const liveLatexPreview = useMemo(() => {
    if (!activeVariation) return '% Generate a resume to view the LaTeX preview.';
    
    // Build a custom LaTeX document that reflects user changes
    if (!activeVariation.latex_document) {
      return '% LaTeX document will be available after generation.';
    }
    
    // Parse the original latex document to extract the header (template)
    const originalLatex = activeVariation.latex_document;
    
    // Extract everything up to and including \begin{document}
    const headerMatch = originalLatex.match(/([\s\S]*?\\begin\{document\})/);
    if (!headerMatch) {
      return originalLatex; // Fallback to original if we can't parse it
    }
    
    const header = headerMatch[1];
    const lines = [header.trim()];
    lines.push('');
    
    // Build contact header from the result profile data
    if (result?.profile) {
      const profile = result.profile;
      const name = latexEscape(profile.name || 'Candidate');
      const contactBits = [];
      
      if (profile.contact?.phone) contactBits.push(latexEscape(profile.contact.phone));
      if (profile.contact?.email) {
        const email = profile.contact.email;
        contactBits.push(`\\href{mailto:${email}}{\\underline{${latexEscape(email)}}}`);
      }
      if (profile.contact?.portfolio_url) {
        const url = profile.contact.portfolio_url;
        contactBits.push(`\\href{${url}}{\\underline{Portfolio}}`);
      }
      
      const location = profile.location || profile.contact?.location;
      if (location) contactBits.unshift(latexEscape(location));
      
      lines.push('\\begin{center}');
      lines.push(`    \\textbf{\\Huge \\scshape ${name}} \\\\ \\vspace{1pt}`);
      if (contactBits.length) {
        lines.push(`    {\\small ${contactBits.join(' $|$ ')} }`);
      }
      lines.push('\\end{center}');
      lines.push('');
    }
    
    // Map section IDs to proper LaTeX section rendering
    visibleSections.forEach((sectionId) => {
      switch (sectionId) {
        case 'summary': {
          const summary = activeVariation.summary;
          if (summary) {
            lines.push('\\section{Summary}');
            lines.push('\\resumeSubHeadingListStart');
            const summaryHeadline = activeVariation.summary_headline;
            let summaryBody = latexEscape(summary);
            if (summaryHeadline) {
              summaryBody = `\\textbf{${latexEscape(summaryHeadline)}} -- ${summaryBody}`;
            }
            lines.push(`\\resumeItem{${summaryBody}}`);
            lines.push('\\resumeSubHeadingListEnd');
            lines.push('');
          }
          break;
        }
        case 'education': {
          const education = activeVariation.education_highlights || [];
          if (education.length > 0) {
            const educationGroupId = 'education-main';
            const bulletItems = education.map((edu, idx) => ({
              key: buildBulletKey('education', educationGroupId, idx),
              text: bulletOverrides[buildBulletKey('education', educationGroupId, idx)] ?? edu.notes,
            }));
            
            const orderedBullets = getOrderedBulletItems('education', educationGroupId, bulletItems, bulletOrderOverrides);
            
            lines.push('\\section{Education}');
            lines.push('\\resumeSubHeadingListStart');
            orderedBullets.forEach((item, idx) => {
              lines.push(`\\resumeItem{${latexEscape(item.text || '')}}`);
              // Add negative vertical space between items to reduce gaps
              if (idx < orderedBullets.length - 1) {
                lines.push('\\vspace{-2pt}');
              }
            });
            lines.push('\\resumeSubHeadingListEnd');
            lines.push('');
          }
          break;
        }
        case 'experience': {
          const experiences = activeVariation.experience_sections || [];
          const density = sectionConfig.formatting.experience?.density || 'detailed';
          if (experiences.length > 0) {
            lines.push('\\section{Experience}');
            lines.push('\\resumeSubHeadingListStart');
            experiences.slice(0, 5).forEach((exp, idx) => {
              const role = latexEscape(exp.role || '');
              const company = latexEscape(exp.company || '');
              const location = latexEscape(exp.location || '');
              const dates = latexEscape(exp.dates || '');
              
              lines.push(`\\resumeSubheading{${role}}{${dates}}{${company}}{${location}}`);
              
              const bullets = density === 'compact' ? (exp.bullets || []).slice(0, 1) : (exp.bullets || []);
              const groupId = getExperienceGroupId(exp, idx);
              const bulletItems = bullets.map((bullet, bulletIdx) => {
                const key = buildBulletKey('experience', groupId, bulletIdx);
                return {
                  key,
                  text: bulletOverrides[key] ?? bullet,
                };
              });
              
              const ordered = getOrderedBulletItems('experience', groupId, bulletItems, bulletOrderOverrides);
              
              if (ordered.length > 0) {
                lines.push('\\resumeItemListStart');
                ordered.forEach((item) => {
                  lines.push(`\\resumeItem{${latexEscape(item.text)}}`);
                });
                lines.push('\\resumeItemListEnd');
              }
            });
            lines.push('\\resumeSubHeadingListEnd');
            lines.push('');
          }
          break;
        }
        case 'projects': {
          const projects = activeVariation.project_sections || [];
          if (projects.length > 0) {
            lines.push('\\section{Projects}');
            lines.push('\\resumeSubHeadingListStart');
            projects.slice(0, 2).forEach((proj) => {
              const name = latexEscape(proj.name || '');
              const dates = latexEscape(proj.dates || '');
              lines.push(`\\resumeProjectHeading{\\textbf{${name}}}{${dates}}`);
              
              const groupId = proj.source_project_id || proj.name;
              const bulletItems = (proj.bullets || []).map((bullet, idx) => {
                const key = buildBulletKey('projects', groupId, idx);
                return {
                  key,
                  text: bulletOverrides[key] ?? bullet,
                };
              });
              
              const ordered = getOrderedBulletItems('projects', groupId, bulletItems, bulletOrderOverrides);
              
              if (ordered.length > 0) {
                lines.push('\\resumeItemListStart');
                ordered.slice(0, 3).forEach((item) => {
                  lines.push(`\\resumeItem{${latexEscape(item.text)}}`);
                });
                lines.push('\\resumeItemListEnd');
              }
            });
            lines.push('\\resumeSubHeadingListEnd');
            lines.push('');
          }
          break;
        }
        case 'skills': {
          const skills = chipify(activeVariation.skills_to_highlight);
          if (skills.length > 0) {
            lines.push('\\section{Technical Skills}');
            lines.push('\\begin{itemize}[leftmargin=0.15in, label={}]');
            lines.push('    \\small{\\item{');
            lines.push(`     \\textbf{Skills}{: ${skills.map(latexEscape).join(', ')}} \\\\`);
            lines.push('    }}');
            lines.push('\\end{itemize}');
            lines.push('');
          }
          break;
        }
        default:
          // Skip sections like keywords and preview
          break;
      }
    });
    
    lines.push('\\end{document}');
    
    return lines.join('\n');
  }, [activeVariation, visibleSections, bulletOrderOverrides, bulletOverrides, sectionConfig, result]);

  const handleCopyLiveLatex = async () => {
    if (!liveLatexPreview) return;
    try {
      await navigator.clipboard.writeText(liveLatexPreview);
      setLatexCopied(true);
      setTimeout(() => setLatexCopied(false), 1600);
    } catch (err) {
      setLayoutHint(err?.message || 'Unable to copy LaTeX preview.');
    }
  };

  const compileLivePreview = async () => {
    if (!activeVariation || !liveLatexPreview) return;
    
    setLivePreviewLoading(true);
    setLivePreviewError('');
    
    try {
      const data = await resumeAIAPI.compileLatex(liveLatexPreview);
      
      if (data.pdf_document) {
        // Convert base64 to blob and create URL
        const byteCharacters = window.atob(data.pdf_document);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i += 1) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const newUrl = URL.createObjectURL(blob);
        
        // Clean up old URL
        if (livePreviewPdfRef.current) {
          URL.revokeObjectURL(livePreviewPdfRef.current);
        }
        
        livePreviewPdfRef.current = newUrl;
        setLivePreviewPdfUrl(newUrl);
      }
    } catch (err) {
      console.error('Failed to compile live preview:', err);
      setLivePreviewError(err?.message || 'Unable to compile LaTeX preview');
    } finally {
      setLivePreviewLoading(false);
    }
  };

  // Auto-compile when liveLatexPreview changes
  useEffect(() => {
    if (!liveLatexPreview || 
        liveLatexPreview.includes('% Generate a resume') || 
        liveLatexPreview.includes('% LaTeX document will be available') ||
        liveLatexPreview.includes('% No visible sections')) {
      setLivePreviewPdfUrl('');
      return;
    }

    // Debounce the compilation
    const timeoutId = setTimeout(() => {
      compileLivePreview();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [liveLatexPreview]);

  function buildSectionSnapshot(sectionId) {
    if (!activeVariation) return { jsx: null, latex: '' };
    const rewriteState = sectionRewrites[sectionId] || {};
    switch (sectionId) {
      case 'summary': {
        const summaryStyle = sectionConfig.formatting.summary?.style || 'paragraph';
        const summaryHeadline = activeVariation.summary_headline || activeVariation.label;
        const regenCount = rewriteState.regenerate || 0;
        let summaryBody = activeVariation.summary || '';
        if (regenCount > 0) {
          const sentences = summaryBody
            .split(/(?<=[.!?])\s+/)
            .map((entry) => entry.trim())
            .filter(Boolean);
          if (sentences.length > 1) {
            summaryBody = rotateArray(sentences, regenCount).join(' ');
          } else {
            const emphasisList = [
              analysis.job_focus_summary,
              analysis.skill_match_notes,
              activeVariation.summary_headline,
              'Tailored highlight for this role',
            ].filter(Boolean);
            summaryBody = `${rotateArray(emphasisList, regenCount)[0] || emphasisList[0] || ''} ${summaryBody}`.trim();
          }
        }
        const bulletItems = summaryBody
          .split(/\n|•/)
          .map((entry) => entry.trim())
          .filter(Boolean);
        const summaryGroupId = 'main';
        let summaryBulletItems = bulletItems.map((line, idx) => ({
          key: buildBulletKey('summary', summaryGroupId, idx),
          text: line,
        }));
        if (summaryStyle === 'bullet' && regenCount > 0) {
          summaryBulletItems = rotateArray(summaryBulletItems, regenCount);
        }
        const jsx = (
          <section key="summary" className="resume-section card summary-block">
            <h4>Summary & tone</h4>
            {summaryHeadline && <p className="summary-headline">{summaryHeadline}</p>}
            {summaryStyle === 'bullet' ? (
              summaryBulletItems.length ? (
                <SortableBulletList
                  sectionId="summary"
                  groupId={summaryGroupId}
                  items={summaryBulletItems}
                  bulletOrderOverrides={bulletOrderOverrides}
                  setBulletOrderOverrides={setBulletOrderOverrides}
                  bulletOverrides={bulletOverrides}
                  onBulletOverride={handleBulletOverride}
                />
              ) : (
                <p className="placeholder">Summary details will appear here.</p>
              )
            ) : (
              <p>{summaryBody || 'Summary details will appear here.'}</p>
            )}
          </section>
        );
        const latexLines = ['\\section*{Summary & Tone}'];
        if (summaryStyle === 'bullet' && summaryBulletItems.length) {
          latexLines.push(buildItemizedLatex(summaryBulletItems.map((item) => item.text)));
        } else if (summaryBody) {
          latexLines.push(latexEscape(summaryBody));
        }
        return { jsx, latex: latexLines.filter(Boolean).join('\n') };
      }
      case 'skills': {
        let skills = chipify(activeVariation.skills_to_highlight);
        if (rewriteState.regenerate) {
          skills = rotateArray(skills, rewriteState.regenerate);
        }
        const style = sectionConfig.formatting.skills?.style || 'pill';
        const jsx = (
          <section key="skills" className="resume-section card">
            <h4>Key skills for this role</h4>
            {skills.length ? (
              style === 'list' ? (
                <ul className="skills-list">
                  {skills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              ) : (
                <div className="skill-badges">
                  {skills.map((skill) => (
                    <span key={skill} className="skill-pill">
                      {skill}
                    </span>
                  ))}
                </div>
              )
            ) : (
              <p className="placeholder">No highlighted skills yet.</p>
            )}
          </section>
        );
        const latexLines = ['\\section*{Key Skills for this Role}'];
        if (skills.length) {
          latexLines.push(buildItemizedLatex(skills));
        }
        return { jsx, latex: latexLines.filter(Boolean).join('\n') };
      }
      case 'experience': {
        const density = sectionConfig.formatting.experience?.density || 'detailed';
        let experiences = activeVariation.experience_sections || [];
        if (rewriteState.regenerate) {
          experiences = rotateArray(experiences, rewriteState.regenerate);
        }
        const jsx = (
          <section key="experience" className="resume-section card">
            <h4>Experiences to spotlight</h4>
            {experiences.length ? (
              <ol className={`experience-list ${density === 'compact' ? 'compact' : ''}`}>
                {experiences.map((exp, idx) => {
                  const bullets = density === 'compact' ? (exp.bullets || []).slice(0, 1) : exp.bullets;
                  const groupId = getExperienceGroupId(exp, idx);
                  const experienceKey = getExperienceUniqueId(exp, idx);
                  const bulletItems = (bullets || []).map((bullet, bulletIdx) => {
                    const key = buildBulletKey('experience', groupId, bulletIdx);
                    return {
                      key,
                      text: bulletOverrides[key] ?? bullet,
                    };
                  });
                  return (
                    <li key={experienceKey}>
                      <div className="experience-card">
                        <div className="experience-header">
                          <span className="experience-rank">#{idx + 1}</span>
                          <div>
                            <strong>{exp.role}</strong>
                            <span>{exp.company}</span>
                            <small>
                              {exp.location || ' Remote'} · {exp.dates}
                            </small>
                          </div>
                        </div>
                        {bulletItems?.length ? (
                          <SortableBulletList
                            sectionId="experience"
                            groupId={groupId}
                            items={bulletItems}
                            bulletOrderOverrides={bulletOrderOverrides}
                            setBulletOrderOverrides={setBulletOrderOverrides}
                            bulletOverrides={bulletOverrides}
                            onBulletOverride={handleBulletOverride}
                          />
                        ) : (
                          <p className="placeholder">No bullet points provided for this role yet.</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="placeholder">No experience sections available yet.</p>
            )}
          </section>
        );
        const latexLines = ['\\section*{Experience Highlights}'];
        experiences.forEach((exp, idx) => {
          const bullets = density === 'compact' ? (exp.bullets || []).slice(0, 1) : exp.bullets;
          const groupId = getExperienceGroupId(exp, idx);
          const bulletItems = (bullets || []).map((bullet, bulletIdx) => {
            const key = buildBulletKey('experience', groupId, bulletIdx);
            return {
              key,
              text: bulletOverrides[key] ?? bullet,
            };
          });
          const ordered = getOrderedBulletItems('experience', groupId, bulletItems, bulletOrderOverrides);
          latexLines.push(`\\subsection*{${latexEscape(exp.role || 'Experience')}}`);
          const metaParts = [exp.company, exp.location, exp.dates].filter(Boolean).map(latexEscape);
          if (metaParts.length) {
            latexLines.push(metaParts.join(' \\textbullet{} '));
          }
          if (ordered.length) {
            latexLines.push(buildItemizedLatex(ordered.map((item) => item.text)));
          }
        });
        return { jsx, latex: latexLines.filter(Boolean).join('\n') };
      }
      case 'projects': {
        const emphasis = sectionConfig.formatting.projects?.emphasis || 'impact';
        let projects = activeVariation.project_sections || [];
        if (rewriteState.regenerate) {
          projects = rotateArray(projects, rewriteState.regenerate);
        }
        const jsx = (
          <section key="projects" className="resume-section card">
            <h4>Projects & initiatives</h4>
            {projects.length ? (
              <div className="experience-grid projects">
                {projects.map((proj) => {
                  const groupId = proj.source_project_id || proj.name;
                  const bulletItems = (proj.bullets || []).map((bullet, idx) => {
                    const key = buildBulletKey('projects', groupId, idx);
                    return {
                      key,
                      text: bulletOverrides[key] ?? bullet,
                    };
                  });
                  return (
                    <div
                      key={`${proj.source_project_id}-${proj.name}`}
                      className={`experience-card project ${emphasis === 'technical' ? 'technical' : ''}`}
                    >
                      <div className="experience-header">
                        <strong>{proj.name}</strong>
                        <small>{proj.notes || 'Project highlight'}</small>
                      </div>
                      {emphasis === 'technical' && <span className="format-tag">Technical focus</span>}
                      {bulletItems.length ? (
                        <SortableBulletList
                          sectionId="projects"
                          groupId={groupId}
                          items={bulletItems}
                          bulletOrderOverrides={bulletOrderOverrides}
                          setBulletOrderOverrides={setBulletOrderOverrides}
                          bulletOverrides={bulletOverrides}
                          onBulletOverride={handleBulletOverride}
                        />
                      ) : (
                        <p className="placeholder">Add a few talking points for this project.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="placeholder">No project sections were generated for this variation.</p>
            )}
          </section>
        );
        const latexLines = ['\\section*{Projects & Initiatives}'];
        projects.forEach((proj) => {
          const groupId = proj.source_project_id || proj.name;
          const bulletItems = (proj.bullets || []).map((bullet, idx) => {
            const key = buildBulletKey('projects', groupId, idx);
            return {
              key,
              text: bulletOverrides[key] ?? bullet,
            };
          });
          const ordered = getOrderedBulletItems('projects', groupId, bulletItems, bulletOrderOverrides);
          latexLines.push(`\\subsection*{${latexEscape(proj.name || 'Project')}}`);
          if (proj.notes) {
            latexLines.push(`\\textit{${latexEscape(proj.notes)}}`);
          }
          if (ordered.length) {
            latexLines.push(buildItemizedLatex(ordered.map((item) => item.text)));
          }
        });
        return { jsx, latex: latexLines.filter(Boolean).join('\n') };
      }
      case 'education': {
        let education = activeVariation.education_highlights || [];
        if (rewriteState.regenerate) {
          education = rotateArray(education, rewriteState.regenerate);
        }
        
        // Convert education to bullet format similar to experience
        const educationGroupId = 'education-main';
        const bulletItems = education.map((edu, idx) => ({
          key: buildBulletKey('education', educationGroupId, idx),
          text: bulletOverrides[buildBulletKey('education', educationGroupId, idx)] ?? edu.notes,
        }));
        
        const jsx = (
          <section key="education" className="resume-section card">
            <h4>Education</h4>
            {bulletItems.length ? (
              <SortableBulletList
                sectionId="education"
                groupId={educationGroupId}
                items={bulletItems}
                bulletOrderOverrides={bulletOrderOverrides}
                setBulletOrderOverrides={setBulletOrderOverrides}
                bulletOverrides={bulletOverrides}
                onBulletOverride={handleBulletOverride}
              />
            ) : (
              <p className="placeholder">Education history is not included in this variation.</p>
            )}
          </section>
        );
        
        const orderedBullets = getOrderedBulletItems('education', educationGroupId, bulletItems, bulletOrderOverrides);
        const latex = orderedBullets.length
          ? [
              '\\section*{Education}',
              '\\begin{itemize}',
              ...orderedBullets.map((item) => `  \\item ${latexEscape(item.text || '')}`),
              '\\end{itemize}',
            ].join('\n')
          : '\\section*{Education}';
        return { jsx, latex };
      }
      case 'keywords': {
        let keywords = chipify(activeVariation.ats_keywords || analysis.keyword_strategy);
        if (rewriteState.regenerate) {
          keywords = rotateArray(keywords, rewriteState.regenerate);
        }
        const badgeStyle = sectionConfig.formatting.keywords?.badgeStyle || 'neutral';
        const jsx = (
          <section key="keywords" className="resume-section card">
            <h4>ATS keywords</h4>
            {keywords.length ? (
              <div className="chip-row">
                {keywords.map((keyword) => (
                  <span
                    key={`keyword-${keyword}`}
                    className={`chip ${badgeStyle === 'accent' ? 'accent' : 'neutral'}`}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            ) : (
              <p className="placeholder">No keyword recommendations yet.</p>
            )}
          </section>
        );
        const latexLines = ['\\section*{ATS Keywords}'];
        if (keywords.length) {
          latexLines.push(`\\textit{${latexEscape(keywords.join(', '))}}`);
        }
        return { jsx, latex: latexLines.filter(Boolean).join('\n') };
      }
      default:
          return { jsx: null, latex: '' };
      }
  }

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
            <label htmlFor="job-select">
              Select job <RequiredMark />
            </label>
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
                  aria-required="true"
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
              <h2>{jobTitle || 'Choose a job to preview details'}</h2>
              {jobCompanyName && <p className="company-line">{jobCompanyName}</p>}
            </div>
            {jobDetailLoading && <LoadingSpinner size="sm" />}
          </header>
          {selectedJobDetail ? (
            <>
              <dl className="meta-grid">
                <div>
                  <dt>Location</dt>
                  <dd>{jobLocation || 'Remote / TBD'}</dd>
                </div>
                <div>
                  <dt>Job Type</dt>
                  <dd>{jobTypeDisplay || '—'}</dd>
                </div>
                <div>
                  <dt>Industry</dt>
                  <dd>{jobIndustry || '—'}</dd>
                </div>
                <div>
                  <dt>Deadline</dt>
                  <dd>{formatDate(selectedJobDetail.application_deadline)}</dd>
                </div>
              </dl>
              <article className="job-description">
                <h3>Key requirements</h3>
                <p>{jobDescription || 'No job description provided yet.'}</p>
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
                How your profile maps to “{resultJobTitle}” at {resultJobCompany}
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
            <div className="variation-tabs-bar">
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

            </div>
            <div className="preview-and-tools">
              <aside className="ai-resume-card preview-panel">
                <h3>Live PDF preview</h3>
                <p className="hint">
                  Reflects your current section order, visibility, formatting, and bullet edits.
                </p>
                {livePreviewLoading && (
                  <div className="live-preview-loading">
                    <LoadingSpinner size="sm" /> Compiling preview...
                  </div>
                )}
                {livePreviewError && (
                  <p className="inline-error">{livePreviewError}</p>
                )}
                {livePreviewPdfUrl ? (
                  <div className="pdf-frame-wrapper live-preview">
                    <iframe
                      src={`${livePreviewPdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                      title="Live Resume PDF preview"
                      className="pdf-preview-frame"
                    />
                  </div>
                ) : !livePreviewLoading && !activeVariation ? (
                  <p className="placeholder">Generate a resume to enable the live preview.</p>
                ) : !livePreviewLoading && (
                  <p className="placeholder">Adjust sections to see the preview update.</p>
                )}
                <div className="latex-column-actions">
                  <button
                    type="button"
                    className="ghost"
                    onClick={handleCopyLiveLatex}
                    disabled={!activeVariation}
                  >
                    <Icon name={latexCopied ? 'check' : 'clipboard'} size="sm" />{' '}
                    {latexCopied ? 'Copied LaTeX' : 'Copy LaTeX source'}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={compileLivePreview}
                    disabled={!activeVariation || livePreviewLoading}
                  >
                    <Icon name="refresh" size="sm" /> Refresh preview
                  </button>
                </div>
              </aside>
              <div className="customization-column">
                <section className="ai-resume-card section-customizer">
                <div className="customizer-header">
                  <div className="layout-panel-heading">
                    <p className="eyebrow">Resume layout</p>
                    <h2>Customize section arrangements</h2>
                    <p className="customizer-subtitle">
                      Toggle sections on/off, drag to reorder, adjust formatting, and watch the LaTeX preview
                      update instantly while you fine-tune each section.
                    </p>
                  </div>
                  <div className="layout-meta">
                    <span className="layout-name-chip">
                      {layoutSource.type === 'custom' ? 'Custom layout' : layoutSource.label}
                    </span>
                    <button type="button" className="ghost" onClick={handleResetLayout}>
                      <Icon name="refresh" size="sm" /> Restore defaults
                    </button>
                  </div>
                </div>
                {layoutHint && (
                  <p className="layout-hint" aria-live="polite">
                    {layoutHint}
                  </p>
                )}
                {jobTypeSource && recommendedTemplate && (
                  <div className="jobtype-hint">
                    <Icon name="briefcase" size="sm" />
                    <div>
                      <strong>{jobTypeSource}</strong>
                      <p>
                        We recommend the {recommendedTemplate.label} layout for this job type so the
                        preview emphasizes the most relevant sections.
                      </p>
                    </div>
                    <button type="button" onClick={handleApplyRecommendedTemplate}>
                      Apply recommendation
                    </button>
                  </div>
                )}
              </section>

              {activeVariation && (
                <article className="ai-resume-card variation-card">
                  <header>
                    <div className="variation-action-stack">
                      <button type="button" onClick={() => handleDownloadPdf(activeVariation)}>
                        <Icon name="download" size="sm" /> Download PDF
                      </button>
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
                      <button
                        type="button"
                        className="collapse-toggle"
                        onClick={() => handleCollapseAll(!allVisibleCollapsed)}
                        disabled={!visibleSections.length}
                      >
                        <Icon name={allVisibleCollapsed ? 'chevronDown' : 'chevronUp'} size="sm" />{' '}
                        {allVisibleCollapsed ? 'Expand sections' : 'Collapse sections'}
                      </button>
                    </div>

                    <div className="template-manager">
                      <div className="template-controls">
                        <div className="template-select-group">
                          <label htmlFor="template-select">
                            <Icon name="layout" size="sm" /> Section arrangement template
                          </label>
                          <select
                            id="template-select"
                            value=""
                            onChange={(e) => {
                              const templateId = e.target.value;
                              const allTemplates = [...sectionTemplates, ...customTemplates];
                              const template = allTemplates.find((t) => t.id === templateId);
                              if (template) {
                                handleApplyTemplate(template);
                              }
                              e.target.value = '';
                            }}
                          >
                            <option value="">— Select a template —</option>
                            <optgroup label="Built-in Templates">
                              {sectionTemplates.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.label}
                                </option>
                              ))}
                            </optgroup>
                            {customTemplates.length > 0 && (
                              <optgroup label="My Templates">
                                {customTemplates.map((template) => (
                                  <option key={template.id} value={template.id}>
                                    {template.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                        <button
                          type="button"
                          className="save-template-btn"
                          onClick={() => setShowSaveTemplateDialog(true)}
                          title="Save current arrangement as template"
                        >
                          <Icon name="save" size="sm" /> Save arrangement
                        </button>
                      </div>

                      {showSaveTemplateDialog && (
                        <div className="save-template-dialog">
                          <div className="dialog-content">
                            <h4>Save current arrangement</h4>
                            <p className="dialog-hint">
                              This will save your current section order, visibility, and formatting settings.
                            </p>
                            <label htmlFor="template-name-input">
                              Template name <RequiredMark />
                            </label>
                            <input
                              id="template-name-input"
                              type="text"
                              placeholder="Template name (e.g., My Tech Resume)"
                              value={newTemplateName}
                              onChange={(e) => setNewTemplateName(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveTemplate();
                                }
                              }}
                              aria-required="true"
                              autoFocus
                            />
                            <div className="dialog-actions">
                              <button type="button" onClick={handleSaveTemplate} className="primary">
                                <Icon name="check" size="sm" /> Save template
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowSaveTemplateDialog(false);
                                  setNewTemplateName('');
                                }}
                                className="ghost"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {customTemplates.length > 0 && (
                        <div className="custom-templates-list">
                          <h5>My saved templates</h5>
                          <div className="template-chips">
                            {customTemplates.map((template) => (
                              <div key={template.id} className="template-chip">
                                <button
                                  type="button"
                                  onClick={() => handleApplyTemplate(template)}
                                  className="template-chip-apply"
                                  title={`Apply ${template.label}`}
                                >
                                  <Icon name="layout" size="sm" />
                                  <span>{template.label}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTemplate(template.id)}
                                  className="template-chip-delete"
                                  title="Delete template"
                                >
                                  <Icon name="trash" size="sm" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </header>

                  <div className="variation-body">
                    {allSections.length ? (
                      <DndContext collisionDetection={closestCenter} onDragEnd={handlePreviewSectionDragEnd}>
                        <SortableContext items={allSections} strategy={verticalListSortingStrategy}>
                          {allSections.map((sectionId) => (
                            <PreviewSectionBlock
                              key={sectionId}
                              sectionId={sectionId}
                              meta={resumeSectionMeta[sectionId]}
                              onToggleCollapse={handleSectionCollapseToggle}
                              isCollapsed={!!collapsedSections[sectionId]}
                              isVisible={sectionConfig.visibility[sectionId]}
                              onToggleVisibility={handleSectionToggle}
                            >
                              {renderSectionById(sectionId)}
                            </PreviewSectionBlock>
                          ))}
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <p className="placeholder">
                        All sections are hidden. Enable at least one section above to continue previewing.
                      </p>
                    )}
                  </div>
                </article>
              )}
              {activeVariation?.experience_sections?.length > 0 && (
              <ExperienceTailoringLab
                experiences={activeVariation.experience_sections}
                jobContext={{
                  keywords: jobKeywords,
                  jobTitle,
                  company: jobCompanyName,
                  industry: jobIndustry,
                }}
                selectedJobId={selectedJobId}
                onApply={handleApplyExperienceVariant}
                onSave={handleSaveExperienceVariant}
                onDeleteSaved={handleDeleteSavedExperienceVariant}
                onApplySaved={handleApplySavedExperienceVariant}
                savedVariants={savedExperienceVersions[selectedJobId] || {}}
                onNotify={setLayoutHint}
                externalVariations={experienceVariations}
                isLoading={experienceVariationsLoading}
                loadingError={experienceVariationsError}
                onRegenerateBullet={handleRegenerateBullet}
                regeneratingBullet={regeneratingBullet}
              />
              )}
            </div>
          </div>
        </section>
        </>
      )}
    </div>
  );
};

export default AiResumeGenerator;
