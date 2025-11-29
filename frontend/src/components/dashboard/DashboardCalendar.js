import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';

import { jobsAPI, interviewsAPI, calendarAPI } from '../../services/api';
import Icon from '../common/Icon';

const LOCAL_NOTES_KEY = 'dashboardCalendarNotes';

const EVENT_COLORS = {
  deadline: '#1d4ed8',
  interview: '#0ea5e9',
  interviewReminder: '#f97316',
  note: '#059669',
  external: '#7c3aed',
};

const noop = () => {};

const normalizeKey = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed.toLowerCase() : null;
  }
  return String(value);
};

const VIEW_OPTIONS = [
  { id: 'dayGridMonth', label: 'Month' },
  { id: 'timeGridWeek', label: 'Week' },
  { id: 'timeGridDay', label: 'Day' },
  { id: 'listWeek', label: 'Agenda' },
];

const formatRangeLabel = (viewType, start, end, currentDate) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const monthYear = { month: 'long', year: 'numeric' };
  const centerDate = currentDate ? new Date(currentDate) : startDate;

  switch (viewType) {
    case 'timeGridDay':
      return startDate.toLocaleString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    case 'timeGridWeek':
    case 'listWeek': {
      const inclusiveEnd = new Date(endDate.getTime() - 1);
      const startFmt = startDate.toLocaleString([], { month: 'short', day: 'numeric' });
      const endFmt = inclusiveEnd.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startFmt} – ${endFmt}`;
    }
    case 'dayGridMonth':
    default:
      return centerDate.toLocaleString([], monthYear);
  }
};

const formatISO = (value) => {
  if (!value) return null;
  try {
    return new Date(value).toISOString();
  } catch (err) {
    return value;
  }
};

const computeEnd = (startISO, durationMinutes = 60) => {
  try {
    const start = new Date(startISO);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    return end.toISOString();
  } catch (err) {
    return startISO;
  }
};

export const buildCalendarEvents = ({ deadlines = [], interviews = [], notes = [], reminders = [] }) => {
  const reminderMap = new Map(reminders.map((r) => [r.id, r]));
  const events = [];

  deadlines.filter((job) => job?.application_deadline).forEach((job) => {
    events.push({
      id: `deadline-${job.id}`,
      title: `Apply · ${job.title}`,
      start: formatISO(job.application_deadline),
      end: formatISO(job.application_deadline),
      allDay: true,
      color: EVENT_COLORS.deadline,
      textColor: '#ffffff',
      extendedProps: {
        type: 'deadline',
        company: job.company_name,
        status: job.status,
        jobId: job.id,
        job,
      },
    });
  });

  interviews.forEach((interview) => {
    const reminder = reminderMap.get(interview.id);
    const duration = interview.duration_minutes || 60;
    const jobId = interview.job || interview.job_id || interview.job_entry || null;
    const provider = interview?.event_metadata?.calendar_provider || interview.calendar_provider || interview.calendarProvider;
    const calendarKey = normalizeKey(
      interview?.event_metadata?.external_calendar_id ||
      interview.external_calendar_id ||
      interview.external_calendar ||
      interview.calendar_owner ||
      interview.calendar_email
    );
    events.push({
      id: `interview-${interview.id}`,
      title: `${interview.job_title} · ${interview.job_company}`,
      start: formatISO(interview.scheduled_at),
      end: computeEnd(interview.scheduled_at, duration),
      allDay: false,
      color: reminder ? EVENT_COLORS.interviewReminder : EVENT_COLORS.interview,
      extendedProps: {
        type: 'interview',
        reminder,
        interview,
        interviewId: interview.id,
        jobId,
        location: interview.location,
        meetingLink: interview.meeting_link,
        meetingPlatform: interview.interview_type_display,
        interviewer: interview.interviewer_name,
        duration,
        externalLink: interview.external_event_link || interview.meeting_link,
        calendarProvider: provider,
        integrationId: calendarKey,
        externalCalendarId: interview.external_calendar_id,
      },
    });
  });

  notes.forEach((note) => {
    events.push({
      id: note.id,
      title: note.title,
      start: note.start,
      end: note.end,
      allDay: note.allDay,
      color: EVENT_COLORS.note,
      extendedProps: {
        type: 'note',
        source: 'note',
        note,
      },
    });
  });

  return events;
};

const initialNotes = () => {
  try {
    if (typeof window === 'undefined') return [];
    const stored = window.localStorage.getItem(LOCAL_NOTES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    return [];
  }
};

const DashboardCalendar = ({ onSummaryChange = noop }) => {
  const calendarRef = useRef(null);
  const [data, setData] = useState({ deadlines: [], interviews: [] });
  const [reminders, setReminders] = useState([]);
  const [notes, setNotes] = useState(() => initialNotes());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('dayGridMonth');
  const [pendingReminderId, setPendingReminderId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [currentRangeLabel, setCurrentRangeLabel] = useState('');
  const [integrations, setIntegrations] = useState([]);
  const [visibleAccountIds, setVisibleAccountIds] = useState([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [integrationError, setIntegrationError] = useState('');
  const [externalEvents, setExternalEvents] = useState([]);
  const [externalEventsLoading, setExternalEventsLoading] = useState(false);
  const [externalEventsError, setExternalEventsError] = useState('');
  const [connectBusy, setConnectBusy] = useState(false);
  const [disconnectingIntegrationId, setDisconnectingIntegrationId] = useState(null);
  const [calendarStatusBanner, setCalendarStatusBanner] = useState('');
  const [eventActionError, setEventActionError] = useState('');
  const [eventActionBusy, setEventActionBusy] = useState(false);

  const loadIntegrations = useCallback(async () => {
    setIntegrationsLoading(true);
    try {
      const list = await calendarAPI.getIntegrations();
      const normalized = (Array.isArray(list) ? list : []).map((integration, index) => {
        const clientKey =
          normalizeKey(integration?.external_email) ||
          normalizeKey(integration?.external_account_id) ||
          normalizeKey(integration?.id) ||
          normalizeKey(`${integration?.provider || 'calendar'}-${index}`) ||
          `calendar-${index}`;
        return { ...integration, clientKey };
      });
      const filtered = normalized.filter((integration) => integration.status !== 'disconnected');
      setIntegrations(filtered);
      setIntegrationError('');
      setVisibleAccountIds((prev) => {
        if (!prev.length) {
          return prev;
        }
        const connectedSet = new Set(
          filtered
            .filter((item) => item.status === 'connected' && item.clientKey)
            .map((item) => item.clientKey)
        );
        const filtered = prev.filter((key) => connectedSet.has(key));
        return filtered;
      });
    } catch (err) {
      const message = typeof err === 'string' ? err : err?.error || err?.message || 'Unable to load calendar connections.';
      setIntegrationError(message);
      setIntegrations([]);
      setVisibleAccountIds([]);
    } finally {
      setIntegrationsLoading(false);
    }
  }, []);

  const loadExternalEvents = useCallback(async () => {
    const hasConnectedGoogle = integrations.some((integration) => integration.provider === 'google' && integration.status === 'connected');
    if (!hasConnectedGoogle) {
      setExternalEvents([]);
      setExternalEventsError('');
      return;
    }

    setExternalEventsLoading(true);
    try {
      const response = await calendarAPI.fetchGoogleEvents({ days_past: 30, days_future: 60 });
      const events = Array.isArray(response?.events) ? response.events : [];
      setExternalEvents(events);
      if (response?.errors?.length) {
        setExternalEventsError(response.errors[0]?.message || 'Some Google calendars could not be refreshed.');
      } else {
        setExternalEventsError('');
      }
    } catch (err) {
      const message = typeof err === 'string' ? err : err?.error || err?.message || 'Unable to load Google calendar events.';
      setExternalEventsError(message);
    } finally {
      setExternalEventsLoading(false);
    }
  }, [integrations]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  useEffect(() => {
    loadExternalEvents();
  }, [loadExternalEvents]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const calendarQuery = params.get('calendar');
    if (calendarQuery) {
      setCalendarStatusBanner(calendarQuery);
      params.delete('calendar');
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
      window.history.replaceState({}, '', nextUrl);
      loadIntegrations();
    }
  }, [loadIntegrations]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(notes));
      }
    } catch (err) {
      // Ignore storage write errors (Safari private mode, etc.)
    }
  }, [notes]);

  const internalEvents = useMemo(
    () => buildCalendarEvents({ deadlines: data.deadlines, interviews: data.interviews, notes, reminders }),
    [data, notes, reminders]
  );

  const googleEvents = useMemo(() => {
    if (!externalEvents.length) {
      return [];
    }
    return externalEvents
      .map((event) => {
        if (!event?.start) {
          return null;
        }
        const integrationKey = normalizeKey(
          event.external_email ||
          event.external_account_id ||
          event.integration_id ||
          null
        );
        return {
          id: `external-${event.integration_id || 'google'}-${event.id}`,
          title: event.summary || 'Busy',
          start: event.start,
          end: event.end || event.start,
          allDay: Boolean(event.all_day),
          color: EVENT_COLORS.external,
          textColor: '#ffffff',
          extendedProps: {
            type: 'external',
            provider: 'google',
            integrationId: integrationKey,
            accountEmail: event.external_email,
            location: event.location,
            meetingLink: event.hangout_link,
            externalLink: event.html_link,
            attendees: event.attendees || [],
            raw: event,
          },
        };
      })
      .filter(Boolean);
  }, [externalEvents]);

  const events = useMemo(() => [...internalEvents, ...googleEvents], [internalEvents, googleEvents]);

  const connectedAccountKeys = useMemo(
    () => integrations.filter((integration) => integration.status === 'connected' && integration.clientKey).map((integration) => integration.clientKey),
    [integrations]
  );

  const resolvedVisibleAccountIds = useMemo(() => {
    if (!connectedAccountKeys.length) {
      return [];
    }
    if (!visibleAccountIds.length) {
      return connectedAccountKeys;
    }
    const allowed = new Set(connectedAccountKeys);
    const filtered = visibleAccountIds.filter((key) => allowed.has(key));
    return filtered.length ? filtered : connectedAccountKeys;
  }, [connectedAccountKeys, visibleAccountIds]);

  const visibleEvents = useMemo(() => {
    if (!resolvedVisibleAccountIds.length) {
      return events;
    }
    const visibleSet = new Set(resolvedVisibleAccountIds);
    return events.filter((evt) => {
      const integrationId = evt.extendedProps?.integrationId ? normalizeKey(evt.extendedProps.integrationId) : null;
      if (!integrationId) {
        return true;
      }
      return visibleSet.has(integrationId);
    });
  }, [events, resolvedVisibleAccountIds]);

  const connectionSummary = useMemo(() => {
    if (integrationsLoading) {
      return 'Checking calendar connections…';
    }
    if (!connectedAccountKeys.length) {
      return 'No calendars connected yet';
    }
    if (!resolvedVisibleAccountIds.length || resolvedVisibleAccountIds.length === connectedAccountKeys.length) {
      const label = connectedAccountKeys.length === 1 ? 'calendar' : 'calendars';
      return `All ${connectedAccountKeys.length} ${label} visible`;
    }
    return `${resolvedVisibleAccountIds.length} of ${connectedAccountKeys.length} calendars visible`;
  }, [connectedAccountKeys, resolvedVisibleAccountIds, integrationsLoading]);

  const hasConnectedCalendars = connectedAccountKeys.length > 0;
  const connectButtonLabel = hasConnectedCalendars ? 'Add another Google calendar' : 'Connect Google calendar';

  const activeViewLabel = useMemo(() => VIEW_OPTIONS.find((opt) => opt.id === activeView)?.label || 'Month', [activeView]);

  const summarySnapshot = useMemo(() => {
    const deadlinesCount = data.deadlines?.length || 0;
    const interviewsCount = data.interviews?.length || 0;
    const remindersCount = reminders.length;
    const actionableEvents = visibleEvents.filter((evt) => evt.extendedProps?.type !== 'note');
    const now = new Date();
    const nextEvent = actionableEvents
      .filter((evt) => evt.start)
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .find((evt) => new Date(evt.start) >= now);

    let nextLabel = 'No upcoming events';
    let nextTime = '';
    if (nextEvent) {
      nextLabel = nextEvent.title;
      nextTime = new Date(nextEvent.start).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    return {
      deadlinesCount,
      interviewsCount,
      remindersCount,
      nextLabel,
      nextTime,
    };
  }, [data.deadlines, data.interviews, reminders, visibleEvents]);

  useEffect(() => {
    onSummaryChange(summarySnapshot);
  }, [summarySnapshot, onSummaryChange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [deadlines, interviewsList, remindersList] = await Promise.all([
        jobsAPI.getUpcomingDeadlines(200),
        interviewsAPI.getInterviews({ include_past: true }),
        interviewsAPI.getActiveReminders(),
      ]);
      setData({ deadlines: deadlines || [], interviews: interviewsList || [] });
      setReminders(remindersList || []);
      setError('');
      loadExternalEvents();
    } catch (err) {
      console.error('Failed to load calendar data', err);
      setError('Unable to load events. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    setIntegrationError('');
    setCalendarStatusBanner('');
    setConnectBusy(true);
    try {
      const returnUrl = typeof window === 'undefined' ? '' : window.location.href;
      const response = await calendarAPI.startGoogleConnect({ return_url: returnUrl });
      if (response?.auth_url) {
        window.location.assign(response.auth_url);
      } else {
        setIntegrationError('Unable to start Google authorization. Missing redirect URL.');
      }
    } catch (err) {
      const message = typeof err === 'string' ? err : err?.error || err?.message || 'Failed to start Google authorization.';
      setIntegrationError(message);
    } finally {
      setConnectBusy(false);
    }
  };

  const handleDisconnectGoogle = async (integration) => {
    if (!integration?.id) {
      setIntegrationError('Unable to disconnect this calendar because it is missing an identifier. Please refresh and try again.');
      return;
    }

    const accountLabel = integration.external_email || integration.external_account_id || 'this Google account';
    const confirmed = window.confirm(`Disconnect ${accountLabel}? Interviews will stop syncing to this calendar until you reconnect.`);
    if (!confirmed) {
      return;
    }

    setIntegrationError('');
    setCalendarStatusBanner('');
    setDisconnectingIntegrationId(integration.id);

    const previousIntegrations = integrations.slice();
    const previousVisibleAccounts = visibleAccountIds.slice();
    setIntegrations((prev) => prev.filter((item) => item.clientKey !== integration.clientKey));
    setVisibleAccountIds((prev) => prev.filter((key) => key !== integration.clientKey));

    try {
      const reason = integration.external_email ? `User disconnected ${integration.external_email}` : undefined;
      await calendarAPI.disconnectGoogle(integration.id, reason);
      await loadIntegrations();
      setCalendarStatusBanner('disconnected');
    } catch (err) {
      setIntegrations(previousIntegrations);
      setVisibleAccountIds(previousVisibleAccounts);
      const message = typeof err === 'string' ? err : err?.error || err?.message || 'Failed to disconnect Google Calendar.';
      setIntegrationError(message);
    } finally {
      setDisconnectingIntegrationId(null);
    }
  };

  const toggleAccountVisibility = (clientKey) => {
    if (!clientKey) {
      return;
    }
    setVisibleAccountIds((prev) => {
      if (!prev.length) {
        return [clientKey];
      }
      if (prev.includes(clientKey)) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((key) => key !== clientKey);
      }
      return [...prev, clientKey];
    });
  };

  const calendarApi = () => calendarRef.current?.getApi();
  const calendarControlsDisabled = collapsed;

  const changeView = (view) => {
    setActiveView(view);
    calendarApi()?.changeView(view);
  };

  const handleDatesSet = (rangeInfo) => {
    setCurrentRangeLabel(formatRangeLabel(
      rangeInfo.view?.type,
      rangeInfo.start,
      rangeInfo.end,
      rangeInfo.view?.calendar?.getDate?.()
    ));
  };

  const handleToggleCollapsed = () => setCollapsed((prev) => !prev);

  const handleSelect = (selection) => {
    const title = window.prompt('Quick add: give this personal block a title');
    if (!title) {
      return;
    }
    const newNote = {
      id: `note-${Date.now()}`,
      title,
      start: selection.startStr,
      end: selection.endStr,
      allDay: selection.allDay,
    };
    setNotes((prev) => [...prev, newNote]);
    selection.view.calendar.unselect();
  };

  const handleEventClick = (clickInfo) => {
    clickInfo.jsEvent?.preventDefault?.();
    const event = clickInfo.event;
    setSelectedEvent({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      ...event.extendedProps,
    });
    setShowEventModal(true);
  };

  const persistNotePosition = (event) => {
    setNotes((prev) => prev.map((note) => (
      note.id === event.id
        ? { ...note, start: event.start?.toISOString(), end: event.end?.toISOString(), allDay: event.allDay }
        : note
    )));
  };

  const handleEventDrop = (changeInfo) => {
    if (changeInfo.event.extendedProps.type !== 'note') {
      changeInfo.revert();
      return;
    }
    persistNotePosition(changeInfo.event);
  };

  const handleEventResize = (resizeInfo) => {
    if (resizeInfo.event.extendedProps.type !== 'note') {
      resizeInfo.revert();
      return;
    }
    persistNotePosition(resizeInfo.event);
  };

  const removeNote = (noteId) => {
    setNotes((prev) => prev.filter((note) => note.id !== noteId));
    if (selectedEvent?.id === noteId) {
      setSelectedEvent(null);
    }
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setEventActionError('');
  };

  const handleEditEvent = (eventData) => {
    if (!eventData) {
      return;
    }
    setEventActionError('');

    if (eventData.type === 'note') {
      const nextTitle = window.prompt('Update block title', eventData.title || 'Focus block');
      if (!nextTitle || !nextTitle.trim()) {
        return;
      }
      setNotes((prev) => prev.map((note) => (note.id === eventData.id ? { ...note, title: nextTitle.trim() } : note)));
      setSelectedEvent((prev) => (prev?.id === eventData.id ? { ...prev, title: nextTitle.trim() } : prev));
      return;
    }

    if (eventData.type === 'interview' && eventData.jobId) {
      window.open(`/jobs/${eventData.jobId}?focus=interviews`, '_self');
      return;
    }

    if (eventData.type === 'deadline' && eventData.jobId) {
      window.open(`/jobs/${eventData.jobId}`, '_self');
      return;
    }

    if (eventData.type === 'external' && eventData.externalLink) {
      window.open(eventData.externalLink, '_blank', 'noopener');
      return;
    }

    setEventActionError('Editing is not available for this type of event.');
  };

  const handleDeleteEvent = async (eventData) => {
    if (!eventData) {
      return;
    }
    setEventActionError('');

    if (eventData.type === 'note') {
      removeNote(eventData.id);
      closeEventModal();
      return;
    }

    if (eventData.type === 'interview' && eventData.interviewId) {
      const confirmed = window.confirm('Delete this interview from your schedule? This cannot be undone.');
      if (!confirmed) {
        return;
      }
      setEventActionBusy(true);
      try {
        await interviewsAPI.deleteInterview(eventData.interviewId);
        await loadData();
        closeEventModal();
      } catch (err) {
        const message = typeof err === 'string' ? err : err?.error || err?.message || 'Failed to delete interview.';
        setEventActionError(message);
      } finally {
        setEventActionBusy(false);
      }
      return;
    }

    if (eventData.type === 'deadline' && eventData.jobId) {
      const confirmed = window.confirm('Remove this deadline reminder from your calendar?');
      if (!confirmed) {
        return;
      }
      setEventActionBusy(true);
      try {
        await jobsAPI.updateJob(eventData.jobId, { application_deadline: null });
        await loadData();
        closeEventModal();
      } catch (err) {
        const message = typeof err === 'string' ? err : err?.error || err?.message || 'Failed to remove deadline.';
        setEventActionError(message);
      } finally {
        setEventActionBusy(false);
      }
      return;
    }

    if (eventData.type === 'external') {
      if (eventData.externalLink) {
        const confirmed = window.confirm('Open this event in Google Calendar to remove it?');
        if (confirmed) {
          window.open(eventData.externalLink, '_blank', 'noopener');
        }
      } else {
        setEventActionError('Delete this event from Google Calendar to remove it from the dashboard.');
      }
      return;
    }

    setEventActionError('Deleting is not available for this type of event.');
  };

  const dismissReminder = async (interviewId, reminderType) => {
    setPendingReminderId(interviewId);
    try {
      await interviewsAPI.dismissReminder(interviewId, reminderType);
      setReminders((prev) => prev.filter((r) => !(r.id === interviewId && r.reminder_type === reminderType)));
    } catch (err) {
      console.error('Failed to dismiss reminder', err);
    } finally {
      setPendingReminderId(null);
    }
  };

  const reminderBadge = (reminderType) => {
    const isDayAhead = reminderType === '24h';
    const label = isDayAhead ? '24h' : (reminderType === '2h' ? '2h' : '1h');
    return (
      <span className={`reminder-pill ${isDayAhead ? 'pill-warning' : 'pill-info'}`}>
        {label}
      </span>
    );
  };

  const reminderTimingCopy = (reminderType) => {
    if (reminderType === '24h') return 'Tomorrow';
    if (reminderType === '2h') return 'In ~2 hours';
    return 'In ~1 hour';
  };

  const renderDetails = () => {
    if (!selectedEvent) {
      return (
        <div className="calendar-details__empty">
          <Icon name="calendar" size="lg" />
          <p>Select any block to see details.</p>
        </div>
      );
    }

    if (selectedEvent.type === 'deadline') {
      return (
        <div>
          <p className="calendar-details__eyebrow">Application Deadline</p>
          <h3>{selectedEvent.title}</h3>
          <p className="calendar-details__meta">{selectedEvent.company}</p>
          <p>Status: {selectedEvent.status || 'interested'}</p>
          <p>{selectedEvent.allDay ? 'All-day reminder' : 'Timed event'}</p>
          {selectedEvent.jobId && (
            <button
              className="calendar-link"
              onClick={() => window.open(`/jobs/${selectedEvent.jobId}`, '_self')}
            >
              View job entry
            </button>
          )}
        </div>
      );
    }

    if (selectedEvent.type === 'interview') {
      return (
        <div>
          <p className="calendar-details__eyebrow">Interview</p>
          <h3>{selectedEvent.title}</h3>
          {selectedEvent.interviewer && (
            <p className="calendar-details__meta">With {selectedEvent.interviewer}</p>
          )}
          <p>Location: {selectedEvent.location || 'Virtual'}</p>
          <p>Duration: {selectedEvent.duration} minutes</p>
          {selectedEvent.reminder && (
            <div className="calendar-reminder-chip">
              Upcoming reminder: {reminderTimingCopy(selectedEvent.reminder.reminder_type)}
            </div>
          )}
          <div className="calendar-details__actions">
            {selectedEvent.jobId && (
              <button className="calendar-link" onClick={() => window.open(`/jobs/${selectedEvent.jobId}`, '_self')}>
                Open job workspace
              </button>
            )}
            {selectedEvent.meetingLink && (
              <button className="calendar-link" onClick={() => window.open(selectedEvent.meetingLink, '_blank', 'noopener')}>Join meeting</button>
            )}
            {selectedEvent.externalLink && selectedEvent.externalLink !== selectedEvent.meetingLink && (
              <button className="calendar-link" onClick={() => window.open(selectedEvent.externalLink, '_blank', 'noopener')}>View on Google Calendar</button>
            )}
          </div>
        </div>
      );
    }

    if (selectedEvent.type === 'external') {
      const startLabel = selectedEvent.start
        ? new Date(selectedEvent.start).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '';
      const endLabel = selectedEvent.end
        ? new Date(selectedEvent.end).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '';
      const attendees = Array.isArray(selectedEvent.attendees)
        ? selectedEvent.attendees
            .map((attendee) => attendee?.email || attendee?.displayName)
            .filter(Boolean)
        : [];
      return (
        <div>
          <p className="calendar-details__eyebrow">Google Calendar</p>
          <h3>{selectedEvent.title}</h3>
          {startLabel && (
            <p className="calendar-details__meta">
              {startLabel}
              {endLabel && endLabel !== startLabel ? ` – ${endLabel}` : ''}
            </p>
          )}
          {selectedEvent.accountEmail && <p>Calendar: {selectedEvent.accountEmail}</p>}
          {selectedEvent.location && <p>Location: {selectedEvent.location}</p>}
          {attendees.length > 0 && <p>Attendees: {attendees.join(', ')}</p>}
          <div className="calendar-details__actions">
            {selectedEvent.meetingLink && (
              <button className="calendar-link" onClick={() => window.open(selectedEvent.meetingLink, '_blank', 'noopener')}>
                Join meeting
              </button>
            )}
            {selectedEvent.externalLink && (
              <button className="calendar-link" onClick={() => window.open(selectedEvent.externalLink, '_blank', 'noopener')}>
                View in Google Calendar
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div>
        <p className="calendar-details__eyebrow">Personal Block</p>
        <h3>{selectedEvent.title}</h3>
        <p>{selectedEvent.allDay ? 'All-day focus block' : 'Timed session'}</p>
        <button className="calendar-link" onClick={() => removeNote(selectedEvent.id)}>
          Remove block
        </button>
      </div>
    );
  };

  return (
    <div className={`calendar-panel ${collapsed ? 'calendar-panel--collapsed' : ''}`}>
      <div className="calendar-panel__header">
        <div className="calendar-controls-grid" role="group" aria-label="Calendar controls">
          <div className="calendar-control-card calendar-connections-card" aria-label="External calendar connections">
            <p className="calendar-control-card__label">Google calendars</p>
            <div className="calendar-connection-list">
              {integrationsLoading && <p className="calendar-hint">Checking connections…</p>}
              {!integrationsLoading && integrations.length === 0 && (
                <p className="calendar-hint">Connect Google to push every interview to your personal calendars.</p>
              )}
              {integrations.map((integration) => {
                const isConnected = integration.status === 'connected';
                const isActive = resolvedVisibleAccountIds.includes(integration.clientKey);
                const isErrored = integration.status === 'error';
                const iconName = isConnected ? 'check-circle' : integration.status === 'pending' ? 'clock' : 'alert-circle';
                const emailLabel = integration.external_email || 'Google account';
                return (
                  <div
                    key={integration.clientKey}
                    className={`calendar-account-pill ${isConnected && isActive ? 'is-active' : ''} ${isErrored ? 'is-error' : ''}`}
                  >
                    <button
                      type="button"
                      className="calendar-account-pill__toggle"
                      onClick={() => toggleAccountVisibility(integration.clientKey)}
                      aria-pressed={isActive}
                      disabled={!isConnected}
                    >
                      <span className="calendar-account-pill__icon">
                        <Icon name={iconName} size="sm" ariaLabel="" />
                      </span>
                      <div className="calendar-account-pill__details">
                        <span className="calendar-account-pill__email">{emailLabel}</span>
                        <span className="calendar-account-pill__status">{integration.status_display || integration.status}</span>
                      </div>
                    </button>
                    <div className="calendar-account-pill__actions">
                      {isConnected ? (
                        <button
                          type="button"
                          className="calendar-link"
                          onClick={() => handleDisconnectGoogle(integration)}
                          disabled={disconnectingIntegrationId === integration.id}
                        >
                          {disconnectingIntegrationId === integration.id ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      ) : (
                        <span className="calendar-account-pill__hint">{integration.status_display || 'Not connected'}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="calendar-connections__footer">
              <button
                type="button"
                className="calendar-btn compact"
                onClick={handleConnectGoogle}
                disabled={connectBusy}
              >
                {connectBusy ? 'Redirecting…' : connectButtonLabel}
              </button>
              <span className="calendar-connection-summary">
                {externalEventsLoading ? 'Refreshing Google events…' : connectionSummary}
              </span>
            </div>
          </div>

        </div>
      </div>

      <div className="calendar-sticky-controls" aria-label="Calendar layout controls">
        <div className="calendar-control-row">
          <div className="calendar-control-card" aria-label="Calendar layout and refresh controls">
            <p className="calendar-control-card__label">Layout</p>
            <div className="calendar-control-card__buttons calendar-control-card__buttons--layout">
              <button
                type="button"
                className={`calendar-btn ghost ${collapsed ? 'active' : ''}`}
                onClick={handleToggleCollapsed}
                aria-expanded={!collapsed}
              >
                <Icon name={collapsed ? 'chevronDown' : 'chevronUp'} size="sm" />
                {collapsed ? 'Expand calendar' : 'Collapse calendar'}
              </button>
              <button
                type="button"
                className="calendar-btn compact"
                onClick={loadData}
                disabled={loading}
              >
                {loading ? 'Syncing…' : 'Refresh'}
              </button>
            </div>
            <div className="calendar-layout-sync" aria-live="polite">
              <span className={`calendar-sync-status ${loading ? 'is-loading' : ''}`}>
                {loading ? 'Syncing…' : 'Up to date'}
              </span>
            </div>
          </div>
          <div className="calendar-control-card" aria-label="Navigate calendar dates">
            <p className="calendar-control-card__label">Navigate</p>
            <div className="calendar-control-card__buttons calendar-control-card__buttons--nav">
              <button
                type="button"
                className="calendar-btn compact"
                onClick={() => calendarApi()?.today()}
                disabled={calendarControlsDisabled}
              >
                Today
              </button>
              <button
                type="button"
                className="calendar-btn icon"
                onClick={() => calendarApi()?.prev()}
                disabled={calendarControlsDisabled}
                aria-label="Previous"
              >
                <Icon name="chevronLeft" size="sm" />
              </button>
              <button
                type="button"
                className="calendar-btn icon"
                onClick={() => calendarApi()?.next()}
                disabled={calendarControlsDisabled}
                aria-label="Next"
              >
                <Icon name="chevronRight" size="sm" />
              </button>
            </div>
            <div
              className="calendar-range-inline"
              aria-live="polite"
              aria-label="Currently visible dates"
            >
              <span className="calendar-range-inline__label">Currently showing</span>
              <span className="calendar-range-inline__view">{activeViewLabel} view</span>
              <span className="calendar-range-inline__value">{currentRangeLabel || 'Loading…'}</span>
            </div>
          </div>

          <div
            className={`calendar-control-card ${collapsed ? 'is-disabled' : ''}`}
            aria-label="Switch calendar view"
            aria-disabled={collapsed}
          >
            <p className="calendar-control-card__label">View</p>
            <div className="calendar-control-card__buttons calendar-control-card__buttons--views">
              {VIEW_OPTIONS.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className={`calendar-btn ${activeView === view.id ? 'active' : ''}`}
                  onClick={() => changeView(view.id)}
                  disabled={collapsed}
                  tabIndex={collapsed ? -1 : 0}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {calendarStatusBanner === 'connected' && (
        <div className="calendar-alert success" role="status">
          Google Calendar connected. Interviews will sync automatically going forward.
        </div>
      )}
      {calendarStatusBanner === 'duplicate' && (
        <div className="calendar-alert info" role="status">
          That Google calendar was already connected, so we refreshed the link instead.
        </div>
      )}
      {calendarStatusBanner === 'disconnected' && (
        <div className="calendar-alert info" role="status">
          Google Calendar disconnected. You can reconnect any time.
        </div>
      )}
      {calendarStatusBanner === 'error' && (
        <div className="calendar-alert" role="alert">
          Google Calendar connection failed. Please try again.
        </div>
      )}
      {integrationError && (
        <div className="calendar-alert" role="alert">
          {integrationError}
        </div>
      )}
      {externalEventsError && (
        <div className="calendar-alert" role="alert">
          {externalEventsError}
        </div>
      )}
      {error && <div className="calendar-alert" role="alert">{error}</div>}

      {collapsed ? (
        <div className="calendar-collapsed" role="region" aria-live="polite">
          <div className="calendar-collapsed__stats">
            <div className="calendar-stat-chip" aria-label={`${summarySnapshot.deadlinesCount} open deadlines`}>
              Deadlines <span>{summarySnapshot.deadlinesCount}</span>
            </div>
            <div className="calendar-stat-chip" aria-label={`${summarySnapshot.interviewsCount} scheduled interviews`}>
              Interviews <span>{summarySnapshot.interviewsCount}</span>
            </div>
            <div className="calendar-stat-chip" aria-label={`${summarySnapshot.remindersCount} active reminders`}>
              Reminders <span>{summarySnapshot.remindersCount}</span>
            </div>
          </div>
          <p className="calendar-collapsed__next">
            <span className="label">Next up</span>
            <span className="value">{summarySnapshot.nextLabel}</span>
            {summarySnapshot.nextTime && <span className="time">{summarySnapshot.nextTime}</span>}
          </p>
        </div>
      ) : (
        <div className="calendar-panel__grid">
          <div className="calendar-panel__calendar">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView={activeView}
              height="auto"
              selectable
              selectMirror
              editable
              events={visibleEvents}
              headerToolbar={false}
              eventClick={handleEventClick}
              select={handleSelect}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              datesSet={handleDatesSet}
              nowIndicator
              weekends
              slotDuration="00:30:00"
              expandRows
            />
            <div className="calendar-legend">
              <span><span className="legend-dot deadline" /> Deadlines</span>
              <span><span className="legend-dot interview" /> Interviews</span>
              <span><span className="legend-dot reminder" /> Interview w/ reminder</span>
              <span><span className="legend-dot external" /> Google calendar</span>
              <span><span className="legend-dot note" /> Personal blocks</span>
            </div>
          </div>
        </div>
      )}

      {showEventModal && selectedEvent && (
        <div className="calendar-event-modal" role="dialog" aria-modal="true">
          <div className="calendar-event-modal__backdrop" onClick={closeEventModal} />
          <div className="calendar-event-modal__content" role="document">
            <button type="button" className="calendar-event-modal__close" onClick={closeEventModal} aria-label="Close details">
              <Icon name="x" size="sm" />
            </button>
            <div className="calendar-event-modal__body">
              {renderDetails()}
              {eventActionError && (
                <div className="calendar-alert" role="alert">
                  {eventActionError}
                </div>
              )}
            </div>
            <div className="calendar-event-modal__actions">
              <button type="button" className="calendar-btn" onClick={() => handleEditEvent(selectedEvent)} disabled={eventActionBusy}>
                Edit event
              </button>
              <button
                type="button"
                className="calendar-btn danger"
                onClick={() => handleDeleteEvent(selectedEvent)}
                disabled={eventActionBusy}
              >
                {eventActionBusy ? 'Working…' : 'Delete event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardCalendar;
