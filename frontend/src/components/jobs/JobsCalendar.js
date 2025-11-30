import React, { useEffect, useState } from 'react';
import { jobsAPI, interviewsAPI } from '../../services/api';
import Icon from '../common/Icon';

export default function JobsCalendar() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reminders, setReminders] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      // Load deadlines
      const deadlines = await jobsAPI.getUpcomingDeadlines(50).catch(() => []);
      console.log('Loaded deadlines:', deadlines);
      
      // Load ALL interviews (not just upcoming) for debugging
      const interviews = await interviewsAPI.getInterviews({}).catch(() => []);
      console.log('Loaded interviews:', interviews);
      
      // Load active reminders
      const activeReminders = await interviewsAPI.getActiveReminders().catch(() => []);
      console.log('Active reminders:', activeReminders);
      setReminders(activeReminders || []);
      
      // Combine and group by date
      const groups = {};
      
      // Add job deadlines
      (deadlines || []).forEach((j) => {
        const d = j.application_deadline || 'No deadline';
        if (!groups[d]) groups[d] = [];
        groups[d].push({ type: 'deadline', data: j });
      });
      
      // Add interviews
      (interviews || []).forEach((i) => {
        // Extract date from scheduled_at (format: "YYYY-MM-DDTHH:MM:SSZ")
        const dateStr = i.scheduled_at?.split('T')[0] || 'Unknown';
        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push({ type: 'interview', data: i });
      });
      
      const list = Object.keys(groups).sort().map((d) => ({ date: d, items: groups[d] }));
      setItems(list);
      setError('');
    } catch (e) {
      setError('Failed to load calendar items');
      console.error('Calendar load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getInterviewTypeIcon = (type) => {
    const icons = {
      phone: 'phone',
      video: 'video',
      in_person: 'map-pin',
      assessment: 'file-text',
      group: 'users',
    };
    return icons[type] || 'calendar';
  };

  const getInterviewTypeColor = (type) => {
    const colors = {
      phone: '#8b5cf6', // purple
      video: '#3b82f6', // blue
      in_person: '#10b981', // green
      assessment: '#f59e0b', // amber
      group: '#ec4899', // pink
    };
    return colors[type] || '#6b7280';
  };

  const formatTime = (datetimeStr) => {
    try {
      const date = new Date(datetimeStr);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const dismissReminder = async (interviewId, reminderType) => {
    try {
      await interviewsAPI.dismissReminder(interviewId, reminderType);
      setReminders(prev => prev.filter(r => !(r.id === interviewId && r.reminder_type === reminderType)));
    } catch (e) {
      console.error('Failed to dismiss reminder:', e);
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <h2><Icon name="calendar" size="sm" /> Calendar</h2>
      
      {/* Active Reminders Section */}
      {reminders.length > 0 && (
        <div style={{ 
          background: '#fef3c7', 
          border: '1px solid #fbbf24', 
          borderRadius: 8, 
          padding: 12, 
          marginBottom: 16 
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#92400e' }}>
            <Icon name="bell" size="sm" /> Upcoming Interviews
          </h3>
          {reminders.map((reminder) => (
            <div key={`${reminder.id}-${reminder.reminder_type}`} style={{ 
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
                  <Icon name={getInterviewTypeIcon(reminder.interview_type)} size="xs" />
                  {' '}{reminder.job_title} @ {reminder.job_company}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
                  {reminder.reminder_type === '24h' ? 'Tomorrow' : 'In 1 hour'} - {formatTime(reminder.scheduled_at)}
                </div>
              </div>
              <button
                onClick={() => dismissReminder(reminder.id, reminder.reminder_type)}
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
      
      {loading && <p>Loading...</p>}
      {error && (
        <div role="alert" style={{ color: 'red' }}>
          Failed to load calendar items
        </div>
      )}
      {!loading && items.length === 0 && <p>No upcoming deadlines or interviews</p>}
      
      <div>
        {items.map((g) => (
          <div key={g.date} style={{ marginBottom: 12 }}>
            <h4 style={{ marginBottom: 6 }}>{g.date}</h4>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {g.items.map((item, idx) => {
                if (item.type === 'deadline') {
                  const j = item.data;
                  const isApplied = j.status && j.status !== 'interested';
                  const pillStyle = isApplied
                    ? { background: '#e5e7eb', color: '#374151', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }
                    : { background: '#60a5fa', color: '#ffffff', padding: '4px 8px', borderRadius: 6, display: 'inline-block' };
                  return (
                    <li key={`deadline-${j.id}`} style={{ marginBottom: 6 }}>
                      <Icon name="file-text" size="xs" />
                      {' '}<span style={pillStyle}>{j.title}</span>
                      <span style={{ marginLeft: 8, color: '#6b7280' }}>@ {j.company_name} {j.application_deadline ? `(Deadline: ${j.application_deadline})` : ''}</span>
                    </li>
                  );
                } else if (item.type === 'interview') {
                  const i = item.data;
                  const color = getInterviewTypeColor(i.interview_type);
                  const icon = getInterviewTypeIcon(i.interview_type);
                  return (
                    <li key={`interview-${i.id}`} style={{ marginBottom: 6 }}>
                      <Icon name={icon} size="xs" style={{ color }} />
                      {' '}<span style={{ 
                        background: color, 
                        color: '#ffffff', 
                        padding: '4px 8px', 
                        borderRadius: 6, 
                        display: 'inline-block',
                        fontSize: '0.9rem'
                      }}>
                        {i.interview_type_display || i.interview_type}
                      </span>
                      <span style={{ marginLeft: 8, color: '#374151', fontWeight: 'bold' }}>
                        {i.job_title} @ {i.job_company}
                      </span>
                      <span style={{ marginLeft: 8, color: '#6b7280' }}>
                        {formatTime(i.scheduled_at)}
                        {i.duration_minutes && ` (${i.duration_minutes} min)`}
                      </span>
                    </li>
                  );
                }
                return null;
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
