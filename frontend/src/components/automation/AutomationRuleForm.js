import React, { useState, useEffect } from 'react';
import Icon from '../common/Icon';
import './AutomationRuleForm.css';

const AutomationRuleForm = ({ rule, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'job_match_found', // Updated to simplified triggers
    action_type: 'generate_application_package', // Updated to simplified actions
    trigger_conditions: {},
    action_parameters: {},
    priority: 5,
    is_active: true
  });
  
  const [errors, setErrors] = useState({});
  const [selectedJobTypes, setSelectedJobTypes] = useState([]);
  const [selectedIndustries, setSelectedIndustries] = useState([]);

  const triggerTypes = [
    { value: 'job_match_found', label: 'High Match Job Added', description: 'When a job with good match score is added' },
    { value: 'application_deadline', label: 'Application Deadline Approaching', description: 'When deadline is approaching (configurable days)' }
  ];

  const actionTypes = [
    { value: 'generate_application_package', label: 'Generate Resume & Cover Letter', description: 'Auto-generate tailored resume and cover letter using AI' },
    { value: 'create_deadline_reminder', label: 'Create Deadline Reminder', description: 'Schedule calendar reminder for application deadline' }
  ];

  const jobTypes = [
    'Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Remote'
  ];

  const industries = [
    'Technology', 'Finance', 'Healthcare', 'Education', 'Marketing', 'Sales',
    'Engineering', 'Design', 'Consulting', 'Manufacturing', 'Retail', 'Other'
  ];

  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name || '',
        description: rule.description || '',
        trigger_type: rule.trigger_type || 'new_job',
        action_type: rule.action_type || 'generate_package',
        trigger_conditions: rule.trigger_conditions || {},
        action_parameters: rule.action_parameters || {},
        priority: rule.priority || 5,
        is_active: rule.is_active !== undefined ? rule.is_active : true
      });
      
      setSelectedJobTypes(rule.trigger_conditions?.job_types || []);
      setSelectedIndustries(rule.trigger_conditions?.industries || []);
    }
  }, [rule]);

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const handleConditionChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      trigger_conditions: {
        ...prev.trigger_conditions,
        [field]: value
      }
    }));
  };

  const handleParameterChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      action_parameters: {
        ...prev.action_parameters,
        [field]: value
      }
    }));
  };

  const handleJobTypeChange = (jobType, checked) => {
    let newJobTypes;
    if (checked) {
      newJobTypes = [...selectedJobTypes, jobType];
    } else {
      newJobTypes = selectedJobTypes.filter(type => type !== jobType);
    }
    
    setSelectedJobTypes(newJobTypes);
    handleConditionChange('job_types', newJobTypes);
  };

  const handleIndustryChange = (industry, checked) => {
    let newIndustries;
    if (checked) {
      newIndustries = [...selectedIndustries, industry];
    } else {
      newIndustries = selectedIndustries.filter(ind => ind !== industry);
    }
    
    setSelectedIndustries(newIndustries);
    handleConditionChange('industries', newIndustries);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Rule name is required';
    }

    if (!formData.trigger_type) {
      newErrors.trigger_type = 'Trigger type is required';
    }

    if (!formData.action_type) {
      newErrors.action_type = 'Action type is required';
    }

    // Validate trigger-specific conditions
    if (formData.trigger_type === 'match_score') {
      if (!formData.trigger_conditions.min_match_score || 
          formData.trigger_conditions.min_match_score < 0 || 
          formData.trigger_conditions.min_match_score > 100) {
        newErrors.min_match_score = 'Match score threshold must be between 0 and 100';
      }
    }

    if (formData.trigger_type === 'deadline_approaching') {
      if (!formData.trigger_conditions.days_before || 
          formData.trigger_conditions.days_before < 1 || 
          formData.trigger_conditions.days_before > 30) {
        newErrors.days_before = 'Days before deadline must be between 1 and 30';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
  };

  const renderTriggerConditions = () => {
    switch (formData.trigger_type) {
      case 'job_match_found':
        return (
          <div className="form-group">
            <label>Match Score Threshold</label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.trigger_conditions.min_match_score || 80}
              onChange={(e) => handleConditionChange('min_match_score', parseInt(e.target.value))}
            />
            <span className="range-label">{formData.trigger_conditions.min_match_score || 80}%</span>
            {errors.min_match_score && (
              <span className="error-text">{errors.min_match_score}</span>
            )}
          </div>
        );
      
      case 'application_deadline':
        return (
          <div className="form-group">
            <label>Days Before Deadline</label>
            <input
              type="number"
              min="1"
              max="30"
              value={formData.trigger_conditions.days_before || 3}
              onChange={(e) => handleConditionChange('days_before', parseInt(e.target.value))}
              className={errors.days_before ? 'error' : ''}
            />
            {errors.days_before && (
              <span className="error-text">{errors.days_before}</span>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  const renderActionParameters = () => {
    switch (formData.action_type) {
      case 'generate_application_package':
        return (
          <div>
            <div className="form-group">
              <label>Resume Template</label>
              <select
                value={formData.action_parameters.resume_template || 'standard'}
                onChange={(e) => handleParameterChange('resume_template', e.target.value)}
              >
                <option value="standard">Standard Professional</option>
                <option value="tech">Tech Industry</option>
                <option value="creative">Creative</option>
                <option value="academic">Academic</option>
              </select>
              <small className="help-text">Template for AI resume generation</small>
            </div>
            <div className="form-group">
              <label>Cover Letter Template</label>
              <select
                value={formData.action_parameters.cover_letter_template || 'professional'}
                onChange={(e) => handleParameterChange('cover_letter_template', e.target.value)}
              >
                <option value="professional">Professional</option>
                <option value="tech">Tech Industry</option>
                <option value="startup">Startup</option>
                <option value="formal">Formal</option>
              </select>
              <small className="help-text">Template for AI cover letter generation</small>
            </div>
            <div className="form-group">
              <label>Auto-Include Portfolio Link</label>
              <input
                type="checkbox"
                checked={formData.action_parameters.include_portfolio || false}
                onChange={(e) => handleParameterChange('include_portfolio', e.target.checked)}
              />
              <small className="help-text">Include portfolio link in generated documents</small>
            </div>
          </div>
        );
      
      case 'create_deadline_reminder':
        return (
          <div>
            <div className="form-group">
              <label>Reminder Days Before Deadline</label>
              <input
                type="number"
                min="1"
                max="30"
                value={formData.action_parameters.reminder_days || 3}
                onChange={(e) => handleParameterChange('reminder_days', parseInt(e.target.value))}
              />
              <small className="help-text">Days before deadline to send reminder</small>
            </div>
            <div className="form-group">
              <label>Reminder Message</label>
              <textarea
                rows="3"
                value={formData.action_parameters.reminder_message || 'Remember to apply for [Job Title] at [Company Name] - Deadline: [Deadline]'}
                onChange={(e) => handleParameterChange('reminder_message', e.target.value)}
                placeholder="Customize your reminder message..."
              />
              <small className="help-text">Available placeholders: [Job Title], [Company Name], [Deadline]</small>
            </div>
            <div className="form-group">
              <label>Reminder Type</label>
              <select
                value={formData.action_parameters.reminder_type || 'notification'}
                onChange={(e) => handleParameterChange('reminder_type', e.target.value)}
              >
                <option value="notification">Browser Notification</option>
                <option value="email">Email Reminder</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>
        );
      
      default:
        return <div>No additional parameters required</div>;
    }
  };

  return (
    <div className="automation-rule-form">
      <form onSubmit={handleSubmit}>
        <div className="form-sections-container">
          {/* Basic Information */}
          <div className="form-section">
            <h3>Basic Information</h3>
          
          <div className="form-group">
            <label>Rule Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              required
              className={errors.name ? 'error' : ''}
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              rows="2"
              placeholder="Describe what this automation rule does..."
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Trigger Type *</label>
              <select
                value={formData.trigger_type}
                onChange={(e) => handleFormChange('trigger_type', e.target.value)}
                required
                className={errors.trigger_type ? 'error' : ''}
              >
                {triggerTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Action Type *</label>
              <select
                value={formData.action_type}
                onChange={(e) => handleFormChange('action_type', e.target.value)}
                required
                className={errors.action_type ? 'error' : ''}
              >
                {actionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Trigger Conditions */}
        <div className="form-section">
          <h3>Trigger Conditions</h3>
          
          {renderTriggerConditions()}
          
          <div className="form-group">
            <label>Job Type Filter (Optional)</label>
            <div className="checkbox-grid">
              {jobTypes.map((jobType) => (
                <label key={jobType} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedJobTypes.includes(jobType)}
                    onChange={(e) => handleJobTypeChange(jobType, e.target.checked)}
                  />
                  {jobType}
                </label>
              ))}
            </div>
          </div>
          
          <div className="form-group">
            <label>Industry Filter (Optional)</label>
            <div className="checkbox-grid">
              {industries.map((industry) => (
                <label key={industry} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedIndustries.includes(industry)}
                    onChange={(e) => handleIndustryChange(industry, e.target.checked)}
                  />
                  {industry}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Action Parameters */}
        <div className="form-section">
          <h3>Action Parameters</h3>
          {renderActionParameters()}
        </div>

        {/* Rule Settings */}
        <div className="form-section">
          <h3>Rule Settings</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>Priority (1 = Highest)</label>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.priority}
                onChange={(e) => handleFormChange('priority', parseInt(e.target.value))}
              />
              <span className="range-label">{formData.priority}</span>
            </div>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => handleFormChange('is_active', e.target.checked)}
                />
                Active Rule
              </label>
            </div>
          </div>
        </div>
        </div> {/* Close form-sections-container */}

        {/* Form Actions */}
        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            <Icon name="check" size="sm" />
            {rule ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AutomationRuleForm;