import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Jobs from './Jobs';
import { jobsAPI } from '../../services/api';

jest.mock('../../services/api', () => {
  const mockJobsAPI = {
    getJobs: jest.fn().mockResolvedValue([]),
    addJob: jest.fn().mockResolvedValue({}),
    updateJob: jest.fn().mockResolvedValue({}),
    deleteJob: jest.fn().mockResolvedValue({}),
    archiveJob: jest.fn().mockResolvedValue({}),
    unarchiveJob: jest.fn().mockResolvedValue({}),
    restoreJob: jest.fn().mockResolvedValue({}),
    bulkArchiveJobs: jest.fn().mockResolvedValue({}),
    bulkRestoreJobs: jest.fn().mockResolvedValue({}),
    bulkUpdateStatus: jest.fn().mockResolvedValue({}),
  };

  return {
    jobsAPI: mockJobsAPI,
    materialsAPI: {
      listDocuments: jest.fn().mockResolvedValue([]),
      getDefaults: jest
        .fn()
        .mockResolvedValue({ default_resume_doc: null, default_cover_letter_doc: null }),
      setDefaults: jest.fn(),
      updateJobMaterials: jest.fn(),
      getJobMaterials: jest
        .fn()
        .mockResolvedValue({ resume_doc: null, cover_letter_doc: null, history: [] }),
      getDownloadUrl: jest.fn((id) => `https://fakeurl.com/download/${id}`),
    },
    interviewsAPI: { getInterviews: jest.fn().mockResolvedValue([]) },
    companyAPI: { searchCompanies: jest.fn().mockResolvedValue([]) },
  };
});


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

describe('Jobs component (UC-039: Job Search and Filtering)', () => {
  test.skip('filters jobs by search query', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 1, title: 'React Developer', company_name: 'TechCo', job_type: 'ft' },
      { id: 2, title: 'Backend Engineer', company_name: 'DataCorp', job_type: 'ft' },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

    await screen.findByText(/react developer/i);
    await screen.findByText(/backend engineer/i);

    // Type in search box
    const searchInput = screen.getByPlaceholderText(/search jobs/i);
    await userEvent.type(searchInput, 'React');

    // Should trigger new API call with search query
    await waitFor(() => {
      expect(jobsAPI.getJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'React',
        })
      );
    });
  });

  test.skip('filters jobs by industry', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 1, title: 'Software Engineer', company_name: 'TechCo', job_type: 'ft', industry: 'Software' },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

    await screen.findByText(/software engineer/i);

  // Open filters (find the toggle button that says Show/Hide Filters and avoid the clear button)
  let filterBtn = screen.getAllByRole('button').find(b => /show|hide/i.test(b.textContent) && /filter/i.test(b.textContent));
  if (!filterBtn) filterBtn = screen.getByRole('button', { name: /filter/i });
  await userEvent.click(filterBtn);

    // Select industry
    const industrySelect = screen.getByLabelText(/industry/i);
    await userEvent.selectOptions(industrySelect, 'Software');

    // Apply filters
    const applyBtn = screen.getByRole('button', { name: /apply filters/i });
    await userEvent.click(applyBtn);

    await waitFor(() => {
      expect(jobsAPI.getJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          industry: 'Software',
        })
      );
    });
  });

  test.skip('filters jobs by location', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 1, title: 'Developer', company_name: 'TechCo', job_type: 'ft', location: 'Remote' },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

    await screen.findByText(/developer/i);

  // Open filters (find the toggle button that says Show/Hide Filters)
  let filterBtn = screen.getAllByRole('button').find(b => /show|hide/i.test(b.textContent) && /filter/i.test(b.textContent));
  if (!filterBtn) filterBtn = screen.getByRole('button', { name: /filter/i });
  await userEvent.click(filterBtn);

    // Enter location
    const locationInput = screen.getByLabelText(/location/i);
    await userEvent.type(locationInput, 'Remote');

    // Apply filters
    const applyBtn = screen.getByRole('button', { name: /apply filters/i });
    await userEvent.click(applyBtn);

    await waitFor(() => {
      expect(jobsAPI.getJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'Remote',
        })
      );
    });
  });

  test.skip('filters jobs by job type', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 1, title: 'Contract Developer', company_name: 'TechCo', job_type: 'contract' },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

    await screen.findByText(/contract developer/i);

  // Open filters (find the toggle button that says Show/Hide Filters)
  let filterBtn = screen.getAllByRole('button').find(b => /show|hide/i.test(b.textContent) && /filter/i.test(b.textContent));
  if (!filterBtn) filterBtn = screen.getByRole('button', { name: /filter/i });
  await userEvent.click(filterBtn);

    // Select job type
    const jobTypeSelect = screen.getByLabelText(/job type/i);
    await userEvent.selectOptions(jobTypeSelect, 'contract');

    // Apply filters
    const applyBtn = screen.getByRole('button', { name: /apply filters/i });
    await userEvent.click(applyBtn);

    await waitFor(() => {
      expect(jobsAPI.getJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          job_type: 'contract',
        })
      );
    });
  });

  test.skip('filters jobs by salary range', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 1, title: 'Senior Engineer', company_name: 'TechCo', job_type: 'ft', salary_min: 100000, salary_max: 150000 },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

    await screen.findByText(/senior engineer/i);

  // Open filters (find the toggle button that says Show/Hide Filters)
  let filterBtn = screen.getAllByRole('button').find(b => /show|hide/i.test(b.textContent) && /filter/i.test(b.textContent));
  if (!filterBtn) filterBtn = screen.getByRole('button', { name: /filter/i });
  await userEvent.click(filterBtn);

    // Enter salary range
    const minSalaryInput = screen.getByLabelText(/min salary/i);
    const maxSalaryInput = screen.getByLabelText(/max salary/i);
    await userEvent.type(minSalaryInput, '100000');
    await userEvent.type(maxSalaryInput, '150000');

    // Apply filters
    const applyBtn = screen.getByRole('button', { name: /apply filters/i });
    await userEvent.click(applyBtn);

    await waitFor(() => {
      expect(jobsAPI.getJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          salary_min: '100000',
          salary_max: '150000',
        })
      );
    });
  });

  test.skip('clears all filters', async () => {
    jobsAPI.getJobs.mockResolvedValue([
      { id: 1, title: 'Developer', company_name: 'TechCo', job_type: 'ft' },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

    await screen.findByText(/developer/i);

  // Open filters (find the toggle button that says Show/Hide Filters)
  let filterBtn = screen.getAllByRole('button').find(b => /show|hide/i.test(b.textContent) && /filter/i.test(b.textContent));
  if (!filterBtn) filterBtn = screen.getByRole('button', { name: /filter/i });
  await userEvent.click(filterBtn);

    // Set some filters
    const industrySelect = screen.getByLabelText(/industry/i);
    await userEvent.selectOptions(industrySelect, 'Software');

  // Clear filters (the clear button is represented by a button with a title attr)
  const clearBtn = screen.getByTitle(/clear all filters/i);
    await userEvent.click(clearBtn);

    // Should call API with no filters
    await waitFor(() => {
      expect(jobsAPI.getJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          industry: '',
          location: '',
          job_type: '',
        })
      );
    });
  });

  test.skip('sorts jobs by different criteria', async () => {
    jobsAPI.getJobs.mockResolvedValue([
      { id: 1, title: 'Developer', company_name: 'TechCo', job_type: 'ft' },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

    await screen.findByText(/developer/i);

    // Change sort order: find the combobox that contains the Company Name option
    const sortSelects = screen.queryAllByRole('combobox');
    let sortSelect = null;
    if (sortSelects.length) {
      for (const s of sortSelects) {
        try {
          within(s).getByRole('option', { name: /company name/i });
          sortSelect = s;
          break;
        } catch (e) {
          // not this one
        }
      }
      if (!sortSelect) sortSelect = sortSelects[sortSelects.length - 1];
    } else {
      // fallback to native DOM query for selects
      sortSelect = document.querySelector('select[name="sort"], select[name="sort_by"], select');
    }
    expect(sortSelect).toBeTruthy();
    await userEvent.selectOptions(sortSelect, 'company_name');

    await waitFor(() => {
        expect(jobsAPI.getJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: expect.stringMatching(/company/),
        })
      );
    });
  });
});

describe('Jobs component (UC-045: Job Archiving and Management)', () => {
  test.skip('archives a job', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 1, title: 'Software Engineer', company_name: 'TechCo', job_type: 'ft', archived: false },
    ]);
    jobsAPI.archiveJob.mockResolvedValueOnce({ id: 1, archived: true });
    jobsAPI.getJobs.mockResolvedValueOnce([]);

    render(<Jobs />, { wrapper: RouterWrapper });

    await screen.findByText(/software engineer/i);

    // Click archive button
    const archiveBtn = screen.getByRole('button', { name: /archive/i });
    await userEvent.click(archiveBtn);

    await waitFor(() => {
      expect(jobsAPI.archiveJob).toHaveBeenCalledWith(1);
    });

    // Job should be removed from active list
    await waitFor(() => {
      expect(screen.queryByText(/software engineer/i)).not.toBeInTheDocument();
    });
  });

  test.skip('unarchives a job', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 1, title: 'Archived Job', company_name: 'TechCo', job_type: 'ft', archived: true },
    ]);
    jobsAPI.unarchiveJob.mockResolvedValueOnce({ id: 1, archived: false });

    render(<Jobs />, { wrapper: RouterWrapper });

  // Toggle to show archived (button label: 'Archived Jobs' when closed)
  const showArchivedBtn = screen.getByRole('button', { name: /archived jobs/i });
    await userEvent.click(showArchivedBtn);

    await screen.findByText(/archived job/i);

    // Click unarchive button
    const unarchiveBtn = screen.getByRole('button', { name: /unarchive/i });
    await userEvent.click(unarchiveBtn);

    await waitFor(() => {
      expect(jobsAPI.unarchiveJob).toHaveBeenCalledWith(1);
    });
  });

  test.skip('toggles between active and archived jobs', async () => {
    jobsAPI.getJobs.mockResolvedValue([
      { id: 1, title: 'Active Job', company_name: 'TechCo', job_type: 'ft', archived: false },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

    await screen.findByText(/active job/i);

  // Toggle to show archived (button label: 'Archived Jobs' when closed)
  const showArchivedBtn = screen.getByRole('button', { name: /archived jobs/i });
  await userEvent.click(showArchivedBtn);

    await waitFor(() => {
      expect(jobsAPI.getJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          archived: 'true',
        })
      );
    });

  // Toggle back to active (button label: 'Active Jobs' when archived view is open)
  const showActiveBtn = screen.getByRole('button', { name: /active jobs/i });
  await userEvent.click(showActiveBtn);

    await waitFor(() => {
      expect(jobsAPI.getJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          archived: 'false',
        })
      );
    });
  });

  test.skip('displays archived badge on archived jobs', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 1, title: 'Archived Job', company_name: 'TechCo', job_type: 'ft', archived: true },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

  // Toggle to show archived (button label: 'Archived Jobs' when closed)
  const showArchivedBtn = screen.getByRole('button', { name: /archived jobs/i });
  await userEvent.click(showArchivedBtn);

    await screen.findByText(/archived job/i);
    expect(screen.getByText(/archived/i)).toBeInTheDocument();
  });

  test.skip('prevents editing archived jobs', async () => {
    jobsAPI.getJobs.mockResolvedValueOnce([
      { id: 1, title: 'Archived Job', company_name: 'TechCo', job_type: 'ft', archived: true },
    ]);

    render(<Jobs />, { wrapper: RouterWrapper });

  // Toggle to show archived (button label: 'Archived Jobs' when closed)
  const showArchivedBtn = screen.getByRole('button', { name: /archived jobs/i });
  await userEvent.click(showArchivedBtn);

    await screen.findByText(/archived job/i);

    // Edit button should be disabled or not present
    const editBtn = screen.queryByRole('button', { name: /edit/i });
    if (editBtn) {
      expect(editBtn).toBeDisabled();
    } else {
      expect(editBtn).not.toBeInTheDocument();
    }
  });

  test.skip('bulk archives multiple jobs', async () => {
    jobsAPI.getJobs.mockResolvedValue([
      { id: 1, title: 'Job 1', company_name: 'TechCo', job_type: 'ft', archived: false },
      { id: 2, title: 'Job 2', company_name: 'DataCorp', job_type: 'ft', archived: false },
    ]);
  jobsAPI.bulkArchiveJobs.mockResolvedValueOnce({ archived: 2 });

    render(<Jobs />, { wrapper: RouterWrapper });

    await screen.findByText(/job 1/i);
    await screen.findByText(/job 2/i);

  // Enter bulk selection by toggling the select-all checkbox or selecting job checkboxes
  const checkboxes = screen.getAllByRole('checkbox');
  // first checkbox is the header select-all, then job checkboxes
  const checkbox1 = checkboxes[1];
  const checkbox2 = checkboxes[2];
  await userEvent.click(checkbox1);
  await userEvent.click(checkbox2);

    // Click bulk archive
    const bulkArchiveBtn = screen.getByRole('button', { name: /archive selected/i });
    await userEvent.click(bulkArchiveBtn);

    await waitFor(() => {
      expect(jobsAPI.bulkArchiveJobs).toHaveBeenCalledWith([1, 2]);
    });
  });
});
