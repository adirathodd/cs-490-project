import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Icon from '../common/Icon';
import { contactsAPI } from '../../services/contactsAPI';

const pill = {
  display: 'inline-block',
  padding: '4px 8px',
  borderRadius: 12,
  fontSize: '0.8rem',
  fontWeight: 700,
  background: 'var(--gray-100)',
  color: '#0f172a',
};

const cardStyle = {
  background: 'var(--white)',
  color: '#0f172a',
  borderRadius: 12,
  padding: 16,
  border: '1px solid var(--gray-200)',
  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)',
};

const sectionTitle = {
  margin: '0 0 6px 0',
  fontSize: '1rem',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  letterSpacing: '0.02em',
};

const RelationshipMaintenancePanel = ({ onReminderChange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await contactsAPI.maintenanceInsights();
      setData(res);
    } catch (e) {
      setError('Unable to load relationship maintenance insights.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generateReminders = async (contactIds = []) => {
    setStatus('');
    try {
      const res = await contactsAPI.generateCheckInReminders(contactIds);
      setStatus(`Generated ${res.created_count || 0} check-in reminders.`);
      await load();
      if (onReminderChange) onReminderChange();
    } catch (e) {
      setError('Failed to generate check-in reminders.');
    }
  };

  const logOutreach = async (suggestion) => {
    setStatus('');
    try {
      await contactsAPI.logOutreach(suggestion.contact_id, {
        message: suggestion.message,
        channel: suggestion.channel,
        intent: 'personalized_outreach',
      });
      setStatus(`Logged outreach for ${suggestion.contact_name}.`);
      await load();
      if (onReminderChange) onReminderChange();
    } catch (e) {
      setError('Unable to log outreach. Try again.');
    }
  };

  const copyTemplate = async (text) => {
    setStatus('');
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setStatus('Template copied to clipboard.');
      } else {
        setStatus('Copy not available - select the text manually.');
      }
    } catch (e) {
      setStatus('Copy not available - select the text manually.');
    }
  };

  if (loading) return <div style={{ color: '#111827' }}>Loading relationship maintenance...</div>;
  if (error) return <div style={{ color: '#b91c1c' }}>{error}</div>;
  if (!data) return null;

  const { check_in_suggestions, personalized_outreach, relationship_health, templates, reciprocity, industry_news, strengthening_actions, opportunity_impact } = data;

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', letterSpacing: '0.01em' }}>
          Relationship Maintenance
        </h2>
        <button
          onClick={generateReminders}
          className="contacts-action contacts-action-primary"
          style={{ gap: 6 }}
        >
          <Icon name="bell" size="sm" /> Generate check-ins
        </button>
      </div>

      {status && <div style={{ marginBottom: 10, padding: 12, background: '#ecfdf3', color: '#166534', borderRadius: 10, border: '1px solid #bbf7d0' }}>{status}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div style={cardStyle}>
          <div style={sectionTitle}><Icon name="calendar" size="sm" /> Check-in reminders</div>
          <p style={{ marginTop: 0, color: '#475569' }}>Automatic cadence for important contacts.</p>
          {(check_in_suggestions || []).slice(0, 4).map((r) => (
            <div key={r.contact_id} style={{ marginBottom: 10, padding: 10, background: '#f8fafc', borderRadius: 10, border: '1px solid var(--gray-200)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.contact_name}</div>
                <span style={{ ...pill, background: '#e0e7ff', color: '#312e81' }}>{r.recurrence}</span>
              </div>
              <div style={{ color: '#334155', marginTop: 4 }}>{r.message}</div>
              <div style={{ color: '#475569', fontSize: '0.9rem', marginTop: 2 }}>Due by {new Date(r.due_date).toLocaleDateString()} · {r.reason}</div>
              <button
                className="contacts-action contacts-action-primary"
                style={{ marginTop: 8, padding: '9px 12px', minHeight: 'unset' }}
                onClick={() => generateReminders([r.contact_id])}
              >
                <Icon name="calendar" size="sm" /> Add to calendar
              </button>
            </div>
          ))}
          {(!check_in_suggestions || check_in_suggestions.length === 0) && <div style={{ color: '#475569' }}>No check-ins needed this week.</div>}
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}><Icon name="mail" size="sm" /> Personalized outreach</div>
          <p style={{ marginTop: 0, color: '#475569' }}>Use interest-aware nudges and log the touchpoint.</p>
          {(personalized_outreach || []).slice(0, 4).map((o) => (
            <div key={o.contact_id} style={{ marginBottom: 10, padding: 10, background: '#f8fafc', borderRadius: 10, border: '1px solid var(--gray-200)' }}>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{o.contact_name}</div>
              <div style={{ color: '#334155', marginTop: 4 }}>{o.message}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, justifyContent: 'flex-start' }}>
                <span style={{ ...pill, background: '#cffafe', color: '#0f172a' }}>{o.channel}</span>
                <button
                  onClick={() => logOutreach(o)}
                  className="contacts-action contacts-action-primary"
                  style={{ padding: '8px 12px', minHeight: 'unset', lineHeight: 1.1, width: 'auto', minWidth: '0' }}
                >
                  Log outreach
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}><Icon name="activity" size="sm" /> Relationship health</div>
          <p style={{ marginTop: 0, color: '#475569' }}>Frequency + recency signals.</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {(relationship_health || []).slice(0, 5).map((h) => (
              <div key={h.contact_id} style={{ background: '#f8fafc', borderRadius: 10, padding: 10, border: '1px solid var(--gray-200)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>{h.contact_name}</div>
                  <span style={{ ...pill, background: h.health_score >= 70 ? '#dcfce7' : '#fef9c3', color: '#166534' }}>
                    {h.health_score}/100
                  </span>
                </div>
                <div style={{ color: '#334155', fontSize: '0.95rem', marginTop: 4 }}>
                  {h.engagement_frequency_per_month} touches/mo · {h.status}
                </div>
                <div style={{ color: '#475569', fontSize: '0.85rem' }}>
                  Last touch: {h.last_interaction ? new Date(h.last_interaction).toLocaleDateString() : 'None yet'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}><Icon name="message-circle" size="sm" /> Templates</div>
          <p style={{ marginTop: 0, color: '#9ca3af' }}>Ready-to-send messages for common moments.</p>
          {templates && Object.entries(templates).map(([key, list]) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ textTransform: 'capitalize', color: '#0f172a', fontWeight: 700, marginBottom: 4 }}>{key}</div>
              {(list || []).map((t, idx) => (
                <div key={`${key}-${idx}`} style={{ background: '#f8fafc', borderRadius: 10, padding: 10, marginTop: 6, border: '1px solid var(--gray-200)' }}>
                  <div style={{ color: '#0f172a' }}>{t}</div>
                  <button
                    className="contacts-btn-secondary"
                    style={{ marginTop: 8, width: '100%' }}
                    onClick={() => copyTemplate(t)}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}><Icon name="scale" size="sm" /> Reciprocity</div>
          <p style={{ marginTop: 0, color: '#475569' }}>Balance of value exchanged.</p>
          {(reciprocity || []).slice(0, 4).map((r) => (
            <div key={r.contact_id} style={{ background: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 8, border: '1px solid var(--gray-200)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>{r.contact_name}</div>
                <span style={{ ...pill, background: '#e0e7ff', color: '#312e81' }}>{r.status}</span>
              </div>
              <div style={{ color: '#334155', fontSize: '0.95rem', marginTop: 4 }}>
                Given {r.given} · Received {r.received} · Follow-ups {r.outstanding_follow_ups}
              </div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}><Icon name="book-open" size="sm" /> Industry news</div>
          <p style={{ marginTop: 0, color: '#475569' }}>Share timely angles to add value.</p>
          {(industry_news || []).slice(0, 4).map((n) => (
            <div key={n.contact_id} style={{ background: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 8, border: '1px solid var(--gray-200)' }}>
              <div style={{ fontWeight: 700 }}>{n.contact_name}</div>
              <div style={{ color: '#0f172a' }}>{n.headline}</div>
              <div style={{ color: '#475569', fontSize: '0.9rem' }}>{n.angle}</div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}><Icon name="trending-up" size="sm" /> Strengthening actions</div>
          <p style={{ marginTop: 0, color: '#475569' }}>Small moves that keep momentum.</p>
          {(strengthening_actions || []).slice(0, 4).map((a) => (
            <div key={a.contact_id} style={{ background: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 8, border: '1px solid var(--gray-200)' }}>
              <div style={{ fontWeight: 700 }}>{a.contact_name}</div>
              <div style={{ color: '#0f172a' }}>{a.action}</div>
              <div style={{ color: '#475569', fontSize: '0.9rem' }}>{a.why}</div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}><Icon name="link" size="sm" /> Impact on opportunities</div>
          <p style={{ marginTop: 0, color: '#475569' }}>How relationships fuel pipelines.</p>
          <div style={{ color: '#0f172a', marginBottom: 8 }}>
            Contacts tied to jobs: {opportunity_impact?.contacts_with_job_links || 0} <br />
            Total linked roles: {opportunity_impact?.total_job_links || 0}
          </div>
          {(opportunity_impact?.top_relationships || []).map((c) => (
            <div key={c.contact_id} style={{ background: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 8, border: '1px solid var(--gray-200)' }}>
              <div style={{ fontWeight: 700 }}>{c.contact_name}</div>
              <div style={{ color: '#334155', fontSize: '0.9rem' }}>
                Linked roles: {c.linked_jobs} · Recent touches: {c.recent_interactions}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

RelationshipMaintenancePanel.propTypes = {
  onReminderChange: PropTypes.func,
};

export default RelationshipMaintenancePanel;
