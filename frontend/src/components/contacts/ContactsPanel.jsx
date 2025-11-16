import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { contactsAPI } from '../../services/contactsAPI';
import './Contacts.css';

const ContactsPanel = ({ open, onClose }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '' });
  const [createError, setCreateError] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [editError, setEditError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

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

  useEffect(() => {
    if (!open) return;
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
  }, [open, debouncedQuery]);

  if (!open) return null;

  return (
    <div>
      <div className="contacts-overlay" onClick={onClose} />
      <aside className="contacts-panel" role="dialog" aria-label="Contacts" aria-modal="true">
        <div className="form-header">
          <h3>Contacts</h3>
          <button className="close-button" onClick={onClose} aria-label="Close contacts">✕</button>
        </div>
        {/* Contact detail drawer (overlay on top of panel) */}
        {selectedContact && (
          <>
            <div className="contacts-overlay" onClick={() => { setSelectedContact(null); setEditContact(null); setEditError(''); }} />
            <div className="contacts-detail-drawer" role="dialog" aria-modal="true">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                <h4 style={{ margin: 0 }}>{selectedContact.name || selectedContact.email || 'Contact'}</h4>
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
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="contacts-btn-primary" onClick={async () => {
                      setEditError('');
                      if (!editContact.name && !editContact.email) { setEditError('Please provide at least a name or email.'); return; }
                      try {
                        const updated = await contactsAPI.update(editContact.id, { name: editContact.name, email: editContact.email, phone: editContact.phone });
                        setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                        setSelectedContact(updated);
                        setEditContact(updated);
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
                            console.error('delete contact error', err);
                            setEditError(formatApiError(err, 'Failed to delete contact.'));
                          }
                        }}>Confirm Delete</button>
                        <button className="contacts-btn-secondary" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="contacts-btn-secondary" onClick={() => setDeleteConfirmId(editContact?.id)}>Delete</button>
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
            <div style={{ flex: '0 0 auto' }}>
              <button
                type="button"
                className="add-education-button"
                onClick={() => setShowCreate((v) => !v)}
                aria-expanded={showCreate}
              >
                {showCreate ? 'Cancel' : 'New'}
              </button>
            </div>
          </div>

          {showCreate && (
            <form className="contacts-create-form" onSubmit={async (e) => {
              e.preventDefault();
              setCreateError('');
              // simple validation
              if (!newContact.name && !newContact.email) {
                setCreateError('Please provide at least a name or email.');
                return;
              }
              setCreating(true);
              try {
                const created = await contactsAPI.create(newContact);
                // prepend new contact
                setContacts((prev) => [created, ...prev]);
                setNewContact({ name: '', email: '', phone: '' });
                setShowCreate(false);
              } catch (err) {
                console.error('create contact error', err);
                setCreateError(formatApiError(err, 'Failed to create contact.'));
              } finally {
                setCreating(false);
              }
            }}>
              <div style={{ display: 'grid', gap: 8 }}>
                {createError && <div className="contacts-error">{createError}</div>}
                <input
                  className="contacts-create-input"
                  placeholder="Full name"
                  value={newContact.name}
                  onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))}
                  aria-label="Contact name"
                />
                <input
                  className="contacts-create-input"
                  placeholder="Email"
                  value={newContact.email}
                  onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))}
                  aria-label="Contact email"
                />
                <input
                  className="contacts-create-input"
                  placeholder="Phone"
                  value={newContact.phone}
                  onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))}
                  aria-label="Contact phone"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="contacts-btn-primary" disabled={creating}>
                    {creating ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" className="contacts-btn-secondary" onClick={() => { setShowCreate(false); setNewContact({ name: '', email: '', phone: '' }); setCreateError(''); }}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="contacts-panel-body">
          {loading && <div className="contacts-loading">Loading…</div>}
          {!loading && contacts.length === 0 && (
            <div className="contacts-empty">No contacts found.</div>
          )}
          <ul className="contacts-list">
            {contacts.map((c) => (
              <li key={c.id} className="contacts-item contacts-card" onClick={() => { setSelectedContact(c); setEditContact(c); setEditing(false); setEditError(''); }} role="button" tabIndex={0}>
                <div className="contacts-item-name">{c.name || c.full_name || c.first_name}</div>
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
};

ContactsPanel.defaultProps = {
  open: false,
  onClose: () => {},
};

export default ContactsPanel;
