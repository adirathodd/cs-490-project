import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Toast from '../common/Toast';
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
      <div className="question-bank-container">
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
      <div className="question-bank-container">
        <Toast
          isOpen={toast.isOpen}
          onClose={() => setToast({ ...toast, isOpen: false })}
          message={toast.message}
          type={toast.type}
        />
        <div className="error-state">
          <h2>Error Loading Question Bank</h2>
          <p>{error}</p>
          <button onClick={() => loadQuestionBank()} className="btn-primary">
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
    <div className="question-bank-container">
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
      <div className="question-bank-header">
        <div className="header-content">
          <h1>Interview Question Bank</h1>
          <div className="job-info">
            <h2>{questionBank.job_title}</h2>
            <p>{questionBank.company_name} • {questionBank.industry}</p>
          </div>
        </div>
        <button 
          onClick={() => loadQuestionBank(true)} 
          className="btn-secondary"
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh Questions'}
        </button>
      </div>

      <div className="question-bank-content">
        {/* Sidebar with filters and question list */}
        <div className="question-sidebar">
          <div className="filters-section">
            <div className="filter-group">
              <label>Category</label>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="filter-select"
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
                className="filter-select"
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

          <div className="questions-list">
            <div className="list-header">
              <h3>Questions ({filteredQuestions.length})</h3>
            </div>
            {filteredQuestions.map((question, index) => (
              <div
                key={question.id}
                className={`question-item ${selectedQuestion?.id === question.id ? 'active' : ''}`}
                onClick={() => handleQuestionSelect(question)}
              >
                <div className="question-number">#{index + 1}</div>
                <div className="question-preview">
                  <p>{question.prompt}</p>
                  <div className="question-meta">
                    <span className="category-tag">{question.categoryLabel}</span>
                    <span 
                      className="difficulty-tag"
                      style={{ backgroundColor: getDifficultyColor(question.difficulty) }}
                    >
                      {question.difficulty}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {filteredQuestions.length === 0 && (
              <div className="no-questions">
                <p>No questions match your filters.</p>
              </div>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="question-detail">
          {!selectedQuestion ? (
            <div className="no-selection">
              <div className="placeholder-icon">💭</div>
              <h3>Select a Question to Begin</h3>
              <p>Choose a question from the list to start practicing your interview responses.</p>
            </div>
          ) : (
            <>
              <div className="detail-header">
                <div className="detail-meta">
                  <span className="category-badge">{selectedQuestion.categoryLabel}</span>
                  <span 
                    className="difficulty-badge"
                    style={{ backgroundColor: getDifficultyColor(selectedQuestion.difficulty) }}
                  >
                    {selectedQuestion.difficulty}
                  </span>
                </div>
                <div className="detail-actions">
                  <button 
                    onClick={() => loadPracticeHistory(selectedQuestion.id)}
                    className="btn-outline"
                  >
                    View History
                  </button>
                  {!practiceMode ? (
                    <button onClick={handleStartPractice} className="btn-primary">
                      Practice This Question
                    </button>
                  ) : (
                    <button onClick={handleGetCoaching} className="btn-secondary">
                      Get AI Coaching
                    </button>
                  )}
                </div>
              </div>

              <div className="question-content">
                <h2>{selectedQuestion.prompt}</h2>
                
                {selectedQuestion.skills?.length > 0 && (
                  <div className="skills-section">
                    <h4>Skills Being Assessed:</h4>
                    <div className="skills-tags">
                      {selectedQuestion.skills.map(skill => (
                        <span key={skill} className="skill-tag">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedQuestion.concepts?.length > 0 && (
                  <div className="concepts-section">
                    <h4>Key Concepts:</h4>
                    <ul className="concepts-list">
                      {selectedQuestion.concepts.map((concept, idx) => (
                        <li key={idx}>{concept}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedQuestion.guidance && (
                  <div className="guidance-section">
                    <h4>💡 Guidance:</h4>
                    <p>{selectedQuestion.guidance}</p>
                  </div>
                )}

                {/* STAR Framework Reference */}
                {questionBank.star_framework && (
                  <div className="star-framework-section">
                    <h4>⭐ STAR Method Framework:</h4>
                    <div className="star-grid">
                      <div className="star-item">
                        <strong>S</strong>ituation
                        <p>{questionBank.star_framework.situation}</p>
                      </div>
                      <div className="star-item">
                        <strong>T</strong>ask
                        <p>{questionBank.star_framework.task}</p>
                      </div>
                      <div className="star-item">
                        <strong>A</strong>ction
                        <p>{questionBank.star_framework.action}</p>
                      </div>
                      <div className="star-item">
                        <strong>R</strong>esult
                        <p>{questionBank.star_framework.result}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Practice Mode */}
                {practiceMode && (
                  <div className="practice-section">
                    <h3>Write Your Response</h3>
                    
                    <div className="response-area">
                      <label>Full Response</label>
                      <textarea
                        value={writtenResponse}
                        onChange={(e) => setWrittenResponse(e.target.value)}
                        placeholder="Write your complete response here..."
                        rows={8}
                        className="response-textarea"
                      />
                    </div>

                    <div className="star-inputs">
                      <h4>STAR Breakdown (Optional)</h4>
                      <div className="star-input-grid">
                        <div className="star-input-item">
                          <label>Situation</label>
                          <textarea
                            value={starResponse.situation}
                            onChange={(e) => setStarResponse({ ...starResponse, situation: e.target.value })}
                            placeholder="Describe the context..."
                            rows={3}
                          />
                        </div>
                        <div className="star-input-item">
                          <label>Task</label>
                          <textarea
                            value={starResponse.task}
                            onChange={(e) => setStarResponse({ ...starResponse, task: e.target.value })}
                            placeholder="What was your responsibility..."
                            rows={3}
                          />
                        </div>
                        <div className="star-input-item">
                          <label>Action</label>
                          <textarea
                            value={starResponse.action}
                            onChange={(e) => setStarResponse({ ...starResponse, action: e.target.value })}
                            placeholder="What steps did you take..."
                            rows={3}
                          />
                        </div>
                        <div className="star-input-item">
                          <label>Result</label>
                          <textarea
                            value={starResponse.result}
                            onChange={(e) => setStarResponse({ ...starResponse, result: e.target.value })}
                            placeholder="What was the outcome..."
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="practice-actions">
                      <button 
                        onClick={() => setPracticeMode(false)} 
                        className="btn-outline"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSubmitPractice} 
                        className="btn-primary"
                        disabled={submitting}
                      >
                        {submitting ? 'Saving...' : 'Save Practice Response'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Practice History */}
                {showHistory && practiceHistory && (
                  <div className="history-section">
                    <h3>Practice History</h3>
                    {practiceHistory.practice_count > 0 ? (
                      <>
                        <div className="history-stats">
                          <div className="stat-item">
                            <span className="stat-label">Times Practiced</span>
                            <span className="stat-value">{practiceHistory.practice_count}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Coaching Sessions</span>
                            <span className="stat-value">{practiceHistory.coaching_count}</span>
                          </div>
                          {practiceHistory.latest_coaching?.scores?.overall && (
                            <div className="stat-item">
                              <span className="stat-label">Latest Score</span>
                              <span className="stat-value">
                                {practiceHistory.latest_coaching.scores.overall}/100
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {practiceHistory.latest_practice && (
                          <div className="latest-practice">
                            <h4>Latest Practice</h4>
                            <p className="practice-date">
                              {new Date(practiceHistory.latest_practice.practiced_at).toLocaleDateString()}
                            </p>
                            <p className="practice-response">
                              {practiceHistory.latest_practice.written_response}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="no-history">No practice history yet. Start practicing to build your history!</p>
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
