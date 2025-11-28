import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../common/Icon';
import { jobsAPI } from '../../services/api';
import './RoleQuestionBank.css';

const SCORE_KEYS = ['overall', 'relevance', 'specificity', 'impact', 'clarity'];
const MIN_TEXTAREA_HEIGHT = 120;
const TIMED_TARGET_SECONDS = 120;

const createStarState = () => ({
  situation: '',
  task: '',
  action: '',
  result: '',
});

const createResponseState = () => ({
  written_response: '',
  practice_notes: '',
  star_response: createStarState(),
});

const RoleQuestionBank = ({
  bank,
  loading = false,
  savingQuestionId = null,
  onLogPractice,
  jobId,
  onPracticeStatusUpdate = () => {},
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [responseForm, setResponseForm] = useState(() => createResponseState());
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [coachingResult, setCoachingResult] = useState(null);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingError, setCoachingError] = useState('');
  const [timer, setTimer] = useState({ running: false, elapsed: 0 });
  const timerIntervalRef = useRef(null);
  const [practiceMeta, setPracticeMeta] = useState({
    checklistSuggestions: [],
    calmExercises: [],
    timedDurationSeconds: null,
  });
  const textareaRefs = useRef({});
  const textareaRefHandlers = useRef({});

  useEffect(() => {
    if (bank?.categories?.length) {
      const exists = bank.categories.find((cat) => cat.id === selectedCategoryId);
      if (!exists) {
        setSelectedCategoryId(bank.categories[0].id);
      }
    }
  }, [bank, selectedCategoryId]);

  useEffect(() => {
    setPracticeMeta({
      checklistSuggestions: [],
      calmExercises: [],
      timedDurationSeconds: null,
    });
  }, [jobId]);

  useEffect(() => {
    if (!timer.running) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return undefined;
    }

    timerIntervalRef.current = setInterval(() => {
      setTimer((prev) => ({ ...prev, elapsed: prev.elapsed + 1 }));
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [timer.running]);

  useEffect(() => () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
  }, []);

  const selectedCategory = useMemo(() => {
    if (!bank?.categories) return null;
    return bank.categories.find((cat) => cat.id === selectedCategoryId) || bank.categories[0];
  }, [bank, selectedCategoryId]);

  const filteredQuestions = useMemo(() => {
    if (!selectedCategory) return [];
    return selectedCategory.questions.filter((question) => {
      if (difficultyFilter === 'all') return true;
      return question.difficulty === difficultyFilter;
    });
  }, [selectedCategory, difficultyFilter]);

  const activeQuestion = filteredQuestions.find((q) => q.id === activeQuestionId)
    || selectedCategory?.questions?.find((q) => q.id === activeQuestionId);

  const hasStarContent = useMemo(
    () => Object.values(responseForm.star_response || {}).some((value) => (value || '').trim()),
    [responseForm.star_response],
  );
  const canRequestCoaching = ((responseForm.written_response || '').trim().length > 0) || hasStarContent;
  const coachingData = coachingResult?.coaching;
  const coachingHistory = coachingResult?.history || [];
  const improvementSummary = coachingResult?.improvement;
  const timerProgress = Math.min((timer.elapsed / TIMED_TARGET_SECONDS) * 100, 100);
  const hasChecklistSuggestions = (practiceMeta.checklistSuggestions || []).length > 0;
  const hasCalmExercises = (practiceMeta.calmExercises || []).length > 0;

  const formatDurationLabel = (seconds) => {
    if (seconds === null || seconds === undefined) return null;
    const safeSeconds = Math.max(seconds, 0);
    const minutes = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    const minutePart = minutes > 0 ? `${minutes}m` : '';
    const secondPart = `${secs}s`;
    return `${minutePart}${minutePart ? ' ' : ''}${secondPart}`;
  };

  const formatTimerDisplay = (seconds) => {
    const safeSeconds = Math.max(seconds || 0, 0);
    const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
    const secs = (safeSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
  };

  const handleTimerControl = (action) => {
    if (action === 'start') {
      setTimer((prev) => ({ ...prev, running: true }));
    } else if (action === 'pause') {
      setTimer((prev) => ({ ...prev, running: false }));
    } else if (action === 'reset') {
      setTimer({ running: false, elapsed: 0 });
    }
  };

  const applyPracticeMetaFromResponse = (response, fallbackDuration = null) => {
    if (!response) return;
    setPracticeMeta({
      checklistSuggestions: response.virtual_checklist_suggestions || [],
      calmExercises: response.calm_exercises || [],
      timedDurationSeconds: response.practice_status?.last_duration_seconds
        ?? fallbackDuration
        ?? null,
    });
  };

  const openPracticeForm = (question) => {
    setActiveQuestionId(question.id);
    setResponseForm({
      written_response: question.practice_status?.written_response || '',
      practice_notes: question.practice_status?.practice_notes || '',
      star_response: {
        situation: question.practice_status?.star_response?.situation || '',
        task: question.practice_status?.star_response?.task || '',
        action: question.practice_status?.star_response?.action || '',
        result: question.practice_status?.star_response?.result || '',
      },
    });
    setCoachingResult(null);
    setCoachingError('');
    setCoachingLoading(false);
    setTimer({
      running: false,
      elapsed: question.practice_status?.last_duration_seconds || 0,
    });
    setShowPracticeModal(true);
  };

  const closePracticeModal = () => {
    setShowPracticeModal(false);
    setActiveQuestionId(null);
    setResponseForm(createResponseState());
    setCoachingResult(null);
    setCoachingError('');
    setCoachingLoading(false);
    setTimer({ running: false, elapsed: 0 });
    textareaRefs.current = {};
  };

  const handleResponseChange = (field, value) => {
    setResponseForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    requestAnimationFrame(() => {
      const el = textareaRefs.current[field];
      if (el) {
        el.style.height = 'auto';
        el.style.height = `${Math.max(el.scrollHeight, MIN_TEXTAREA_HEIGHT)}px`;
      }
    });
  };

  const handleStarFieldChange = (field, value) => {
    setResponseForm((prev) => ({
      ...prev,
      star_response: {
        ...prev.star_response,
        [field]: value,
      },
    }));
    requestAnimationFrame(() => {
      const el = textareaRefs.current[`star_${field}`];
      if (el) {
        el.style.height = 'auto';
        el.style.height = `${Math.max(el.scrollHeight, MIN_TEXTAREA_HEIGHT)}px`;
      }
    });
  };

  const handleViewHistory = async (question) => {
    if (!jobId) return;
    setLoadingHistory(true);
    try {
      const history = await jobsAPI.getQuestionPracticeHistory(jobId, question.id);
      setPracticeHistory(history);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Failed to load practice history:', error);
      // If no history found, show empty state
      setPracticeHistory(null);
      setShowHistoryModal(true);
    } finally {
      setLoadingHistory(false);
    }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setPracticeHistory(null);
  };

  const buildPracticePayload = () => {
    if (!activeQuestion) return null;
    return {
      question_id: activeQuestion.id,
      question_text: activeQuestion.prompt,
      category: activeQuestion.category,
      difficulty: activeQuestion.difficulty,
      skills: activeQuestion.skills,
      written_response: responseForm.written_response,
      star_response: responseForm.star_response,
      practice_notes: responseForm.practice_notes,
      timed_duration_seconds: timer.elapsed || null,
    };
  };

  const getTextareaRef = useCallback((field) => {
    if (!textareaRefHandlers.current[field]) {
      textareaRefHandlers.current[field] = (el) => {
        if (!el) {
          delete textareaRefs.current[field];
          return;
        }
        textareaRefs.current[field] = el;
        el.style.height = 'auto';
        el.style.height = `${Math.max(el.scrollHeight, MIN_TEXTAREA_HEIGHT)}px`;
      };
    }
    return textareaRefHandlers.current[field];
  }, []);

  const handleSubmitPractice = async () => {
    if (!activeQuestion || !onLogPractice) return;
    const payload = buildPracticePayload();
    if (!payload) return;

    try {
      const maybePromise = onLogPractice(payload);
      let result = maybePromise;
      if (maybePromise && typeof maybePromise.then === 'function') {
        result = await maybePromise;
      }
      if (result) {
        applyPracticeMetaFromResponse(result, payload.timed_duration_seconds);
      }
      closePracticeModal();
    } catch {
      // keep modal open if logging fails
    }
  };

  const handleGetCoaching = async () => {
    if (!jobId || !activeQuestion) return;
    const payload = buildPracticePayload();
    if (!payload) return;
    setCoachingLoading(true);
    setCoachingError('');
    try {
      const response = await jobsAPI.coachQuestionResponse(jobId, payload);
      setCoachingResult(response);
      if (response?.practice_status) {
        onPracticeStatusUpdate(activeQuestion.id, response.practice_status);
      }
      applyPracticeMetaFromResponse(response, payload.timed_duration_seconds);
    } catch (error) {
      setCoachingError(error?.message || 'Failed to generate coaching feedback.');
    } finally {
      setCoachingLoading(false);
    }
  };

  if (!bank) {
    return null;
  }

  return (
    <div className="education-form-card question-bank-card">
      <div className="form-header question-bank-header">
        <h3>
          <Icon name="layers" size="md" /> Role-Specific Question Bank
        </h3>
      </div>
      <div className="education-form question-bank-body">
        <p className="question-bank-subtitle">
          Curated for {bank.job_title} @ {bank.company_name}. Filter by category and difficulty to
          focus your written practice.
        </p>

        <div className="question-bank-controls">
          <div className="category-tabs">
            {bank.categories?.map((category) => (
              <button
                key={category.id}
                className={category.id === (selectedCategory?.id) ? 'active' : ''}
                onClick={() => setSelectedCategoryId(category.id)}
                type="button"
              >
                {category.label}
                <span>{category.questions.length}</span>
              </button>
            ))}
          </div>

          <div className="difficulty-filter">
            <label htmlFor="difficulty-select">Difficulty</label>
            <select
              id="difficulty-select"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
            >
              <option value="all">All levels</option>
              {(bank.difficulty_levels || []).map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedCategory?.guidance && (
          <div className="category-guidance">
            {selectedCategory.guidance}
          </div>
        )}

        {loading && (
          <div className="question-bank-loading">
            Loading question bank...
          </div>
        )}

        {!loading && filteredQuestions.length === 0 && (
          <div className="question-bank-empty">
            No questions match the selected difficulty.
          </div>
        )}

        <div className="question-grid">
          {filteredQuestions.map((question) => {
            const practiced = question.practice_status?.practiced;
            return (
              <div key={question.id} className="question-card">
                <div className="question-card-content">
                  <div className="question-card-header">
                    <span className={`difficulty-badge ${question.difficulty}`}>
                      {question.difficulty}
                    </span>
                    {practiced && (
                      <span className="practiced-pill">
                        <Icon name="check" size="sm" /> Practiced
                      </span>
                    )}
                  </div>
                  <p className="question-prompt">{question.prompt}</p>
                  {question.skills?.length > 0 && (
                    <div className="question-skills">
                      {question.skills.map((skill) => (
                        <span key={skill.skill_id || skill.name} className="skill-pill">
                          {skill.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {question.concepts?.length > 0 && (
                    <div className="question-concepts">
                      {question.concepts.map((concept) => (
                        <span key={concept} className="concept-pill">
                          {concept}
                        </span>
                      ))}
                    </div>
                  )}
                  {question.framework?.type === 'STAR' && (
                    <div className="question-framework">
                      <strong>STAR Focus:</strong>
                      <ul>
                        {Object.entries(question.framework.prompts).map(([key, value]) => (
                          <li key={key}>
                            <span>{key.toUpperCase()}:</span> {value}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="question-actions">
                  <div className="action-buttons">
                    <button
                      type="button"
                      className="add-education-button"
                      onClick={() => openPracticeForm(question)}
                    >
                      <Icon name="edit" size="sm" /> Log Practice
                    </button>
                    {question.practice_status?.last_practiced_at && (
                      <button
                        type="button"
                        className="view-history-button"
                        onClick={() => handleViewHistory(question)}
                        disabled={loadingHistory}
                      >
                        <Icon name="eye" size="sm" /> View History
                      </button>
                    )}
                  </div>
                  {question.practice_status?.last_practiced_at && (
                    <div className="last-practiced">
                      Last practiced:{' '}
                      {new Date(question.practice_status.last_practiced_at).toLocaleString()}
                      {question.practice_status.practice_count > 1 && (
                        <span className="practice-count"> ({question.practice_status.practice_count}x)</span>
                      )}
                    </div>
                  )}
                  {question.practice_status?.last_duration_seconds && (
                    <div className="timed-summary">
                      Timed response: {formatDurationLabel(question.practice_status.last_duration_seconds)}
                      {question.practice_status.total_duration_seconds > question.practice_status.last_duration_seconds && (
                        <span className="timed-total">
                          {' '}• Total {formatDurationLabel(question.practice_status.total_duration_seconds)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {(hasChecklistSuggestions || hasCalmExercises) && (
          <div className="practice-support-panels">
            {hasChecklistSuggestions && (
              <div className="practice-support-card">
                <div className="card-header">
                  <h4>
                    <Icon name="monitor" size="sm" /> Virtual Interview Checklist Boosters
                  </h4>
                  <p>Strengthen video-interview prep tasks surfaced from your latest practice.</p>
                </div>
                <div className="suggestion-list">
                  {practiceMeta.checklistSuggestions.map((suggestion) => (
                    <div key={suggestion.task_id} className="suggestion-item">
                      <div>
                        <span className="suggestion-category">{suggestion.category}</span>
                        <p className="suggestion-task">{suggestion.task}</p>
                        <p className="suggestion-tip">{suggestion.tip}</p>
                      </div>
                      <span
                        className={`suggestion-status ${suggestion.completed ? 'completed' : 'pending'}`}
                      >
                        {suggestion.completed ? 'Complete' : 'To-do'}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="suggestion-footer">
                  Review these items in the Interview Insights → Preparation Checklist to mark progress.
                </p>
              </div>
            )}
            {hasCalmExercises && (
              <div className="practice-support-card calm-card">
                <div className="card-header">
                  <h4>
                    <Icon name="activity" size="sm" /> Calm Confidence Exercises
                  </h4>
                  <p>Use these quick resets before or after a timed sprint to manage interview nerves.</p>
                </div>
                <div className="calm-exercise-list">
                  {practiceMeta.calmExercises.map((exercise) => (
                    <div key={exercise.id} className="calm-exercise-item">
                      <div className="calm-title-row">
                        <strong>{exercise.title}</strong>
                        {exercise.recommended_duration_seconds && (
                          <span className="calm-duration">
                            {formatDurationLabel(exercise.recommended_duration_seconds)}
                          </span>
                        )}
                      </div>
                      <p>{exercise.description}</p>
                      {exercise.tip && <p className="calm-tip">{exercise.tip}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {bank.star_framework && (
          <div className="star-panel">
            <h4>STAR Method Quick Reference</h4>
            <p>{bank.star_framework.overview}</p>
            <div className="star-steps">
              {bank.star_framework.steps?.map((step) => (
                <div key={step.id} className="star-step">
                  <span>{step.title}</span>
                  <p>{step.tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {bank.company_focus?.length > 0 && (
          <div className="company-focus-panel">
            <h4>Company-specific prompts</h4>
            <ul>
              {bank.company_focus.map((focus) => (
                <li key={focus.id}>{focus.prompt}</li>
              ))}
            </ul>
          </div>
        )}

        {showPracticeModal && activeQuestion && (
          <div className="practice-modal-backdrop">
            <div className="practice-modal" role="dialog" aria-modal="true">
              <div className="practice-modal-header">
                <div>
                  <h4>Practice: {activeQuestion.prompt}</h4>
                  <p>Capture your STAR-aligned response and save it to track progress.</p>
                </div>
                <button type="button" className="practice-modal-close" onClick={closePracticeModal}>
                  <Icon name="x" size="sm" />
                </button>
              </div>

              <div className="timed-practice-panel">
                <div>
                  <h5>Timed Writing Sprint</h5>
                  <p>Stay within a two-minute window to mirror live interview pacing.</p>
                </div>
                <div className="timer-display">
                  <div className="timer-value">{formatTimerDisplay(timer.elapsed)}</div>
                  <div className="timer-target">Target {formatTimerDisplay(TIMED_TARGET_SECONDS)}</div>
                  <div className="timer-progress-bar" aria-label="Timed writing progress">
                    <div className="timer-progress-fill" style={{ width: `${timerProgress}%` }} />
                  </div>
                  <div className="timer-controls">
                    <button type="button" onClick={() => handleTimerControl('start')} disabled={timer.running}>
                      <Icon name="play" size="sm" /> Start
                    </button>
                    <button type="button" onClick={() => handleTimerControl('pause')} disabled={!timer.running}>
                      <Icon name="pause" size="sm" /> Pause
                    </button>
                    <button type="button" onClick={() => handleTimerControl('reset')} disabled={timer.elapsed === 0 && !timer.running}>
                      <Icon name="rotate-ccw" size="sm" /> Reset
                    </button>
                  </div>
                </div>
              </div>

              <div className="practice-form">
                <textarea
                  rows={3}
                  placeholder="Overall summary or intro..."
                  value={responseForm.written_response}
                  onChange={(e) => handleResponseChange('written_response', e.target.value)}
                  ref={getTextareaRef('written_response')}
                />

                <div className="star-grid">
                  {['situation', 'task', 'action', 'result'].map((field) => (
                    <div key={field} className="star-field">
                      <label htmlFor={`star-${field}`}>{field.toUpperCase()}</label>
                      <textarea
                        id={`star-${field}`}
                        rows={2}
                        value={responseForm.star_response[field]}
                        onChange={(e) => handleStarFieldChange(field, e.target.value)}
                        ref={getTextareaRef(`star_${field}`)}
                      />
                    </div>
                  ))}
                </div>

                <textarea
                  rows={2}
                  placeholder="Reflection or follow-up notes..."
                  value={responseForm.practice_notes}
                  onChange={(e) => handleResponseChange('practice_notes', e.target.value)}
                  ref={getTextareaRef('practice_notes')}
                />
              </div>

              <div className="coaching-panel">
                <div className="coaching-panel-header">
                  <div>
                    <h5>AI Response Coaching</h5>
                    <p>Get instant feedback on content, structure, clarity, and STAR balance.</p>
                  </div>
                  <button
                    type="button"
                    className="generate-coaching-button"
                    onClick={handleGetCoaching}
                    disabled={!canRequestCoaching || coachingLoading}
                  >
                    {coachingLoading ? 'Analyzing…' : 'Get AI Coaching'}
                  </button>
                </div>
                {!canRequestCoaching && (
                  <div className="coaching-hint">Add a summary or STAR breakdown to enable AI feedback.</div>
                )}
                {coachingError && <div className="coaching-error-banner">{coachingError}</div>}
                {coachingData && (
                  <div className="coaching-results">
                    <p className="coaching-summary-text">{coachingData.summary}</p>
                    <div className="coaching-scores">
                      {SCORE_KEYS.filter((key) => coachingData.scores?.[key] !== undefined).map((key) => (
                        <div key={key} className={`coaching-score-pill ${key === 'overall' ? 'overall' : ''}`}>
                          <span>{key}</span>
                          <strong>{coachingData.scores[key]}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="coaching-length-grid">
                      <div className="coaching-length-card">
                        <span>Word count</span>
                        <strong>{coachingData.length_analysis?.word_count ?? '—'}</strong>
                        <small>
                          ~{coachingData.length_analysis?.spoken_time_seconds ?? '—'}s spoken
                        </small>
                      </div>
                      <div className="coaching-length-card">
                        <span>Target window</span>
                        <strong>{coachingData.length_analysis?.recommended_window || '90-120s'}</strong>
                        <small>{coachingData.length_analysis?.recommendation || 'Keep pacing balanced.'}</small>
                      </div>
                    </div>
                    <div className="coaching-feedback-grid">
                      <div className="coaching-feedback-block">
                        <h6>Content</h6>
                        <ul>
                          {(coachingData.feedback?.content || []).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="coaching-feedback-block">
                        <h6>Structure</h6>
                        <ul>
                          {(coachingData.feedback?.structure || []).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="coaching-feedback-block">
                        <h6>Clarity</h6>
                        <ul>
                          {(coachingData.feedback?.clarity || []).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {coachingData.star_adherence && (
                      <div className="coaching-star-grid">
                        {['situation', 'task', 'action', 'result'].map((key) => (
                          <div key={key} className={`coaching-star-card status-${coachingData.star_adherence[key]?.status || 'missing'}`}>
                            <span>{key.toUpperCase()}</span>
                            <p>{coachingData.star_adherence[key]?.feedback}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {coachingData.weak_language?.patterns?.length > 0 && (
                      <div className="coaching-weak-language">
                        <h6>Weak Language</h6>
                        <div className="weak-language-list">
                          {coachingData.weak_language.patterns.map((pattern) => (
                            <div key={`${pattern.phrase}-${pattern.issue}`} className="weak-language-chip">
                              <strong>{pattern.phrase}</strong>
                              <span>{pattern.issue}</span>
                              <em>{pattern.replacement}</em>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {coachingData.alternative_approaches?.length > 0 && (
                      <div className="coaching-alt-list">
                        <h6>Alternative Approaches</h6>
                        {coachingData.alternative_approaches.map((approach) => (
                          <div key={approach.label} className="alt-approach-card">
                            <strong>{approach.label}</strong>
                            <p>{approach.description}</p>
                            {approach.sample_opening && <em>{approach.sample_opening}</em>}
                          </div>
                        ))}
                      </div>
                    )}
                    {improvementSummary && (
                      <div className="coaching-trend">
                        <div className="trend-metrics">
                          <div>
                            <span>Sessions coached</span>
                            <strong>{improvementSummary.session_count}</strong>
                          </div>
                          <div>
                            <span>Overall delta</span>
                            <strong>{improvementSummary.delta?.overall ? `${improvementSummary.delta.overall > 0 ? '+' : ''}${improvementSummary.delta.overall}` : '—'}</strong>
                          </div>
                        </div>
                        {coachingHistory.length > 0 && (
                          <div className="coaching-history-list">
                            {coachingHistory.map((entry) => {
                              const stamp = entry.created_at ? new Date(entry.created_at) : null;
                              return (
                                <div key={entry.id || entry.created_at} className="coaching-history-item">
                                  <div>
                                    <span>{stamp ? stamp.toLocaleDateString() : '—'}</span>
                                    <small>{stamp ? stamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</small>
                                  </div>
                                  <strong>{entry.scores?.overall ?? '—'}</strong>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="practice-modal-actions">
                <button type="button" className="cancel-button" onClick={closePracticeModal}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="save-button"
                  onClick={handleSubmitPractice}
                  disabled={savingQuestionId === activeQuestion.id}
                >
                  {savingQuestionId === activeQuestion.id ? 'Saving...' : 'Save Practice'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Practice History Modal */}
        {showHistoryModal && (
          <div className="practice-modal-backdrop">
            <div className="practice-modal history-modal" role="dialog" aria-modal="true">
              <div className="practice-modal-header">
                <div>
                  <h4>
                    <Icon name="clock" size="sm" /> Practice History
                  </h4>
                  {practiceHistory && (
                    <p>Practiced {practiceHistory.practice_count} time{practiceHistory.practice_count > 1 ? 's' : ''}</p>
                  )}
                </div>
                <button type="button" className="practice-modal-close" onClick={closeHistoryModal}>
                  <Icon name="x" size="sm" />
                </button>
              </div>

              {practiceHistory ? (
                <div className="history-content">
                  <div className="history-section">
                    <h5>Question</h5>
                    <p>{practiceHistory.question_text}</p>
                  </div>

                  {practiceHistory.written_response && (
                    <div className="history-section">
                      <h5>Your Response</h5>
                      <p className="response-text">{practiceHistory.written_response}</p>
                    </div>
                  )}

                  {practiceHistory.star_response && Object.values(practiceHistory.star_response).some(v => v) && (
                    <div className="history-section">
                      <h5>STAR Method Response</h5>
                      <div className="star-history-grid">
                        {['situation', 'task', 'action', 'result'].map((field) => (
                          practiceHistory.star_response[field] && (
                            <div key={field} className="star-history-field">
                              <strong>{field.toUpperCase()}:</strong>
                              <p>{practiceHistory.star_response[field]}</p>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {practiceHistory.practice_notes && (
                    <div className="history-section">
                      <h5>Practice Notes</h5>
                      <p className="notes-text">{practiceHistory.practice_notes}</p>
                    </div>
                  )}
                  {(practiceHistory.last_duration_seconds || practiceHistory.total_duration_seconds) && (
                    <div className="history-section">
                      <h5>Timed Sprint Metrics</h5>
                      <div className="timed-history-grid">
                        {practiceHistory.last_duration_seconds && (
                          <div>
                            <strong>Last session</strong>
                            <p>{formatDurationLabel(practiceHistory.last_duration_seconds)}</p>
                          </div>
                        )}
                        {practiceHistory.total_duration_seconds && (
                          <div>
                            <strong>Total logged</strong>
                            <p>{formatDurationLabel(practiceHistory.total_duration_seconds)}</p>
                          </div>
                        )}
                        {practiceHistory.average_duration_seconds && (
                          <div>
                            <strong>Average</strong>
                            <p>{formatDurationLabel(practiceHistory.average_duration_seconds)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {practiceHistory.coaching_history?.length > 0 && (
                    <div className="history-section">
                      <h5>AI Coaching Timeline</h5>
                      <div className="history-coaching-list">
                        {practiceHistory.coaching_history.map((entry) => {
                          const stamp = entry.created_at ? new Date(entry.created_at) : null;
                          return (
                            <div key={entry.id || entry.created_at} className="history-coaching-item">
                              <div>
                                <span>{stamp ? stamp.toLocaleDateString() : '—'}</span>
                                <small>{stamp ? stamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</small>
                              </div>
                              <div className="history-coaching-score">
                                <strong>{entry.scores?.overall ?? '—'}</strong>
                                <span>overall</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="history-meta">
                    <div><strong>First practiced:</strong> {new Date(practiceHistory.first_practiced_at).toLocaleString()}</div>
                    <div><strong>Last practiced:</strong> {new Date(practiceHistory.last_practiced_at).toLocaleString()}</div>
                    <div><strong>Practice count:</strong> {practiceHistory.practice_count}</div>
                  </div>
                </div>
              ) : (
                <div className="no-history">
                  <Icon name="inbox" size="lg" />
                  <p>No practice history found for this question.</p>
                </div>
              )}

              <div className="practice-modal-actions">
                <button type="button" className="save-button" onClick={closeHistoryModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleQuestionBank;
