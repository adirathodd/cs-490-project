import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Icon from '../common/Icon';
import ResponseLibrary from './ResponseLibrary';
import './ResponseCoachLanding.css';

const ResponseCoachLanding = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('overview');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [questionType, setQuestionType] = useState('behavioral');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const data = await api.jobsAPI.getJobs();
      setJobs(data || []);
    } catch (err) {
      console.error('Failed to load jobs:', err);
      setError('Failed to load jobs');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePracticeWithJob = () => {
    if (!selectedJobId) {
      setError('Please select a job');
      return;
    }
    navigate(`/question-bank/${selectedJobId}`);
  };

  const handlePracticeCustomQuestion = () => {
    if (!customQuestion.trim()) {
      setError('Please enter a question');
      return;
    }
    
    navigate(`/response-coach/general/custom`, {
      state: {
        question: {
          id: 'custom',
          prompt: customQuestion,
          category: questionType,
          difficulty: 'mid'
        }
      }
    });
  };

  return (
    <div className="response-coach-page">
      <div className="page-header">
        <h1>Interview Response Coach</h1>
      </div>

      {error && (
        <div className="error-banner" style={{ background: '#fee', border: '1px solid #fcc', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#c00' }}>
          {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {success && (
        <div className="success-banner" style={{ background: '#efe', border: '1px solid #cfc', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#060' }}>
          {success}
          <button onClick={() => setSuccess('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div className="job-tabs">
        <div className="job-tab-group">
          <h3 className="job-tab-group__title">Practice Options</h3>
          <div className="job-tab-group__buttons">
            <button
              className={`job-tab ${activeView === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveView('overview')}
            >
              <div className="job-tab__icon">
                <Icon name="home" size="sm" />
              </div>
              <div>
                <span className="job-tab__label">Overview</span>
                <span className="job-tab__desc">Get started with practice options</span>
              </div>
            </button>

            <button
              className={`job-tab ${activeView === 'library' ? 'active' : ''}`}
              onClick={() => setActiveView('library')}
            >
              <div className="job-tab__icon">
                <Icon name="list" size="sm" />
              </div>
              <div>
                <span className="job-tab__label">Response Library</span>
                <span className="job-tab__desc">View & manage saved responses</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="tab-content-area">
        {activeView === 'overview' ? (
          <div className="practice-cards-grid">
            <div className="practice-option-card">
              <div className="practice-card-header">
                <div className="practice-card-icon" style={{ background: '#eef2ff' }}>
                  <Icon name="briefcase" size="md" color="#4338ca" />
                </div>
                <h3>Practice for a Specific Job</h3>
              </div>
              <p className="practice-card-desc">
                Browse tailored questions from the question bank for jobs you're applying to
              </p>
              
              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                  Loading jobs...
                </div>
              ) : jobs.length > 0 ? (
                <>
                  <div className="form-field">
                    <label>Select a Job</label>
                    <select
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: 'white'
                      }}
                    >
                      <option value="">-- Select a job --</option>
                      {jobs.map(job => (
                        <option key={job.id} value={job.id}>
                          {job.title} {job.company_name ? `at ${job.company_name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handlePracticeWithJob}
                    disabled={!selectedJobId}
                    className="primary-button"
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: selectedJobId ? '#4f46e5' : '#94a3b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: selectedJobId ? 'pointer' : 'not-allowed',
                      marginTop: '12px'
                    }}
                  >
                    View Question Bank
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <p style={{ color: '#64748b', marginBottom: '12px' }}>No jobs found. Add a job to get started.</p>
                  <button
                    onClick={() => navigate('/jobs')}
                    style={{
                      padding: '10px 20px',
                      background: '#f1f5f9',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Go to Jobs
                  </button>
                </div>
              )}
            </div>

            <div className="practice-option-card">
              <div className="practice-card-header">
                <div className="practice-card-icon" style={{ background: '#f0fdf4' }}>
                  <Icon name="edit" size="md" color="#166534" />
                </div>
                <h3>Practice a Custom Question</h3>
              </div>
              <p className="practice-card-desc">
                Enter any interview question and get AI-powered feedback on your response
              </p>

              <div className="form-field">
                <label>Question Type</label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'white'
                  }}
                >
                  <option value="behavioral">Behavioral</option>
                  <option value="technical">Technical</option>
                  <option value="situational">Situational</option>
                </select>
              </div>

              <div className="form-field">
                <label>Your Question</label>
                <textarea
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="e.g., Tell me about a time you overcame a difficult challenge..."
                  rows="4"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <button
                onClick={handlePracticeCustomQuestion}
                disabled={!customQuestion.trim()}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: customQuestion.trim() ? '#4f46e5' : '#94a3b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: customQuestion.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Start Practicing
              </button>
            </div>
          </div>
        ) : (
          <ResponseLibrary />
        )}
      </div>
    </div>
  );
};

export default ResponseCoachLanding;
