import { buildCalendarEvents } from '../DashboardCalendar';

describe('buildCalendarEvents', () => {
  it('maps deadlines to all-day events', () => {
    const events = buildCalendarEvents({
      deadlines: [{ id: 1, title: 'Backend Engineer', company_name: 'Acme', application_deadline: '2025-12-01' }],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'deadline-1',
      allDay: true,
      title: expect.stringContaining('Backend Engineer'),
      extendedProps: expect.objectContaining({ type: 'deadline', company: 'Acme' }),
    });
  });

  it('maps interviews with reminder color', () => {
    const events = buildCalendarEvents({
      interviews: [{
        id: 99,
        job_title: 'Interview',
        job_company: 'Beta',
        job_id: 321,
        scheduled_at: '2025-11-20T15:00:00Z',
        duration_minutes: 30,
        location: 'Zoom',
      }],
      reminders: [{ id: 99, reminder_type: '24h', scheduled_at: '2025-11-19T15:00:00Z' }],
    });
    expect(events).toHaveLength(1);
    expect(events[0].color).toBe('#f97316');
    expect(events[0].extendedProps).toMatchObject({ type: 'interview', reminder: expect.objectContaining({ reminder_type: '24h' }) });
  });

  it('includes user notes as editable events', () => {
    const events = buildCalendarEvents({
      notes: [{ id: 'note-1', title: 'Deep Work', start: '2025-11-18T12:00:00Z', end: '2025-11-18T14:00:00Z', allDay: false }],
    });
    expect(events[0]).toMatchObject({
      id: 'note-1',
      extendedProps: expect.objectContaining({ type: 'note' }),
    });
  });
});
