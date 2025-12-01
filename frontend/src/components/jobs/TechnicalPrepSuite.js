import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../common/Icon';
import './TechnicalPrepSuite.css';

const DEFAULT_ATTEMPT = {
  tests_passed: '',
  tests_total: '',
  confidence: 'neutral',
  notes: '',
};

const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

const parseTimestamp = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatRelativeTime = (date) => {
  if (!date) return '';
  const now = Date.now();
  const diffMs = now - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return 'moments ago';
  }
  if (diffMs < hour) {
    const mins = Math.round(diffMs / minute);
    return `${mins} min${mins === 1 ? '' : 's'} ago`;
  }
  if (diffMs < day) {
    const hours = Math.round(diffMs / hour);
    return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  }
  if (diffMs < day * 7) {
    const days = Math.round(diffMs / day);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  return date.toLocaleDateString();
};

const TechnicalPrepSuite = ({
  data,
  loading = false,
  error = '',
  onRefresh = () => {},
  onPoll = null,
  onLogAttempt = () => {},
  loggingAttemptId = null,
}) => {
  const [selectedChallengeId, setSelectedChallengeId] = useState(null);
  const [timer, setTimer] = useState({ running: false, elapsed: 0 });
  const [attemptForm, setAttemptForm] = useState(DEFAULT_ATTEMPT);
  const [attemptError, setAttemptError] = useState('');
  const [showFullAttempts, setShowFullAttempts] = useState(false);
  const [challengeView, setChallengeView] = useState('core');
  const [historyChallenge, setHistoryChallenge] = useState(null);
  const [planRefreshedAt, setPlanRefreshedAt] = useState(null);
  const roleProfile = (data?.role_profile || 'technical').toLowerCase();
  const isTechnical = roleProfile === 'technical';
  const hasCodingChallenges = isTechnical && (
    (data?.coding_challenges?.length || 0) > 0
    || (data?.suggested_challenges?.length || 0) > 0
  );
  const focusAreas = Array.isArray(data?.focus_areas) ? data.focus_areas : [];
  const hasPlan = Boolean(data);
  const inlineError = Boolean(error && hasPlan);
  const blockingError = Boolean(error && !hasPlan);
  const closeHistoryModal = () => setHistoryChallenge(null);
  const lastGeneratedAt = useMemo(() => {
    if (!data) return null;
    const fields = ['generated_at', 'refreshed_at', 'updated_at', 'cache_generated_at', 'cached_at'];
    for (let idx = 0; idx < fields.length; idx += 1) {
      const candidate = data[fields[idx]];
      const parsed = parseTimestamp(candidate);
      if (parsed) {
        return parsed;
      }
    }
    return null;
  }, [data]);

  const buildStatus = data?.build_status || {};
  const buildState = buildStatus.state || 'idle';
  const buildReason = buildStatus.reason || null;
  const buildMessage = buildStatus.message || null;
  const buildSource = buildStatus.payload_source || 'ai';
  const hasReadyCache = buildStatus.has_ready_cache !== false;
  const isGenerationPending = buildState === 'pending';
  const isGenerationRunning = buildState === 'running';
  const isGenerationActive = isGenerationPending || isGenerationRunning;
  const isGenerationFailed = buildState === 'failed';
  const isFallbackPlan = buildSource === 'fallback';
  const isRefreshingPlan = Boolean(loading && hasPlan);
  const showRefreshButton = !isGenerationActive;
  const refreshMetaText = (() => {
    if (isRefreshingPlan) return 'Fetching updated drills…';
    if (isGenerationActive) {
      if (buildReason === 'refresh') {
        return 'Gemini is generating fresh drills…';
      }
      return isGenerationPending ? 'Queued to build your prep plan…' : 'Building your prep plan…';
    }
    if (lastGeneratedAt) {
      return `Updated ${formatRelativeTime(lastGeneratedAt)}`;
    }
    return 'Runs a fresh Gemini update';
  })();
  const refreshTitle = lastGeneratedAt
    ? `Last generated ${lastGeneratedAt.toLocaleString()}`
    : 'Generate a new plan from Gemini';
  const refreshButtonClass = `refresh-plan-button${isRefreshingPlan ? ' refresh-plan-button--loading' : ''}`;
  const handleRefreshClick = () => {
    if (isRefreshingPlan || isGenerationActive) return;
    onRefresh();
  };
  const planSignatureRef = useRef(null);

  useEffect(() => {
    if (!isGenerationActive || !onPoll) return undefined;
    const interval = setInterval(() => {
      onPoll();
    }, 12000);
    return () => clearInterval(interval);
  }, [isGenerationActive, onPoll, buildReason]);

  useEffect(() => {
    if (!hasPlan || !data) {
      planSignatureRef.current = null;
      setPlanRefreshedAt(null);
      return;
    }
    const signature = JSON.stringify({
      jobTitle: data.job_title,
      role: roleProfile,
      generatedAt: lastGeneratedAt ? lastGeneratedAt.getTime() : null,
      codingIds: (data.coding_challenges || []).map((item) => item.id || item.title),
      suggestedIds: (data.suggested_challenges || []).map((item) => item.id || item.title),
      focusIds: (data.focus_areas || []).map((item) => item.id || item.skill),
    });
    if (planSignatureRef.current && planSignatureRef.current !== signature) {
      setPlanRefreshedAt(new Date());
    }
    planSignatureRef.current = signature;
  }, [data, hasPlan, lastGeneratedAt, roleProfile]);

  useEffect(() => {
    if (!planRefreshedAt) return undefined;
    const timeout = setTimeout(() => setPlanRefreshedAt(null), 6000);
    return () => clearTimeout(timeout);
  }, [planRefreshedAt]);

  const refreshBannerCopy = planRefreshedAt ? `Plan updated ${formatRelativeTime(planRefreshedAt)}.` : '';

  useEffect(() => {
    if (!historyChallenge) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setHistoryChallenge(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [historyChallenge]);

  useEffect(() => {
    if (!isTechnical || !data) return;
    if (!data.coding_challenges?.length && data.suggested_challenges?.length) {
      setChallengeView('suggested');
    } else {
      setChallengeView('core');
    }
  }, [data, isTechnical]);

  useEffect(() => {
    let interval;
    if (timer.running) {
      interval = setInterval(() => {
        setTimer((prev) => ({ ...prev, elapsed: prev.elapsed + 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer.running]);

  const displayedChallenges = useMemo(() => {
    if (!data || !isTechnical) return [];
    if (challengeView === 'suggested') {
      return data.suggested_challenges || [];
    }
    return data.coding_challenges || [];
  }, [data, challengeView, isTechnical]);

  const selectedChallenge = useMemo(() => {
    if (!isTechnical || !displayedChallenges.length) return null;
    return displayedChallenges.find((challenge) => challenge.id === selectedChallengeId)
      || displayedChallenges[0];
  }, [displayedChallenges, selectedChallengeId, isTechnical]);

  useEffect(() => {
    if (!isTechnical) {
      setSelectedChallengeId(null);
      return;
    }
    if (!displayedChallenges.length) {
      setSelectedChallengeId(null);
      return;
    }
    if (!displayedChallenges.find((challenge) => challenge.id === selectedChallengeId)) {
      setSelectedChallengeId(displayedChallenges[0].id);
    }
  }, [displayedChallenges, selectedChallengeId, isTechnical]);

  useEffect(() => {
    if (!isTechnical) {
      setTimer({ running: false, elapsed: 0 });
      setAttemptForm(DEFAULT_ATTEMPT);
      setAttemptError('');
      setShowFullAttempts(false);
      return;
    }
    setTimer({ running: false, elapsed: 0 });
    setAttemptForm(DEFAULT_ATTEMPT);
    setAttemptError('');
    setShowFullAttempts(false);
  }, [selectedChallengeId, challengeView, isTechnical]);

  useEffect(() => {
    setHistoryChallenge(null);
  }, [selectedChallengeId, challengeView]);

  const loggingThisChallenge = selectedChallenge && loggingAttemptId === selectedChallenge.id;

  const handleAttemptChange = (field, value) => {
    setAttemptForm((prev) => ({ ...prev, [field]: value }));
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

  const handleLogAttempt = (event) => {
    event.preventDefault();
    if (!selectedChallenge) return;
    setAttemptError('');
    const payload = {
      challenge_id: selectedChallenge.id,
      challenge_title: selectedChallenge.title,
      challenge_type: 'coding',
      duration_seconds: timer.elapsed || null,
      tests_passed: attemptForm.tests_passed ? Number(attemptForm.tests_passed) : null,
      tests_total: attemptForm.tests_total ? Number(attemptForm.tests_total) : null,
      confidence: attemptForm.confidence,
      notes: attemptForm.notes,
    };
    Promise.resolve(onLogAttempt(payload))
      .then(() => {
        setTimer({ running: false, elapsed: 0 });
        setAttemptForm(DEFAULT_ATTEMPT);
      })
      .catch((err) => {
        setAttemptError(err?.message || 'Unable to log attempt. Please try again.');
      });
  };

  if (loading && !hasPlan) {
    return (
      <div className="education-form-card">
        <div className="education-form" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
          Loading technical prep plan...
        </div>
      </div>
    );
  }

  if (blockingError) {
    return (
      <div className="education-form-card">
        <div className="education-form" style={{ padding: '32px' }}>
          <div className="error-banner" style={{ margin: 0 }}>{error}</div>
          <button className="btn-secondary" style={{ marginTop: '16px' }} onClick={onRefresh}>
            Retry Load
          </button>
        </div>
      </div>
    );
  }

  if (!hasPlan) {
    return (
      <div className="education-form-card">
        <div className="education-form" style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>
          Technical prep plan not available yet.
          <div style={{ marginTop: '12px' }}>
            <button className="btn-secondary" onClick={onRefresh}>
              Generate Prep Plan
            </button>
          </div>
        </div>
      </div>
    );
  }

  const performance = data.performance_tracking || {};
  const performanceChallenges = Array.isArray(performance.coding_challenges) ? performance.coding_challenges : [];
  const totalPracticeMinutesRaw = Number(performance.total_practice_minutes);
  const totalPracticeMinutes = Number.isFinite(totalPracticeMinutesRaw) ? totalPracticeMinutesRaw : 0;
  const lastSessionAt = performance.last_session_at ? new Date(performance.last_session_at) : null;
  const formattedLastSession = lastSessionAt ? lastSessionAt.toLocaleString() : 'Not logged yet';
  const totalPrimaryChallenges = Array.isArray(data?.coding_challenges) ? data.coding_challenges.length : 0;
  const totalSuggestedChallenges = Array.isArray(data?.suggested_challenges) ? data.suggested_challenges.length : 0;
  const totalSystemDesign = Array.isArray(data?.system_design_scenarios) ? data.system_design_scenarios.length : 0;
  const totalCaseStudies = Array.isArray(data?.case_studies) ? data.case_studies.length : 0;
  const totalQuestionBank = Array.isArray(data?.technical_questions) ? data.technical_questions.length : 0;
  const totalFrameworks = Array.isArray(data?.solution_frameworks) ? data.solution_frameworks.length : 0;
  const totalRealWorldAlignment = Array.isArray(data?.real_world_alignment) ? data.real_world_alignment.length : 0;
  const totalFocusAreas = focusAreas.length;
  const engagedChallenges = performanceChallenges.filter((item) => (item?.attempts || 0) > 0).length;
  const languageChips = Array.isArray(data?.tech_stack?.languages) ? data.tech_stack.languages : [];
  const frameworkChips = Array.isArray(data?.tech_stack?.frameworks) ? data.tech_stack.frameworks : [];
  const toolingChips = Array.isArray(data?.tech_stack?.tooling) ? data.tech_stack.tooling : [];
  const practiceMinutesString = Number(totalPracticeMinutes || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const summaryMetrics = (() => {
    const metrics = [
      {
        id: 'practice-minutes',
        label: 'Practice Minutes Logged',
        value: practiceMinutesString,
        helper: isTechnical ? 'Across timed coding drills' : 'Time captured across prep work',
      },
    ];
    if (isTechnical) {
      const coverageTotal = totalPrimaryChallenges || performanceChallenges.length;
      const coverageValue = coverageTotal ? `${Math.min(engagedChallenges, coverageTotal)}/${coverageTotal}` : '0/0';
      metrics.push({
        id: 'challenge-coverage',
        label: 'Challenge Coverage',
        value: coverageValue,
        helper: coverageTotal ? 'Completed vs assigned' : 'Refresh to load new drills',
      });
    } else {
      metrics.push({
        id: 'focus-pillars',
        label: 'Focus Pillars',
        value: totalFocusAreas.toLocaleString(),
        helper: totalFocusAreas ? 'High-impact themes to emphasize' : 'Refresh to load focus pillars',
      });
    }
    metrics.push({
      id: 'last-session',
      label: 'Last Session',
      value: formattedLastSession,
      helper: lastSessionAt ? 'Latest logged practice' : 'Log a session to start tracking',
    });
    return metrics;
  })();
  const formatCount = (count) => Number(count || 0).toLocaleString();
  const overviewCards = isTechnical
    ? [
      {
        id: 'system-design',
        label: 'System Design Drills',
        value: formatCount(totalSystemDesign),
        helper: totalSystemDesign ? 'Architectures to rehearse end-to-end' : 'Refresh to fetch architecture prompts.',
        icon: 'layers',
      },
      {
        id: 'question-bank',
        label: 'Question Bank',
        value: formatCount(totalQuestionBank),
        helper: totalQuestionBank ? 'Scenario prompts to narrate' : 'Add prompts via refresh.',
        icon: 'book',
      },
      {
        id: 'suggested',
        label: 'Suggested Warmups',
        value: formatCount(totalSuggestedChallenges),
        helper: totalSuggestedChallenges ? 'Quick reps for variation' : 'Gemini will recommend warmups on refresh.',
        icon: 'refresh',
      },
      {
        id: 'focus-areas',
        label: 'Focus Areas',
        value: formatCount(totalFocusAreas),
        helper: totalFocusAreas ? 'Skill pillars prioritized for this job' : 'Refresh to load focus areas.',
        icon: 'idea',
      },
    ]
    : [
      {
        id: 'focus-pillars',
        label: 'Focus Pillars',
        value: formatCount(totalFocusAreas),
        helper: totalFocusAreas ? 'Themes prioritized for this interview loop' : 'Refresh to load focus pillars.',
        icon: 'idea',
      },
      {
        id: 'case-studies',
        label: 'Case Study Tracks',
        value: formatCount(totalCaseStudies),
        helper: totalCaseStudies ? 'Role-aligned scenarios to rehearse' : 'Refresh to add case practice.',
        icon: 'briefcase',
      },
      {
        id: 'frameworks',
        label: 'Framework Library',
        value: formatCount(totalFrameworks),
        helper: totalFrameworks ? 'Reusable structures for responses' : 'Refresh to pull frameworks.',
        icon: 'clipboard',
      },
      {
        id: 'alignment',
        label: 'Alignment Hooks',
        value: formatCount(totalRealWorldAlignment),
        helper: totalRealWorldAlignment ? 'Connect stories to business impact' : 'Refresh to sync alignment examples.',
        icon: 'zap',
      },
    ];
  const totalChallengeCount = totalPrimaryChallenges + totalSuggestedChallenges;
  const totalAttemptsLogged = performanceChallenges.reduce((sum, item) => sum + (item?.attempts || 0), 0);
  const accuracySamples = performanceChallenges
    .map((item) => item?.average_accuracy ?? item?.best_accuracy)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  const averageAccuracyValue = accuracySamples.length
    ? Math.round(accuracySamples.reduce((sum, value) => sum + value, 0) / accuracySamples.length)
    : null;
  const averageAccuracyDisplay = averageAccuracyValue != null ? `${averageAccuracyValue}%` : '—';
  const activeViewLabel = challengeView === 'suggested' ? 'Suggested Warmups' : 'Primary Drills';
  const challengeSectionHelper = challengeView === 'suggested'
    ? 'Quick warmups generated to diversify your reps.'
    : 'Core drills prioritized for this specific job.';
  const challengeOverviewCards = [
    {
      id: 'active-view',
      label: activeViewLabel,
      value: displayedChallenges.length.toLocaleString(),
      helper: challengeSectionHelper,
      icon: challengeView === 'suggested' ? 'refresh' : 'terminal',
    },
    {
      id: 'attempts-logged',
      label: 'Attempts Logged',
      value: totalAttemptsLogged.toLocaleString(),
      helper: totalAttemptsLogged ? 'Keep momentum going with consistent reps.' : 'Log an attempt to start your history.',
      icon: 'activity',
    },
    {
      id: 'average-accuracy',
      label: 'Avg Accuracy',
      value: averageAccuracyDisplay,
      helper: averageAccuracyValue != null ? 'Averaged across recorded runs.' : 'Accuracy tracking starts after your first run.',
      icon: 'check-circle',
    },
  ];
  const selectedPerformance = selectedChallenge
    ? performanceChallenges.find((item) => item.challenge_id === selectedChallenge.id)
    : null;
  const selectedStats = selectedChallenge
    ? {
        attempts: selectedPerformance?.attempts
          ?? selectedChallenge.practice_stats?.attempts
          ?? 0,
        bestTimeSeconds: selectedPerformance?.best_time_seconds
          ?? selectedChallenge.practice_stats?.best_time_seconds
          ?? null,
        bestAccuracy: selectedPerformance?.best_accuracy
          ?? selectedChallenge.practice_stats?.best_accuracy
          ?? null,
        averageAccuracy: selectedPerformance?.average_accuracy
          ?? selectedChallenge.practice_stats?.average_accuracy
          ?? null,
        lastAttemptAt: selectedPerformance?.last_attempt_at
          ?? selectedChallenge.practice_stats?.last_attempt_at
          ?? null,
      }
    : {
        attempts: 0,
        bestTimeSeconds: null,
        bestAccuracy: null,
        averageAccuracy: null,
        lastAttemptAt: null,
      };
  const selectedDifficultyKey = (selectedChallenge?.difficulty || 'mid').toLowerCase();
  const selectedDifficultyLabel = selectedDifficultyKey.charAt(0).toUpperCase() + selectedDifficultyKey.slice(1);
  const challengeModeLabel = challengeView === 'core' ? 'Primary drills' : 'Suggested prompts';
  const challengeCountLabel = displayedChallenges.length === 1 ? 'challenge' : 'challenges';
  const historyPerformance = historyChallenge
    ? performanceChallenges.find((item) => item.challenge_id === historyChallenge.id) || null
    : null;

  const historyAttempts = (() => {
    if (!historyChallenge) return [];

    const attemptBuckets = [];
    const collectAttempts = (source) => {
      if (!source) return;
      const candidateKeys = ['recent_attempts', 'history', 'attempt_history', 'attempts', 'logs'];
      candidateKeys.forEach((key) => {
        const value = source[key];
        if (!value) return;
        if (Array.isArray(value)) {
          attemptBuckets.push(value);
        } else if (typeof value === 'object') {
          const values = Object.values(value).filter(Boolean);
          if (values.length) {
            attemptBuckets.push(values);
          }
        }
      });
    };

    collectAttempts(historyChallenge);
    collectAttempts(historyChallenge?.practice_stats);
    if (historyPerformance) {
      collectAttempts(historyPerformance);
      if (historyPerformance.extra_stats) {
        collectAttempts(historyPerformance.extra_stats);
      }
    }

    if (!attemptBuckets.length) {
      const fallback = historyChallenge?.practice_stats?.attempts;
      if (Array.isArray(fallback)) {
        attemptBuckets.push(fallback);
      }
    }

    if (!attemptBuckets.length) return [];

    const uniqueAttempts = [];
    const seen = new Set();
    attemptBuckets.forEach((bucket) => {
      bucket.forEach((attempt) => {
        if (!attempt) return;
        const key = attempt.id ?? `${attempt.attempted_at || ''}-${attempt.duration_seconds ?? ''}-${attempt.accuracy ?? ''}-${attempt.tests_passed ?? ''}-${attempt.tests_total ?? ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        uniqueAttempts.push(attempt);
      });
    });

    return uniqueAttempts.sort((first, second) => {
      const aDate = first?.attempted_at ? new Date(first.attempted_at).getTime() : 0;
      const bDate = second?.attempted_at ? new Date(second.attempted_at).getTime() : 0;
      return bDate - aDate;
    });
  })();

  const showRefreshBanner = Boolean(planRefreshedAt || (inlineError && !planRefreshedAt) || isGenerationFailed || isFallbackPlan);
  const buildStatusChip = (() => {
    if (isGenerationActive) {
      return {
        icon: 'clock',
        className: 'status-chip status-chip--pending',
        label: buildMessage
          || (isGenerationPending
            ? 'Gemini is queuing your plan'
            : 'Gemini is building your plan'),
      };
    }
    if (isGenerationFailed) {
      return {
        icon: 'alert-triangle',
        className: 'status-chip status-chip--error',
        label: buildMessage || 'Generation failed — showing cached plan',
      };
    }
    if (isFallbackPlan) {
      return {
        icon: 'sparkles',
        className: 'status-chip status-chip--fallback',
        label: 'Using backup drills while Gemini catches up',
      };
    }
    if (!hasReadyCache) {
      return {
        icon: 'refresh',
        className: 'status-chip status-chip--inactive',
        label: 'No cache yet — refresh to build plan',
      };
    }
    return null;
  })();

  return (
    <div className={`technical-prep-suite ${isTechnical ? 'technical-prep-suite--technical' : 'technical-prep-suite--business'}`}>
      <div className="education-form-card">
        <div
          className="refresh-plan-status-bar"
          aria-live="polite"
          style={{
            padding: showRefreshBanner ? '16px 24px 0' : '0',
            transition: 'padding 0.2s ease',
          }}
        >
          {planRefreshedAt && (
            <div className="refresh-plan-banner" style={{ width: '100%', justifyContent: 'center' }}>
              <Icon name="check-circle" size="sm" />
              <span>{refreshBannerCopy}</span>
            </div>
          )}
          {!planRefreshedAt && inlineError && (
            <div className="refresh-plan-banner refresh-plan-banner--error" style={{ width: '100%', justifyContent: 'center' }}>
              <Icon name="alert-triangle" size="sm" />
              <span>Last refresh attempt failed. Showing cached plan until you try again.</span>
            </div>
          )}
          {!planRefreshedAt && !inlineError && isGenerationFailed && (
            <div className="refresh-plan-banner refresh-plan-banner--error" style={{ width: '100%', justifyContent: 'center' }}>
              <Icon name="alert-octagon" size="sm" />
              <span>{buildMessage || 'Gemini could not refresh this plan. Using previous drills.'}</span>
            </div>
          )}
          {!planRefreshedAt && !inlineError && !isGenerationFailed && isFallbackPlan && (
            <div className="refresh-plan-banner refresh-plan-banner--fallback" style={{ width: '100%', justifyContent: 'center' }}>
              <Icon name="sparkles" size="sm" />
              <span>Backup drills are active while we wait for Gemini.</span>
            </div>
          )}
        </div>
        <div className="form-header">
          <h3>
            <Icon name={isTechnical ? 'code' : 'briefcase'} size="md" /> {isTechnical ? 'Technical Interview Prep' : 'Interview Prep Overview'}
          </h3>
          <div className="refresh-plan-controls">
            {buildStatusChip && (
              <span className={buildStatusChip.className}>
                <Icon name={buildStatusChip.icon} size="sm" />
                {buildStatusChip.label}
              </span>
            )}
            {showRefreshButton && (
              <button
                type="button"
                className={refreshButtonClass}
                onClick={handleRefreshClick}
                disabled={isRefreshingPlan}
                aria-label="Refresh Plan"
                aria-busy={isRefreshingPlan}
                title={refreshTitle}
              >
                <span className="refresh-plan-button__icon" aria-hidden="true">
                  <Icon name="refresh" size="sm" />
                </span>
                <span className="refresh-plan-button__copy">
                  <span className="refresh-plan-button__primary">{isRefreshingPlan ? 'Refreshing…' : 'Refresh Plan'}</span>
                  <span className="refresh-plan-button__meta" aria-live="polite">{refreshMetaText}</span>
                </span>
              </button>
            )}
          </div>
        </div>
        <div className="education-form">
          <div className="technical-prep-summary">
            <div className="summary-primary">
              <div className="summary-job">
                <span className="summary-label">Target Role</span>
                <div className="summary-title">{data.job_title || 'Role alignment in progress'}</div>
                {data.company_name && <div className="summary-subtitle">{data.company_name}</div>}
              </div>
              <div>
                <div className="summary-label">{isTechnical ? 'Target Tech Stack' : 'Focus Themes'}</div>
                <div className="stack-chip-row">
                  {isTechnical ? (
                    <>
                      {languageChips.map((lang) => (
                        <span key={`lang-${lang}`} className="stack-chip">{lang}</span>
                      ))}
                      {frameworkChips.map((fw) => (
                        <span key={`framework-${fw}`} className="stack-chip stack-chip--alt">{fw}</span>
                      ))}
                      {toolingChips.map((tool) => (
                        <span key={`tool-${tool}`} className="stack-chip stack-chip--ghost">{tool}</span>
                      ))}
                      {!languageChips.length && !frameworkChips.length && !toolingChips.length && (
                        focusAreas.length > 0
                          ? focusAreas.slice(0, 4).map((area) => (
                            <span key={area.id || area.skill} className="stack-chip stack-chip--ghost">{area.skill}</span>
                          ))
                          : <span className="stack-chip stack-chip--ghost">Refresh to load stack context</span>
                      )}
                    </>
                  ) : (
                    <>
                      {focusAreas.length > 0 ? (
                        focusAreas.slice(0, 6).map((area) => (
                          <span key={area.id || area.skill} className="stack-chip stack-chip--focus">{area.skill}</span>
                        ))
                      ) : (
                        <span className="stack-chip stack-chip--focus">Refresh to load focus themes</span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="summary-role-chip">
                <span className={`role-chip ${isTechnical ? '' : 'role-chip--business'}`}>
                  {isTechnical ? 'Engineering Track' : 'Business Readiness'}
                </span>
                <small>Cached per job until you refresh.</small>
              </div>
            </div>
            {summaryMetrics.map((metric) => (
              <div key={metric.id} className="summary-metric">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                {metric.helper && <small>{metric.helper}</small>}
              </div>
            ))}
          </div>
          {overviewCards.length > 0 && (
            <div className="technical-prep-overview-grid">
              {overviewCards.map((card) => (
                <div
                  key={card.id}
                  className={`overview-card ${isTechnical ? 'overview-card--technical' : 'overview-card--business'}`}
                >
                  <div className="overview-card__label">
                    <Icon name={card.icon} size="sm" />
                    <span>{card.label}</span>
                  </div>
                  <strong>{card.value}</strong>
                  {card.helper && <p>{card.helper}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        {focusAreas.length > 0 && (
          <div className="education-form focus-area-wrapper">
            <div className="focus-area-header-row">
              <h4>High-Impact Focus Areas</h4>
              <span>Allocate the recommended hours before your next interview.</span>
            </div>
            <div className="focus-area-grid">
              {focusAreas.map((area, idx) => (
                <div key={area.id || `${area.skill}-${idx}`} className="focus-area-card">
                  <div className="focus-area-card__header">
                    <strong>{area.skill}</strong>
                    <span>{area.recommended_hours ? `${area.recommended_hours}h` : '—'}</span>
                  </div>
                  <div className="focus-area-card__meta">
                    {(area.category || 'Focus')} · {(area.relevance || 'core').toUpperCase()}
                  </div>
                  <p>{area.practice_tip || 'Connect this capability to measurable impact stories.'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {isTechnical && hasCodingChallenges && (
        <div className="education-form-card">
          <div className="form-header">
            <h3>
              <Icon name="terminal" size="md" /> Coding Challenges
            </h3>
          </div>
          <div className="education-form technical-prep-challenges">
            <div className="technical-prep-challenges__intro">
              <div className="challenge-header-copy">
                <span className="challenge-section-label">{activeViewLabel}</span>
                <h4>{displayedChallenges.length ? 'Select a challenge to review' : 'No challenges ready yet'}</h4>
                <p className="challenge-section-helper">
                  {displayedChallenges.length ? challengeSectionHelper : 'Refresh your plan to generate challenge drills for this role.'}
                </p>
                <small className="challenge-section-meta">
                  {totalChallengeCount.toLocaleString()} total challenges · Last session: {formattedLastSession}
                </small>
              </div>
              <div className="challenge-metric-grid">
                {challengeOverviewCards.map((metric) => (
                  <div key={metric.id} className="challenge-metric-card">
                    <div className="challenge-metric-card__label">
                      <Icon name={metric.icon} size="sm" />
                      <span>{metric.label}</span>
                    </div>
                    <strong>{metric.value}</strong>
                    <p>{metric.helper}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="challenge-list-column">
              <div className="challenge-list-header">
                <div className="challenge-view-tabs">
                  <button
                    type="button"
                    className={challengeView === 'core' ? 'active' : ''}
                    onClick={() => setChallengeView('core')}
                    disabled={!data.coding_challenges?.length}
                  >
                    Primary
                  </button>
                  {data.suggested_challenges?.length > 0 && (
                    <button
                      type="button"
                      className={challengeView === 'suggested' ? 'active' : ''}
                      onClick={() => setChallengeView('suggested')}
                    >
                      Suggested
                    </button>
                  )}
                </div>
                <div className="challenge-list-toolbar">
                  <div className="challenge-list-toolbar__status">
                    <span className="challenge-list-toolbar__label">{challengeModeLabel}</span>
                    <span className="challenge-list-toolbar__count">
                      <strong>{displayedChallenges.length}</strong> {challengeCountLabel}
                    </span>
                  </div>
                  <div className="challenge-list-toolbar__hint">
                    {selectedChallenge ? (
                      <>
                        Viewing <strong>{selectedChallenge.title}</strong>
                      </>
                    ) : (
                      'Select a challenge to see the practice focus and logging stats.'
                    )}
                  </div>
                </div>
              </div>
              <div className="challenge-list-scroll">
                <div className="challenge-list">
                  {displayedChallenges.map((challenge) => {
                    const difficultyKey = (challenge.difficulty || 'mid').toLowerCase();
                    const difficultyLabel = difficultyKey.charAt(0).toUpperCase() + difficultyKey.slice(1);
                    const challengePerformance = performanceChallenges.find((item) => item.challenge_id === challenge.id) || {};
                    const attemptsLogged = challengePerformance.attempts
                      ?? challenge.practice_stats?.attempts
                      ?? 0;
                    const bestTimeSeconds = challengePerformance.best_time_seconds
                      ?? challenge.practice_stats?.best_time_seconds
                      ?? null;
                    const bestAccuracy = challengePerformance.best_accuracy
                      ?? challenge.practice_stats?.best_accuracy
                      ?? null;
                    const lastAttemptAt = challengePerformance.last_attempt_at
                      ?? challenge.practice_stats?.last_attempt_at
                      ?? null;
                    const isActive = selectedChallenge?.id === challenge.id;
                    const recommendedMinutes = challenge.timer?.recommended_minutes
                      ?? challenge.estimated_time_minutes
                      ?? null;
                    const speedLabel = bestTimeSeconds != null
                      ? formatDuration(bestTimeSeconds)
                      : (recommendedMinutes ? `${recommendedMinutes} min goal` : 'Flexible pace');
                    const attemptsLabel = attemptsLogged > 0 ? `${attemptsLogged}` : 'New';
                    const focusCopy = challenge.practice_focus || challenge.description || 'Use as fast warm-up prompt.';
                    return (
                      <button
                        key={challenge.id}
                        className={`challenge-card ${isActive ? 'active' : ''}`}
                        onClick={() => setSelectedChallengeId(challenge.id)}
                      >
                        <div className="challenge-card__header">
                          <span className={`challenge-difficulty challenge-difficulty--${difficultyKey}`}>
                            {difficultyLabel}
                          </span>
                          <span className="challenge-duration">
                            <Icon name="clock" size="sm" />
                            {(challenge.timer?.recommended_minutes || challenge.estimated_time_minutes)
                              ? `${challenge.timer?.recommended_minutes || challenge.estimated_time_minutes} min`
                              : 'Untimed'}
                          </span>
                        </div>
                        <h4>{challenge.title}</h4>
                        <p>{challenge.description}</p>
                        <div className="challenge-card__meta">
                          <span className={`challenge-status ${attemptsLogged > 0 ? 'challenge-status--logged' : 'challenge-status--new'}`}>
                            <Icon name={attemptsLogged > 0 ? 'activity' : 'sparkles'} size="sm" />
                            {attemptsLogged > 0
                              ? `${attemptsLogged} ${attemptsLogged === 1 ? 'attempt' : 'attempts'} logged`
                              : 'Fresh drill'}
                          </span>
                          <span>
                            <Icon name="calendar" size="sm" />
                            {lastAttemptAt ? new Date(lastAttemptAt).toLocaleDateString() : 'Not attempted yet'}
                          </span>
                          {bestAccuracy != null && (
                            <span>
                              <Icon name="check-circle" size="sm" /> Best {bestAccuracy}%
                            </span>
                          )}
                        </div>
                        <div className="challenge-card__summary">
                          <div className="challenge-card__stat">
                            <span className="challenge-card__stat-label">Attempts</span>
                            <strong>{attemptsLabel}</strong>
                          </div>
                          <div className="challenge-card__stat">
                            <span className="challenge-card__stat-label">Speed Goal</span>
                            <strong>{speedLabel}</strong>
                          </div>
                        </div>
                        <div className="challenge-card__focus">
                          <span>{focusCopy}</span>
                          {challenge.key_metric && <small>Metric: {challenge.key_metric}</small>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedChallenge && (
              <div className="challenge-detail-column">
                <div className="challenge-detail challenge-detail--sticky">
                  <div className="challenge-detail__header">
                    <div>
                    <h4>{selectedChallenge.title}</h4>
                    <p>{selectedChallenge.description}</p>
                    <div className="challenge-detail__tags">
                      <span className={`challenge-difficulty challenge-difficulty--${selectedDifficultyKey}`}>
                        {selectedDifficultyLabel}
                      </span>
                      {selectedChallenge.timer?.recommended_minutes && (
                        <span className="challenge-detail__chip">
                          <Icon name="clock" size="sm" /> Target {selectedChallenge.timer.recommended_minutes} min
                        </span>
                      )}
                      {selectedStats.attempts > 0 && (
                        <span className="challenge-detail__chip">
                          <Icon name="activity" size="sm" /> {selectedStats.attempts} {selectedStats.attempts === 1 ? 'attempt' : 'attempts'}
                        </span>
                      )}
                      {selectedStats.bestTimeSeconds != null && (
                        <span className="challenge-detail__chip">
                          <Icon name="zap" size="sm" /> Best {formatDuration(selectedStats.bestTimeSeconds)}
                        </span>
                      )}
                      {selectedStats.bestAccuracy != null && (
                        <span className="challenge-detail__chip">
                          <Icon name="check-circle" size="sm" /> {selectedStats.bestAccuracy}% accuracy
                        </span>
                      )}
                      {selectedStats.averageAccuracy != null && (
                        <span className="challenge-detail__chip">
                          <Icon name="bar-chart" size="sm" /> Avg {selectedStats.averageAccuracy}% accuracy
                        </span>
                      )}
                    </div>
                    {selectedChallenge.reference_links?.length > 0 && (
                      <div className="challenge-links">
                        {selectedChallenge.reference_links.map((link) => (
                          <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                            <Icon name="external-link" size="sm" /> {link.label}
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="challenge-detail__actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setHistoryChallenge(selectedChallenge)}
                        aria-haspopup="dialog"
                      >
                        View Attempt History
                      </button>
                    </div>
                    </div>
                    <div className="challenge-timer-display">
                    <div>Elapsed</div>
                    <strong>{formatDuration(timer.elapsed)}</strong>
                    <div className="timer-controls">
                      <button className="btn-secondary" onClick={() => handleTimerControl('start')} disabled={timer.running}>
                        Start
                      </button>
                      <button className="btn-secondary" onClick={() => handleTimerControl('pause')} disabled={!timer.running}>
                        Pause
                      </button>
                      <button className="btn-secondary" onClick={() => handleTimerControl('reset')}>
                        Reset
                      </button>
                    </div>
                    </div>
                  </div>

                  {(selectedChallenge.practice_focus || selectedChallenge.key_metric) && (
                    <div className="challenge-detail-focus">
                      <div className="challenge-detail-focus__item">
                        <span className="challenge-detail-focus__label">Practice Focus</span>
                        <p>{selectedChallenge.practice_focus || 'Focus on concise communication and impact metrics.'}</p>
                      </div>
                      <div className="challenge-detail-focus__item">
                        <span className="challenge-detail-focus__label">Key Metric</span>
                        <p>{selectedChallenge.key_metric || 'Tie the outcome to a measurable KPI.'}</p>
                      </div>
                      {(selectedChallenge.timer?.recommended_minutes || selectedChallenge.estimated_time_minutes) && (
                        <div className="challenge-detail-focus__item">
                          <span className="challenge-detail-focus__label">Recommended Duration</span>
                          <p>
                            {(selectedChallenge.timer?.recommended_minutes || selectedChallenge.estimated_time_minutes)} min sprint
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {(selectedChallenge.objectives?.length > 0 || selectedChallenge.best_practices?.length > 0) && (
                  <div className="challenge-detail__grid">
                    {selectedChallenge.objectives?.length > 0 && (
                      <div>
                        <h5>Objectives</h5>
                        <ul>
                          {selectedChallenge.objectives.map((objective) => <li key={objective}>{objective}</li>)}
                        </ul>
                      </div>
                    )}
                    {selectedChallenge.best_practices?.length > 0 && (
                      <div>
                        <h5>Best Practices</h5>
                        <ul>
                          {selectedChallenge.best_practices.map((tip) => <li key={tip}>{tip}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                  )}

                  <form onSubmit={handleLogAttempt} className="challenge-log-form">
                    <div className="form-row">
                      <label>
                        Tests Passed
                        <input
                          type="number"
                          min="0"
                          value={attemptForm.tests_passed}
                          onChange={(event) => handleAttemptChange('tests_passed', event.target.value)}
                          placeholder="e.g., 5"
                        />
                      </label>
                      <label>
                        Total Tests
                        <input
                          type="number"
                          min="0"
                          value={attemptForm.tests_total}
                          onChange={(event) => handleAttemptChange('tests_total', event.target.value)}
                          placeholder="e.g., 6"
                        />
                      </label>
                      <label>
                        Confidence
                        <select value={attemptForm.confidence} onChange={(event) => handleAttemptChange('confidence', event.target.value)}>
                          <option value="neutral">Neutral</option>
                          <option value="confident">Confident</option>
                          <option value="needs-practice">Needs Practice</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      Notes & takeaways
                      <textarea
                        rows={3}
                        value={attemptForm.notes}
                        onChange={(event) => handleAttemptChange('notes', event.target.value)}
                        placeholder="What worked well? What will you adjust next time?"
                      />
                    </label>
                    {attemptError && <div className="error-banner" style={{ margin: '8px 0' }}>{attemptError}</div>}
                    <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn-primary" disabled={loggingThisChallenge}>
                        {loggingThisChallenge ? 'Saving...' : 'Log Attempt'}
                      </button>
                    </div>
                  </form>

                  {selectedChallenge.recent_attempts?.length > 0 && (
                  <div className="recent-attempts">
                    <h5>Recent Attempts</h5>
                    <div className="recent-attempts__list">
                      {(showFullAttempts ? selectedChallenge.recent_attempts : selectedChallenge.recent_attempts.slice(0, 3)).map((attempt) => (
                        <div key={attempt.id} className="recent-attempt-card">
                          <div>{new Date(attempt.attempted_at).toLocaleString()}</div>
                          <div>Duration: {formatDuration(attempt.duration_seconds)}</div>
                          <div>Accuracy: {attempt.accuracy != null ? `${attempt.accuracy}%` : '—'}</div>
                          {attempt.notes && <p>{attempt.notes}</p>}
                        </div>
                      ))}
                    </div>
                    {selectedChallenge.recent_attempts.length > 3 && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ marginTop: '12px' }}
                        onClick={() => setShowFullAttempts((prev) => !prev)}
                      >
                        {showFullAttempts ? 'Show fewer attempts' : `Show all ${selectedChallenge.recent_attempts.length} attempts`}
                      </button>
                    )}
                  </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isTechnical && !hasCodingChallenges && (
        <div className="education-form-card">
          <div className="education-form" style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>
            Coding drills will appear here once Gemini finishes generating the plan.
          </div>
        </div>
      )}

      {!isTechnical && (
        <div className="education-form-card business-prep-card">
          <div className="form-header">
            <h3><Icon name="briefcase" size="md" /> Business Readiness Tracks</h3>
          </div>
          <div className="education-form business-prep-tracks">
            <div>
              <h4>Case Accelerators</h4>
              {(data.case_studies || []).slice(0, 2).map((study) => (
                <div key={study.id} className="business-prep-chip">
                  <strong>{study.title}</strong>
                  <p>{study.scenario || 'Tailor an executive-ready story with measurable outcomes.'}</p>
                </div>
              ))}
            </div>
            <div>
              <h4>Framework Stack</h4>
              {(data.solution_frameworks || []).slice(0, 2).map((framework) => (
                <div key={framework.name} className="business-prep-chip">
                  <strong>{framework.name}</strong>
                  <p>{framework.steps?.join(' → ') || 'Walk through the decision path with success metrics.'}</p>
                </div>
              ))}
            </div>
            <div>
              <h4>Real-World Hooks</h4>
              {(data.real_world_alignment || []).slice(0, 2).map((item) => (
                <div key={item.id} className="business-prep-chip">
                  <strong>{item.skill}</strong>
                  <p>{item.scenario}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="technical-prep-grid">
        {data.system_design_scenarios?.length > 0 && (
          <div className="education-form-card">
            <div className="form-header">
              <h3><Icon name="layers" size="md" /> System Design Scenarios</h3>
            </div>
            <div className="education-form">
              {data.system_design_scenarios.map((scenario) => (
                <div key={scenario.id} className="scenario-card">
                  <h4>{scenario.title}</h4>
                  <p>{scenario.scenario}</p>
                  <div className="scenario-chip-group">
                    {scenario.requirements?.map((req) => <span key={req} className="scenario-chip">{req}</span>)}
                  </div>
                  <div className="scenario-meta">
                    <strong>Constraints:</strong> {scenario.constraints?.join(', ')}
                  </div>
                  <div className="scenario-meta">
                    <strong>Evaluation:</strong> {scenario.evaluation?.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.case_studies?.length > 0 && (
          <div className="education-form-card">
            <div className="form-header">
              <h3><Icon name="briefcase" size="md" /> Case Study Practice</h3>
            </div>
            <div className="education-form">
              {data.case_studies.map((study) => (
                <div key={study.id} className="case-card">
                  <div className="case-card__header">
                    <h4>{study.title}</h4>
                    <span>{study.role_focus}</span>
                  </div>
                  <p>{study.scenario}</p>
                  <ul>
                    {study.tasks?.map((task) => <li key={task}>{task}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="technical-prep-grid">
        {data.technical_questions?.length > 0 && (
          <div className="education-form-card">
            <div className="form-header">
              <h3><Icon name="list" size="md" /> {isTechnical ? 'Technical Question Drills' : 'Interview Question Drills'}</h3>
            </div>
            <div className="education-form question-grid">
              {data.technical_questions.map((question) => (
                <div key={question.id} className="question-card">
                  <h4>{question.prompt}</h4>
                  <p className="question-meta">Linked skill: {question.linked_skill}</p>
                  <ul>
                    {question.answer_framework?.map((step) => <li key={step}>{step}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {(data.whiteboarding_practice?.techniques?.length > 0 || data.solution_frameworks?.length > 0) && (
          <div className="education-form-card">
            <div className="form-header">
              <h3><Icon name="clipboard" size="md" /> Whiteboarding & Frameworks</h3>
            </div>
            <div className="education-form whiteboard-card">
              {data.whiteboarding_practice?.techniques?.length > 0 && (
                <div>
                  <h4>Whiteboarding Techniques</h4>
                  <ul>
                    {data.whiteboarding_practice.techniques.map((tip) => <li key={tip}>{tip}</li>)}
                  </ul>
                </div>
              )}
              {data.solution_frameworks?.length > 0 && (
                <div>
                  <h4>Solution Frameworks</h4>
                  {data.solution_frameworks.map((framework) => (
                    <div key={framework.name} className="framework-card">
                      <h5>{framework.name}</h5>
                      <ul>
                        {framework.steps?.map((step) => <li key={step}>{step}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {data.real_world_alignment?.length > 0 && (
        <div className="education-form-card">
          <div className="form-header">
            <h3><Icon name="zap" size="md" /> Real-World Alignment</h3>
          </div>
          <div className="education-form alignment-grid">
            {data.real_world_alignment.map((item) => (
              <div key={item.id} className="alignment-card">
                <h4>{item.skill}</h4>
                <p>{item.scenario}</p>
                <small>{item.business_link}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {historyChallenge && (
        <div
          className="challenge-history-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="challenge-history-title"
          onClick={closeHistoryModal}
        >
          <div
            className="challenge-history-modal__content"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="challenge-history-modal__header">
              <div>
                <h3 id="challenge-history-title">{historyChallenge.title}</h3>
                <p className="challenge-history-modal__subtitle">
                  {historyAttempts.length > 0
                    ? `${historyAttempts.length} logged ${historyAttempts.length === 1 ? 'attempt' : 'attempts'}`
                    : 'No attempts recorded yet'}
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={closeHistoryModal}>
                Close
              </button>
            </div>
            {historyAttempts.length > 0 ? (
              <div className="challenge-history-modal__list">
                {historyAttempts.map((attempt) => (
                  <div key={attempt.id || attempt.attempted_at} className="challenge-history-modal__item">
                    <div className="challenge-history-modal__item-meta">
                      <span>{new Date(attempt.attempted_at).toLocaleString()}</span>
                      <span>{attempt.duration_seconds != null ? `Duration ${formatDuration(attempt.duration_seconds)}` : 'Duration —'}</span>
                      <span>{attempt.accuracy != null ? `Accuracy ${attempt.accuracy}%` : 'Accuracy —'}</span>
                    </div>
                    {(attempt.tests_passed != null || attempt.tests_total != null) && (
                      <div className="challenge-history-modal__item-tests">
                        Tests
                        {' '}
                        {attempt.tests_passed != null ? attempt.tests_passed : '—'}
                        {' / '}
                        {attempt.tests_total != null ? attempt.tests_total : '—'}
                      </div>
                    )}
                    {attempt.notes && <p className="challenge-history-modal__item-notes">{attempt.notes}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="challenge-history-modal__empty">
                No logged attempts yet. Log one to start building your history.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalPrepSuite;
