import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JobsPipeline from './JobsPipeline';
import { jobsAPI } from '../services/api';

// Mock the API module so its methods are jest fns we can control
jest.mock('../services/api', () => ({
  jobsAPI: {
    getJobs: jest.fn(),
    getJobStats: jest.fn(),
    bulkUpdateStatus: jest.fn(),
    updateJob: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('JobsPipeline (UC-037)', () => {
  test('renders columns and counts', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 1, title: 'SWE', company_name: 'Acme', status: 'interested', job_type: 'ft' },
      { id: 2, title: 'FE Dev', company_name: 'Globex', status: 'applied', job_type: 'ft' },
    ]);
    jobsAPI.getJobStats.mockResolvedValueOnce({ interested: 1, applied: 1, phone_screen: 0, interview: 0, offer: 0, rejected: 0 });

    render(<JobsPipeline />);

    expect(await screen.findByText(/job pipeline/i)).toBeInTheDocument();
  // Assert headings for columns exist (avoid matching <option> text)
  expect(screen.getByRole('heading', { name: /interested/i, level: 3 })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /applied/i, level: 3 })).toBeInTheDocument();
  await waitFor(() => expect(screen.getAllByTitle('count')[0]).toHaveTextContent('1'));
  });

  test('bulk move selected', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 1, title: 'SWE', company_name: 'Acme', status: 'interested', job_type: 'ft' },
    ]);
    jobsAPI.getJobStats.mockResolvedValueOnce({ interested: 1, applied: 0, phone_screen: 0, interview: 0, offer: 0, rejected: 0 });
    jobsAPI.bulkUpdateStatus.mockResolvedValueOnce({ updated: 1 });

    render(<JobsPipeline />);

    // Enable bulk mode and select card
    await userEvent.click(await screen.findByRole('button', { name: /select multiple/i }));
    await userEvent.click(screen.getByTestId('job-card-1'));

    // Use the column checkbox for the target 'Applied' column
    const checkbox = await screen.findByLabelText(/move selected jobs to applied/i);
    await userEvent.click(checkbox);

    await waitFor(() => expect(jobsAPI.bulkUpdateStatus).toHaveBeenCalledWith([1], 'applied'));
  });
});
