import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Icon to avoid relying on implementation
jest.mock('./Icon', () => (props) => <span data-testid={`icon-${props.name}`}>{props.name}</span>);

// Mock useNavigate from react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

import DeadlineCalendar from './DeadlineCalendar';

describe('DeadlineCalendar', () => {
  const realDateNow = Date.now.bind(global.Date);

  beforeAll(() => {
    // Freeze time to a known date: 2025-11-15
    const fixed = new Date('2025-11-15T12:00:00Z').getTime();
    jest.useFakeTimers();
    jest.setSystemTime(fixed);
  });
  afterAll(() => {
    jest.useRealTimers();
    global.Date.now = realDateNow;
  });

  test('renders header, weekdays and grid and toggles collapse', () => {
    const { container } = render(<DeadlineCalendar />);

    // Month label should be November 2025 given frozen date
    expect(container.querySelector('.calendar-title').textContent).toMatch(/November\s+2025/);

    // Weekdays present
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach((d) => {
      expect(screen.getByText(d)).toBeInTheDocument();
    });

    // Grid is visible; collapse then hidden
    expect(container.querySelector('.calendar-grid')).toBeInTheDocument();
    const collapseBtn = container.querySelector('.calendar-collapse-btn');
    fireEvent.click(collapseBtn);
    expect(container.querySelector('.calendar-grid')).not.toBeInTheDocument();
    // Expand again
    fireEvent.click(collapseBtn);
    expect(container.querySelector('.calendar-grid')).toBeInTheDocument();
  });

  test('navigates months via prev/next buttons', () => {
    const { container } = render(<DeadlineCalendar />);
    const title = () => container.querySelector('.calendar-title').textContent;
    const prev = container.querySelector('button[aria-label="Previous month"]');
    const next = container.querySelector('button[aria-label="Next month"]');

    const initial = title();
    fireEvent.click(prev);
    expect(title()).not.toBe(initial);
    // go back forward
    fireEvent.click(next);
    expect(title()).toBe(initial);
  });

  test('renders jobs and interviews, shows +more and applies correct styles, and callbacks work', () => {
    // Prepare test data: make multiple jobs and interviews on 2025-11-17
    // Use explicit UTC timestamps to avoid timezone parsing shifts in test environment
    const jobs = [
      { id: 1, title: 'PastJob', company_name: 'CoA', application_deadline: '2025-11-10T12:00:00Z' }, // past -> red
      { id: 2, title: 'SoonJob', company_name: 'CoB', application_deadline: '2025-11-17T12:00:00Z' }, // soon -> amber
      { id: 3, title: 'AppliedJob', company_name: 'CoC', application_deadline: '2025-11-17T12:00:00Z', status: 'applied' }, // applied -> gray
      { id: 4, title: 'LaterJob', company_name: 'CoD', application_deadline: '2025-12-01T12:00:00Z' }, // outside month
    ];

    const interviews = [
      { id: 11, scheduled_at: '2025-11-17T14:00:00Z', interview_type: 'phone', job: 101, job_title: 'Eng I' },
      { id: 12, scheduled_at: '2025-11-17T16:00:00Z', interview_type: 'video', job: 102, job_title: 'Eng II' },
    ];

    const onSelect = jest.fn();
    const { container } = render(<DeadlineCalendar items={jobs} interviews={interviews} onSelectDate={onSelect} />);

    // Find the day cell for 17th
    const dayButtons = Array.from(container.querySelectorAll('.calendar-day'));
    const day17 = dayButtons.find((btn) => btn.querySelector('.calendar-day-number')?.textContent === '17');
    expect(day17).toBeDefined();

  // Ensure we selected the day cell that belongs to the current month (not an outside-month cell)
  const day17InMonth = day17.classList.contains('is-outside') ? dayButtons.find((btn) => btn.querySelector('.calendar-day-number')?.textContent === '17' && !btn.classList.contains('is-outside')) : day17;
  expect(day17InMonth).toBeDefined();

  // Within the 17th cell, SoonJob should have amber background
  const soonPill = day17InMonth.querySelector('[title^="SoonJob"]');
  expect(soonPill).toBeInTheDocument();
  expect(getComputedStyle(soonPill).backgroundColor).toBe('rgb(245, 158, 11)');

  // Applied job should have gray background
  const appliedPill = day17InMonth.querySelector('[title^="AppliedJob"]');
  expect(appliedPill).toBeInTheDocument();
  expect(getComputedStyle(appliedPill).backgroundColor).toBe('rgb(229, 231, 235)');

  // There should be interview pills present and clickable; find the one by job_title 'Eng I'
  const interviewPill = Array.from(day17InMonth.querySelectorAll('[title^="Interview:"]')).find((el) => el.title.includes('Eng I'));
  expect(interviewPill).toBeInTheDocument();

  // Click interview pill -> navigate called with job id 101 (first interview)
  fireEvent.click(interviewPill);
  expect(mockNavigate).toHaveBeenCalled();
  // navigate should have been called with path containing the correct job id and tab
  expect(mockNavigate.mock.calls[0][0]).toMatch(/jobs\/101\?tab=interviews/);

    // Click the day (not a specific pill) should call onSelectDate with key and all jobs for that date
    fireEvent.click(day17);
    expect(onSelect).toHaveBeenCalled();
    const [key, jobsForDate] = onSelect.mock.calls[0];
    expect(key).toBe('2025-11-17');
    // There were two jobs on that date (SoonJob and AppliedJob)
    expect(Array.isArray(jobsForDate)).toBe(true);
    expect(jobsForDate.length).toBe(2);

    // Check +more appears if total events > 4
    // For the day we rendered, totalEvents = jobs on that day (2) + interviews (2) = 4 -> no +more
    // Now create a scenario with 5 total
    const manyJobs = [
      { id: 21, title: 'J1', company_name: 'A', application_deadline: '2025-11-18T12:00:00Z' },
      { id: 22, title: 'J2', company_name: 'A', application_deadline: '2025-11-18T12:00:00Z' },
      { id: 23, title: 'J3', company_name: 'A', application_deadline: '2025-11-18T12:00:00Z' },
    ];
    const manyInterviews = [
      { id: 31, scheduled_at: '2025-11-18T10:00:00Z', interview_type: 'video', job: 201, job_title: 'T1' },
      { id: 32, scheduled_at: '2025-11-18T12:00:00Z', interview_type: 'phone', job: 202, job_title: 'T2' },
    ];

    const { container: c2 } = render(<DeadlineCalendar items={manyJobs} interviews={manyInterviews} />);
    const dayButtons2 = Array.from(c2.querySelectorAll('.calendar-day'));
    const day18 = dayButtons2.find((btn) => btn.querySelector('.calendar-day-number')?.textContent === '18');
    expect(day18.querySelector('.calendar-more')).toBeInTheDocument();
    expect(day18.querySelector('.calendar-more').textContent).toBe('+1 more');
  });
});
