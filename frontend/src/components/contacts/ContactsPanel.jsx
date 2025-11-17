import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../common/Icon';
import PropTypes from 'prop-types';
import { contactsAPI } from '../../services/contactsAPI';
import { jobsAPI } from '../../services/api';
import { industryOptions } from '../jobs/Jobs';
import './Contacts.css';

const ContactsPanel = ({ open, onClose, inline, openCreate, onReminderChange }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', company: '', title: '', location: '', notes: '', relationship_type: '', relationship_strength: 0, industry: '', mutual_connections: [] });
  const [createError, setCreateError] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [editError, setEditError] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [notesList, setNotesList] = useState([]);
  const [interactionsList, setInteractionsList] = useState([]);
  const [remindersList, setRemindersList] = useState([]);
  const [mutualsList, setMutualsList] = useState([]);
  const [companyLinksList, setCompanyLinksList] = useState([]);
  const [jobLinksList, setJobLinksList] = useState([]);
  const [availableJobs, setAvailableJobs] = useState([]);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const navigate = useNavigate();

  const visible = inline || open;

  const handleClose = () => {
    if (onClose) return onClose();
    if (inline) return navigate('/dashboard');
    return undefined;
  };

  const formatApiError = (err, fallback) => {
    if (!err) return fallback;
    // axios interceptor often rejects with { error: { message, ... } }
    if (err.error) {
      const e = err.error;
      if (typeof e === 'string') return e;
      if (e.message) return e.message;
      // if validation-like object, pick first string
      if (typeof e === 'object') {
        for (const val of Object.values(e)) {
          if (!val) continue;
          if (Array.isArray(val) && val.length) return String(val[0]);
          if (typeof val === 'string') return val;
        }
      }
    }
    // axios error with response data
    if (err.response && err.response.data) {
      const data = err.response.data;
      if (typeof data === 'string') return data;
      if (data.error && typeof data.error === 'string') return data.error;
      if (data.detail) return data.detail;
      // pick first message from shape
      for (const val of Object.values(data)) {
        if (!val) continue;
        if (Array.isArray(val) && val.length) return String(val[0]);
        if (typeof val === 'string') return val;
      }
    }
    if (err.message) return err.message;
    if (typeof err === 'string') return err;
    try { return JSON.stringify(err); } catch { return fallback; }
  };

  // Debounce the search query so we don't spam the API while typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  // If parent requests opening the create form (page-mode), reflect that
  useEffect(() => {
    if (inline && openCreate) {
      setShowCreate(true);
    }
  }, [inline, openCreate]);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await contactsAPI.list(debouncedQuery);
        if (mounted) setContacts(Array.isArray(data) ? data : []);
      } catch (e) {
        if (mounted) setContacts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [visible, debouncedQuery]);

  // Load available jobs for linking
  useEffect(() => {
    if (!visible) return;
    const loadJobs = async () => {
      try {
        const data = await jobsAPI.getJobs();
        setAvailableJobs(Array.isArray(data) ? data : []);
      } catch (e) {
        setAvailableJobs([]);
      }
    };
    loadJobs();
  }, [visible]);

  if (!visible) return null;

  return (
    <div>
      {!inline && <div className="contacts-overlay" onClick={handleClose} />}
      <aside className={inline ? 'contacts-inline' : 'contacts-panel'} role="dialog" aria-label="Contacts" aria-modal="true">
          {!inline && (
          <div className="form-header">
            <h3>Contacts</h3>
            <button className="close-button" onClick={handleClose} aria-label="Close contacts">
              <Icon name="trash" size="sm" ariaLabel="Close" />
            </button>
          </div>
        )}
        {/* Contact detail drawer (overlay on top of panel) */}
        {selectedContact && (
          <>
            <div className="contacts-overlay" onClick={() => { setSelectedContact(null); setEditContact(null); setEditError(''); }} />
            <div className="contacts-detail-drawer" role="dialog" aria-modal="true">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                <h4 style={{ margin: 0 }}>{selectedContact?.display_name || selectedContact?.name || [selectedContact?.first_name, selectedContact?.last_name].filter(Boolean).join(' ') || selectedContact?.email || 'Contact'}</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="contacts-btn-secondary" onClick={() => { setSelectedContact(null); setEditContact(null); setEditError(''); }}>Close</button>
                </div>
              </div>
              <div style={{ padding: 12 }}>
                {editError && <div className="contacts-error" style={{ marginBottom: 8 }}>{editError}</div>}

                <div style={{ display: 'grid', gap: 8 }}>
                  <input className="contacts-create-input" value={editContact?.name || ''} onChange={(e) => setEditContact((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" />
                  <input className="contacts-create-input" value={editContact?.email || ''} onChange={(e) => setEditContact((p) => ({ ...p, email: e.target.value }))} placeholder="Email" />
                  <input className="contacts-create-input" value={editContact?.phone || ''} onChange={(e) => setEditContact((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" />
                  <input className="contacts-create-input" value={editContact?.company || ''} onChange={(e) => setEditContact((p) => ({ ...p, company: e.target.value }))} placeholder="Company" />
                  <input className="contacts-create-input" value={editContact?.title || ''} onChange={(e) => setEditContact((p) => ({ ...p, title: e.target.value }))} placeholder="Job Title" />
                  <input className="contacts-create-input" value={editContact?.location || ''} onChange={(e) => setEditContact((p) => ({ ...p, location: e.target.value }))} placeholder="Location" />
                  <input className="contacts-create-input" value={editContact?.relationship_type || ''} onChange={(e) => setEditContact((p) => ({ ...p, relationship_type: e.target.value }))} placeholder="Relationship type (e.g., colleague, mentor)" />
                  <select className="contacts-create-input" value={editContact?.industry || ''} onChange={(e) => setEditContact((p) => ({ ...p, industry: e.target.value }))}>
                    <option value="">Select industry</option>
                    {industryOptions.map((ind) => (<option key={ind} value={ind}>{ind}</option>))}
                  </select>
                  <div>
                    <label style={{ display: 'block', margin: 0, fontSize: '0.85rem', marginBottom: 4 }}>Relationship Strength</label>
                    <input type="range" min="0" max="10" value={editContact?.relationship_strength || 0} onChange={(e) => setEditContact((p) => ({ ...p, relationship_strength: Number(e.target.value) }))} style={{ width: '100%' }} />
                    <div style={{ marginTop: 4, fontSize: '0.9rem' }}>{editContact?.relationship_strength || 0}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="contacts-btn-primary" onClick={async () => {
                      setEditError('');
                      if (!editContact.name && !editContact.email) { setEditError('Please provide at least a name or email.'); return; }
                      try {
                        const [first_name, ...rest] = (editContact.name || '').trim().split(/\s+/);
                        const last_name = rest.join(' ') || '';
                        // Only overwrite display_name if the user provided a non-empty name in the edit form.
                        const computedDisplayName = (editContact.name && editContact.name.trim())
                          ? editContact.name.trim()
                          : (selectedContact?.display_name || `${first_name || ''} ${last_name || ''}`.trim());

                        const payload = {
                          display_name: computedDisplayName,
                          first_name: first_name || '',
                          last_name: last_name || '',
                          email: editContact.email || '',
                          phone: editContact.phone || '',
                          title: editContact.title || '',
                          company_name: editContact.company || '',
                          location: editContact.location || '',
                          industry: editContact.industry || '',
                          relationship_type: editContact.relationship_type || '',
                          relationship_strength: editContact.relationship_strength || 0,
                          notes: editContact.notes || '',
                        };
                        const updated = await contactsAPI.update(editContact.id, payload);
                        setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                        setSelectedContact(updated);
                        setEditContact({
                          ...updated,
                          name: updated.display_name || [updated.first_name, updated.last_name].filter(Boolean).join(' '),
                          company: updated.company_name || '',
                          title: updated.title || '',
                          location: updated.location || '',
                          notes: (typeof updated.notes === 'string' ? updated.notes : ''),
                        });
                      } catch (err) {
                        console.error('update contact error', err);
                        setEditError(formatApiError(err, 'Failed to update contact.'));
                      }
                    }}>Save</button>

                    {deleteConfirmId === editContact?.id ? (
                      <>
                        <button className="contacts-btn-secondary" onClick={async () => {
                          try {
                            await contactsAPI.remove(editContact.id);
                            setContacts((prev) => prev.filter((c) => c.id !== editContact.id));
                            setSelectedContact(null);
                            setEditContact(null);
                            setDeleteConfirmId(null);
                          } catch (err) {
                            console.error('delete contact error', err, err?.response?.status, err?.response?.data);
                            const baseMessage = formatApiError(err, 'Failed to delete contact.');
                            const status = err?.response?.status ? `HTTP ${err.response.status}` : 'network';
                            const details = err?.response?.data ? ` — ${JSON.stringify(err.response.data).slice(0, 300)}` : '';
                            setEditError(`${baseMessage} (${status})${details}`);
                          }
                        }}>Confirm Delete</button>
                        <button className="contacts-btn-secondary" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="contacts-btn-secondary" onClick={() => setDeleteConfirmId(editContact?.id)}>Delete</button>
                    )}
                  </div>

                  {/* Tabs for Details / Notes / Interactions / Reminders / Mutuals / Companies / Jobs */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, borderTop: '1px solid var(--gray-100)', paddingTop: 12, flexWrap: 'wrap' }}>
                    {['details', 'notes', 'interactions', 'reminders', 'mutuals', 'companies', 'jobs'].map((t) => (
                      <button key={t} className={`contacts-tab ${activeTab === t ? 'active' : ''}`} onClick={async () => {
                        setActiveTab(t);
                        try {
                          if (t === 'notes') {
                            const notes = await contactsAPI.notes(editContact.id);
                            const incoming = Array.isArray(notes) ? notes : [];
                            if (incoming.length === 0 && editContact && typeof editContact.notes === 'string' && editContact.notes.trim()) {
                              // Fallback: use inline notes stored on the contact record
                              setNotesList([{ id: `inline-${editContact.id || 'new'}`, author: { username: 'You' }, content: editContact.notes, created_at: new Date().toISOString() }]);
                            } else {
                              setNotesList(incoming);
                            }
                          } else if (t === 'interactions') {
                            const ints = await contactsAPI.interactions(editContact.id);
                            setInteractionsList(Array.isArray(ints) ? ints : []);
                          } else if (t === 'reminders') {
                            const rems = await contactsAPI.reminders(editContact.id);
                            setRemindersList(Array.isArray(rems) ? rems : []);
                          } else if (t === 'mutuals') {
                            const muts = await contactsAPI.mutuals(editContact.id);
                            setMutualsList(Array.isArray(muts) ? muts : []);
                          } else if (t === 'companies') {
                            const links = await contactsAPI.companyLinks(editContact.id);
                            setCompanyLinksList(Array.isArray(links) ? links : []);
                          } else if (t === 'jobs') {
                            const links = await contactsAPI.jobLinks(editContact.id);
                            setJobLinksList(Array.isArray(links) ? links : []);
                          }
                        } catch (e) {
                          // ignore load errors for now
                        }
                      }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                    ))}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    {activeTab === 'details' && (
                      <div>
                        <div style={{ marginBottom: 8 }}><strong>Company:</strong> {editContact.company || '—'}</div>
                        <div style={{ marginBottom: 8 }}><strong>Title:</strong> {editContact.title || '—'}</div>
                        <div style={{ marginBottom: 8 }}><strong>Location:</strong> {editContact.location || '—'}</div>
                      </div>
                    )}

                    {activeTab === 'notes' && (
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          <textarea placeholder="Add a note" className="contacts-create-input" rows={3} id="new-note-content" />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="contacts-btn-primary" onClick={async () => {
                              const el = document.getElementById('new-note-content');
                              if (!el || !el.value.trim()) return;
                              try {
                                const created = await contactsAPI.createNote(editContact.id, { content: el.value });
                                setNotesList((prev) => [created, ...prev]);
                                el.value = '';
                              } catch (err) {
                                setEditError(formatApiError(err, 'Failed to create note.'));
                              }
                            }}>Add Note</button>
                          </div>
                        </div>
                        <ul className="contacts-notes-list">
                          {notesList.map((n) => (
                            <li key={n.id} className="contacts-note-item"><div className="contacts-note-meta">{n.author ? n.author.username : 'You'} — {new Date(n.created_at).toLocaleString()}</div><div className="contacts-note-content">{n.content}</div></li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {activeTab === 'interactions' && (
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          <input id="new-interaction-type" placeholder="Type (email, call, meeting)" className="contacts-create-input" />
                          <input id="new-interaction-summary" placeholder="Summary" className="contacts-create-input" />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="contacts-btn-primary" onClick={async () => {
                              const t = document.getElementById('new-interaction-type');
                              const s = document.getElementById('new-interaction-summary');
                              if (!t || !s || !s.value.trim()) return;
                              try {
                                const created = await contactsAPI.createInteraction(editContact.id, { type: t.value, summary: s.value });
                                setInteractionsList((prev) => [created, ...prev]);
                                // update contact last_interaction
                                setSelectedContact((prev) => ({ ...prev, last_interaction: created.date }));
                                t.value = '';
                                s.value = '';
                              } catch (err) {
                                setEditError(formatApiError(err, 'Failed to create interaction.'));
                              }
                            }}>Add Interaction</button>
                          </div>
                        </div>
                        <ul className="contacts-interactions-list">
                          {interactionsList.map((i) => (
                            <li key={i.id} className="contacts-interaction-item"><div className="contacts-note-meta">{i.type} — {new Date(i.date).toLocaleString()}</div><div className="contacts-note-content">{i.summary}</div></li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {activeTab === 'reminders' && (
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          <input id="new-reminder-due" type="date" className="contacts-create-input" />
                          <input id="new-reminder-msg" placeholder="Message" className="contacts-create-input" />
                          <label style={{ marginTop: 8, fontSize: '0.85rem' }}>Recurrence</label>
                          <select id="new-reminder-recurrence" className="contacts-create-input">
                            <option value="">One-time</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="contacts-btn-primary" onClick={async () => {
                              const d = document.getElementById('new-reminder-due');
                              const m = document.getElementById('new-reminder-msg');
                              const r = document.getElementById('new-reminder-recurrence');
                              if (!d || !m || !m.value.trim() || !d.value) return;
                              try {
                                const payload = { due_date: d.value, message: m.value };
                                if (r && r.value) payload.recurrence = r.value;
                                const created = await contactsAPI.createReminder(editContact.id, payload);
                                setRemindersList((prev) => [created, ...prev]);
                                d.value = '';
                                m.value = '';
                                if (r) r.value = '';
                                // Notify parent to refresh calendar
                                if (onReminderChange) onReminderChange();
                              } catch (err) {
                                setEditError(formatApiError(err, 'Failed to create reminder.'));
                              }
                            }}>Add Reminder</button>
                          </div>
                        </div>
                        <ul className="contacts-reminders-list">
                          {remindersList.map((r) => (
                            <li key={r.id} className="contacts-reminder-item">
                              <div className="contacts-note-meta">Due: {new Date(r.due_date).toLocaleDateString()}{r.recurrence ? ` • ${r.recurrence}` : ''}</div>
                              <div className="contacts-note-content">{r.message}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {activeTab === 'mutuals' && (
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ fontSize: '0.85rem', marginBottom: 4 }}>Link to another contact</label>
                          <select id="new-mutual-contact" className="contacts-create-input">
                            <option value="">Select a contact</option>
                            {contacts.filter(c => c.id !== editContact.id).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.display_name || c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}
                              </option>
                            ))}
                          </select>
                          <input id="new-mutual-context" placeholder="Context (e.g., colleagues at XYZ Corp)" className="contacts-create-input" />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="contacts-btn-primary" onClick={async () => {
                              const sel = document.getElementById('new-mutual-contact');
                              const ctx = document.getElementById('new-mutual-context');
                              if (!sel || !sel.value) return;
                              try {
                                const payload = { 
                                  related_contact_id: sel.value,
                                  context: ctx?.value || '',
                                  source: 'manual'
                                };
                                await contactsAPI.addMutual(editContact.id, payload);
                                // Reload mutuals list
                                const muts = await contactsAPI.mutuals(editContact.id);
                                setMutualsList(Array.isArray(muts) ? muts : []);
                                sel.value = '';
                                if (ctx) ctx.value = '';
                              } catch (err) {
                                setEditError(formatApiError(err, 'Failed to add mutual connection.'));
                              }
                            }}>Add Connection</button>
                          </div>
                        </div>
                        <ul className="contacts-mutuals-list">
                          {mutualsList.map((m) => (
                            <li key={m.id} className="contacts-mutual-item">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div className="contacts-item-name">
                                    {m.display_name || m.name || [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}
                                  </div>
                                  {m.context && <div className="contacts-note-meta">{m.context}</div>}
                                </div>
                                <button 
                                  className="contacts-btn-secondary" 
                                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                  onClick={async () => {
                                    try {
                                      await contactsAPI.removeMutual(editContact.id, m.mutual_id);
                                      setMutualsList((prev) => prev.filter((x) => x.id !== m.id));
                                    } catch (err) {
                                      setEditError(formatApiError(err, 'Failed to remove connection.'));
                                    }
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                        {mutualsList.length === 0 && (
                          <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 8 }}>No mutual connections yet.</div>
                        )}
                      </div>
                    )}

                    {activeTab === 'companies' && (
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ fontSize: '0.85rem', marginBottom: 4 }}>Link to a company</label>
                          <input 
                            id="new-company-name" 
                            placeholder="Company name" 
                            className="contacts-create-input" 
                          />
                          <input 
                            id="new-company-role" 
                            placeholder="Role/Title (optional)" 
                            className="contacts-create-input" 
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="contacts-btn-primary" onClick={async () => {
                              const nameInput = document.getElementById('new-company-name');
                              const roleInput = document.getElementById('new-company-role');
                              if (!nameInput || !nameInput.value.trim()) return;
                              
                              try {
                                // For now, we'll need to create a company first or find existing
                                // This is a simplified version - in production you'd have a company selector
                                const companyName = nameInput.value.trim();
                                setEditError('Company linking requires a company ID. Please use the company management feature to create companies first.');
                              } catch (err) {
                                setEditError(formatApiError(err, 'Failed to link company.'));
                              }
                            }}>Link Company</button>
                          </div>
                          <small style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: 4, display: 'block' }}>
                            Note: Company linking requires companies to be created first in the system.
                          </small>
                        </div>
                        <ul className="contacts-mutuals-list">
                          {companyLinksList.map((link) => (
                            <li key={link.id} className="contacts-mutual-item">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div className="contacts-item-name">{link.company_name}</div>
                                  {link.role_title && <div className="contacts-note-meta">{link.role_title}</div>}
                                </div>
                                <button 
                                  className="contacts-btn-secondary" 
                                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                  onClick={async () => {
                                    try {
                                      await contactsAPI.removeCompanyLink(editContact.id, link.id);
                                      setCompanyLinksList((prev) => prev.filter((x) => x.id !== link.id));
                                    } catch (err) {
                                      setEditError(formatApiError(err, 'Failed to remove company link.'));
                                    }
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                        {companyLinksList.length === 0 && (
                          <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 8 }}>No company links yet.</div>
                        )}
                      </div>
                    )}

                    {activeTab === 'jobs' && (
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ fontSize: '0.85rem', marginBottom: 4 }}>Link to a job opportunity</label>
                          <select id="new-job-link" className="contacts-create-input">
                            <option value="">Select a job</option>
                            {availableJobs.map((job) => (
                              <option key={job.id} value={job.id}>
                                {job.title} - {job.company_name}
                              </option>
                            ))}
                          </select>
                          <input 
                            id="new-job-relationship" 
                            placeholder="Relationship (e.g., hiring manager, recruiter, referral)" 
                            className="contacts-create-input" 
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="contacts-btn-primary" onClick={async () => {
                              const sel = document.getElementById('new-job-link');
                              const rel = document.getElementById('new-job-relationship');
                              if (!sel || !sel.value) return;
                              try {
                                const payload = { 
                                  job_id: sel.value,
                                  relationship_to_job: rel?.value || ''
                                };
                                await contactsAPI.addJobLink(editContact.id, payload);
                                // Reload job links list
                                const links = await contactsAPI.jobLinks(editContact.id);
                                setJobLinksList(Array.isArray(links) ? links : []);
                                sel.value = '';
                                if (rel) rel.value = '';
                              } catch (err) {
                                setEditError(formatApiError(err, 'Failed to link job.'));
                              }
                            }}>Link Job</button>
                          </div>
                        </div>
                        <ul className="contacts-mutuals-list">
                          {jobLinksList.map((link) => (
                            <li key={link.id} className="contacts-mutual-item">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div className="contacts-item-name">{link.job_title}</div>
                                  <div className="contacts-note-meta">{link.company_name}</div>
                                  {link.relationship_to_job && <div className="contacts-note-meta" style={{ fontStyle: 'italic' }}>{link.relationship_to_job}</div>}
                                </div>
                                <button 
                                  className="contacts-btn-secondary" 
                                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                  onClick={async () => {
                                    try {
                                      await contactsAPI.removeJobLink(editContact.id, link.id);
                                      setJobLinksList((prev) => prev.filter((x) => x.id !== link.id));
                                    } catch (err) {
                                      setEditError(formatApiError(err, 'Failed to remove job link.'));
                                    }
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                        {jobLinksList.length === 0 && (
                          <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 8 }}>No job links yet.</div>
                        )}
                      </div>
                    )}

                    
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ flex: '1 1 auto' }} className="contacts-panel-search">
              <input
                type="search"
                placeholder="Search contacts"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search contacts"
              />
            </div>
            {!inline && (
              <div style={{ flex: '0 0 auto', display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="add-education-button"
                  onClick={() => setShowCreate((v) => !v)}
                  aria-expanded={showCreate}
                >
                  {showCreate ? 'Cancel' : 'New'}
                </button>
                <button
                  type="button"
                  className="add-education-button"
                  onClick={async () => {
                    try {
                      const response = await contactsAPI.importStart('google');
                      if (response.auth_url) {
                        window.location.href = response.auth_url;
                      }
                    } catch (err) {
                      console.error('Import failed:', err);
                      setCreateError('Failed to start Google import.');
                    }
                  }}
                  title="Import contacts from Google"
                >
                  Import
                </button>
              </div>
            )}
          </div>

          {showCreate && (
            <div className="employment-form-card">
              <div className="form-header">
                <h3>{newContact.id ? 'Edit Contact' : 'Add Contact'}</h3>
                <button className="close-button" onClick={() => { setShowCreate(false); setNewContact({ name: '', email: '', phone: '', company: '', title: '', location: '', notes: '' }); setCreateError(''); }}>
                  <Icon name="trash" size="sm" ariaLabel="Close" />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                setCreateError('');
                if (!newContact.name && !newContact.email) {
                  setCreateError('Please provide at least a name or email.');
                  return;
                }
                setCreating(true);
                try {
                  // Map frontend fields to backend serializer fields
                  const [first_name, ...rest] = (newContact.name || '').trim().split(/\s+/);
                  const last_name = rest.join(' ') || '';
                  const payload = {
                    display_name: newContact.name || '',
                    first_name: first_name || '',
                    last_name: last_name || '',
                    title: newContact.title || '',
                    company_name: newContact.company || '',
                    industry: newContact.industry || '',
                    relationship_type: newContact.relationship_type || '',
                    relationship_strength: newContact.relationship_strength || 0,
                    email: newContact.email || '',
                    phone: newContact.phone || '',
                    location: newContact.location || '',
                    notes: newContact.notes || '',
                  };
                  const created = await contactsAPI.create(payload);
                  // If the user entered freeform notes in the Create form, persist them as a ContactNote so
                  // they appear in the Notes tab (the Contact API returns related note objects, not a freeform notes string).
                  if (newContact.notes && typeof newContact.notes === 'string' && newContact.notes.trim()) {
                    try {
                      const createdNote = await contactsAPI.createNote(created.id, { content: newContact.notes });
                      // Attach the created note to the returned contact object for immediate UI consistency
                      created.notes = created.notes && Array.isArray(created.notes) ? [createdNote, ...created.notes] : [createdNote];
                    } catch (e) {
                      // Non-fatal; proceed without blocking contact creation
                    }
                  }
                  // Add mutual connections if any selected
                  if (newContact.mutual_connections && Array.isArray(newContact.mutual_connections) && newContact.mutual_connections.length > 0) {
                    for (const mutualId of newContact.mutual_connections) {
                      try {
                        await contactsAPI.addMutual(created.id, { 
                          related_contact_id: mutualId,
                          context: '',
                          source: 'manual'
                        });
                      } catch (e) {
                        // Non-fatal; continue adding other mutuals
                      }
                    }
                  }
                  setContacts((prev) => [created, ...prev]);
                  setNewContact({ name: '', email: '', phone: '', company: '', title: '', location: '', notes: '', relationship_type: '', relationship_strength: 0, industry: '', mutual_connections: [] });
                  setShowCreate(false);
                } catch (err) {
                  console.error('create contact error', err);
                  setCreateError(formatApiError(err, 'Failed to create contact.'));
                } finally {
                  setCreating(false);
                }
              }}>
                <div className="form-row" style={{ padding: 32 }}>
                  <div className="form-group">
                    <label>Full Name <span className="required">*</span></label>
                    <input type="text" name="name" value={newContact.name} onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" />
                  </div>

                  <div className="form-group">
                    <label>Job Title</label>
                    <input type="text" name="title" value={newContact.title} onChange={(e) => setNewContact((p) => ({ ...p, title: e.target.value }))} placeholder="e.g., Hiring Manager" />
                  </div>

                  <div className="form-group">
                    <label>Company</label>
                    <input type="text" name="company" value={newContact.company} onChange={(e) => setNewContact((p) => ({ ...p, company: e.target.value }))} placeholder="Company name" />
                  </div>
                    <div className="form-group">
                      <label>Relationship Type</label>
                      <input type="text" name="relationship_type" value={newContact.relationship_type || ''} onChange={(e) => setNewContact((p) => ({ ...p, relationship_type: e.target.value }))} placeholder="e.g., colleague, mentor" />
                    </div>
                    <div className="form-group">
                      <label>Industry</label>
                      <select name="industry" value={newContact.industry || ''} onChange={(e) => setNewContact((p) => ({ ...p, industry: e.target.value }))}>
                        <option value="">Select industry</option>
                        {industryOptions.map((ind) => (<option key={ind} value={ind}>{ind}</option>))}
                      </select>
                    </div>
                  <div className="form-group">
                    <label>Relationship Strength</label>
                    <input type="range" min="0" max="10" name="relationship_strength" value={newContact.relationship_strength || 0} onChange={(e) => setNewContact((p) => ({ ...p, relationship_strength: Number(e.target.value) }))} />
                    <div style={{ marginTop: 6 }}>{newContact.relationship_strength || 0}</div>
                  </div>

                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" name="email" value={newContact.email} onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))} placeholder="contact@example.com" />
                  </div>

                  <div className="form-group">
                    <label>Phone</label>
                    <input type="text" name="phone" value={newContact.phone} onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))} placeholder="(555) 555-5555" />
                  </div>

                  <div className="form-group">
                    <label>Location</label>
                    <input type="text" name="location" value={newContact.location} onChange={(e) => setNewContact((p) => ({ ...p, location: e.target.value }))} placeholder="City, State or Remote" />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Notes</label>
                    <textarea name="notes" value={newContact.notes} onChange={(e) => setNewContact((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes about the contact" rows="5" />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Mutual Connections</label>
                    <select 
                      multiple 
                      name="mutual_connections" 
                      value={newContact.mutual_connections || []} 
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        setNewContact((p) => ({ ...p, mutual_connections: selected }));
                      }}
                      style={{ minHeight: '100px' }}
                    >
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.display_name || c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}
                        </option>
                      ))}
                    </select>
                    <small style={{ color: '#6b7280', fontSize: '0.85rem' }}>Hold Ctrl/Cmd to select multiple contacts</small>
                  </div>

                  {createError && <div className="message error-message">{createError}</div>}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" className="contacts-btn-primary" disabled={creating}>{creating ? 'Saving…' : 'Save'}</button>
                      <button type="button" className="contacts-btn-secondary" onClick={() => { setShowCreate(false); setNewContact({ name: '', email: '', phone: '', company: '', title: '', location: '', notes: '', relationship_type: '', relationship_strength: 0, industry: '', mutual_connections: [] }); setCreateError(''); }}>Cancel</button>
                    </div>
                </div>
              </form>
            </div>
          )}
        </div>

        <div className="contacts-panel-body">
          {loading && <div className="contacts-loading">Loading…</div>}
          {!loading && contacts.length === 0 && (
            <div className="contacts-empty">No contacts found.</div>
          )}
          <ul className="contacts-list">
            {contacts.map((c) => (
              <li
                key={c.id}
                className="contacts-item contacts-card"
                onClick={() => {
                  const computedName = c.display_name || c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.full_name || c.email || '';
                  const mapped = {
                    ...c,
                    name: computedName,
                    company: c.company_name || c.company || '',
                    title: c.title || '',
                    location: c.location || '',
                    notes: (typeof c.notes === 'string' ? c.notes : ''),
                    relationship_type: c.relationship_type || '',
                    relationship_strength: c.relationship_strength || 0,
                    industry: c.industry || '',
                  };
                  setSelectedContact(c);
                  setEditContact(mapped);
                  setEditing(false);
                  setEditError('');
                  setActiveTab('details'); // Reset to details tab
                  // Clear all tab data when switching contacts
                  setNotesList([]);
                  setInteractionsList([]);
                  setRemindersList([]);
                  setMutualsList([]);
                  setCompanyLinksList([]);
                  setJobLinksList([]);
                  // If the contact record contains a freeform `notes` value (from create/edit form),
                  // show it in the Notes tab as a fallback when there are no separate note objects yet.
                  if (mapped.notes && mapped.notes.trim()) {
                    setNotesList([{ id: `inline-${c.id || 'new'}`, author: { username: 'You' }, content: mapped.notes, created_at: new Date().toISOString() }]);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="contacts-item-name">{c.display_name || c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.full_name || c.email}</div>
                <div className="contacts-item-meta">{c.email || c.primary_email || ''}</div>
                <div className="contacts-item-meta">{c.phone || ''}</div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
};

ContactsPanel.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  inline: PropTypes.bool,
  openCreate: PropTypes.bool,
  onReminderChange: PropTypes.func,
};

ContactsPanel.defaultProps = {
  open: false,
  onClose: () => {},
  inline: false,
  openCreate: false,
};

export default ContactsPanel;
