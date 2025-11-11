import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { jobsAPI, coverLetterAIAPI } from '../../../services/api';
import Icon from '../../../components/common/Icon';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import '../../resume/AiResumeGenerator/AiResumeGenerator.css';
import './AiCoverLetterGenerator.css';

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
  // UC-058 cover letter tones
  { value: 'formal', label: 'Formal', hint: 'Polished, professional language' },
  { value: 'casual', label: 'Casual', hint: 'Conversational and approachable' },
  { value: 'enthusiastic', label: 'Enthusiastic', hint: 'Upbeat and energetic' },
  { value: 'analytical', label: 'Analytical', hint: 'Evidence-driven and logical' },
];

const variationChoices = [1, 2, 3];
const lengthChoices = [
  { value: 'brief', label: 'Brief' },
  { value: 'standard', label: 'Standard' },
  { value: 'detailed', label: 'Detailed' },
];

const writingStyleOptions = [
  { value: 'direct', label: 'Direct' },
  { value: 'narrative', label: 'Narrative' },
  { value: 'bullet_points', label: 'Bullet points' },
];

const companyCultureOptions = [
  { value: 'auto', label: 'Auto (match company)' },
  { value: 'startup', label: 'Startup' },
  { value: 'corporate', label: 'Corporate' },
];
// UX constants
const MAX_CUSTOM_INSTRUCTIONS = 500;

const SECTION_IDS = ['summary', 'skills', 'experience', 'projects', 'education', 'keywords', 'preview'];
const rotateArray = (list = [], shift = 0) => {
  if (!list.length) return list;
  const offset = ((shift % list.length) + list.length) % list.length;
  if (offset === 0) return list;
  return [...list.slice(offset), ...list.slice(0, offset)];
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

const latexEscape = (text = '') =>
  text
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

const generationHints = [
  'Analyzing the job description and keywords…',
  'Matching verified achievements from your profile…',
  'Authoring succinct ATS-ready bullet points…',
];

const CACHE_KEY = 'resumerocket_ai_cover_letter_cache';
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

const AiCoverLetterGenerator = () => {
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedJobDetail, setSelectedJobDetail] = useState(null);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);

  const [tone, setTone] = useState('balanced');
  const [variationCount, setVariationCount] = useState(2);
  // UC-058 customization state
  const [length, setLength] = useState('standard');
  const [writingStyle, setWritingStyle] = useState('direct');
  const [companyCulture, setCompanyCulture] = useState('auto');
  const [industryInput, setIndustryInput] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
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
  
  // UC-061: Email and letterhead state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showLetterheadSettings, setShowLetterheadSettings] = useState(false);
  const [letterheadConfig, setLetterheadConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('resumerocket_letterhead_config');
      return saved ? JSON.parse(saved) : {
        header_format: 'centered',
        font_name: 'Calibri',
        font_size: 11,
        header_color: null,
      };
    } catch {
      return {
        header_format: 'centered',
        font_name: 'Calibri',
        font_size: 11,
        header_color: null,
      };
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

  // Save letterhead config to localStorage
  useEffect(() => {
    localStorage.setItem('resumerocket_letterhead_config', JSON.stringify(letterheadConfig));
  }, [letterheadConfig]);

  // Load cached result on mount
  useEffect(() => {
    const cached = loadCachedResult();
    if (cached) {
      setResult(cached.result);
      setSelectedJobId(cached.selectedJobId || '');
      setActiveVariationId(cached.activeVariationId || cached.result?.variations?.[0]?.id || '');
      setTone(cached.tone || 'balanced');
      setVariationCount(cached.variationCount || 2);
      // UC-058 cached preferences
      setLength(cached.length || 'standard');
      setWritingStyle(cached.writingStyle || 'direct');
      setCompanyCulture(cached.companyCulture || 'auto');
      setIndustryInput(cached.industry || '');
      setCustomInstructions(cached.customInstructions || '');
      if (cached.sectionConfig) {
        setSectionConfig(hydrateSectionConfig(cached.sectionConfig));
      }
      if (cached.layoutSource) {
        setLayoutSource(cached.layoutSource);
        setHasManualSectionOverrides(cached.layoutSource?.type === 'custom');
      }
      setStatusMessage('✓ Restored your previous cover letter session');
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
        // UC-058 preferences
        length,
        writingStyle,
        companyCulture,
        industry: industryInput,
        customInstructions,
        sectionConfig,
        layoutSource,
      });
    }
  }, [result, selectedJobId, activeVariationId, tone, variationCount, length, writingStyle, companyCulture, industryInput, customInstructions, sectionConfig, layoutSource]);

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
    const loadJobs = async () => {
      setJobsLoading(true);
      setJobsError('');
      try {
        const response = await jobsAPI.getJobs();
        const list = Array.isArray(response) ? response : response?.results || [];
        setJobs(list);
        if (!list.length) {
          setJobsError('Add a job inside the Jobs workspace to unlock AI cover letters.');
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
      setGenerationError('Select a job before generating a cover letter.');
      return;
    }
    setGenerating(true);
    setGenerationError('');
    setStatusMessage('Generating a tailored cover letter for this role…');
    setHintIndex(0);
    try {
      const data = await coverLetterAIAPI.generateForJob(selectedJobId, {
        tone,
        variation_count: variationCount,
        // UC-058 customization options
        length,
        writing_style: writingStyle,
        company_culture: companyCulture,
        industry: industryInput,
        custom_instructions: customInstructions,
      });
      console.log('Received cover letter data:', {
        variation_count: data?.variation_count,
        variations_length: data?.variations?.length,
        variation_labels: data?.variations?.map(v => v.label),
      });
      setResult(data);
      const firstVariation = data?.variations?.[0];
      setActiveVariationId(firstVariation?.id || '');
      setStatusMessage('Cover letter ready! Scroll down to preview.');
      setTimeout(() => {
        variationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } catch (err) {
      const message = err?.message || err?.code || 'Failed to generate cover letter.';
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
    // reset UC-058 preferences
    setLength('standard');
    setWritingStyle('direct');
    setCompanyCulture('auto');
    setIndustryInput('');
    setCustomInstructions('');
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
    
    // Generate filename from profile name and job info
    let filename = 'cover_letter.txt';
    if (result?.profile?.name) {
      const name = result.profile.name.trim();
      const nameParts = name.split(/\s+/);
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        filename = `${firstName}_${lastName}_CoverLetter.txt`;
      } else {
        filename = `${name.replace(/\s+/g, '_')}_CoverLetter.txt`;
      }
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

  const handleDownloadDocx = async (variation) => {
    if (!variation || !result?.profile || !result?.job) return;
    
    const profile = result.profile;
    const job = result.job;
    
    try {
      const blob = await coverLetterAIAPI.exportDocx({
        candidate_name: profile.name || 'Candidate',
        candidate_email: profile.contact?.email || '',
        candidate_phone: profile.contact?.phone || '',
        candidate_location: profile.location || profile.contact?.location || '',
        company_name: job.company_name || 'Company',
        job_title: job.title || 'Position',
        opening_paragraph: variation.opening_paragraph || '',
        body_paragraphs: variation.body_paragraphs || [],
        closing_paragraph: variation.closing_paragraph || '',
        letterhead_config: letterheadConfig,
      });
      
      // Generate filename
      let filename = 'cover_letter.docx';
      if (profile.name) {
        const name = profile.name.trim();
        const nameParts = name.split(/\s+/);
        if (nameParts.length >= 2) {
          const firstName = nameParts[0];
          const lastName = nameParts[nameParts.length - 1];
          filename = `${firstName}_${lastName}_CoverLetter.docx`;
        } else {
          filename = `${name.replace(/\s+/g, '_')}_CoverLetter.docx`;
        }
      }
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download Word document:', err);
      setGenerationError('Failed to download Word document. Please try again.');
    }
  };

  const handleDownload = (variation) => {
    if (!variation?.latex_document) return;
    
    // Generate filename from profile name
    let filename = 'cover_letter.tex';
    if (result?.profile?.name) {
      const name = result.profile.name.trim();
      const nameParts = name.split(/\s+/);
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        filename = `${firstName}_${lastName}_CoverLetter.tex`;
      } else {
        // If only one name part, use it
        filename = `${name.replace(/\s+/g, '_')}_CoverLetter.tex`;
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
    let filename = 'cover_letter.pdf';
    if (result?.profile?.name) {
      const name = result.profile.name.trim();
      const nameParts = name.split(/\s+/);
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        filename = `${firstName}_${lastName}_CoverLetter.pdf`;
      } else {
        // If only one name part, use it
        filename = `${name.replace(/\s+/g, '_')}_CoverLetter.pdf`;
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
  // Combine news references from shared analysis and the active variation highlights
  const combinedNews = useMemo(() => {
    const analysisNews = (analysis.news_to_reference || []).map((n) => (typeof n === 'string' ? { title: n } : n));
    const variationNews = (activeVariation?.highlights?.news_citations || []).map((n) => (typeof n === 'string' ? { title: n } : n));
    const merged = [];
    const seen = new Set();
    [...analysisNews, ...variationNews].forEach((item) => {
      const key = (item?.title || '').trim();
      if (!key) return;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    });
    return merged;
  }, [analysis, activeVariation]);
  // Combine key achievements from shared analysis and active variation highlights
  const combinedAchievements = useMemo(() => {
    const analysisItems = (analysis.key_achievements || []).map((a) => (typeof a === 'string' ? a : String(a?.text || a)));
    const variationItems = (activeVariation?.highlights?.achievements || []).map((a) => (typeof a === 'string' ? a : String(a?.text || a)));
    const merged = [];
    const seen = new Set();
    [...analysisItems, ...variationItems].forEach((item) => {
      const key = (item || '').trim();
      if (!key) return;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(key);
      }
    });
    return merged;
  }, [analysis, activeVariation]);
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
    if (!activeVariation) return '% Generate a cover letter to view the LaTeX preview.';
    
    // Cover letters don't have latex_document like resumes - we need to generate it from paragraphs
    if (!result?.profile) {
      return '% Candidate profile information is required.';
    }
    
    const profile = result.profile;
    const job = result.job || {};
    
    // Extract candidate info
    const name = profile.name || 'Candidate';
    const email = profile.contact?.email || '';
    const phone = profile.contact?.phone || '';
    const location = profile.location || profile.contact?.location || '';
    
    // Extract job info
    const companyName = job.company_name || 'Company';
    const jobTitle = job.title || 'Position';
    
    // Get paragraphs from active variation
    const opening = activeVariation.opening_paragraph || '';
    const bodies = activeVariation.body_paragraphs || [];
    const closing = activeVariation.closing_paragraph || '';
    
    // Helper to escape LaTeX special characters
    const latexEscape = (text) => {
      if (!text) return '';
      return String(text)
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/\$/g, '\\$')
        .replace(/#/g, '\\#')
        .replace(/_/g, '\\_')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
    };
    
    // Get current date
    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Build LaTeX document
    const lines = [
      '\\documentclass[letterpaper,11pt]{article}',
      '\\usepackage[empty]{fullpage}',
      '\\usepackage[hidelinks]{hyperref}',
      '\\usepackage{geometry}',
      '\\geometry{margin=0.75in}',
      '\\raggedright',
      '\\setlength{\\tabcolsep}{0in}',
      '\\setlength{\\parindent}{0pt}',
      '\\setlength{\\parskip}{0.5em}',
      '',
      '\\begin{document}',
      '',
      latexEscape(today),
      '',
      'Hiring Manager \\\\',
      `${latexEscape(companyName)} \\\\`,
      latexEscape(jobTitle),
      '',
      '\\vspace{1em}',
      '',
      'Dear Hiring Manager,',
      '',
    ];
    
    // Add opening paragraph
    if (opening) {
      lines.push(latexEscape(opening));
      lines.push('');
    }
    
    // Add body paragraphs
    bodies.forEach((para) => {
      if (para && para.trim()) {
        lines.push(latexEscape(para.trim()));
        lines.push('');
      }
    });
    
    // Add closing paragraph
    if (closing) {
      lines.push(latexEscape(closing));
      lines.push('');
    }
    
    // Add signature
    lines.push('Sincerely,');
    lines.push('');
    lines.push(latexEscape(name));
    lines.push('');
    lines.push('\\end{document}');
    
    return lines.join('\n');
  }, [activeVariation, result]);

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
      const data = await coverLetterAIAPI.compileLatex(liveLatexPreview);
      
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
        liveLatexPreview.includes('% Generate a cover letter') || 
        liveLatexPreview.includes('% Candidate profile information is required')) {
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
                  const groupId = exp.source_experience_id || `${exp.role || 'experience'}-${exp.company || idx}`;
                  const bulletItems = (bullets || []).map((bullet, bulletIdx) => {
                    const key = buildBulletKey('experience', groupId, bulletIdx);
                    return {
                      key,
                      text: bulletOverrides[key] ?? bullet,
                    };
                  });
                  return (
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
          const groupId = exp.source_experience_id || `${exp.role || 'experience'}-${exp.company || idx}`;
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
          <h1>Tailored Cover Letter Generator</h1>
          <p className="lead">
            Select a job from your pipeline and let ResumeRocket craft a role-aligned cover letter grounded
            in your verified profile data.
          </p>
          <ul className="hero-checklist">
            <li>
              <Icon name="sparkles" size="sm" /> Generates 1–3 curated variations
            </li>
            <li>
              <Icon name="file-text" size="sm" /> Outputs personalized opening, body, and closing paragraphs
            </li>
            <li>
              <Icon name="briefcase" size="sm" /> Highlights key experiences relevant to the role
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

          <div className="control-group">
            <label>Length</label>
            <select value={length} onChange={(e) => setLength(e.target.value)}>
              {lengthChoices.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <label>Writing style</label>
            <select value={writingStyle} onChange={(e) => setWritingStyle(e.target.value)}>
              {writingStyleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <div className="inline-row" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 50%' }}>
                <label>Company culture</label>
                <select value={companyCulture} onChange={(e) => setCompanyCulture(e.target.value)}>
                  {companyCultureOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="hint">Automatic matching will attempt to mirror the company's tone.</p>
              </div>

              <div style={{ flex: '1 1 50%' }}>
                <label htmlFor="industry-input">Industry (optional)</label>
                <input
                  id="industry-input"
                  type="text"
                  placeholder="e.g., fintech, healthcare"
                  value={industryInput}
                  onChange={(e) => setIndustryInput(e.target.value)}
                  aria-describedby="industry-hint"
                />
                <p id="industry-hint" className="hint">Helps the AI pick industry-specific phrasing (optional).</p>
              </div>
            </div>

            <label htmlFor="custom-instructions">Custom instructions (optional)</label>
            <textarea
              id="custom-instructions"
              placeholder="e.g., emphasize leadership in cross-functional teams"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value.slice(0, MAX_CUSTOM_INSTRUCTIONS))}
              rows={4}
              aria-describedby="custom-instructions-hint"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p id="custom-instructions-hint" className="hint">Optional guidance for the model — keep under {MAX_CUSTOM_INSTRUCTIONS} characters.</p>
              <small aria-live="polite">{customInstructions.length}/{MAX_CUSTOM_INSTRUCTIONS}</small>
            </div>
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
                  <LoadingSpinner size="sm" /> Generating tailored cover letter…
                </>
              ) : (
                <>
                  <Icon name="sparkles" size="sm" /> Generate tailored cover letter
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
                Cover letter for “{resultJobTitle}” at {resultJobCompany}
              </h2>
            </div>
            <div className="insight-grid">
              <div>
                <strong>Personalization strategy</strong>
                <p>
                  {analysis.personalization_strategy ||
                    'AI will tailor the cover letter to match the company culture and role requirements.'}
                </p>
              </div>
              <div>
                <strong>Tone rationale</strong>
                <p>
                  {analysis.tone_rationale ||
                    `Using ${result.tone || 'balanced'} tone to match the company culture.`}
                </p>
              </div>
              {combinedAchievements.length > 0 && (
                <div>
                  <strong>Key achievements highlighted</strong>
                  <ul>
                    {combinedAchievements.slice(0, 3).map((achievement, idx) => (
                      <li key={idx}>{achievement}</li>
                    ))}
                  </ul>
                </div>
              )}
              {combinedNews.length > 0 && (
                <div>
                  <strong>News referenced</strong>
                  <ul>
                    {combinedNews.map((news, idx) => (
                      <li key={idx}>
                        {news.title || news}
                        {news.date && <span className="date"> ({news.date})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Merge per-variation highlights into the main AI insights card to avoid duplication */}
              {activeVariation?.highlights && (
                <div>
                  <strong>Variation highlights</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* Achievements are merged into the shared 'Key achievements highlighted' section above */}
                    {activeVariation.highlights.keywords_used?.length > 0 && (
                      <div>
                        <strong>Keywords emphasized</strong>
                        <div className="chip-row">
                          {activeVariation.highlights.keywords_used.map((keyword) => (
                            <span key={keyword} className="chip">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* news citations merged into the shared 'News referenced' section above */}
                  </div>
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
            
            {/* Per-variation highlights are now merged into the AI insights card above to reduce overlap. */}
            
            <div className="customizer-preview-grid">
              <section className="ai-resume-card section-customizer">
                <div className="customizer-header">
                  <div className="layout-panel-heading">
                    <p className="eyebrow">Cover letter layout</p>
                    <h2>Customize sections & preview</h2>
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
                <div className="customizer-body">
                  <div className="latex-column">
                    <h3>Live PDF preview</h3>
                    <p className="hint">
                      Reflects your current section order, visibility, formatting, and edits.
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
                          title="Live Cover Letter PDF preview"
                          className="pdf-preview-frame"
                        />
                      </div>
                    ) : !livePreviewLoading && !activeVariation ? (
                      <p className="placeholder">Generate a cover letter to enable the live preview.</p>
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
                  </div>

                </div>
              </section>

              {/* Variation/resume preview card removed — cover letter page does not include the resume variation card */}
            </div>
          </section>
        </>
      )}

      {/* UC-061: Letterhead Settings Modal */}
      {showLetterheadSettings && (
        <div className="modal-overlay" onClick={() => setShowLetterheadSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Letterhead Settings</h3>
              <button className="close-btn" onClick={() => setShowLetterheadSettings(false)}>
                <Icon name="x" size="sm" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="header-format">Header Format</label>
                <select
                  id="header-format"
                  value={letterheadConfig.header_format}
                  onChange={(e) => setLetterheadConfig({ ...letterheadConfig, header_format: e.target.value })}
                >
                  <option value="centered">Centered</option>
                  <option value="left">Left Aligned</option>
                  <option value="right">Right Aligned</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="font-name">Font</label>
                <select
                  id="font-name"
                  value={letterheadConfig.font_name}
                  onChange={(e) => setLetterheadConfig({ ...letterheadConfig, font_name: e.target.value })}
                >
                  <option value="Calibri">Calibri</option>
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Helvetica">Helvetica</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="font-size">Font Size</label>
                <input
                  type="number"
                  id="font-size"
                  min="9"
                  max="14"
                  value={letterheadConfig.font_size}
                  onChange={(e) => setLetterheadConfig({ ...letterheadConfig, font_size: parseInt(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={!!letterheadConfig.header_color}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setLetterheadConfig({ ...letterheadConfig, header_color: [102, 126, 234] });
                      } else {
                        setLetterheadConfig({ ...letterheadConfig, header_color: null });
                      }
                    }}
                  />
                  {' '}Use custom header color (brand purple)
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowLetterheadSettings(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UC-061: Email Integration Modal */}
      {showEmailModal && activeVariation && (
        <div className="modal-overlay" onClick={() => setShowEmailModal(false)}>
          <div className="modal-content email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Email Cover Letter</h3>
              <button className="close-btn" onClick={() => setShowEmailModal(false)}>
                <Icon name="x" size="sm" />
              </button>
            </div>
            <div className="modal-body">
              <p className="hint">
                <Icon name="info" size="sm" /> Copy the text below and paste it into your email client, or use the quick actions to open your default email app.
              </p>
              <div className="form-group">
                <label>Email Subject</label>
                <input
                  type="text"
                  readOnly
                  value={`Application for ${result?.job?.title || 'Position'} at ${result?.job?.company_name || 'Company'}`}
                  onClick={(e) => e.target.select()}
                />
              </div>
              <div className="form-group">
                <label>Cover Letter Content</label>
                <textarea
                  readOnly
                  rows="15"
                  value={[
                    activeVariation.opening_paragraph,
                    ...(activeVariation.body_paragraphs || []),
                    activeVariation.closing_paragraph,
                  ]
                    .filter(Boolean)
                    .join('\n\n')}
                  onClick={(e) => e.target.select()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  const fullText = [
                    activeVariation.opening_paragraph,
                    ...(activeVariation.body_paragraphs || []),
                    activeVariation.closing_paragraph,
                  ]
                    .filter(Boolean)
                    .join('\n\n');
                  navigator.clipboard.writeText(fullText);
                  setShowEmailModal(false);
                }}
              >
                <Icon name="clipboard" size="sm" /> Copy to Clipboard
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  const subject = encodeURIComponent(
                    `Application for ${result?.job?.title || 'Position'} at ${result?.job?.company_name || 'Company'}`
                  );
                  const body = encodeURIComponent(
                    [
                      activeVariation.opening_paragraph,
                      ...(activeVariation.body_paragraphs || []),
                      activeVariation.closing_paragraph,
                    ]
                      .filter(Boolean)
                      .join('\n\n')
                  );
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                }}
              >
                <Icon name="mail" size="sm" /> Open in Email App
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiCoverLetterGenerator;
