import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsAPI, materialsAPI, interviewsAPI, companyAPI } from '../../services/api';
import { authorizedFetch } from '../../services/authToken';
import Icon from '../common/Icon';
import DeadlineCalendar from '../common/DeadlineCalendar';
import AutomationDashboard from '../automation/AutomationDashboard';

const defaultForm = {
  title: '',
  company_name: '',
  location: '',
  salary_min: '',
  salary_max: '',
  salary_currency: 'USD',
  posting_url: '',
  application_deadline: '',
  description: '',
  industry: '',
  job_type: 'ft',
};

const jobTypeOptions = [
  { value: 'ft', label: 'Full-time' },
  { value: 'pt', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Internship' },
  { value: 'temp', label: 'Temporary' },
];

export const industryOptions = [
  'Software', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing', 'Government', 'Other'
];

const jobStatusOptions = [
  { value: 'interested', label: 'Interested' },
  { value: 'applied', label: 'Applied' },
  { value: 'phone_screen', label: 'Phone Screen' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
];

const MAX_DESC = 2000;

const headerActionsWrapperStyle = {
  display: 'flex',
  gap: '12px',
  alignItems: 'stretch',
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
  width: '100%',
};

const responsiveActionButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  flex: '1 1 180px',
  minWidth: '140px',
  minHeight: '44px',
};

const Jobs = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
const [error, setError] = useState('');
const [fieldErrors, setFieldErrors] = useState({});
const [success, setSuccess] = useState('');
const [companyMatches, setCompanyMatches] = useState([]);
const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
const [companySearchStatus, setCompanySearchStatus] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // UC-039: Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    industry: '',
    location: '',
    job_type: '',
    salary_min: '',
    salary_max: '',
    deadline_from: '',
    deadline_to: '',
  });
  const [sortBy, setSortBy] = useState('date_added');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('list');

  // UC-045: Archive State
  const [showArchived, setShowArchived] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('other');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [undoNotification, setUndoNotification] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState(jobStatusOptions[0].value);

  // UC-041: Import from URL State
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [importedFields, setImportedFields] = useState([]);

  // UC-042: Application Materials State
  const [documents, setDocuments] = useState([]);
  const [defaults, setDefaults] = useState({ default_resume_doc: null, default_cover_letter_doc: null });
  const [showDefaultsModal, setShowDefaultsModal] = useState(false);

  // Automation State
  const [showAutomation, setShowAutomation] = useState(false);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);

  // Job Match Ranking State
  const [jobMatchScores, setJobMatchScores] = useState([]);
  const [loadingMatchScores, setLoadingMatchScores] = useState(false);
  const [showMatchRanking, setShowMatchRanking] = useState(false);

  // UC-071: Interview Scheduling State
  const [interviews, setInterviews] = useState([]);
  const [selectedJobForMaterials, setSelectedJobForMaterials] = useState(null);
  const [jobMaterials, setJobMaterials] = useState({ resume_doc: null, cover_letter_doc: null, history: [] });
  const [materialsForm, setMaterialsForm] = useState({ resume_doc_id: null, cover_letter_doc_id: null });
  const [savingMaterials, setSavingMaterials] = useState(false);
const initialFetchRef = useRef(true);
const companySearchTimerRef = useRef(null);
const companyDropdownRef = useRef(null);

  // UC-039: Load saved search preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedPrefs = localStorage.getItem('jobSearchPreferences');
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        if (prefs.searchQuery) setSearchQuery(prefs.searchQuery);
        if (prefs.filters) setFilters(prev => ({ ...prev, ...prefs.filters }));
        if (prefs.sortBy) setSortBy(prefs.sortBy);
        if (prefs.showFilters !== undefined) setShowFilters(prefs.showFilters);
        if (prefs.viewMode && ['list', 'grid'].includes(prefs.viewMode)) {
          setViewMode(prefs.viewMode);
        }
      }
    } catch (e) {
      console.warn('Failed to load saved search preferences:', e);
    } finally {
      setPrefsLoaded(true);
    }
  }, []);

  // UC-039: Save search preferences to localStorage when they change
  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      const prefs = { searchQuery, filters, sortBy, showFilters, viewMode };
      localStorage.setItem('jobSearchPreferences', JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save search preferences:', e);
    }
  }, [searchQuery, filters, sortBy, showFilters, viewMode, prefsLoaded]);

  // UC-042: Load documents and defaults
  useEffect(() => {
    const loadMaterialsData = async () => {
      try {
        const [docsResponse, defaultsResponse] = await Promise.all([
          materialsAPI.listDocuments(),
          materialsAPI.getDefaults().catch(() => ({ default_resume_doc: null, default_cover_letter_doc: null }))
        ]);
        setDocuments(docsResponse);
        setDefaults(defaultsResponse);
      } catch (e) {
        console.warn('Failed to load materials data:', e);
      }
    };
    loadMaterialsData();
  }, []);

  // UC-071: Load interviews for calendar
  useEffect(() => {
    const loadInterviews = async () => {
      try {
        const response = await interviewsAPI.getInterviews({ upcoming_only: false });
        setInterviews(response || []);
      } catch (e) {
        console.warn('Failed to load interviews:', e);
      }
    };
    loadInterviews();
  }, []);

  useEffect(() => {
    if (!prefsLoaded) {
      return undefined;
    }

    let isActive = true;

    const init = async () => {
      const isInitialLoad = initialFetchRef.current;
      if (!isInitialLoad) {
        setIsFetching(true);
      }

      try {
        // UC-039: Build query parameters for search and filtering
        // UC-045: Include archived filter
        const params = {
          q: searchQuery,
          industry: filters.industry,
          location: filters.location,
          job_type: filters.job_type,
          salary_min: filters.salary_min,
          salary_max: filters.salary_max,
          deadline_from: filters.deadline_from,
          deadline_to: filters.deadline_to,
          sort: sortBy,
          archived: showArchived ? 'true' : 'false',
        };
        
        const response = await jobsAPI.getJobs(params);
        if (!isActive) return;
        const list = response?.results ?? response ?? [];
        setItems(Array.isArray(list) ? list : []);
        setError('');
      } catch (e) {
        if (!isActive) return;
        const msg = e?.message || e?.error?.message || 'Failed to load jobs';
        if (e?.status === 401) {
          setError('Please log in to view your jobs.');
        } else if (Array.isArray(e?.messages) && e.messages.length) {
          setError(e.messages.join(' • '));
        } else {
          setError(msg);
        }
      } finally {
        if (!isActive) return;
        if (initialFetchRef.current) {
          initialFetchRef.current = false;
          setLoading(false);
        }
        setIsFetching(false);
      }
    };
    init();
    return () => {
      isActive = false;
    };
  }, [searchQuery, filters, sortBy, showArchived, prefsLoaded]);

  useEffect(() => () => {
    if (companySearchTimerRef.current) {
      clearTimeout(companySearchTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target)) {
        setCompanyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper: days difference (deadline - today), and urgency color
  const daysUntil = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };
  const deadlineColor = (diff) => {
    if (diff == null) return '#94a3b8';
    if (diff < 0) return '#dc2626'; // overdue
    if (diff <= 3) return '#f59e0b'; // urgent
    return '#059669'; // safe
  };

  const triggerCompanySearch = (query) => {
    if (companySearchTimerRef.current) {
      clearTimeout(companySearchTimerRef.current);
    }
    const trimmed = (query || '').trim();
    if (trimmed.length < 2) {
      setCompanyMatches([]);
      setCompanySearchStatus(trimmed ? 'Type at least 2 characters to search.' : '');
      return;
    }
    companySearchTimerRef.current = setTimeout(async () => {
      setCompanySearchStatus('Searching…');
      try {
        const results = await companyAPI.searchCompanies(trimmed);
        setCompanyMatches(results);
        setCompanySearchStatus(results.length ? '' : 'No matching companies.');
      } catch (err) {
        const msg = err?.error?.message || 'Search unavailable. Please try again.';
        setCompanySearchStatus(msg);
      }
    }, 250);
  };

  const handleCompanyInputChange = (value) => {
    setForm((prev) => ({ ...prev, company_name: value }));
    setFieldErrors((prev) => ({ ...prev, company_name: '' }));
    setCompanyDropdownOpen(Boolean(value));
    triggerCompanySearch(value);
  };

  const handleSelectCompany = (company) => {
    setForm((prev) => ({ ...prev, company_name: company?.name || '' }));
    setCompanyMatches([]);
    setCompanyDropdownOpen(false);
    setCompanySearchStatus('');
  };

  const handleCompanyInputFocus = () => {
    if (form.company_name.trim().length >= 2) {
      setCompanyDropdownOpen(true);
      triggerCompanySearch(form.company_name);
    }
  };

  const resetForm = () => {
    setForm(defaultForm);
    setFieldErrors({});
    setEditingId(null);
    setCharCount(0);
    setShowForm(false);
    // UC-041: Clear import state
    setImportUrl('');
    setImportStatus(null);
    setImportedFields([]);
    setCompanyMatches([]);
    setCompanySearchStatus('');
    setCompanyDropdownOpen(false);
  };

  // UC-039: Clear all filters and search
  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      industry: '',
      location: '',
      job_type: '',
      salary_min: '',
      salary_max: '',
      deadline_from: '',
      deadline_to: '',
    });
    setSortBy('date_added');
  };

  // UC-039: Handle filter changes
  const onFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // UC-039: Highlight matching terms in search results
  const highlightText = (text, query) => {
    if (!query || !text) return text;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return text.replace(regex, '<mark style="background: #fef08a; padding: 0 2px;">$1</mark>');
  };

  const formatDescriptionForView = (text) => {
    if (!text) return '';
    if (viewMode !== 'grid') return text;
    const trimmed = text.trim();
    if (trimmed.length <= 220) return trimmed;
    return `${trimmed.slice(0, 220).trim()}...`;
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    if (name === 'company_name') {
      handleCompanyInputChange(value);
      return;
    }
    if (name === 'description') {
      if (value.length > MAX_DESC) return;
      setCharCount(value.length);
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const n = { ...prev };
        delete n[name];
        return n;
      });
    }
  };

  const validate = () => {
    const errs = {};
    
    // Required fields
    if (!form.title.trim()) {
      errs.title = 'Job title is required';
    }
    
    if (!form.company_name.trim()) {
      errs.company_name = 'Company name is required';
    }
    
    // Description length validation
    if (form.description && form.description.length > MAX_DESC) {
      errs.description = `Description must be ${MAX_DESC} characters or less`;
    }
    
    // Salary validation
    const smin = parseFloat(form.salary_min);
    const smax = parseFloat(form.salary_max);
    
    if (form.salary_min && isNaN(smin)) {
      errs.salary_min = 'Please enter a valid number';
    }
    
    if (form.salary_max && isNaN(smax)) {
      errs.salary_max = 'Please enter a valid number';
    }
    
    if (!isNaN(smin) && smin < 0) {
      errs.salary_min = 'Salary cannot be negative';
    }
    
    if (!isNaN(smax) && smax < 0) {
      errs.salary_max = 'Salary cannot be negative';
    }
    
    if (!isNaN(smin) && !isNaN(smax) && smin > smax) {
      errs.salary_min = 'Minimum salary must be less than or equal to maximum salary';
    }
    
    // Date validation
    if (form.application_deadline) {
      const deadlineDate = new Date(form.application_deadline);
      if (isNaN(deadlineDate.getTime())) {
        errs.application_deadline = 'Please enter a valid date';
      }
    }
    
    // URL validation
    if (form.posting_url && form.posting_url.trim()) {
      try {
        new URL(form.posting_url);
      } catch (e) {
        errs.posting_url = 'Please enter a valid URL (e.g., https://example.com)';
      }
    }
    
    // Currency validation
    if (form.salary_currency && form.salary_currency.length > 3) {
      errs.salary_currency = 'Currency code must be 3 characters or less';
    }
    
    return errs;
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      company_name: item.company_name || '',
      location: item.location || '',
      salary_min: item.salary_min !== null && item.salary_min !== undefined ? formatSalaryString(item.salary_min) : '',
      salary_max: item.salary_max !== null && item.salary_max !== undefined ? formatSalaryString(item.salary_max) : '',
      salary_currency: item.salary_currency || 'USD',
      posting_url: item.posting_url || '',
      application_deadline: item.application_deadline || '',
      description: item.description || '',
      industry: item.industry || '',
      job_type: item.job_type || 'ft',
    });
    setFieldErrors({});
    setCharCount((item.description || '').length);
    setShowForm(true);
    // Guard scrollTo for jsdom/test environments where it may be unimplemented
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Format salary number for input display: remove unnecessary .00, keep two decimals otherwise
  const formatSalaryString = (v) => {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    // Round to 2 decimals to avoid float artifacts
    const rounded = Math.round(n * 100) / 100;
    if (Number.isInteger(rounded)) return String(rounded);
    return String(rounded.toFixed(2));
  };
  const onDelete = async (id) => {
    // For backward compatibility with tests that mock window.confirm
    if (typeof window.confirm === 'function') {
      const confirmed = window.confirm('Are you sure you want to delete this job permanently?');
      if (confirmed) {
        try {
          await jobsAPI.deleteJob(id);
          setItems((prev) => prev.filter((i) => i.id !== id));
          setSuccess('Job deleted.');
          setTimeout(() => setSuccess(''), 3000);
        } catch (e) {
          const msg = e?.message || e?.error?.message || 'Failed to delete job';
          setError(msg);
        }
      }
    } else {
      // Use modal in production
      setItemToDelete(id);
      setShowDeleteModal(true);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    // Check if we're doing bulk delete
    if (Array.isArray(itemToDelete)) {
      try {
        // Delete all selected jobs
        await Promise.all(itemToDelete.map(id => jobsAPI.deleteJob(id)));
        setItems((prev) => prev.filter((i) => !itemToDelete.includes(i.id)));
        setSelectedJobs([]);
        setSuccess(`${itemToDelete.length} job(s) deleted.`);
        setTimeout(() => setSuccess(''), 3000);
      } catch (e) {
        const msg = e?.message || e?.error?.message || 'Failed to delete jobs';
        setError(msg);
      } finally {
        setShowDeleteModal(false);
        setItemToDelete(null);
      }
    } else {
      // Single delete
      try {
        await jobsAPI.deleteJob(itemToDelete);
        setItems((prev) => prev.filter((i) => i.id !== itemToDelete));
        setSuccess('Job deleted.');
        setTimeout(() => setSuccess(''), 3000);
      } catch (e) {
        const msg = e?.message || e?.error?.message || 'Failed to delete job';
        setError(msg);
      } finally {
        setShowDeleteModal(false);
        setItemToDelete(null);
      }
    }
  };

  // UC-045: Archive handlers
  const onArchive = async (id, reason = 'other') => {
    try {
      await jobsAPI.archiveJob(id, reason);
      setItems((prev) => prev.filter((i) => i.id !== id));
      
      // Show undo notification
      setUndoNotification({
        message: 'Job archived.',
        jobId: id,
        type: 'archive',
      });
      setTimeout(() => setUndoNotification(null), 5000);
      
      setSuccess('Job archived successfully.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      const msg = e?.message || e?.error?.message || 'Failed to archive job';
      setError(msg);
    }
  };

  const onRestore = async (id) => {
    try {
      await jobsAPI.restoreJob(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      
      // Show undo notification
      setUndoNotification({
        message: 'Job restored.',
        jobId: id,
        type: 'restore',
      });
      setTimeout(() => setUndoNotification(null), 5000);
      
      setSuccess('Job restored successfully.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      const msg = e?.message || e?.error?.message || 'Failed to restore job';
      setError(msg);
    }
  };

  const onBulkArchive = async () => {
    if (selectedJobs.length === 0) return;
    setShowArchiveModal(true);
  };

  const onBulkSetStatus = () => {
    if (selectedJobs.length === 0) return;
    setShowStatusModal(true);
  };

  const onBulkRestore = async () => {
    if (selectedJobs.length === 0) return;
    try {
      await jobsAPI.bulkRestoreJobs(selectedJobs);
      setItems((prev) => prev.filter((i) => !selectedJobs.includes(i.id)));
      setSelectedJobs([]);
      setSuccess(`${selectedJobs.length} job(s) restored successfully.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      const msg = e?.message || e?.error?.message || 'Failed to bulk restore';
      setError(msg);
    }
  };

  const onBulkDelete = async () => {
    if (selectedJobs.length === 0) return;
    setItemToDelete(selectedJobs);
    setShowDeleteModal(true);
  };

  const confirmBulkArchive = async () => {
    try {
      await jobsAPI.bulkArchiveJobs(selectedJobs, archiveReason);
      setItems((prev) => prev.filter((i) => !selectedJobs.includes(i.id)));
      setSelectedJobs([]);
      setSuccess(`${selectedJobs.length} job(s) archived successfully.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      const msg = e?.message || e?.error?.message || 'Failed to bulk archive';
      setError(msg);
    } finally {
      setShowArchiveModal(false);
      setArchiveReason('other');
    }
  };

  const undoAction = async () => {
    if (!undoNotification) return;
    const { jobId, type } = undoNotification;
    
    try {
      if (type === 'archive') {
        await jobsAPI.restoreJob(jobId);
      } else if (type === 'restore') {
        await jobsAPI.archiveJob(jobId, 'other');
      }
      // Refresh the list
      const params = {
        q: searchQuery,
        industry: filters.industry,
        location: filters.location,
        job_type: filters.job_type,
        salary_min: filters.salary_min,
        salary_max: filters.salary_max,
        deadline_from: filters.deadline_from,
        deadline_to: filters.deadline_to,
        sort: sortBy,
        archived: showArchived ? 'true' : 'false',
      };
  const response = await jobsAPI.getJobs(params);
  const list = response?.results ?? response ?? [];
  setItems(Array.isArray(list) ? list : []);
      
      setSuccess('Action undone.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      const msg = e?.message || e?.error?.message || 'Failed to undo';
      setError(msg);
    } finally {
      setUndoNotification(null);
    }
  };

  const confirmBulkStatusUpdate = async () => {
    try {
      await jobsAPI.bulkUpdateStatus(selectedJobs, bulkStatusValue);
      setItems((prev) =>
        prev.map((item) =>
          selectedJobs.includes(item.id) ? { ...item, status: bulkStatusValue } : item
        )
      );
      setSelectedJobs([]);
      setSuccess(`Updated ${selectedJobs.length} job(s) to ${bulkStatusValue}.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      const msg = e?.message || e?.error?.message || 'Failed to update job statuses.';
      setError(msg);
    } finally {
      setShowStatusModal(false);
    }
  };

  const toggleJobSelection = (id) => {
    setSelectedJobs(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Fetch job match scores for ranking
  const fetchJobMatchScores = async () => {
    console.log('fetchJobMatchScores called');
    setLoadingMatchScores(true);
    try {
      console.log('Calling getBulkJobMatchScores API...');
      const response = await jobsAPI.getBulkJobMatchScores({
        sort_by: 'score',
        order: 'desc',
        limit: 50
      });
      console.log('API response:', response);
      console.log('API response.data:', response.data);
      
      // Handle different possible response structures
      let scores = [];
      if (response.data && Array.isArray(response.data.jobs)) {
        scores = response.data.jobs;
      } else if (Array.isArray(response.data)) {
        scores = response.data;
      } else if (Array.isArray(response)) {
        scores = response;
      } else if (response.data && Array.isArray(response.data.results)) {
        scores = response.data.results;
      } else {
        console.warn('Unexpected response structure:', response);
      }
      
      console.log('Final scores array:', scores);
      setJobMatchScores(scores);
    } catch (e) {
      console.error('Failed to fetch match scores:', e);
      setError('Failed to load job match rankings');
    } finally {
      setLoadingMatchScores(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedJobs.length === items.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(items.map(i => i.id));
    }
  };

  // UC-041: Import from URL handler
  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) {
      setError('Please enter a job posting URL');
      return;
    }

    setImporting(true);
    setError('');
    setSuccess('');
    setImportStatus(null);
    setImportedFields([]);

    try {
      const result = await jobsAPI.importFromUrl(importUrl);

      if (result.status === 'success' || result.status === 'partial') {
        setForm((prev) => ({ ...prev, ...result.data }));
        if (result.data?.description) {
          setCharCount(result.data.description.length);
        }

        setImportStatus(result.status);
        setImportedFields(result.fields_extracted || []);

        if (result.status === 'success') {
          setSuccess('Job details imported successfully! Review and edit as needed.');
        } else {
          setSuccess('Job details partially imported. Please fill in the remaining fields.');
        }
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(result.error || 'Failed to import job details');
        setImportStatus('failed');
      }
    } catch (e) {
      const message = e?.message || 'Failed to import job from URL';
      setError(message);
      setImportStatus('failed');
    } finally {
      setImporting(false);
    }
  };

  const isFieldImported = (field) => importedFields.includes(field);

  const getFieldStyle = (field) => {
    if (!isFieldImported(field)) return {};
    return { background: 'rgba(16, 185, 129, 0.05)', borderColor: '#10b981' };
  };

  const mapServerFieldErrors = (details) => {
    // Expecting DRF-style { field: [messages] }
    if (!details || typeof details !== 'object') return {};
    const out = {};
    Object.entries(details).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length) out[k] = v.join(' ');
      else if (typeof v === 'string') out[k] = v;
    });
    return out;
  };

  // UC-042: Materials Handlers
  const handleSetDefaults = async (e) => {
    e.preventDefault();
    setSavingMaterials(true);
    try {
      await materialsAPI.setDefaults({
        resume_doc_id: materialsForm.resume_doc_id || null,
        cover_letter_doc_id: materialsForm.cover_letter_doc_id || null
      });
      const updatedDefaults = await materialsAPI.getDefaults();
      setDefaults(updatedDefaults);
      
      // Update form with the actual saved values
      setMaterialsForm({
        resume_doc_id: updatedDefaults.default_resume_doc?.id || null,
        cover_letter_doc_id: updatedDefaults.default_cover_letter_doc?.id || null
      });
      
      setShowDefaultsModal(false);
      setSuccess('Default materials updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e?.message || 'Failed to update defaults');
    } finally {
      setSavingMaterials(false);
    }
  };

  const openMaterialsModal = async (job) => {
    setSelectedJobForMaterials(job);
    setShowMaterialsModal(true);
    try {
      const materials = await materialsAPI.getJobMaterials(job.id);
      setJobMaterials(materials);
      setMaterialsForm({
        resume_doc_id: materials.resume_doc?.id || null,
        cover_letter_doc_id: materials.cover_letter_doc?.id || null
      });
    } catch (e) {
      console.warn('Failed to load job materials:', e);
      setJobMaterials({ resume_doc: null, cover_letter_doc: null, history: [] });
      setMaterialsForm({ resume_doc_id: null, cover_letter_doc_id: null });
    }
  };

  const handleSaveJobMaterials = async (e) => {
    e.preventDefault();
    if (!selectedJobForMaterials) return;
    
    setSavingMaterials(true);
    try {
      await materialsAPI.updateJobMaterials(selectedJobForMaterials.id, {
        resume_doc_id: materialsForm.resume_doc_id || null,
        cover_letter_doc_id: materialsForm.cover_letter_doc_id || null
      });
      
      // Reload materials to show updated history
      const updatedMaterials = await materialsAPI.getJobMaterials(selectedJobForMaterials.id);
      setJobMaterials(updatedMaterials);
      
      // Update form with the actual saved values
      setMaterialsForm({
        resume_doc_id: updatedMaterials.resume_doc?.id || null,
        cover_letter_doc_id: updatedMaterials.cover_letter_doc?.id || null
      });
      
      setSuccess('Job materials updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e?.message || 'Failed to update materials');
    } finally {
      setSavingMaterials(false);
    }
  };

  const applyDefaultMaterials = () => {
    setMaterialsForm({
      resume_doc_id: defaults.default_resume_doc?.id || null,
      cover_letter_doc_id: defaults.default_cover_letter_doc?.id || null
    });
  };

  const handleDownloadMaterial = (docId, docName) => {
    const url = materialsAPI.getDownloadUrl(docId);
    authorizedFetch(url)
      .then((response) => {
        if (!response.ok) throw new Error('Download failed');
        return response.blob();
      })
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = docName || 'document';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch((err) => {
        setError('Failed to download document');
        console.error('Download error:', err);
      });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const errs = validate();
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      
      // Normalize salary fields to null or exact decimal strings to avoid binary float artifacts
      ['salary_min', 'salary_max'].forEach((k) => {
        if (payload[k] === '') {
          payload[k] = null;
        } else if (payload[k] === null) {
          payload[k] = null;
        } else {
          const n = parseFloat(String(payload[k]));
          if (Number.isNaN(n)) {
            payload[k] = null;
          } else {
            // Round to 2 decimals then send as string (Decimal-friendly)
            const rounded = Math.round(n * 100) / 100;
            payload[k] = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
          }
        }
      });
      
      // Normalize optional string fields - send empty string instead of null
      if (!payload.posting_url) payload.posting_url = '';
      if (!payload.industry) payload.industry = '';
      if (!payload.location) payload.location = '';
      if (!payload.description) payload.description = '';
      
      // Normalize date field - send null if empty
      if (!payload.application_deadline || payload.application_deadline === '') {
        payload.application_deadline = null;
      }

      let saved;
      if (editingId) {
        saved = await jobsAPI.updateJob(editingId, payload);
        setItems((prev) => prev.map((i) => (i.id === editingId ? saved : i)));
        setSuccess('Job updated.');
      } else {
        saved = await jobsAPI.addJob(payload);
        setItems((prev) => [saved, ...prev]);
        setSuccess('Job saved.');
      }
      resetForm();
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      if (e?.details) setFieldErrors(mapServerFieldErrors(e.details));
      const msg = Array.isArray(e?.messages) && e.messages.length
        ? e.messages.join(' • ')
        : (e?.message || e?.error?.message || 'Failed to save');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="education-container">
        <p style={{ marginTop: '20px' }}>Loading jobs...</p>
      </div>
    );
  }

  return (
    <div className="education-container">
      <h2>Job Tracker</h2>

      {/* 2. Job Tracker section name and description */}
      <div className="education-header">
        <h2><Icon name="briefcase" size="md" /> Your Job Entries</h2>
        <div style={headerActionsWrapperStyle}>
          <div 
            className="jobs-view-toggle" 
            role="group" 
            aria-label="Select job layout"
            style={{ flex: '1 1 220px', justifyContent: 'center' }}
          >
            <button
              type="button"
              className={`jobs-view-toggle__option ${viewMode === 'list' ? 'is-active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
            >
              <Icon name="list" size="sm" ariaLabel="List view" />
              <span>List</span>
            </button>
            <button
              type="button"
              className={`jobs-view-toggle__option ${viewMode === 'grid' ? 'is-active' : ''}`}
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
            >
              <Icon name="grid" size="sm" ariaLabel="Grid view" />
              <span>Grid</span>
            </button>
          </div>
          {/* UC-042: Set Default Materials button */}
          <button
            className="btn-secondary"
            onClick={() => {
              setMaterialsForm({
                resume_doc_id: defaults.default_resume_doc?.id || null,
                cover_letter_doc_id: defaults.default_cover_letter_doc?.id || null
              });
              setShowDefaultsModal(true);
            }}
            onMouseEnter={(e) => { e.currentTarget.dataset.origColor = e.currentTarget.style.color || window.getComputedStyle(e.currentTarget).color; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = e.currentTarget.dataset.origColor || ''; }}
            style={{ ...responsiveActionButtonStyle, backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}
            title="Set default resume and cover letter for new jobs"
          >
            <Icon name="file-text" size="sm" />
            Set Defaults
          </button>
          {/* UC-069: Automation Dashboard button */}
          <button
            className="btn-secondary"
            onClick={() => setShowAutomation(!showAutomation)}
            onMouseEnter={(e) => { e.currentTarget.dataset.origColor = e.currentTarget.style.color || window.getComputedStyle(e.currentTarget).color; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = e.currentTarget.dataset.origColor || ''; }}
            style={{ ...responsiveActionButtonStyle, backgroundColor: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe' }}
            title="Manage application automation and scheduled submissions"
          >
            <Icon name="settings" size="sm" />
            {showAutomation ? 'Hide Automation' : 'Automation'}
          </button>
          {/* Job Match Ranking button */}
          <button
            className="btn-secondary"
            onClick={async () => {
              console.log('Match Rankings button clicked');
              console.log('Current showMatchRanking state:', showMatchRanking);
              setShowMatchRanking(!showMatchRanking);
              if (!showMatchRanking && jobMatchScores.length === 0) {
                console.log('Fetching match scores...');
                await fetchJobMatchScores();
              }
            }}
            onMouseEnter={(e) => { e.currentTarget.dataset.origColor = e.currentTarget.style.color || window.getComputedStyle(e.currentTarget).color; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = e.currentTarget.dataset.origColor || ''; }}
            style={{ ...responsiveActionButtonStyle, backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}
            title="View jobs ranked by match percentage"
            disabled={loadingMatchScores}
          >
            <Icon name="trending-up" size="sm" />
            {loadingMatchScores ? 'Loading...' : (showMatchRanking ? 'Hide Rankings' : 'Match Rankings')}
          </button>
          {/* UC-045: Archive view toggle */}
          <button
            className="btn-secondary"
            onClick={() => {
              setShowArchived(!showArchived);
              setSelectedJobs([]);
            }}
            onMouseEnter={(e) => { e.currentTarget.dataset.origColor = e.currentTarget.style.color || window.getComputedStyle(e.currentTarget).color; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = e.currentTarget.dataset.origColor || ''; }}
            style={{ ...responsiveActionButtonStyle, minWidth: '160px', backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}
          >
            <Icon name={showArchived ? 'briefcase' : 'archive'} size="sm" />
            {showArchived ? 'Active Jobs' : 'Archived Jobs'}
          </button>
          <a
            className="btn-secondary"
            href="/jobs/stats"
            title="Job statistics"
            aria-label="Job statistics"
            onMouseEnter={(e) => { e.currentTarget.dataset.origColor = e.currentTarget.style.color || window.getComputedStyle(e.currentTarget).color; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = e.currentTarget.dataset.origColor || ''; }}
            style={{ ...responsiveActionButtonStyle, textDecoration: 'none', backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}
          >
            <Icon name="bar-chart" size="sm" />
            Statistics
          </a>
          <a
            className="btn-secondary"
            href="/jobs/pipeline"
            title="Open Pipeline"
            aria-label="Open job status pipeline"
            onMouseEnter={(e) => { e.currentTarget.dataset.origColor = e.currentTarget.style.color || window.getComputedStyle(e.currentTarget).color; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = e.currentTarget.dataset.origColor || ''; }}
            style={{ ...responsiveActionButtonStyle, textDecoration: 'none', backgroundColor: '#ecfeff', color: '#0e7490', border: '1px solid #a5f3fc' }}
          >
            <Icon name="gitBranch" size="sm" />
            Pipeline →
          </a>
          <a
            className="btn-secondary"
            href="/jobs/timing-optimizer"
            title="Application Timing Optimizer"
            aria-label="Schedule submissions and manage application timing"
            onMouseEnter={(e) => { e.currentTarget.dataset.origColor = e.currentTarget.style.color || window.getComputedStyle(e.currentTarget).color; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = e.currentTarget.dataset.origColor || ''; }}
            style={{ ...responsiveActionButtonStyle, textDecoration: 'none', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
          >
            <Icon name="clock" size="sm" />
            Timing →
          </a>
          <a
            className="btn-secondary"
            href="/documents?tab=templates"
            title="Cover Letter Templates"
            aria-label="Browse cover letter templates"
            onMouseEnter={(e) => { e.currentTarget.dataset.origColor = e.currentTarget.style.color || window.getComputedStyle(e.currentTarget).color; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = e.currentTarget.dataset.origColor || ''; }}
            style={{ ...responsiveActionButtonStyle, textDecoration: 'none', backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3' }}
          >
            <Icon name="file-text" size="sm" />
            Cover Letters →
          </a>
          <button 
            className="add-education-button"
            onClick={() => {
              setForm(defaultForm);
              setEditingId(null);
              setFieldErrors({});
              setCharCount(0);
              setShowForm(true);
            }}
            onMouseEnter={(e) => { e.currentTarget.dataset.origColor = e.currentTarget.style.color || window.getComputedStyle(e.currentTarget).color; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = e.currentTarget.dataset.origColor || ''; }}
            style={{ ...responsiveActionButtonStyle, flex: '1 1 150px' }}
          >
            + Add Job
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {/* UC-045: Undo Notification */}
      {undoNotification && (
        <div style={{ 
          background: '#10b981', 
          color: 'white', 
          padding: '10px 16px', 
          borderRadius: '8px', 
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'nowrap',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <span style={{ 
            fontSize: '14px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: '1'
          }}>
            {undoNotification.message}
          </span>
          <button
            onClick={undoAction}
            style={{
              background: 'white',
              color: '#10b981',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            Undo
          </button>
        </div>
      )}

      {showStatusModal && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h3 style={{ marginBottom: '16px' }}>Update Job Status</h3>
            <p style={{ marginBottom: '16px', color: '#666' }}>
              Apply a status to {selectedJobs.length} selected job(s).
            </p>
            <div className="form-group">
              <label htmlFor="bulk-status-select">Status</label>
              <select
                id="bulk-status-select"
                value={bulkStatusValue}
                onChange={(e) => setBulkStatusValue(e.target.value)}
                style={{ width: '100%' }}
              >
                {jobStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="cancel-button" onClick={() => setShowStatusModal(false)}>
                Cancel
              </button>
              <button className="save-button" onClick={confirmBulkStatusUpdate} style={{ background: '#1d4ed8' }}>
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UC-069: Application Automation Dashboard */}
      {showAutomation && (
        <div className="education-form-card" style={{ 
          marginBottom: '20px',
          overflow: 'visible', // Override overflow: hidden to prevent cutting off modals
          minHeight: 'auto'
        }}>
          <AutomationDashboard />
        </div>
      )}

      {/* Calendar: placed below the header and above the search box */}
      <DeadlineCalendar items={items} interviews={interviews} />

      {/* Job Match Rankings Section */}
      {showMatchRanking && (
        <div className="education-form-card" style={{ marginBottom: '20px' }}>
          <div style={{ padding: '20px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              marginBottom: '16px',
              borderBottom: '2px solid #f1f5f9',
              paddingBottom: '12px'
            }}>
              <Icon name="trending-up" size="md" style={{ color: '#667eea' }} />
              <h3 style={{ 
                margin: 0, 
                color: '#1e293b',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Jobs Ranked by Match Percentage
              </h3>
              <button
                onClick={fetchJobMatchScores}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginLeft: 'auto'
                }}
                disabled={loadingMatchScores}
              >
                <Icon name="refresh-cw" size="sm" />
                {loadingMatchScores ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            
            {loadingMatchScores ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                color: '#64748b',
                fontSize: '14px',
                justifyContent: 'center',
                padding: '20px'
              }}>
                <Icon name="loader" size="sm" />
                Loading match scores...
              </div>
            ) : !Array.isArray(jobMatchScores) || jobMatchScores.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                color: '#64748b', 
                padding: '20px',
                fontSize: '14px'
              }}>
                No match scores available. Make sure you have jobs and a complete profile.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Array.isArray(jobMatchScores) && jobMatchScores.slice(0, 10).map((jobScore, index) => {
                  const matchPercent = Math.round((jobScore.overall_score || 0));
                  return (
                    <div
                      key={jobScore.job_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: index < 3 ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(34, 197, 94, 0.05) 100%)' : '#f8fafc',
                        borderRadius: '8px',
                        border: `1px solid ${index < 3 ? '#10b981' : '#e2e8f0'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => navigate(`/jobs/${jobScore.job_id}`)}
                    >
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: '600', 
                        color: index < 3 ? '#10b981' : '#64748b',
                        minWidth: '24px',
                        textAlign: 'center',
                        marginRight: '16px'
                      }}>
                        #{index + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: '600', 
                          color: '#1e293b',
                          marginBottom: '2px',
                          fontSize: '15px'
                        }}>
                          {jobScore.title}
                        </div>
                        <div style={{ 
                          fontSize: '13px', 
                          color: '#64748b' 
                        }}>
                          {jobScore.company_name}
                        </div>
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px' 
                      }}>
                        <div style={{
                          background: `linear-gradient(135deg, ${matchPercent >= 70 ? '#10b981' : matchPercent >= 50 ? '#f59e0b' : '#ef4444'} 0%, ${matchPercent >= 70 ? '#059669' : matchPercent >= 50 ? '#d97706' : '#dc2626'} 100%)`,
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '600',
                          minWidth: '50px',
                          textAlign: 'center'
                        }}>
                          {matchPercent}%
                        </div>
                        <Icon name="chevron-right" size="sm" style={{ color: '#94a3b8' }} />
                      </div>
                    </div>
                  );
                })}
                {Array.isArray(jobMatchScores) && jobMatchScores.length > 10 && (
                  <div style={{ 
                    textAlign: 'center', 
                    color: '#64748b', 
                    fontSize: '13px',
                    marginTop: '8px'
                  }}>
                    Showing top 10 matches • {jobMatchScores.length} total jobs ranked
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* UC-039: Search and Filter Section */}
      {!showForm && (
        <div className="education-form-card" style={{ marginBottom: '20px' }}>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px', minWidth: '250px', display: 'flex', alignItems: 'stretch' }}>
                <input
                  type="text"
                  placeholder="🔍 Search by job title, company, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ 
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #d1d5db',
                    borderRadius: '10px',
                    fontSize: '15px',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit',
                    background: 'var(--white)',
                    marginBottom: 0
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowFilters(!showFilters)}
                  style={{ whiteSpace: 'nowrap', minWidth: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {showFilters ? '▲ Hide' : '▼ Show'} Filters
                </button>
                <button
                  type="button"
                  className="delete-button"
                  onClick={clearFilters}
                  style={{ whiteSpace: 'nowrap', minWidth: '48px', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  title="Clear All Filters"
                >
                  <Icon name="clear" size="md" />
                </button>
              </div>
            </div>

            {isFetching && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', marginBottom: showFilters ? '16px' : '0' }}>
                <Icon name="loader" size="sm" className="spin" ariaLabel="Updating results" />
                Updating results...
              </div>
            )}
            
            {showFilters && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group">
                    <label>Industry</label>
                    <select name="industry" value={filters.industry} onChange={onFilterChange}>
                      <option value="">All Industries</option>
                      {industryOptions.map((ind) => (<option key={ind} value={ind}>{ind}</option>))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <input
                      name="location"
                      value={filters.location}
                      onChange={onFilterChange}
                      placeholder="City, State or Remote"
                    />
                  </div>
                  <div className="form-group">
                    <label>Job Type</label>
                    <select name="job_type" value={filters.job_type} onChange={onFilterChange}>
                      <option value="">All Types</option>
                      {jobTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group">
                    <label>Min Salary</label>
                    <input
                      type="number"
                      name="salary_min"
                      value={filters.salary_min}
                      onChange={onFilterChange}
                      placeholder="e.g., 100000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Salary</label>
                    <input
                      type="number"
                      name="salary_max"
                      value={filters.salary_max}
                      onChange={onFilterChange}
                      placeholder="e.g., 150000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Sort By</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                      <option value="date_added">Date Added (Newest)</option>
                      <option value="deadline">Application Deadline</option>
                      <option value="salary">Salary (Highest)</option>
                      <option value="company_name">Company Name (A-Z)</option>
                    </select>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div className="form-group">
                    <label>Deadline From</label>
                    <input
                      type="date"
                      name="deadline_from"
                      value={filters.deadline_from}
                      onChange={onFilterChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Deadline To</label>
                    <input
                      type="date"
                      name="deadline_to"
                      value={filters.deadline_to}
                      onChange={onFilterChange}
                    />
                  </div>
                  <div className="form-group" style={{ visibility: 'hidden' }}>
                    {/* Empty column for alignment */}
                  </div>
                </div>
                
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#666', fontWeight: '500' }}>
                  Showing {items.length} result{items.length !== 1 ? 's' : ''}
                  {searchQuery && ` for "${searchQuery}"`}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Edit/add form if user prompts */}
      {showForm && (
        <div className="education-form-card" style={{ overflow: 'visible' }}>
          <div className="form-header">
            <h3>{editingId ? 'Edit Job' : 'Add Job'}</h3>
            <button className="close-button" onClick={resetForm}><Icon name="trash" size="sm" ariaLabel="Close" /></button>
          </div>

          <form className="education-form" onSubmit={handleSubmit}>
            {/* UC-041: Import from URL - Only show when adding new job */}
            {!editingId && (
              <div
                className="form-section"
                style={{
                  padding: '20px',
                  marginBottom: '24px',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                  borderRadius: '10px',
                  border: '2px dashed #667eea'
                }}
              >
                <h4
                  style={{
                    marginTop: 0,
                    marginBottom: '12px',
                    color: '#667eea',
                    fontSize: '16px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Icon name="link" size="sm" />
                  Quick Import from Job Posting URL
                </h4>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '16px',
                    lineHeight: '1.5'
                  }}
                >
                  Paste a job posting URL from <strong>LinkedIn</strong>, <strong>Indeed</strong>, or <strong>Glassdoor</strong> to automatically fill in details
                </p>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 260px' }}>
                    <input
                      type="url"
                      placeholder="https://www.linkedin.com/jobs/view/..."
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      disabled={importing}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '15px',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleImportFromUrl}
                    disabled={importing || !importUrl.trim()}
                    style={{
                      padding: '12px 24px',
                      fontSize: '15px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      border: 'none',
                      background: importing ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      cursor: importing || !importUrl.trim() ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                    }}
                  >
                    {importing ? (
                      <>
                        <span
                          style={{
                            display: 'inline-block',
                            width: '14px',
                            height: '14px',
                            border: '2px solid white',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 0.6s linear infinite'
                          }}
                        />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Icon name="download" size="sm" />
                        Import
                      </>
                    )}
                  </button>
                </div>

                {importStatus && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background:
                        importStatus === 'success'
                          ? '#ecfdf5'
                          : importStatus === 'partial'
                          ? '#fef3c7'
                          : '#fee2e2',
                      border:
                        importStatus === 'success'
                          ? '1px solid #10b981'
                          : importStatus === 'partial'
                          ? '1px solid #f59e0b'
                          : '1px solid #ef4444',
                      color:
                        importStatus === 'success'
                          ? '#065f46'
                          : importStatus === 'partial'
                          ? '#92400e'
                          : '#991b1b'
                    }}
                  >
                    {importStatus === 'success' && '✓ Successfully imported'}
                    {importStatus === 'partial' && '⚠ Partially imported'}
                    {importStatus === 'failed' && '✗ Import failed'}
                    {importedFields.length > 0 && ` (${importedFields.length} field${importedFields.length > 1 ? 's' : ''})`}
                  </div>
                )}

                <style>{`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}

            {/* Job Details */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="title">
                  Job Title <span className="required">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  value={form.title}
                  onChange={onChange}
                  placeholder="e.g., Software Engineer"
                  className={fieldErrors.title ? 'error' : ''}
                  style={getFieldStyle('title')}
                />
                {fieldErrors.title && <div className="error-message">{fieldErrors.title}</div>}
              </div>
              <div className="form-group" style={{ position: 'relative' }} ref={companyDropdownRef}>
                <label htmlFor="company_name">
                  Company <span className="required">*</span>
                </label>
                <input
                  id="company_name"
                  name="company_name"
                  value={form.company_name}
                  onChange={onChange}
                  onFocus={handleCompanyInputFocus}
                  placeholder="e.g., Acme Inc"
                  className={fieldErrors.company_name ? 'error' : ''}
                  style={getFieldStyle('company_name')}
                  autoComplete="off"
                />
                {fieldErrors.company_name && <div className="error-message">{fieldErrors.company_name}</div>}
                {companyDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
                      marginTop: '4px',
                      zIndex: 25,
                      maxHeight: '220px',
                      overflowY: 'auto',
                    }}
                  >
                    {companyMatches.length === 0 && companySearchStatus ? (
                      <div style={{ padding: '10px 12px', fontSize: '13px', color: '#6b7280' }}>
                        {companySearchStatus}
                      </div>
                    ) : (
                      companyMatches.map((company) => (
                        <button
                          key={company.id || company.name}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleSelectCompany(company);
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 12px',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{company.name}</span>
                          {company.domain ? (
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>{company.domain}</span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input 
                  id="location" 
                  name="location" 
                  value={form.location} 
                  onChange={onChange} 
                  placeholder="City, State or Remote"
                  className={fieldErrors.location ? 'error' : ''}
                  style={getFieldStyle('location')}
                />
                {fieldErrors.location && <div className="error-message">{fieldErrors.location}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="job_type">Job Type</label>
                <select 
                  id="job_type" 
                  name="job_type" 
                  value={form.job_type} 
                  onChange={onChange}
                  className={fieldErrors.job_type ? 'error' : ''}
                >
                  {jobTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {fieldErrors.job_type && <div className="error-message">{fieldErrors.job_type}</div>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="industry">Industry</label>
                <select 
                  id="industry" 
                  name="industry" 
                  value={form.industry} 
                  onChange={onChange}
                  className={fieldErrors.industry ? 'error' : ''}
                >
                  <option value="">Select...</option>
                  {industryOptions.map((ind) => (<option key={ind} value={ind}>{ind}</option>))}
                </select>
                {fieldErrors.industry && <div className="error-message">{fieldErrors.industry}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="posting_url">Job Posting URL</label>
                <input 
                  id="posting_url" 
                  name="posting_url" 
                  value={form.posting_url} 
                  onChange={onChange} 
                  placeholder="https://..."
                  className={fieldErrors.posting_url ? 'error' : ''}
                  style={getFieldStyle('posting_url')}
                />
                {fieldErrors.posting_url && <div className="error-message">{fieldErrors.posting_url}</div>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="application_deadline">Application Deadline</label>
                <input 
                  id="application_deadline" 
                  type="date" 
                  name="application_deadline" 
                  value={form.application_deadline} 
                  onChange={onChange}
                  className={fieldErrors.application_deadline ? 'error' : ''}
                  style={getFieldStyle('application_deadline')}
                />
                {fieldErrors.application_deadline && <div className="error-message">{fieldErrors.application_deadline}</div>}
              </div>
              <div className="form-group" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="salary_min">Salary Min</label>
                <input
                  id="salary_min"
                  type="number"
                  step="0.01"
                  name="salary_min"
                  value={form.salary_min}
                  onChange={onChange}
                  placeholder="e.g., 100000"
                  className={fieldErrors.salary_min ? 'error' : ''}
                />
                {fieldErrors.salary_min && <div className="error-message">{fieldErrors.salary_min}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="salary_max">Salary Max</label>
                <input 
                  id="salary_max" 
                  type="number" 
                  step="0.01" 
                  name="salary_max" 
                  value={form.salary_max} 
                  onChange={onChange} 
                  placeholder="e.g., 150000"
                  className={fieldErrors.salary_max ? 'error' : ''}
                />
                {fieldErrors.salary_max && <div className="error-message">{fieldErrors.salary_max}</div>}
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="salary_currency">Currency</label>
                <input 
                  id="salary_currency" 
                  name="salary_currency" 
                  value={form.salary_currency} 
                  onChange={onChange} 
                  placeholder="USD" 
                  maxLength={3}
                  className={fieldErrors.salary_currency ? 'error' : ''}
                />
                {fieldErrors.salary_currency && <div className="error-message">{fieldErrors.salary_currency}</div>}
              </div>
              <div className="form-group" />
            </div>

            <div className="form-group">
              <label htmlFor="description">
                Description / Notes
                <span className={`char-counter ${charCount === MAX_DESC ? 'limit-reached' : ''}`}>
                  {charCount}/{MAX_DESC}
                </span>
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={onChange}
                rows={6}
                placeholder="Paste description or your notes (max 2000)"
                className={fieldErrors.description ? 'error' : ''}
                style={getFieldStyle('description')}
              />
              {fieldErrors.description && <div className="error-message">{fieldErrors.description}</div>}
            </div>

            <div className="form-actions">
              <button type="button" className="cancel-button" onClick={resetForm} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="save-button" disabled={saving}>
                {saving ? 'Saving...' : (editingId ? 'Update Job' : 'Add Job')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Your job entries */}
      {(items || []).length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-icon"><Icon name="briefcase" size="xl" ariaLabel="No jobs" /></div>
          {searchQuery || Object.values(filters).some(v => v) ? (
            <>
              <h3>No Jobs Match Your Search</h3>
              <p>Try adjusting your filters or search terms.</p>
              <button className="add-education-button" onClick={clearFilters}>
                Clear Filters
              </button>
            </>
          ) : (
            <>
              <h3>No Job Entries Yet</h3>
              <p>Track jobs you're interested in and keep key details handy.</p>
              <button className="add-education-button" onClick={() => {
                setForm(defaultForm);
                setEditingId(null);
                setFieldErrors({});
                setCharCount(0);
                setShowForm(true);
              }}>
                + Add Your First Job
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* UC-045: Bulk select all checkbox with action buttons - Active Jobs */}
          {!showArchived && items.length > 0 && (
            <div style={{ 
              padding: '12px 16px', 
              background: '#f9fafb', 
              borderRadius: '8px', 
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={selectedJobs.length === items.length && items.length > 0}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                />
                <label style={{ cursor: 'pointer', userSelect: 'none', fontWeight: '600' }} onClick={toggleSelectAll}>
                  Select All ({items.length} jobs)
                </label>
              </div>
              {selectedJobs.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn-secondary"
                    onClick={onBulkSetStatus}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      fontSize: '14px',
                    }}
                  >
                    <Icon name="check-circle" size="sm" />
                    Set Status ({selectedJobs.length})
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={onBulkArchive}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      background: '#f97316', 
                      color: 'white', 
                      border: 'none',
                      padding: '8px 16px',
                      fontSize: '14px'
                    }}
                  >
                    <Icon name="archive" size="sm" />
                    Archive ({selectedJobs.length})
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={onBulkDelete}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: 'white', 
                      border: 'none',
                      padding: '8px 16px',
                      fontSize: '14px'
                    }}
                  >
                    <Icon name="trash" size="sm" />
                    Delete ({selectedJobs.length})
                  </button>
                </div>
              )}
            </div>
          )}
          {/* UC-045: Bulk select all checkbox with action buttons - Archived Jobs */}
          {showArchived && items.length > 0 && (
            <div style={{ 
              padding: '12px 16px', 
              background: '#fef3c7', 
              borderRadius: '8px', 
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={selectedJobs.length === items.length && items.length > 0}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                />
                <label style={{ cursor: 'pointer', userSelect: 'none', fontWeight: '600' }} onClick={toggleSelectAll}>
                  Select All ({items.length} archived jobs)
                </label>
              </div>
              {selectedJobs.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn-secondary"
                    onClick={onBulkRestore}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                      color: 'white', 
                      border: 'none',
                      padding: '8px 16px',
                      fontSize: '14px'
                    }}
                  >
                    <Icon name="restore" size="sm" />
                    Restore ({selectedJobs.length})
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={onBulkDelete}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: 'white', 
                      border: 'none',
                      padding: '8px 16px',
                      fontSize: '14px'
                    }}
                  >
                    <Icon name="trash" size="sm" />
                    Delete ({selectedJobs.length})
                  </button>
                </div>
              )}
            </div>
          )}
          <div className={`education-list ${viewMode === 'grid' ? 'grid-view' : 'list-view'}`}>
          {(items || []).map((item) => {
            const descriptionForDisplay = formatDescriptionForView(item.description);
            return (
            <div key={item.id} className="education-item">
              <div className="education-item-header">
                {/* UC-045: Checkbox for bulk selection - both active and archived */}
                <div style={{ paddingRight: '12px', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedJobs.includes(item.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleJobSelection(item.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                </div>
                <div 
                  className="education-item-main" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/jobs/${item.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      navigate(`/jobs/${item.id}`);
                    }
                  }}
                >
                  <div className="education-item-title">
                    <span dangerouslySetInnerHTML={{ __html: highlightText(item.title, searchQuery) }} />
                  </div>
                  <div className="education-item-sub">
                    <span dangerouslySetInnerHTML={{ __html: highlightText(item.company_name, searchQuery) }} />
                    {item.location && <span> • {item.location}</span>}
                    {item.job_type && <span> • {jobTypeOptions.find(opt => opt.value === item.job_type)?.label || item.job_type}</span>}
                    {item.industry && <span> • {item.industry}</span>}
                  </div>
                  {item.salary_range && (
                    <div className="education-item-dates">
                      <span className="status">{item.salary_range}</span>
                    </div>
                  )}
                  {item.application_deadline && (() => {
                    const diff = daysUntil(item.application_deadline);
                    // Only apply urgency colors when the job is still in 'interested'
                    const color = item.status === 'interested' ? deadlineColor(diff) : '#94a3b8';
                    return (
                      <div className="education-item-dates" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 4, background: color }} aria-hidden />
                        {/* Keep this exact text for existing tests */}
                        <span className="status" data-testid="application-deadline">Deadline: {item.application_deadline}</span>
                        {diff != null && (
                          <span style={{ fontSize: 12, color: '#444' }}>
                            {diff < 0 ? `Overdue by ${Math.abs(diff)}d` : `${diff}d left`}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {item.description && searchQuery && item.description.toLowerCase().includes(searchQuery.toLowerCase()) && (
                    <div className="education-item-dates" style={{ marginTop: '4px' }}>
                      <span style={{ color: '#666', fontSize: '13px' }} dangerouslySetInnerHTML={{ 
                        __html: highlightText(item.description.substring(0, 150), searchQuery) 
                      }} />
                      {item.description.length > 150 && '...'}
                    </div>
                  )}
                </div>
                <div className="education-item-actions">
                  {/* UC-041: Link to job posting - moved to first position */}
                  {item.posting_url && (
                    <a 
                      className="view-button"
                      href={item.posting_url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open job posting"
                      aria-label="Open job posting"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Icon name="link" size="sm" ariaLabel="View" />
                    </a>
                  )}
                  <button 
                    className="view-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/jobs/${item.id}`);
                    }}
                    title="View job details"
                    aria-label="View job details"
                  >
                    <Icon name="eye" size="sm" ariaLabel="View" />
                  </button>
                  {/* UC-042: Materials button */}
                  {!showArchived && (
                    <button 
                      className="materials-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openMaterialsModal(item);
                      }}
                    title="Manage materials"
                    aria-label="Manage materials"
                    >
                      <Icon name="file-text" size="sm" ariaLabel="Materials" />
                    </button>
                  )}
                  {/* UC-067: Salary Research button */}
                  {!showArchived && (
                    <button 
                      className="salary-research-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/jobs/${item.id}/salary-research`);
                      }}
                      title="Open salary research"
                      aria-label="Open salary research"
                    >
                      <Icon name="dollar" size="sm" ariaLabel="Salary Research" />
                    </button>
                  )}
                  {/* UC-083: Salary Negotiation button */}
                  {!showArchived && (
                    <button 
                      className="salary-negotiation-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/jobs/${item.id}/salary-negotiation`);
                      }}
                      title="Open negotiation prep"
                      aria-label="Open negotiation prep"
                    >
                      <Icon name="layers" size="sm" ariaLabel="Salary Negotiation" />
                    </button>
                  )}
                  {!showArchived && (
                    <>
                      <button 
                        className="edit-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(item);
                        }}
                        title="Edit entry"
                        aria-label="Edit entry"
                      >
                        <Icon name="edit" size="sm" ariaLabel="Edit" />
                      </button>
                      <button 
                        className="archive-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onArchive(item.id, 'other');
                        }}
                        title="Archive entry"
                        aria-label="Archive entry"
                      >
                        <Icon name="archive" size="sm" ariaLabel="Archive" />
                      </button>
                    </>
                  )}
                  {showArchived && (
                    <button 
                      className="view-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestore(item.id);
                      }}
                      title="Restore entry"
                      aria-label="Restore entry"
                      style={{ background: '#10b981', color: 'white' }}
                    >
                      <Icon name="restore" size="sm" ariaLabel="Restore" />
                    </button>
                  )}
                  <button 
                    className="delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    title="Delete entry permanently"
                    aria-label="Delete entry permanently"
                  >
                    <Icon name="trash" size="sm" ariaLabel="Delete" />
                  </button>
                </div>
              </div>
              {(item.industry || item.description) && (
                <div className="education-item-details">
                  {item.industry && <div><strong>Industry:</strong> {item.industry}</div>}
                  {descriptionForDisplay && <div><strong>Notes:</strong> {descriptionForDisplay}</div>}
                </div>
              )}
            </div>
            );
          })}
          </div>
        </>
      )}

      {/* UC-045: Archive Reason Modal */}
      {showArchiveModal && (
        <div className="modal-overlay" onClick={() => setShowArchiveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '16px' }}>Archive Jobs</h3>
            <p style={{ marginBottom: '16px', color: '#666' }}>
              Select a reason for archiving {selectedJobs.length} job(s):
            </p>
            <div className="form-group">
              <label>Reason</label>
              <select 
                value={archiveReason} 
                onChange={(e) => setArchiveReason(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="completed">Position Filled/Completed</option>
                <option value="not_interested">No Longer Interested</option>
                <option value="rejected">Application Rejected</option>
                <option value="expired">Posting Expired</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                className="cancel-button"
                onClick={() => setShowArchiveModal(false)}
              >
                Cancel
              </button>
              <button 
                className="save-button"
                onClick={confirmBulkArchive}
                style={{ background: '#f97316' }}
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UC-045: Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content modal-danger" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '16px' }}>
              {Array.isArray(itemToDelete) 
                ? `Delete ${itemToDelete.length} Job${itemToDelete.length > 1 ? 's' : ''} Permanently?`
                : 'Delete Job Permanently?'}
            </h3>
            <p style={{ marginBottom: '16px' }}>
              This action cannot be undone. {Array.isArray(itemToDelete) 
                ? `The ${itemToDelete.length} selected job ${itemToDelete.length > 1 ? 'entries' : 'entry'} will be permanently deleted.`
                : 'The job entry will be permanently deleted.'}
            </p>
            <p style={{ marginBottom: '20px', fontWeight: '600' }}>
              Are you sure you want to proceed?
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
              <button 
                className="btn-secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setItemToDelete(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn-danger-icon"
                onClick={confirmDelete}
                title="Delete Permanently"
                aria-label="Delete Permanently"
              >
                <Icon name="trash" size="sm" ariaLabel="Delete Permanently" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UC-042: Set Default Materials Modal */}
      {showDefaultsModal && (
        <div className="modal-overlay" onClick={() => setShowDefaultsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="file-text" size="md" />
              Set Default Materials
            </h3>
            <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>
              Select default resume and cover letter to automatically apply to new jobs.
            </p>
            
            <form onSubmit={handleSetDefaults}>
              <div className="form-group">
                <label htmlFor="default-resume">Default Resume</label>
                <select
                  id="default-resume"
                  value={materialsForm.resume_doc_id === null ? '' : materialsForm.resume_doc_id}
                  onChange={(e) => setMaterialsForm(prev => ({ 
                    ...prev, 
                    resume_doc_id: e.target.value === '' ? null : parseInt(e.target.value) 
                  }))}
                  style={{ width: '100%' }}
                >
                  <option value="">None</option>
                  {documents.filter(d => d.document_type === 'resume').map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.document_name} (v{doc.version_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="default-cover">Default Cover Letter</label>
                <select
                  id="default-cover"
                  value={materialsForm.cover_letter_doc_id === null ? '' : materialsForm.cover_letter_doc_id}
                  onChange={(e) => setMaterialsForm(prev => ({ 
                    ...prev, 
                    cover_letter_doc_id: e.target.value === '' ? null : parseInt(e.target.value) 
                  }))}
                  style={{ width: '100%' }}
                >
                  <option value="">None</option>
                  {documents.filter(d => d.document_type === 'cover_letter').map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.document_name} (v{doc.version_number})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowDefaultsModal(false)}
                  disabled={savingMaterials}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                  disabled={savingMaterials}
                >
                  {savingMaterials ? 'Saving...' : 'Save Defaults'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UC-042: Job Materials Modal */}
      {showMaterialsModal && selectedJobForMaterials && (
        <div className="modal-overlay" onClick={() => setShowMaterialsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="file-text" size="md" />
              Manage Materials
            </h3>
            <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>
              {selectedJobForMaterials.title} at {selectedJobForMaterials.company_name}
            </p>
            
            <form onSubmit={handleSaveJobMaterials}>
              <div className="form-group">
                <label htmlFor="job-resume">Resume</label>
                <select
                  id="job-resume"
                  value={materialsForm.resume_doc_id === null ? '' : materialsForm.resume_doc_id}
                  onChange={(e) => setMaterialsForm(prev => ({ 
                    ...prev, 
                    resume_doc_id: e.target.value === '' ? null : parseInt(e.target.value) 
                  }))}
                  style={{ width: '100%' }}
                >
                  <option value="">None</option>
                  {documents.filter(d => d.document_type === 'resume').map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.document_name} (v{doc.version_number})
                    </option>
                  ))}
                </select>
                {jobMaterials.resume_doc && (
                  <button
                    type="button"
                    onClick={() => handleDownloadMaterial(jobMaterials.resume_doc.id, jobMaterials.resume_doc.document_name)}
                    style={{ 
                      fontSize: '13px', 
                      color: '#667eea', 
                      marginTop: '4px', 
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    <Icon name="download" size="sm" /> Download current resume
                  </button>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="job-cover">Cover Letter</label>
                <select
                  id="job-cover"
                  value={materialsForm.cover_letter_doc_id === null ? '' : materialsForm.cover_letter_doc_id}
                  onChange={(e) => setMaterialsForm(prev => ({ 
                    ...prev, 
                    cover_letter_doc_id: e.target.value === '' ? null : parseInt(e.target.value) 
                  }))}
                  style={{ width: '100%' }}
                >
                  <option value="">None</option>
                  {documents.filter(d => d.document_type === 'cover_letter').map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.document_name} (v{doc.version_number})
                    </option>
                  ))}
                </select>
                {jobMaterials.cover_letter_doc && (
                  <button
                    type="button"
                    onClick={() => handleDownloadMaterial(jobMaterials.cover_letter_doc.id, jobMaterials.cover_letter_doc.document_name)}
                    style={{ 
                      fontSize: '13px', 
                      color: '#667eea', 
                      marginTop: '4px', 
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    <Icon name="download" size="sm" /> Download current cover letter
                  </button>
                )}
              </div>

              {(defaults.default_resume_doc || defaults.default_cover_letter_doc) && (
                <div style={{ marginBottom: '16px' }}>
                  <button 
                    type="button"
                    className="btn-secondary"
                    onClick={applyDefaultMaterials}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Icon name="upload" size="sm" />
                    Apply Default Materials
                  </button>
                </div>
              )}

              {jobMaterials.history && jobMaterials.history.length > 0 && (
                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                  <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#4b5563' }}>
                    <Icon name="restore" size="sm" /> History
                  </h4>
                  <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                    {jobMaterials.history.map((h) => (
                      <div 
                        key={h.id} 
                        style={{ 
                          padding: '8px 12px', 
                          background: '#f9fafb', 
                          borderRadius: '6px', 
                          marginBottom: '8px',
                          fontSize: '13px',
                          color: '#6b7280'
                        }}
                      >
                        <div style={{ fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                          {new Date(h.changed_at).toLocaleString()}
                        </div>
                        <div>
                          Resume: {h.resume_doc_name ? `${h.resume_doc_name} (v${h.resume_version})` : 'None'}
                        </div>
                        <div>
                          Cover: {h.cover_letter_doc_name ? `${h.cover_letter_doc_name} (v${h.cover_letter_version})` : 'None'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowMaterialsModal(false)}
                  disabled={savingMaterials}
                >
                  Close
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                  disabled={savingMaterials}
                >
                  {savingMaterials ? 'Saving...' : 'Save Materials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Jobs;
