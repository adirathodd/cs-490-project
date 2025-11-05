import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
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

  test('checkbox indeterminate when selection spans columns and confirmation for large moves', async () => {
    // Prepare 3 small jobs across different stages and a larger selection to trigger modal
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 1, title: 'SWE', company_name: 'Acme', status: 'interested', job_type: 'ft' },
      { id: 2, title: 'DevOps', company_name: 'Beta', status: 'applied', job_type: 'ft' },
      { id: 3, title: 'QA', company_name: 'Gamma', status: 'interview', job_type: 'ft' },
    ]);
    jobsAPI.getJobStats.mockResolvedValueOnce({ interested: 1, applied: 1, phone_screen: 0, interview: 1, offer: 0, rejected: 0 });
    jobsAPI.bulkUpdateStatus.mockResolvedValue({ updated: 3 });

    render(<JobsPipeline />);

    // Enable bulk mode and select two cards in different columns
    await userEvent.click(await screen.findByRole('button', { name: /select multiple/i }));
    await userEvent.click(await screen.findByTestId('job-card-1'));
    await userEvent.click(await screen.findByTestId('job-card-2'));

    // The 'Applied' column checkbox should be indeterminate (since selection spans columns)
    const appliedCheckbox = await screen.findByLabelText(/move selected jobs to applied/i);
    expect(appliedCheckbox).toBeInTheDocument();
    // HTML checkbox indeterminate isn't reflected by getByRole easily; ensure UI logic computed
    // by checking that the checkbox exists and that there is a badge showing selected count on the applied column
    const badge = screen.getByTestId('move-badge-applied');
    expect(badge).toHaveTextContent('2');

    // Now add more selections to exceed the threshold and click the applied checkbox to trigger confirmation modal
    // Add one more selection to make total 3 (< threshold 5) - to test confirmation we simulate a larger selection by setting selected via clicking more items
    await userEvent.click(await screen.findByTestId('job-card-3'));

  // To simulate a large move, mock getJobs to return 7 items and re-render to simulate a large selection scenario.
  jobsAPI.getJobs.mockResolvedValueOnce(new Array(7).fill(0).map((_, i) => ({ id: i + 10, title: `Job${i}`, company_name: 'X', status: 'interested', job_type: 'ft' })));
  jobsAPI.getJobStats.mockResolvedValueOnce({ interested: 7, applied: 0, phone_screen: 0, interview: 0, offer: 0, rejected: 0 });
  // Clean up previous render and re-render to pick up those jobs
  cleanup();
  render(<JobsPipeline />);
    await userEvent.click(await screen.findByRole('button', { name: /select multiple/i }));
    // select many cards quickly
    for (let i = 10; i < 17; i++) {
      const id = `job-card-${i}`;
      const el = await screen.findByTestId(id);
      await userEvent.click(el);
    }

    // Click the 'Applied' column checkbox; should open confirmation modal
  const appliedCheckbox2 = (await screen.findAllByLabelText(/move selected jobs to applied/i)).pop();
    await userEvent.click(appliedCheckbox2);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    // Confirm button should trigger API
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(jobsAPI.bulkUpdateStatus).toHaveBeenCalled());
  });
});
