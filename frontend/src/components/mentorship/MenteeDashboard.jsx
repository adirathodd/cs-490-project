import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { mentorshipAPI } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import ConfirmDialog from '../common/ConfirmDialog';
import Toast from '../common/Toast';
import './MentorshipDashboard.css';

const goalTypeOptions = [
  { value: 'applications_submitted', label: 'Job applications submitted' },
  { value: 'skills_added', label: 'Skills added' },
  { value: 'projects_completed', label: 'Projects completed' },
  { value: 'skill_add', label: 'Add a specific skill' },
  { value: 'skill_improve', label: 'Improve an existing skill' },
  { value: 'interview_practice', label: 'Interview practice questions' },
];

const skillLevelOptions = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
];

const degreeTypeLabels = {
  hs: 'High School',
  aa: 'Associate',
  ba: 'Bachelor',
  bs: 'Bachelor',
  ma: 'Master',
  ms: 'Master',
  mba: 'MBA',
  phd: 'PhD',
  cert: 'Certificate',
  boot: 'Bootcamp',
};

const defaultGoalForm = {
  goal_type: 'applications_submitted',
  title: '',
  target_value: 5,
  due_date: '',
  notes: '',
  custom_skill_name: '',
  required_level: 'intermediate',
  starting_level: '',
};

const formatSkillName = (skill) => {
  if (!skill) return 'Skill';
  return (
    skill.skill_name ||
    skill.name ||
    skill.skill ||
    skill?.skill?.name ||
    'Skill'
  );
};

const formatSkillMeta = (skill) => {
  if (!skill) return '';
  const parts = [];
  if (skill.level) {
    const capitalized = skill.level.charAt(0).toUpperCase() + skill.level.slice(1);
    parts.push(capitalized);
  }
  if (typeof skill.years === 'number') {
    const years = skill.years;
    const label = `${years} yr${years === 1 ? '' : 's'} experience`;
    parts.push(label);
  }
  return parts.join(' | ');
};

const formatDateLabel = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

const formatDateFull = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const getJobDateRange = (job) => {
  if (!job) return '';
  if (job.formatted_dates) {
    return job.formatted_dates;
  }
  const start = formatDateLabel(job.start_date);
  const end = job.is_current ? 'Present' : formatDateLabel(job.end_date);
  if (start && end) {
    return `${start} - ${end}`;
  }
  return start || end || '';
};

const normalizeHighlights = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const getDegreeLabel = (value) => {
  if (!value) return '';
  const key = typeof value === 'string' ? value.toLowerCase() : value;
  return degreeTypeLabels[key] || value;
};

const formatTiming = (days) => {
  if (days == null) return 'No data';
  if (days >= 1) return `${days} days`;
  return `${(days * 24).toFixed(1)} hrs`;
};

const formatStageLabel = (value) => {
  if (!value) return '';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatEducationDates = (edu) => {
  if (!edu) return 'Dates not provided';
  const start = formatDateLabel(edu.start_date);
  const end = edu.currently_enrolled ? 'Present' : formatDateLabel(edu.graduation_date || edu.end_date);
  if (start && end) return `${start} → ${end}`;
  if (start || end) return start || end;
  return 'Dates not provided';
};

const goalTypeLabels = goalTypeOptions.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const isSkillGoalType = (goalType) => goalType === 'skill_add' || goalType === 'skill_improve';

const capitalizeWord = (value) => {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const MentorshipMenteeDashboard = () => {
  const { teamMemberId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null, title: '', variant: 'danger' });
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'info' });
  const [goalForm, setGoalForm] = useState(defaultGoalForm);
  const [goalSubmitting, setGoalSubmitting] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [goalsRefreshing, setGoalsRefreshing] = useState(false);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState('');
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');
  const chatLogRef = useRef(null);

  const refreshGoals = useCallback(() => {
    setGoalsRefreshing(true);
    mentorshipAPI
      .getGoals(teamMemberId)
      .then((response) => {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            goals: response.goals || [],
            goal_summary: response.goal_summary || {},
          };
        });
        setGoalError('');
      })
      .catch((err) => {
        const fallback = err?.error?.message || err?.message || 'Unable to refresh mentorship goals.';
        setGoalError(fallback);
      })
      .finally(() => {
        setGoalsRefreshing(false);
      });
  }, [teamMemberId]);

  const fetchMessages = useCallback(
    (options = {}) => {
      if (!teamMemberId) return;
      if (!options.silent) setMessagesLoading(true);
      mentorshipAPI
        .getMessages(teamMemberId, { limit: 100 })
        .then((response) => {
          setMessages(response?.messages || []);
          setMessagesError('');
        })
        .catch((err) => {
          const fallback = err?.error?.message || err?.message || 'Unable to load messages.';
          setMessagesError(fallback);
        })
        .finally(() => {
          if (!options.silent) setMessagesLoading(false);
        });
    },
    [teamMemberId]
  );

  const fetchProgressReport = useCallback(() => {
    setReportLoading(true);
    mentorshipAPI
      .getProgressReport(teamMemberId)
      .then((response) => {
        setReport(response);
        setReportError('');
      })
      .catch((err) => {
        const fallback = err?.error?.message || err?.message || 'Unable to load progress report.';
        setReportError(fallback);
      })
      .finally(() => setReportLoading(false));
  }, [teamMemberId]);

  const fetchAnalytics = useCallback(() => {
    if (!teamMemberId) return;
    setAnalyticsLoading(true);
    mentorshipAPI
      .getAnalytics(teamMemberId)
      .then((response) => {
        setAnalytics(response || {});
        setAnalyticsError('');
      })
      .catch((err) => {
        const fallback = err?.error?.message || err?.message || 'Unable to load mentee analytics.';
        setAnalyticsError(fallback);
      })
      .finally(() => setAnalyticsLoading(false));
  }, [teamMemberId]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');
    mentorshipAPI
      .getSharedData(teamMemberId)
      .then((response) => {
        if (!isMounted) return;
        setData(response);
        setError('');
      })
      .catch((err) => {
        if (!isMounted) return;
        const fallback = err?.error?.message || err?.message || 'Unable to load shared data.';
        setError(fallback);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [teamMemberId]);

  useEffect(() => {
    fetchProgressReport();
  }, [fetchProgressReport]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => {
      fetchMessages({ silent: true });
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages]);

  const handleGoalInputChange = (field, value) => {
    setGoalForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleGoalTypeChange = (value) => {
    setGoalForm({
      ...defaultGoalForm,
      goal_type: value,
    });
  };

  const handleGoalSubmit = (event) => {
    event.preventDefault();
    if (goalSubmitting) return;
    setGoalSubmitting(true);
    setGoalError('');

    const payload = {
      goal_type: goalForm.goal_type,
    };
    if (goalForm.title.trim()) {
      payload.title = goalForm.title.trim();
    }
    if (goalForm.notes.trim()) {
      payload.notes = goalForm.notes.trim();
    }
    if (goalForm.due_date) {
      payload.due_date = goalForm.due_date;
    }

    if (goalForm.goal_type === 'applications_submitted' || goalForm.goal_type === 'skills_added' || goalForm.goal_type === 'projects_completed') {
      payload.target_value = Number(goalForm.target_value || 0);
    }

    if (isSkillGoalType(goalForm.goal_type)) {
      if (goalForm.custom_skill_name.trim()) {
        payload.custom_skill_name = goalForm.custom_skill_name.trim();
      }
      if (goalForm.required_level) {
        payload.required_level = goalForm.required_level;
      }
      if (goalForm.goal_type === 'skill_improve' && goalForm.starting_level) {
        payload.starting_level = goalForm.starting_level;
      }
    }

    Object.keys(payload).forEach((key) => {
      if (payload[key] === '' || payload[key] === undefined) {
        delete payload[key];
      }
    });

    mentorshipAPI
      .createGoal(teamMemberId, payload)
      .then(() => {
        setGoalForm((prev) => ({
          ...defaultGoalForm,
          goal_type: prev.goal_type,
        }));
        setGoalError('');
        refreshGoals();
      })
      .catch((err) => {
        const fallback = err?.error?.message || err?.message || 'Unable to save mentorship goal.';
        setGoalError(fallback);
      })
      .finally(() => {
        setGoalSubmitting(false);
      });
  };

  const handleGoalStatusChange = (goalId, status) => {
    setGoalError('');
    mentorshipAPI
      .updateGoal(goalId, { status })
      .then(() => {
        refreshGoals();
      })
      .catch((err) => {
        const fallback = err?.error?.message || err?.message || 'Unable to update goal.';
        setGoalError(fallback);
      });
  };

  const handleGoalDelete = (goalId) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Goal',
      message: 'Delete this mentorship goal?',
      variant: 'danger',
      onConfirm: () => {
        setGoalError('');
        mentorshipAPI
          .deleteGoal(goalId)
          .then(() => {
            refreshGoals();
            setToast({ isOpen: true, message: 'Goal deleted successfully', type: 'success' });
          })
          .catch((err) => {
            const fallback = err?.error?.message || err?.message || 'Unable to delete goal.';
            setGoalError(fallback);
          });
      }
    });
  };

  const handleSendMessage = (event) => {
    event.preventDefault();
    if (!newMessage.trim() || sendingMessage) return;
    setSendingMessage(true);
    setMessagesError('');
    mentorshipAPI
      .sendMessage(teamMemberId, { message: newMessage.trim() })
      .then((response) => {
        setNewMessage('');
        setMessages((prev) => [...prev, response]);
        setMessagesError('');
      })
      .catch((err) => {
        const fallback = err?.error?.message || err?.message || 'Unable to send message.';
        setMessagesError(fallback);
      })
      .finally(() => {
        setSendingMessage(false);
      });
  };

  if (loading) {
    return (
      <div className="mentorship-page mentorship-page--loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mentorship-page mentorship-page--loading">
        <div className="mentorship-alert mentorship-alert--error">{error}</div>
        <button type="button" className="mentorship-btn mentorship-btn--ghost" onClick={() => navigate('/mentorship')}>
          &larr; Back to Mentorship
        </button>
      </div>
    );
  }

  const sections = data?.sections || {};
  const jobApplications = data?.job_applications || [];
  const jobMode = data?.job_sharing_mode || 'none';
  const documents = data?.documents || [];
  const goals = data?.goals || [];
  const goalSummary = data?.goal_summary || {};
  const viewerRole = data?.viewer_role || 'mentor';
  const isMentorView = viewerRole === 'mentor';
  const showTargetInput = ['applications_submitted', 'skills_added', 'projects_completed', 'interview_practice'].includes(goalForm.goal_type);
  const showSkillFields = isSkillGoalType(goalForm.goal_type);
  const showStartingLevel = goalForm.goal_type === 'skill_improve';
  const reportWindowLabel = report ? `${formatDateFull(report.window_start)} → ${formatDateFull(report.window_end)}` : '';

  const openPreview = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mentorship-page mentorship-mentee-dashboard">
      <div className="mentorship-mentee-dashboard__header">
        <button type="button" className="mentorship-btn mentorship-btn--ghost" onClick={() => navigate('/mentorship')}>
          &larr; Back to Mentorship
        </button>
        <div>
          <p className="mentorship-hero__eyebrow">Mentee Overview</p>
          <h1>{data?.mentee?.full_name || 'Mentee Dashboard'}</h1>
          <p>Viewing the sections and job applications this mentee decided to share.</p>
        </div>
      </div>

      <section className="mentorship-card mentorship-mentee-section mentorship-progress-card">
        <div className="mentorship-progress-card__header">
          <div>
            <p className="mentorship-card__eyebrow">Weekly snapshot</p>
            <h3>Progress report</h3>
            {report && (
              <p className="muted">
                {report.window_days} day window {reportWindowLabel ? `(${reportWindowLabel})` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            className="mentorship-btn mentorship-btn--ghost"
            onClick={fetchProgressReport}
            disabled={reportLoading}
          >
            {reportLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {reportError && <div className="mentorship-alert mentorship-alert--error">{reportError}</div>}
        {reportLoading ? (
          <div className="mentorship-progress-loading">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="mentorship-progress-grid">
            <div className="mentorship-progress-item">
              <h4>Jobs</h4>
              <p>New applications: <strong>{report?.jobs?.new_count || 0}</strong></p>
              <p>Responses: <strong>{report?.jobs?.responses_count || 0}</strong></p>
              {report?.jobs?.new_applications?.length > 0 && (
                <div>
                  <p className="mentorship-progress-subtitle">Recent submissions</p>
                  <ul className="mentorship-progress-list">
                    {report.jobs.new_applications.slice(0, 3).map((job) => (
                      <li key={`job-new-${job.id || job.job_id}`}>
                        {job?.title || job?.job?.title} @ {job?.company_name || job?.job?.company_name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="mentorship-progress-item">
              <h4>Projects</h4>
              <p>Created: <strong>{report?.projects?.created_count || 0}</strong></p>
              <p>Completed: <strong>{report?.projects?.completed_count || 0}</strong></p>
              {report?.projects?.completed?.length > 0 && (
                <div>
                  <p className="mentorship-progress-subtitle">Completed</p>
                  <ul className="mentorship-progress-list">
                    {report.projects.completed.slice(0, 3).map((project) => (
                      <li key={`project-completed-${project.id}`}>
                        {project.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="mentorship-progress-item">
              <h4>Goals</h4>
              <p>Created: <strong>{report?.goals?.created_count || 0}</strong></p>
              <p>Completed: <strong>{report?.goals?.completed_count || 0}</strong></p>
              {report?.goals?.completed?.length > 0 && (
                <div>
                  <p className="mentorship-progress-subtitle">Completed goals</p>
                  <ul className="mentorship-progress-list">
                    {report.goals.completed.slice(0, 3).map((goal) => (
                      <li key={`goal-completed-${goal.id}`}>
                        {goal.title || goalTypeLabels[goal.goal_type] || 'Goal'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="mentorship-progress-item mentorship-progress-item--wide">
              <h4>Interview practice</h4>
              <p>Questions practiced: <strong>{report?.interview_practice?.questions_practiced || 0}</strong></p>
              <p>Average score: <strong>{report?.interview_practice?.average_score ?? 'N/A'}</strong></p>
              {report?.interview_practice?.entries?.length > 0 && (
                <div>
                  <p className="mentorship-progress-subtitle">Recent sessions</p>
                  <ul className="mentorship-progress-list">
                    {report.interview_practice.entries.map((session, idx) => (
                      <li key={`session-${idx}`}>
                        {formatDateFull(session.created_at)} · {session.question}
                        {typeof session.score === 'number' && ` • Score ${session.score}`}
                        {session.job_title && ` • ${session.job_title}`}
                        {session.company_name && ` @ ${session.company_name}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mentorship-card mentorship-chat-card">
        <div className="mentorship-chat-card__header">
          <div>
            <p className="mentorship-card__eyebrow">Secure chat</p>
            <h3>Mentor conversation</h3>
          </div>
          <button
            type="button"
            className="mentorship-btn mentorship-btn--ghost"
            onClick={() => fetchMessages()}
            disabled={messagesLoading && messages.length === 0}
          >
            {messagesLoading && messages.length === 0 ? 'Loading…' : 'Refresh chat'}
          </button>
        </div>
        {messagesError && <div className="mentorship-alert mentorship-alert--error">{messagesError}</div>}
        <div className="mentorship-chat-log" ref={chatLogRef}>
          {messagesLoading && messages.length === 0 ? (
            <div className="mentorship-chat-loading">
              <LoadingSpinner />
            </div>
          ) : messages.length === 0 ? (
            <p className="mentorship-empty">No messages yet. Start the conversation!</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`mentorship-chat-message ${msg.is_own ? 'mentorship-chat-message--own' : ''}`}
              >
                <div className="mentorship-chat-message__bubble">
                  <p>{msg.message}</p>
                </div>
                <span className="mentorship-chat-message__meta">
                  {(msg.is_own && 'You') ||
                    msg.sender?.full_name ||
                    msg.sender?.email ||
                    (msg.is_own ? 'You' : 'Mentor')}{' '}
                  · {formatDateFull(msg.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
        <form className="mentorship-chat-form" onSubmit={handleSendMessage}>
          <textarea
            rows={3}
            placeholder={isMentorView ? 'Send a note to your mentee…' : 'Send a note to your mentor…'}
            value={newMessage}
            onChange={(event) => setNewMessage(event.target.value)}
          />
          <div className="mentorship-chat-form__actions">
            <button type="submit" className="mentorship-btn mentorship-btn--primary" disabled={sendingMessage}>
              {sendingMessage ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </form>
      </section>

      <section className="mentorship-card mentorship-mentee-section">
        <div className="mentorship-section-header">
          <div>
            <p className="mentorship-card__eyebrow">Applications</p>
            <h3>Mentee funnel & timing</h3>
          </div>
          <button
            type="button"
            className="mentorship-btn mentorship-btn--ghost"
            onClick={fetchAnalytics}
            disabled={analyticsLoading}
          >
            {analyticsLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {analyticsError && <div className="mentorship-alert mentorship-alert--error">{analyticsError}</div>}
        {!analytics && analyticsLoading && <LoadingSpinner />}
        {analytics && (
          <>
            <div className="mentorship-analytics-grid">
              <div className="mentorship-analytic-card">
                <p className="mentorship-card__eyebrow">Funnel</p>
                <h4>{analytics.funnel_analytics?.total_applications || 0} applications</h4>
                <div className="mentorship-funnel-stats">
                  {Object.entries(analytics.funnel_analytics?.status_breakdown || {}).map(([key, val]) => (
                    <div key={key} className="mentorship-funnel-row">
                      <span className="muted">{formatStageLabel(key)}</span>
                      <span>{val}</span>
                    </div>
                  ))}
                </div>
                <div className="mentorship-funnel-rates">
                  <span>Response {analytics.funnel_analytics?.response_rate || 0}%</span>
                  <span>Interview {analytics.funnel_analytics?.interview_rate || 0}%</span>
                  <span>Offer {analytics.funnel_analytics?.offer_rate || 0}%</span>
                </div>
              </div>
              <div className="mentorship-analytic-card">
                <p className="mentorship-card__eyebrow">Stage timing</p>
                <ul className="mentorship-timing-list">
                  <li>
                    <span>Application → Response</span>
                    <strong>{formatTiming(analytics.time_to_response?.avg_application_to_response_days)}</strong>
                  </li>
                  <li>
                    <span>Application → Interview</span>
                    <strong>{formatTiming(analytics.time_to_response?.avg_application_to_interview_days)}</strong>
                  </li>
                  <li>
                    <span>Interview → Offer</span>
                    <strong>{formatTiming(analytics.time_to_response?.avg_interview_to_offer_days)}</strong>
                  </li>
                </ul>
              </div>
              <div className="mentorship-analytic-card">
                <p className="mentorship-card__eyebrow">Practice engagement</p>
                <div className="mentorship-practice-stats">
                  <div>
                    <p className="muted">Sessions (30d)</p>
                    <h4>{analytics.practice_engagement?.total_sessions || 0}</h4>
                  </div>
                  <div>
                    <p className="muted">Last 7d</p>
                    <h4>{analytics.practice_engagement?.last_7_days || 0}</h4>
                  </div>
                  <div>
                    <p className="muted">Avg score</p>
                    <h4>{analytics.practice_engagement?.average_score ?? '—'}</h4>
                  </div>
                </div>
                {analytics.practice_engagement?.focus_categories?.length > 0 && (
                  <div className="mentorship-practice-focus">
                    <p className="muted">Focus areas</p>
                    <ul>
                      {analytics.practice_engagement.focus_categories.map((cat) => (
                        <li key={cat.category}>
                          {formatStageLabel(cat.category)} — {cat.average_score ?? '—'} avg ({cat.count} sessions)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            {analytics.practice_recommendations?.length > 0 && (
              <div className="mentorship-analytic-card mentorship-analytic-card--full">
                <p className="mentorship-card__eyebrow">Practice recommendations</p>
                <ul className="mentorship-recommendations">
                  {analytics.practice_recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      <section className="mentorship-card mentorship-mentee-section mentorship-goals-card">
        <div className="mentorship-goals-card__header">
          <div>
            <p className="mentorship-card__eyebrow">Accountability</p>
            <h3>Mentorship goals</h3>
            <p className="muted">
              Active: {goalSummary.active || 0} · Completed: {goalSummary.completed || 0}
            </p>
          </div>
          <div className="mentorship-goals-card__actions">
            <button
              type="button"
              className="mentorship-btn mentorship-btn--ghost"
              onClick={refreshGoals}
              disabled={goalsRefreshing}
            >
              {goalsRefreshing ? 'Refreshing…' : 'Refresh goals'}
            </button>
          </div>
        </div>

        {goalError && <div className="mentorship-alert mentorship-alert--error">{goalError}</div>}

        {goals.length === 0 ? (
          <p className="mentorship-empty">No mentorship goals yet.</p>
        ) : (
          <ul className="mentorship-goals-list">
            {goals.map((goal) => (
              <li key={goal.id} className="mentorship-goal">
                <div className="mentorship-goal__header">
                  <div>
                    <p className="mentorship-goal__title">
                      {goal.title || goalTypeLabels[goal.goal_type] || 'Goal'}
                    </p>
                    <p className="mentorship-goal__subtitle">
                      {goalTypeLabels[goal.goal_type] || goal.goal_type}
                      {goal.skill_name ? ` · ${goal.skill_name}` : ''}
                    </p>
                  </div>
                  <span className={`mentorship-goal__status mentorship-goal__status--${goal.status}`}>
                    {capitalizeWord(goal.status)}
                  </span>
                </div>

                <div className="mentorship-goal__progress">
                  <div className="mentorship-goal__progress-track">
                    <div
                      className="mentorship-goal__progress-value"
                      style={{ width: `${goal.progress_percent || 0}%` }}
                    />
                  </div>
                  <span className="mentorship-goal__progress-label">
                    {goal.progress_value || 0}/{goal.progress_target || goal.target_value || 0}
                  </span>
                </div>

                <div className="mentorship-goal__meta">
                  {goal.due_date && <span>Due {formatDateLabel(goal.due_date)}</span>}
                  {goal.goal_type === 'skill_improve' && (
                    <span>
                      Target level: {capitalizeWord(goal.required_level) || 'N/A'}
                      {goal.current_level ? ` · Current: ${capitalizeWord(goal.current_level)}` : ''}
                    </span>
                  )}
                  {goal.goal_type === 'skill_add' && goal.required_level && (
                    <span>Minimum level: {capitalizeWord(goal.required_level)}</span>
                  )}
                  {goal.notes && <span>Notes: {goal.notes}</span>}
                </div>

                {isMentorView && (
                  <div className="mentorship-goal__actions">
                    {goal.status === 'active' && (
                      <>
                        <button type="button" onClick={() => handleGoalStatusChange(goal.id, 'completed')}>
                          Mark complete
                        </button>
                        <button type="button" onClick={() => handleGoalStatusChange(goal.id, 'cancelled')}>
                          Cancel
                        </button>
                      </>
                    )}
                    {goal.status !== 'active' && (
                      <button type="button" onClick={() => handleGoalStatusChange(goal.id, 'active')}>
                        Reopen
                      </button>
                    )}
                    <button
                      type="button"
                      className="mentorship-link mentorship-link--danger"
                      onClick={() => handleGoalDelete(goal.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {isMentorView && (
          <form className="mentorship-goal-form" onSubmit={handleGoalSubmit}>
            <div className="mentorship-form__field">
              <label htmlFor="goal-type">Goal type</label>
              <select
                id="goal-type"
                value={goalForm.goal_type}
                onChange={(event) => handleGoalTypeChange(event.target.value)}
              >
                {goalTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mentorship-form__field">
              <label htmlFor="goal-title">Goal title</label>
              <input
                id="goal-title"
                type="text"
                placeholder="Optional custom title"
                value={goalForm.title}
                onChange={(event) => handleGoalInputChange('title', event.target.value)}
              />
            </div>

            {showTargetInput && (
              <div className="mentorship-form__field">
                <label htmlFor="goal-target">Target value</label>
                <input
                  id="goal-target"
                  type="number"
                  min="1"
                  value={goalForm.target_value}
                  onChange={(event) => handleGoalInputChange('target_value', event.target.value)}
                />
              </div>
            )}

            {showSkillFields && (
              <>
                <div className="mentorship-form__field">
                  <label htmlFor="goal-skill-name">Skill</label>
                  <input
                    id="goal-skill-name"
                    type="text"
                    placeholder="e.g., Python"
                    value={goalForm.custom_skill_name}
                    onChange={(event) => handleGoalInputChange('custom_skill_name', event.target.value)}
                  />
                </div>
                <div className="mentorship-form__field">
                  <label htmlFor="goal-required-level">Target level</label>
                  <select
                    id="goal-required-level"
                    value={goalForm.required_level}
                    onChange={(event) => handleGoalInputChange('required_level', event.target.value)}
                  >
                    {skillLevelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {showStartingLevel && (
                  <div className="mentorship-form__field">
                    <label htmlFor="goal-starting-level">Current level (optional)</label>
                    <select
                      id="goal-starting-level"
                      value={goalForm.starting_level}
                      onChange={(event) => handleGoalInputChange('starting_level', event.target.value)}
                    >
                      <option value="">Select level</option>
                      {skillLevelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="mentorship-form__field">
              <label htmlFor="goal-due-date">Due date</label>
              <input
                id="goal-due-date"
                type="date"
                value={goalForm.due_date}
                onChange={(event) => handleGoalInputChange('due_date', event.target.value)}
              />
            </div>

            <div className="mentorship-form__field">
              <label htmlFor="goal-notes">Notes</label>
              <textarea
                id="goal-notes"
                rows={3}
                value={goalForm.notes}
                onChange={(event) => handleGoalInputChange('notes', event.target.value)}
              />
            </div>

            <div className="mentorship-form__actions">
              <button type="submit" className="mentorship-btn mentorship-btn--primary" disabled={goalSubmitting}>
                {goalSubmitting ? 'Saving...' : 'Create goal'}
              </button>
            </div>
          </form>
        )}
      </section>

      {sections.share_profile_basics && data.profile && (
        <section className="mentorship-card mentorship-mentee-section">
          <h3>Profile basics</h3>
          <p>{data.profile.headline || 'No headline yet.'}</p>
          <p className="muted">{data.profile.summary || 'No summary provided.'}</p>
          <p className="muted">
            {(data.profile.full_location || 'Location not provided') + ' | ' + (data.profile.phone || 'Phone not provided')}
          </p>
        </section>
      )}

      {sections.share_skills && data.skills && data.skills.length > 0 && (
        <section className="mentorship-card mentorship-mentee-section">
          <h3>Skills</h3>
          <ul className="mentorship-mentee-skills">
            {data.skills.map((skill, index) => {
              const name = formatSkillName(skill);
              const meta = formatSkillMeta(skill);
              return (
                <li key={skill.id || `${name}-${index}`} className="mentorship-mentee-skills__item">
                  <span className="mentorship-mentee-skills__name">{name}</span>
                  {meta && <span className="mentorship-mentee-skills__meta">{meta}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {sections.share_employment && data.employment && data.employment.length > 0 && (
        <section className="mentorship-card mentorship-mentee-section">
          <h3>Employment history</h3>
          <ul className="mentorship-mentee-jobs">
            {data.employment.map((job) => {
              const highlights = normalizeHighlights(job.achievements);
              const jobSkills = Array.isArray(job.skills_used) ? job.skills_used : [];
              const metaPieces = [getJobDateRange(job), job.location].filter(Boolean);
              return (
                <li key={job.id} className="mentorship-mentee-job">
                  <div className="mentorship-mentee-job__header">
                    <div>
                      <p className="mentorship-mentee-job__title">{job.job_title || 'Role'}</p>
                      {job.company_name && <p className="mentorship-mentee-job__company">{job.company_name}</p>}
                    </div>
                    {job.duration && <span className="mentorship-mentee-job__duration">{job.duration}</span>}
                  </div>
                  {metaPieces.length > 0 && (
                    <p className="mentorship-mentee-job__meta">{metaPieces.join(' | ')}</p>
                  )}
                  {job.description && (
                    <p className="mentorship-mentee-job__description">{job.description}</p>
                  )}
                  {highlights.length > 0 && (
                    <div className="mentorship-mentee-job__highlights">
                      <p className="mentorship-mentee-subtitle">Key highlights</p>
                      <ul>
                        {highlights.map((item, idx) => (
                          <li key={`${job.id}-highlight-${idx}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {jobSkills.length > 0 && (
                    <div className="mentorship-mentee-job__skills">
                      <p className="mentorship-mentee-subtitle">Skills used</p>
                      <div className="mentorship-chip-row">
                        {jobSkills.map((skill, idx) => {
                          const label = skill.name || skill.skill_name || formatSkillName(skill);
                          return (
                            <span key={`${job.id}-skill-${skill.id || label || idx}`} className="mentorship-chip">
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {sections.share_education && data.education && data.education.length > 0 && (
        <section className="mentorship-card mentorship-mentee-section">
          <h3>Education</h3>
          <ul className="mentorship-education-list">
            {data.education.map((edu) => {
              const degreeLabel = getDegreeLabel(edu.degree_type);
              const subline = [degreeLabel, edu.field_of_study].filter(Boolean).join(' • ');
              const gpaValue =
                !edu.gpa_private && (edu.gpa || edu.gpa === 0)
                  ? Number(edu.gpa).toFixed(2).replace(/\.?0+$/, '')
                  : null;
              const detailItems = [];
              if (gpaValue) {
                detailItems.push({ label: 'GPA', value: gpaValue });
              }
              if (edu.honors) {
                detailItems.push({ label: 'Honors', value: edu.honors });
              }
              if (edu.achievements) {
                detailItems.push({ label: 'Achievements', value: edu.achievements });
              }
              return (
                <li key={edu.id}>
                  <div className={`education-item ${edu.currently_enrolled ? 'ongoing' : 'completed'}`}>
                    <div className="education-item-header">
                      <div className="education-item-main">
                        <div className="education-item-title">{edu.institution || 'Education entry'}</div>
                        {subline && <div className="education-item-sub">{subline}</div>}
                        {edu.description && (
                          <p className="mentorship-education-description">{edu.description}</p>
                        )}
                      </div>
                      <div className="education-item-dates">
                        <span>{formatEducationDates(edu)}</span>
                        {edu.currently_enrolled && (
                          <span className="mentorship-chip mentorship-chip--soft">Currently enrolled</span>
                        )}
                      </div>
                    </div>
                    {detailItems.length > 0 && (
                      <div className="education-item-details">
                        {detailItems.map((detail) => (
                          <div key={`${edu.id}-${detail.label}`}>
                            <strong>{detail.label}</strong>
                            <span>{detail.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {sections.share_certifications && data.certifications && data.certifications.length > 0 && (
        <section className="mentorship-card mentorship-mentee-section">
          <h3>Certifications</h3>
          <ul>
            {data.certifications.map((cert) => (
              <li key={cert.id}>{cert.name}</li>
            ))}
          </ul>
        </section>
      )}

      {sections.share_documents && documents.length > 0 && (
        <section className="mentorship-card mentorship-mentee-section">
          <h3>Documents</h3>
          <ul className="mentorship-documents-list">
            {documents.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  className="mentorship-link"
                  onClick={() => openPreview(doc.preview_url)}
                  disabled={!doc.preview_url}
                >
                  {doc.document_name || `Document #${doc.id}`} ({doc.doc_type})
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sections.share_job_applications && (
        <section className="mentorship-card mentorship-mentee-section">
          <h3>Job applications ({jobMode})</h3>
          {jobApplications.length === 0 ? (
            <p className="mentorship-empty">No job applications shared yet.</p>
          ) : (
            <ul className="mentorship-shared-applications">
              {jobApplications.map((app, index) => (
                <li key={app.job_id || index}>
                  <div className="mentorship-shared-applications__title">
                    {app.job?.title} @ {app.job?.company_name}
                  </div>
                  {app.job?.location && <p className="muted">Location: {app.job.location}</p>}
                  {app.job?.personal_notes && (
                    <p className="muted">Notes: {app.job.personal_notes}</p>
                  )}
                  {(app.shared_resume_document || app.shared_cover_letter_document) && (
                    <div className="mentorship-shared-applications__docs">
                      {app.shared_resume_document && (
                        <button
                          type="button"
                          className="mentorship-link"
                          onClick={() => openPreview(app.shared_resume_document.preview_url)}
                          disabled={!app.shared_resume_document.preview_url}
                        >
                          Resume attached
                        </button>
                      )}
                      {app.shared_cover_letter_document && (
                        <button
                          type="button"
                          className="mentorship-link"
                          onClick={() => openPreview(app.shared_cover_letter_document.preview_url)}
                          disabled={!app.shared_cover_letter_document.preview_url}
                        >
                          Cover letter attached
                        </button>
                      )}
                    </div>
                  )}
                  {app.notes && <p className="muted">{app.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={() => {
          if (confirmDialog.onConfirm) {
            confirmDialog.onConfirm();
          }
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
      />

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </div>
  );
};

export default MentorshipMenteeDashboard;
