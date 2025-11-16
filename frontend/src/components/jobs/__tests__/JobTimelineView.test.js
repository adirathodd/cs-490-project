import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JobTimelineView from '../JobTimelineView';
import { jobsAPI } from '../../../services/api';

jest.mock('../../../services/api', () => ({
  jobsAPI: {
    getJob: jest.fn(),
  },
}));

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: '123' }),
  useNavigate: () => mockNavigate,
}));

describe('JobTimelineView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders timeline entries and history when job loads successfully', async () => {
    jobsAPI.getJob.mockResolvedValue({
      id: 123,
      title: 'Software Engineer',
      company_name: 'Acme Corp',
      status: 'phone_screen',
      created_at: '2025-01-01T00:00:00Z',
      last_status_change: '2025-01-05T15:00:00Z',
      application_history: [
        {
          action: 'Applied',
          timestamp: '2025-01-01T02:00:00Z',
          notes: 'Submitted resume',
        },
        {
          action: 'Phone screen scheduled',
          timestamp: '2025-01-03T09:30:00Z',
          notes: 'Scheduled with HR',
        },
      ],
    });

    render(<JobTimelineView />);

    expect(await screen.findByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText(/Current status/i)).toBeInTheDocument();
    expect(screen.getByText(/phone screen/i)).toBeInTheDocument();

    expect(screen.getByText('Job added to pipeline')).toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(screen.getByText('Phone screen scheduled')).toBeInTheDocument();
    expect(screen.getByText(/Status updated to phone screen/i)).toBeInTheDocument();

    expect(screen.getByText('Submitted resume')).toBeInTheDocument();
    expect(screen.getByText('Scheduled with HR')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Back to job/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/jobs/123');
  });

  it('shows placeholders when no timeline events exist', async () => {
    jobsAPI.getJob.mockResolvedValue({
      id: 999,
      title: '',
      company_name: '',
      status: '',
      application_history: [],
    });

    render(<JobTimelineView />);

    await waitFor(() => {
      expect(screen.getByText('Job timeline')).toBeInTheDocument();
    });

    expect(
      screen.getByText('No timeline events yet. Record a status update to begin tracking.')
    ).toBeInTheDocument();
    expect(screen.getByText('No history yet.')).toBeInTheDocument();
  });

  it('renders error card when job load fails', async () => {
    jobsAPI.getJob.mockRejectedValue(new Error('Boom'));

    render(<JobTimelineView />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load job timeline.')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Application momentum/i)).not.toBeInTheDocument();
  });
});
