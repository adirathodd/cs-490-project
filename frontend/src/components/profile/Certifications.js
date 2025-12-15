import React, { useEffect, useMemo, useRef, useState } from 'react';
import { certificationsAPI } from '../../services/api';
import './Certifications.css';
import Icon from '../common/Icon';
import RichTextEditor from '../common/RichTextEditor';
import { sanitizeRichText } from '../../utils/sanitizeRichText';

const platformPresets = [
  'Credly',
  'HackerRank',
  'LeetCode',
  'Codecademy',
  'Coursera',
  'Udacity',
  'edX',
  'Pluralsight',
  'Microsoft Learn',
  'Google Cloud Skill Boost',
];

const scoreUnitOptions = [
  { value: 'points', label: 'Points' },
  { value: 'percentile', label: 'Percentile' },
  { value: 'rank', label: 'Rank' },
  { value: 'score', label: 'Score' },
];

const MAX_DESCRIPTION_CHARS = 1200;

const createDefaultForm = () => ({
  name: '',
  issuing_organization: '',
  issue_date: '',
  expiry_date: '',
  does_not_expire: false,
  credential_id: '',
  credential_url: '',
  category: '',
  verification_status: 'unverified',
  renewal_reminder_enabled: false,
  reminder_days_before: 30,
  document: null,
  description: '',
  achievement_highlights: '',
  assessment_score: '',
  assessment_max_score: '',
  assessment_units: 'points',
  badge_image: null,
  badge_image_url: '',
  badge_image_removed: false,
});

const formatAssessmentScore = (item = {}) => {
  const { assessment_score, assessment_max_score, assessment_units } = item;
  if (assessment_score === undefined || assessment_score === null || assessment_score === '') return '';
  const scoreNum = Number(assessment_score);
  const formattedScore = Number.isFinite(scoreNum) ? (Number.isInteger(scoreNum) ? `${scoreNum}` : scoreNum.toFixed(2)) : `${assessment_score}`;
  const max = assessment_max_score ?? '';
  const formattedMax = max !== '' ? `/${max}` : '';
  const units = assessment_units ? ` ${assessment_units}` : '';
  return `${formattedScore}${formattedMax}${units}`;
};

const verificationProviders = [
  {
    key: 'credly',
    label: 'Credly',
    domains: ['credly.com', 'youracclaim.com'],
    cardTitle: 'Credly Verified',
    cardDescription: 'This certification links to a live Credly badge signed by the issuing organization.',
    buttonLabel: 'View on Credly',
    formMessage: 'Your certification card will callout the Credly badge for instant proof.',
  },
  {
    key: 'hackerrank',
    label: 'HackerRank',
    domains: ['hackerrank.com'],
    cardTitle: 'HackerRank Credential',
    cardDescription: 'Recruiters can verify your HackerRank challenge results directly.',
    buttonLabel: 'Open HackerRank',
    formMessage: 'We’ll add a HackerRank verification chip so companies can see your coding score.',
  },
  {
    key: 'leetcode',
    label: 'LeetCode',
    domains: ['leetcode.com'],
    cardTitle: 'LeetCode Proof',
    cardDescription: 'This link opens your LeetCode credential or contest summary for validation.',
    buttonLabel: 'Open LeetCode',
    formMessage: 'We’ll highlight this as a LeetCode-backed achievement on your card.',
  },
  {
    key: 'coursera',
    label: 'Coursera',
    domains: ['coursera.org'],
    cardTitle: 'Coursera Verified',
    cardDescription: 'The link leads to Coursera’s verified certificate page with issuer details.',
    buttonLabel: 'View on Coursera',
    formMessage: 'Your Coursera verification link will be showcased for employers.',
  },
  {
    key: 'codecademy',
    label: 'Codecademy',
    domains: ['codecademy.com'],
    cardTitle: 'Codecademy Credential',
    cardDescription: 'Codecademy hosts the signed certificate for this skill path.',
    buttonLabel: 'Open Codecademy',
    formMessage: 'We’ll flag this as a Codecademy credential so teams can confirm it.',
  },
  {
    key: 'udacity',
    label: 'Udacity',
    domains: ['udacity.com'],
    cardTitle: 'Udacity Nanodegree',
    cardDescription: 'This Nanodegree link includes project evidence and verification.',
    buttonLabel: 'Open Udacity',
    formMessage: 'Your Udacity verification link will be prominently displayed.',
  },
  {
    key: 'edx',
    label: 'edX',
    domains: ['edx.org'],
    cardTitle: 'edX Verified',
    cardDescription: 'edX hosts this verified certificate with issuer-backed metadata.',
    buttonLabel: 'View on edX',
    formMessage: 'We’ll show this as an edX verified credential on your card.',
  },
  {
    key: 'pluralsight',
    label: 'Pluralsight',
    domains: ['pluralsight.com'],
    cardTitle: 'Pluralsight Assessment',
    cardDescription: 'Talent can confirm your Pluralsight assessment or course completion here.',
    buttonLabel: 'Open Pluralsight',
    formMessage: 'We’ll flag the link as a Pluralsight credential.',
  },
  {
    key: 'microsoft',
    label: 'Microsoft Learn',
    domains: ['learn.microsoft.com', 'microsoft.com/learn'],
    cardTitle: 'Microsoft Learn Credential',
    cardDescription: 'This Microsoft Learn link opens the official transcript or badge.',
    buttonLabel: 'View on Microsoft',
    formMessage: 'We’ll highlight it as a Microsoft Learn credential.',
  },
  {
    key: 'gcloud',
    label: 'Google Cloud Skill Boost',
    domains: ['cloudskillsboost.google', 'qwiklabs.com'],
    cardTitle: 'Google Cloud Skill Boost',
    cardDescription: 'Google Cloud Skill Boost hosts the quest or lab completion proof.',
    buttonLabel: 'View on Google Cloud',
    formMessage: 'We’ll show a Google Cloud Skill Boost verification pill.',
  },
];

const verificationExamples = verificationProviders
  .map((provider) => provider.label)
  .slice(0, 4)
  .join(', ');

const isImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url.split('?')[0]);
};

const getVerificationMeta = (url) => {
  if (!url || typeof url !== 'string') return null;
  const lower = url.toLowerCase();
  const provider = verificationProviders.find((entry) => entry.domains.some((domain) => lower.includes(domain)));
  return provider || null;
};

const statusBadge = (status, labelOverride) => {
  switch (status) {
    case 'verified':
      return <span className="badge verified">{labelOverride || 'Verified'}</span>;
    case 'pending':
      return <span className="badge pending">Pending</span>;
    case 'rejected':
      return <span className="badge rejected">Rejected</span>;
    default:
      return <span className="badge unverified">Unverified</span>;
  }
};

const Certifications = () => {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(() => createDefaultForm());
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [orgQuery, setOrgQuery] = useState('');
  const [orgSuggestions, setOrgSuggestions] = useState([]);
  const [showOrgSuggestions, setShowOrgSuggestions] = useState(false);
  const [orgActiveIndex, setOrgActiveIndex] = useState(-1);
  const [activeCategory, setActiveCategory] = useState('all');
  const orgBoxRef = useRef(null);
  const orgInputRef = useRef(null);
  const docInputRef = useRef(null);
  const badgeInputRef = useRef(null);
  const docPickerLockRef = useRef(false);
  const badgePickerLockRef = useRef(false);
  const formCardRef = useRef(null);
  const firstFieldRef = useRef(null);
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);
  const [isDraggingBadge, setIsDraggingBadge] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [cats, certs] = await Promise.all([
          certificationsAPI.getCategories(),
          certificationsAPI.getCertifications(),
        ]);
        setCategories(cats || []);
        setItems(sortCerts(certs || []));
      } catch (e) {
        setError(e?.message || 'Failed to load certifications');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const q = form.issuing_organization.trim();
    setOrgQuery(q);
  }, [form.issuing_organization]);

  useEffect(() => {
    let active = true;
    const fetch = async () => {
      if (orgQuery.length < 2) { setOrgSuggestions([]); return; }
      try {
        const res = await certificationsAPI.searchOrganizations(orgQuery, 8);
        if (active) setOrgSuggestions(res || []);
      } catch (_) {
        if (active) setOrgSuggestions([]);
      }
    };
    fetch();
    return () => { active = false; };
  }, [orgQuery]);

  // Reset active index when suggestions change or query resets
  useEffect(() => {
    setOrgActiveIndex(-1);
  }, [orgSuggestions, orgQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (orgBoxRef.current && !orgBoxRef.current.contains(e.target)) {
        setShowOrgSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const sortCerts = (arr) => {
    const toNum = (d) => (d ? Date.parse(d) : 0);
    return [...(arr || [])].sort((a, b) => {
      // sort by expiry proximity: expired first? We'll sort by days until expiration ascending; never expires last
      const aNever = !!a.does_not_expire;
      const bNever = !!b.does_not_expire;
      if (aNever !== bNever) return aNever ? 1 : -1;
      const aDays = a.days_until_expiration ?? 999999;
      const bDays = b.days_until_expiration ?? 999999;
      if (aDays !== bDays) return aDays - bDays;
      // fallback to issue_date desc
      return toNum(b.issue_date) - toNum(a.issue_date);
    });
  };

  const resetForm = () => {
    setForm(createDefaultForm());
    setFieldErrors({});
    setEditingId(null);
    setShowForm(false);
    setOrgSuggestions([]);
    setShowOrgSuggestions(false);
  };

  const onChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'file') {
      setForm((prev) => ({ ...prev, [name]: files && files.length ? files[0] : null }));
    } else {
      setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
      if (fieldErrors[name]) {
        setFieldErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
      }
    }
  };

  const openFileDialog = (inputRef, lockRef) => {
    const input = inputRef?.current;
    if (!input || lockRef.current) return;
    lockRef.current = true;
    const release = () => {
      lockRef.current = false;
      input.removeEventListener('change', release);
    };
    input.addEventListener('change', release);
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.click();
    }
    setTimeout(() => {
      input.removeEventListener('change', release);
      lockRef.current = false;
    }, 1200);
  };

  // Upload helpers for document drag & drop (single file)
  const openDocDialog = () => openFileDialog(docInputRef, docPickerLockRef);

  const onDocDragOver = (ev) => {
    ev.preventDefault();
    if (!isDraggingDoc) setIsDraggingDoc(true);
  };

  const onDocDragLeave = (ev) => {
    ev.preventDefault();
    setIsDraggingDoc(false);
  };

  const onDocDrop = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    setIsDraggingDoc(false);
    const dt = ev.dataTransfer;
    if (!dt) return;
    const file = (dt.files && dt.files[0]) || null;
    if (!file) return;
    const ok = [
      'application/pdf',
      'image/png',
      'image/jpeg',
    ];
    if (!ok.includes(file.type)) return;
    setForm((prev) => ({ ...prev, document: file }));
  };

  const removeDocument = () => setForm((prev) => ({ ...prev, document: null }));
  const openBadgeDialog = () => openFileDialog(badgeInputRef, badgePickerLockRef);

  const onBadgeDragOver = (ev) => {
    ev.preventDefault();
    if (!isDraggingBadge) setIsDraggingBadge(true);
  };

  const onBadgeDragLeave = (ev) => {
    ev.preventDefault();
    setIsDraggingBadge(false);
  };

  const onBadgeDrop = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    setIsDraggingBadge(false);
    const dt = ev.dataTransfer;
    if (!dt) return;
    const file = (dt.files && dt.files[0]) || null;
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setForm((prev) => ({ ...prev, badge_image: file, badge_image_removed: false }));
  };

  const removeBadgeImage = () => {
    setForm((prev) => ({
      ...prev,
      badge_image: null,
      badge_image_url: '',
      badge_image_removed: true,
    }));
  };

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let i = -1;
    do { bytes = bytes / 1024; i++; } while (bytes >= 1024 && i < units.length - 1);
    return `${bytes.toFixed(bytes >= 100 ? 0 : bytes >= 10 ? 1 : 2)} ${units[i]}`;
  };

  const docPreview = useMemo(() => {
    if (!form.document) return null;
    if (form.document.type?.startsWith('image/')) {
      const url = URL.createObjectURL(form.document);
      return { kind: 'image', url };
    }
    return { kind: 'file' };
  }, [form.document]);

  const badgePreview = useMemo(() => {
    if (form.badge_image instanceof File) {
      return { source: 'file', url: URL.createObjectURL(form.badge_image) };
    }
    if (form.badge_image_url) {
      return { source: 'existing', url: form.badge_image_url };
    }
    return null;
  }, [form.badge_image, form.badge_image_url]);

  useEffect(() => {
    return () => {
      if (docPreview?.kind === 'image' && docPreview.url) {
        URL.revokeObjectURL(docPreview.url);
      }
    };
  }, [docPreview]);

  useEffect(() => {
    return () => {
      if (badgePreview?.source === 'file' && badgePreview.url) {
        URL.revokeObjectURL(badgePreview.url);
      }
    };
  }, [badgePreview]);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Certification name is required';
    if (!form.issuing_organization.trim()) errs.issuing_organization = 'Issuing organization is required';
    if (!form.issue_date) errs.issue_date = 'Date earned is required';
    if (!form.does_not_expire && !form.expiry_date) {
      errs.expiry_date = 'Expiration date required unless does not expire';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const toPayload = (data) => {
    const payload = { ...data };
    if (payload.does_not_expire) payload.expiry_date = null;
    if (!payload.category) delete payload.category;
    if (!payload.credential_id) delete payload.credential_id;
    if (!payload.credential_url) delete payload.credential_url;
    const normalizedDescription = sanitizeRichText(payload.description || '');
    if (normalizedDescription) {
      payload.description = normalizedDescription;
    } else {
      delete payload.description;
    }
    const achievements = (payload.achievement_highlights || '').trim();
    if (achievements) {
      payload.achievement_highlights = achievements;
    } else {
      delete payload.achievement_highlights;
    }
    const toNumber = (value) => {
      if (value === '' || value === null || value === undefined) return null;
      const num = parseFloat(value);
      return Number.isFinite(num) ? num : null;
    };
    const score = toNumber(payload.assessment_score);
    const maxScore = toNumber(payload.assessment_max_score);
    const hasScore = score !== null;
    const hasMax = maxScore !== null;
    if (hasScore) payload.assessment_score = score;
    else delete payload.assessment_score;
    if (hasMax) payload.assessment_max_score = maxScore;
    else delete payload.assessment_max_score;
    if (!payload.assessment_units || (!hasScore && !hasMax)) {
      delete payload.assessment_units;
    }
    // Don't send document if none
    if (!payload.document) delete payload.document;
    if (payload.badge_image instanceof File) {
      // keep file reference
    } else if (payload.badge_image_removed) {
      payload.badge_image = null;
    } else {
      delete payload.badge_image;
    }
    delete payload.badge_image_url;
    delete payload.badge_image_removed;
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setSaving(true);
    const payload = toPayload(form);
    try {
      if (editingId) {
        const updated = await certificationsAPI.updateCertification(editingId, payload);
        setItems((prev) => sortCerts((prev || []).map((i) => (i.id === editingId ? updated : i))));
      } else {
        const created = await certificationsAPI.addCertification(payload);
        setItems((prev) => sortCerts([...(prev || []), created]));
      }
      resetForm();
    } catch (e2) {
      if (e2?.details) setFieldErrors(e2.details);
      setError(e2?.message || 'Failed to save certification');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      ...createDefaultForm(),
      name: item.name || '',
      issuing_organization: item.issuing_organization || '',
      issue_date: item.issue_date || '',
      expiry_date: item.expiry_date || '',
      does_not_expire: !!item.does_not_expire,
      credential_id: item.credential_id || '',
      credential_url: item.credential_url || '',
      category: item.category || '',
      verification_status: item.verification_status || 'unverified',
      renewal_reminder_enabled: !!item.renewal_reminder_enabled,
      reminder_days_before: item.reminder_days_before ?? 30,
      document: null,
      description: item.description || '',
      achievement_highlights: item.achievement_highlights || '',
      assessment_score: item.assessment_score != null ? String(item.assessment_score) : '',
      assessment_max_score: item.assessment_max_score != null ? String(item.assessment_max_score) : '',
      assessment_units: item.assessment_units || 'points',
      badge_image: null,
      badge_image_url: item.badge_image_url || '',
      badge_image_removed: false,
    });
    setFieldErrors({});
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      await certificationsAPI.deleteCertification(id);
      setItems((prev) => (prev || []).filter((i) => i.id !== id));
      if (editingId === id) resetForm();
      setDeleteConfirm(null);
    } catch (e) {
      setError(e?.message || 'Failed to delete');
    }
  };

  const pickSuggestion = (value) => {
    setForm((prev) => ({ ...prev, issuing_organization: value }));
    setShowOrgSuggestions(false);
  };

  const getActiveOrgSuggestions = () => {
    const baseResults = orgQuery.length >= 2 ? (orgSuggestions || []) : [];
    const normalize = (value) => (typeof value === 'string' ? value.toLowerCase() : value);
    const existing = new Set((baseResults || []).map((entry) => normalize(entry)));
    const extras = platformPresets.filter((preset) => !existing.has(normalize(preset)));
    return [...baseResults, ...extras];
  };

  const handleOrgKeyDown = (e) => {
    const suggestions = getActiveOrgSuggestions();
    if (!showOrgSuggestions && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setShowOrgSuggestions(true);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOrgActiveIndex((idx) => Math.min(idx + 1, (suggestions.length || 1) - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOrgActiveIndex((idx) => Math.max(idx - 1, 0));
    } else if (e.key === 'Enter') {
      if (showOrgSuggestions && orgActiveIndex >= 0 && suggestions[orgActiveIndex]) {
        e.preventDefault();
        pickSuggestion(suggestions[orgActiveIndex]);
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setShowOrgSuggestions(false);
    }
  };

  const groupedCerts = useMemo(() => {
    const grouped = (items || []).reduce((acc, cert) => {
      const key = cert.category || 'Uncategorized';
      if (!acc[key]) acc[key] = [];
      acc[key].push(cert);
      return acc;
    }, {});
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, certs]) => [key, sortCerts(certs)]);
  }, [items]);

  const stats = useMemo(() => {
    const total = items?.length || 0;
    let verified = 0;
    let expiringSoon = 0;
    let assessmentCount = 0;
    const categoryCount = {};
    (items || []).forEach((cert) => {
      const meta = getVerificationMeta(cert.credential_url);
      if (cert.verification_status === 'verified' || meta) verified += 1;
      if (!cert.is_expired && cert.days_until_expiration != null && cert.days_until_expiration <= 45) {
        expiringSoon += 1;
      }
      if (cert.assessment_score !== null && cert.assessment_score !== undefined && cert.assessment_score !== '') {
        assessmentCount += 1;
      }
      const cat = cert.category || 'Uncategorized';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    const topCategory = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key)[0] || null;
    return { total, verified, expiringSoon, assessmentCount, topCategory };
  }, [items]);

  const categoryNav = useMemo(() => (groupedCerts || []).map(([key, certs]) => ({
    key,
    count: certs.length,
  })), [groupedCerts]);

  const visibleGroups = activeCategory === 'all'
    ? groupedCerts
    : groupedCerts.filter(([key]) => key === activeCategory);

  const hasCerts = (items || []).length > 0;
  const credentialVerificationMeta = useMemo(
    () => getVerificationMeta(form.credential_url),
    [form.credential_url],
  );
  const formDisplayedVerification = credentialVerificationMeta ? 'verified' : form.verification_status;
  const descriptionStats = useMemo(() => {
    const sanitized = sanitizeRichText(form.description || '');
    const plain = sanitized.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const chars = plain ? plain.length : 0;
    const words = plain ? plain.split(' ').filter(Boolean).length : 0;
    return { chars, words };
  }, [form.description]);
  const descriptionLimitReached = descriptionStats.chars >= MAX_DESCRIPTION_CHARS;

  useEffect(() => {
    if (activeCategory !== 'all' && !categoryNav.some((cat) => cat.key === activeCategory)) {
      setActiveCategory('all');
    }
  }, [activeCategory, categoryNav]);

  useEffect(() => {
    if (showForm) {
      requestAnimationFrame(() => {
        formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        firstFieldRef.current?.focus({ preventScroll: true });
        if (firstFieldRef.current?.select) {
          firstFieldRef.current.select();
        }
      });
    }
  }, [showForm]);

  const renderCertificationCard = (item) => {
    const descriptionHtml = sanitizeRichText(item.description || '');
    const hasDescription = !!descriptionHtml;
    const achievements = (item.achievement_highlights || '').trim();
    const assessmentDisplay = formatAssessmentScore(item);
    const hasImageDocument = isImageUrl(item.document_url);
    const verificationMeta = getVerificationMeta(item.credential_url);
    const inferredStatus = verificationMeta ? 'verified' : item.verification_status;
    const badgeLabel = verificationMeta ? verificationMeta.cardTitle : undefined;
    const credentialLinkLabel = verificationMeta ? verificationMeta.buttonLabel : 'Verify Credential';

    return (
      <div key={item.id} className={`certification-item ${item.is_expired ? 'expired' : ''}`}>
        <div className="certification-item-header">
          <div className="certification-item-media">
            {item.badge_image_url ? (
              <img
                src={item.badge_image_url}
                alt={`${item.name} badge`}
                className="certification-badge-image"
              />
            ) : (
              <div className="certification-badge-placeholder" aria-hidden="true">
                <Icon name="cert" size="md" ariaLabel="Badge placeholder" />
                <span>Badge</span>
              </div>
            )}
            {assessmentDisplay && (
              <div className="assessment-score-chip" aria-label={`Assessment score ${assessmentDisplay}`}>
                <span>Score</span>
                <strong>{assessmentDisplay}</strong>
              </div>
            )}
          </div>
          <div className="certification-item-main">
            <div className="certification-item-title-row">
              <div className="certification-item-title">
                {item.name}
              </div>
              {statusBadge(inferredStatus, badgeLabel)}
            </div>
            <div className="certification-item-sub">
              <span className="organization"><Icon name="link" size="sm" /> {item.issuing_organization}</span>
              {item.category && <span className="cert-category-badge">{item.category}</span>}
            </div>
            <div className="certification-item-dates">
              <span className="dates">Earned {item.issue_date}</span>
              {item.does_not_expire ? (
                <span className="no-expiry"> • Does not expire</span>
              ) : item.expiry_date ? (
                <>
                  <span> • Expires {item.expiry_date}</span>
                  {item.is_expired ? (
                    <span className="status-badge expired">Expired</span>
                  ) : item.days_until_expiration != null && (
                    <span className="status-badge expiring-soon">{item.days_until_expiration} days left</span>
                  )}
                </>
              ) : null}
            </div>
          </div>
          <div className="certification-item-actions">
            <button 
              className="edit-button"
              onClick={() => startEdit(item)}
              title="Edit"
            >
              <Icon name="edit" size="sm" ariaLabel="Edit" />
            </button>
            <button 
              className="delete-button"
              onClick={() => setDeleteConfirm(item.id)}
              title="Delete"
            >
              <Icon name="trash" size="sm" ariaLabel="Delete" />
            </button>
          </div>
        </div>

        {(item.credential_id || item.credential_url || item.document_url || hasDescription || achievements) && (
          <div className="certification-item-details">
            {hasDescription && (
              <div className="certification-description" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
            )}
            {achievements && (
              <div className="certification-achievement">
                <span role="img" aria-label="Achievement">🏆</span>
                {achievements}
              </div>
            )}
            {item.credential_id && (
              <div><strong>Credential ID:</strong> {item.credential_id}</div>
            )}
            {item.credential_url && (
              <div className="credential-link">
                <Icon name="link" size="sm" />
                <a href={item.credential_url} target="_blank" rel="noreferrer">
                  {credentialLinkLabel}
                </a>
              </div>
            )}
            {verificationMeta && (
              <div className={`verification-card accent-${verificationMeta.key}`}>
                <div>
                  <strong>{verificationMeta.cardTitle}</strong>
                  <p>{verificationMeta.cardDescription}</p>
                </div>
                <a
                  href={item.credential_url}
                  target="_blank"
                  rel="noreferrer"
                  className={`verification-button accent-${verificationMeta.key}`}
                >
                  {verificationMeta.buttonLabel}
                </a>
              </div>
            )}
            {item.document_url && hasImageDocument && (
              <div className="certification-document-image">
                <img src={item.document_url} alt={`${item.name} certification evidence`} />
              </div>
            )}
            {item.document_url && !hasImageDocument && (
              <div><a href={item.document_url} target="_blank" rel="noreferrer">📄 Download Document</a></div>
            )}
          </div>
        )}

        {deleteConfirm === item.id && (
          <div className="delete-confirm">
            <p>Are you sure you want to delete this certification?</p>
            <div className="confirm-actions">
              <button 
                className="confirm-yes"
                onClick={() => handleDelete(item.id)}
              >
                Yes, Delete
              </button>
              <button 
                className="confirm-no"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleDescriptionChange = (value) => {
    setForm((prev) => ({ ...prev, description: value }));
  };

  if (loading) return <div className="certifications-container">Loading certifications...</div>;

  return (
    <div className="certifications-container">
      <div className="certifications-page-header">
        <div className="page-backbar">
        <a
          className="btn-back"
          href="/dashboard"
          aria-label="Back to dashboard"
          title="Back to dashboard"
        >
          ← Back to Dashboard
        </a>
      </div>
      </div>

      <div className="certifications-header">
        <h2><Icon name="cert" size="md" /> Your Professional Certifications</h2>
        <button 
          className="add-certification-button"
          onClick={() => {
            setForm(createDefaultForm());
            setEditingId(null);
            setFieldErrors({});
            setShowForm(true);
          }}
        >
          + Add Certification
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showForm && (
        <div className="certification-form-card" ref={formCardRef}>
          <div className="form-header">
            <h3>{editingId ? 'Edit Certification' : 'Add Certification'}</h3>
            <button className="close-button" onClick={resetForm}><Icon name="trash" size="sm" ariaLabel="Close" /></button>
          </div>

          <form className="certification-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">Certification Name <span className="required">*</span></label>
            <input
              id="name"
              name="name"
              value={form.name}
              onChange={onChange}
              className={fieldErrors.name ? 'error' : ''}
              ref={firstFieldRef}
            />
            {fieldErrors.name && <div className="error-message">{fieldErrors.name}</div>}
          </div>
          <div className="form-group org-group" ref={orgBoxRef}>
            <label htmlFor="issuing_organization">Platform / Issuing Organization <span className="required">*</span></label>
            <input
              id="issuing_organization"
              name="issuing_organization"
              value={form.issuing_organization}
              onChange={(e) => { onChange(e); setShowOrgSuggestions(true); }}
              autoComplete="off"
              className={fieldErrors.issuing_organization ? 'error' : ''}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showOrgSuggestions}
              aria-controls="org-listbox"
              aria-activedescendant={orgActiveIndex >= 0 ? `org-option-${orgActiveIndex}` : undefined}
              onKeyDown={handleOrgKeyDown}
              onFocus={() => setShowOrgSuggestions(true)}
              ref={orgInputRef}
            />
            {showOrgSuggestions && (
              <div className="suggestions" role="listbox" id="org-listbox">
                {orgQuery.length < 2 && (
                  <div className="suggestion disabled" aria-disabled="true">
                    Start typing to search verified directories or pick a popular platform below
                  </div>
                )}
                {orgQuery.length >= 2 && (orgSuggestions || []).length === 0 && (
                  <div className="suggestion disabled" aria-disabled="true">No organizations found</div>
                )}
                {(getActiveOrgSuggestions() || []).map((s, idx) => (
                  <div
                    key={`${s}-${idx}`}
                    id={`org-option-${idx}`}
                    role="option"
                    aria-selected={idx === orgActiveIndex}
                    className={`suggestion ${idx === orgActiveIndex ? 'active' : ''}`}
                    onMouseEnter={() => setOrgActiveIndex(idx)}
                    onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
            {fieldErrors.issuing_organization && <div className="error-message">{fieldErrors.issuing_organization}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="issue_date">Date Earned <span className="required">*</span></label>
            <input id="issue_date" type="date" name="issue_date" value={form.issue_date} onChange={onChange} className={fieldErrors.issue_date ? 'error' : ''} />
            {fieldErrors.issue_date && <div className="error-message">{fieldErrors.issue_date}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="expiry_date">Expiration Date {form.does_not_expire ? '' : <span className="required">*</span>}</label>
            <input id="expiry_date" type="date" name="expiry_date" value={form.expiry_date || ''} onChange={onChange} disabled={form.does_not_expire} className={fieldErrors.expiry_date ? 'error' : ''} />
            {fieldErrors.expiry_date && <div className="error-message">{fieldErrors.expiry_date}</div>}
            <label className="inline-checkbox" htmlFor="does_not_expire">
              <input id="does_not_expire" type="checkbox" name="does_not_expire" checked={form.does_not_expire} onChange={onChange} />
              <span className="checkbox-label-text">Does not expire</span>
            </label>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="credential_id">Certification ID/Number</label>
            <input id="credential_id" name="credential_id" value={form.credential_id} onChange={onChange} />
          </div>
          <div className="form-group">
            <label htmlFor="credential_url">Credential URL</label>
            <input id="credential_url" name="credential_url" value={form.credential_url} onChange={onChange} />
            {credentialVerificationMeta ? (
              <div className={`verification-hint accent-${credentialVerificationMeta.key}`}>
                <strong>{credentialVerificationMeta.label} link detected.</strong> {credentialVerificationMeta.formMessage}
              </div>
            ) : (
              <div className="verification-hint subtle">
                Tip: paste a public badge link ({verificationExamples}, etc.) to make this credential verifiable.
              </div>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select id="category" name="category" value={form.category} onChange={onChange}>
              <option value="">Select category</option>
              {(categories || []).map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="assessment_score">Skill Assessment Score</label>
            <div className="score-inputs">
              <input
                id="assessment_score"
                name="assessment_score"
                type="number"
                min="0"
                step="0.01"
                placeholder="95"
                value={form.assessment_score}
                onChange={onChange}
              />
              <span className="score-separator">out of</span>
              <input
                id="assessment_max_score"
                name="assessment_max_score"
                type="number"
                min="0"
                step="0.01"
                placeholder="100"
                value={form.assessment_max_score}
                onChange={onChange}
              />
              <select
                id="assessment_units"
                name="assessment_units"
                value={form.assessment_units}
                onChange={onChange}
              >
                {scoreUnitOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="achievement_highlights">Achievement Highlights</label>
            <textarea
              id="achievement_highlights"
              name="achievement_highlights"
              rows="3"
              placeholder="Top 5%, Gold badge, perfect score, etc."
              value={form.achievement_highlights}
              onChange={onChange}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <div className="description-header">
              <div>
                <label htmlFor="description">Rich Description</label>
                <p className="description-helper">
                  Share how this certification strengthened your skills. Mention project outcomes, metrics, or tools you mastered.
                </p>
              </div>
            </div>
            <RichTextEditor
              id="description"
              label=""
              value={form.description}
              onChange={handleDescriptionChange}
              placeholder="Example: Led a cross-functional lab to earn AWS SA Pro badge—reduced deployment times 35% using CDK & Terraform."
            />
            <div className="description-meta">
              <span>{descriptionStats.words} words • {descriptionStats.chars}/{MAX_DESCRIPTION_CHARS} characters</span>
              {descriptionLimitReached && (
                <span className="description-limit-warning">Approaching the {MAX_DESCRIPTION_CHARS}-character limit</span>
              )}
            </div>
            <ul className="description-tips">
              <li>Focus on measurable impact or the skills the certification unlocked.</li>
              <li>Call out assessment scores or ranked achievements.</li>
              <li>Keep sentences concise—recruiters skim this section quickly.</li>
            </ul>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Verification Status</label>
            <div>
              {statusBadge(formDisplayedVerification, credentialVerificationMeta?.cardTitle)}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="renewal_reminder_enabled">Renewal Reminder</label>
            <label className="inline-checkbox" htmlFor="renewal_reminder_enabled">
              <input id="renewal_reminder_enabled" type="checkbox" name="renewal_reminder_enabled" checked={form.renewal_reminder_enabled} onChange={onChange} />
              <span className="checkbox-label-text">Enable reminder</span>
            </label>
            {form.renewal_reminder_enabled && (
              <div className="inline-input">
                <label htmlFor="reminder_days_before">Days before expiration</label>
                <input id="reminder_days_before" type="number" min="1" max="365" name="reminder_days_before" value={form.reminder_days_before} onChange={onChange} />
              </div>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="badge_image">Badge Image / Screenshot</label>
            <input
              id="badge_image"
              name="badge_image"
              type="file"
              accept="image/*"
              ref={badgeInputRef}
              onChange={(e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) return;
                setForm((prev) => ({ ...prev, badge_image: file, badge_image_removed: false }));
              }}
              style={{ display: 'none' }}
            />
            <div
              className={`upload-dropzone badge-dropzone ${isDraggingBadge ? 'dragover' : ''}`}
              onClick={openBadgeDialog}
              onDragEnter={onBadgeDragOver}
              onDragOver={onBadgeDragOver}
              onDragLeave={onBadgeDragLeave}
              onDrop={onBadgeDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openBadgeDialog()}
              aria-label="Upload badge image or screenshot"
            >
              <div className="upload-illustration" aria-hidden="true">
                <Icon name="camera" size="lg" ariaLabel="Badge upload" />
              </div>
              <div className="upload-copy">
                <div className="upload-title">Drop your badge</div>
                <div className="upload-subtitle">PNG, JPG, or screenshot up to ~5MB</div>
                <div className="upload-hint">Helps recruiters recognize your skills instantly</div>
              </div>
              <div className="upload-actions">
                <button
                  type="button"
                  className="upload-browse"
                  onClick={(e) => { e.stopPropagation(); openBadgeDialog(); }}
                >
                  Upload Badge
                </button>
                {badgePreview && (
                  <button
                    type="button"
                    className="upload-clear"
                    onClick={(e) => { e.stopPropagation(); removeBadgeImage(); }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {badgePreview && (
              <div className="badge-preview">
                <img src={badgePreview.url} alt="Selected badge preview" />
                <div className="badge-preview-meta">
                  <span>{form.badge_image?.name || 'Current badge'}</span>
                  <button type="button" onClick={removeBadgeImage}>Remove</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Document Upload - moved to bottom */}
        <div className="form-row">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="document">Upload Document</label>
            <input
              id="document"
              name="document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={onChange}
              ref={docInputRef}
              style={{ display: 'none' }}
            />

            <div
              className={`upload-dropzone ${isDraggingDoc ? 'dragover' : ''}`}
              onClick={openDocDialog}
              onDragEnter={onDocDragOver}
              onDragOver={onDocDragOver}
              onDragLeave={onDocDragLeave}
              onDrop={onDocDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openDocDialog()}
              aria-label="Upload certification document by click or drag and drop"
            >
              <div className="upload-illustration" aria-hidden="true">
                {/* Document icon */}
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                  <path d="M7 3.75A2.25 2.25 0 0 1 9.25 1.5h3.879c.597 0 1.17.237 1.591.659l3.121 3.121c.422.421.659.994.659 1.591V18.75A2.25 2.25 0 0 1 16.25 21H9.75A2.25 2.25 0 0 1 7.5 18.75V3.75z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M12 1.5v3.75c0 .621.504 1.125 1.125 1.125H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M8.75 12h6.5M8.75 15.25h6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="upload-copy">
                <div className="upload-title">Drag & drop your document</div>
                <div className="upload-subtitle">or click to browse</div>
                <div className="upload-hint">PDF, JPG, PNG up to ~10MB</div>
              </div>
              <div className="upload-actions">
                <button
                  type="button"
                  className="upload-browse"
                  onClick={(e) => { e.stopPropagation(); openDocDialog(); }}
                  aria-label="Browse files"
                >
                  Browse File
                </button>
                {form.document && (
                  <button
                    type="button"
                    className="upload-clear"
                    onClick={(e) => { e.stopPropagation(); removeDocument(); }}
                    aria-label="Clear selected file"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {form.document && (
              <div className="upload-previews" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                <div className="upload-preview-card">
                  <div className="upload-thumb">
                    {docPreview?.kind === 'image' ? (
                      <img src={docPreview.url} alt={form.document.name} />
                    ) : (
                      <div className="doc-fallback" aria-hidden="true">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7 3.75A2.25 2.25 0 0 1 9.25 1.5h3.879c.597 0 1.17.237 1.591.659l3.121 3.121c.422.421.659.994.659 1.591V18.75A2.25 2.25 0 0 1 16.25 21H9.75A2.25 2.25 0 0 1 7.5 18.75V3.75z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                          <path d="M12 1.5v3.75c0 .621.504 1.125 1.125 1.125H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                    <button
                      type="button"
                      className="thumb-remove"
                      title="Remove file"
                      aria-label="Remove file"
                      onClick={removeDocument}
                    >
                      ×
                    </button>
                  </div>
                  <div className="thumb-meta">
                    <div className="thumb-name" title={form.document.name}>{form.document.name}</div>
                    <div className="thumb-size">{formatBytes(form.document.size)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={resetForm} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="save-button" disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update Certification' : 'Add Certification'}
          </button>
        </div>
      </form>
        </div>
      )}

      {!hasCerts && !showForm ? (
        <div className="empty-state">
          <div className="empty-icon"><Icon name="cert" size="xl" ariaLabel="No certifications" /></div>
          <h3>No Certifications Yet</h3>
          <p>Add your professional certifications to showcase your expertise.</p>
          <button className="add-certification-button" onClick={() => {
            setForm(createDefaultForm());
            setEditingId(null);
            setFieldErrors({});
            setShowForm(true);
          }}>
            + Add Your First Certification
          </button>
        </div>
      ) : (
        <>
          {hasCerts && (
            <>
              <div className="certifications-summary">
                <div className="summary-card">
                  <span className="summary-label">Total Certifications</span>
                  <strong className="summary-value">{stats.total}</strong>
                  <span className="summary-subtext">{stats.topCategory ? `Focus: ${stats.topCategory}` : 'Build your first credential'}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Verified</span>
                  <strong className="summary-value">{stats.verified}</strong>
                  <span className="summary-subtext">Share trusted badges</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Expiring Soon</span>
                  <strong className={`summary-value ${stats.expiringSoon ? 'warning' : ''}`}>{stats.expiringSoon}</strong>
                  <span className="summary-subtext">Next 45 days</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Skill Assessments</span>
                  <strong className="summary-value">{stats.assessmentCount}</strong>
                  <span className="summary-subtext">Scores showcased</span>
                </div>
              </div>

              {categoryNav.length > 0 && (
                <div className="certification-category-nav" role="tablist" aria-label="Certification categories">
                  <button
                    type="button"
                    className={`category-pill ${activeCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('all')}
                    role="tab"
                    aria-selected={activeCategory === 'all'}
                  >
                    All ({stats.total})
                  </button>
                  {categoryNav.map((cat) => (
                    <button
                      type="button"
                      key={cat.key}
                      className={`category-pill ${activeCategory === cat.key ? 'active' : ''}`}
                      onClick={() => setActiveCategory(cat.key)}
                      role="tab"
                      aria-selected={activeCategory === cat.key}
                    >
                      {cat.key} ({cat.count})
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="certifications-groups">
            {visibleGroups.length === 0 ? (
              <div className="empty-category">
                <p>No certifications in this category yet. Add one to showcase your skill.</p>
              </div>
            ) : (
              visibleGroups.map(([category, certs]) => (
                <div key={category} className="certifications-group">
                  <div className="certifications-group-header">
                    <h3>{category}</h3>
                    <span>{certs.length} {certs.length === 1 ? 'certification' : 'certifications'}</span>
                  </div>
                  <div className="certifications-list">
                    {certs.map((cert) => renderCertificationCard(cert))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Certifications;
