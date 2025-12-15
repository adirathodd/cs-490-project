import React, { useEffect, useMemo, useState } from 'react';
import { teamAPI } from '../../services/api';
import './TeamDashboard.css';

const planOptions = [
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

const permissionOptions = [
  { value: 'view', label: 'View' },
  { value: 'comment', label: 'Comment' },
  { value: 'edit', label: 'Edit' },
  { value: 'admin', label: 'Admin' },
];

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'candidate', label: 'Candidate' },
];

const messageTypes = [
  { value: 'update', label: 'Update' },
  { value: 'milestone', label: '🎉 Milestone' },
  { value: 'question', label: '❓ Question' },
  { value: 'feedback', label: '💬 Feedback' },
  { value: 'celebration', label: '🎊 Celebration' },
];

const emptyTeamForm = { name: '', billing_email: '', subscription_plan: 'starter', seat_limit: 5 };

const StatPill = ({ label, value, highlight }) => (
  <div className={`stat-pill ${highlight ? 'stat-pill-highlight' : ''}`}>
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
  </div>
);

const MilestoneCard = ({ activity }) => {
  const isMilestone = activity.type === 'offer' || 
                      activity.status === 'offer' || 
                      activity.status === 'completed' ||
                      activity.type === 'milestone';
  
  return (
    <li className={`activity-item ${isMilestone ? 'milestone' : ''}`}>
      <span className={`activity-badge ${activity.type || 'job'}`}>
        {activity.type === 'goal' ? '🎯' : 
         activity.status === 'offer' ? '🎉' :
         activity.status === 'interview' ? '📅' :
         activity.status === 'phone_screen' ? '📞' :
         activity.type === 'milestone' ? '⭐' : '💼'}
      </span>
      <div className="activity-content">
        <strong>{activity.title || activity.status}</strong>
        {activity.company && <span className="muted"> · {activity.company}</span>}
        {activity.candidate_name && <span className="muted"> · {activity.candidate_name}</span>}
        {isMilestone && <span className="milestone-label">Milestone!</span>}
      </div>
      <span className="activity-time">
        {activity.updated_at ? new Date(activity.updated_at).toLocaleDateString() : 
         activity.created_at ? new Date(activity.created_at).toLocaleDateString() : ''}
      </span>
    </li>
  );
};

export default function TeamDashboard() {
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [teamForm, setTeamForm] = useState(emptyTeamForm);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'mentor', permission_level: 'comment' });
  const [accessForm, setAccessForm] = useState({
    member_id: '',
    candidate_id: '',
    permission_level: 'view',
    can_view_profile: true,
    can_view_progress: true,
    can_edit_goals: false,
  });
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState('update');
  const [detail, setDetail] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reports, setReports] = useState(null);
  const [subscriptionForm, setSubscriptionForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, members, reports, shared
  const [myPendingInvites, setMyPendingInvites] = useState([]);
  // Shared Jobs State
  const [sharedJobs, setSharedJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [selectedJobToShare, setSelectedJobToShare] = useState('');
  const [shareNote, setShareNote] = useState('');
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    loadTeams();
    loadMyPendingInvites();
    loadMyJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      loadTeamDetail(selectedTeamId);
      loadDashboard(selectedTeamId);
      loadMessages(selectedTeamId);
      loadReports(selectedTeamId);
      loadSharedJobs(selectedTeamId);
    } else {
      setDetail(null);
      setDashboard(null);
      setMessages([]);
      setReports(null);
      setSharedJobs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamId]);

  const selectedTeam = useMemo(() => {
    return teams.find((t) => t.id === selectedTeamId);
  }, [teams, selectedTeamId]);

  useEffect(() => {
    if (selectedTeam) {
      setSubscriptionForm({
        subscription_plan: selectedTeam.subscription_plan,
        billing_email: selectedTeam.billing_email || '',
        seat_limit: selectedTeam.seat_limit || 5,
      });
    }
  }, [selectedTeam]);

  const handleToast = (msg, isError = false) => {
    setError(isError ? msg : '');
    setSuccess(isError ? '' : msg);
    if (msg) {
      setTimeout(() => {
        setError('');
        setSuccess('');
      }, 3500);
    }
  };

  const loadTeams = async () => {
    try {
      const data = await teamAPI.listAccounts();
      const items = data.teams || [];
      setTeams(items);
      if (!selectedTeamId && items.length) {
        setSelectedTeamId(items[0].id);
      }
    } catch (err) {
      handleToast(err.message || 'Unable to load teams', true);
    }
  };

  const loadMyPendingInvites = async () => {
    try {
      const data = await teamAPI.getMyPendingInvites();
      setMyPendingInvites(data.invitations || []);
    } catch (err) {
      // Silently fail - user might not have any invites
      setMyPendingInvites([]);
    }
  };

  const acceptPendingInvite = async (token) => {
    setLoading(true);
    try {
      await teamAPI.acceptInvite(token);
      handleToast('Successfully joined the team!');
      loadMyPendingInvites();
      loadTeams();
    } catch (err) {
      handleToast(err.message || 'Failed to accept invitation', true);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamDetail = async (teamId) => {
    try {
      const data = await teamAPI.getAccount(teamId);
      setDetail(data);
    } catch (err) {
      handleToast(err.message || 'Unable to load team details', true);
    }
  };

  const loadDashboard = async (teamId) => {
    try {
      const data = await teamAPI.getDashboard(teamId);
      setDashboard(data);
    } catch (err) {
      setDashboard(null);
      handleToast(err.message || 'Unable to load dashboard', true);
    }
  };

  const loadMessages = async (teamId) => {
    try {
      const data = await teamAPI.listMessages(teamId);
      setMessages(data.messages || []);
    } catch (err) {
      handleToast(err.message || 'Unable to load team messages', true);
    }
  };

  const loadReports = async (teamId) => {
    try {
      const data = await teamAPI.getReports(teamId);
      setReports(data);
    } catch (err) {
      setReports(null);
    }
  };

  // Shared Jobs Functions
  const loadMyJobs = async () => {
    try {
      const data = await teamAPI.getMyShareableJobs();
      setMyJobs(data || []);
    } catch (err) {
      console.error('Failed to load shareable jobs:', err);
    }
  };

  const loadSharedJobs = async (teamId) => {
    try {
      const data = await teamAPI.listSharedJobs(teamId);
      setSharedJobs(data || []);
    } catch (err) {
      setSharedJobs([]);
    }
  };

  const handleShareJob = async (e) => {
    e.preventDefault();
    if (!selectedTeamId || !selectedJobToShare) return;
    setLoading(true);
    try {
      const newShared = await teamAPI.shareJob(selectedTeamId, {
        job_id: Number(selectedJobToShare),
        note: shareNote.trim(),
      });
      handleToast('Job shared with team');
      setSharedJobs((prev) => [newShared, ...prev]);
      setSelectedJobToShare('');
      setShareNote('');
    } catch (err) {
      handleToast(err.message || 'Failed to share job', true);
    } finally {
      setLoading(false);
    }
  };

  const handleUnshareJob = async (sharedJobId) => {
    if (!selectedTeamId) return;
    try {
      await teamAPI.unshareJob(selectedTeamId, sharedJobId);
      setSharedJobs((prev) => prev.filter((j) => j.id !== sharedJobId));
      handleToast('Job removed from shared resources');
    } catch (err) {
      handleToast(err.message || 'Failed to remove job', true);
    }
  };

  const handleAddComment = async (sharedJobId) => {
    if (!selectedTeamId || !newComment.trim()) return;
    try {
      const comment = await teamAPI.addSharedJobComment(selectedTeamId, sharedJobId, newComment.trim());
      setSharedJobs((prev) =>
        prev.map((j) =>
          j.id === sharedJobId
            ? { ...j, comments: [...(j.comments || []), comment], comment_count: (j.comment_count || 0) + 1 }
            : j
        )
      );
      setNewComment('');
      handleToast('Comment added');
    } catch (err) {
      handleToast(err.message || 'Failed to add comment', true);
    }
  };

  const handleDeleteComment = async (sharedJobId, commentId) => {
    if (!selectedTeamId) return;
    try {
      await teamAPI.deleteSharedJobComment(selectedTeamId, sharedJobId, commentId);
      setSharedJobs((prev) =>
        prev.map((j) =>
          j.id === sharedJobId
            ? { ...j, comments: (j.comments || []).filter((c) => c.id !== commentId), comment_count: Math.max(0, (j.comment_count || 1) - 1) }
            : j
        )
      );
      handleToast('Comment deleted');
    } catch (err) {
      handleToast(err.message || 'Failed to delete comment', true);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: teamForm.name.trim(),
        billing_email: teamForm.billing_email.trim(),
        subscription_plan: teamForm.subscription_plan,
        seat_limit: Number(teamForm.seat_limit) || 5,
      };
      const newTeam = await teamAPI.createAccount(payload);
      handleToast('Team account created');
      setTeams((prev) => [...prev, newTeam]);
      setSelectedTeamId(newTeam.id);
      setTeamForm(emptyTeamForm);
    } catch (err) {
      handleToast(err.message || 'Unable to create team', true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionSave = async () => {
    if (!selectedTeamId || !subscriptionForm) return;
    try {
      const payload = {
        subscription_plan: subscriptionForm.subscription_plan,
        billing_email: subscriptionForm.billing_email,
        seat_limit: subscriptionForm.seat_limit,
      };
      const updated = await teamAPI.updateSubscription(selectedTeamId, payload);
      handleToast('Subscription updated');
      setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      handleToast(err.message || 'Unable to update subscription', true);
    }
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTeamId) return;
    try {
      const result = await teamAPI.inviteMember(selectedTeamId, inviteForm);
      const inviteLink = `${window.location.origin}/team/invite/${result.token}`;
      handleToast(`Invitation created! Link copied to clipboard.`);
      navigator.clipboard.writeText(inviteLink).catch(() => {});
      setInviteForm({ email: '', role: 'mentor', permission_level: 'comment' });
      loadTeamDetail(selectedTeamId);
    } catch (err) {
      handleToast(err.message || 'Unable to send invite', true);
    }
  };

  const copyInviteLink = (token) => {
    const inviteLink = `${window.location.origin}/team/invite/${token}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      handleToast('Invite link copied to clipboard!');
    }).catch(() => {
      handleToast('Failed to copy link', true);
    });
  };

  const updateMemberPermission = async (memberId, updates) => {
    if (!selectedTeamId) return;
    try {
      await teamAPI.updateMember(memberId, updates);
      handleToast('Member updated');
      loadTeamDetail(selectedTeamId);
    } catch (err) {
      handleToast(err.message || 'Unable to update member', true);
    }
  };

  const handleAccessSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTeamId) return;
    try {
      await teamAPI.upsertAccess(selectedTeamId, accessForm);
      handleToast('Access updated');
      loadTeamDetail(selectedTeamId);
    } catch (err) {
      handleToast(err.message || 'Unable to update access', true);
    }
  };

  const handleMessageSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTeamId || !newMessage.trim()) return;
    try {
      await teamAPI.postMessage(selectedTeamId, { 
        message: newMessage,
        message_type: messageType 
      });
      setNewMessage('');
      setMessageType('update');
      loadMessages(selectedTeamId);
      handleToast('Message posted');
    } catch (err) {
      handleToast(err.message || 'Unable to send message', true);
    }
  };

  const memberCandidates = useMemo(() => {
    const members = detail?.members || [];
    return members.filter((m) => m.role === 'candidate' && m.candidate_profile);
  }, [detail]);

  // Compute milestones from recent activity
  const milestones = useMemo(() => {
    const activity = dashboard?.recent_activity || [];
    return activity.filter(item => 
      item.status === 'offer' || 
      item.status === 'completed' ||
      item.type === 'milestone'
    );
  }, [dashboard]);

  // Get sorted and enhanced activity feed
  const enhancedActivity = useMemo(() => {
    const activity = dashboard?.recent_activity || [];
    return activity.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0);
      const dateB = new Date(b.updated_at || b.created_at || 0);
      return dateB - dateA;
    });
  }, [dashboard]);

  return (
    <div className="team-page">
      <header className="team-hero">
        <div>
          <p className="eyebrow">Team collaboration</p>
          <h1>Coach multiple candidates with one workspace</h1>
          <p className="subtitle">
            Create team accounts, manage permissions, and keep mentors, admins, and candidates aligned with live progress.
          </p>
        </div>
        <div className="team-hero-stats">
          <StatPill label="Teams" value={teams.length} />
          <StatPill label="Members" value={detail?.members?.length || 0} />
          <StatPill label="Active goals" value={dashboard?.progress?.active_goals || 0} />
          {milestones.length > 0 && (
            <StatPill label="Milestones" value={milestones.length} highlight />
          )}
        </div>
      </header>

      {(error || success) && (
        <div className={`toast ${error ? 'error' : 'success'}`}>
          {error || success}
        </div>
      )}

      {/* Pending Invitations for Current User */}
      {myPendingInvites.length > 0 && (
        <div className="pending-invites-banner">
          <div className="pending-invites-header">
            <span className="pending-invites-icon">📬</span>
            <h3>You have {myPendingInvites.length} pending team invitation{myPendingInvites.length > 1 ? 's' : ''}</h3>
          </div>
          <div className="pending-invites-list">
            {myPendingInvites.map((invite) => (
              <div className="pending-invite-card" key={invite.id}>
                <div className="pending-invite-info">
                  <strong>{invite.team_name}</strong>
                  <span className="muted">
                    Role: {invite.role} · Invited by {invite.invited_by}
                  </span>
                </div>
                <button
                  className="primary-btn"
                  onClick={() => acceptPendingInvite(invite.token)}
                  disabled={loading}
                >
                  {loading ? 'Joining...' : 'Accept Invitation'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <nav className="team-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          👥 Members & Access
        </button>
        <button 
          className={`tab-btn ${activeTab === 'shared' ? 'active' : ''}`}
          onClick={() => setActiveTab('shared')}
        >
          📂 Shared Resources
        </button>
        <button 
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          📈 Analytics
        </button>
      </nav>

      <section className="team-grid">
        {/* Team Selector - Always visible */}
        <div className="team-card team-selector-card">
          <div className="card-header">
            <h3>Team accounts</h3>
            <span className="hint">Switch between coaching workspaces</span>
          </div>
          <div className="team-switcher">
            {teams.map((team) => (
              <button
                key={team.id}
                className={`switcher-btn ${team.id === selectedTeamId ? 'active' : ''}`}
                onClick={() => setSelectedTeamId(team.id)}
              >
                <div className="switcher-name">{team.name}</div>
                <div className="switcher-meta">
                  {team.subscription_plan} · {team.member_counts?.total || 0} members
                </div>
              </button>
            ))}
            {!teams.length && <div className="empty-state">No teams yet. Create one below.</div>}
          </div>
          {selectedTeam && subscriptionForm && (
            <div className="subscription-box">
              <h4>Billing & subscription</h4>
              <div className="form-row">
                <label>
                  Plan
                  <select
                    value={subscriptionForm.subscription_plan}
                    onChange={(e) => setSubscriptionForm({ ...subscriptionForm, subscription_plan: e.target.value })}
                  >
                    {planOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Seats
                  <input
                    type="number"
                    min="1"
                    value={subscriptionForm.seat_limit}
                    onChange={(e) => setSubscriptionForm({ ...subscriptionForm, seat_limit: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Billing email
                <input
                  type="email"
                  value={subscriptionForm.billing_email}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, billing_email: e.target.value })}
                  placeholder="billing@team.com"
                />
              </label>
              <button type="button" className="secondary-btn" onClick={handleSubscriptionSave}>
                Save subscription
              </button>
            </div>
          )}
          <form className="stacked-form" onSubmit={handleCreateTeam}>
            <h4>Create new team</h4>
            <label>
              Team name
              <input
                type="text"
                value={teamForm.name}
                onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                placeholder="e.g., Career Coaching Squad"
                required
              />
            </label>
            <label>
              Billing email
              <input
                type="email"
                value={teamForm.billing_email}
                onChange={(e) => setTeamForm({ ...teamForm, billing_email: e.target.value })}
                placeholder="ops@coaching.com"
              />
            </label>
            <div className="form-row">
              <label>
                Plan
                <select
                  value={teamForm.subscription_plan}
                  onChange={(e) => setTeamForm({ ...teamForm, subscription_plan: e.target.value })}
                >
                  {planOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Seats
                <input
                  type="number"
                  min="1"
                  value={teamForm.seat_limit}
                  onChange={(e) => setTeamForm({ ...teamForm, seat_limit: e.target.value })}
                />
              </label>
            </div>
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Creating...' : 'Create team'}
            </button>
          </form>
        </div>

        {/* Overview Tab Content */}
        {activeTab === 'overview' && (
          <>
            {/* Team Dashboard Stats */}
            <div className="team-card span-2">
              <div className="card-header">
                <h3>Team dashboard</h3>
                <span className="hint">Aggregate pipeline + progress</span>
              </div>
              {dashboard ? (
                <div className="dashboard-grid">
                  <div className="stat-block">
                    <p className="muted">Pipeline</p>
                    <div className="stat-list">
                      <StatPill label="Applied" value={dashboard.pipeline?.applied || 0} />
                      <StatPill label="Screens" value={dashboard.pipeline?.phone_screen || 0} />
                      <StatPill label="Interviews" value={dashboard.pipeline?.interview || 0} />
                      <StatPill label="Offers" value={dashboard.pipeline?.offer || 0} highlight={dashboard.pipeline?.offer > 0} />
                    </div>
                  </div>
                  <div className="stat-block">
                    <p className="muted">Progress</p>
                    <div className="stat-list">
                      <StatPill label="Active goals" value={dashboard.progress?.active_goals || 0} />
                      <StatPill label="Completed" value={dashboard.progress?.completed_goals || 0} highlight={dashboard.progress?.completed_goals > 0} />
                      <StatPill label="Apps this week" value={dashboard.progress?.weekly_applications || 0} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">Select a team to view aggregated progress.</div>
              )}
            </div>

            {/* Enhanced Activity Feed with Milestones */}
            <div className="team-card">
              <div className="card-header">
                <h3>Activity feed</h3>
                <span className="hint">Real-time updates and milestones</span>
              </div>
              {milestones.length > 0 && (
                <div className="milestones-banner">
                  <span className="milestone-icon">🎉</span>
                  <span>{milestones.length} milestone{milestones.length > 1 ? 's' : ''} achieved!</span>
                </div>
              )}
              <ul className="activity-feed enhanced">
                {enhancedActivity.length ? enhancedActivity.map((item, idx) => (
                  <MilestoneCard key={`${item.type}-${idx}`} activity={item} />
                )) : (
                  <li className="empty-state">No recent activity.</li>
                )}
              </ul>
            </div>

            {/* Collaboration Feed */}
            <div className="team-card span-2">
              <div className="card-header">
                <h3>Collaboration feed</h3>
                <span className="hint">Share updates, celebrate wins, and ask questions</span>
              </div>
              <div className="message-feed">
                {messages.length ? messages.map((msg) => (
                  <div className={`message-row ${msg.message_type === 'milestone' || msg.message_type === 'celebration' ? 'celebration' : ''}`} key={msg.id}>
                    <div className="message-content">
                      <div className="message-header">
                        <strong>{msg.author_profile?.full_name || msg.author_profile?.email}</strong>
                        <span className="message-time">
                          {msg.created_at ? new Date(msg.created_at).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <p>{msg.message}</p>
                    </div>
                    <span className={`pill ${msg.message_type === 'milestone' || msg.message_type === 'celebration' ? 'pill-success' : 'pill-muted'}`}>
                      {messageTypes.find(t => t.value === msg.message_type)?.label || msg.message_type}
                    </span>
                  </div>
                )) : <div className="empty-state">No messages yet. Start the conversation!</div>}
              </div>
              {selectedTeamId && (
                <form className="message-form" onSubmit={handleMessageSubmit}>
                  <div className="message-input-row">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Share an update, ask a question, or celebrate a win..."
                      rows={3}
                    />
                  </div>
                  <div className="message-input-controls" style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <select 
                      value={messageType} 
                      onChange={(e) => setMessageType(e.target.value)}
                      className="message-type-select"
                    >
                      {messageTypes.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <button type="submit" className="primary-btn">Post</button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}

        {/* Members Tab Content */}
        {activeTab === 'members' && (
          <>
            <div className="team-card span-2">
              <div className="card-header">
                <h3>Members & permissions</h3>
                <span className="hint">Admins, mentors, and candidate seats</span>
              </div>
              {detail?.members?.length ? (
                <table className="member-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                      <th>Permission</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.members.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <div className="member-name">
                            <strong>{member.user_profile?.full_name || member.user_profile?.email}</strong>
                            <span className="muted">{member.user_profile?.email}</span>
                          </div>
                        </td>
                        <td>
                          <select
                            value={member.role}
                            onChange={(e) => updateMemberPermission(member.id, { role: e.target.value })}
                          >
                            {roleOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            value={member.permission_level}
                            onChange={(e) => updateMemberPermission(member.id, { permission_level: e.target.value })}
                          >
                            {permissionOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <span className={`pill ${member.is_active ? 'pill-success' : 'pill-muted'}`}>
                            {member.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">Select or create a team to manage members.</div>
              )}
              {detail?.invitations?.length ? (
                <div className="invite-list">
                  <p className="muted small">Open invitations</p>
                  <div className="invite-cards">
                    {detail.invitations.map((invite) => (
                      <div className="invite-card" key={invite.id}>
                        <div className="invite-info">
                          <strong>{invite.email}</strong>
                          <span className="muted">{invite.role} · {invite.permission_level}</span>
                        </div>
                        <button 
                          type="button" 
                          className="copy-link-btn"
                          onClick={() => copyInviteLink(invite.token)}
                          title="Copy invite link"
                        >
                          📋 Copy Link
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedTeamId && (
                <form className="inline-form" onSubmit={handleInviteSubmit}>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="Invite by email"
                  />
                  <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}>
                    {roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <select
                    value={inviteForm.permission_level}
                    onChange={(e) => setInviteForm({ ...inviteForm, permission_level: e.target.value })}
                  >
                    {permissionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button type="submit" className="secondary-btn">Send invite</button>
                </form>
              )}
            </div>

            <div className="team-card">
              <div className="card-header">
                <h3>Access control</h3>
                <span className="hint">Pair mentors with candidates and set visibility</span>
              </div>
              {detail?.access?.length ? (
                <div className="access-grid">
                  {detail.access.map((item) => (
                    <div className="access-chip" key={item.id}>
                      <div>
                        <div className="muted">Mentor</div>
                        <strong>{item.member?.user_profile?.full_name || item.member?.user_profile?.email}</strong>
                      </div>
                      <div>
                        <div className="muted">Candidate</div>
                        <strong>{item.candidate?.full_name || item.candidate?.email}</strong>
                      </div>
                      <div className="muted small">
                        {item.permission_level} · profile {item.can_view_profile ? 'on' : 'off'} · progress {item.can_view_progress ? 'on' : 'off'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No access grants yet.</div>
              )}
              {selectedTeamId && (
                <form className="stacked-form" onSubmit={handleAccessSubmit}>
                  <div className="form-row">
                    <label>
                      Mentor membership
                      <select
                        required
                        value={accessForm.member_id}
                        onChange={(e) => setAccessForm({ ...accessForm, member_id: e.target.value })}
                      >
                        <option value="">Select mentor</option>
                        {(detail?.members || [])
                          .filter((m) => m.role === 'mentor' || m.role === 'admin')
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.user_profile?.full_name || m.user_profile?.email}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Candidate
                      <select
                        required
                        value={accessForm.candidate_id}
                        onChange={(e) => setAccessForm({ ...accessForm, candidate_id: e.target.value })}
                      >
                        <option value="">Select candidate</option>
                        {memberCandidates.map((m) => (
                          <option key={m.id} value={m.candidate_profile.id}>
                            {m.user_profile?.full_name || m.user_profile?.email}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      Permission
                      <select
                        value={accessForm.permission_level}
                        onChange={(e) => setAccessForm({ ...accessForm, permission_level: e.target.value })}
                      >
                        {permissionOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="checkbox-inline">
                      <input
                        type="checkbox"
                        checked={accessForm.can_edit_goals}
                        onChange={(e) => setAccessForm({ ...accessForm, can_edit_goals: e.target.checked })}
                      />
                      Allow editing goals
                    </label>
                  </div>
                  <div className="form-row">
                    <label className="checkbox-inline">
                      <input
                        type="checkbox"
                        checked={accessForm.can_view_profile}
                        onChange={(e) => setAccessForm({ ...accessForm, can_view_profile: e.target.checked })}
                      />
                      Share profile + documents
                    </label>
                    <label className="checkbox-inline">
                      <input
                        type="checkbox"
                        checked={accessForm.can_view_progress}
                        onChange={(e) => setAccessForm({ ...accessForm, can_view_progress: e.target.checked })}
                      />
                      Share live progress
                    </label>
                  </div>
                  <button type="submit" className="secondary-btn">Save access</button>
                </form>
              )}
            </div>
          </>
        )}

        {/* Reports Tab Content */}
        {/* Shared Resources Tab */}
        {activeTab === 'shared' && (
          <>
            {/* Share Job Form */}
            <div className="team-card span-2">
              <div className="card-header">
                <h3>Share a Job Posting</h3>
                <span className="hint">Share job opportunities with your team for feedback</span>
              </div>
              {selectedTeamId ? (
                <form className="share-job-form" onSubmit={handleShareJob}>
                  <div className="form-row">
                    <select
                      value={selectedJobToShare}
                      onChange={(e) => setSelectedJobToShare(e.target.value)}
                      className="job-select"
                    >
                      <option value="">Select a job to share...</option>
                      {myJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title} at {job.company} ({job.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <textarea
                      value={shareNote}
                      onChange={(e) => setShareNote(e.target.value)}
                      placeholder="Add a note (optional) - e.g., 'Looking for feedback on my application approach'"
                      rows={2}
                    />
                  </div>
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={!selectedJobToShare || loading}
                  >
                    {loading ? 'Sharing...' : '📤 Share with Team'}
                  </button>
                </form>
              ) : (
                <div className="empty-state">Select a team to share jobs.</div>
              )}
            </div>

            {/* Shared Jobs List */}
            <div className="team-card span-2">
              <div className="card-header">
                <h3>Shared Job Postings</h3>
                <span className="hint">{sharedJobs.length} jobs shared with the team</span>
              </div>
              <div className="shared-jobs-list">
                {sharedJobs.length > 0 ? (
                  sharedJobs.map((sharedJob) => (
                    <div className="shared-job-card" key={sharedJob.id}>
                      <div className="shared-job-header">
                        <div className="shared-job-info">
                          <h4>{sharedJob.job_details?.title}</h4>
                          <span className="company-name">{sharedJob.job_details?.company}</span>
                          {sharedJob.job_details?.location && (
                            <span className="job-location">📍 {sharedJob.job_details.location}</span>
                          )}
                          <span className={`status-badge status-${sharedJob.job_details?.status}`}>
                            {sharedJob.job_details?.status}
                          </span>
                        </div>
                        <div className="shared-job-actions">
                          <button
                            className="icon-btn"
                            onClick={() => setExpandedJobId(expandedJobId === sharedJob.id ? null : sharedJob.id)}
                            title="View comments"
                          >
                            💬 {sharedJob.comment_count || 0}
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={() => handleUnshareJob(sharedJob.id)}
                            title="Remove from shared"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      {sharedJob.note && (
                        <div className="shared-job-note">
                          💭 "{sharedJob.note}"
                        </div>
                      )}
                      <div className="shared-job-meta">
                        <span>Shared by {sharedJob.shared_by_profile?.full_name}</span>
                        <span>{new Date(sharedJob.shared_at).toLocaleDateString()}</span>
                      </div>

                      {/* Comments Section */}
                      {expandedJobId === sharedJob.id && (
                        <div className="job-comments-section">
                          <h5>Team Comments</h5>
                          {sharedJob.comments && sharedJob.comments.length > 0 ? (
                            <div className="comments-list">
                              {sharedJob.comments.map((comment) => (
                                <div className="comment-item" key={comment.id}>
                                  <div className="comment-header">
                                    <strong>{comment.author_profile?.full_name}</strong>
                                    <span className="comment-time">
                                      {new Date(comment.created_at).toLocaleString()}
                                    </span>
                                    <button
                                      className="delete-comment-btn"
                                      onClick={() => handleDeleteComment(sharedJob.id, comment.id)}
                                      title="Delete comment"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <p className="comment-content">{comment.content}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="no-comments">No comments yet. Be the first to give feedback!</p>
                          )}
                          <div className="add-comment-form">
                            <textarea
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              placeholder="Add a comment or feedback..."
                              rows={2}
                            />
                            <button
                              className="secondary-btn"
                              onClick={() => handleAddComment(sharedJob.id)}
                              disabled={!newComment.trim()}
                            >
                              Post Comment
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    No jobs shared yet. Share your first job posting to get team feedback!
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'reports' && (
          <>
            <div className="team-card span-3">
              <div className="card-header">
                <h3>Team Analytics</h3>
                <span className="hint">Coaching performance insights</span>
              </div>
              {reports ? (
                <div className="reports-grid">
                  <div className="report-card">
                    <div className="report-icon">📝</div>
                    <div className="report-value">{reports.applications_per_candidate || 0}</div>
                    <div className="report-label">Avg applications per candidate</div>
                  </div>
                  <div className="report-card">
                    <div className="report-icon">📊</div>
                    <div className="report-value">{reports.interview_rate || 0}%</div>
                    <div className="report-label">Interview rate</div>
                  </div>
                  <div className="report-card highlight">
                    <div className="report-icon">🎯</div>
                    <div className="report-value">{reports.goal_completion_rate || 0}%</div>
                    <div className="report-label">Goal completion rate</div>
                  </div>
                  <div className="report-card">
                    <div className="report-icon">💬</div>
                    <div className="report-value">{reports.mentor_touchpoints || 0}</div>
                    <div className="report-label">Mentor touchpoints</div>
                  </div>
                  <div className="report-card">
                    <div className="report-icon">🎯</div>
                    <div className="report-value">{reports.open_goals || 0}</div>
                    <div className="report-label">Open goals</div>
                  </div>
                  <div className="report-card highlight">
                    <div className="report-icon">🎉</div>
                    <div className="report-value">{reports.recent_offers || 0}</div>
                    <div className="report-label">Recent offers</div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">Select a team to view analytics.</div>
              )}
            </div>

            {/* Pipeline Breakdown */}
            {dashboard && (
              <div className="team-card span-3">
                <div className="card-header">
                  <h3>Pipeline breakdown</h3>
                  <span className="hint">Application status distribution</span>
                </div>
                <div className="pipeline-visual">
                  <div className="pipeline-stage">
                    <div className="pipeline-bar" style={{
                      width: `${Math.min(100, (dashboard.pipeline?.applied || 0) * 5)}%`
                    }}></div>
                    <span className="pipeline-label">Applied</span>
                    <span className="pipeline-count">{dashboard.pipeline?.applied || 0}</span>
                  </div>
                  <div className="pipeline-stage">
                    <div className="pipeline-bar phone-screen" style={{
                      width: `${Math.min(100, (dashboard.pipeline?.phone_screen || 0) * 10)}%`
                    }}></div>
                    <span className="pipeline-label">Phone Screens</span>
                    <span className="pipeline-count">{dashboard.pipeline?.phone_screen || 0}</span>
                  </div>
                  <div className="pipeline-stage">
                    <div className="pipeline-bar interview" style={{
                      width: `${Math.min(100, (dashboard.pipeline?.interview || 0) * 15)}%`
                    }}></div>
                    <span className="pipeline-label">Interviews</span>
                    <span className="pipeline-count">{dashboard.pipeline?.interview || 0}</span>
                  </div>
                  <div className="pipeline-stage">
                    <div className="pipeline-bar offer" style={{
                      width: `${Math.min(100, (dashboard.pipeline?.offer || 0) * 20)}%`
                    }}></div>
                    <span className="pipeline-label">Offers 🎉</span>
                    <span className="pipeline-count">{dashboard.pipeline?.offer || 0}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
