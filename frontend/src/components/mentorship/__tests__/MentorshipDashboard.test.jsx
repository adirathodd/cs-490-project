import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import MentorshipDashboard from '../MentorshipDashboard';
import { mentorshipAPI } from '../../../services/api';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../../common/LoadingSpinner', () => () => <div data-testid="spinner">loading</div>);

const baseRequests = {
  incoming: [
    {
      id: 'incoming-1',
      requester_profile: { full_name: 'Alice Mentor', email: 'alice@example.com', headline: 'Staff Engineer' },
      role_for_requester: 'mentor',
      status: 'pending',
      created_at: '2025-11-25T10:00:00Z',
      message: 'Happy to support your search!',
    },
  ],
  outgoing: [
    {
      id: 'outgoing-1',
      receiver_profile: { full_name: 'Bobby Builder', email: 'bobby@example.com', headline: 'Product Manager' },
      role_for_requester: 'mentee',
      status: 'pending',
      created_at: '2025-11-20T10:00:00Z',
      message: '',
    },
  ],
};

const baseRelationships = {
  mentors: [
    {
      id: 'mentor-rel-1',
      collaborator: { full_name: 'Coach Carter', email: 'coach@example.com', headline: 'Career Coach' },
      permission_level: 'full',
      current_user_role: 'mentee',
      accepted_at: '2025-11-01T00:00:00Z',
      share_settings: {
        share_profile_basics: true,
        share_skills: true,
        share_employment: false,
        share_education: true,
        share_certifications: false,
        share_documents: true,
        share_job_applications: true,
        job_sharing_mode: 'selected',
        shared_applications: [
          {
            job_id: 'job-1',
            job: { id: 'job-1', title: 'Frontend Developer', company_name: 'Globex' },
            notes: 'Focus on impact.',
          },
        ],
      },
    },
  ],
  mentees: [
    {
      id: 'mentee-rel-1',
      collaborator: { full_name: 'Jordan Apprentice', email: 'jordan@example.com', headline: 'New Grad' },
      permission_level: 'limited',
      current_user_role: 'mentor',
      accepted_at: '2025-10-15T00:00:00Z',
      share_settings: {
        share_profile_basics: true,
        share_skills: true,
        share_employment: true,
        share_education: true,
        share_certifications: true,
        share_documents: false,
        job_sharing_mode: 'responded',
        share_job_applications: true,
      },
    },
  ],
};

const baseShareSettings = {
  share_profile_basics: true,
  share_skills: true,
  share_employment: false,
  share_education: true,
  share_certifications: false,
  share_documents: true,
  share_job_applications: true,
  job_sharing_mode: 'selected',
  shared_applications: [
    {
      job_id: 'job-1',
      job: { id: 'job-1', title: 'Frontend Developer', company_name: 'Globex', location: 'Remote' },
      notes: 'Please review my resume choice.',
    },
  ],
  available_jobs: [
    { id: 'job-1', title: 'Frontend Developer', company_name: 'Globex' },
    { id: 'job-2', title: 'QA Analyst', company_name: 'Initech' },
  ],
};

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <MentorshipDashboard />
    </MemoryRouter>
  );

describe('MentorshipDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mentorshipAPI.getRequests.mockResolvedValue(baseRequests);
    mentorshipAPI.getRelationships.mockResolvedValue(baseRelationships);
    mentorshipAPI.getShareSettings.mockResolvedValue(baseShareSettings);
    mentorshipAPI.sendRequest.mockResolvedValue({});
    mentorshipAPI.respondToRequest.mockResolvedValue({});
    mentorshipAPI.cancelRequest.mockResolvedValue({});
    mentorshipAPI.updateShareSettings.mockResolvedValue(baseShareSettings);
  });

  it('loads requests and relationships and allows responding to invitations', async () => {
    renderDashboard();

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    await screen.findByText('Invite a mentor or mentee');

    expect(screen.getByText('Alice Mentor')).toBeInTheDocument();
    expect(screen.getByText('Coach Carter')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /accept/i }));

    await waitFor(() => {
      expect(mentorshipAPI.respondToRequest).toHaveBeenCalledWith('incoming-1', 'accept');
    });

    const manageSelect = screen.getByLabelText(/Manage for/i);
    expect(manageSelect.value).toBe('mentor-rel-1');
    expect(mentorshipAPI.getShareSettings).toHaveBeenCalledWith('mentor-rel-1');
  });

  it('submits mentorship invitations and resets the form', async () => {
    renderDashboard();
    await screen.findByText('Invite a mentor or mentee');

    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'mentor@example.com ' } });
    fireEvent.change(screen.getByLabelText(/Your role/i), { target: { value: 'mentor' } });
    fireEvent.change(screen.getByLabelText(/Optional message/i), { target: { value: ' Looking forward ' } });

    fireEvent.click(screen.getByRole('button', { name: /Send invitation/i }));

    await waitFor(() => {
      expect(mentorshipAPI.sendRequest).toHaveBeenCalledWith({
        target_email: 'mentor@example.com',
        requester_role: 'mentor',
        message: 'Looking forward',
      });
    });

    expect(screen.getByText(/Invitation sent successfully/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toHaveValue('');
  });

  it('updates sharing preferences for the selected mentor', async () => {
    renderDashboard();
    const sharingHeader = await screen.findByText('Choose what each mentor can view');
    const sharingSection = sharingHeader.closest('section') || sharingHeader.closest('.mentorship-sharing-panel');
    await waitFor(() => {
      expect(mentorshipAPI.getShareSettings).toHaveBeenCalledWith('mentor-rel-1');
    });
    const toggleGrid = sharingSection?.querySelector('.mentorship-toggle-grid') || sharingSection;
    const toggleInputs = within(toggleGrid).getAllByRole('checkbox');
    const profileToggle = toggleInputs[0];
    expect(profileToggle).toBeTruthy();
    fireEvent.click(profileToggle);

    const jobOptionsWrapper = sharingSection?.querySelector('.mentorship-job-sharing-options') || sharingSection;
    const radioInputs = within(jobOptionsWrapper).getAllByRole('radio');
    const respondedOption = radioInputs.find((input) => input.value === 'responded');
    expect(respondedOption).toBeTruthy();
    fireEvent.click(respondedOption);

    mentorshipAPI.updateShareSettings.mockResolvedValue({
      ...baseShareSettings,
      share_profile_basics: false,
      job_sharing_mode: 'responded',
    });

    fireEvent.click(screen.getByRole('button', { name: /Save sharing settings/i }));

    await waitFor(() => {
      expect(mentorshipAPI.updateShareSettings).toHaveBeenCalledWith('mentor-rel-1', {
        share_profile_basics: false,
        share_skills: true,
        share_employment: false,
        share_education: true,
        share_certifications: false,
        share_documents: true,
        share_job_applications: true,
        job_sharing_mode: 'responded',
      });
    });

    expect(screen.getByText(/Sharing preferences saved/i)).toBeInTheDocument();
  });

  it('navigates to the mentee dashboard when a mentor record is opened', async () => {
    renderDashboard();
    const viewButton = await screen.findByRole('button', { name: /View shared data & goals/i });
    fireEvent.click(viewButton);

    expect(mockNavigate).toHaveBeenCalledWith('/mentorship/mentees/mentor-rel-1');
  });

  it('shows an error message when data fails to load', async () => {
    mentorshipAPI.getRequests.mockRejectedValueOnce(new Error('boom'));
    mentorshipAPI.getRelationships.mockRejectedValueOnce(new Error('boom'));
    renderDashboard();

    await screen.findByText(/boom/i);
    expect(mentorshipAPI.getShareSettings).not.toHaveBeenCalled();
  });
});
