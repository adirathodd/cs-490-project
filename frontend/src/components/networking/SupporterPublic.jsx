import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supportersAPI } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import '../mentorship/MentorshipDashboard.css';
import './Supporters.css';

const SupporterPublic = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [encouragement, setEncouragement] = useState({ name: '', message: '' });
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const [chat, setChat] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Supporter link is missing.');
      setLoading(false);
      return;
    }
    supportersAPI
      .fetchDashboard(token, { window_days: 30 })
      .then((res) => {
        setData(res);
        setError('');
      })
      .catch((err) => {
        const msg = err?.error?.message || err?.message || 'Unable to load supporter dashboard.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const sendEncouragement = (e) => {
    e.preventDefault();
    if (!token || sending || !encouragement.message.trim()) return;
    setSending(true);
    supportersAPI
      .sendEncouragement(token, encouragement)
      .then(() => {
        setToast('Encouragement sent!');
        setEncouragement({ name: '', message: '' });
      })
      .catch((err) => {
        const msg = err?.error?.message || err?.message || 'Unable to send encouragement.';
        setError(msg);
      })
      .finally(() => setSending(false));
  };

  const loadChat = () => {
    if (!token) return;
    setChatLoading(true);
    supportersAPI
      .fetchChat(token)
      .then((res) => setChat(res || []))
      .catch(() => setChat([]))
      .finally(() => setChatLoading(false));
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!token || !chatMessage.trim()) return;
    supportersAPI
      .sendChat(token, { message: chatMessage })
      .then(() => {
        setChatMessage('');
        loadChat();
      })
      .catch((err) => {
        const msg = err?.error?.message || err?.message || 'Unable to send message.';
        setError(msg);
      });
  };

  useEffect(() => {
    loadChat();
  }, [token]);

  const formatTiming = (days) => {
    if (days == null) return 'No data';
    if (days >= 1) return `${days} days`;
    return `${(days * 24).toFixed(1)} hrs`;
  };

  if (loading) {
    return (
      <div className="supporters-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="supporters-page">
        <div className="supporters-alert">{error}</div>
      </div>
    );
  }

  const renderWithLinks = (text) => {
    if (!text) return null;
    const parts = text.split(/(https?:\/\/[^\s]+)/g);
    return parts.map((part, idx) => {
      if (part.match(/^https?:\/\//)) {
        return (
          <a key={`link-${idx}`} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        );
      }
      return <span key={`text-${idx}`}>{part}</span>;
    });
  };

  return (
    <div className="mentorship-page supporters-page">
      <header className="mentorship-mentee-dashboard__header">
        <div>
          <p className="mentorship-hero__eyebrow">Supporter View</p>
          <h1>{data?.mentee?.name || 'Job Search Progress'}</h1>
          <p className="muted">High-level progress shared by your contact. Sensitive details are hidden unless permitted.</p>
        </div>
        {toast && <span className="supporters-toast">{toast}</span>}
      </header>

      <section className="mentorship-card mentorship-mentee-section supporters-card">
        <div className="supporters-card__header">
          <div>
            <p className="eyebrow">Progress</p>
            <h3>Application funnel</h3>
          </div>
        </div>
        <div className="supporters-row supporters-row--head" role="row">
          <div role="columnheader">Stage</div>
          <div role="columnheader">Count</div>
        </div>
        {['phone_screen', 'interview', 'offer'].map((stage) => (
          <div key={stage} className="supporters-row" role="row">
            <div role="cell">{stage.replace('_', ' ')}</div>
            <div role="cell">{(data?.funnel_analytics?.status_breakdown || {})[stage] || 0}</div>
          </div>
        ))}
      </section>

      <section className="mentorship-card mentorship-mentee-section supporters-card">
        <div className="supporters-card__header">
          <div>
            <p className="eyebrow">Achievements</p>
            <h3>Recent milestones</h3>
          </div>
          {data?.ai_recommendations?.length ? (
            <span className="supporters-toast">AI tips available below</span>
          ) : null}
        </div>
        {data?.achievements?.length ? (
          <ul className="supporters-achievements">
            {data.achievements.map((item, idx) => (
              <li key={idx}>
                <div className="muted">{item.date ? new Date(item.date).toLocaleDateString() : ''}</div>
                <div className="supporters-achievement-title">
                  <span className="supporters-emoji">{item.emoji || '🎯'}</span>
                  <strong>{item.title}</strong>
                </div>
                <p className="muted">{item.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No recent milestones to show.</p>
        )}
      </section>

      {data?.ai_recommendations?.length ? (
        <section className="mentorship-card mentorship-mentee-section supporters-card">
          <div className="supporters-card__header">
            <div>
              <p className="eyebrow">AI Guidance</p>
              <h3>How you can support</h3>
            </div>
          </div>
          <ul className="supporters-achievements">
            {data.ai_recommendations.map((rec, idx) => (
              <li key={idx}>
                <div className="supporters-achievement-title">
                  <span className="supporters-emoji">🤝</span>
                  <strong>Tip {idx + 1}</strong>
                </div>
                <p className="muted">{renderWithLinks(rec)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data?.mood ? (
        <section className="mentorship-card mentorship-mentee-section supporters-card">
          <div className="supporters-card__header">
            <div>
              <p className="eyebrow">Status</p>
              <h3>How they're feeling</h3>
            </div>
          </div>
          <div className="supporters-mood">
            {data.mood.score && (
              <div className="supporters-mood__score">
                <span className="supporters-emoji">💜</span>
                <strong>Score: {data.mood.score}/10</strong>
              </div>
            )}
            {data.mood.note && <p className="muted">{data.mood.note}</p>}
          </div>
        </section>
      ) : null}

      <section className="mentorship-card mentorship-mentee-section supporters-card">
        <div className="supporters-card__header">
          <div>
            <p className="eyebrow">Encouragement</p>
            <h3>Send a note</h3>
          </div>
        </div>
        <form className="supporters-form" onSubmit={sendEncouragement}>
          <div className="field">
            <label>Your name (optional)</label>
            <input
              type="text"
              value={encouragement.name}
              onChange={(e) => setEncouragement({ ...encouragement, name: e.target.value })}
            />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Message</label>
            <textarea
              rows={3}
              value={encouragement.message}
              onChange={(e) => setEncouragement({ ...encouragement, message: e.target.value })}
              placeholder="Share some encouragement or congratulations"
              required
            />
          </div>
          <div className="actions">
            <button type="submit" className="btn-primary" disabled={sending}>
              {sending ? 'Sending…' : 'Send encouragement'}
            </button>
          </div>
        </form>
      </section>

      <section className="mentorship-card mentorship-mentee-section supporters-card">
        <div className="supporters-card__header">
          <div>
            <p className="eyebrow">Chat</p>
            <h3>Message thread</h3>
          </div>
          <button type="button" className="btn-ghost" onClick={loadChat} disabled={chatLoading}>
            {chatLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {chatLoading ? (
          <LoadingSpinner />
        ) : chat.length === 0 ? (
          <p className="muted">No messages yet. Start the conversation.</p>
        ) : (
          <ul className="supporters-chat">
            {chat.map((msg) => (
              <li key={msg.id} className={`supporters-chat__item supporters-chat__item--${msg.sender_role}`}>
                <div className="supporters-chat__meta">
                  <span className="supporters-chat__sender">{msg.sender_name || (msg.sender_role === 'candidate' ? 'Candidate' : 'Supporter')}</span>
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
              placeholder="Share an update or encouragement"
              required
            />
          </div>
          <div className="actions">
            <button type="submit" className="btn-primary">Send</button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default SupporterPublic;
