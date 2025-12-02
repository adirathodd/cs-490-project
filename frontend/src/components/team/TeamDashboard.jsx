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

const emptyTeamForm = { name: '', billing_email: '', subscription_plan: 'starter', seat_limit: 5 };

const StatPill = ({ label, value }) => (
  <div className="stat-pill">
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
  </div>
);

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
  const [detail, setDetail] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [messages, setMessages] = useState([]);
  const [subscriptionForm, setSubscriptionForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      loadTeamDetail(selectedTeamId);
      loadDashboard(selectedTeamId);
      loadMessages(selectedTeamId);
    } else {
      setDetail(null);
      setDashboard(null);
      setMessages([]);
    }
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
      await teamAPI.inviteMember(selectedTeamId, inviteForm);
      handleToast('Invitation sent');
      setInviteForm({ email: '', role: 'mentor', permission_level: 'comment' });
      loadTeamDetail(selectedTeamId);
    } catch (err) {
      handleToast(err.message || 'Unable to send invite', true);
    }
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
      await teamAPI.postMessage(selectedTeamId, { message: newMessage });
      setNewMessage('');
      loadMessages(selectedTeamId);
    } catch (err) {
      handleToast(err.message || 'Unable to send message', true);
    }
  };

  const memberCandidates = useMemo(() => {
    const members = detail?.members || [];
    return members.filter((m) => m.role === 'candidate' && m.candidate_profile);
  }, [detail]);

  return (
    <div className="team-page">
      <header className="team-hero">
        <div>
          <p className="eyebrow">Team Collaboration</p>
          <h1>Coach multiple candidates with one workspace</h1>
          <p className="subtitle">
            Create team accounts, manage permissions, and keep mentors, admins, and candidates aligned with live progress.
          </p>
        </div>
        <div className="team-hero-stats">
          <StatPill label="Teams" value={teams.length} />
          <StatPill label="Members" value={detail?.members?.length || 0} />
          <StatPill label="Active goals" value={dashboard?.progress?.active_goals || 0} />
        </div>
      </header>

      {(error || success) && (
        <div className={`toast ${error ? 'error' : 'success'}`}>
          {error || success}
        </div>
      )}

      <section className="team-grid">
        <div className="team-card">
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

        <div className="team-card">
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
              <div className="chip-row">
                {detail.invitations.map((invite) => (
                  <span className="pill pill-muted" key={invite.id}>
                    {invite.email} · {invite.role} ({invite.permission_level})
                  </span>
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

        <div className="team-card">
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
                  <StatPill label="Offers" value={dashboard.pipeline?.offer || 0} />
                </div>
              </div>
              <div className="stat-block">
                <p className="muted">Progress</p>
                <div className="stat-list">
                  <StatPill label="Active goals" value={dashboard.progress?.active_goals || 0} />
                  <StatPill label="Completed" value={dashboard.progress?.completed_goals || 0} />
                  <StatPill label="Apps this week" value={dashboard.progress?.weekly_applications || 0} />
                </div>
              </div>
              <div className="stat-block">
                <p className="muted">Activity</p>
                <ul className="activity-feed">
                  {(dashboard.recent_activity || []).map((item, idx) => (
                    <li key={`${item.type}-${idx}`}>
                      <span className="pill pill-muted">{item.type}</span>
                      <div>
                        <strong>{item.title || item.status}</strong>
                        {item.company && <span className="muted"> · {item.company}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="empty-state">Select a team to view aggregated progress.</div>
          )}
        </div>

        <div className="team-card">
          <div className="card-header">
            <h3>Collaboration feed</h3>
            <span className="hint">Share updates across admins, mentors, and candidates</span>
          </div>
          <div className="message-feed">
            {messages.length ? messages.map((msg) => (
              <div className="message-row" key={msg.id}>
                <div>
                  <strong>{msg.author_profile?.full_name || msg.author_profile?.email}</strong>
                  <p>{msg.message}</p>
                </div>
                <span className="pill pill-muted">{msg.message_type}</span>
              </div>
            )) : <div className="empty-state">No messages yet.</div>}
          </div>
          {selectedTeamId && (
            <form className="inline-form" onSubmit={handleMessageSubmit}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Post a quick update for the team"
              />
              <button type="submit" className="primary-btn">Post</button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
