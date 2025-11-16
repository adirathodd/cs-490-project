import React, { useEffect, useState } from 'react';
import { contactsAPI } from '../../../services/contactsAPI';
import ContactForm from './ContactForm';

const ContactList = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');

  const load = async (q = '') => {
    setLoading(true);
    try {
      const data = await contactsAPI.list(q);
      setContacts(data || []);
    } catch (err) {
      setError(err?.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (payload) => {
    try {
      const created = await contactsAPI.create(payload);
      setContacts((prev) => [created, ...prev]);
      setShowForm(false);
    } catch (err) {
      setError(err?.message || 'Failed to create contact');
    }
  };

  const handleSearch = (e) => {
    const q = e.target.value;
    setQuery(q);
    // basic debounce
    setTimeout(() => load(q), 300);
  };

  return (
    <div className="contacts-list">
      <div className="contacts-header">
        <h2>Contacts</h2>
        <div>
          <input placeholder="Search contacts..." value={query} onChange={handleSearch} />
          <button onClick={() => setShowForm(true)}>Add Contact</button>
        </div>
      </div>

      {showForm && <ContactForm onSave={handleCreate} onCancel={() => setShowForm(false)} />}

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      <ul>
        {contacts.map((c) => (
          <li key={c.id}>
            <strong>{c.display_name || `${c.first_name} ${c.last_name}`}</strong>
            <div>{c.title} — {c.company_name}</div>
            <div>{c.email}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContactList;
