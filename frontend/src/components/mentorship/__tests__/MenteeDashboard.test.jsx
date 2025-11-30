import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import MentorshipMenteeDashboard from '../MenteeDashboard';
import { mentorshipAPI } from '../../../services/api';

const mockNavigate = jest.fn();
const mockParams = { teamMemberId: 'team-123' };

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

jest.mock('../../common/LoadingSpinner', () => () => <div data-testid="spinner">loading</div>);

const sampleSharedData = {
  sections: {
    share_profile_basics: true,
    share_skills: true,
    share_employment: true,
    share_education: true,
    share_certifications: true,
    share_documents: true,
    share_job_applications: true,
  },
  profile: {
    headline: 'Aspiring SWE',
    summary: 'Building accessible products.',
    full_location: 'New York, NY',
    phone: '555-0100',
  },
  skills: [{ id: 'skill-1', skill_name: 'React', level: 'intermediate', years: 2 }],
  employment: [
    {
      id: 'job-emp-1',
      job_title: 'Intern Developer',
      company_name: 'Globex',
      description: 'Worked on dashboards.',
      achievements: ['Automated regression tests'],
      skills_used: [{ name: 'Jest' }],
      start_date: '2024-01-01',
      end_date: '2024-08-01',
      location: 'Remote',
      duration: 'Jan 2024 - Aug 2024',
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'Tech University',
      degree_type: 'bs',
      field_of_study: 'Computer Science',
      start_date: '2020-09-01',
      graduation_date: '2024-05-15',
      description: 'Specialised in AI.',
      gpa: 3.9,
      honors: 'Summa Cum Laude',
      achievements: 'Hackathon champion',
      currently_enrolled: false,
    },
  ],
  certifications: [{ id: 'cert-1', name: 'AWS CP' }],
  documents: [
    { id: 'doc-1', document_name: 'Resume v1', doc_type: 'resume', preview_url: 'http://example.com/resume.pdf' },
  ],
  job_applications: [
    {
      job_id: 'job-app-1',
      job: { title: 'Frontend Developer', company_name: 'Initech', location: 'Remote', personal_notes: 'Ready' },
      shared_resume_document: { preview_url: 'http://example.com/resume.pdf' },
      shared_cover_letter_document: { preview_url: 'http://example.com/cover.pdf' },
      notes: 'Initial screen complete',
    },
  ],
  documents_url: '',
  goals: [
    {
      id: 'goal-1',
      title: 'Submit 10 applications',
      goal_type: 'applications_submitted',
      status: 'active',
      progress_percent: 40,
      progress_value: 4,
      target_value: 10,
      due_date: '2025-12-31',
      notes: 'Track weekly',
    },
  ],
  goal_summary: { total: 1, active: 1, completed: 0, cancelled: 0 },
  job_sharing_mode: 'selected',
  documents_count: 1,
  mentee: { full_name: 'Jordan Apprentice' },
  viewer_role: 'mentor',
};

const sampleReport = {
  window_days: 7,
  window_start: '2025-11-20T00:00:00Z',
  window_end: '2025-11-27T00:00:00Z',
  jobs: { new_applications: [{ id: 'joba', title: 'Engineer', company_name: 'Initrode' }] },
  projects: { completed: [{ id: 'proj-1', name: 'Portfolio refresh' }] },
  goals: { completed: [{ id: 'goal-2', goal_type: 'skills_added', title: 'Add SQL' }] },
  interview_practice: { entries: [{ created_at: '2025-11-26T00:00:00Z', question: 'Tell me about yourself' }] },
};

const sampleMessages = {
  messages: [
    {
      id: 'msg-1',
      message: 'How are applications going?',
      created_at: '2025-11-28T12:00:00Z',
      sender: { full_name: 'Coach Carter' },
      is_own: false,
    },
  ],
};

const sampleAnalytics = {
  funnel_analytics: {
    total_applications: 3,
    status_breakdown: { interested: 1, applied: 3, phone_screen: 1, interview: 1, offer: 0, rejected: 1 },
    response_rate: 33.3,
    interview_rate: 33.3,
    offer_rate: 0,
  },
  time_to_response: {
    avg_application_to_response_days: 2.0,
    avg_application_to_interview_days: 5.5,
    avg_interview_to_offer_days: null,
    samples: { application_to_response: 2, application_to_interview: 1, interview_to_offer: 0 },
  },
  volume_patterns: { weekly_volume: [{ week: '2025-11-20', count: 2 }], avg_weekly: 2, total_applications: 2 },
  practice_engagement: {
    total_sessions: 4,
    last_7_days: 2,
    average_score: 78,
    activity: [],
    focus_categories: [{ category: 'behavioral', average_score: 70, count: 2 }],
  },
};

const mockNewMessage = {
  id: 'msg-2',
  message: 'Just sent another application!',
  created_at: '2025-11-28T13:00:00Z',
  is_own: true,
};

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <MentorshipMenteeDashboard />
    </MemoryRouter>
  );

describe('MentorshipMenteeDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.open = jest.fn();
    jest.spyOn(window, 'setInterval').mockImplementation(() => 0);
    jest.spyOn(window, 'clearInterval').mockImplementation(() => {});
    mentorshipAPI.getSharedData.mockResolvedValue(sampleSharedData);
    mentorshipAPI.getProgressReport.mockResolvedValue(sampleReport);
    mentorshipAPI.getAnalytics.mockResolvedValue(sampleAnalytics);
    mentorshipAPI.getMessages.mockResolvedValue(sampleMessages);
    mentorshipAPI.getGoals.mockResolvedValue({
      goals: sampleSharedData.goals,
      goal_summary: sampleSharedData.goal_summary,
    });
    mentorshipAPI.createGoal.mockResolvedValue({});
    mentorshipAPI.updateGoal.mockResolvedValue({});
    mentorshipAPI.deleteGoal.mockResolvedValue({});
    mentorshipAPI.sendMessage.mockResolvedValue(mockNewMessage);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders shared mentee data, progress report, and document previews', async () => {
    renderDashboard();

    await screen.findByText('Mentorship goals');

    expect(screen.getByText('Aspiring SWE')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Intern Developer')).toBeInTheDocument();
    expect(screen.getByText('Tech University')).toBeInTheDocument();
    expect(screen.getByText(/Job applications \(selected\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Resume v1/i }));
    expect(window.open).toHaveBeenCalledWith('http://example.com/resume.pdf', '_blank', 'noopener,noreferrer');

    fireEvent.click(screen.getByRole('button', { name: /Resume attached/i }));
    expect(window.open).toHaveBeenCalledWith('http://example.com/resume.pdf', '_blank', 'noopener,noreferrer');

    expect(screen.getByText(/7 day window/)).toBeInTheDocument();
    expect(screen.getByText(/Portfolio refresh/)).toBeInTheDocument();
  });

  it('creates skill improvement goals with the expected payload', async () => {
    renderDashboard();
    await screen.findByText('Mentorship goals');

    fireEvent.change(screen.getByLabelText(/Goal type/i), { target: { value: 'skill_improve' } });
    fireEvent.change(screen.getByLabelText(/Goal title/i), { target: { value: '  Improve React  ' } });
    fireEvent.change(screen.getByLabelText(/Skill$/i), { target: { value: ' React ' } });
    fireEvent.change(screen.getByLabelText(/Target level/i), { target: { value: 'expert' } });
    fireEvent.change(screen.getByLabelText(/Current level/i), { target: { value: 'intermediate' } });
    fireEvent.change(screen.getByLabelText(/Due date/i), { target: { value: '2025-12-31' } });
    fireEvent.change(screen.getByLabelText(/Notes/i), { target: { value: '  Focus on hooks ' } });

    fireEvent.click(screen.getByRole('button', { name: /Create goal/i }));

    await waitFor(() => {
      expect(mentorshipAPI.createGoal).toHaveBeenCalledWith('team-123', {
        goal_type: 'skill_improve',
        title: 'Improve React',
        custom_skill_name: 'React',
        required_level: 'expert',
        starting_level: 'intermediate',
        due_date: '2025-12-31',
        notes: 'Focus on hooks',
      });
    });
  });

  it('updates, refreshes, and deletes mentorship goals', async () => {
    renderDashboard();
    await screen.findByText('Mentorship goals');

    fireEvent.click(screen.getByRole('button', { name: /Refresh goals/i }));
    expect(mentorshipAPI.getGoals).toHaveBeenCalledWith('team-123');

    fireEvent.click(screen.getByRole('button', { name: /Mark complete/i }));
    expect(mentorshipAPI.updateGoal).toHaveBeenCalledWith('goal-1', { status: 'completed' });

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
    
    // Wait for confirmation dialog to appear and confirm deletion
    await waitFor(() => {
      expect(screen.getByText('Delete this mentorship goal?')).toBeInTheDocument();
    });
    
    const confirmButton = screen.getByRole('button', { name: /Confirm/i });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(mentorshipAPI.deleteGoal).toHaveBeenCalledWith('goal-1');
    });
  });

  it('sends chat messages and appends them to the log', async () => {
    renderDashboard();
    await screen.findByText('Mentor conversation');

    fireEvent.change(screen.getByPlaceholderText(/Send a note/i), { target: { value: 'Another update' } });
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));

    await waitFor(() => {
      expect(mentorshipAPI.sendMessage).toHaveBeenCalledWith('team-123', { message: 'Another update' });
    });
    await screen.findByText(/Just sent another application/);
  });

  it('renders an error view when shared data fails to load', async () => {
    mentorshipAPI.getSharedData.mockRejectedValueOnce(new Error('network down'));
    renderDashboard();

    await screen.findByText(/network down/i);
    fireEvent.click(screen.getByRole('button', { name: /Back to Mentorship/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/mentorship');
  });
});
