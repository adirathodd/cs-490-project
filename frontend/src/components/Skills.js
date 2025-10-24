import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { skillsAPI } from '../services/api';
import './Skills.css';

const Skills = () => {
  const navigate = useNavigate();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    level: 'intermediate',
    years: 0,
  });
  
  // Autocomplete state
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const suggestionRef = useRef(null);
  
  // Edit state
  const [editingSkillId, setEditingSkillId] = useState(null);
  const [editData, setEditData] = useState({});
  
  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Categories
  const [categories, setCategories] = useState([]);
  
  const proficiencyLevels = ['beginner', 'intermediate', 'advanced', 'expert'];

  useEffect(() => {
    fetchSkills();
    fetchCategories();
  }, []);

  useEffect(() => {
    // Close autocomplete when clicking outside
    const handleClickOutside = (e) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const data = await skillsAPI.getSkills();
      setSkills(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await skillsAPI.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Trigger autocomplete for skill name
    if (name === 'name' && value.length >= 2) {
      fetchSuggestions(value, formData.category);
    } else if (name === 'name' && value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const fetchSuggestions = async (query, category) => {
    try {
      const data = await skillsAPI.autocompleteSkills(query, category, 10);
      setSuggestions(data);
      setShowSuggestions(true);
      setSelectedSuggestionIndex(-1);
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setFormData(prev => ({
      ...prev,
      name: suggestion.name,
      category: suggestion.category || prev.category,
      skill_id: suggestion.id,
    }));
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          handleSuggestionClick(suggestions[selectedSuggestionIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
      default:
        break;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError('Skill name is required');
      return;
    }

    try {
      const submitData = {
        name: formData.name.trim(),
        category: formData.category,
        level: formData.level,
        years: parseFloat(formData.years) || 0,
      };

      if (formData.skill_id) {
        submitData.skill_id = formData.skill_id;
      }

      await skillsAPI.addSkill(submitData);
      setSuccess('Skill added successfully!');
      setFormData({ name: '', category: '', level: 'intermediate', years: 0 });
      setShowForm(false);
      fetchSkills();
    } catch (err) {
      if (err.details && err.details.skill) {
        setError('You have already added this skill');
      } else {
        setError(err.message || 'Failed to add skill');
      }
    }
  };

  const handleEdit = (skill) => {
    setEditingSkillId(skill.id);
    setEditData({
      level: skill.level,
      years: skill.years || 0,
    });
  };

  const handleEditChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = async (skillId) => {
    try {
      await skillsAPI.updateSkill(skillId, editData);
      setSuccess('Skill updated successfully!');
      setEditingSkillId(null);
      fetchSkills();
    } catch (err) {
      setError(err.message || 'Failed to update skill');
    }
  };

  const handleCancelEdit = () => {
    setEditingSkillId(null);
    setEditData({});
  };

  const handleDelete = async (skillId) => {
    try {
      await skillsAPI.deleteSkill(skillId);
      setSuccess('Skill removed successfully!');
      setDeleteConfirm(null);
      fetchSkills();
    } catch (err) {
      setError(err.message || 'Failed to delete skill');
    }
  };

  const getProficiencyColor = (level) => {
    const colors = {
      beginner: '#fbbf24',
      intermediate: '#60a5fa',
      advanced: '#34d399',
      expert: '#a78bfa',
    };
    return colors[level.toLowerCase()] || '#6b7280';
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Technical': '#3b82f6',
      'Soft Skills': '#10b981',
      'Languages': '#f59e0b',
      'Industry-Specific': '#8b5cf6',
    };
    return colors[category] || '#6b7280';
  };

  if (loading) {
    return <div className="skills-container"><div className="loading">Loading skills...</div></div>;
  }

  return (
    <div className="skills-container">
      <div className="skills-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
          <h2>My Skills</h2>
        </div>
        <div className="header-actions">
          <button 
            className="btn-secondary"
            onClick={() => navigate('/skills/organized')}
          >
            📊 Organize by Category
          </button>
          <button 
            className="btn-add-skill"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel' : '+ Add Skill'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <form className="skill-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group autocomplete-wrapper" ref={suggestionRef}>
              <label htmlFor="name">Skill Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Python, Communication, Spanish"
                required
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="autocomplete-suggestions">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={suggestion.id}
                      className={`suggestion-item ${index === selectedSuggestionIndex ? 'selected' : ''}`}
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <span className="suggestion-name">{suggestion.name}</span>
                      {suggestion.category && (
                        <span className="suggestion-category">{suggestion.category}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="level">Proficiency Level *</label>
              <select
                id="level"
                name="level"
                value={formData.level}
                onChange={handleInputChange}
                required
              >
                {proficiencyLevels.map(level => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="years">Years of Experience</label>
              <input
                type="number"
                id="years"
                name="years"
                value={formData.years}
                onChange={handleInputChange}
                min="0"
                step="0.5"
                placeholder="0"
              />
            </div>
          </div>

          <button type="submit" className="btn-submit">Add Skill</button>
        </form>
      )}

      <div className="skills-list">
        {skills.length === 0 ? (
          <div className="empty-state">
            <p>No skills added yet. Click "Add Skill" to get started!</p>
          </div>
        ) : (
          <div className="skills-grid">
            {skills.map(skill => (
              <div 
                key={skill.id} 
                className="skill-badge"
                style={{ borderLeftColor: getCategoryColor(skill.skill_category) }}
              >
                {deleteConfirm === skill.id ? (
                  <div className="delete-confirm">
                    <p>Remove "{skill.skill_name}"?</p>
                    <div className="confirm-actions">
                      <button 
                        className="btn-confirm-yes"
                        onClick={() => handleDelete(skill.id)}
                      >
                        Yes
                      </button>
                      <button 
                        className="btn-confirm-no"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : editingSkillId === skill.id ? (
                  <div className="edit-mode">
                    <div className="skill-name">{skill.skill_name}</div>
                    {skill.skill_category && (
                      <div className="skill-category">{skill.skill_category}</div>
                    )}
                    <div className="edit-controls">
                      <select
                        value={editData.level}
                        onChange={(e) => handleEditChange('level', e.target.value)}
                        className="edit-select"
                      >
                        {proficiencyLevels.map(level => (
                          <option key={level} value={level}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={editData.years}
                        onChange={(e) => handleEditChange('years', e.target.value)}
                        min="0"
                        step="0.5"
                        className="edit-input"
                        placeholder="Years"
                      />
                    </div>
                    <div className="edit-actions">
                      <button 
                        className="btn-save"
                        onClick={() => handleSaveEdit(skill.id)}
                      >
                        Save
                      </button>
                      <button 
                        className="btn-cancel"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="skill-content">
                      <div className="skill-name">{skill.skill_name}</div>
                      {skill.skill_category && (
                        <div className="skill-category">{skill.skill_category}</div>
                      )}
                      <div className="skill-details">
                        <span 
                          className="proficiency-badge"
                          style={{ backgroundColor: getProficiencyColor(skill.level) }}
                        >
                          {skill.level.charAt(0).toUpperCase() + skill.level.slice(1)}
                        </span>
                        {skill.years > 0 && (
                          <span className="years-badge">
                            {skill.years} {skill.years === 1 ? 'year' : 'years'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="skill-actions">
                      <button 
                        className="btn-edit"
                        onClick={() => handleEdit(skill)}
                        title="Edit proficiency"
                      >
                        ✏️
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => setDeleteConfirm(skill.id)}
                        title="Remove skill"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Skills;
