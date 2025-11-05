import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Jobs from './Jobs';
import { jobsAPI } from '../services/api';

// Ensure mocks are cleared between tests
beforeEach(() => {
  jest.clearAllMocks();
});

describe('Jobs component (UC-036)', () => {
  test('renders header and empty state', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([]);

    render(<Jobs />);

    // Header renders
    expect(await screen.findByText(/job tracker/i)).toBeInTheDocument();

    // Empty state shown after load
    expect(await screen.findByText(/no job entries yet/i)).toBeInTheDocument();
  });

  test('lists existing jobs from API', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      {
        id: 1,
        title: 'Software Engineer',
        company_name: 'Acme Inc',
        location: 'Remote',
        job_type: 'ft',
      },
    ]);

    render(<Jobs />);

    // Entry shows up
    expect(await screen.findByText(/software engineer/i)).toBeInTheDocument();
    expect(screen.getByText(/@ acme inc/i)).toBeInTheDocument();
  });

  test('client-side validation errors when required fields missing', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([]);

    render(<Jobs />);

    const saveBtn = await screen.findByRole('button', { name: /save job/i });
    await userEvent.click(saveBtn);

    expect(await screen.findByText(/job title is required/i)).toBeInTheDocument();
    expect(screen.getByText(/company name is required/i)).toBeInTheDocument();
  });

  test('successfully adds a job and shows it in the list', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([]);

    const newJob = {
      id: 101,
      title: 'Frontend Developer',
      company_name: 'Globex',
      location: 'NYC',
      job_type: 'ft',
      salary_range: null,
    };
    jobsAPI.addJob.mockResolvedValueOnce(newJob);

    render(<Jobs />);

  // Fill the form minimally (required fields) using placeholders
  await userEvent.type(await screen.findByPlaceholderText(/e\.g\., Software Engineer/i), 'Frontend Developer');
  await userEvent.type(screen.getByPlaceholderText(/e\.g\., Acme Inc/i), 'Globex');

    await userEvent.click(screen.getByRole('button', { name: /save job/i }));

    // Success banner then list updated
    expect(await screen.findByText(/job saved\./i)).toBeInTheDocument();
    expect(await screen.findByText(/frontend developer/i)).toBeInTheDocument();
    expect(screen.getByText(/@ globex/i)).toBeInTheDocument();
  });

  test('deletes a job when confirmed', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 2, title: 'Backend Engineer', company_name: 'Initech', job_type: 'ft', location: 'Remote' },
    ]);
    jobsAPI.deleteJob.mockResolvedValueOnce({ success: true });

    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<Jobs />);

    // Wait for entry to appear
    expect(await screen.findByText(/backend engineer/i)).toBeInTheDocument();

    // Click its Delete button
    const delBtn = screen.getByRole('button', { name: /delete/i });
    await userEvent.click(delBtn);

    await waitFor(() => expect(jobsAPI.deleteJob).toHaveBeenCalledWith(2));

    // Success banner and item removed
    expect(await screen.findByText(/job deleted\./i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/backend engineer/i)).not.toBeInTheDocument());

    confirmSpy.mockRestore();
  });
});
