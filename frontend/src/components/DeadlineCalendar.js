import React, { useMemo, useState } from 'react';
import Icon from './Icon';

// Utility: format to YYYY-MM-DD
const fmt = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

export default function DeadlineCalendar({ items = [], onSelectDate }) {
  const [current, setCurrent] = useState(startOfMonth(new Date()));

  const { weeks, monthLabel } = useMemo(() => {
    const start = startOfMonth(current);
    const end = endOfMonth(current);
    const startWeekday = start.getDay(); // 0=Sun ... 6=Sat
    // We want a 6-row grid (6 weeks) of 7 days (42 cells)
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - startWeekday); // back to Sunday of first week shown
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    const weeks = [];
    for (let i = 0; i < 6; i++) {
      weeks.push(days.slice(i * 7, i * 7 + 7));
    }
    const label = current.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    return { weeks, monthLabel: label };
  }, [current]);

  const deadlinesByDate = useMemo(() => {
    const map = new Map();
    (items || []).forEach((j) => {
      if (!j.application_deadline) return;
      map.set(j.application_deadline, [...(map.get(j.application_deadline) || []), j]);
    });
    return map;
  }, [items]);

  const todayStr = fmt(new Date());
  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);

  const daysDiff = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };
  const urgencyBg = (diff) => {
    if (diff == null) return { background: '#e2e8f0', color: '#334155', borderColor: '#e2e8f0' }; // neutral slate
    if (diff < 0) return { background: '#dc2626', color: '#ffffff', borderColor: '#dc2626' }; // red
    if (diff <= 3) return { background: '#f59e0b', color: '#111827', borderColor: '#f59e0b' }; // amber/orange
    return { background: '#059669', color: '#ffffff', borderColor: '#059669' }; // green
  };

  return (
    <div className="education-form-card" style={{ overflow: 'hidden' }}>
      <div className="calendar-header">
        <button className="calendar-nav" onClick={() => setCurrent(addMonths(current, -1))} title="Previous month" aria-label="Previous month">
          <Icon name="chevronLeft" size="sm" ariaLabel="Previous" />
        </button>
        <h3 className="calendar-title">{monthLabel}</h3>
        <button className="calendar-nav" onClick={() => setCurrent(addMonths(current, 1))} title="Next month" aria-label="Next month">
          <Icon name="chevronRight" size="sm" ariaLabel="Next" />
        </button>
      </div>

      <div className="calendar-weekdays">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
          <div key={d} className="calendar-weekday">{d}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="calendar-row">
            {week.map((d, di) => {
              const key = fmt(d);
              const jobs = deadlinesByDate.get(key) || [];
              const isOtherMonth = d < monthStart || d > monthEnd;
              const isToday = key === todayStr;
              return (
                <button
                  key={di}
                  type="button"
                  className={`calendar-day${isOtherMonth ? ' is-outside' : ''}${isToday ? ' is-today' : ''}`}
                  onClick={() => {
                    if (onSelectDate) onSelectDate(key, jobs);
                  }}
                  title={jobs.length ? `${jobs.length} deadline${jobs.length > 1 ? 's' : ''} on ${key}` : key}
                >
                  <div className="calendar-day-number">{d.getDate()}</div>
                  <div className="calendar-day-events">
                    {jobs.slice(0, 3).map((j) => {
                      const diff = daysDiff(j.application_deadline);
                      const s = urgencyBg(diff);
                      return (
                        <div
                          key={j.id}
                          className="calendar-event-pill"
                          title={`${j.title} @ ${j.company_name}`}
                          style={{ background: s.background, color: s.color, borderColor: s.borderColor }}
                        >
                          {j.title}
                        </div>
                      );
                    })}
                    {jobs.length > 3 && (
                      <div className="calendar-more">+{jobs.length - 3} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
