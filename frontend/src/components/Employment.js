import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authAPI from '../services/api';
import './Employment.css';
import Icon from './Icon';

const Employment = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [employmentHistory, setEmploymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);
  
  const [formData, setFormData] = useState({
    company_name: '',
    job_title: '',
    location: '',
    start_date: '',
    end_date: '',
    is_current: false,
    description: '',
    achievements: [],
    skills_used_names: []
  });

  const [achievementInput, setAchievementInput] = useState('');
  const [skillInput, setSkillInput] = useState('');

  useEffect(() => {
    if (currentUser) {
      fetchEmploymentHistory();
    }
  }, [currentUser]);

  const fetchEmploymentHistory = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getEmploymentHistory();
      setEmploymentHistory(response.employment_history || []);
      setError('');
    } catch (err) {
      console.error('Error fetching employment history:', err);
      if (err.response?.status !== 404) {
        setError('Failed to load employment history. Please try again.');
      }
      setEmploymentHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      job_title: '',
      location: '',
      start_date: '',
      end_date: '',
      is_current: false,
      description: '',
      achievements: [],
      skills_used_names: []
    });
    setAchievementInput('');
    setSkillInput('');
    setEditingId(null);
    setShowForm(false);
    setOriginalFormData(null);
    setShowDiscardDialog(false);
  };

  const hasUnsavedChanges = () => {
    if (!originalFormData) return false;
    
    // Deep comparison of form data
    return JSON.stringify(formData) !== JSON.stringify(originalFormData);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      setShowDiscardDialog(true);
    } else {
      resetForm();
    }
  };

  const confirmDiscard = () => {
    setShowDiscardDialog(false);
    resetForm();
  };

  const cancelDiscard = () => {
    setShowDiscardDialog(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      // Clear end_date if is_current is checked
      ...(name === 'is_current' && checked ? { end_date: '' } : {})
    }));
  };

  const handleAddAchievement = () => {
    if (achievementInput.trim()) {
      setFormData(prev => ({
        ...prev,
        achievements: [...prev.achievements, achievementInput.trim()]
      }));
      setAchievementInput('');
    }
  };

  const handleRemoveAchievement = (index) => {
    setFormData(prev => ({
      ...prev,
      achievements: prev.achievements.filter((_, i) => i !== index)
    }));
  };

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.skills_used_names.includes(skillInput.trim())) {
      setFormData(prev => ({
        ...prev,
        skills_used_names: [...prev.skills_used_names, skillInput.trim()]
      }));
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill) => {
    setFormData(prev => ({
      ...prev,
      skills_used_names: prev.skills_used_names.filter(s => s !== skill)
    }));
  };

  const handleEdit = (employment) => {
    const employmentData = {
      company_name: employment.company_name,
      job_title: employment.job_title,
      location: employment.location || '',
      start_date: employment.start_date,
      end_date: employment.end_date || '',
      is_current: employment.is_current,
      description: employment.description || '',
      achievements: employment.achievements || [],
      skills_used_names: employment.skills_used?.map(s => s.name) || []
    };
    
    setFormData(employmentData);
    setOriginalFormData(JSON.parse(JSON.stringify(employmentData))); // Deep copy
    setEditingId(employment.id);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // Validate required fields
      if (!formData.company_name || !formData.job_title || !formData.start_date) {
        setError('Please fill in all required fields (Company, Job Title, and Start Date).');
        return;
      }

      // Validate end date if not current position
      if (!formData.is_current && !formData.end_date) {
        setError('Please provide an end date or mark this as your current position.');
        return;
      }

      // Validate date logic
      if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
        setError('Start date must be before end date.');
        return;
      }

      if (editingId) {
        // Update existing entry
        await authAPI.updateEmployment(editingId, formData);
        setSuccess('Employment entry updated successfully!');
      } else {
        // Create new entry
        await authAPI.createEmployment(formData);
        setSuccess('Employment entry added successfully!');
      }

      await fetchEmploymentHistory();
      resetForm();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving employment:', err);
      const errorMessage = err.response?.data?.error?.message || 
                          err.response?.data?.error?.details?.non_field_errors?.[0] ||
                          'Failed to save employment entry. Please check your input.';
      setError(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    try {
      await authAPI.deleteEmployment(id);
      setSuccess('Employment entry deleted successfully!');
      await fetchEmploymentHistory();
      setDeleteConfirm(null);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting employment:', err);
      setError('Failed to delete employment entry. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="employment-container">
        <div className="loading">Loading employment history...</div>
      </div>
    );
  }

  const characterCount = formData.description.length;
  const characterLimit = 1000;

  return (
    <div className="employment-container">
      <div className="employment-page-header">
        <button 
          className="back-button"
          onClick={() => navigate('/dashboard')}
        >
          ← Back to Dashboard
        </button>
        <h1 className="employment-page-title">Employment History</h1>
      </div>

      <div className="employment-header">
        <h2><Icon name="briefcase" size="md" /> Your Work Experience</h2>
        <button 
          className="add-button"
          onClick={() => {
            resetForm();
            const emptyFormData = {
              company_name: '',
              job_title: '',
              location: '',
              start_date: '',
              end_date: '',
              is_current: false,
              description: '',
              achievements: [],
              skills_used_names: []
            };
            setFormData(emptyFormData);
            setOriginalFormData(JSON.parse(JSON.stringify(emptyFormData))); // Deep copy
            setShowForm(true);
          }}
        >
          + Add Employment
        </button>
      </div>

      {error && (
        <div className="message error-message">
          {error}
        </div>
      )}

      {success && (
        <div className="message success-message">
          {success}
        </div>
      )}

      {showForm && (
        <div className="employment-form-card">
          <div className="form-header">
            <h3>{editingId ? 'Edit Employment' : 'Add Employment'}</h3>
            <button className="close-button" onClick={handleCancel}><Icon name="trash" size="sm" ariaLabel="Close" /></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Job Title <span className="required">*</span></label>
                <input
                  type="text"
                  name="job_title"
                  value={formData.job_title}
                  onChange={handleInputChange}
                  placeholder="e.g., Senior Software Engineer"
                  required
                />
              </div>

              <div className="form-group">
                <label>Company Name <span className="required">*</span></label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  placeholder="e.g., Tech Corporation"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g., San Francisco, CA or Remote"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Start Date <span className="required">*</span></label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>End Date {!formData.is_current && <span className="required">*</span>}</label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleInputChange}
                  disabled={formData.is_current}
                  required={!formData.is_current}
                />
              </div>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="is_current"
                  checked={formData.is_current}
                  onChange={handleInputChange}
                />
                <span>I currently work here</span>
              </label>
            </div>

            <div className="form-group">
              <label>
                Job Description 
                <span className="character-count">{characterCount}/{characterLimit}</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your role, responsibilities, and key contributions..."
                rows="6"
                maxLength={characterLimit}
              />
            </div>

            <div className="form-group">
              <label>Achievements</label>
              <div className="input-with-button">
                <input
                  type="text"
                  value={achievementInput}
                  onChange={(e) => setAchievementInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAchievement();
                    }
                  }}
                  placeholder="e.g., Increased revenue by 40%"
                />
                <button type="button" onClick={handleAddAchievement} className="add-btn">
                  Add
                </button>
              </div>
              {formData.achievements.length > 0 && (
                <ul className="items-list">
                  {formData.achievements.map((achievement, index) => (
                    <li key={index}>
                      {achievement}
                      <button 
                        type="button"
                        onClick={() => handleRemoveAchievement(index)}
                        className="remove-btn"
                      >
                        <Icon name="trash" size="sm" ariaLabel="Remove achievement" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="form-group">
              <label>Skills Used</label>
              <div className="input-with-button">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  placeholder="e.g., Python, AWS, Docker"
                />
                <button type="button" onClick={handleAddSkill} className="add-btn">
                  Add
                </button>
              </div>
              {formData.skills_used_names.length > 0 && (
                <div className="skills-tags">
                  {formData.skills_used_names.map((skill, index) => (
                    <span key={index} className="skill-tag">
                      {skill}
                      <button 
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="remove-skill"
                      >
                        <Icon name="trash" size="sm" ariaLabel="Remove skill" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="button" onClick={handleCancel} className="cancel-button">
                Cancel
              </button>
              <button type="submit" className="save-button">
                {editingId ? 'Update' : 'Save'} Employment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Discard Changes Confirmation Dialog */}
      {showDiscardDialog && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <h3>Discard Changes?</h3>
            <p>You have unsaved changes. Are you sure you want to leave? All changes will be lost.</p>
            <div className="modal-actions">
              <button 
                className="modal-cancel-button" 
                onClick={cancelDiscard}
              >
                Keep Editing
              </button>
              <button 
                className="modal-confirm-button" 
                onClick={confirmDiscard}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {employmentHistory.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-icon"><Icon name="briefcase" size="xl" ariaLabel="No employment" /></div>
          <h3>No Employment History Yet</h3>
          <p>Add your work experience to build your professional profile.</p>
          <button className="add-button" onClick={() => {
            const emptyFormData = {
              company_name: '',
              job_title: '',
              location: '',
              start_date: '',
              end_date: '',
              is_current: false,
              description: '',
              achievements: [],
              skills_used_names: []
            };
            setFormData(emptyFormData);
            setOriginalFormData(JSON.parse(JSON.stringify(emptyFormData)));
            setShowForm(true);
          }}>
            + Add Your First Job
          </button>
        </div>
      ) : (
        <div className="employment-timeline">
          {employmentHistory.map((employment) => (
            <div key={employment.id} className="employment-card">
              <div className="employment-header-row">
                <div className="employment-main">
                  <h3 className="job-title">{employment.job_title}</h3>
                  <div className="company-name">{employment.company_name}</div>
                  <div className="employment-meta">
                    <span className="dates">{employment.formatted_dates}</span>
                    <span className="duration">• {employment.duration}</span>
                    {employment.location && (
                      <span className="location">• <Icon name="location" size="sm" /> {employment.location}</span>
                    )}
                    {employment.is_current && (
                      <span className="current-badge">Current</span>
                    )}
                  </div>
                </div>
                <div className="employment-actions">
                  <button 
                    className="action-button edit"
                    onClick={() => handleEdit(employment)}
                    title="Edit"
                  >
                    <Icon name="edit" size="sm" ariaLabel="Edit" />
                  </button>
                  <button 
                    className="action-button delete"
                    onClick={() => setDeleteConfirm(employment.id)}
                    title="Delete"
                  >
                    <Icon name="trash" size="sm" ariaLabel="Delete" />
                  </button>
                </div>
              </div>

              {employment.description && (
                <p className="employment-description">{employment.description}</p>
              )}

              {employment.achievements && employment.achievements.length > 0 && (
                <div className="achievements-section">
                  <strong>Key Achievements:</strong>
                  <ul className="achievements-list">
                    {employment.achievements.map((achievement, index) => (
                      <li key={index}>{achievement}</li>
                    ))}
                  </ul>
                </div>
              )}

              {employment.skills_used && employment.skills_used.length > 0 && (
                <div className="skills-section">
                  <strong>Skills:</strong>
                  <div className="skills-display">
                    {employment.skills_used.map((skill) => (
                      <span key={skill.id} className="skill-badge">{skill.name}</span>
                    ))}
                  </div>
                </div>
              )}

              {deleteConfirm === employment.id && (
                <div className="delete-confirm">
                  <p>Are you sure you want to delete this employment entry?</p>
                  <div className="confirm-actions">
                    <button 
                      className="confirm-yes"
                      onClick={() => handleDelete(employment.id)}
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
          ))}
        </div>
      )}
    </div>
  );
};

export default Employment;
