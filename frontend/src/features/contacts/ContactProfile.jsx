import React, { useEffect, useState } from 'react';
import { contactsAPI } from '../../../services/contactsAPI';

const ContactProfile = ({ contactId }) => {
  const [contact, setContact] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [newInteraction, setNewInteraction] = useState({ type: 'email', date: '', summary: '' });
  const [newNote, setNewNote] = useState('');
  const [newReminder, setNewReminder] = useState({ message: '', due_date: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const c = await contactsAPI.get(contactId);
        setContact(c);
        setInteractions(await contactsAPI.interactions(contactId));
        setNotes(await contactsAPI.notes(contactId));
        setReminders(await contactsAPI.reminders(contactId));
      } catch (err) {
        // ignore for now
      }
    };
    if (contactId) load();
  }, [contactId]);

  if (!contact) return <div>Select a contact to view profile</div>;

  return (
    <div className="contact-profile">
      <header>
        <h3>{contact.display_name || `${contact.first_name} ${contact.last_name}`}</h3>
        <div>{contact.title} — {contact.company_name}</div>
        <div>{contact.email} · {contact.phone}</div>
      </header>

      <section>
        <h4>Interactions</h4>
        <div className="quick-add">
          <select value={newInteraction.type} onChange={(e) => setNewInteraction({...newInteraction, type: e.target.value})}>
            <option value="email">Email</option>
            <option value="call">Call</option>
            <option value="meeting">Meeting</option>
            <option value="coffee">Coffee</option>
            <option value="linkedin">LinkedIn</option>
          </select>
          <input type="datetime-local" value={newInteraction.date} onChange={(e) => setNewInteraction({...newInteraction, date: e.target.value})} />
          <input placeholder="Summary" value={newInteraction.summary} onChange={(e) => setNewInteraction({...newInteraction, summary: e.target.value})} />
          <button onClick={async () => {
            try {
              const created = await contactsAPI.createInteraction(contactId, newInteraction);
              setInteractions((p) => [created, ...p]);
              setNewInteraction({ type: 'email', date: '', summary: '' });
              // refresh contact
              setContact(await contactsAPI.get(contactId));
            } catch (err) {
              // TODO: show error
            }
          }}>Add</button>
        </div>
        <ul>
          {interactions.map((i) => (
            <li key={i.id}>{new Date(i.date).toLocaleString()} — {i.type} — {i.summary}</li>
          ))}
        </ul>
      </section>

      <section>
        <h4>Notes</h4>
        <div className="quick-add-note">
          <textarea placeholder="Add a note" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
          <button onClick={async () => {
            try {
              const created = await contactsAPI.createNote(contactId, { content: newNote });
              setNotes((p) => [created, ...p]);
              setNewNote('');
            } catch (err) {
              // TODO: show error
            }
          }}>Save Note</button>
        </div>
        <ul>
          {notes.map((n) => (
            <li key={n.id}>{new Date(n.created_at).toLocaleString()} — {n.content}</li>
          ))}
        </ul>
      </section>

      <section>
        <h4>Reminders</h4>
        <div className="quick-add-reminder">
          <input placeholder="Message" value={newReminder.message} onChange={(e) => setNewReminder({...newReminder, message: e.target.value})} />
          <input type="datetime-local" value={newReminder.due_date} onChange={(e) => setNewReminder({...newReminder, due_date: e.target.value})} />
          <button onClick={async () => {
            try {
              const created = await contactsAPI.createReminder(contactId, { message: newReminder.message, due_date: newReminder.due_date });
              setReminders((p) => [created, ...p]);
              setNewReminder({ message: '', due_date: '' });
            } catch (err) {
              // TODO: show error
            }
          }}>Set Reminder</button>
        </div>
        <ul>
          {reminders.map((r) => (
            <li key={r.id}>{new Date(r.due_date).toLocaleString()} — {r.message} — {r.recurrence}</li>
          ))}
        </ul>
      </section>

      <section>
        <h4>Relationship Strength</h4>
        <div>
          <input type="range" min="0" max="100" value={contact.relationship_strength || 50} onChange={async (e) => {
            try {
              const updated = await contactsAPI.update(contactId, { relationship_strength: parseInt(e.target.value, 10) });
              setContact(updated);
            } catch (err) {
              // ignore
            }
          }} />
          <span>{contact.relationship_strength}</span>
        </div>
      </section>
    </div>
  );
};

export default ContactProfile;
