import React, { useState, useEffect } from 'react';
import { referencesAPI } from '../../services/referencesAPI';
import ReferencesList from './ReferencesList';
import ReferenceForm from './ReferenceForm';
import ReferenceRequestForm from './ReferenceRequestForm';
import ReferenceAnalytics from './ReferenceAnalytics';
import ReferenceTemplates from './ReferenceTemplates';
import ReferencePortfolios from './ReferencePortfolios';
import ReferenceAppreciations from './ReferenceAppreciations';
import Icon from '../common/Icon';
import './References.css';

const ReferencesPage = () => {
  const [references, setReferences] = useState([]);
  const [selectedReference, setSelectedReference] = useState(null);
  const [showReferenceForm, setShowReferenceForm] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPortfolios, setShowPortfolios] = useState(false);
  const [showAppreciations, setShowAppreciations] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // active, inactive, all

  useEffect(() => {
    loadReferences();
  }, [activeTab]);

  const loadReferences = async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeTab === 'active') params.is_active = true;
      if (activeTab === 'inactive') params.is_active = false;
      
      const data = await referencesAPI.getReferences(params);
      setReferences(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load references:', err);
      
      // Check if it's an authentication error
      if (err?.response?.status === 401 || err?.response?.data?.error?.code === 'authentication_failed') {
        setError('Please log in to view your references. You will be redirected to the login page.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (err?.response?.status === 403) {
        setError('You do not have permission to view references.');
      } else {
        setError('Failed to load references. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReference = () => {
    setSelectedReference(null);
    setShowReferenceForm(true);
  };

  const handleEditReference = (reference) => {
    setSelectedReference(reference);
    setShowReferenceForm(true);
  };

  const handleDeleteReference = async (referenceId) => {
    if (!window.confirm('Are you sure you want to delete this reference?')) return;
    
    try {
      await referencesAPI.deleteReference(referenceId);
      loadReferences();
    } catch (err) {
      console.error('Failed to delete reference:', err);
      alert('Failed to delete reference');
    }
  };

  const handleRequestReference = (reference) => {
    setSelectedReference(reference);
    setShowRequestForm(true);
  };

  const handleShowAppreciations = (reference) => {
    setSelectedReference(reference);
    setShowAppreciations(true);
  };

  const handleSaveReference = async (referenceData) => {
    try {
      if (selectedReference) {
        await referencesAPI.updateReference(selectedReference.id, referenceData);
      } else {
        await referencesAPI.createReference(referenceData);
      }
      setShowReferenceForm(false);
      loadReferences();
    } catch (err) {
      console.error('Failed to save reference:', err);
      throw err;
    }
  };

  const handleSaveRequest = async (requestData) => {
    try {
      await referencesAPI.createReferenceRequest(requestData);
      setShowRequestForm(false);
      loadReferences();
    } catch (err) {
      console.error('Failed to create request:', err);
      throw err;
    }
  };

  return (
    <div className="employment-container">
      <div className="employment-page-header">
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
        <h1 className="employment-page-title">Professional References</h1>
      </div>

      <div className="employment-header">
        <h2><Icon name="users" size="md" /> Your References</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="add-button"
            onClick={() => setShowTemplates(true)}
            style={{ background: '#8b5cf6' }}
          >
            <Icon name="file-text" size="sm" /> Templates
          </button>
          <button
            className="add-button"
            onClick={() => setShowPortfolios(true)}
            style={{ background: '#ec4899' }}
          >
            <Icon name="layers" size="sm" /> Portfolios
          </button>
          <button
            className="add-button"
            onClick={() => setShowAnalytics(true)}
            style={{ background: '#6366f1' }}
          >
            <Icon name="bar-chart" size="sm" /> Analytics
          </button>
          <button
            className="add-button"
            onClick={handleCreateReference}
          >
            + Add Reference
          </button>
        </div>
      </div>

      <div className="tabs-container" style={{ marginBottom: '20px' }}>
        <button
          className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active References
        </button>
        <button
          className={`tab-button ${activeTab === 'inactive' ? 'active' : ''}`}
          onClick={() => setActiveTab('inactive')}
        >
          Inactive
        </button>
        <button
          className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ 
          padding: '12px', 
          margin: '12px 0', 
          background: '#fee2e2', 
          color: '#991b1b', 
          borderRadius: '8px' 
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading references...</p>
        </div>
      ) : (
        <ReferencesList
          references={references}
          onEdit={handleEditReference}
          onDelete={handleDeleteReference}
          onRequestReference={handleRequestReference}
          onShowAppreciations={handleShowAppreciations}
        />
      )}

      {showReferenceForm && (
        <ReferenceForm
          reference={selectedReference}
          onSave={handleSaveReference}
          onClose={() => setShowReferenceForm(false)}
        />
      )}

      {showRequestForm && (
        <ReferenceRequestForm
          reference={selectedReference}
          onSave={handleSaveRequest}
          onClose={() => setShowRequestForm(false)}
        />
      )}

      {showAnalytics && (
        <ReferenceAnalytics
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {showTemplates && (
        <ReferenceTemplates
          onClose={() => setShowTemplates(false)}
        />
      )}

      {showPortfolios && (
        <ReferencePortfolios
          references={references}
          onClose={() => setShowPortfolios(false)}
        />
      )}

      {showAppreciations && selectedReference && (
        <ReferenceAppreciations
          reference={selectedReference}
          onClose={() => {
            setShowAppreciations(false);
            setSelectedReference(null);
          }}
        />
      )}
    </div>
  );
};

export default ReferencesPage;
