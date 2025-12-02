import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mentorshipAPI } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import './MentorshipDashboard.css';

const statusClassMap = {
  pending: 'mentorship-status mentorship-status--pending',
  accepted: 'mentorship-status mentorship-status--accepted',
  declined: 'mentorship-status mentorship-status--declined',
  cancelled: 'mentorship-status mentorship-status--cancelled',
};

const sectionLabels = {
  share_profile_basics: {
    title: 'Profile basics',
    description: 'Name, headline, location, summary',
  },
  share_skills: {
    title: 'Skills',
    description: 'All skills listed on your profile',
  },
  share_employment: {
    title: 'Employment history',
    description: 'Positions and experience details',
  },
  share_education: {
    title: 'Education',
    description: 'Schools, degrees, fields of study',
  },
  share_certifications: {
    title: 'Certifications',
    description: 'Licenses and badges',
  },
  share_documents: {
    title: 'Documents',
    description: 'Resumes and cover letters in your library',
  },
};

const jobSharingModes = [
  {
    value: 'none',
    label: "Don't share job applications",
    helper: 'Mentors will not see job details or documents.',
  },
  {
    value: 'all',
    label: 'Share all jobs',
    helper: 'Mentors can view every job tracked in your pipeline.',
  },
  {
    value: 'responded',
    label: 'Jobs with responses',
    helper: 'Show only jobs that progressed beyond Applied.',
  },
  {
    value: 'selected',
    label: 'Choose specific jobs',
    helper: 'Pick individual jobs and add optional notes.',
  },
];

const RequestCard = ({ request, variant, onAccept, onDecline, onCancel }) => {
  const counterpart = variant === 'incoming' ? request.requester_profile : request.receiver_profile;
  const createdAt = request.created_at ? new Date(request.created_at).toLocaleString() : '';
  const showRespondActions = variant === 'incoming' && request.status === 'pending';
  const showCancel = variant === 'outgoing' && request.status === 'pending';
  const headline = counterpart?.headline || '';
  const message = request.message?.trim();

  return (
    <article className="mentorship-request-card">
      <div className="mentorship-request-card__header">
        <div>
          <div className="mentorship-request-card__name">
            {counterpart?.full_name || counterpart?.email || 'Unknown user'}
          </div>
          <div className="mentorship-request-card__headline">{headline || counterpart?.email}</div>
        </div>
        <div className={statusClassMap[request.status] || statusClassMap.pending}>{request.status}</div>
      </div>
      <div className="mentorship-request-card__role">
        Role requested: <strong>{request.role_for_requester === 'mentor' ? 'Mentor' : 'Mentee'}</strong>
      </div>
      {message && <p className="mentorship-request-card__message">&ldquo;{message}&rdquo;</p>}
      <div className="mentorship-request-card__meta">Requested on {createdAt}</div>
      {(showRespondActions || showCancel) && (
        <div className="mentorship-request-card__actions">
          {showRespondActions && (
            <>
              <button className="mentorship-btn mentorship-btn--primary" type="button" onClick={() => onAccept && onAccept(request.id)}>
                Accept
              </button>
              <button className="mentorship-btn mentorship-btn--ghost" type="button" onClick={() => onDecline && onDecline(request.id)}>
                Decline
              </button>
            </>
          )}
          {showCancel && (
            <button className="mentorship-btn mentorship-btn--ghost" type="button" onClick={() => onCancel && onCancel(request.id)}>
              Cancel
            </button>
          )}
        </div>
      )}
    </article>
  );
};

const RelationshipCard = ({ item, children }) => {
  const collaborator = item.collaborator;
  const roleLabel = item.current_user_role === 'mentor' ? 'Mentoring' : 'Mentored by';
  const accepted = item.accepted_at ? new Date(item.accepted_at).toLocaleDateString() : null;

  return (
    <article className="mentorship-relationship-card">
      <div className="mentorship-relationship-card__name">{collaborator?.full_name || collaborator?.email}</div>
      <div className="mentorship-relationship-card__headline">{collaborator?.headline || collaborator?.email}</div>
      <div className="mentorship-relationship-card__meta">
        {roleLabel} &middot; Access: {item.permission_level}
      </div>
      {accepted && <div className="mentorship-relationship-card__meta">Connected since {accepted}</div>}
      {children}
    </article>
  );
};

const MentorshipDashboard = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [relationships, setRelationships] = useState({ mentors: [], mentees: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ targetEmail: '', requesterRole: 'mentee', message: '' });
  const [formStatus, setFormStatus] = useState({ submitting: false, success: '' });
  const [actionMessage, setActionMessage] = useState('');
  const [selectedMentorForSharing, setSelectedMentorForSharing] = useState('');
  const [shareSettings, setShareSettings] = useState(null);
  const [shareSections, setShareSections] = useState(Object.keys(sectionLabels).reduce((acc, key) => ({ ...acc, [key]: false }), {}));
  const shareSectionsRef = React.useRef(shareSections);
  useEffect(() => {
    shareSectionsRef.current = shareSections;
  }, [shareSections]);
  const [jobSharingMode, setJobSharingMode] = useState('selected');
  const [shareApplications, setShareApplications] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [savingShare, setSavingShare] = useState(false);
  const [shareFeedback, setShareFeedback] = useState({ success: '', error: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [requestData, relationshipData] = await Promise.all([mentorshipAPI.getRequests(), mentorshipAPI.getRelationships()]);
      setRequests({
        incoming: requestData?.incoming || [],
        outgoing: requestData?.outgoing || [],
      });
      setRelationships({
        mentors: relationshipData?.mentors || [],
        mentees: relationshipData?.mentees || [],
      });
    } catch (err) {
      const fallback = err?.error?.message || err?.message || 'Unable to load mentorship data.';
      setError(fallback);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (relationships.mentors?.length && !selectedMentorForSharing) {
      setSelectedMentorForSharing(relationships.mentors[0].id);
    }
    if (!relationships.mentors?.length) {
      setSelectedMentorForSharing('');
      setShareSettings(null);
    }
  }, [relationships, selectedMentorForSharing]);

  useEffect(() => {
    if (!selectedMentorForSharing) {
      setShareSettings(null);
      return;
    }
    let isMounted = true;
    setShareLoading(true);
    setShareFeedback({ success: '', error: '' });
    mentorshipAPI
      .getShareSettings(selectedMentorForSharing)
      .then((data) => {
        if (!isMounted) return;
        setShareSettings(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        const fallback = err?.error?.message || err?.message || 'Unable to load sharing preferences.';
        setShareFeedback({ success: '', error: fallback });
      })
      .finally(() => {
        if (isMounted) setShareLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedMentorForSharing]);

  useEffect(() => {
    if (!shareSettings) {
      setShareSections(Object.keys(sectionLabels).reduce((acc, key) => ({ ...acc, [key]: false }), {}));
      setShareApplications([]);
      setJobSharingMode('selected');
      return;
    }
    const nextSections = {};
    Object.keys(sectionLabels).forEach((key) => {
      nextSections[key] = !!shareSettings[key];
    });
    setShareSections(nextSections);
    const incomingMode = shareSettings.job_sharing_mode || (shareSettings.share_job_applications ? 'selected' : 'none');
    setJobSharingMode(incomingMode);
    if (incomingMode === 'selected') {
      const mapped = (shareSettings.shared_applications || []).map((app) => ({
        job_id: app.job_id || app.job?.id,
        job: app.job,
        notes: app.notes || '',
      }));
      setShareApplications(mapped);
    } else {
      setShareApplications([]);
    }
  }, [shareSettings]);

  const emptyState = useMemo(
    () => ({
      incoming: !requests.incoming?.length,
      outgoing: !requests.outgoing?.length,
      mentors: !relationships.mentors?.length,
      mentees: !relationships.mentees?.length,
    }),
    [requests, relationships]
  );

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSendRequest = async (event) => {
    event.preventDefault();
    if (!form.targetEmail.trim()) {
      setActionMessage('Please enter an email address.');
      return;
    }
    setFormStatus({ submitting: true, success: '' });
    setActionMessage('');
    try {
      await mentorshipAPI.sendRequest({
        target_email: form.targetEmail.trim(),
        requester_role: form.requesterRole,
        message: form.message.trim(),
      });
      setFormStatus({ submitting: false, success: 'Invitation sent successfully.' });
      setForm({ targetEmail: '', requesterRole: 'mentee', message: '' });
      loadData();
    } catch (err) {
      const msg = err?.error?.message || err?.target_profile_id || err?.message || 'Unable to send request.';
      setActionMessage(msg);
      setFormStatus({ submitting: false, success: '' });
    }
  };

  const handleRespond = async (requestId, action) => {
    setActionMessage('');
    try {
      await mentorshipAPI.respondToRequest(requestId, action);
      loadData();
    } catch (err) {
      const msg = err?.error?.message || err?.message || 'Unable to update request.';
      setActionMessage(msg);
    }
  };

  const handleCancel = async (requestId) => {
    setActionMessage('');
    try {
      await mentorshipAPI.cancelRequest(requestId);
      loadData();
    } catch (err) {
      const msg = err?.error?.message || err?.message || 'Unable to cancel request.';
      setActionMessage(msg);
    }
  };

  const handleJobSharingModeChange = (mode) => {
    setJobSharingMode(mode);
    if (mode !== 'selected') {
      setShareApplications([]);
    }
  };

  const toggleJobShare = (job) => {
    setShareApplications((prev) => {
      const exists = prev.some((app) => app.job_id === job.id);
      if (exists) {
        return prev.filter((app) => app.job_id !== job.id);
      }
      return [
        ...prev,
        {
          job_id: job.id,
          job,
          notes: '',
        },
      ];
    });
  };

  const updateSharedApplication = (jobId, value) => {
    setShareApplications((prev) =>
      prev.map((app) =>
        app.job_id === jobId
          ? {
              ...app,
              notes: value,
            }
          : app
      )
    );
  };

  const handleSaveSharing = async () => {
    if (!selectedMentorForSharing) return;
    setSavingShare(true);
    setShareFeedback({ success: '', error: '' });
    const currentSections = shareSectionsRef.current || shareSections;
    const payload = {
      ...currentSections,
      share_job_applications: jobSharingMode !== 'none',
      job_sharing_mode: jobSharingMode,
    };
    if (jobSharingMode === 'selected') {
      payload.shared_applications = shareApplications.map((app) => ({
        job_id: app.job_id,
        notes: app.notes || '',
      }));
    }
    try {
      const data = await mentorshipAPI.updateShareSettings(selectedMentorForSharing, payload);
      setShareSettings(data);
      setShareFeedback({ success: 'Sharing preferences saved.', error: '' });
    } catch (err) {
      const msg = err?.error?.message || err?.message || 'Unable to update sharing preferences.';
      setShareFeedback({ success: '', error: msg });
    } finally {
      setSavingShare(false);
    }
  };

  if (loading) {
    return (
      <div className="mentorship-page mentorship-page--loading">
        <LoadingSpinner />
      </div>
    );
  }

  const availableJobs = shareSettings?.available_jobs || [];
  const selectedJobMap = shareApplications.reduce((acc, item) => {
    acc[item.job_id] = item;
    return acc;
  }, {});
  const activeJobMode = jobSharingModes.find((mode) => mode.value === jobSharingMode);

  return (
    <div className="mentorship-page">
      <section className="mentorship-hero">
        <div>
          <p className="mentorship-hero__eyebrow">Collaboration Hub</p>
          <h1>Mentorship & Accountability</h1>
          <p>Invite mentors, approve requests, and keep progress visible to the people guiding your search.</p>
        </div>
        <div className="mentorship-hero__glow" aria-hidden="true" />
      </section>

      {error && (
        <div className="mentorship-alert mentorship-alert--error">{error}</div>
      )}

      <section className="mentorship-card mentorship-form-card">
        <header className="mentorship-card__header">
          <div>
            <p className="mentorship-card__eyebrow">Start a collaboration</p>
            <h2>Invite a mentor or mentee</h2>
            <p>Share a quick note about your goals so they know how to support you.</p>
          </div>
        </header>
        <form onSubmit={handleSendRequest} className="mentorship-form">
          <label className="mentorship-form__field">
            <span>Email address</span>
            <input
              type="email"
              placeholder="mentor@example.com"
              name="targetEmail"
              value={form.targetEmail}
              onChange={handleFieldChange}
              required
            />
          </label>
          <label className="mentorship-form__field">
            <span>Your role in this collaboration</span>
            <select name="requesterRole" value={form.requesterRole} onChange={handleFieldChange}>
              <option value="mentee">I'm looking for a mentor</option>
              <option value="mentor">I want to mentor this person</option>
            </select>
          </label>
          <label className="mentorship-form__field">
            <span>Optional message</span>
            <textarea
              name="message"
              value={form.message}
              onChange={handleFieldChange}
              placeholder="Let them know what kind of collaboration you're hoping for."
            />
          </label>
          <div className="mentorship-form__actions">
            <button className="mentorship-btn mentorship-btn--primary" type="submit" disabled={formStatus.submitting}>
              {formStatus.submitting ? 'Sending...' : 'Send invitation'}
            </button>
            {formStatus.success && <div className="mentorship-feedback mentorship-feedback--success">{formStatus.success}</div>}
            {actionMessage && <div className="mentorship-feedback mentorship-feedback--error">{actionMessage}</div>}
          </div>
        </form>
      </section>

      {relationships.mentors?.length > 0 && (
        <section className="mentorship-card mentorship-sharing-panel">
          <header className="mentorship-card__header mentorship-sharing-panel__header">
            <div>
              <p className="mentorship-card__eyebrow">Sharing controls</p>
              <h2>Choose what each mentor can view</h2>
              <p>Toggle sections of your account and decide how much of your pipeline to expose.</p>
            </div>
            <div className="mentorship-sharing-panel__selector">
              <label>
                Manage for
                <select value={selectedMentorForSharing} onChange={(e) => setSelectedMentorForSharing(e.target.value)}>
                  {relationships.mentors.map((mentor) => (
                    <option key={mentor.id} value={mentor.id}>
                      {mentor.mentor?.full_name || mentor.mentor?.email || 'Mentor'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </header>
          {shareLoading && (
            <div className="mentorship-sharing-panel__loading">
              <LoadingSpinner />
            </div>
          )}
          {!shareLoading && !shareSettings && (
            <p className="mentorship-empty">Select a mentor to manage sharing controls.</p>
          )}
          {!shareLoading && shareSettings && (
            <>
              <div className="mentorship-toggle-grid">
                {Object.entries(sectionLabels).map(([key, info]) => (
                  <label key={key} className={`mentorship-toggle ${shareSections[key] ? 'is-active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={!!shareSections[key]}
                      onChange={() => setShareSections((prev) => ({ ...prev, [key]: !prev[key] }))}
                    />
                    <div>
                      <span>{info.title}</span>
                      <p>{info.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mentorship-sharing-panel__jobs">
                <div className="mentorship-section-header">
                  <div>
                    <p className="mentorship-card__eyebrow">Job applications</p>
                    <h3>How much of your pipeline should mentors see?</h3>
                  </div>
                </div>

                <div className="mentorship-job-sharing-options">
                  {jobSharingModes.map((mode) => (
                    <label
                      key={mode.value}
                      className={`mentorship-job-sharing-option ${jobSharingMode === mode.value ? 'active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="jobSharingMode"
                        value={mode.value}
                        checked={jobSharingMode === mode.value}
                        onChange={() => handleJobSharingModeChange(mode.value)}
                      />
                      <div>
                        <span>{mode.label}</span>
                        <p>{mode.helper}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {jobSharingMode === 'selected' ? (
                  availableJobs.length === 0 ? (
                    <p className="mentorship-empty">You haven't added any job applications yet.</p>
                  ) : (
                    <ul className="mentorship-job-list">
                      {availableJobs.map((job) => {
                        const shared = selectedJobMap[job.id];
                        return (
                          <li key={job.id} className="mentorship-job-row">
                            <label className="mentorship-job-row__header">
                              <input
                                type="checkbox"
                                checked={!!shared}
                                onChange={() => toggleJobShare(job)}
                              />
                              <div>
                                <div className="mentorship-job-row__title">{job.title} @ {job.company_name}</div>
                                <p className="muted">Status: {job.status}</p>
                              </div>
                            </label>
                            {shared && (
                              <div className="mentorship-job-row__details">
                                <label className="mentorship-job-row__notes">
                                  Notes for your mentor (optional)
                                  <textarea
                                    value={shared.notes || ''}
                                    onChange={(e) => updateSharedApplication(job.id, e.target.value)}
                                    placeholder="Add context or action items for this application."
                                  />
                                </label>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )
                ) : (
                  <p className="mentorship-empty">{activeJobMode?.helper}</p>
                )}
              </div>

              <div className="mentorship-sharing-panel__footer">
                <button
                  className="mentorship-btn mentorship-btn--primary"
                  type="button"
                  onClick={handleSaveSharing}
                  disabled={savingShare}
                >
                  {savingShare ? 'Saving...' : 'Save sharing settings'}
                </button>
                {shareFeedback.success && (
                  <span className="mentorship-feedback mentorship-feedback--success">{shareFeedback.success}</span>
                )}
                {shareFeedback.error && (
                  <span className="mentorship-feedback mentorship-feedback--error">{shareFeedback.error}</span>
                )}
              </div>
            </>
          )}
        </section>
      )}

      <div className="mentorship-grid mentorship-grid--two" style={{ marginBottom: 24 }}>
        <section className="mentorship-card">
          <header className="mentorship-section-header">
            <div>
              <p className="mentorship-card__eyebrow">Awaiting your decision</p>
              <h3>Incoming requests</h3>
            </div>
          </header>
          {emptyState.incoming ? (
            <p className="mentorship-empty">No one has requested you as a mentor yet.</p>
          ) : (
            requests.incoming.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                variant="incoming"
                onAccept={(id) => handleRespond(id, 'accept')}
                onDecline={(id) => handleRespond(id, 'decline')}
              />
            ))
          )}
        </section>

        <section className="mentorship-card">
          <header className="mentorship-section-header">
            <div>
              <p className="mentorship-card__eyebrow">Awaiting response</p>
              <h3>Outgoing invitations</h3>
            </div>
          </header>
          {emptyState.outgoing ? (
            <p className="mentorship-empty">You haven't invited any mentors or mentees yet.</p>
          ) : (
            requests.outgoing.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                variant="outgoing"
                onCancel={handleCancel}
              />
            ))
          )}
        </section>
      </div>

      <div className="mentorship-grid mentorship-grid--two">
        <section className="mentorship-card">
          <header className="mentorship-section-header">
            <div>
              <p className="mentorship-card__eyebrow">Guiding you</p>
              <h3>Your mentors</h3>
            </div>
          </header>
          {emptyState.mentors ? (
            <p className="mentorship-empty">No mentors yet. Accept an invitation or invite someone.</p>
          ) : (
            relationships.mentors.map((item) => {
              const settings = item.share_settings;
              const sharedSections = settings
                ? Object.entries(sectionLabels)
                    .filter(([key]) => settings[key])
                    .map(([, info]) => info.title)
                : [];
              const jobMode = settings?.job_sharing_mode || 'none';
              return (
                <RelationshipCard key={item.id} item={item}>
                  <div className="mentorship-shared-summary">
                    {sharedSections.length > 0 ? (
                      <>
                        <span>Sharing:</span>
                        <div className="mentorship-chip-row">
                          {sharedSections.map((label) => (
                            <span key={label} className="mentorship-chip">{label}</span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <span className="muted">Not sharing profile sections yet.</span>
                    )}
                    <p className="muted" style={{ marginTop: 8 }}>
                      Job sharing mode: {jobSharingModes.find((mode) => mode.value === jobMode)?.label || 'Not sharing'}
                    </p>
                  </div>
                  <div className="mentorship-mentee-actions">
                    <button
                      type="button"
                      className="mentorship-btn mentorship-btn--ghost"
                      onClick={() => navigate(`/mentorship/mentees/${item.id}`)}
                    >
                      View shared data & goals
                    </button>
                  </div>
                </RelationshipCard>
              );
            })
          )}
        </section>

        <section className="mentorship-card">
          <header className="mentorship-section-header">
            <div>
              <p className="mentorship-card__eyebrow">People you're supporting</p>
              <h3>Your mentees</h3>
            </div>
          </header>
          {emptyState.mentees ? (
            <p className="mentorship-empty">You're not mentoring anyone yet.</p>
          ) : (
            relationships.mentees.map((item) => (
              <RelationshipCard key={item.id} item={item}>
                <div className="mentorship-mentee-actions">
                  <button
                    type="button"
                    className="mentorship-btn mentorship-btn--ghost"
                    onClick={() => navigate(`/mentorship/mentees/${item.id}`)}
                  >
                    Open mentee dashboard
                  </button>
                </div>
              </RelationshipCard>
            ))
          )}
        </section>
      </div>
    </div>
  );
};

export default MentorshipDashboard;
