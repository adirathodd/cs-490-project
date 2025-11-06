import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JobStats from './JobStats';
import { AuthProvider } from '../context/AuthContext';

jest.mock('../services/api', () => ({
  jobsAPI: {
    getJobStats: jest.fn(),
  },
}));

import { jobsAPI } from '../services/api';

beforeEach(() => jest.clearAllMocks());

test('ArrowRight navigates to next month and CSV export uses month param', async () => {
  const thisMonth = '2025-11';
  const nextMonth = '2025-12';

  const statsThis = { daily_applications: [{ date: '2025-11-01', count: 1 }], daily_month: thisMonth };
  const statsNext = { daily_applications: [{ date: '2025-12-01', count: 2 }], daily_month: nextMonth };

  jobsAPI.getJobStats.mockResolvedValueOnce(statsThis).mockResolvedValueOnce(statsNext);

  // mock fetch for CSV download to capture URL
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['ok']) });

  render(
    <AuthProvider value={{ loading: false }}>
      <JobStats />
    </AuthProvider>
  );

  const chart = await screen.findByLabelText(/monthly applications chart/i);
  chart.focus();
  // ArrowRight should request next month
  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(jobsAPI.getJobStats).toHaveBeenCalledTimes(2));
  const secondCall = jobsAPI.getJobStats.mock.calls[1][0] || {};
  expect(secondCall.month).toBe(nextMonth);

  // Click Export CSV and ensure fetch called with month param
  const exportBtn = await screen.findByRole('button', { name: /export csv/i });
  await userEvent.click(exportBtn);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const calledUrl = global.fetch.mock.calls[0][0];
  expect(calledUrl).toMatch(/export=csv/);
  expect(calledUrl).toMatch(/month=2025-12/);

  global.fetch = originalFetch;
});
