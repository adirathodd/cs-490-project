import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './ContactDiscovery.css';

const DiscoverySearchForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    target_companies: [],
    target_roles: [],
    target_industries: [],
    target_locations: [],
    include_alumni: true,
    include_mutual_connections: true,
    include_industry_leaders: false,
  });

  const [companyInput, setCompanyInput] = useState('');
  const [roleInput, setRoleInput] = useState('');
  const [industryInput, setIndustryInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddItem = (field, value, setInput) => {
    if (value.trim()) {
      setFormData({
        ...formData,
        [field]: [...formData[field], value.trim()],
      });
      setInput('');
    }
  };

  const handleRemoveItem = (field, index) => {
    setFormData({
      ...formData,
      [field]: formData[field].filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate that at least one search criterion is provided
    const hasCompanies = formData.target_companies.length > 0;
    const hasRoles = formData.target_roles.length > 0;
    const hasIndustries = formData.target_industries.length > 0;
    const hasLocations = formData.target_locations.length > 0;
    
    if (!hasCompanies && !hasRoles && !hasIndustries && !hasLocations) {
      alert('Please add at least one search criterion (company, role, industry, or location)');
      return;
    }
    
    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  const renderTagList = (field, items, label) => (
    <div className="form-group">
      <label>{label}</label>
      <div className="tag-input-container">
        <div className="tags-list">
          {items.map((item, index) => (
            <span key={index} className="tag">
              {item}
              <button
                type="button"
                onClick={() => handleRemoveItem(field, index)}
                className="tag-remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="discovery-search-form">
      <h2>Discover New Contacts</h2>
      <p className="form-description">
        Define your search criteria to find relevant professionals in your target companies and industries.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Target Companies */}
        <div className="form-group">
          <label htmlFor="company-input">Target Companies</label>
          <div className="input-with-button">
            <input
              id="company-input"
              type="text"
              value={companyInput}
              onChange={(e) => setCompanyInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddItem('target_companies', companyInput, setCompanyInput);
                }
              }}
              placeholder="Add company names (e.g., Google, Microsoft)"
            />
            <button
              type="button"
              onClick={() => handleAddItem('target_companies', companyInput, setCompanyInput)}
              className="btn-secondary"
            >
              Add
            </button>
          </div>
          {renderTagList('target_companies', formData.target_companies, '')}
        </div>

        {/* Target Roles */}
        <div className="form-group">
          <label htmlFor="role-input">Target Roles</label>
          <div className="input-with-button">
            <input
              id="role-input"
              type="text"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddItem('target_roles', roleInput, setRoleInput);
                }
              }}
              placeholder="Add job titles (e.g., Software Engineer, Product Manager)"
            />
            <button
              type="button"
              onClick={() => handleAddItem('target_roles', roleInput, setRoleInput)}
              className="btn-secondary"
            >
              Add
            </button>
          </div>
          {renderTagList('target_roles', formData.target_roles, '')}
        </div>

        {/* Target Industries */}
        <div className="form-group">
          <label htmlFor="industry-input">Target Industries</label>
          <div className="input-with-button">
            <input
              id="industry-input"
              type="text"
              value={industryInput}
              onChange={(e) => setIndustryInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddItem('target_industries', industryInput, setIndustryInput);
                }
              }}
              placeholder="Add industries (e.g., Technology, Finance)"
            />
            <button
              type="button"
              onClick={() => handleAddItem('target_industries', industryInput, setIndustryInput)}
              className="btn-secondary"
            >
              Add
            </button>
          </div>
          {renderTagList('target_industries', formData.target_industries, '')}
        </div>

        {/* Target Locations */}
        <div className="form-group">
          <label htmlFor="location-input">Target Locations</label>
          <div className="input-with-button">
            <input
              id="location-input"
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddItem('target_locations', locationInput, setLocationInput);
                }
              }}
              placeholder="Add locations (e.g., San Francisco, Remote)"
            />
            <button
              type="button"
              onClick={() => handleAddItem('target_locations', locationInput, setLocationInput)}
              className="btn-secondary"
            >
              Add
            </button>
          </div>
          {renderTagList('target_locations', formData.target_locations, '')}
        </div>

        {/* Options */}
        <div className="form-group">
          <label>Discovery Options</label>
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.include_alumni}
                onChange={(e) =>
                  setFormData({ ...formData, include_alumni: e.target.checked })
                }
              />
              <span>Include Alumni from my institutions</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.include_mutual_connections}
                onChange={(e) =>
                  setFormData({ ...formData, include_mutual_connections: e.target.checked })
                }
              />
              <span>Include contacts with mutual connections</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.include_industry_leaders}
                onChange={(e) =>
                  setFormData({ ...formData, include_industry_leaders: e.target.checked })
                }
              />
              <span>Include industry leaders and influencers</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Suggestions'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default DiscoverySearchForm;
