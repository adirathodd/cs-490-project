import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Override the services API mock for these tests
jest.mock('../../../services/api', () => ({
  __esModule: true,
  jobsAPI: {
    getUpcomingDeadlines: jest.fn(),
  },
  interviewsAPI: {
    getInterviews: jest.fn(),
    getActiveReminders: jest.fn(),
    dismissReminder: jest.fn(),
  },
}));

import JobsCalendar from '../JobsCalendar';
import { jobsAPI, interviewsAPI } from '../../../services/api';

describe('JobsCalendar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders deadlines and interviews grouped by date and shows active reminders', async () => {
    // Prepare mocked API responses
    jobsAPI.getUpcomingDeadlines.mockResolvedValueOnce([
      { id: 1, title: 'Frontend Engineer', company_name: 'Acme Corp', application_deadline: '2025-11-20', status: 'interested' },
    ]);

    interviewsAPI.getInterviews.mockResolvedValueOnce([
      { id: 2, job_title: 'Backend Engineer', job_company: 'Beta LLC', scheduled_at: '2025-11-21T14:30:00Z', interview_type: 'video', interview_type_display: 'Video', duration_minutes: 45 },
    ]);

    interviewsAPI.getActiveReminders.mockResolvedValueOnce([
      { id: 2, reminder_type: '24h', interview_type: 'video', job_title: 'Backend Engineer', job_company: 'Beta LLC', scheduled_at: '2025-11-21T14:30:00Z' },
    ]);

    render(<JobsCalendar />);

  // Should show loading briefly
  expect(screen.getByText(/Loading/i)).toBeInTheDocument();

  // Wait for job title to appear which indicates rendering finished
  await waitFor(() => expect(screen.getByText(/Frontend Engineer/)).toBeInTheDocument());

  // Check deadline date header and job info
  expect(screen.getByText('2025-11-20')).toBeInTheDocument();
  expect(screen.getByText(/Frontend Engineer/)).toBeInTheDocument();
  expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();

  // Check interview date header and interview job info
  expect(screen.getByText('2025-11-21')).toBeInTheDocument();
  // The interview title appears in multiple places (reminder card and list). Ensure at least one match exists.
  expect(screen.getAllByText(/Backend Engineer/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Beta LLC/).length).toBeGreaterThan(0);

  // Active reminder card should be visible with 'Tomorrow' text for '24h'
  expect(screen.getByText(/Upcoming Interviews/)).toBeInTheDocument();
  expect(screen.getByText(/Tomorrow/)).toBeInTheDocument();
  });

  test('dismisses a reminder when dismiss button is clicked', async () => {
    jobsAPI.getUpcomingDeadlines.mockResolvedValueOnce([]);
    interviewsAPI.getInterviews.mockResolvedValueOnce([]);
    interviewsAPI.getActiveReminders.mockResolvedValueOnce([
      { id: 3, reminder_type: '1h', interview_type: 'phone', job_title: 'SRE', job_company: 'Ops Inc', scheduled_at: '2025-11-22T09:00:00Z' },
    ]);

    interviewsAPI.dismissReminder.mockResolvedValueOnce({});

    render(<JobsCalendar />);

  // Wait for reminder to appear
  await waitFor(() => expect(screen.getByText(/SRE/)).toBeInTheDocument());

    // Click the dismiss button (there is only one button with title "Dismiss")
    const btn = screen.getByTitle('Dismiss');
    fireEvent.click(btn);

    // dismissReminder should have been called with the interview id and reminder type
    await waitFor(() => expect(interviewsAPI.dismissReminder).toHaveBeenCalledWith(3, '1h'));

    // After dismissing, the reminder should be removed from the UI
    await waitFor(() => expect(screen.queryByText(/SRE/)).not.toBeInTheDocument());
  });

  test('shows empty state when there are no items or reminders', async () => {
    jobsAPI.getUpcomingDeadlines.mockResolvedValueOnce([]);
    interviewsAPI.getInterviews.mockResolvedValueOnce([]);
    interviewsAPI.getActiveReminders.mockResolvedValueOnce([]);

    render(<JobsCalendar />);

  // Wait for the empty state text to appear
  await waitFor(() => expect(screen.getByText(/No upcoming deadlines or interviews/i)).toBeInTheDocument());
  });

  test('displays error message when APIs throw', async () => {
    jobsAPI.getUpcomingDeadlines.mockRejectedValueOnce(new Error('Network error'));
    interviewsAPI.getInterviews.mockRejectedValueOnce(new Error('Network error'));
    interviewsAPI.getActiveReminders.mockRejectedValueOnce(new Error('Network error'));

    render(<JobsCalendar />);

    // Wait for the error to be set
    await waitFor(() => expect(screen.getByText(/Failed to load calendar items/i)).toBeInTheDocument());
  });
});
