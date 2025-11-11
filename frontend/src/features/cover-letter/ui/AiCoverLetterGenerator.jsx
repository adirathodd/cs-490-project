import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { jobsAPI, coverLetterAIAPI, coverLetterExportAPI } from '../../../services/api';
import Icon from '../../../components/common/Icon';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { auth } from '../../../services/firebase';
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

// UC-060: Simplified sections for cover letter editing
const SECTION_IDS = ['content'];

// Helper functions for bullet point management (used by legacy components)
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

const generateBulletRewrite = (text, jobTitle, companyName) => {
  const rewriteSentence = (txt = '') => {
    if (!txt) return txt;
    let sentence = txt.trim();
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

// UC-060: Simplified templates for cover letter
const sectionTemplates = [
  {
    id: 'standard',
    label: 'Standard View',
    description: 'Content editor with PDF preview',
    config: createDefaultSectionConfig(),
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

// UC-060: Cover Letter Section Metadata
const resumeSectionMeta = {
  content: {
    label: 'Cover Letter Content',
    icon: 'edit',
    description: 'Edit and refine your cover letter with AI assistance.',
    formatOptions: [],
  },
};

// UC-060: Grammar and spell checking utilities
// UC-060: Grammar checking using LanguageTool API
const checkGrammarAPI = async (text, signal = null) => {
  if (!text || !text.trim()) return [];
  
  try {
    // Get fresh Firebase token
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('[Grammar Check] No authenticated user');
      return [];
    }
    
    const token = await currentUser.getIdToken(true);
    
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    };
    
    // Add abort signal if provided
    if (signal) {
      fetchOptions.signal = signal;
    }
    
    const response = await fetch('/api/cover-letter/check-grammar/', fetchOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Grammar Check] API error:', response.status, errorText);
      return [];
    }
    
    const data = await response.json();
    return data.issues || [];
  } catch (error) {
    if (error.name === 'AbortError') {
      // Request was aborted, this is expected behavior
      return [];
    }
    console.error('[Grammar Check] Error:', error);
    return [];
  }
};

// Transform API issues to match frontend format
const transformGrammarIssue = (issue, paragraphType = 'general') => ({
  id: issue.id,
  ruleId: issue.rule_id,
  message: issue.message,
  suggestion: issue.replacements && issue.replacements.length > 0 
    ? `Try: "${issue.replacements[0]}"` 
    : 'Check this',
  type: issue.type,
  position: issue.offset,
  length: issue.length,
  text: issue.text,
  paragraphType,
  canAutoFix: issue.can_auto_fix,
  replacements: issue.replacements || [],
  context: issue.context,
  category: issue.category,
});

const resolveSectionStatus = (sectionId, { variation, analysis, pdfPreviewUrl }) => {
  switch (sectionId) {
    case 'content':
      if (!variation) return 'pending';
      if (variation.cover_letter_text) return 'complete';
      return 'empty';
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
  children,
}) => {
  return (
    <div className="preview-section-block">
      <div className="preview-section-toolbar">
        <div className="preview-section-info">
          <strong>{meta.label}</strong>
          <small>{meta.description}</small>
        </div>
      </div>
      {children}
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
  
  // UC-060: Version history for editing session
  const [versionHistory, setVersionHistory] = useState([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const versionTimeoutRef = useRef(null);
  const lastContentRef = useRef(null);
  
  // UC-060: Spell check and grammar assistance
  const [grammarIssues, setGrammarIssues] = useState([]);
  const [showGrammarPanel, setShowGrammarPanel] = useState(false);
  const isApplyingFixRef = useRef(false); // Track when we're applying a fix to prevent re-checking
  
  // Live text editor state
  const [editableContent, setEditableContent] = useState({
    header: '',
    greeting: '',
    opening_paragraph: '',
    body_paragraphs: [''],
    closing_paragraph: '',
    complimentary_close: ''
  });
  
  // UC-060: Word/character counts and readability
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [readabilityScore, setReadabilityScore] = useState(null);
  const [readabilityLevel, setReadabilityLevel] = useState('');
  const [showReadabilityPanel, setShowReadabilityPanel] = useState(false);
  
  // UC-060: Synonym suggestions
  const [selectedText, setSelectedText] = useState('');
  const [synonymSuggestions, setSynonymSuggestions] = useState([]);
  const [showSynonymPanel, setShowSynonymPanel] = useState(false);
  const [synonymLoading, setSynonymLoading] = useState(false);
  
  // UC-060: Restructuring suggestions
  const [restructuringSuggestions, setRestructuringSuggestions] = useState([]);
  const [showRestructuringPanel, setShowRestructuringPanel] = useState(false);
  
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

  // UC-061: Export options state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('docx');
  const [exportTheme, setExportTheme] = useState('professional');
  const [exportWatermark, setExportWatermark] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [availableThemes, setAvailableThemes] = useState([]);

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

  // UC-061: Load available export themes
  useEffect(() => {
    const loadThemes = async () => {
      try {
        const themes = await coverLetterExportAPI.getThemes();
        if (themes && themes.length > 0) {
          setAvailableThemes(themes);
        }
      } catch (error) {
        console.error('Failed to load export themes:', error);
        // Use default themes if API fails
      }
    };
    loadThemes();
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

  // Sync editable content when active variation changes
  useEffect(() => {
    if (activeVariation) {
      setEditableContent({
        header: activeVariation.header || '',
        greeting: activeVariation.greeting || '',
        opening_paragraph: activeVariation.opening_paragraph || '',
        body_paragraphs: activeVariation.body_paragraphs || [''],
        closing_paragraph: activeVariation.closing_paragraph || '',
        complimentary_close: activeVariation.complimentary_close || 'Sincerely,'
      });
    }
  }, [activeVariation]);

  // Load version history from localStorage when variation changes
  useEffect(() => {
    if (!activeVariationId) return;
    
    try {
      const storageKey = `resumerocket_cover_letter_versions_${activeVariationId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { versions, currentIndex } = JSON.parse(saved);
        setVersionHistory(versions || []);
        setCurrentVersionIndex(currentIndex || -1);
      } else {
        setVersionHistory([]);
        setCurrentVersionIndex(-1);
      }
    } catch (err) {
      console.error('Failed to load version history from localStorage', err);
      setVersionHistory([]);
      setCurrentVersionIndex(-1);
    }
  }, [activeVariationId]);

  // Save version history to localStorage whenever it changes
  useEffect(() => {
    if (!activeVariationId) return;
    
    try {
      const storageKey = `resumerocket_cover_letter_versions_${activeVariationId}`;
      localStorage.setItem(storageKey, JSON.stringify({
        versions: versionHistory,
        currentIndex: currentVersionIndex,
      }));
    } catch (err) {
      console.error('Failed to save version history to localStorage', err);
    }
  }, [versionHistory, currentVersionIndex, activeVariationId]);

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

  // UC-060: Version history functions
  const saveVersion = useCallback(() => {
    if (!activeVariation) return;
    
    const snapshot = {
      timestamp: Date.now(),
      content: {
        opening_paragraph: activeVariation.opening_paragraph || '',
        body_paragraphs: activeVariation.body_paragraphs || [],
        closing_paragraph: activeVariation.closing_paragraph || '',
      },
      label: new Date().toLocaleTimeString(),
    };
    
    setVersionHistory((prev) => {
      const newHistory = prev.slice(0, currentVersionIndex + 1);
      newHistory.push(snapshot);
      // Keep only last 30 versions
      if (newHistory.length > 30) {
        newHistory.shift();
      }
      return newHistory;
    });
    setCurrentVersionIndex((prev) => {
      const newIdx = Math.min(prev + 1, 29);
      return newIdx;
    });
  }, [activeVariation, currentVersionIndex]);

  const handleUndo = useCallback(() => {
    if (currentVersionIndex <= 0) return;
    
    const previousVersion = versionHistory[currentVersionIndex - 1];
    if (!previousVersion) return;
    
    setResult((prev) => {
      if (!prev?.variations) return prev;
      const updatedVariations = prev.variations.map((v) => {
        if (v.id !== activeVariationId) return v;
        return {
          ...v,
          opening_paragraph: previousVersion.content.opening_paragraph,
          body_paragraphs: previousVersion.content.body_paragraphs,
          closing_paragraph: previousVersion.content.closing_paragraph,
        };
      });
      return {
        ...prev,
        variations: updatedVariations,
      };
    });
    
    setCurrentVersionIndex(currentVersionIndex - 1);
  }, [currentVersionIndex, versionHistory, activeVariationId]);

  const handleRedo = useCallback(() => {
    if (currentVersionIndex >= versionHistory.length - 1) return;
    
    const nextVersion = versionHistory[currentVersionIndex + 1];
    if (!nextVersion) return;
    
    setResult((prev) => {
      if (!prev?.variations) return prev;
      const updatedVariations = prev.variations.map((v) => {
        if (v.id !== activeVariationId) return v;
        return {
          ...v,
          opening_paragraph: nextVersion.content.opening_paragraph,
          body_paragraphs: nextVersion.content.body_paragraphs,
          closing_paragraph: nextVersion.content.closing_paragraph,
        };
      });
      return {
        ...prev,
        variations: updatedVariations,
      };
    });
    
    setCurrentVersionIndex(currentVersionIndex + 1);
  }, [currentVersionIndex, versionHistory, activeVariationId]);

  const restoreVersion = useCallback((index) => {
    if (index < 0 || index >= versionHistory.length) return;
    
    const version = versionHistory[index];
    if (!version) return;
    
    setResult((prev) => {
      if (!prev?.variations) return prev;
      const updatedVariations = prev.variations.map((v) => {
        if (v.id !== activeVariationId) return v;
        return {
          ...v,
          opening_paragraph: version.content.opening_paragraph,
          body_paragraphs: version.content.body_paragraphs,
          closing_paragraph: version.content.closing_paragraph,
        };
      });
      return {
        ...prev,
        variations: updatedVariations,
      };
    });
    
    // Discard all versions after the restored version
    setVersionHistory((prev) => prev.slice(0, index + 1));
    setCurrentVersionIndex(index);
    setShowVersionHistory(false);
  }, [versionHistory, activeVariationId]);

  // Auto-save version 30 seconds after changes stop
  useEffect(() => {
    if (!activeVariation) return;
    
    const currentContent = JSON.stringify({
      opening: activeVariation.opening_paragraph,
      body: activeVariation.body_paragraphs,
      closing: activeVariation.closing_paragraph,
    });
    
    // Skip if content hasn't changed
    if (currentContent === lastContentRef.current) return;
    
    lastContentRef.current = currentContent;
    
    // Clear existing timeout
    if (versionTimeoutRef.current) {
      clearTimeout(versionTimeoutRef.current);
    }
    
    // Set new timeout for 5 seconds
    versionTimeoutRef.current = setTimeout(() => {
      saveVersion();
    }, 5000); // 5 seconds
    
    return () => {
      if (versionTimeoutRef.current) {
        clearTimeout(versionTimeoutRef.current);
      }
    };
  }, [activeVariation?.opening_paragraph, activeVariation?.body_paragraphs, activeVariation?.closing_paragraph, saveVersion]);

  // Apply grammar fix using LanguageTool suggestion
  const applyGrammarFix = useCallback(async (issue, replacementIndex = 0) => {
    if (!issue.canAutoFix || !issue.replacements || issue.replacements.length === 0) return;
    
    // Set flag to prevent grammar re-check
    isApplyingFixRef.current = true;
    
    // Find which paragraph this issue is in
    const paragraphType = issue.paragraphType;
    let originalText = '';
    
    if (paragraphType === 'opening') {
      originalText = activeVariation?.opening_paragraph || '';
    } else if (paragraphType.startsWith('body-')) {
      const idx = parseInt(paragraphType.split('-')[1], 10);
      originalText = activeVariation?.body_paragraphs?.[idx] || '';
    } else if (paragraphType === 'closing') {
      originalText = activeVariation?.closing_paragraph || '';
    }
    
    if (!originalText) return;
    
    // Apply the fix using simple string replacement at the offset
    const replacement = issue.replacements[replacementIndex] || issue.replacements[0];
    const before = originalText.substring(0, issue.position);
    const after = originalText.substring(issue.position + issue.length);
    const fixedText = before + replacement + after;
    
    // Update editableContent immediately to ensure UI is in sync
    setEditableContent((prev) => {
      if (paragraphType === 'opening') {
        return { ...prev, opening_paragraph: fixedText };
      } else if (paragraphType.startsWith('body-')) {
        const idx = parseInt(paragraphType.split('-')[1], 10);
        const newBodyParagraphs = [...prev.body_paragraphs];
        newBodyParagraphs[idx] = fixedText;
        return { ...prev, body_paragraphs: newBodyParagraphs };
      } else if (paragraphType === 'closing') {
        return { ...prev, closing_paragraph: fixedText };
      }
      return prev;
    });
    
    // Update the variation in result state
    setResult((prev) => {
      if (!prev?.variations) return prev;
      
      const updatedVariations = prev.variations.map((v) => {
        if (v.id !== activeVariationId) return v;
        
        let updatedVariation = { ...v };
        
        if (paragraphType === 'opening') {
          updatedVariation.opening_paragraph = fixedText;
        } else if (paragraphType.startsWith('body-')) {
          const idx = parseInt(paragraphType.split('-')[1], 10);
          const bodies = [...(v.body_paragraphs || [])];
          bodies[idx] = fixedText;
          updatedVariation.body_paragraphs = bodies;
        } else if (paragraphType === 'closing') {
          updatedVariation.closing_paragraph = fixedText;
        }
        
        return updatedVariation;
      });
      
      return {
        ...prev,
        variations: updatedVariations,
      };
    });
    
    // Remove the fixed issue from the list immediately
    setGrammarIssues((prev) => prev.filter((i) => i.id !== issue.id));
    
    // Trigger a fresh grammar check after a short delay to get updated suggestions
    setTimeout(async () => {
      isApplyingFixRef.current = false;
      
      // Re-check grammar with updated text
      const opening = paragraphType === 'opening' ? fixedText : (activeVariation?.opening_paragraph || '');
      const bodies = paragraphType.startsWith('body-') 
        ? activeVariation?.body_paragraphs.map((p, i) => {
            const idx = parseInt(paragraphType.split('-')[1], 10);
            return i === idx ? fixedText : p;
          }) || []
        : activeVariation?.body_paragraphs || [];
      const closing = paragraphType === 'closing' ? fixedText : (activeVariation?.closing_paragraph || '');
      
      const fullText = [opening, ...bodies, closing].filter(Boolean).join('\n\n');
      
      if (fullText.trim()) {
        try {
          const apiIssues = await checkGrammarAPI(fullText);
          
          const allIssues = apiIssues.map(apiIssue => {
            let cumulativeLength = 0;
            let type = 'general';
            
            if (opening) {
              if (apiIssue.offset < opening.length) {
                type = 'opening';
              }
              cumulativeLength += opening.length + 2;
            }
            
            bodies.forEach((body, idx) => {
              if (body && apiIssue.offset >= cumulativeLength && apiIssue.offset < cumulativeLength + body.length) {
                type = `body-${idx}`;
              }
              cumulativeLength += body.length + 2;
            });
            
            if (closing && apiIssue.offset >= cumulativeLength) {
              type = 'closing';
            }
            
            return transformGrammarIssue(apiIssue, type);
          });
          
          setGrammarIssues(allIssues);
        } catch (error) {
          console.error('[Grammar Check] Re-check error:', error);
        }
      }
    }, 500);
  }, [activeVariationId, activeVariation]);

  // UC-060: Ignore a grammar issue (remove from list without applying fix)
  const ignoreGrammarIssue = useCallback((issueId) => {
    setGrammarIssues((prev) => prev.filter((issue) => issue.id !== issueId));
  }, []);

  // UC-060: Manual recheck grammar
  const recheckGrammar = useCallback(async () => {
    if (!activeVariation) return;
    
    const opening = activeVariation.opening_paragraph || '';
    const bodies = activeVariation.body_paragraphs || [];
    const closing = activeVariation.closing_paragraph || '';
    
    const fullText = [opening, ...bodies, closing].filter(Boolean).join('\n\n');
    
    if (!fullText.trim()) {
      setGrammarIssues([]);
      return;
    }
    
    try {
      const apiIssues = await checkGrammarAPI(fullText);
      
      const allIssues = apiIssues.map(issue => {
        let cumulativeLength = 0;
        let paragraphType = 'general';
        
        if (opening) {
          if (issue.offset < opening.length) {
            paragraphType = 'opening';
          }
          cumulativeLength += opening.length + 2;
        }
        
        bodies.forEach((body, idx) => {
          if (body && issue.offset >= cumulativeLength && issue.offset < cumulativeLength + body.length) {
            paragraphType = `body-${idx}`;
          }
          cumulativeLength += body.length + 2;
        });
        
        if (closing && issue.offset >= cumulativeLength) {
          paragraphType = 'closing';
        }
        
        return transformGrammarIssue(issue, paragraphType);
      });
      
      setGrammarIssues(allIssues);
    } catch (error) {
      console.error('[Grammar Check] Manual re-check error:', error);
    }
  }, [activeVariation]);

  // Handlers for live text editor
  const handleContentChange = useCallback((field, value) => {
    setEditableContent((prev) => ({
      ...prev,
      [field]: value
    }));
    
    // Update the active variation
    setResult((prev) => {
      if (!prev?.variations) return prev;
      const updatedVariations = prev.variations.map((v) => {
        if (v.id !== activeVariationId) return v;
        return {
          ...v,
          [field]: value
        };
      });
      return {
        ...prev,
        variations: updatedVariations,
      };
    });
  }, [activeVariationId]);

  const handleBodyParagraphChange = useCallback((index, value) => {
    setEditableContent((prev) => {
      const newBodyParagraphs = [...prev.body_paragraphs];
      newBodyParagraphs[index] = value;
      return {
        ...prev,
        body_paragraphs: newBodyParagraphs
      };
    });
    
    // Update the active variation
    setResult((prev) => {
      if (!prev?.variations) return prev;
      const updatedVariations = prev.variations.map((v) => {
        if (v.id !== activeVariationId) return v;
        const newBodyParagraphs = [...(v.body_paragraphs || [])];
        newBodyParagraphs[index] = value;
        return {
          ...v,
          body_paragraphs: newBodyParagraphs
        };
      });
      return {
        ...prev,
        variations: updatedVariations,
      };
    });
  }, [activeVariationId]);

  const addBodyParagraph = useCallback(() => {
    setEditableContent((prev) => ({
      ...prev,
      body_paragraphs: [...prev.body_paragraphs, '']
    }));
    
    // Update the active variation
    setResult((prev) => {
      if (!prev?.variations) return prev;
      const updatedVariations = prev.variations.map((v) => {
        if (v.id !== activeVariationId) return v;
        return {
          ...v,
          body_paragraphs: [...(v.body_paragraphs || []), '']
        };
      });
      return {
        ...prev,
        variations: updatedVariations,
      };
    });
  }, [activeVariationId]);

  const removeBodyParagraph = useCallback((index) => {
    setEditableContent((prev) => ({
      ...prev,
      body_paragraphs: prev.body_paragraphs.filter((_, i) => i !== index)
    }));
    
    // Update the active variation
    setResult((prev) => {
      if (!prev?.variations) return prev;
      const updatedVariations = prev.variations.map((v) => {
        if (v.id !== activeVariationId) return v;
        return {
          ...v,
          body_paragraphs: (v.body_paragraphs || []).filter((_, i) => i !== index)
        };
      });
      return {
        ...prev,
        variations: updatedVariations,
      };
    });
  }, [activeVariationId]);

  // UC-060: Calculate word and character counts
  const calculateCounts = useCallback(() => {
    const fullText = [
      editableContent.header,
      editableContent.greeting,
      editableContent.opening_paragraph,
      ...(editableContent.body_paragraphs || []),
      editableContent.closing_paragraph,
      editableContent.complimentary_close
    ].filter(Boolean).join(' ');
    
    const chars = fullText.length;
    const words = fullText.trim() ? fullText.trim().split(/\s+/).length : 0;
    
    setCharacterCount(chars);
    setWordCount(words);
  }, [editableContent]);

  // UC-060: Calculate readability score (Flesch Reading Ease)
  const calculateReadability = useCallback(() => {
    const fullText = [
      editableContent.opening_paragraph,
      ...(editableContent.body_paragraphs || []),
      editableContent.closing_paragraph
    ].filter(Boolean).join(' ');
    
    if (!fullText.trim()) {
      setReadabilityScore(null);
      setReadabilityLevel('');
      return;
    }
    
    // Count sentences
    const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    
    // Count words
    const words = fullText.trim().split(/\s+/).length;
    
    // Count syllables (simplified approach)
    const syllables = fullText
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .replace(/[^aeiouy]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(s => s).length;
    
    if (sentences === 0 || words === 0) {
      setReadabilityScore(null);
      setReadabilityLevel('');
      return;
    }
    
    // Flesch Reading Ease formula: 206.835 - 1.015(total words/total sentences) - 84.6(total syllables/total words)
    const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
    const clampedScore = Math.max(0, Math.min(100, score));
    
    setReadabilityScore(Math.round(clampedScore));
    
    // Interpret score
    if (clampedScore >= 90) setReadabilityLevel('Very Easy');
    else if (clampedScore >= 80) setReadabilityLevel('Easy');
    else if (clampedScore >= 70) setReadabilityLevel('Fairly Easy');
    else if (clampedScore >= 60) setReadabilityLevel('Standard');
    else if (clampedScore >= 50) setReadabilityLevel('Fairly Difficult');
    else if (clampedScore >= 30) setReadabilityLevel('Difficult');
    else setReadabilityLevel('Very Difficult');
  }, [editableContent]);

  // UC-060: Get restructuring suggestions
  const generateRestructuringSuggestions = useCallback(() => {
    const suggestions = [];
    
    const fullText = [
      editableContent.opening_paragraph,
      ...(editableContent.body_paragraphs || []),
      editableContent.closing_paragraph
    ].filter(Boolean).join(' ');
    
    const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length;
    
    // Check for long sentences
    sentences.forEach((sentence, idx) => {
      const words = sentence.trim().split(/\s+/).length;
      if (words > 25) {
        suggestions.push({
          id: `long-sentence-${idx}`,
          type: 'sentence_length',
          title: 'Long sentence detected',
          description: `Sentence ${idx + 1} has ${words} words. Consider breaking it into shorter sentences for better readability.`,
          severity: 'medium'
        });
      }
    });
    
    // Check for passive voice
    const passivePatterns = /\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi;
    const passiveMatches = fullText.match(passivePatterns);
    if (passiveMatches && passiveMatches.length > 2) {
      suggestions.push({
        id: 'passive-voice',
        type: 'passive_voice',
        title: 'Reduce passive voice',
        description: `Found ${passiveMatches.length} instances of passive voice. Use active voice to make your writing more direct and engaging.`,
        severity: 'low'
      });
    }
    
    // Check paragraph length
    editableContent.body_paragraphs.forEach((para, idx) => {
      const words = para.trim().split(/\s+/).length;
      if (words > 150) {
        suggestions.push({
          id: `long-paragraph-${idx}`,
          type: 'paragraph_length',
          title: 'Long paragraph',
          description: `Body paragraph ${idx + 1} has ${words} words. Consider splitting it into 2-3 shorter paragraphs.`,
          severity: 'low'
        });
      }
    });
    
    // Check for varied sentence starts
    const starterWords = sentences.map(s => s.trim().split(/\s+/)[0].toLowerCase());
    const repeatedStarters = starterWords.filter((word, idx) => 
      idx > 0 && word === starterWords[idx - 1]
    );
    if (repeatedStarters.length > 2) {
      suggestions.push({
        id: 'sentence-variety',
        type: 'sentence_variety',
        title: 'Add sentence variety',
        description: 'Multiple consecutive sentences start with the same word. Vary your sentence structure for better flow.',
        severity: 'low'
      });
    }
    
    setRestructuringSuggestions(suggestions);
  }, [editableContent]);

  // UC-060: Fetch synonym suggestions from API
  const fetchSynonyms = useCallback(async (word) => {
    if (!word || word.length < 3) return;
    
    setSynonymLoading(true);
    try {
      // Use a free synonym API (datamuse)
      const response = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=10`);
      const data = await response.json();
      
      const synonyms = data.map(item => item.word).slice(0, 8);
      setSynonymSuggestions(synonyms);
    } catch (error) {
      console.error('Error fetching synonyms:', error);
      setSynonymSuggestions([]);
    } finally {
      setSynonymLoading(false);
    }
  }, []);

  // UC-060: Handle text selection for synonym lookup
  const handleTextSelection = useCallback((e) => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text && text.split(/\s+/).length === 1) { // Single word selected
      setSelectedText(text);
      fetchSynonyms(text);
      setShowSynonymPanel(true);
    } else {
      setShowSynonymPanel(false);
    }
  }, [fetchSynonyms]);

  // UC-060: Replace selected word with synonym
  const replaceSynonym = useCallback((synonym) => {
    if (!selectedText) return;
    
    // Find and replace in all paragraphs
    const replaceInText = (text) => {
      const regex = new RegExp(`\\b${selectedText}\\b`, 'gi');
      return text.replace(regex, synonym);
    };
    
    setEditableContent((prev) => ({
      ...prev,
      opening_paragraph: replaceInText(prev.opening_paragraph),
      body_paragraphs: prev.body_paragraphs.map(p => replaceInText(p)),
      closing_paragraph: replaceInText(prev.closing_paragraph)
    }));
    
    // Update active variation
    setResult((prev) => {
      if (!prev?.variations) return prev;
      const updatedVariations = prev.variations.map((v) => {
        if (v.id !== activeVariationId) return v;
        return {
          ...v,
          opening_paragraph: replaceInText(v.opening_paragraph || ''),
          body_paragraphs: (v.body_paragraphs || []).map(p => replaceInText(p)),
          closing_paragraph: replaceInText(v.closing_paragraph || '')
        };
      });
      return {
        ...prev,
        variations: updatedVariations,
      };
    });
    
    setShowSynonymPanel(false);
    setSelectedText('');
  }, [selectedText, activeVariationId]);

  // Save initial version when cover letter is generated
  useEffect(() => {
    if (!result || !activeVariation) return;
    if (versionHistory.length === 0) {
      saveVersion();
    }
  }, [result, activeVariation, saveVersion, versionHistory.length]);

  // UC-060: Update word count, character count, readability when content changes
  useEffect(() => {
    if (!activeVariation) return;
    
    calculateCounts();
    calculateReadability();
    generateRestructuringSuggestions();
  }, [editableContent, activeVariation, calculateCounts, calculateReadability, generateRestructuringSuggestions]);

  // Debounced auto-save version on content change
  useEffect(() => {
    if (versionHistory.length === 0) return undefined;
    if (!activeVariation) return undefined;
    
    const timeout = setTimeout(() => {
      // Check if content actually changed
      const currentContent = {
        opening: activeVariation.opening_paragraph || '',
        body: activeVariation.body_paragraphs || [],
        closing: activeVariation.closing_paragraph || '',
      };
      
      const lastVersion = versionHistory[currentVersionIndex];
      if (!lastVersion) return;
      
      const lastContent = lastVersion.content;
      
      // Calculate text difference to check if changes are substantial
      const currentText = currentContent.opening + 
                         currentContent.body.join('') + 
                         currentContent.closing;
      const lastText = (lastContent.opening_paragraph || '') + 
                      (lastContent.body_paragraphs || []).join('') + 
                      (lastContent.closing_paragraph || '');
      
      const textDiff = Math.abs(currentText.length - lastText.length);
      const contentChanged = JSON.stringify(currentContent) !== JSON.stringify(lastContent);
      
      // Only save if there are substantial changes (at least 10 characters difference)
      // or if the structure changed significantly
      if (contentChanged && textDiff >= 10) {
        saveVersion();
      }
    }, 5000); // Save after 5 seconds of no changes
    
    return () => clearTimeout(timeout);
  }, [
    activeVariation?.opening_paragraph,
    activeVariation?.body_paragraphs,
    activeVariation?.closing_paragraph,
    saveVersion,
    versionHistory,
    currentVersionIndex
  ]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // UC-060: Manual grammar check function
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
  
  const checkGrammar = async () => {
    if (!editableContent || isCheckingGrammar) return;
    
    setIsCheckingGrammar(true);
    
    try {
      const opening = editableContent.opening_paragraph || '';
      const bodies = editableContent.body_paragraphs || [];
      const closing = editableContent.closing_paragraph || '';
      
      // Combine all text for checking
      const fullText = [opening, ...bodies, closing].filter(Boolean).join('\n\n');
      
      if (!fullText.trim()) {
        setGrammarIssues([]);
        setIsCheckingGrammar(false);
        return;
      }
      
      const apiIssues = await checkGrammarAPI(fullText);
      
      // Transform API issues and assign paragraph types
      const allIssues = apiIssues.map(issue => {
        // Determine which paragraph this issue belongs to based on offset
        let cumulativeLength = 0;
        let paragraphType = 'general';
        
        if (opening) {
          if (issue.offset < opening.length) {
            paragraphType = 'opening';
          }
          cumulativeLength += opening.length + 2; // +2 for newlines
        }
        
        bodies.forEach((body, idx) => {
          if (body && issue.offset >= cumulativeLength && issue.offset < cumulativeLength + body.length) {
            paragraphType = `body-${idx}`;
          }
          cumulativeLength += body.length + 2;
        });
        
        if (closing && issue.offset >= cumulativeLength) {
          paragraphType = 'closing';
        }
        
        return transformGrammarIssue(issue, paragraphType);
      });
      
      setGrammarIssues(allIssues);
      setShowGrammarPanel(true); // Auto-open panel to show results
    } catch (error) {
      console.error('[Grammar Check] Error:', error);
      setGrammarIssues([]);
    } finally {
      setIsCheckingGrammar(false);
    }
  };

  // UC-061: Export cover letter handler
  const handleExportCoverLetter = async () => {
    if (!liveLatexPreview || !activeVariation) {
      setExportError('No cover letter content available to export');
      return;
    }

    setIsExporting(true);
    setExportError('');

    try {
      // Generate filename based on profile name and job details
      let filename = '';
      if (result?.profile?.name) {
        const name = result.profile.name.trim();
        const nameParts = name.split(/\s+/);
        let namePrefix = '';
        if (nameParts.length >= 2) {
          const firstName = nameParts[0];
          const lastName = nameParts[nameParts.length - 1];
          namePrefix = `${firstName}_${lastName}`;
        } else {
          namePrefix = name.replace(/\s+/g, '_');
        }
        
        // Add job and company details to filename
        const jobTitle = result?.job?.title || selectedJobDetail?.title || '';
        const companyName = result?.job?.company_name || selectedJobDetail?.company_name || '';
        
        if (companyName) {
          const cleanCompany = companyName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
          filename = `${namePrefix}_${cleanCompany}_Cover_Letter`;
        } else if (jobTitle) {
          const cleanTitle = jobTitle.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
          filename = `${namePrefix}_${cleanTitle}_Cover_Letter`;
        } else {
          filename = `${namePrefix}_Cover_Letter`;
        }
      } else {
        // Fallback if no profile name
        const companyName = result?.job?.company_name || selectedJobDetail?.company_name || '';
        if (companyName) {
          const cleanCompany = companyName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
          filename = `${cleanCompany}_Cover_Letter`;
        } else {
          filename = 'Cover_Letter';
        }
      }

      // Call the export API
      await coverLetterExportAPI.exportAICoverLetter(
        liveLatexPreview,
        exportFormat,
        exportTheme,
        exportWatermark.trim() || null,
        filename,
        result?.profile || null,
        result?.job || selectedJobDetail || null
      );

      // Success - close modal and reset
      setShowExportModal(false);
      setExportError('');
      // Reset form for next time
      setTimeout(() => {
        setExportWatermark('');
      }, 300);
    } catch (error) {
      // Export failed
      setExportError(error.response?.data?.error || error.message || 'Failed to export cover letter. Please try again.');
    } finally {
      setIsExporting(false);
    }
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
      // Don't show error message to user - LaTeX compilation errors are expected during editing
      setLivePreviewError('');
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

    // Debounce the compilation - wait longer to avoid compiling during active editing
    const timeoutId = setTimeout(() => {
      compileLivePreview();
    }, 2000); // Increased from 1000ms to 2000ms

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLatexPreview]);

  // Auto-compile when editable content changes
  useEffect(() => {
    if (!activeVariation) return;
    
    // Debounce the compilation to avoid too many API calls (2 seconds)
    const timeoutId = setTimeout(() => {
      compileLivePreview();
    }, 2000);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editableContent.header,
    editableContent.greeting,
    editableContent.opening_paragraph,
    editableContent.body_paragraphs,
    editableContent.closing_paragraph,
    editableContent.complimentary_close
  ]);

  function buildSectionSnapshot(sectionId) {
    if (!activeVariation) return { jsx: null, latex: '' };
    const rewriteState = sectionRewrites[sectionId] || {};
    
    switch (sectionId) {
      case 'content': {
        // Build cover letter text from paragraphs
        const opening = activeVariation.opening_paragraph || '';
        const bodies = activeVariation.body_paragraphs || [];
        const closing = activeVariation.closing_paragraph || '';
        const fullText = [opening, ...bodies, closing].filter(Boolean).join('\n\n');
        
        // Calculate word/character counts
        const words = fullText.trim().split(/\s+/).filter(Boolean).length;
        const chars = fullText.length;
        
        const jsx = (
          <section key="content" className="resume-section card cover-letter-content">
            <h4>Cover Letter Content</h4>
            
            {/* Editing Toolbar */}
            <div className="editing-toolbar">
              <div className="stats-group">
                <span className="stat">
                  <Icon name="type" size="sm" /> {words} words
                </span>
                <span className="stat">
                  <Icon name="file-text" size="sm" /> {chars} characters
                </span>
              </div>
              
              {/* Version History Controls */}
              <div className="version-controls">
                <button
                  type="button"
                  className="btn btn-sm version-btn"
                  onClick={handleUndo}
                  disabled={currentVersionIndex <= 0}
                  title="Undo (Ctrl+Z)"
                >
                  <Icon name="corner-up-left" size="sm" />
                </button>
                <button
                  type="button"
                  className="btn btn-sm version-btn"
                  onClick={handleRedo}
                  disabled={currentVersionIndex >= versionHistory.length - 1}
                  title="Redo (Ctrl+Y)"
                >
                  <Icon name="corner-up-right" size="sm" />
                </button>
                <button
                  type="button"
                  className="btn btn-sm version-btn"
                  onClick={() => setShowVersionHistory(!showVersionHistory)}
                  title="Version History"
                >
                  <Icon name="clock" size="sm" />
                  {versionHistory.length > 0 && (
                    <span className="version-count">{versionHistory.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm version-btn ${grammarIssues.length > 0 ? 'has-issues' : ''} ${isCheckingGrammar ? 'loading' : ''}`}
                  onClick={() => {
                    if (!isCheckingGrammar) {
                      checkGrammar();
                    }
                  }}
                  title="Check Grammar & Style"
                  disabled={isCheckingGrammar}
                >
                  <Icon name="check-circle" size="sm" />
                  {isCheckingGrammar ? (
                    <span className="loading-text">Checking...</span>
                  ) : grammarIssues.length > 0 ? (
                    <span className="issue-count">{grammarIssues.length}</span>
                  ) : null}
                </button>
              </div>
            </div>
            
            {/* Editable Content Area */}
            {fullText ? (
              <div className="cover-letter-editor">
                <div className="paragraph-section">
                  <label className="paragraph-label">Opening Paragraph</label>
                  <textarea
                    className="cover-letter-textarea"
                    value={opening}
                    onChange={(e) => {
                      // Update the result state with new opening paragraph
                      setResult(prev => {
                        if (!prev || !prev.variations) return prev;
                        return {
                          ...prev,
                          variations: prev.variations.map(v => 
                            v.id === activeVariationId 
                              ? { ...v, opening_paragraph: e.target.value }
                              : v
                          )
                        };
                      });
                    }}
                    placeholder="Opening paragraph..."
                    rows={3}
                  />
                </div>
                
                {bodies.map((body, idx) => (
                  <div key={`body-${idx}`} className="paragraph-section">
                    <label className="paragraph-label">Body Paragraph {idx + 1}</label>
                    <textarea
                      className="cover-letter-textarea"
                      value={body}
                      onChange={(e) => {
                        // Update the result state with new body paragraph
                        setResult(prev => {
                          if (!prev || !prev.variations) return prev;
                          return {
                            ...prev,
                            variations: prev.variations.map(v => {
                              if (v.id === activeVariationId) {
                                const newBodyParagraphs = [...(v.body_paragraphs || [])];
                                newBodyParagraphs[idx] = e.target.value;
                                return { ...v, body_paragraphs: newBodyParagraphs };
                              }
                              return v;
                            })
                          };
                        });
                      }}
                      placeholder={`Body paragraph ${idx + 1}...`}
                      rows={4}
                    />
                  </div>
                ))}
                
                <div className="paragraph-section">
                  <label className="paragraph-label">Closing Paragraph</label>
                  <textarea
                    className="cover-letter-textarea"
                    value={closing}
                    onChange={(e) => {
                      // Update the result state with new closing paragraph
                      setResult(prev => {
                        if (!prev || !prev.variations) return prev;
                        return {
                          ...prev,
                          variations: prev.variations.map(v => 
                            v.id === activeVariationId 
                              ? { ...v, closing_paragraph: e.target.value }
                              : v
                          )
                        };
                      });
                    }}
                    placeholder="Closing paragraph..."
                    rows={3}
                  />
                </div>
                
                {/* Editing Tips */}
                <div className="editing-tips">
                  <p className="tip-header"><Icon name="lightbulb" size="sm" /> Editing Tips</p>
                  <ul className="tips-list">
                    <li>Keep your cover letter between 250-400 words for optimal length</li>
                    <li>Use active voice and specific examples from your experience</li>
                    <li>Tailor your content to match the job description</li>
                    <li>Versions are saved automatically after substantial edits</li>
                  </ul>
                </div>
              </div>
            ) : (
              <p className="placeholder">Generate a cover letter to begin editing.</p>
            )}
          </section>
        );
        
        // Generate LaTeX
        const latexLines = [];
        if (opening) latexLines.push(latexEscape(opening));
        bodies.forEach(body => {
          if (body) {
            latexLines.push('');
            latexLines.push(latexEscape(body));
          }
        });
        if (closing) {
          latexLines.push('');
          latexLines.push(latexEscape(closing));
        }
        
        return { jsx, latex: latexLines.join('\n') };
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
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setShowExportModal(true)}
                        disabled={!activeVariation || !livePreviewPdfUrl}
                        title="Export cover letter in various formats"
                      >
                        <Icon name="download" size="sm" /> Export
                      </button>
                    </div>
                  </div>

                  {/* Live Text Editor */}
                  {activeVariation && (
                    <div className="text-editor-column">
                      <h3>Edit Content</h3>
                      <p className="hint">
                        Edit each section directly and watch the PDF update in real-time. 
                        <strong> Tip:</strong> Select any word to see synonym suggestions!
                      </p>
                      
                      {/* UC-060: Word and Character Count Display */}
                      <div className="word-count-display">
                        <div className="count-item">
                          <Icon name="file-text" size="sm" />
                          <span className="count-label">Words:</span>
                          <span className="count-value">{wordCount}</span>
                        </div>
                        <div className="count-item">
                          <Icon name="type" size="sm" />
                          <span className="count-label">Characters:</span>
                          <span className="count-value">{characterCount}</span>
                        </div>
                        {readabilityScore !== null && (
                          <div className="count-item">
                            <Icon name="activity" size="sm" />
                            <span className="count-label">Readability:</span>
                            <span className="count-value">{readabilityScore} ({readabilityLevel})</span>
                            <button
                              type="button"
                              className="ghost tiny"
                              onClick={() => setShowReadabilityPanel(!showReadabilityPanel)}
                              title="View readability details"
                            >
                              <Icon name="info" size="sm" />
                            </button>
                          </div>
                        )}
                        
                        {/* Spacer to push buttons to the right */}
                        <div style={{ flexGrow: 1 }}></div>
                        
                        {/* Version History Controls */}
                        <div className="version-controls">
                          <button
                            type="button"
                            className="btn btn-sm version-btn"
                            onClick={handleUndo}
                            disabled={currentVersionIndex <= 0}
                            title="Undo (Ctrl+Z)"
                          >
                            <Icon name="corner-up-left" size="sm" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm version-btn"
                            onClick={handleRedo}
                            disabled={currentVersionIndex >= versionHistory.length - 1}
                            title="Redo (Ctrl+Y)"
                          >
                            <Icon name="corner-up-right" size="sm" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm version-btn"
                            onClick={() => setShowVersionHistory(!showVersionHistory)}
                            title="Version History"
                          >
                            <Icon name="clock" size="sm" />
                            {versionHistory.length > 0 && (
                              <span className="version-count">{versionHistory.length}</span>
                            )}
                          </button>
                        </div>
                        
                        <button
                          type="button"
                          className={`btn btn-sm ${grammarIssues.length > 0 ? 'has-issues' : ''} ${isCheckingGrammar ? 'loading' : ''}`}
                          onClick={() => {
                            if (!isCheckingGrammar) {
                              checkGrammar();
                            }
                          }}
                          disabled={isCheckingGrammar}
                        >
                          <Icon name="check-circle" size="sm" />
                          {isCheckingGrammar ? (
                            <span className="loading-text">Checking...</span>
                          ) : grammarIssues.length > 0 ? (
                            <>
                              Check Grammar ({grammarIssues.length} {grammarIssues.length === 1 ? 'issue' : 'issues'})
                            </>
                          ) : (
                            'Check Grammar & Style'
                          )}
                        </button>
                      </div>
                      
                      {/* Synonym Hint Banner */}
                      {!showSynonymPanel && !selectedText && (
                        <div className="editor-hint-banner">
                          <Icon name="book" size="sm" />
                          <span>
                            <strong>Pro tip:</strong> Highlight any word in your cover letter to get synonym suggestions and improve your vocabulary
                          </span>
                        </div>
                      )}
                      
                      {/* UC-060: Readability Panel */}
                      {showReadabilityPanel && (
                        <div className="readability-panel">
                          <h4>Readability Analysis</h4>
                          <div className="readability-score">
                            <div className="score-circle">
                              <span className="score-number">{readabilityScore}</span>
                              <span className="score-max">/100</span>
                            </div>
                            <div className="score-description">
                              <strong>{readabilityLevel}</strong>
                              <p>
                                {readabilityScore >= 60 
                                  ? 'Your cover letter is easy to read and understand.' 
                                  : 'Consider simplifying sentences and using shorter words.'}
                              </p>
                            </div>
                          </div>
                          <div className="readability-tips">
                            <h5>Tips to improve:</h5>
                            <ul>
                              <li>Use shorter sentences (15-20 words)</li>
                              <li>Choose simple words over complex ones</li>
                              <li>Break up long paragraphs</li>
                              <li>Use active voice instead of passive</li>
                            </ul>
                          </div>
                        </div>
                      )}
                      
                      {/* UC-060: Restructuring Suggestions Panel */}
                      {restructuringSuggestions.length > 0 && (
                        <div className="restructuring-panel">
                          <div className="panel-header">
                            <h4>
                              <Icon name="zap" size="sm" /> Improvement Suggestions ({restructuringSuggestions.length})
                            </h4>
                            <button
                              type="button"
                              className="ghost tiny"
                              onClick={() => setShowRestructuringPanel(!showRestructuringPanel)}
                              title={showRestructuringPanel ? 'Hide suggestions' : 'Show suggestions'}
                            >
                              <Icon name={showRestructuringPanel ? 'chevron-up' : 'chevron-down'} size="sm" />
                            </button>
                          </div>
                          {showRestructuringPanel && (
                            <div className="suggestions-list">
                              {restructuringSuggestions.map((suggestion) => (
                                <div key={suggestion.id} className={`suggestion-item severity-${suggestion.severity}`}>
                                  <div className="suggestion-icon">
                                    {suggestion.severity === 'medium' && <Icon name="alert-circle" size="sm" />}
                                    {suggestion.severity === 'low' && <Icon name="info" size="sm" />}
                                  </div>
                                  <div className="suggestion-content">
                                    <strong>{suggestion.title}</strong>
                                    <p>{suggestion.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* UC-060: Synonym Panel */}
                      {showSynonymPanel && selectedText && (
                        <div className="synonym-panel">
                          <div className="panel-header">
                            <h4>
                              <Icon name="book" size="sm" /> Synonyms for "{selectedText}"
                            </h4>
                            <button
                              type="button"
                              className="ghost tiny"
                              onClick={() => setShowSynonymPanel(false)}
                              title="Close"
                            >
                              <Icon name="x" size="sm" />
                            </button>
                          </div>
                          {synonymLoading ? (
                            <div className="synonym-loading">Loading synonyms...</div>
                          ) : synonymSuggestions.length > 0 ? (
                            <div className="synonym-list">
                              {synonymSuggestions.map((synonym, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  className="synonym-button"
                                  onClick={() => replaceSynonym(synonym)}
                                  title={`Replace with "${synonym}"`}
                                >
                                  {synonym}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="no-synonyms">No synonyms found for this word.</p>
                          )}
                        </div>
                      )}
                      
                      <div className="editor-sections">
                        {/* Header Section */}
                        <div className="editor-section">
                          <label htmlFor="header-field">
                            <Icon name="user" size="sm" /> Header (Name & Contact)
                          </label>
                          <textarea
                            id="header-field"
                            value={editableContent.header}
                            onChange={(e) => handleContentChange('header', e.target.value)}
                            placeholder="Your Name\nyour.email@example.com | (555) 123-4567 | City, State"
                            rows={3}
                          />
                        </div>

                        {/* Greeting Section */}
                        <div className="editor-section">
                          <label htmlFor="greeting-field">
                            <Icon name="mail" size="sm" /> Greeting
                          </label>
                          <input
                            id="greeting-field"
                            type="text"
                            value={editableContent.greeting}
                            onChange={(e) => handleContentChange('greeting', e.target.value)}
                            placeholder="Dear Hiring Manager,"
                          />
                        </div>

                        {/* Opening Paragraph */}
                        <div className="editor-section">
                          <label htmlFor="opening-field">
                            <Icon name="align-left" size="sm" /> Opening Paragraph
                          </label>
                          <textarea
                            id="opening-field"
                            value={editableContent.opening_paragraph}
                            onChange={(e) => handleContentChange('opening_paragraph', e.target.value)}
                            onMouseUp={handleTextSelection}
                            placeholder="I am writing to express my strong interest in..."
                            rows={4}
                          />
                        </div>

                        {/* Body Paragraphs */}
                        <div className="editor-section">
                          <div className="section-header">
                            <label>
                              <Icon name="file-text" size="sm" /> Body Paragraphs
                            </label>
                            <button
                              type="button"
                              className="ghost tiny"
                              onClick={addBodyParagraph}
                              title="Add paragraph"
                            >
                              <Icon name="plus" size={14} /> Add Paragraph
                            </button>
                          </div>
                          {editableContent.body_paragraphs.map((paragraph, index) => (
                            <div key={index} className="paragraph-group">
                              <div className="paragraph-header">
                                <span className="paragraph-number">Paragraph {index + 1}</span>
                                {editableContent.body_paragraphs.length > 1 && (
                                  <button
                                    type="button"
                                    className="ghost danger"
                                    onClick={() => removeBodyParagraph(index)}
                                    title="Remove paragraph"
                                  >
                                    <Icon name="trash-2" size={14} />
                                  </button>
                                )}
                              </div>
                              <textarea
                                value={paragraph}
                                onChange={(e) => handleBodyParagraphChange(index, e.target.value)}
                                onMouseUp={handleTextSelection}
                                placeholder="Describe your experience, skills, or achievements..."
                                rows={4}
                              />
                            </div>
                          ))}
                        </div>

                        {/* Closing Paragraph */}
                        <div className="editor-section">
                          <label htmlFor="closing-field">
                            <Icon name="check-circle" size="sm" /> Closing Paragraph
                          </label>
                          <textarea
                            id="closing-field"
                            value={editableContent.closing_paragraph}
                            onChange={(e) => handleContentChange('closing_paragraph', e.target.value)}
                            onMouseUp={handleTextSelection}
                            placeholder="Thank you for considering my application..."
                            rows={3}
                          />
                        </div>

                        {/* Complimentary Close */}
                        <div className="editor-section">
                          <label htmlFor="complimentary-close-field">
                            <Icon name="edit-3" size="sm" /> Complimentary Close
                          </label>
                          <input
                            id="complimentary-close-field"
                            type="text"
                            value={editableContent.complimentary_close}
                            onChange={(e) => handleContentChange('complimentary_close', e.target.value)}
                            placeholder="Sincerely,"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </section>

              {/* Variation/resume preview card removed — cover letter page does not include the resume variation card */}
            </div>
          </section>
        </>
      )}
      
      {/* Grammar & Style Check Sidebar Modal */}
      {showGrammarPanel && (
        <>
          <div className="grammar-sidebar-overlay" onClick={() => setShowGrammarPanel(false)} />
          <div className="grammar-sidebar">
            <div className="grammar-sidebar-header">
              <h3>
                <Icon name="check-circle" size="md" />
                Grammar & Style
              </h3>
              <div className="header-actions">
                <button 
                  type="button" 
                  className="recheck-btn"
                  onClick={recheckGrammar}
                  title="Recheck grammar"
                >
                  <Icon name="refresh-cw" size="sm" />
                  Recheck
                </button>
                <button 
                  type="button" 
                  className="close-btn"
                  onClick={() => setShowGrammarPanel(false)}
                  aria-label="Close"
                >
                  <Icon name="x" size="md" />
                </button>
              </div>
            </div>
            
            <div className="grammar-sidebar-content">
              {grammarIssues.length === 0 ? (
                <div className="no-issues-state">
                  <Icon name="check-circle" size="xl" />
                  <h4>Looking good!</h4>
                  <p>No grammar or style issues detected in your cover letter.</p>
                </div>
              ) : (
                <>
                  <div className="issues-summary">
                    <div className="summary-content">
                      <span className="issue-count-large">{grammarIssues.length}</span>
                      <span className="issue-label">
                        {grammarIssues.length === 1 ? 'issue found' : 'issues found'}
                      </span>
                    </div>
                    <Icon name="alert-circle" size="lg" />
                  </div>
                  
                  <div className="grammar-issues-list">
                    {grammarIssues.map((issue) => (
                      <div key={issue.id} className={`grammar-issue issue-${issue.type} ${issue.canAutoFix ? 'fixable' : ''}`}>
                        <div className="issue-header">
                          <span className="issue-type-badge">{issue.type}</span>
                          <span className="issue-text">"{issue.text}"</span>
                        </div>
                        <div className="issue-details">
                          <p className="issue-message">{issue.message}</p>
                          <p className="issue-suggestion">
                            <Icon name="arrow-right" size="sm" /> {issue.suggestion}
                          </p>
                        </div>
                        <div className="issue-actions">
                          {issue.canAutoFix && (
                            <button
                              type="button"
                              className="fix-btn"
                              onClick={() => applyGrammarFix(issue)}
                            >
                              <Icon name="check" size="sm" />
                              Apply Fix
                            </button>
                          )}
                          <button
                            type="button"
                            className="ignore-btn"
                            onClick={() => ignoreGrammarIssue(issue.id)}
                            title="Ignore this suggestion"
                          >
                            <Icon name="clear" size="sm" />
                            Ignore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
      
      {/* Version History Sidebar Modal */}
      {showVersionHistory && (
        <>
          <div className="grammar-sidebar-overlay" onClick={() => setShowVersionHistory(false)} />
          <div className="grammar-sidebar">
            <div className="grammar-sidebar-header">
              <h3>
                <Icon name="clock" size="sm" />
                Version History
              </h3>
              <button 
                type="button" 
                className="close-btn"
                onClick={() => setShowVersionHistory(false)}
                aria-label="Close"
              >
                <Icon name="clear" size="md" />
              </button>
            </div>
            
            <div className="grammar-sidebar-content">
              {versionHistory.length === 0 ? (
                <div className="no-issues-state">
                  <Icon name="clock" size="xl" />
                  <h4>No versions yet</h4>
                  <p>Start editing your cover letter to create version snapshots.</p>
                </div>
              ) : (
                <>
                  <div className="issues-summary">
                    <span className="issue-count-large">{versionHistory.length}</span>
                    <span className="issue-label">
                      {versionHistory.length === 1 ? 'version' : 'versions'} saved
                    </span>
                  </div>
                  
                  <div className="grammar-issues-list">
                    {versionHistory.map((version, idx) => (
                      <div 
                        key={version.timestamp} 
                        className={`grammar-issue ${idx === currentVersionIndex ? 'active-version' : ''}`}
                      >
                        <div className="issue-header">
                          <Icon name="clock" size="sm" />
                          <div className="issue-details">
                            <span className="issue-type">Version {versionHistory.length - idx}</span>
                            <span className="issue-message">{version.label}</span>
                            {idx === currentVersionIndex && (
                              <span className="current-badge" style={{ 
                                display: 'inline-block',
                                marginLeft: '8px',
                                padding: '2px 8px',
                                backgroundColor: '#10b981',
                                color: 'white',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600'
                              }}>Current</span>
                            )}
                          </div>
                        </div>
                        
                        {idx !== currentVersionIndex && (
                          <div className="issue-actions">
                            <button
                              type="button"
                              className="fix-btn"
                              onClick={() => restoreVersion(idx)}
                              title="Restore this version"
                            >
                              <Icon name="corner-up-left" size="sm" />
                              Restore
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
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

      {/* UC-061: Export Modal */}
      {showExportModal && (
        <div className="export-modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="export-modal" onClick={(e) => e.stopPropagation()}>
            <div className="export-modal-header">
              <div>
                <h3>
                  <Icon name="download" size="sm" /> Export Cover Letter
                </h3>
                <p className="hint">Choose format, theme, and customization options</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowExportModal(false)}
                aria-label="Close export dialog"
              >
                <Icon name="x" size="md" />
              </button>
            </div>

            <div className="export-modal-body">
              <div className="export-control-group">
                <label htmlFor="export-format">
                  <Icon name="file-text" size="sm" /> Format
                </label>
                <select
                  id="export-format"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  disabled={isExporting}
                >
                  <option value="pdf">PDF Document (.pdf)</option>
                  <option value="docx">Word Document (.docx)</option>
                  <option value="html">HTML</option>
                  <option value="txt">Plain Text</option>
                </select>
                <p className="field-hint">
                  {exportFormat === 'pdf' && 'Professional PDF format - ready to submit'}
                  {exportFormat === 'docx' && 'Editable Microsoft Word format'}
                  {exportFormat === 'html' && 'Web-ready HTML with inline styles'}
                  {exportFormat === 'txt' && 'Simple plain text for email applications'}
                </p>
              </div>

              <div className="export-control-group">
                <label htmlFor="export-theme">
                  <Icon name="palette" size="sm" /> Theme
                </label>
                <select
                  id="export-theme"
                  value={exportTheme}
                  onChange={(e) => setExportTheme(e.target.value)}
                  disabled={isExporting}
                >
                  {availableThemes.length > 0 ? (
                    availableThemes.map((theme) => (
                      <option key={theme} value={theme}>
                        {theme.charAt(0).toUpperCase() + theme.slice(1)}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="professional">Professional</option>
                      <option value="modern">Modern</option>
                      <option value="minimal">Minimal</option>
                      <option value="creative">Creative</option>
                      <option value="formal">Formal</option>
                    </>
                  )}
                </select>
                <p className="field-hint">Visual style and formatting</p>
              </div>

              <div className="export-control-group">
                <label htmlFor="export-watermark">
                  <Icon name="droplet" size="sm" /> Watermark (optional)
                </label>
                <input
                  id="export-watermark"
                  type="text"
                  placeholder="e.g., CONFIDENTIAL, DRAFT"
                  value={exportWatermark}
                  onChange={(e) => setExportWatermark(e.target.value)}
                  disabled={isExporting}
                  maxLength={50}
                />
                <p className="field-hint">Adds text overlay to the document</p>
              </div>

              <div className="export-info-box">
                <Icon name="info" size="sm" />
                <div>
                  <strong>Filename will be generated automatically</strong>
                  <p>Based on your name, company, and role for easy organization</p>
                </div>
              </div>

              {exportError && (
                <div className="export-error-message" role="alert">
                  <Icon name="alert-circle" size="sm" />
                  {exportError}
                </div>
              )}
            </div>

            <div className="export-modal-footer">
              <button
                type="button"
                className="ghost"
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleExportCoverLetter}
                disabled={isExporting || !liveLatexPreview}
              >
                {isExporting ? (
                  <>
                    <LoadingSpinner size="sm" /> Exporting...
                  </>
                ) : (
                  <>
                    <Icon name="download" size="sm" /> Export Cover Letter
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

export default AiCoverLetterGenerator;
