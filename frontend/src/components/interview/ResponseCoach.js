import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Toast from '../common/Toast';
import api from '../../services/api';
import './ResponseCoach.css';

export const ResponseCoach = () => {
  const { jobId, questionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [question, setQuestion] = useState(location.state?.question || null);
  
  // Response form state
  const [writtenResponse, setWrittenResponse] = useState('');
  const [starResponse, setStarResponse] = useState({
    situation: '',
    task: '',
    action: '',
    result: ''
  });
  
  // Coaching results
  const [coaching, setCoaching] = useState(null);
  const [practiceStatus, setPracticeStatus] = useState(null);
  const [improvement, setImprovement] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'info' });

  useEffect(() => {
    if (!question && questionId) {
      loadQuestionBank();
    }
  }, [jobId, questionId]);

  const loadQuestionBank = async () => {
    try {
      setLoading(true);
      const data = await api.questionBankAPI.getQuestionBank(jobId);
      
      // Find the question
      for (const category of data.categories || []) {
        const foundQuestion = category.questions.find(q => q.id === questionId);
        if (foundQuestion) {
          setQuestion(foundQuestion);
          break;
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load question');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForCoaching = async () => {
    if (!writtenResponse.trim()) {
      setToast({ isOpen: true, message: 'Please write a response before submitting for coaching.', type: 'warning' });
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      const payload = {
        question_id: question?.id || questionId,
        question_text: question?.prompt || 'Interview Question',
        category: question?.category || 'behavioral',
        difficulty: question?.difficulty || 'mid',
        written_response: writtenResponse,
        star_response: starResponse
      };

      const result = await api.questionBankAPI.coachQuestionResponse(jobId, payload);
      
      setCoaching(result.coaching);
      setPracticeStatus(result.practice_status);
      setImprovement(result.improvement);
    } catch (err) {
      setError(err.message || 'Failed to generate coaching feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setWrittenResponse('');
    setStarResponse({ situation: '', task: '', action: '', result: '' });
    setCoaching(null);
    setPracticeStatus(null);
    setImprovement(null);
    setError(null);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#f44336';
  };

  const renderScoreBar = (label, score) => (
    <div className="score-bar">
      <div className="score-label">
        <span>{label}</span>
        <span className="score-value">{score}</span>
      </div>
      <div className="score-track">
        <div 
          className="score-fill" 
          style={{ 
            width: `${score}%`,
            backgroundColor: getScoreColor(score)
          }}
        />
      </div>
    </div>
  );

  const renderStarAdherence = (starAdherence) => {
    const components = ['situation', 'task', 'action', 'result'];
    const statusColors = {
      covered: '#4CAF50',
      light: '#FF9800',
      missing: '#f44336'
    };

    return (
      <div className="star-adherence">
        <h4>⭐ STAR Framework Analysis</h4>
        <div className="star-components">
          {components.map(component => {
            const data = starAdherence[component];
            if (!data) return null;
            
            return (
              <div key={component} className="star-component">
                <div className="component-header">
                  <span className="component-name">
                    {component.charAt(0).toUpperCase() + component.slice(1)}
                  </span>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: statusColors[data.status] || '#757575' }}
                  >
                    {data.status}
                  </span>
                </div>
                {data.feedback && (
                  <p className="component-feedback">{data.feedback}</p>
                )}
              </div>
            );
          })}
        </div>
        {starAdherence.overall_feedback && (
          <div className="overall-star-feedback">
            <strong>Overall:</strong> {starAdherence.overall_feedback}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="response-coach-container">
        <Toast
          isOpen={toast.isOpen}
          onClose={() => setToast({ ...toast, isOpen: false })}
          message={toast.message}
          type={toast.type}
        />
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading question...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="response-coach-container">
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
      <div className="coach-header">
        <button onClick={() => navigate(-1)} className="back-button">
          ← Back
        </button>
        <div className="header-content">
          <h1>AI Response Coach</h1>
          <p>Get detailed feedback on your interview responses</p>
        </div>
      </div>

      <div className="coach-content">
        {/* Question Display */}
        {question && (
          <div className="question-display">
            <h3>Question</h3>
            <div className="question-text">{question.prompt}</div>
            <div className="question-meta">
              <span className="category-tag">{question.category}</span>
              <span className="difficulty-tag">{question.difficulty}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Input Section */}
        {!coaching && (
          <div className="input-section">
            <div className="response-input">
              <label>Your Written Response</label>
              <textarea
                value={writtenResponse}
                onChange={(e) => setWrittenResponse(e.target.value)}
                placeholder="Write your complete response here... Aim for a response that would take 60-120 seconds to speak."
                rows={10}
                className="response-textarea"
              />
              <div className="word-count">
                {writtenResponse.split(/\s+/).filter(w => w).length} words
              </div>
            </div>

            <div className="star-section">
              <h3>STAR Framework Breakdown</h3>
              <p className="section-subtitle">Break down your response using the STAR method for better coaching</p>
              
              <div className="star-inputs">
                <div className="star-input-group">
                  <label>
                    <strong>S</strong>ituation
                    <span className="label-hint">Set the context</span>
                  </label>
                  <textarea
                    value={starResponse.situation}
                    onChange={(e) => setStarResponse({ ...starResponse, situation: e.target.value })}
                    placeholder="Describe the context and background..."
                    rows={3}
                  />
                </div>

                <div className="star-input-group">
                  <label>
                    <strong>T</strong>ask
                    <span className="label-hint">What was your responsibility?</span>
                  </label>
                  <textarea
                    value={starResponse.task}
                    onChange={(e) => setStarResponse({ ...starResponse, task: e.target.value })}
                    placeholder="What was your role and responsibility..."
                    rows={3}
                  />
                </div>

                <div className="star-input-group">
                  <label>
                    <strong>A</strong>ction
                    <span className="label-hint">What did you do?</span>
                  </label>
                  <textarea
                    value={starResponse.action}
                    onChange={(e) => setStarResponse({ ...starResponse, action: e.target.value })}
                    placeholder="What specific steps did you take..."
                    rows={3}
                  />
                </div>

                <div className="star-input-group">
                  <label>
                    <strong>R</strong>esult
                    <span className="label-hint">What was the outcome?</span>
                  </label>
                  <textarea
                    value={starResponse.result}
                    onChange={(e) => setStarResponse({ ...starResponse, result: e.target.value })}
                    placeholder="What was the measurable outcome..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="submit-section">
              <button 
                onClick={handleSubmitForCoaching} 
                className="btn-primary"
                disabled={submitting || !writtenResponse.trim()}
              >
                {submitting ? 'Analyzing...' : 'Get AI Coaching'}
              </button>
            </div>
          </div>
        )}

        {/* Coaching Results */}
        {coaching && (
          <div className="coaching-results">
            <div className="results-header">
              <h2>Your Coaching Report</h2>
              <button onClick={handleReset} className="btn-outline">
                Practice Another Response
              </button>
            </div>

            {/* Summary */}
            <div className="coaching-card summary-card">
              <h3>📝 Summary</h3>
              <p className="summary-text">{coaching.summary}</p>
            </div>

            {/* Scores */}
            <div className="coaching-card scores-card">
              <h3>📊 Response Scores</h3>
              <div className="scores-grid">
                {coaching.scores && (
                  <>
                    <div className="overall-score">
                      <div className="score-circle" style={{ borderColor: getScoreColor(coaching.scores.overall) }}>
                        <span className="score-number">{coaching.scores.overall}</span>
                        <span className="score-max">/100</span>
                      </div>
                      <span className="score-title">Overall Score</span>
                    </div>
                    <div className="detailed-scores">
                      {renderScoreBar('Relevance', coaching.scores.relevance)}
                      {renderScoreBar('Specificity', coaching.scores.specificity)}
                      {renderScoreBar('Impact', coaching.scores.impact)}
                      {renderScoreBar('Clarity', coaching.scores.clarity)}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Length Analysis */}
            {coaching.length_analysis && (
              <div className="coaching-card length-card">
                <h3>⏱️ Response Length Analysis</h3>
                <div className="length-stats">
                  <div className="stat-item">
                    <span className="stat-label">Word Count</span>
                    <span className="stat-value">{coaching.length_analysis.word_count}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Estimated Speaking Time</span>
                    <span className="stat-value">{coaching.length_analysis.spoken_time_seconds}s</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Recommended Window</span>
                    <span className="stat-value">{coaching.length_analysis.recommended_window}</span>
                  </div>
                </div>
                {coaching.length_analysis.recommendation && (
                  <p className="length-recommendation">
                    💡 {coaching.length_analysis.recommendation}
                  </p>
                )}
              </div>
            )}

            {/* Feedback */}
            {coaching.feedback && (
              <div className="coaching-card feedback-card">
                <h3>💬 Detailed Feedback</h3>
                {coaching.feedback.content?.length > 0 && (
                  <div className="feedback-section">
                    <h4>Content</h4>
                    <ul>
                      {coaching.feedback.content.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {coaching.feedback.structure?.length > 0 && (
                  <div className="feedback-section">
                    <h4>Structure</h4>
                    <ul>
                      {coaching.feedback.structure.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {coaching.feedback.clarity?.length > 0 && (
                  <div className="feedback-section">
                    <h4>Clarity</h4>
                    <ul>
                      {coaching.feedback.clarity.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* STAR Adherence */}
            {coaching.star_adherence && (
              <div className="coaching-card star-card">
                {renderStarAdherence(coaching.star_adherence)}
              </div>
            )}

            {/* Weak Language Patterns */}
            {coaching.weak_language && (
              <div className="coaching-card weak-language-card">
                <h3>🎯 Language Improvements</h3>
                {coaching.weak_language.patterns?.length > 0 ? (
                  <>
                    <ul className="patterns-list">
                      {coaching.weak_language.patterns.map((pattern, idx) => (
                        <li key={idx}>
                          <span className="pattern-issue">{pattern.issue}</span>
                          <span className="pattern-suggestion">→ {pattern.suggestion}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="patterns-summary">{coaching.weak_language.summary}</p>
                  </>
                ) : (
                  <p className="no-patterns">✓ {coaching.weak_language.summary || 'Great language usage!'}</p>
                )}
              </div>
            )}

            {/* Alternative Approaches */}
            {coaching.alternative_approaches?.length > 0 && (
              <div className="coaching-card alternatives-card">
                <h3>🔄 Alternative Approaches</h3>
                <ul className="alternatives-list">
                  {coaching.alternative_approaches.map((alt, idx) => (
                    <li key={idx}>{alt}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Improvement Focus */}
            {coaching.improvement_focus?.length > 0 && (
              <div className="coaching-card improvement-card">
                <h3>🎯 Focus Areas for Improvement</h3>
                <ul className="improvement-list">
                  {coaching.improvement_focus.map((focus, idx) => (
                    <li key={idx}>{focus}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Improvement Over Time */}
            {improvement && improvement.session_count > 1 && (
              <div className="coaching-card progress-card">
                <h3>📈 Your Progress</h3>
                <div className="progress-stats">
                  <div className="stat-item">
                    <span className="stat-label">Coaching Sessions</span>
                    <span className="stat-value">{improvement.session_count}</span>
                  </div>
                </div>
                {improvement.delta && Object.keys(improvement.delta).length > 0 && (
                  <div className="delta-scores">
                    <h4>Score Changes Since Last Session</h4>
                    <div className="delta-grid">
                      {Object.entries(improvement.delta).map(([metric, change]) => (
                        <div key={metric} className="delta-item">
                          <span className="delta-metric">{metric}</span>
                          <span className={`delta-value ${change >= 0 ? 'positive' : 'negative'}`}>
                            {change >= 0 ? '+' : ''}{change}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResponseCoach;
