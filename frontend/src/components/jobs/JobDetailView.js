import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jobsAPI, skillsAPI } from '../../services/api';
import Icon from '../common/Icon';
import { CompanyInfo } from '../../features/company';
import InterviewInsights from './InterviewInsights';
import SkillGapAnalysis from './SkillGapAnalysis';

const JobDetailView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [job, setJob] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('basic');
  const [companyInfo, setCompanyInfo] = useState(null);
  const [interviewInsights, setInterviewInsights] = useState(null);
  const [skillsGapAnalysis, setSkillsGapAnalysis] = useState(null);
  const [skillProgress, setSkillProgress] = useState({});
  const [formData, setFormData] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  
  const jobTypeOptions = [
    { value: 'ft', label: 'Full-time' },
    { value: 'pt', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'intern', label: 'Internship' },
    { value: 'temp', label: 'Temporary' },
  ];
  
  const industryOptions = [
    'Software', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing', 'Government', 'Other'
  ];

  useEffect(() => {
    loadJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const buildFallbackCompanyInfo = (jobData) => {
    if (!jobData || !jobData.company_name) return null;
    const inferredDomain = jobData.company_name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || '';
    return {
      name: jobData.company_name,
      industry: jobData.industry || '',
      size: '',
      hq_location: jobData.location || '',
      domain: inferredDomain ? `${inferredDomain}.com` : '',
      website: jobData.posting_url || '',
      linkedin_url: '',
      description: '',
      mission_statement: '',
      glassdoor_rating: null,
      employee_count: null,
      recent_news: [],
    };
  };

  const loadJob = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await jobsAPI.getJob(id);
      setJob(data);
      if (data.company_info && data.company_info.name) {
        setCompanyInfo(data.company_info);
      } else {
        setCompanyInfo(buildFallbackCompanyInfo(data));
      }
      setFormData({
        title: data.title || '',
        company_name: data.company_name || '',
        location: data.location || '',
        salary_min: data.salary_min !== null && data.salary_min !== undefined ? String(data.salary_min) : '',
        salary_max: data.salary_max !== null && data.salary_max !== undefined ? String(data.salary_max) : '',
        salary_currency: data.salary_currency || 'USD',
        posting_url: data.posting_url || '',
        application_deadline: data.application_deadline || '',
        description: data.description || '',
        industry: data.industry || '',
        job_type: data.job_type || 'ft',
        personal_notes: data.personal_notes || '',
        recruiter_name: data.recruiter_name || '',
        recruiter_email: data.recruiter_email || '',
        recruiter_phone: data.recruiter_phone || '',
        hiring_manager_name: data.hiring_manager_name || '',
        hiring_manager_email: data.hiring_manager_email || '',
        salary_negotiation_notes: data.salary_negotiation_notes || '',
        interview_notes: data.interview_notes || '',
        application_history: data.application_history || [],
      });
    } catch (e) {
      const msg = e?.message || e?.error?.message || 'Failed to load job';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const n = { ...prev };
        delete n[name];
        return n;
      });
    }
  };

  const addHistoryEntry = () => {
    const action = prompt('Enter action (e.g., "Applied", "Phone Screen Scheduled", "Interview Completed"):');
    if (!action) return;
    
    const notes = prompt('Enter notes (optional):');
    
    const entry = {
      action: action.trim(),
      timestamp: new Date().toISOString(),
      notes: notes?.trim() || '',
    };
    
    setFormData((prev) => ({
      ...prev,
      application_history: [...(prev.application_history || []), entry],
    }));
  };

  const removeHistoryEntry = (index) => {
    if (!window.confirm('Remove this history entry?')) return;
    setFormData((prev) => ({
      ...prev,
      application_history: prev.application_history.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    
    try {
      const payload = { ...formData };
      
      // Normalize salary fields
      ['salary_min', 'salary_max'].forEach((k) => {
        if (payload[k] === '') payload[k] = null;
        else payload[k] = payload[k] === null ? null : Number(payload[k]);
      });
      
      // Normalize optional string fields
      ['posting_url', 'industry', 'location', 'description', 'personal_notes',
       'recruiter_name', 'recruiter_email', 'recruiter_phone',
       'hiring_manager_name', 'hiring_manager_email',
       'salary_negotiation_notes', 'interview_notes'].forEach((k) => {
        if (!payload[k]) payload[k] = '';
      });
      
      // Normalize date field
      if (!payload.application_deadline || payload.application_deadline === '') {
        payload.application_deadline = null;
      }

      const updated = await jobsAPI.updateJob(id, payload);
      setJob(updated);
      setFormData({
        title: updated.title || '',
        company_name: updated.company_name || '',
        location: updated.location || '',
        salary_min: updated.salary_min !== null && updated.salary_min !== undefined ? String(updated.salary_min) : '',
        salary_max: updated.salary_max !== null && updated.salary_max !== undefined ? String(updated.salary_max) : '',
        salary_currency: updated.salary_currency || 'USD',
        posting_url: updated.posting_url || '',
        application_deadline: updated.application_deadline || '',
        description: updated.description || '',
        industry: updated.industry || '',
        job_type: updated.job_type || 'ft',
        personal_notes: updated.personal_notes || '',
        recruiter_name: updated.recruiter_name || '',
        recruiter_email: updated.recruiter_email || '',
        recruiter_phone: updated.recruiter_phone || '',
        hiring_manager_name: updated.hiring_manager_name || '',
        hiring_manager_email: updated.hiring_manager_email || '',
        salary_negotiation_notes: updated.salary_negotiation_notes || '',
        interview_notes: updated.interview_notes || '',
        application_history: updated.application_history || [],
      });
      setEditMode(false);
      setSuccess('Job updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      if (e?.details) setFieldErrors(e.details);
      const msg = Array.isArray(e?.messages) && e.messages.length
        ? e.messages.join(' • ')
        : (e?.message || e?.error?.message || 'Failed to save');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const formatTimestamp = (isoStr) => {
    if (!isoStr) return '';
    try {
      return new Date(isoStr).toLocaleString();
    } catch {
      return isoStr;
    }
  };

  const fetchInterviewInsights = useCallback(async (jobId) => {
    try {
      const insights = await jobsAPI.getJobInterviewInsights(jobId);
      setInterviewInsights(insights);
    } catch (err) {
      console.warn('Unable to load interview insights', err);
      setInterviewInsights(null);
    }
  }, []);

  const fetchSkillsGap = useCallback(async (jobId, options = {}) => {
    try {
      const analysis = await jobsAPI.getJobSkillsGap(jobId, options);
      setSkillsGapAnalysis(analysis);

      // Load progress for each skill
      if (analysis && analysis.skills) {
        const progressData = {};
        await Promise.all(
          analysis.skills.map(async (skill) => {
            try {
              const progress = await jobsAPI.getSkillProgress(skill.skill_id);
              if (progress && progress.length > 0) {
                // Calculate total hours from all progress entries
                const totalHours = progress.reduce((sum, entry) => sum + (entry.hours_spent || 0), 0);
                const latestProgress = progress[progress.length - 1];
                progressData[skill.skill_id] = {
                  total_hours: totalHours,
                  progress_percent: latestProgress.progress_percent || 0,
                };
              }
            } catch (err) {
              // Skip if can't load progress for this skill
            }
          })
        );
        setSkillProgress(progressData);
      }
    } catch (err) {
      console.warn('Unable to load skills gap analysis', err);
      setSkillsGapAnalysis(null);
    }
  }, []);

  const handleRefreshSkillsGap = () => {
    if (job?.id) {
      fetchSkillsGap(job.id, { refresh: true });
    }
  };

  const handleLogSkillProgress = async (skill, logData) => {
    try {
      // Calculate progress percentage based on hours spent
      const totalNeeded = skill.suggested_learning_path?.reduce((sum, step) => sum + (step.estimated_hours || 0), 0) || 40;
      const currentSpent = skillProgress[skill.skill_id]?.total_hours || 0;
      const newTotal = currentSpent + logData.hours_spent;
      const progressPercent = Math.min(100, Math.round((newTotal / totalNeeded) * 100));

      await jobsAPI.logSkillProgress(skill.skill_id, {
        activity_type: 'practice',
        hours_spent: logData.hours_spent,
        progress_percent: progressPercent,
        job_id: job.id,
      });

      // Update local skill progress immediately for instant UI feedback
      setSkillProgress((prev) => ({
        ...prev,
        [skill.skill_id]: {
          total_hours: newTotal,
          progress_percent: progressPercent,
        },
      }));
      
      setSuccess('Practice logged successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to log progress: ' + (err.message || 'Unknown error'));
    }
  };

  const handleAddSkill = async (skill) => {
    try {
      await skillsAPI.addSkill({
        skill_id: skill.skill_id,
        level: 'beginner',
        years: 0,
      });

      setSuccess(`${skill.name} added to your skills!`);
      setTimeout(() => setSuccess(''), 3000);

      // Refresh the analysis to show the updated status
      if (job?.id) {
        await fetchSkillsGap(job.id, { refresh: true });
      }
    } catch (err) {
      setError('Failed to add skill: ' + (err.message || 'Unknown error'));
    }
  };

  useEffect(() => {
    if (!job?.id || !job?.company_name) {
      setCompanyInfo(null);
      return;
    }

    let isMounted = true;

    const fetchCompanyInfo = async () => {
      try {
        const info = await jobsAPI.getJobCompanyInsights(job.id);
        if (isMounted && info && info.name) {
          setCompanyInfo(info);
        } else if (isMounted) {
          setCompanyInfo((prev) => prev || buildFallbackCompanyInfo(job));
        }
      } catch (err) {
        console.warn('Unable to load company profile', err);
        if (isMounted) {
          setCompanyInfo((prev) => prev || buildFallbackCompanyInfo(job));
        }
      }
    };

    fetchCompanyInfo();

    return () => {
      isMounted = false;
    };
  }, [job]);

  useEffect(() => {
    if (job?.id) {
      fetchInterviewInsights(job.id);
      fetchSkillsGap(job.id);
    }
  }, [job?.id, fetchInterviewInsights, fetchSkillsGap]);

  if (loading) {
    return (
      <div className="education-container">
        <div className="page-backbar">
          <button className="btn-back" onClick={() => navigate('/jobs')}>
            ← Back to Jobs
          </button>
        </div>
        <p>Loading...</p>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="education-container">
        <div className="page-backbar">
          <button className="btn-back" onClick={() => navigate('/jobs')}>
            ← Back to Jobs
          </button>
        </div>
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  return (
    <div className="education-container">
      <div className="page-backbar">
        <button className="btn-back" onClick={() => navigate('/jobs')}>
          ← Back to Jobs
        </button>
      </div>

      <div className="education-header">
        <h2>
          <Icon name="briefcase" size="md" /> Job Details
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          {!editMode ? (
            <button className="add-education-button" onClick={() => setEditMode(true)}>
              <Icon name="edit" size="sm" /> Edit
            </button>
          ) : (
            <>
              <button 
                className="cancel-button" 
                onClick={() => {
                  setEditMode(false);
                  loadJob();
                  setFieldErrors({});
                }}
                disabled={saving}
                style={{ 
                  padding: '12px 24px',
                  fontSize: '15px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: '1.5px solid #d1d5db',
                  background: 'white',
                  color: '#4b5563',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                className="save-button" 
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '12px 28px',
                  fontSize: '15px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        borderBottom: '2px solid #e5e7eb',
        marginBottom: '24px',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => setActiveTab('basic')}
          style={{
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '600',
            border: 'none',
            background: 'none',
            color: activeTab === 'basic' ? '#667eea' : '#6b7280',
            borderBottom: activeTab === 'basic' ? '3px solid #667eea' : '3px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            marginBottom: '-2px',
          }}
        >
          <Icon name="info" size="sm" /> Basic Information
        </button>
        <button
          onClick={() => setActiveTab('interview')}
          style={{
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '600',
            border: 'none',
            background: 'none',
            color: activeTab === 'interview' ? '#667eea' : '#6b7280',
            borderBottom: activeTab === 'interview' ? '3px solid #667eea' : '3px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            marginBottom: '-2px',
          }}
        >
          <Icon name="user-check" size="sm" /> Interview Insights
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          style={{
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '600',
            border: 'none',
            background: 'none',
            color: activeTab === 'skills' ? '#667eea' : '#6b7280',
            borderBottom: activeTab === 'skills' ? '3px solid #667eea' : '3px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            marginBottom: '-2px',
          }}
        >
          <Icon name="target" size="sm" /> Skills Gap Analysis
        </button>
      </div>

      {/* Tab Content - Basic Information */}
      {activeTab === 'basic' && (
        <>
          {/* Basic Information & Company Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ width: '100%' }}>
              {/* Job Details */}
              <div className="education-form-card" style={{ height: '100%' }}>
                <div className="form-header">
                  <h3>Basic Information</h3>
                </div>
            
            {editMode ? (
          <form className="education-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="title">Job Title <span className="required">*</span></label>
                <input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={onChange}
                  className={fieldErrors.title ? 'error' : ''}
                />
                {fieldErrors.title && <div className="error-message">{fieldErrors.title}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="company_name">Company <span className="required">*</span></label>
                <input
                  id="company_name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={onChange}
                  className={fieldErrors.company_name ? 'error' : ''}
                />
                {fieldErrors.company_name && <div className="error-message">{fieldErrors.company_name}</div>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input id="location" name="location" value={formData.location} onChange={onChange} />
              </div>
              <div className="form-group">
                <label htmlFor="job_type">Job Type</label>
                <select id="job_type" name="job_type" value={formData.job_type} onChange={onChange}>
                  {jobTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="industry">Industry</label>
                <select id="industry" name="industry" value={formData.industry} onChange={onChange}>
                  <option value="">Select...</option>
                  {industryOptions.map((ind) => (<option key={ind} value={ind}>{ind}</option>))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="posting_url">Job Posting URL</label>
                <input id="posting_url" name="posting_url" value={formData.posting_url} onChange={onChange} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="application_deadline">Application Deadline</label>
                <input 
                  id="application_deadline" 
                  type="date" 
                  name="application_deadline" 
                  value={formData.application_deadline} 
                  onChange={onChange}
                />
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
                  value={formData.salary_min}
                  onChange={onChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="salary_max">Salary Max</label>
                <input 
                  id="salary_max" 
                  type="number" 
                  step="0.01" 
                  name="salary_max" 
                  value={formData.salary_max} 
                  onChange={onChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Job Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={onChange}
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="form-actions" style={{ marginTop: '24px' }}>
              <button 
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="save-button"
                style={{
                  padding: '12px 28px',
                  fontSize: '15px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  width: '100%'
                }}
              >
                {saving ? 'Saving...' : 'Save Basic Information'}
              </button>
            </div>
          </form>
            ) : (
              <div className="education-form" style={{ padding: '32px' }}>
            <div className="detail-row" style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Job Title:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.title}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Company:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.company_name}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Location:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.location || 'Not specified'}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Job Type:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>
                {jobTypeOptions.find(opt => opt.value === job.job_type)?.label || job.job_type}
              </div>
            </div>
            <div className="detail-row" style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Industry:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.industry || 'Not specified'}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Salary Range:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.salary_range || 'Not specified'}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Application Deadline:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{formatDate(job.application_deadline)}</div>
            </div>
            {job.posting_url && (
              <div className="detail-row" style={{ marginBottom: '16px' }}>
                <strong style={{ color: '#374151', fontSize: '15px' }}>Posting URL:</strong>
                <div style={{ marginTop: '4px' }}>
                  <a 
                    href={job.posting_url} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ 
                      color: '#667eea', 
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '16px'
                    }}
                  >
                    View Posting <Icon name="link" size="sm" />
                  </a>
                </div>
              </div>
            )}
            {job.description && (
              <div className="detail-row" style={{ marginTop: '20px' }}>
                <strong style={{ color: '#374151', fontSize: '15px' }}>Description:</strong>
                <div style={{ 
                  whiteSpace: 'pre-wrap', 
                  marginTop: '8px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  fontSize: '15px',
                  color: '#4b5563',
                  lineHeight: '1.6'
                }}>
                  {job.description}
                </div>
              </div>
              )}
              </div>
            )}
          </div>
        </div>
        {companyInfo && (
          <div style={{ width: '100%' }}>
            <CompanyInfo companyInfo={companyInfo} jobId={job.id} />
          </div>
        )}
      </div>

      {/* Contact Information */}
      <div className="education-form-card">
        <div className="form-header">
          <h3>Contact Information</h3>
        </div>
        
        {editMode ? (
          <form className="education-form">
            <h4 style={{ color: '#111827', fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Recruiter</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="recruiter_name">Name</label>
                <input id="recruiter_name" name="recruiter_name" value={formData.recruiter_name} onChange={onChange} />
              </div>
              <div className="form-group">
                <label htmlFor="recruiter_email">Email</label>
                <input id="recruiter_email" type="email" name="recruiter_email" value={formData.recruiter_email} onChange={onChange} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="recruiter_phone">Phone</label>
              <input id="recruiter_phone" name="recruiter_phone" value={formData.recruiter_phone} onChange={onChange} />
            </div>

            <h4 style={{ color: '#111827', fontSize: '18px', fontWeight: '600', marginTop: '32px', marginBottom: '16px' }}>Hiring Manager</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="hiring_manager_name">Name</label>
                <input id="hiring_manager_name" name="hiring_manager_name" value={formData.hiring_manager_name} onChange={onChange} />
              </div>
              <div className="form-group">
                <label htmlFor="hiring_manager_email">Email</label>
                <input id="hiring_manager_email" type="email" name="hiring_manager_email" value={formData.hiring_manager_email} onChange={onChange} />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '24px' }}>
              <button 
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="save-button"
                style={{
                  padding: '12px 28px',
                  fontSize: '15px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  width: '100%'
                }}
              >
                {saving ? 'Saving...' : 'Save Contact Information'}
              </button>
            </div>
          </form>
        ) : (
          <div className="education-form" style={{ padding: '32px' }}>
            <h4 style={{ color: '#111827', fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Recruiter</h4>
            <div className="detail-row" style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Name:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.recruiter_name || 'Not specified'}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Email:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.recruiter_email || 'Not specified'}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Phone:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.recruiter_phone || 'Not specified'}</div>
            </div>

            <h4 style={{ color: '#111827', fontSize: '18px', fontWeight: '600', marginTop: '32px', marginBottom: '16px' }}>Hiring Manager</h4>
            <div className="detail-row" style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Name:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.hiring_manager_name || 'Not specified'}</div>
            </div>
            <div className="detail-row" style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Email:</strong>
              <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{job.hiring_manager_email || 'Not specified'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Notes Sections */}
      <div className="education-form-card">
        <div className="form-header">
          <h3>Notes</h3>
        </div>
        
        {editMode ? (
          <form className="education-form">
            <div className="form-group">
              <label htmlFor="personal_notes">Personal Observations</label>
              <textarea
                id="personal_notes"
                name="personal_notes"
                value={formData.personal_notes}
                onChange={onChange}
                rows={4}
                placeholder="Your personal notes and observations about this opportunity..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="salary_negotiation_notes">Salary Negotiation Notes</label>
              <textarea
                id="salary_negotiation_notes"
                name="salary_negotiation_notes"
                value={formData.salary_negotiation_notes}
                onChange={onChange}
                rows={4}
                placeholder="Notes about salary discussions and negotiations..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="interview_notes">Interview Notes & Feedback</label>
              <textarea
                id="interview_notes"
                name="interview_notes"
                value={formData.interview_notes}
                onChange={onChange}
                rows={4}
                placeholder="Notes from interviews, feedback received, impressions..."
              />
            </div>

            <div className="form-actions" style={{ marginTop: '24px' }}>
              <button 
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="save-button"
                style={{
                  padding: '12px 28px',
                  fontSize: '15px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  width: '100%'
                }}
              >
                {saving ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="education-form" style={{ padding: '32px' }}>
            <div className="detail-row" style={{ marginBottom: '20px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Personal Observations:</strong>
              <div style={{ 
                whiteSpace: 'pre-wrap', 
                marginTop: '8px',
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                fontSize: '15px',
                color: '#4b5563',
                lineHeight: '1.6',
                minHeight: '60px'
              }}>
                {job.personal_notes || 'No notes yet'}
              </div>
            </div>
            
            <div className="detail-row" style={{ marginBottom: '20px' }}>
              <strong style={{ color: '#374151', fontSize: '15px' }}>Salary Negotiation Notes:</strong>
              <div style={{ 
                whiteSpace: 'pre-wrap', 
                marginTop: '8px',
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                fontSize: '15px',
                color: '#4b5563',
                lineHeight: '1.6',
                minHeight: '60px'
              }}>
                {job.salary_negotiation_notes || 'No notes yet'}
              </div>
            </div>
            
            <div className="detail-row">
              <strong style={{ color: '#374151', fontSize: '15px' }}>Interview Notes & Feedback:</strong>
              <div style={{ 
                whiteSpace: 'pre-wrap', 
                marginTop: '8px',
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                fontSize: '15px',
                color: '#4b5563',
                lineHeight: '1.6',
                minHeight: '60px'
              }}>
                {job.interview_notes || 'No notes yet'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Application History */}
      <div className="education-form-card">
        <div className="form-header">
          <h3>Application History</h3>
          {editMode && (
            <button 
              className="add-education-button" 
              onClick={addHistoryEntry} 
              type="button"
              style={{ 
                padding: '8px 20px',
                fontSize: '14px',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            >
              + Add Entry
            </button>
          )}
        </div>
        
        {(!formData.application_history || formData.application_history.length === 0) ? (
          <div className="education-form" style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '15px' }}>No history entries yet</p>
          </div>
        ) : (
          <div className="education-form" style={{ padding: '32px' }}>
            {formData.application_history.map((entry, index) => (
              <div key={index} style={{ 
                padding: '20px', 
                marginBottom: '16px', 
                borderLeft: '4px solid #667eea',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '16px', color: '#111827' }}>{entry.action}</strong>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                      {formatTimestamp(entry.timestamp)}
                    </div>
                    {entry.notes && (
                      <div style={{ 
                        marginTop: '12px', 
                        whiteSpace: 'pre-wrap',
                        fontSize: '15px',
                        color: '#4b5563',
                        lineHeight: '1.5'
                      }}>
                        {entry.notes}
                      </div>
                    )}
                  </div>
                  {editMode && (
                    <button 
                      onClick={() => removeHistoryEntry(index)}
                      className="delete-button"
                      type="button"
                      style={{ 
                        marginLeft: '16px',
                        padding: '8px',
                        background: '#fee',
                        border: '1px solid #fcc',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Icon name="trash" size="sm" ariaLabel="Remove" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {editMode && (
              <div className="form-actions" style={{ marginTop: '24px' }}>
                <button 
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="save-button"
                  style={{
                    padding: '12px 28px',
                    fontSize: '15px',
                    fontWeight: '600',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                    width: '100%'
                  }}
                >
                  {saving ? 'Saving...' : 'Save Application History'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="education-form-card">
        <div className="form-header">
          <h3>Metadata</h3>
        </div>
        <div className="education-form" style={{ padding: '32px' }}>
          <div className="detail-row" style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#374151', fontSize: '15px' }}>Created:</strong>
            <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{formatTimestamp(job.created_at)}</div>
          </div>
          <div className="detail-row">
            <strong style={{ color: '#374151', fontSize: '15px' }}>Last Updated:</strong>
            <div style={{ marginTop: '4px', fontSize: '16px', color: '#111827' }}>{formatTimestamp(job.updated_at)}</div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Tab Content - Interview Insights */}
      {activeTab === 'interview' && (
        <>
          {interviewInsights ? (
            <InterviewInsights insights={interviewInsights} />
          ) : (
            <div className="education-form-card">
              <div className="education-form" style={{ padding: '40px', textAlign: 'center' }}>
                <Icon name="info" size="lg" color="#9ca3af" />
                <p style={{ color: '#9ca3af', marginTop: '16px', fontSize: '15px' }}>
                  No interview insights available for this job yet.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Tab Content - Skills Gap Analysis */}
      {activeTab === 'skills' && (
        <>
          {skillsGapAnalysis ? (
            <SkillGapAnalysis
              analysis={skillsGapAnalysis}
              skillProgress={skillProgress}
              onRefresh={handleRefreshSkillsGap}
              onLogProgress={handleLogSkillProgress}
              onAddSkill={handleAddSkill}
            />
          ) : (
            <div className="education-form-card">
              <div className="education-form" style={{ padding: '40px', textAlign: 'center' }}>
                <Icon name="info" size="lg" color="#9ca3af" />
                <p style={{ color: '#9ca3af', marginTop: '16px', fontSize: '15px' }}>
                  No skills gap analysis available for this job yet.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default JobDetailView;
