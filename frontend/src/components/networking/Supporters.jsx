import React, { useEffect, useState } from 'react';
import { supportersAPI } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import './Supporters.css';

const defaultForm = { email: '', name: '', expires_in_days: 30 };

const Supporters = () => {
  const [invites, setInvites] = useState([]);
  const [encouragements, setEncouragements] = useState([]);
  const [chat, setChat] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(defaultForm);
  const [toast, setToast] = useState('');
  const [showCompany, setShowCompany] = useState(false);
  const [showPractice, setShowPractice] = useState(true);
  const [showAchievements, setShowAchievements] = useState(true);
  const [moodScore, setMoodScore] = useState('');
  const [moodNote, setMoodNote] = useState('');

  const loadInvites = () => {
    setLoading(true);
    supportersAPI
      .listInvites()
      .then((data) => {
        setInvites(data || []);
        setError('');
      })
      .catch((err) => {
        const msg = err?.error?.message || err?.message || 'Unable to load supporters.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInvites();
    supportersAPI
      .listEncouragements()
      .then((res) => {
        setEncouragements(res || []);
      })
      .catch(() => {
        /* silent */
      });
    supportersAPI
      .getMood()
      .then((res) => {
        if (res) {
          setMoodScore(res.score ?? '');
          setMoodNote(res.note || '');
        }
      })
      .catch(() => {
        /* silent */
      });
    loadChat();
  }, []);

  const handleSaveMood = (event) => {
    event.preventDefault();
    supportersAPI
      .updateMood({
        score: moodScore === '' ? null : Number(moodScore),
        note: moodNote,
      })
      .then(() => setToast('Mood saved'))
      .catch((err) => {
        const msg = err?.error?.message || err?.message || 'Unable to save mood.';
        setError(msg);
      });
  };

  const handleCreate = (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.email.trim()) {
      setError('Email is required.');
      return;
    }
    setSaving(true);
    supportersAPI
      .createInvite({
        email: form.email.trim(),
        name: form.name.trim(),
        expires_in_days: form.expires_in_days,
        permissions: {
          show_company: showCompany,
          show_practice: showPractice,
          show_achievements: showAchievements,
        },
      })
      .then(() => {
        setForm(defaultForm);
        setToast('Invite created. Copy the link below to share.');
        setError('');
        loadInvites();
      })
      .catch((err) => {
        const msg = err?.error?.message || err?.message || 'Unable to create invite.';
        setError(msg);
      })
      .finally(() => setSaving(false));
  };

  const toggleActive = (invite) => {
    supportersAPI
      .updateInvite(invite.id, { is_active: !invite.is_active })
      .then(() => loadInvites())
      .catch((err) => {
        const msg = err?.error?.message || err?.message || 'Unable to update invite.';
        setError(msg);
      });
  };

  const deleteInvite = (inviteId) => {
    supportersAPI
      .deleteInvite(inviteId)
      .then(() => {
        loadInvites();
      })
      .catch((err) => {
        const msg = err?.error?.message || err?.message || 'Unable to delete invite.';
        setError(msg);
      });
  };

  const loadChat = () => {
    setChatLoading(true);
    supportersAPI
      .candidateChat()
      .then((res) => setChat(res || []))
      .catch(() => setChat([]))
      .finally(() => setChatLoading(false));
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    supportersAPI
      .candidateSendChat({ message: chatMessage })
      .then(() => {
        setChatMessage('');
        loadChat();
      })
      .catch((err) => {
        const msg = err?.error?.message || err?.message || 'Unable to send message.';
        setError(msg);
      });
  };

  const buildEmailTemplate = (invite) => {
    const link = `${window.location.origin}/supporter?token=${invite.token}`;
    const subject = encodeURIComponent('Join my supporter dashboard');
    const body = encodeURIComponent(
      `Hi,\n\nI'd like to share a dashboard so you can see my job search progress and send encouragement.\n\nOpen this link: ${link}\n\nThanks for supporting me!`
    );
    return { link, subject, body };
  };

  const copyEmailTemplate = (invite) => {
    const { body } = buildEmailTemplate(invite);
    const text = `Subject: Join my supporter dashboard\n\n${decodeURIComponent(body)}`;
    navigator.clipboard.writeText(text).then(() => setToast('Email template copied'));
  };

  const openMailDraft = (invite) => {
    const { subject, body } = buildEmailTemplate(invite);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const openGmailDraft = (invite) => {
    const { subject, body } = buildEmailTemplate(invite);
    const to = encodeURIComponent(invite.email || '');
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  };

  const copyLink = (invite) => {
    const url = `${window.location.origin}/supporter?token=${invite.token}`;
    navigator.clipboard.writeText(url).then(() => setToast('Link copied to clipboard.'));
  };

  const formatDate = (value) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString();
    } catch (e) {
      return value;
    }
  };

  return (
    <div className="supporters-page">
      <header className="supporters-header">
        <div>
          <p className="eyebrow">Supporters</p>
          <h1>Family & Supporters</h1>
          <p className="muted">Invite trusted supporters to view a redacted progress dashboard and send encouragement.</p>
        </div>
      </header>

      <section className="supporters-card">
        <div className="supporters-card__header">
          <div>
            <p className="eyebrow">Invite</p>
            <h3>Share a supporter link</h3>
          </div>
          {toast && <span className="supporters-toast">{toast}</span>}
        </div>
        {error && <div className="supporters-alert">{error}</div>}
        <form className="supporters-form" onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="supporter-email">Email</label>
            <input
              id="supporter-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="supporter@example.com"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="supporter-name">Name (optional)</label>
            <input
              id="supporter-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Family member name"
            />
          </div>
          <div className="field">
            <label htmlFor="supporter-expiry">Link expiry</label>
            <select
              id="supporter-expiry"
              value={form.expires_in_days}
              onChange={(e) => setForm({ ...form, expires_in_days: Number(e.target.value) })}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={0}>No expiry</option>
            </select>
          </div>
          <label className="field checkbox-row" htmlFor="supporter-show-company">
            <input
              id="supporter-show-company"
              type="checkbox"
              aria-label="Allow company names to be visible"
              checked={showCompany}
              onChange={(e) => setShowCompany(e.target.checked)}
            />
            <span>Allow company names to be visible</span>
          </label>
          <label className="field checkbox-row" htmlFor="supporter-show-practice">
            <input
              id="supporter-show-practice"
              type="checkbox"
              aria-label="Show practice stats"
              checked={showPractice}
              onChange={(e) => setShowPractice(e.target.checked)}
            />
            <span>Show practice stats</span>
          </label>
          <label className="field checkbox-row" htmlFor="supporter-show-achievements">
            <input
              id="supporter-show-achievements"
              type="checkbox"
              aria-label="Show milestones/achievements"
              checked={showAchievements}
              onChange={(e) => setShowAchievements(e.target.checked)}
            />
            <span>Show milestones/achievements</span>
          </label>
          <div className="actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Create link'}
            </button>
          </div>
        </form>
      </section>

      <section className="supporters-card">
        <div className="supporters-card__header">
          <div>
            <p className="eyebrow">Status</p>
            <h3>How I’m feeling</h3>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              supportersAPI.getMood().then((res) => {
                setMoodScore(res?.score ?? '');
                setMoodNote(res?.note || '');
              })
            }
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        <form className="supporters-form" onSubmit={handleSaveMood}>
          <div className="field">
            <label htmlFor="supporter-mood-score">Score (1-10, optional)</label>
            <input
              id="supporter-mood-score"
              type="number"
              min="1"
              max="10"
              aria-label="Score (1-10, optional)"
              value={moodScore}
              onChange={(e) => setMoodScore(e.target.value)}
              placeholder="e.g., 7"
            />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="supporter-mood-note">How I’m feeling (optional)</label>
            <textarea
              id="supporter-mood-note"
              rows={3}
              aria-label="How I’m feeling (optional)"
              value={moodNote}
              onChange={(e) => setMoodNote(e.target.value)}
              placeholder="Share a short update"
            />
          </div>
          <div className="actions">
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </section>

      <section className="supporters-card">
        <div className="supporters-card__header">
          <div>
            <p className="eyebrow">Access</p>
            <h3>Active supporter links</h3>
          </div>
          <button type="button" className="btn-ghost" onClick={loadInvites} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {loading ? (
          <div className="supporters-loading">
            <LoadingSpinner />
          </div>
        ) : invites.length === 0 ? (
          <p className="muted">No supporter links yet. Create one above.</p>
        ) : (
          <div className="supporters-table" role="table">
            <div className="supporters-row supporters-row--head" role="row">
              <div role="columnheader">Email</div>
              <div role="columnheader">Name</div>
              <div role="columnheader">Status</div>
              <div role="columnheader">Expires</div>
              <div role="columnheader">Last access</div>
              <div role="columnheader">Actions</div>
            </div>
            {invites.map((invite) => (
              <div key={invite.id} className="supporters-row" role="row">
                <div role="cell">{invite.email}</div>
                <div role="cell">{invite.name || '—'}</div>
                <div role="cell">
                  <span className={`badge ${invite.is_active ? 'badge--green' : 'badge--gray'}`}>
                    {invite.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <div role="cell">{formatDate(invite.expires_at)}</div>
                <div role="cell">{formatDate(invite.last_access_at || invite.accepted_at)}</div>
                <div role="cell" className="supporters-actions">
                  <button type="button" onClick={() => copyLink(invite)} className="btn-link">
                    Copy link
                  </button>
                  <button type="button" onClick={() => copyEmailTemplate(invite)} className="btn-link">
                    Copy email template
                  </button>
                  <button type="button" onClick={() => openMailDraft(invite)} className="btn-link">
                    Open email draft
                  </button>
                  <button type="button" onClick={() => openGmailDraft(invite)} className="btn-link">
                    Open Gmail draft
                  </button>
                  <button type="button" onClick={() => toggleActive(invite)} className="btn-link">
                    {invite.is_active ? 'Pause' : 'Resume'}
                  </button>
                  <button type="button" onClick={() => deleteInvite(invite.id)} className="btn-link btn-danger">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="supporters-card">
        <div className="supporters-card__header">
          <div>
            <p className="eyebrow">Encouragements</p>
            <h3>Recent notes from supporters</h3>
          </div>
          <button type="button" className="btn-ghost" onClick={() => supportersAPI.listEncouragements().then(setEncouragements)} disabled={loading}>
            Refresh
          </button>
        </div>
        {encouragements.length === 0 ? (
          <p className="muted">No encouragements yet.</p>
        ) : (
          <ul className="supporters-achievements">
            {encouragements.map((item) => (
              <li key={item.id}>
                <div className="muted">{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</div>
                <strong>{item.supporter_name || item.supporter_email || 'Supporter'}</strong>
                <p>{item.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="supporters-card">
        <div className="supporters-card__header">
          <div>
            <p className="eyebrow">Supporter Chat</p>
            <h3>Supporter Message Feed</h3>
          </div>
          <button type="button" className="btn-ghost" onClick={loadChat} disabled={chatLoading}>
            {chatLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {chatLoading ? (
          <div className="supporters-loading">
            <LoadingSpinner />
          </div>
        ) : chat.length === 0 ? (
          <p className="muted">No messages yet.</p>
        ) : (
          <ul className="supporters-chat">
            {chat.map((msg) => (
              <li key={msg.id} className={`supporters-chat__item supporters-chat__item--${msg.sender_role}`}>
                <div className="supporters-chat__meta">
                  <span className="supporters-chat__sender">
                    {msg.sender_name || (msg.sender_role === 'candidate' ? 'You' : 'Supporter')}
                  </span>
                  <span className="muted">{msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}</span>
                </div>
                <p>{msg.message}</p>
              </li>
            ))}
          </ul>
        )}
        <form className="supporters-form" onSubmit={sendChat} style={{ marginTop: 12 }}>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Message</label>
            <textarea
              rows={3}
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Share an update with your supporters"
              required
            />
          </div>
          <div className="actions">
            <button type="submit" className="btn-primary">
              Send
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default Supporters;
