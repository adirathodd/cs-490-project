import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JobStats from './JobStats';
import { AuthProvider } from '../../context/AuthContext';

// Mock the API module so we can control responses
jest.mock('../../services/api', () => ({
  jobsAPI: {
    getJobStats: jest.fn(),
  },
}));

import { jobsAPI } from '../../services/api';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('JobStats component', () => {
  test('is focusable, has ARIA label, and keyboard arrows change month (API called)', async () => {
    // Prepare two responses for two successive months
    const monthA = '2025-11';
    const monthB = '2025-10';

    const statsA = {
      daily_applications: [
        { date: '2025-11-01', count: 2 },
        { date: '2025-11-02', count: 1 },
        { date: '2025-11-03', count: 0 },
      ],
      daily_month: monthA,
      counts: { interested: 3, applied: 2 },
    };

    const statsB = {
      daily_applications: [
        { date: '2025-10-01', count: 1 },
      ],
      daily_month: monthB,
      counts: { interested: 1, applied: 0 },
    };

    jobsAPI.getJobStats.mockResolvedValueOnce(statsA).mockResolvedValueOnce(statsB);

    render(
      <AuthProvider value={{ loading: false }}>
        <JobStats />
      </AuthProvider>
    );

    // Wait for the initial API call to resolve and the chart to appear
    const chart = await screen.findByLabelText(/monthly applications chart/i);
    expect(chart).toBeInTheDocument();
    // Should be focusable
    expect(chart.tabIndex).toBe(0);

    // Initial API call should have been made once
    await waitFor(() => expect(jobsAPI.getJobStats).toHaveBeenCalledTimes(1));
    const firstArgs = jobsAPI.getJobStats.mock.calls[0][0] || {};
    expect(firstArgs.month).toBe(monthA);

    // Press ArrowLeft to go to previous month; this should trigger another API call
    chart.focus();
    await userEvent.keyboard('{ArrowLeft}');

    await waitFor(() => expect(jobsAPI.getJobStats).toHaveBeenCalledTimes(2));
    const secondArgs = jobsAPI.getJobStats.mock.calls[1][0] || {};
    expect(secondArgs.month).toBe(monthB);
  });
});
