import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Icon from '../common/Icon';
import { contactsAPI } from '../../services/contactsAPI';

const pill = {
  display: 'inline-block',
  padding: '4px 8px',
  borderRadius: 12,
  fontSize: '0.8rem',
  fontWeight: 600,
};

const cardStyle = {
  background: '#0b132b',
  color: '#e5e7eb',
  borderRadius: 12,
  padding: 16,
  border: '1px solid #1f2937',
  boxShadow: '0 18px 40px rgba(0,0,0,0.22)',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', letterSpacing: '0.01em' }}>
          Relationship Maintenance
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={generateReminders}
            className="add-button"
            style={{ background: '#10b981', color: '#04101f' }}
          >
            <Icon name="bell" size="sm" /> Generate check-ins
          </button>
        </div>
      </div>

      {status && <div style={{ marginBottom: 10, padding: 10, background: '#ecfdf3', color: '#166534', borderRadius: 10 }}>{status}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div style={cardStyle}>
          <div style={sectionTitle}><Icon name="calendar" size="sm" /> Check-in reminders</div>
          <p style={{ marginTop: 0, color: '#9ca3af' }}>Automatic cadence for important contacts.</p>
          {(check_in_suggestions || []).slice(0, 4).map((r) => (
            <div key={r.contact_id} style={{ marginBottom: 10, padding: 10, background: '#111827', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700 }}>{r.contact_name}</div>
                <span style={{ ...pill, background: '#1e3a8a', color: '#c7d2fe' }}>{r.recurrence}</span>
              </div>
              <div style={{ color: '#d1d5db', marginTop: 4 }}>{r.message}</div>
              <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: 2 }}>Due by {new Date(r.due_date).toLocaleDateString()} - {r.reason}</div>
              <button
                className="add-button"
                style={{ marginTop: 8, background: '#22c55e', color: '#052e16', border: 'none' }}
                onClick={() => generateReminders([r.contact_id])}
              >
                <Icon name="calendar" size="sm" /> Add to calendar
              </button>
            </div>
          ))}
          {(!check_in_suggestions || check_in_suggestions.length === 0) && <div style={{ color: '#9ca3af' }}>No check-ins needed this week.</div>}
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}><Icon name="mail" size="sm" /> Personalized outreach</div>
          <p style={{ marginTop: 0, color: '#9ca3af' }}>Use interest-aware nudges and log the touchpoint.</p>
          {(personalized_outreach || []).slice(0, 4).map((o) => (
            <div key={o.contact_id} style={{ marginBottom: 10, padding: 10, background: '#0f172a', borderRadius: 10 }}>
              <div style={{ fontWeight: 700, color: '#e5e7eb' }}>{o.contact_name}</div>
              <div style={{ color: '#d1d5db', marginTop: 4 }}>{o.message}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ ...pill, background: '#164e63', color: '#cffafe' }}>{o.channel}</span>
                <button
                  onClick={() => logOutreach(o)}
                  className="add-button"
                  style={{ background: '#38bdf8', color: '#0b132b', padding: '6px 10px', fontSize: '0.9rem' }}
                >
                  Log outreach
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}><Icon name="activity" size="sm" /> Relationship health</div>
          <p style={{ marginTop: 0, color: '#9ca3af' }}>Frequency + recency signals.</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {(relationship_health || []).slice(0, 5).map((h) => (
              <div key={h.contact_id} style={{ background: '#0f172a', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>{h.contact_name}</div>
                  <span style={{ ...pill, background: h.health_score >= 70 ? '#16a34a' : '#f59e0b', color: '#04101f' }}>
                    {h.health_score}/100
                  </span>
                </div>
                <div style={{ color: '#d1d5db', fontSize: '0.9rem', marginTop: 4 }}>
                  {h.engagement_frequency_per_month} touches/mo · {h.status}
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
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
            <div key={key} style={{ marginBottom: 10 }}>
              <div style={{ textTransform: 'capitalize', color: '#cbd5e1', fontWeight: 700 }}>{key}</div>
              {(list || []).map((t, idx) => (
                <div key={`${key}-${idx}`} style={{ background: '#0f172a', borderRadius: 10, padding: 10, marginTop: 6 }}>
                  <div style={{ color: '#e5e7eb' }}>{t}</div>
                  <button
                    className="contacts-btn-secondary"
                    style={{ marginTop: 6 }}
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
          <p style={{ marginTop: 0, color: '#9ca3af' }}>Balance of value exchanged.</p>
          {(reciprocity || []).slice(0, 4).map((r) => (
            <div key={r.contact_id} style={{ background: '#0f172a', borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700 }}>{r.contact_name}</div>
                <span style={{ ...pill, background: '#1d4ed8', color: '#dbeafe' }}>{r.status}</span>
              </div>
              <div style={{ color: '#d1d5db', fontSize: '0.9rem', marginTop: 4 }}>
                Given {r.given} · Received {r.received} · Follow-ups {r.outstanding_follow_ups}
              </div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}><Icon name="book-open" size="sm" /> Industry news</div>
          <p style={{ marginTop: 0, color: '#9ca3af' }}>Share timely angles to add value.</p>
          {(industry_news || []).slice(0, 4).map((n) => (
            <div key={n.contact_id} style={{ background: '#0f172a', borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{n.contact_name}</div>
              <div style={{ color: '#cbd5e1' }}>{n.headline}</div>
              <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>{n.angle}</div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}><Icon name="trending-up" size="sm" /> Strengthening actions</div>
          <p style={{ marginTop: 0, color: '#9ca3af' }}>Small moves that keep momentum.</p>
          {(strengthening_actions || []).slice(0, 4).map((a) => (
            <div key={a.contact_id} style={{ background: '#0f172a', borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{a.contact_name}</div>
              <div style={{ color: '#e5e7eb' }}>{a.action}</div>
              <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>{a.why}</div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}><Icon name="link" size="sm" /> Impact on opportunities</div>
          <p style={{ marginTop: 0, color: '#9ca3af' }}>How relationships fuel pipelines.</p>
          <div style={{ color: '#e5e7eb', marginBottom: 8 }}>
            Contacts tied to jobs: {opportunity_impact?.contacts_with_job_links || 0} <br />
            Total linked roles: {opportunity_impact?.total_job_links || 0}
          </div>
          {(opportunity_impact?.top_relationships || []).map((c) => (
            <div key={c.contact_id} style={{ background: '#0f172a', borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{c.contact_name}</div>
              <div style={{ color: '#d1d5db', fontSize: '0.9rem' }}>
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
