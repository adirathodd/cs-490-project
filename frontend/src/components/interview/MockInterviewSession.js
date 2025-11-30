// frontend/src/components/interview/MockInterviewSession.js
import React, { useState, useEffect } from 'react';
import { mockInterviewAPI } from '../../services/api';
import './MockInterview.css';

const MockInterviewSession = ({ session, onComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);
  const [questions, setQuestions] = useState(session.questions || []);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const answeredCount = questions.filter(q => q.user_answer).length;

  // Timer effect
  useEffect(() => {
    if (!showFeedback && !currentQuestion?.user_answer) {
      const interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
      setTimerInterval(interval);
      return () => clearInterval(interval);
    } else if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  }, [showFeedback, currentQuestion]);

  // Load answer if already submitted
  useEffect(() => {
    if (currentQuestion?.user_answer) {
      setAnswer(currentQuestion.user_answer);
      setShowFeedback(true);
      if (timerInterval) clearInterval(timerInterval);
    } else {
      setAnswer('');
      setShowFeedback(false);
      setTimer(0);
    }
  }, [currentQuestionIndex]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) {
      setError('Please provide an answer before submitting.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const updatedQuestion = await mockInterviewAPI.submitAnswer({
        session_id: session.id,
        question_number: currentQuestion.question_number,
        answer: answer.trim()
      });

      // Update question in state
      const updatedQuestions = [...questions];
      updatedQuestions[currentQuestionIndex] = updatedQuestion;
      setQuestions(updatedQuestions);
      setShowFeedback(true);

      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
    } catch (err) {
      console.error('Failed to submit answer:', err);
      setError(err.message || 'Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setError(null);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setError(null);
    }
  };

  const handleComplete = async () => {
    // Check if all questions answered
    const unanswered = questions.filter(q => !q.user_answer);
    if (unanswered.length > 0) {
      setError(`Please answer all questions before completing. ${unanswered.length} questions remaining.`);
      return;
    }

    setCompleting(true);
    setError(null);

    try {
      const summary = await mockInterviewAPI.completeSession(session.id);
      onComplete(summary);
    } catch (err) {
      console.error('Failed to complete interview:', err);
      setError(err.message || 'Failed to complete interview. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  if (!currentQuestion) {
    return <div className="loading">Loading questions...</div>;
  }

  return (
    <div className="mock-interview-session">
      {/* Progress Bar */}
      <div className="interview-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="progress-text">
          Question {currentQuestionIndex + 1} of {questions.length} 
          <span className="answered-count">({answeredCount} answered)</span>
        </div>
      </div>

      {/* Timer */}
      {!showFeedback && (
        <div className="interview-timer">
          <span className="timer-icon">⏱️</span>
          <span className="timer-value">{formatTime(timer)}</span>
        </div>
      )}

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* Question Display */}
      <div className="question-container">
        <div className="question-header">
          <span className="question-category">{currentQuestion.question_category || 'General'}</span>
          {currentQuestion.suggested_framework && (
            <span className="question-framework">Framework: {currentQuestion.suggested_framework}</span>
          )}
        </div>

        <div className="question-text">
          <h3>{currentQuestion.question_text}</h3>
        </div>

        {currentQuestion.ideal_answer_points && currentQuestion.ideal_answer_points.length > 0 && !showFeedback && (
          <div className="question-hints">
            <h4>Key points to consider:</h4>
            <ul>
              {currentQuestion.ideal_answer_points.map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Answer Input or Feedback */}
      {!showFeedback ? (
        <div className="answer-section">
          <label htmlFor="answer-textarea">Your Answer:</label>
          <textarea
            id="answer-textarea"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here... Use the STAR method for behavioral questions."
            rows="10"
            className="answer-textarea"
          />
          <div className="answer-actions">
            <button
              onClick={handleSubmitAnswer}
              disabled={submitting || !answer.trim()}
              className="btn btn-primary"
            >
              {submitting ? 'Evaluating...' : 'Submit Answer'}
            </button>
          </div>
        </div>
      ) : (
        <div className="feedback-section">
          <div className="submitted-answer">
            <h4>Your Answer:</h4>
            <p>{currentQuestion.user_answer}</p>
          </div>

          <div className="ai-evaluation">
            <div className="score-display">
              <span className="score-label">Score:</span>
              <span className={`score-value ${getScoreClass(currentQuestion.answer_score)}`}>
                {currentQuestion.answer_score ? Math.round(currentQuestion.answer_score) : 0}/100
              </span>
            </div>

            {currentQuestion.ai_feedback && (
              <div className="feedback-text">
                <h4>Feedback:</h4>
                <p>{currentQuestion.ai_feedback}</p>
              </div>
            )}

            {currentQuestion.strengths && currentQuestion.strengths.length > 0 && (
              <div className="feedback-strengths">
                <h4>Strengths:</h4>
                <ul>
                  {currentQuestion.strengths.map((strength, idx) => (
                    <li key={idx}>✅ {strength}</li>
                  ))}
                </ul>
              </div>
            )}

            {currentQuestion.improvements && currentQuestion.improvements.length > 0 && (
              <div className="feedback-improvements">
                <h4>Areas for Improvement:</h4>
                <ul>
                  {currentQuestion.improvements.map((improvement, idx) => (
                    <li key={idx}>💡 {improvement}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="interview-navigation">
        <button
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          className="btn btn-secondary"
        >
          ← Previous
        </button>

        <div className="nav-center">
          {answeredCount === questions.length && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="btn btn-success btn-large"
            >
              {completing ? 'Processing...' : 'Complete Interview & View Summary'}
            </button>
          )}
        </div>

        {currentQuestionIndex < questions.length - 1 ? (
          <button
            onClick={handleNext}
            className="btn btn-secondary"
          >
            Next →
          </button>
        ) : (
          <button disabled className="btn btn-secondary" style={{ visibility: 'hidden' }}>
            Next →
          </button>
        )}
      </div>
    </div>
  );
};

const getScoreClass = (score) => {
  if (!score) return 'score-low';
  if (score >= 85) return 'score-excellent';
  if (score >= 70) return 'score-good';
  if (score >= 50) return 'score-fair';
  return 'score-low';
};

export default MockInterviewSession;
