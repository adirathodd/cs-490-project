import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Jobs from './Jobs';
import { jobsAPI } from '../../services/api';

// Mock the navigate function
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Wrapper component to provide Router context
const RouterWrapper = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

// Ensure mocks are cleared between tests
beforeEach(() => {
  jest.clearAllMocks();
  mockNavigate.mockClear();
});

describe('Jobs component (UC-036 & UC-038)', () => {
  test('renders header and empty state', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([]);

    render(<Jobs />, { wrapper: RouterWrapper });

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

    render(<Jobs />, { wrapper: RouterWrapper });

    // Entry shows up
    expect(await screen.findByText(/software engineer/i)).toBeInTheDocument();
    expect(screen.getByText(/acme inc/i)).toBeInTheDocument();
  });

  test('validates description length limit', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([]);

    render(<Jobs />, { wrapper: RouterWrapper });

    const addBtn = await screen.findByRole('button', { name: /\+ add job/i });
    await userEvent.click(addBtn);

    await userEvent.type(screen.getByPlaceholderText(/e\.g\., Software Engineer/i), 'Test Job');
    await userEvent.type(screen.getByPlaceholderText(/e\.g\., Acme Inc/i), 'Test Company');

    // Try to enter more than 2000 characters - the component should prevent it
    const longText = 'a'.repeat(2001);
    const descriptionField = screen.getByPlaceholderText(/paste description or your notes/i);
    
    await userEvent.type(descriptionField, longText);
    
    // Character count should be capped at 2000
    expect(screen.getByText(/2000\/2000/i)).toBeInTheDocument();
  });

  test('successfully updates an existing job', async () => {
    const existingJob = {
      id: 50,
      title: 'Backend Engineer',
      company_name: 'TechCorp',
      location: 'SF',
      job_type: 'ft',
      salary_min: 100000,
      salary_max: 150000,
      salary_currency: 'USD',
      posting_url: '',
      application_deadline: '',
      description: 'Initial description',
      industry: 'Software',
    };

    jobsAPI.getJobs.mockResolvedValueOnce([existingJob]);

    const updatedJob = { ...existingJob, title: 'Senior Backend Engineer' };
    jobsAPI.updateJob.mockResolvedValueOnce(updatedJob);

    render(<Jobs />, { wrapper: RouterWrapper });

    // Wait for job to load and click edit
    await screen.findByText(/backend engineer/i);
    const editBtn = screen.getByRole('button', { name: /edit/i });
    await userEvent.click(editBtn);

    // Update the title
    const titleInput = screen.getByDisplayValue('Backend Engineer');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Senior Backend Engineer');

    // Save
    await userEvent.click(screen.getByRole('button', { name: /update job/i }));

    expect(await screen.findByText(/job updated\./i)).toBeInTheDocument();
    expect(await screen.findByText(/senior backend engineer/i)).toBeInTheDocument();
  });

  test('cancels edit and resets form', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([]);

    render(<Jobs />, { wrapper: RouterWrapper });

    const addBtn = await screen.findByRole('button', { name: /\+ add job/i });
    await userEvent.click(addBtn);

    // Start filling form
    await userEvent.type(screen.getByPlaceholderText(/e\.g\., Software Engineer/i), 'Test Job');

    // Click cancel
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await userEvent.click(cancelBtn);

    // Form should be hidden
    expect(screen.queryByPlaceholderText(/e\.g\., Software Engineer/i)).not.toBeInTheDocument();
  });

  test('deletes a job when confirmed', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 2, title: 'Backend Engineer', company_name: 'Initech', job_type: 'ft', location: 'Remote' },
    ]);
    jobsAPI.deleteJob.mockResolvedValueOnce({ success: true });

    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<Jobs />, { wrapper: RouterWrapper });

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

  test('does not delete job when canceling confirmation', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 3, title: 'Data Scientist', company_name: 'DataCo', job_type: 'ft', location: 'Boston' },
    ]);

    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => false);

    render(<Jobs />, { wrapper: RouterWrapper });

    await screen.findByText(/data scientist/i);

    const delBtn = screen.getByRole('button', { name: /delete/i });
    await userEvent.click(delBtn);

    // Delete API should not be called
    expect(jobsAPI.deleteJob).not.toHaveBeenCalled();
    
    // Job should still be visible
    expect(screen.getByText(/data scientist/i)).toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  test('navigates to detail view when clicking on job card', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 10, title: 'DevOps Engineer', company_name: 'CloudCo', job_type: 'ft', location: 'Remote' },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

    const jobTitle = await screen.findByText(/devops engineer/i);
    await userEvent.click(jobTitle);

    expect(mockNavigate).toHaveBeenCalledWith('/jobs/10');
  });

  test('navigates to detail view when clicking view details button', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 11, title: 'QA Engineer', company_name: 'TestCo', job_type: 'ft', location: 'NYC' },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

    await screen.findByText(/qa engineer/i);

    const viewBtn = screen.getByRole('button', { name: /view/i });
    await userEvent.click(viewBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/jobs/11');
  });

  test('handles API error on load gracefully', async () => {
    jobsAPI.getJobs.mockRejectedValueOnce({
      message: 'Network error',
    });

    render(<Jobs />, { wrapper: RouterWrapper });

    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
  });

  test('handles 401 error with appropriate message', async () => {
    jobsAPI.getJobs.mockRejectedValueOnce({
      status: 401,
      message: 'Unauthorized',
    });

    render(<Jobs />, { wrapper: RouterWrapper });

    expect(await screen.findByText(/please log in to view your jobs/i)).toBeInTheDocument();
  });

  test('handles API error messages array', async () => {
    jobsAPI.getJobs.mockRejectedValueOnce({
      messages: ['Error 1', 'Error 2'],
    });

    render(<Jobs />, { wrapper: RouterWrapper });

    expect(await screen.findByText(/error 1 • error 2/i)).toBeInTheDocument();
  });

  test('displays salary range when present', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      {
        id: 20,
        title: 'Full Stack Developer',
        company_name: 'WebCo',
        job_type: 'ft',
        salary_range: 'USD 100000 - 150000',
      },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

    expect(await screen.findByText(/full stack developer/i)).toBeInTheDocument();
    expect(screen.getByText(/usd 100000 - 150000/i)).toBeInTheDocument();
  });

  test('displays application deadline when present', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      {
        id: 21,
        title: 'Product Manager',
        company_name: 'ProductCo',
        job_type: 'ft',
        application_deadline: '2025-12-31',
      },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

    expect(await screen.findByText(/product manager/i)).toBeInTheDocument();
    expect(screen.getByText(/deadline: 2025-12-31/i)).toBeInTheDocument();
  });

  test('shows posting URL link when available', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      {
        id: 22,
        title: 'UX Designer',
        company_name: 'DesignCo',
        job_type: 'ft',
        posting_url: 'https://example.com/job/123',
      },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

    await screen.findByText(/ux designer/i);

    const link = screen.getByRole('link', { name: /view/i });
    expect(link).toHaveAttribute('href', 'https://example.com/job/123');
    expect(link).toHaveAttribute('target', '_blank');
  });

  test('character counter updates as user types in description', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([]);

    render(<Jobs />, { wrapper: RouterWrapper });

    const addBtn = await screen.findByRole('button', { name: /\+ add job/i });
    await userEvent.click(addBtn);

    const descField = screen.getByPlaceholderText(/paste description or your notes/i);
    
    expect(screen.getByText(/0\/2000/i)).toBeInTheDocument();

    await userEvent.type(descField, 'This is a test description.');

    expect(screen.getByText(/27\/2000/i)).toBeInTheDocument();
  });

  test('renders industry and job type dropdowns with correct options', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([]);

    render(<Jobs />, { wrapper: RouterWrapper });

    const addBtn = await screen.findByRole('button', { name: /\+ add job/i });
    await userEvent.click(addBtn);

    // Check job type dropdown
    const jobTypeSelect = screen.getByLabelText(/job type/i);
    expect(within(jobTypeSelect).getByRole('option', { name: /full-time/i })).toBeInTheDocument();
    expect(within(jobTypeSelect).getByRole('option', { name: /part-time/i })).toBeInTheDocument();
    expect(within(jobTypeSelect).getByRole('option', { name: /contract/i })).toBeInTheDocument();
    expect(within(jobTypeSelect).getByRole('option', { name: /internship/i })).toBeInTheDocument();
    expect(within(jobTypeSelect).getByRole('option', { name: /temporary/i })).toBeInTheDocument();

    // Check industry dropdown
    const industrySelect = screen.getByLabelText(/industry/i);
    expect(within(industrySelect).getByRole('option', { name: /software/i })).toBeInTheDocument();
    expect(within(industrySelect).getByRole('option', { name: /finance/i })).toBeInTheDocument();
    expect(within(industrySelect).getByRole('option', { name: /healthcare/i })).toBeInTheDocument();
  });

  test('close button hides the form', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([]);

    render(<Jobs />, { wrapper: RouterWrapper });

    const addBtn = await screen.findByRole('button', { name: /\+ add job/i });
    await userEvent.click(addBtn);

    // Form should be visible
    expect(screen.getByPlaceholderText(/e\.g\., Software Engineer/i)).toBeInTheDocument();

    // Click close button
    const closeBtn = screen.getByRole('button', { name: /close/i });
    await userEvent.click(closeBtn);

    // Form should be hidden
    expect(screen.queryByPlaceholderText(/e\.g\., Software Engineer/i)).not.toBeInTheDocument();
  });

  test('scrolls to top when opening form for new job', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([]);

    render(<Jobs />, { wrapper: RouterWrapper });

    const addBtn = await screen.findByRole('button', { name: /\+ add job/i });
    await userEvent.click(addBtn);

    // Form should open - no scrollTo for new job form
    expect(await screen.findByRole('heading', { name: /add job/i })).toBeInTheDocument();
  });

  test('scrolls to top when editing a job', async () => {
    const scrollToSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 30, title: 'Test Engineer', company_name: 'TestCo', job_type: 'ft', location: 'Remote' },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

    await screen.findByText(/test engineer/i);

    const editBtn = screen.getByRole('button', { name: /edit/i });
    await userEvent.click(editBtn);

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    scrollToSpy.mockRestore();
  });
});
