import React from 'react';
import { render, screen } from '@testing-library/react';
import DeadlinesWidget from './DeadlinesWidget';
import { jobsAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  jobsAPI: {
    getUpcomingDeadlines: jest.fn(),
  },
}));

function makeDate(offsetDays) {
  const d = new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0,10);
}

describe('DeadlinesWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows at most 5 non-overdue deadlines and excludes past ones', async () => {
    const data = [
      { id: 1, title: 'Job1', company_name: 'A', application_deadline: makeDate(1) },
      { id: 2, title: 'Job2', company_name: 'B', application_deadline: makeDate(2) },
      { id: 3, title: 'Job3', company_name: 'C', application_deadline: makeDate(3) },
      { id: 4, title: 'Job4', company_name: 'D', application_deadline: makeDate(4) },
      { id: 5, title: 'Job5', company_name: 'E', application_deadline: makeDate(5) },
      { id: 6, title: 'Job6', company_name: 'F', application_deadline: makeDate(6) },
      { id: 7, title: 'PastJob', company_name: 'G', application_deadline: makeDate(-1) },
    ];
    jobsAPI.getUpcomingDeadlines.mockResolvedValueOnce(data);
    render(<DeadlinesWidget />);
    // wait for one of the items
    const item = await screen.findByText(/Job1/i);
    expect(item).toBeInTheDocument();
    // Should NOT render PastJob
    expect(screen.queryByText(/PastJob/)).toBeNull();
    // Should only show first 5 future jobs, not Job6 (6th future)
    expect(screen.queryByText(/Job6/)).toBeNull();
    // Badge should show 5
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  test('renders empty state when no upcoming', async () => {
    jobsAPI.getUpcomingDeadlines.mockResolvedValueOnce([]);
    render(<DeadlinesWidget />);
    const empty = await screen.findByText(/No upcoming deadlines/i);
    expect(empty).toBeInTheDocument();
  });
});
