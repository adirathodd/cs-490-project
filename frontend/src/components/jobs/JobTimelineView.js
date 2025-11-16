import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { jobsAPI } from '../../services/api';
import Icon from '../common/Icon';
import './JobTimelineView.css';

const formatDateTime = (value) => {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const formatDuration = (start, end) => {
  if (!start || !end) return '';
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '';
  const diffMs = b.getTime() - a.getTime();
  if (diffMs <= 0) return '';
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (diffDays > 0) {
    return `${diffDays}d ${diffHours}h`;
  }
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  }
  return `${diffMinutes}m`;
};

const JobTimelineView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await jobsAPI.getJob(id);
        setJob(data);
      } catch (err) {
        setError(err?.message || 'Failed to load job timeline.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const timelineEvents = useMemo(() => {
    if (!job) return [];
    const events = Array.isArray(job.application_history) ? [...job.application_history] : [];
    if (job.created_at) {
      events.unshift({
        action: 'Job added to pipeline',
        timestamp: job.created_at,
        notes: job.title ? `Tracked: ${job.title}` : '',
      });
    }
    if (job.last_status_change && job.status) {
      events.push({
        action: `Status updated to ${job.status.replace(/_/g, ' ')}`,
        timestamp: job.last_status_change,
        notes: 'Most recent status change',
      });
    }
    return events
      .filter((event) => event && event.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [job]);

  const timelineWithDurations = useMemo(() => {
    return timelineEvents.map((event, idx) => {
      const previous = idx > 0 ? timelineEvents[idx - 1] : null;
      return {
        ...event,
        durationSincePrevious: previous ? formatDuration(previous.timestamp, event.timestamp) : '',
      };
    });
  }, [timelineEvents]);

  return (
    <div className="job-timeline-page">
      <div className="page-backbar">
        <button className="btn-back" onClick={() => navigate(`/jobs/${id}`)}>
          <Icon name="arrowLeft" size="sm" /> Back to job
        </button>
      </div>

      <header className="timeline-header">
        <div>
          <p className="eyebrow">Application momentum</p>
          <h1>{job?.title || 'Job timeline'}</h1>
          {job?.company_name && <p className="company-line">{job.company_name}</p>}
        </div>
        <div className="status-badge">
          <span>Current status</span>
          <strong>{job?.status?.replace(/_/g, ' ') || 'Unknown'}</strong>
        </div>
      </header>

      {loading && (
        <div className="timeline-card">
          <p>Loading timeline…</p>
        </div>
      )}

      {error && (
        <div className="timeline-card error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="timeline-card">
            <div className="timeline-card-header">
              <h2>
                <Icon name="clock" size="sm" /> Timeline
              </h2>
              <p>Every touchpoint recorded for this application.</p>
            </div>
            {timelineWithDurations.length === 0 ? (
              <p className="placeholder">No timeline events yet. Record a status update to begin tracking.</p>
            ) : (
              <div className="timeline-list">
                {timelineWithDurations.map((event, index) => (
                  <div className="timeline-item" key={`${event.timestamp}-${index}`}>
                    <div className="timeline-marker">
                      <span className="timeline-dot" />
                      {index < timelineWithDurations.length - 1 && <span className="timeline-line" />}
                    </div>
                    <div className="timeline-content">
                      <p className="timeline-action">{event.action}</p>
                      <p className="timeline-meta">
                        {formatDateTime(event.timestamp)}
                        {event.durationSincePrevious && (
                          <span className="timeline-duration">+{event.durationSincePrevious}</span>
                        )}
                      </p>
                      {event.notes && <p className="timeline-notes">{event.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="timeline-card">
            <div className="timeline-card-header">
              <h2>
                <Icon name="history" size="sm" /> Status history
              </h2>
              <p>Quick audit log of updates, newest first.</p>
            </div>
            {timelineEvents.length === 0 ? (
              <p className="placeholder">No history yet.</p>
            ) : (
              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Timestamp</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...timelineEvents]
                      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                      .map((event, idx) => (
                        <tr key={`history-${event.timestamp}-${idx}`}>
                          <td>{event.action}</td>
                          <td>{formatDateTime(event.timestamp)}</td>
                          <td>{event.notes || '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default JobTimelineView;
