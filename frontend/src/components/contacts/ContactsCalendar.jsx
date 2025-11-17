import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import Icon from '../common/Icon';
import { contactsAPI } from '../../services/contactsAPI';

const ContactsCalendar = forwardRef((props, ref) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [urgentReminders, setUrgentReminders] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      // Load all reminders
      const allReminders = await contactsAPI.getAllReminders();
      console.log('Loaded contact reminders:', allReminders);
      
      // Separate urgent reminders (due within 24 hours or overdue)
      const now = new Date();
      const urgent = [];
      const groups = {};
      
      (allReminders || []).forEach((r) => {
        const dueDate = new Date(r.due_date);
        const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);
        
        // Mark as urgent if due within 24 hours or overdue
        if (hoursUntilDue <= 24 && hoursUntilDue >= -24 && !r.completed) {
          urgent.push(r);
        }
        
        // Group all reminders by date
        const dateStr = r.due_date?.split('T')[0] || 'No date';
        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push(r);
      });
      
      const list = Object.keys(groups).sort().map((d) => ({ date: d, items: groups[d] }));
      setItems(list);
      setUrgentReminders(urgent);
      setError('');
    } catch (e) {
      setError('Failed to load calendar items');
      console.error('Calendar load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  
  // Expose refresh method to parent component
  useImperativeHandle(ref, () => ({
    refresh: load
  }));

  const getReminderColor = (dueDateStr) => {
    try {
      const now = new Date();
      const due = new Date(dueDateStr);
      const oneDay = 1000 * 60 * 60 * 24;
      const diffDays = Math.floor((due - now) / oneDay);
      
      if (isNaN(diffDays)) return '#10b981'; // green - default
      if (diffDays < 0) return '#ef4444'; // red - overdue
      if (diffDays <= 7) return '#f59e0b'; // yellow - due within a week
      return '#10b981'; // green - due later
    } catch {
      return '#10b981';
    }
  };

  const formatTime = (datetimeStr) => {
    try {
      const date = new Date(datetimeStr);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const dismissReminder = async (reminderId) => {
    try {
      await contactsAPI.dismissReminder(reminderId);
      setUrgentReminders(prev => prev.filter(r => r.id !== reminderId));
      // Reload to update the main calendar view
      await load();
    } catch (e) {
      console.error('Failed to dismiss reminder:', e);
    }
  };

  const getUrgencyText = (dueDateStr) => {
    try {
      const now = new Date();
      const due = new Date(dueDateStr);
      const hoursUntilDue = (due - now) / (1000 * 60 * 60);
      
      if (hoursUntilDue < 0) return 'Overdue';
      if (hoursUntilDue <= 1) return 'Due in 1 hour';
      if (hoursUntilDue <= 24) return 'Due today';
      return 'Tomorrow';
    } catch {
      return '';
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <h2><Icon name="calendar" size="sm" /> Calendar</h2>
      
      {/* Urgent Reminders Section */}
      {urgentReminders.length > 0 && (
        <div style={{ 
          background: '#fef3c7', 
          border: '1px solid #fbbf24', 
          borderRadius: 8, 
          padding: 12, 
          marginBottom: 16 
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#92400e' }}>
            <Icon name="bell" size="sm" /> Urgent Reminders
          </h3>
          {urgentReminders.map((reminder) => (
            <div key={reminder.id} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 8,
              padding: 8,
              background: '#ffffff',
              borderRadius: 6
            }}>
              <div>
                <div style={{ fontWeight: 'bold', color: '#78350f' }}>
                  <Icon name="user" size="xs" />
                  {' '}{reminder.contact_name}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
                  {getUrgencyText(reminder.due_date)} - {formatTime(reminder.due_date)}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#374151', marginTop: 4 }}>
                  {reminder.message}
                </div>
              </div>
              <button
                onClick={() => dismissReminder(reminder.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: '#92400e'
                }}
                title="Dismiss"
              >
                <Icon name="x" size="sm" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {loading && <p>Loading…</p>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {!loading && items.length === 0 && <p>No upcoming reminders</p>}
      
      <div>
        {items.map((g) => (
          <div key={g.date} style={{ marginBottom: 12 }}>
            <h4 style={{ marginBottom: 6 }}>{g.date}</h4>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {g.items.map((reminder) => {
                const color = getReminderColor(reminder.due_date);
                return (
                  <li key={reminder.id} style={{ marginBottom: 6 }}>
                    <Icon name="bell" size="xs" style={{ color }} />
                    {' '}<span style={{ 
                      background: color, 
                      color: '#ffffff', 
                      padding: '4px 8px', 
                      borderRadius: 6, 
                      display: 'inline-block',
                      fontSize: '0.9rem'
                    }}>
                      {reminder.recurrence || 'One-time'}
                    </span>
                    <span style={{ marginLeft: 8, color: '#374151', fontWeight: 'bold' }}>
                      {reminder.contact_name}
                    </span>
                    <span style={{ marginLeft: 8, color: '#6b7280' }}>
                      {formatTime(reminder.due_date)} - {reminder.message}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
});

ContactsCalendar.displayName = 'ContactsCalendar';

export default ContactsCalendar;
