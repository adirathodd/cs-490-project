// frontend/src/components/interview/MockInterviewStart.js
import React, { useState, useEffect } from 'react';
import { mockInterviewAPI } from '../../services/api';
import './MockInterview.css';

const MockInterviewStart = ({ onSessionStart, jobs = [] }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState({
    job_id: '',
    interview_type: 'behavioral',
    difficulty_level: 'mid',
    question_count: 5,
    focus_areas: []
  });
  const [focusAreaInput, setFocusAreaInput] = useState('');

  const interviewTypes = [
    { value: 'behavioral', label: 'Behavioral', description: 'Questions about past experiences and situations' },
    { value: 'technical', label: 'Technical', description: 'Technical knowledge and problem-solving' },
    { value: 'case_study', label: 'Case Study', description: 'Business scenarios and analysis' },
    { value: 'mixed', label: 'Mixed', description: 'Combination of behavioral and technical' }
  ];

  const difficultyLevels = [
    { value: 'entry', label: 'Entry Level' },
    { value: 'mid', label: 'Mid Level' },
    { value: 'senior', label: 'Senior Level' },
    { value: 'executive', label: 'Executive' }
  ];

  const handleInputChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const addFocusArea = () => {
    if (focusAreaInput.trim() && !config.focus_areas.includes(focusAreaInput.trim())) {
      setConfig(prev => ({
        ...prev,
        focus_areas: [...prev.focus_areas, focusAreaInput.trim()]
      }));
      setFocusAreaInput('');
    }
  };

  const removeFocusArea = (area) => {
    setConfig(prev => ({
      ...prev,
      focus_areas: prev.focus_areas.filter(a => a !== area)
    }));
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);

    try {
      // Prepare payload
      const payload = {
        interview_type: config.interview_type,
        difficulty_level: config.difficulty_level,
        question_count: parseInt(config.question_count)
      };

      // Add optional fields
      if (config.job_id) {
        payload.job_id = config.job_id;
      }
      if (config.focus_areas.length > 0) {
        payload.focus_areas = config.focus_areas;
      }

      const session = await mockInterviewAPI.startSession(payload);
      onSessionStart(session);
    } catch (err) {
      console.error('Failed to start mock interview:', err);
      setError(err.message || 'Failed to start interview. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mock-interview-start">
      <div className="mock-interview-header">
        <h2>Start Mock Interview Practice</h2>
        <p>Practice with AI-generated questions tailored to your needs</p>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="interview-config-form">
        {/* Job Selection (Optional) */}
        {jobs.length > 0 && (
          <div className="form-group">
            <label htmlFor="job-select">
              Target Job (Optional)
              <span className="help-text">Select a job to get tailored questions</span>
            </label>
            <select
              id="job-select"
              value={config.job_id}
              onChange={(e) => handleInputChange('job_id', e.target.value)}
              className="form-control"
            >
              <option value="">General Practice (No specific job)</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>
                  {job.position_title} {job.company_name ? `at ${job.company_name}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Interview Type */}
        <div className="form-group">
          <label>Interview Type</label>
          <div className="interview-type-options">
            {interviewTypes.map(type => (
              <div
                key={type.value}
                className={`interview-type-card ${config.interview_type === type.value ? 'selected' : ''}`}
                onClick={() => handleInputChange('interview_type', type.value)}
              >
                <h4>{type.label}</h4>
                <p>{type.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Difficulty Level */}
        <div className="form-group">
          <label htmlFor="difficulty-select">Difficulty Level</label>
          <select
            id="difficulty-select"
            value={config.difficulty_level}
            onChange={(e) => handleInputChange('difficulty_level', e.target.value)}
            className="form-control"
          >
            {difficultyLevels.map(level => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>

        {/* Question Count */}
        <div className="form-group">
          <label htmlFor="question-count">
            Number of Questions
            <span className="help-text">5-10 questions recommended</span>
          </label>
          <input
            id="question-count"
            type="number"
            min="3"
            max="15"
            value={config.question_count}
            onChange={(e) => handleInputChange('question_count', e.target.value)}
            className="form-control"
          />
        </div>

        {/* Focus Areas */}
        <div className="form-group">
          <label htmlFor="focus-areas">
            Focus Areas (Optional)
            <span className="help-text">Add specific topics you want to practice</span>
          </label>
          <div className="focus-area-input">
            <input
              id="focus-areas"
              type="text"
              value={focusAreaInput}
              onChange={(e) => setFocusAreaInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addFocusArea()}
              placeholder="e.g., leadership, conflict resolution"
              className="form-control"
            />
            <button
              type="button"
              onClick={addFocusArea}
              className="btn btn-secondary"
              disabled={!focusAreaInput.trim()}
            >
              Add
            </button>
          </div>
          {config.focus_areas.length > 0 && (
            <div className="focus-areas-list">
              {config.focus_areas.map((area, index) => (
                <span key={index} className="focus-area-tag">
                  {area}
                  <button
                    type="button"
                    onClick={() => removeFocusArea(area)}
                    className="remove-tag"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Start Button */}
        <div className="form-actions">
          <button
            onClick={handleStart}
            disabled={loading}
            className="btn btn-primary btn-large"
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Generating Questions...
              </>
            ) : (
              <>
                <span className="icon">🎯</span>
                Start Mock Interview
              </>
            )}
          </button>
        </div>
      </div>

      <div className="interview-tips">
        <h3>Tips for Success</h3>
        <ul>
          <li>Find a quiet space with no distractions</li>
          <li>Use the STAR method (Situation, Task, Action, Result) for behavioral questions</li>
          <li>Take your time to think before answering</li>
          <li>Be specific and provide concrete examples</li>
          <li>Review the AI feedback carefully after each answer</li>
        </ul>
      </div>
    </div>
  );
};

export default MockInterviewStart;
