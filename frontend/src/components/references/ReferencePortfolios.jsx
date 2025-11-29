import React, { useState, useEffect } from 'react';
import { referencesAPI } from '../../services/referencesAPI';
import Icon from '../common/Icon';

const ReferencePortfolios = ({ onClose, references }) => {
  const [portfolios, setPortfolios] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    references: [],
    target_role_types: [],
    target_industries: [],
    target_companies: [],
    is_default: false,
  });

  useEffect(() => {
    loadPortfolios();
  }, []);

  const loadPortfolios = async () => {
    try {
      setLoading(true);
      const data = await referencesAPI.getPortfolios();
      setPortfolios(data);
    } catch (err) {
      console.error('Failed to load portfolios:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (portfolio) => {
    setSelectedPortfolio(portfolio);
    setFormData({
      name: portfolio.name,
      description: portfolio.description,
      references: portfolio.references || [],
      target_role_types: portfolio.target_role_types || [],
      target_industries: portfolio.target_industries || [],
      target_companies: portfolio.target_companies || [],
      is_default: portfolio.is_default,
    });
    setShowForm(true);
  };

  const handleDelete = async (portfolioId) => {
    if (!window.confirm('Delete this portfolio?')) return;
    try {
      await referencesAPI.deletePortfolio(portfolioId);
      loadPortfolios();
    } catch (err) {
      console.error('Failed to delete portfolio:', err);
      alert('Failed to delete portfolio');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedPortfolio) {
        await referencesAPI.updatePortfolio(selectedPortfolio.id, formData);
      } else {
        await referencesAPI.createPortfolio(formData);
      }
      setShowForm(false);
      setSelectedPortfolio(null);
      loadPortfolios();
    } catch (err) {
      console.error('Failed to save portfolio:', err);
      alert('Failed to save portfolio');
    }
  };

  const handleCreate = () => {
    setSelectedPortfolio(null);
    setFormData({
      name: '',
      description: '',
      references: [],
      target_role_types: [],
      target_industries: [],
      target_companies: [],
      is_default: false,
    });
    setShowForm(true);
  };

  const handleArrayChange = (field, value) => {
    const items = value.split(',').map(s => s.trim()).filter(s => s);
    setFormData(prev => ({ ...prev, [field]: items }));
  };

  const toggleReference = (refId) => {
    setFormData(prev => ({
      ...prev,
      references: prev.references.includes(refId)
        ? prev.references.filter(id => id !== refId)
        : [...prev.references, refId]
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2><Icon name="layers" size="md" /> Reference Portfolios</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          {!showForm ? (
            <>
              <div style={{ marginBottom: '20px' }}>
                <button className="add-button" onClick={handleCreate}>
                  + New Portfolio
                </button>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading portfolios...</div>
              ) : portfolios.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  <Icon name="layers" size="xl" />
                  <p style={{ marginTop: '16px' }}>No portfolios yet. Create portfolios to group references for specific career goals!</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {portfolios.map(portfolio => (
                    <div key={portfolio.id} className="card" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <h3 style={{ margin: 0 }}>{portfolio.name}</h3>
                            {portfolio.is_default && (
                              <span style={{ 
                                padding: '2px 8px', 
                                background: '#dbeafe', 
                                color: '#1e40af', 
                                borderRadius: '4px', 
                                fontSize: '12px' 
                              }}>
                                Default
                              </span>
                            )}
                          </div>
                          {portfolio.description && (
                            <p style={{ color: '#666', fontSize: '14px', margin: '0 0 8px 0' }}>
                              {portfolio.description}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn-secondary"
                            onClick={() => handleEdit(portfolio)}
                            style={{ padding: '6px 12px', fontSize: '14px' }}
                          >
                            <Icon name="edit" size="sm" />
                          </button>
                          <button 
                            className="btn-danger"
                            onClick={() => handleDelete(portfolio.id)}
                            style={{ padding: '6px 12px', fontSize: '14px' }}
                          >
                            <Icon name="trash" size="sm" />
                          </button>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: '#666' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Icon name="users" size="sm" />
                          <span>{portfolio.reference_count || 0} references</span>
                        </div>
                        {portfolio.target_role_types?.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Icon name="briefcase" size="sm" />
                            <span>{portfolio.target_role_types.join(', ')}</span>
                          </div>
                        )}
                        {portfolio.target_industries?.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Icon name="folder" size="sm" />
                            <span>{portfolio.target_industries.join(', ')}</span>
                          </div>
                        )}
                      </div>
                      
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
                        Used {portfolio.times_used} times
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Portfolio Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Software Engineering Roles"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  placeholder="Describe the career goals for this portfolio"
                />
              </div>

              <div className="form-group">
                <label>Target Role Types (comma-separated)</label>
                <input
                  type="text"
                  value={(formData.target_role_types || []).join(', ')}
                  onChange={(e) => handleArrayChange('target_role_types', e.target.value)}
                  placeholder="Software Engineer, Senior Developer, Tech Lead"
                />
              </div>

              <div className="form-group">
                <label>Target Industries (comma-separated)</label>
                <input
                  type="text"
                  value={(formData.target_industries || []).join(', ')}
                  onChange={(e) => handleArrayChange('target_industries', e.target.value)}
                  placeholder="Technology, Finance, Healthcare"
                />
              </div>

              <div className="form-group">
                <label>Target Companies (comma-separated)</label>
                <input
                  type="text"
                  value={(formData.target_companies || []).join(', ')}
                  onChange={(e) => handleArrayChange('target_companies', e.target.value)}
                  placeholder="Google, Microsoft, Amazon"
                />
              </div>

              <div className="form-group">
                <label>Select References</label>
                <div className="reference-selection-box">
                  {references.length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '14px', margin: 0, textAlign: 'center', padding: '20px 0' }}>
                      No references available. Create references first.
                    </p>
                  ) : (
                    references.map(ref => (
                      <div 
                        key={ref.id} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          transition: 'all 0.2s',
                          marginBottom: '4px',
                          border: '1px solid transparent',
                          backgroundColor: formData.references.includes(ref.id) ? '#f0f9ff' : 'transparent'
                        }}
                        onClick={() => toggleReference(ref.id)}
                        onMouseEnter={(e) => {
                          if (!formData.references.includes(ref.id)) {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!formData.references.includes(ref.id)) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = 'transparent';
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.references.includes(ref.id)}
                          onChange={() => toggleReference(ref.id)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ 
                            width: '18px', 
                            height: '18px', 
                            cursor: 'pointer',
                            margin: 0,
                            flexShrink: 0
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: 500, 
                            color: '#111827', 
                            margin: '0 0 2px 0',
                            lineHeight: '1.4'
                          }}>
                            {ref.name}
                          </div>
                          <div style={{ 
                            fontSize: '13px', 
                            color: '#6b7280', 
                            margin: 0,
                            lineHeight: '1.4'
                          }}>
                            {ref.title} at {ref.company}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label" style={{ marginTop: '8px' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  />
                  <span>Set as Default Portfolio</span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {selectedPortfolio ? 'Update Portfolio' : 'Create Portfolio'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferencePortfolios;
