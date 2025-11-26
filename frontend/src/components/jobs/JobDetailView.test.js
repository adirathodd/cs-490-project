import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import JobDetailView from './JobDetailView';
import { jobsAPI, skillsAPI, interviewsAPI } from '../../services/api';

// Mock react-router-dom hooks
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: '1' }),
}));

const RouterWrapper = ({ children }) => <BrowserRouter>{children}</BrowserRouter>;

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigate.mockClear();
  // Mock scrollIntoView which is not implemented in jsdom
  Element.prototype.scrollIntoView = jest.fn();
  jobsAPI.getJobTechnicalPrep.mockResolvedValue(null);
  jobsAPI.logTechnicalPrepAttempt.mockResolvedValue({});
});

const mockJob = {
  id: 1,
  title: 'Software Engineer',
  company_name: 'Test Corp',
  location: 'San Francisco',
  salary_min: 100000,
  salary_max: 150000,
  salary_currency: 'USD',
  posting_url: 'https://example.com/job',
  application_deadline: '2025-12-31',
  description: 'Great job opportunity',
  industry: 'Software',
  job_type: 'ft',
  personal_notes: 'Good fit',
  recruiter_name: 'John Doe',
  recruiter_email: 'john@example.com',
  recruiter_phone: '555-1234',
  hiring_manager_name: 'Jane Smith',
  hiring_manager_email: 'jane@example.com',
  salary_negotiation_notes: 'Room for negotiation',
  interview_notes: 'Prepare for technical questions',
  application_history: [],
  company_info: {
    name: 'Test Corp',
    industry: 'Software',
    size: '100-500',
    description: 'A great company',
  },
};

const mockQuestionBank = {
  job_title: 'Software Engineer',
  company_name: 'Test Corp',
  industry: 'Software',
  generated_at: '2025-01-01T00:00:00Z',
  difficulty_levels: [
    { value: 'entry', label: 'Entry' },
    { value: 'mid', label: 'Mid' },
  ],
  star_framework: {
    overview: 'Use STAR',
    steps: [
      { id: 'situation', title: 'Situation', tip: 'Context' },
      { id: 'task', title: 'Task', tip: 'Responsibility' },
    ],
  },
  company_focus: [],
  categories: [
    {
      id: 'technical',
      label: 'Technical',
      guidance: 'Share detailed architecture decisions.',
      questions: [
        {
          id: 'q1',
          prompt: 'Explain how you scaled an API under heavy load.',
          category: 'technical',
          difficulty: 'mid',
          skills: [{ skill_id: 1, name: 'APIs' }],
          concepts: ['scalability'],
          framework: null,
          practice_status: { practiced: false, practice_count: 0 },
        },
      ],
    },
  ],
};

const mockTechnicalPrep = {
  has_data: true,
  job_title: 'Software Engineer',
  tech_stack: {
    languages: ['Python'],
    frameworks: ['React'],
    tooling: ['PostgreSQL'],
  },
  performance_tracking: {
    total_practice_minutes: 0,
    last_session_at: null,
  },
  coding_challenges: [
    {
      id: 'prep-1',
      title: 'Python services challenge',
      description: 'Implement a resilient API.',
      difficulty: 'mid',
      timer: { recommended_minutes: 40 },
      objectives: ['Translate requirements'],
      best_practices: ['Narrate tradeoffs'],
      practice_stats: { attempts: 0 },
      recent_attempts: [],
    },
  ],
  system_design_scenarios: [
    {
      id: 'sd-1',
      title: 'Realtime analytics',
      scenario: 'Design analytics platform',
      requirements: ['Low latency'],
      constraints: ['Multi region'],
      evaluation: ['Scalability'],
    },
  ],
  case_studies: [
    {
      id: 'case-1',
      title: 'Go-to-market case',
      role_focus: 'Consulting',
      scenario: 'Launch new product',
      tasks: ['Quantify impact'],
    },
  ],
  technical_questions: [
    {
      id: 'tq-1',
      prompt: 'Explain service scaling',
      linked_skill: 'Scalability',
      answer_framework: ['Set context', 'Explain tradeoffs'],
    },
  ],
  whiteboarding_practice: {
    techniques: ['State assumptions'],
  },
  solution_frameworks: [
    {
      name: 'ACE',
      steps: ['Assess', 'Construct', 'Explain'],
    },
  ],
  real_world_alignment: [
    {
      id: 'rw-1',
      skill: 'Systems Thinking',
      scenario: 'Support scaling features',
      business_link: 'Improves retention',
    },
  ],
};

describe('JobDetailView (UC-042: Job Application Materials)', () => {
  test('renders job details correctly', async () => {
    jobsAPI.getJob.mockResolvedValueOnce(mockJob);

    render(<JobDetailView />, { wrapper: RouterWrapper });

    expect(await screen.findByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getAllByText('Test Corp').length).toBeGreaterThan(0); // Company name appears multiple times
    expect(screen.getByText('San Francisco')).toBeInTheDocument();
  });

  test('displays recruiter and hiring manager information', async () => {
    jobsAPI.getJob.mockResolvedValueOnce(mockJob);

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');

    // Recruiter and hiring manager are shown in basic info (not a separate tab)
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  test('switches between tabs correctly', async () => {
    jobsAPI.getJob.mockResolvedValueOnce(mockJob);
    jobsAPI.getJobQuestionBank.mockResolvedValue(mockQuestionBank);

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');

    // Click interview insights tab
    const insightsTab = screen.getByRole('button', { name: /interview insights/i });
    await userEvent.click(insightsTab);

    // Tab should be active (has active styling)
    await waitFor(() => {
      expect(insightsTab).toHaveStyle('border-bottom: 3px solid #667eea');
    });
  });

  test('renders question bank and logs practice responses', async () => {
    jobsAPI.getJob.mockResolvedValueOnce(mockJob);
    jobsAPI.getJobQuestionBank.mockResolvedValueOnce(mockQuestionBank);
    jobsAPI.logQuestionPractice.mockResolvedValueOnce({
      practice_status: {
        practiced: true,
        practice_count: 1,
        last_practiced_at: '2025-01-05T12:00:00Z',
        written_response: 'Handled scale',
        star_response: {},
        practice_notes: '',
      },
    });

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');

    const interviewTab = screen.getByRole('button', { name: /interview insights/i });
    await userEvent.click(interviewTab);

    const practiceBtn = await screen.findByRole('button', { name: /log practice/i });
    await userEvent.click(practiceBtn);

    const practiceModal = await screen.findByRole('dialog');
    const summaryInput = within(practiceModal).getByPlaceholderText(/overall summary/i);
    await userEvent.type(summaryInput, 'Handled large scale traffic');

    const savePracticeBtn = within(practiceModal).getByRole('button', { name: /save practice/i });
    await userEvent.click(savePracticeBtn);

    await waitFor(() => {
      expect(jobsAPI.logQuestionPractice).toHaveBeenCalledWith(1, expect.objectContaining({
        question_id: 'q1',
      }));
    });
  });

  test('renders technical prep tab', async () => {
    jobsAPI.getJob.mockResolvedValueOnce(mockJob);
    jobsAPI.getJobTechnicalPrep.mockResolvedValueOnce(mockTechnicalPrep);

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');
    const prepTab = screen.getByRole('button', { name: /technical prep/i });
    await userEvent.click(prepTab);

    expect(await screen.findByText(/coding challenges/i)).toBeInTheDocument();
    expect(screen.getAllByText(/python services challenge/i)[0]).toBeInTheDocument();
  });

  test('saves preparation checklist toggle', async () => {
    jobsAPI.getJob.mockResolvedValueOnce(mockJob);
    jobsAPI.getJobInterviewInsights.mockResolvedValueOnce({
      has_data: true,
      preparation_checklist: [
        {
          category: 'General Prep',
          items: [
            { task_id: 'task-1', task: 'Review job description thoroughly', completed: false },
          ],
        },
      ],
    });
    jobsAPI.getJobQuestionBank.mockResolvedValueOnce(mockQuestionBank);
    jobsAPI.togglePreparationChecklist.mockResolvedValueOnce({ task_id: 'task-1', completed: true });

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');
    const interviewTab = screen.getByRole('button', { name: /interview insights/i });
    await userEvent.click(interviewTab);

    const checklistItem = await screen.findByLabelText(/review job description thoroughly/i);
    await userEvent.click(checklistItem);

    await waitFor(() => {
      expect(jobsAPI.togglePreparationChecklist).toHaveBeenCalledWith(1, expect.objectContaining({
        task_id: 'task-1',
        completed: true,
      }));
    });
  });

  test('enables edit mode and updates job', async () => {
    jobsAPI.getJob.mockResolvedValueOnce(mockJob);
    jobsAPI.updateJob.mockResolvedValueOnce({
      ...mockJob,
      title: 'Senior Software Engineer',
    });

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');

    // Click edit button
    const editBtn = screen.getByRole('button', { name: /edit/i });
    await userEvent.click(editBtn);

    // Update title
    const titleInput = screen.getByDisplayValue('Software Engineer');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Senior Software Engineer');

    // Save changes
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(jobsAPI.updateJob).toHaveBeenCalledWith(
        "1", // useParams returns strings
        expect.objectContaining({
          title: 'Senior Software Engineer',
        })
      );
    });

    expect(await screen.findByText(/job updated successfully/i)).toBeInTheDocument();
  });

  test('cancels edit mode without saving', async () => {
    jobsAPI.getJob.mockResolvedValue(mockJob); // Keep returning mockJob for reload

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');

    // Click edit button
    const editBtn = screen.getByRole('button', { name: /edit/i });
    await userEvent.click(editBtn);

    // Update title
    const titleInput = screen.getByDisplayValue('Software Engineer');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'New Title');

    // Cancel
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await userEvent.click(cancelBtn);

    // Should not call update API
    expect(jobsAPI.updateJob).not.toHaveBeenCalled();
    
    // Original title should be displayed after reload
    await waitFor(() => {
      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    });
  });

  test('handles API error when loading job', async () => {
    jobsAPI.getJob.mockRejectedValueOnce({
      message: 'Job not found',
    });

    render(<JobDetailView />, { wrapper: RouterWrapper });

    expect(await screen.findByText(/job not found/i)).toBeInTheDocument();
  });

  test('navigates back to jobs list', async () => {
    jobsAPI.getJob.mockResolvedValueOnce(mockJob);

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');

    const backBtn = screen.getByRole('button', { name: /back to jobs/i });
    await userEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/jobs');
  });
});

describe('JobDetailView (UC-071: Interview Scheduling)', () => {
  test('loads and displays scheduled interviews', async () => {
    jobsAPI.getJob.mockResolvedValueOnce(mockJob);
    interviewsAPI.getInterviews.mockResolvedValueOnce([
      {
        id: 1,
        job: 1,
        interview_type: 'video',
        scheduled_at: '2025-12-01T10:00:00Z',
        duration_minutes: 60,
        interviewer_name: 'Alice Johnson',
      },
    ]);

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');

    // Click on scheduled interviews tab
    const interviewsTab = screen.getByRole('button', { name: /scheduled interviews/i });
    await userEvent.click(interviewsTab);

    await waitFor(() => {
      expect(interviewsAPI.getInterviews).toHaveBeenCalledWith({ job: '1' });
    });

    expect(await screen.findByText(/alice johnson/i)).toBeInTheDocument();
  });

  test('opens interview scheduler modal', async () => {
    jobsAPI.getJob.mockResolvedValueOnce(mockJob);
    interviewsAPI.getInterviews.mockResolvedValueOnce([]);

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');

    // Click on scheduled interviews tab
    const interviewsTab = screen.getByRole('button', { name: /scheduled interviews/i });
    await userEvent.click(interviewsTab);

    // Wait for the "Schedule Interview" button in the empty state to appear
    const scheduleBtns = await screen.findAllByRole('button', { name: /schedule interview/i });
    // Click the button inside the interview section (not the header button)
    await userEvent.click(scheduleBtns[scheduleBtns.length - 1]);

    // Modal should open - look for "Interview Type" label which is specific to the modal
    expect(await screen.findByText(/interview type/i)).toBeInTheDocument();
  });

  test('opens scheduler with ?tab=interviews query param', async () => {
    jobsAPI.getJob.mockResolvedValue(mockJob);
    jobsAPI.getJobInterviewInsights.mockResolvedValue(null);
    jobsAPI.getJobSkillsGap.mockResolvedValue(null);
    interviewsAPI.getInterviews.mockResolvedValue([]);

    // Use MemoryRouter to simulate URL with query param
    render(
      <MemoryRouter initialEntries={['/jobs/1?tab=interviews']}>
        <JobDetailView />
      </MemoryRouter>
    );

    // Wait for component to load and find the scheduled interviews tab
    const scheduledInterviewsTab = await screen.findByRole('button', { name: /scheduled interviews/i });
    
    // Should automatically switch to scheduled interviews tab (check tab is active)
    await waitFor(() => {
      expect(scheduledInterviewsTab).toHaveStyle('border-bottom: 3px solid #667eea');
    });
  });

  test('deletes an interview', async () => {
    jobsAPI.getJob.mockResolvedValueOnce(mockJob);
    interviewsAPI.getInterviews.mockResolvedValueOnce([
      {
        id: 1,
        job: 1,
        interview_type: 'video',
        scheduled_at: '2025-12-01T10:00:00Z',
        duration_minutes: 60,
        interviewer_name: 'Alice Johnson',
      },
    ]);
    interviewsAPI.deleteInterview.mockResolvedValueOnce({ success: true });
    interviewsAPI.getInterviews.mockResolvedValueOnce([]);

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');

    // Click on scheduled interviews tab
    const interviewsTab = screen.getByRole('button', { name: /scheduled interviews/i });
    await userEvent.click(interviewsTab);

    await screen.findByText(/alice johnson/i);

    // Click delete button (opens confirmation modal)
    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    await userEvent.click(deleteBtn);

    // Confirm deletion in modal (button says "Delete Interview")
    const confirmBtn = await screen.findByRole('button', { name: /delete interview/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(interviewsAPI.deleteInterview).toHaveBeenCalledWith(1);
    });
  });
});

describe('JobDetailView (UC-068: Interview Insights)', () => {
  test('loads and displays interview insights', async () => {
    const mockInsights = {
      has_data: true,
      process_overview: {
        total_stages: 3,
        estimated_duration: '2-4 weeks',
        stages: [
          {
            stage_number: 1,
            name: 'Phone Screen',
            duration: '30 min',
            description: 'Initial conversation',
            activities: ['Discuss background', 'Review resume'],
          },
        ],
      },
      disclaimer: 'This is based on general industry data',
    };

    jobsAPI.getJob.mockResolvedValueOnce(mockJob);
    jobsAPI.getJobInterviewInsights.mockResolvedValueOnce(mockInsights);

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');

    // Click on interview insights tab
    const insightsTab = screen.getByRole('button', { name: /interview insights/i });
    await userEvent.click(insightsTab);

    await waitFor(() => {
      expect(jobsAPI.getJobInterviewInsights).toHaveBeenCalledWith(1);
    });

    expect(await screen.findByText(/phone screen/i)).toBeInTheDocument();
  });

  test('shows empty state when no insights available', async () => {
    jobsAPI.getJob.mockResolvedValueOnce(mockJob);
    jobsAPI.getJobInterviewInsights.mockResolvedValueOnce(null);

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');

    // Click on interview insights tab
    const insightsTab = screen.getByRole('button', { name: /interview insights/i });
    await userEvent.click(insightsTab);

    // Should show empty state
    expect(await screen.findByText(/no interview insights available/i)).toBeInTheDocument();
  });
});

describe('JobDetailView (UC-066: Skills Gap Analysis)', () => {
  test('loads and displays skills gap analysis', async () => {
    const mockAnalysis = {
      skills: [
        {
          skill_id: 1,
          skill_name: 'React',
          required_level: 'advanced',
          current_level: 'intermediate',
          gap_severity: 50,
          suggested_learning_path: [
            {
              step: 'Complete advanced React course',
              estimated_hours: 20,
            },
          ],
        },
      ],
      summary: {
        total_skills_required: 5,
        total_skills_matched: 3,
        top_gaps: ['React', 'TypeScript'],
      },
    };

    jobsAPI.getJob.mockResolvedValueOnce(mockJob);
    jobsAPI.getJobSkillsGap.mockResolvedValueOnce(mockAnalysis);
    jobsAPI.getSkillProgress.mockResolvedValue([]);

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');

    // Click on skills gap tab
    const skillsTab = screen.getByRole('button', { name: /skills gap/i });
    await userEvent.click(skillsTab);

    await waitFor(() => {
      expect(jobsAPI.getJobSkillsGap).toHaveBeenCalledWith(1, {});
    });

    expect(await screen.findByText(/react/i)).toBeInTheDocument();
  });

  test('shows empty state when no skills gap analysis available', async () => {
    jobsAPI.getJob.mockResolvedValueOnce(mockJob);
    jobsAPI.getJobSkillsGap.mockResolvedValueOnce(null);

    render(<JobDetailView />, { wrapper: RouterWrapper });

    await screen.findByText('Software Engineer');

    // Click on skills gap tab
    const skillsTab = screen.getByRole('button', { name: /skills gap/i });
    await userEvent.click(skillsTab);

    // Should show empty state
    expect(await screen.findByText(/no skills gap analysis available/i)).toBeInTheDocument();
  });
});
