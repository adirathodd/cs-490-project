import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../common/Icon';
import { jobsAPI } from '../../services/api';
import './RoleQuestionBank.css';

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
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [responseForm, setResponseForm] = useState(() => createResponseState());
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (bank?.categories?.length) {
      const exists = bank.categories.find((cat) => cat.id === selectedCategoryId);
      if (!exists) {
        setSelectedCategoryId(bank.categories[0].id);
      }
    }
  }, [bank, selectedCategoryId]);

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
    setShowPracticeModal(true);
  };

  const closePracticeModal = () => {
    setShowPracticeModal(false);
    setActiveQuestionId(null);
    setResponseForm(createResponseState());
  };

  const handleResponseChange = (field, value) => {
    setResponseForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleStarFieldChange = (field, value) => {
    setResponseForm((prev) => ({
      ...prev,
      star_response: {
        ...prev.star_response,
        [field]: value,
      },
    }));
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

  const handleSubmitPractice = async () => {
    if (!activeQuestion || !onLogPractice) return;
    const payload = {
      question_id: activeQuestion.id,
      question_text: activeQuestion.prompt,
      category: activeQuestion.category,
      difficulty: activeQuestion.difficulty,
      skills: activeQuestion.skills,
      written_response: responseForm.written_response,
      star_response: responseForm.star_response,
      practice_notes: responseForm.practice_notes,
    };

    try {
      const maybePromise = onLogPractice(payload);
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise;
      }
      closePracticeModal();
    } catch {
      // keep modal open if logging fails
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
                </div>
              </div>
            );
          })}
        </div>

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

              <div className="practice-form">
                <textarea
                  rows={3}
                  placeholder="Overall summary or intro..."
                  value={responseForm.written_response}
                  onChange={(e) => handleResponseChange('written_response', e.target.value)}
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
                      />
                    </div>
                  ))}
                </div>

                <textarea
                  rows={2}
                  placeholder="Reflection or follow-up notes..."
                  value={responseForm.practice_notes}
                  onChange={(e) => handleResponseChange('practice_notes', e.target.value)}
                />
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
