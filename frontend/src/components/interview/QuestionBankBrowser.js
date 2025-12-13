import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Toast from '../common/Toast';
import Icon from '../common/Icon';
import api from '../../services/api';
import './QuestionBank.css';

export const QuestionBankBrowser = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [questionBank, setQuestionBank] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [practiceMode, setPracticeMode] = useState(false);
  
  // Practice form state
  const [writtenResponse, setWrittenResponse] = useState('');
  const [starResponse, setStarResponse] = useState({
    situation: '',
    task: '',
    action: '',
    result: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'info' });

  useEffect(() => {
    loadQuestionBank();
  }, [jobId]);

  const loadQuestionBank = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const data = await api.questionBankAPI.getQuestionBank(jobId, refresh);
      setQuestionBank(data);
    } catch (err) {
      setError(err.message || 'Failed to load question bank');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadPracticeHistory = async (questionId) => {
    try {
      const history = await api.questionBankAPI.getQuestionPracticeHistory(jobId, questionId);
      setPracticeHistory(history);
      setShowHistory(true);
    } catch (err) {
      console.error('Failed to load practice history:', err);
    }
  };

  const handleQuestionSelect = (question) => {
    setSelectedQuestion(question);
    setPracticeMode(false);
    setWrittenResponse('');
    setStarResponse({ situation: '', task: '', action: '', result: '' });
    setPracticeHistory(null);
    setShowHistory(false);
  };

  const handleStartPractice = () => {
    setPracticeMode(true);
    setShowHistory(false);
  };

  const handleSubmitPractice = async () => {
    if (!writtenResponse.trim()) {
      setToast({ isOpen: true, message: 'Please write a response before submitting.', type: 'warning' });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        question_id: selectedQuestion.id,
        question_text: selectedQuestion.prompt,
        category: selectedQuestion.category,
        difficulty: selectedQuestion.difficulty,
        written_response: writtenResponse,
        star_response: starResponse
      };

      await api.questionBankAPI.logQuestionPractice(jobId, payload);
      
      setToast({ isOpen: true, message: 'Practice response saved successfully!', type: 'success' });
      setWrittenResponse('');
      setStarResponse({ situation: '', task: '', action: '', result: '' });
      setPracticeMode(false);
      
      // Load practice history
      await loadPracticeHistory(selectedQuestion.id);
    } catch (err) {
      setToast({ isOpen: true, message: err.message || 'Failed to save practice response', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGetCoaching = () => {
    if (!selectedQuestion) return;
    navigate(`/response-coach/${jobId}/${selectedQuestion.id}`, {
      state: { question: selectedQuestion }
    });
  };

  const getFilteredQuestions = () => {
    if (!questionBank?.categories) return [];
    
    let questions = [];
    questionBank.categories.forEach(category => {
      questions.push(...category.questions.map(q => ({ ...q, categoryLabel: category.label })));
    });

    if (selectedCategory !== 'all') {
      questions = questions.filter(q => q.category === selectedCategory);
    }

    if (selectedDifficulty !== 'all') {
      questions = questions.filter(q => q.difficulty === selectedDifficulty);
    }

    return questions;
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'entry': return '#4CAF50';
      case 'mid': return '#FF9800';
      case 'senior': return '#f44336';
      default: return '#757575';
    }
  };

  if (loading) {
    return (
      <div className="question-bank-page">
        <Toast
          isOpen={toast.isOpen}
          onClose={() => setToast({ ...toast, isOpen: false })}
          message={toast.message}
          type={toast.type}
        />
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading question bank...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="question-bank-page">
        <Toast
          isOpen={toast.isOpen}
          onClose={() => setToast({ ...toast, isOpen: false })}
          message={toast.message}
          type={toast.type}
        />
        <div className="error-state">
          <h2>Error Loading Question Bank</h2>
          <p>{error}</p>
          <button 
            onClick={() => loadQuestionBank()}
            style={{
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!questionBank) {
    return null;
  }

  const filteredQuestions = getFilteredQuestions();
  const categories = questionBank.categories || [];
  const uniqueCategories = [...new Set(categories.map(c => c.id))];
  const difficulties = questionBank.difficulty_levels || [];

  return (
    <div className="question-bank-page">
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
      
      <div className="page-header">
        <button 
          onClick={() => navigate(-1)}
          className="back-button"
        >
          <Icon name="arrow-left" size="sm" />
          Back
        </button>
        <h1 style={{ 
          margin: 0, 
          fontSize: '24px', 
          fontWeight: '600', 
          color: '#111827',
          flex: 1
        }}>
          Question Bank: {questionBank.job_title} at {questionBank.company_name}
        </h1>
        <button 
          onClick={() => loadQuestionBank(true)} 
          disabled={refreshing}
          className="refresh-button"
        >
          <Icon name="refresh-cw" size="sm" />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="question-bank-layout">
        {/* Sidebar with filters and question list */}
        <div className="questions-sidebar-panel">
          <div className="sidebar-filters">
            <div className="filter-group">
              <label>Category</label>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Difficulty</label>
              <select 
                value={selectedDifficulty} 
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Levels</option>
                {difficulties.map(diff => (
                  <option key={diff.id} value={diff.id}>
                    {diff.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="questions-scroll-area">
            <div className="questions-header">
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                Questions ({filteredQuestions.length})
              </h3>
            </div>
            {filteredQuestions.map((question, index) => (
              <div
                key={question.id}
                className={`question-list-item ${selectedQuestion?.id === question.id ? 'selected' : ''}`}
                onClick={() => handleQuestionSelect(question)}
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  background: selectedQuestion?.id === question.id ? '#eef2ff' : 'white',
                  borderLeft: selectedQuestion?.id === question.id ? '3px solid #4f46e5' : '3px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{
                    flexShrink: 0,
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: selectedQuestion?.id === question.id ? '#4f46e5' : '#f3f4f6',
                    color: selectedQuestion?.id === question.id ? 'white' : '#6b7280',
                    borderRadius: '50%',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {index + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ 
                      margin: '0 0 8px 0', 
                      fontSize: '14px', 
                      lineHeight: '1.4',
                      color: '#111827',
                      fontWeight: '500'
                    }}>
                      {question.prompt}
                    </p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: '#f3f4f6',
                        color: '#374151',
                        fontWeight: '500'
                      }}>
                        {question.categoryLabel}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: getDifficultyColor(question.difficulty),
                        color: 'white',
                        fontWeight: '500'
                      }}>
                        {question.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filteredQuestions.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280' }}>
                <Icon name="search" size="lg" />
                <p style={{ marginTop: '12px', fontSize: '14px' }}>No questions match your filters.</p>
              </div>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="question-detail-panel" style={{ minHeight: '400px' }}>
          {!selectedQuestion ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              minHeight: '400px',
              padding: '60px 20px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>💭</div>
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', margin: '0 0 8px 0' }}>
                Select a Question to Begin
              </h3>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                Choose a question from the list to start practicing your interview responses.
              </p>
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '24px',
                paddingBottom: '20px',
                borderBottom: '2px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '13px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: '#f3f4f6',
                    color: '#374151',
                    fontWeight: '500'
                  }}>
                    {selectedQuestion.categoryLabel}
                  </span>
                  <span style={{
                    fontSize: '13px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: getDifficultyColor(selectedQuestion.difficulty),
                    color: 'white',
                    fontWeight: '500'
                  }}>
                    {selectedQuestion.difficulty}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={() => loadPracticeHistory(selectedQuestion.id)}
                    style={{
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      color: '#374151',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Icon name="clock" size="sm" />
                    View History
                  </button>
                  {!practiceMode ? (
                    <button 
                      onClick={handleStartPractice}
                      style={{
                        background: '#4f46e5',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 16px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Icon name="edit" size="sm" />
                      Practice This Question
                    </button>
                  ) : (
                    <button 
                      onClick={handleGetCoaching}
                      style={{
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 16px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Icon name="zap" size="sm" />
                      Get AI Coaching
                    </button>
                  )}
                </div>
              </div>

              <div className="question-content-area">
                <h2 style={{ 
                  fontSize: '22px', 
                  fontWeight: '600', 
                  color: '#111827', 
                  margin: '0 0 24px 0',
                  lineHeight: '1.4'
                }}>
                  {selectedQuestion.prompt}
                </h2>
                
                {selectedQuestion.skills?.length > 0 && (
                  <div style={{ 
                    background: '#f9fafb', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '12px', 
                    padding: '16px',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: '#111827', 
                      margin: '0 0 12px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Icon name="target" size="sm" color="#4f46e5" />
                      Skills Being Assessed
                    </h4>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {selectedQuestion.skills.map((skill, idx) => (
                        <span key={skill.skill_id || idx} style={{
                          fontSize: '13px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: '#eef2ff',
                          color: '#4338ca',
                          fontWeight: '500'
                        }}>
                          {typeof skill === 'string' ? skill : skill.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedQuestion.concepts?.length > 0 && (
                  <div style={{ 
                    background: '#f0fdf4', 
                    border: '1px solid #dcfce7', 
                    borderRadius: '12px', 
                    padding: '16px',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: '#111827', 
                      margin: '0 0 12px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Icon name="book" size="sm" color="#10b981" />
                      Key Concepts
                    </h4>
                    <ul style={{ 
                      margin: 0, 
                      paddingLeft: '20px',
                      color: '#374151',
                      fontSize: '14px',
                      lineHeight: '1.8'
                    }}>
                      {selectedQuestion.concepts.map((concept, idx) => (
                        <li key={idx}>{typeof concept === 'string' ? concept : concept.name || concept.text}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedQuestion.guidance && (
                  <div style={{ 
                    background: '#fffbeb', 
                    border: '1px solid #fef3c7', 
                    borderRadius: '12px', 
                    padding: '16px',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: '#111827', 
                      margin: '0 0 8px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Icon name="lightbulb" size="sm" color="#f59e0b" />
                      Guidance
                    </h4>
                    <p style={{ margin: 0, color: '#374151', fontSize: '14px', lineHeight: '1.6' }}>
                      {selectedQuestion.guidance}
                    </p>
                  </div>
                )}

                {/* STAR Framework Reference */}
                {questionBank.star_framework && (
                  <div style={{ 
                    background: '#fef2f2', 
                    border: '1px solid #fecaca', 
                    borderRadius: '12px', 
                    padding: '20px',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#111827', 
                      margin: '0 0 16px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>⭐</span>
                      STAR Method Framework
                    </h4>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '16px'
                    }}>
                      <div style={{ 
                        background: 'white', 
                        borderRadius: '8px', 
                        padding: '14px',
                        border: '1px solid #fecaca'
                      }}>
                        <strong style={{ fontSize: '14px', color: '#dc2626', fontWeight: '600' }}>
                          <span style={{ fontSize: '18px', marginRight: '4px' }}>S</span>ituation
                        </strong>
                        <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                          {questionBank.star_framework.situation}
                        </p>
                      </div>
                      <div style={{ 
                        background: 'white', 
                        borderRadius: '8px', 
                        padding: '14px',
                        border: '1px solid #fecaca'
                      }}>
                        <strong style={{ fontSize: '14px', color: '#dc2626', fontWeight: '600' }}>
                          <span style={{ fontSize: '18px', marginRight: '4px' }}>T</span>ask
                        </strong>
                        <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                          {questionBank.star_framework.task}
                        </p>
                      </div>
                      <div style={{ 
                        background: 'white', 
                        borderRadius: '8px', 
                        padding: '14px',
                        border: '1px solid #fecaca'
                      }}>
                        <strong style={{ fontSize: '14px', color: '#dc2626', fontWeight: '600' }}>
                          <span style={{ fontSize: '18px', marginRight: '4px' }}>A</span>ction
                        </strong>
                        <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                          {questionBank.star_framework.action}
                        </p>
                      </div>
                      <div style={{ 
                        background: 'white', 
                        borderRadius: '8px', 
                        padding: '14px',
                        border: '1px solid #fecaca'
                      }}>
                        <strong style={{ fontSize: '14px', color: '#dc2626', fontWeight: '600' }}>
                          <span style={{ fontSize: '18px', marginRight: '4px' }}>R</span>esult
                        </strong>
                        <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                          {questionBank.star_framework.result}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Practice Mode */}
                {practiceMode && (
                  <div style={{ 
                    background: '#f9fafb', 
                    border: '2px solid #e5e7eb', 
                    borderRadius: '12px', 
                    padding: '24px',
                    marginTop: '24px'
                  }}>
                    <h3 style={{ 
                      fontSize: '18px', 
                      fontWeight: '600', 
                      color: '#111827', 
                      margin: '0 0 20px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Icon name="edit" size="sm" color="#4f46e5" />
                      Write Your Response
                    </h3>
                    
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        color: '#374151',
                        marginBottom: '8px'
                      }}>
                        Full Response
                      </label>
                      <textarea
                        value={writtenResponse}
                        onChange={(e) => setWrittenResponse(e.target.value)}
                        placeholder="Write your complete response here..."
                        rows={8}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          lineHeight: '1.6'
                        }}
                      />
                    </div>

                    <div>
                      <h4 style={{ 
                        fontSize: '16px', 
                        fontWeight: '600', 
                        color: '#111827', 
                        margin: '0 0 16px 0'
                      }}>
                        STAR Breakdown (Optional)
                      </h4>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '16px'
                      }}>
                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '13px', 
                            fontWeight: '500', 
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            Situation
                          </label>
                          <textarea
                            value={starResponse.situation}
                            onChange={(e) => setStarResponse({ ...starResponse, situation: e.target.value })}
                            placeholder="Describe the context..."
                            rows={3}
                            style={{
                              width: '100%',
                              padding: '10px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontFamily: 'inherit',
                              resize: 'vertical'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '13px', 
                            fontWeight: '500', 
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            Task
                          </label>
                          <textarea
                            value={starResponse.task}
                            onChange={(e) => setStarResponse({ ...starResponse, task: e.target.value })}
                            placeholder="What was your responsibility..."
                            rows={3}
                            style={{
                              width: '100%',
                              padding: '10px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontFamily: 'inherit',
                              resize: 'vertical'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '13px', 
                            fontWeight: '500', 
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            Action
                          </label>
                          <textarea
                            value={starResponse.action}
                            onChange={(e) => setStarResponse({ ...starResponse, action: e.target.value })}
                            placeholder="What steps did you take..."
                            rows={3}
                            style={{
                              width: '100%',
                              padding: '10px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontFamily: 'inherit',
                              resize: 'vertical'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '13px', 
                            fontWeight: '500', 
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            Result
                          </label>
                          <textarea
                            value={starResponse.result}
                            onChange={(e) => setStarResponse({ ...starResponse, result: e.target.value })}
                            placeholder="What was the outcome..."
                            rows={3}
                            style={{
                              width: '100%',
                              padding: '10px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontFamily: 'inherit',
                              resize: 'vertical'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ 
                      display: 'flex', 
                      gap: '12px', 
                      justifyContent: 'flex-end',
                      marginTop: '24px'
                    }}>
                      <button 
                        onClick={() => setPracticeMode(false)}
                        style={{
                          background: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '10px 20px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          color: '#374151'
                        }}
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSubmitPractice}
                        disabled={submitting}
                        style={{
                          background: submitting ? '#94a3b8' : '#4f46e5',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 20px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: submitting ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <Icon name="save" size="sm" />
                        {submitting ? 'Saving...' : 'Save Practice Response'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Practice History */}
                {showHistory && practiceHistory && (
                  <div style={{ 
                    background: 'white', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '12px', 
                    padding: '24px',
                    marginTop: '24px'
                  }}>
                    <h3 style={{ 
                      fontSize: '18px', 
                      fontWeight: '600', 
                      color: '#111827', 
                      margin: '0 0 20px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Icon name="clock" size="sm" color="#4f46e5" />
                      Practice History
                    </h3>
                    {practiceHistory.practice_count > 0 ? (
                      <>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '16px',
                          marginBottom: '24px'
                        }}>
                          <div style={{ 
                            background: '#f3f4f6', 
                            borderRadius: '8px', 
                            padding: '16px',
                            textAlign: 'center'
                          }}>
                            <span style={{ 
                              display: 'block', 
                              fontSize: '12px', 
                              color: '#6b7280',
                              marginBottom: '8px',
                              fontWeight: '500'
                            }}>
                              Times Practiced
                            </span>
                            <span style={{ 
                              display: 'block', 
                              fontSize: '28px', 
                              fontWeight: '700',
                              color: '#111827'
                            }}>
                              {practiceHistory.practice_count}
                            </span>
                          </div>
                          <div style={{ 
                            background: '#f3f4f6', 
                            borderRadius: '8px', 
                            padding: '16px',
                            textAlign: 'center'
                          }}>
                            <span style={{ 
                              display: 'block', 
                              fontSize: '12px', 
                              color: '#6b7280',
                              marginBottom: '8px',
                              fontWeight: '500'
                            }}>
                              Coaching Sessions
                            </span>
                            <span style={{ 
                              display: 'block', 
                              fontSize: '28px', 
                              fontWeight: '700',
                              color: '#111827'
                            }}>
                              {practiceHistory.coaching_count}
                            </span>
                          </div>
                          {practiceHistory.latest_coaching?.scores?.overall && (
                            <div style={{ 
                              background: '#eef2ff', 
                              borderRadius: '8px', 
                              padding: '16px',
                              textAlign: 'center'
                            }}>
                              <span style={{ 
                                display: 'block', 
                                fontSize: '12px', 
                                color: '#6b7280',
                                marginBottom: '8px',
                                fontWeight: '500'
                              }}>
                                Latest Score
                              </span>
                              <span style={{ 
                                display: 'block', 
                                fontSize: '28px', 
                                fontWeight: '700',
                                color: '#4f46e5'
                              }}>
                                {practiceHistory.latest_coaching.scores.overall}/100
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {practiceHistory.latest_practice && (
                          <div style={{ 
                            background: '#f9fafb', 
                            borderRadius: '8px', 
                            padding: '16px'
                          }}>
                            <h4 style={{ 
                              fontSize: '14px', 
                              fontWeight: '600', 
                              color: '#111827',
                              margin: '0 0 8px 0'
                            }}>
                              Latest Practice
                            </h4>
                            <p style={{ 
                              fontSize: '12px', 
                              color: '#6b7280',
                              margin: '0 0 12px 0'
                            }}>
                              {new Date(practiceHistory.latest_practice.practiced_at).toLocaleDateString()}
                            </p>
                            <p style={{ 
                              fontSize: '14px', 
                              color: '#374151',
                              margin: 0,
                              lineHeight: '1.6'
                            }}>
                              {practiceHistory.latest_practice.written_response}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, textAlign: 'center', padding: '20px' }}>
                        No practice history yet. Start practicing to build your history!
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionBankBrowser;
