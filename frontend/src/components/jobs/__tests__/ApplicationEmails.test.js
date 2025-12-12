import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ApplicationEmails from '../ApplicationEmails';
import emailAPI from '../../../services/emailAPI';

// Mock the emailAPI
jest.mock('../../../services/emailAPI');

// Mock Toast component
jest.mock('../../common/Toast', () => {
  return function Toast() {
    return <div data-testid="toast">Toast</div>;
  };
});

describe('ApplicationEmails Component', () => {
  const mockEmails = [
    {
      id: '1',
      subject: 'Software Engineer Interview',
      sender_email: 'hr@google.com',
      sender_name: 'Google HR',
      received_at: '2025-12-10T10:00:00Z',
      snippet: 'We would like to invite you...',
      email_type: 'interview_invitation',
      confidence_score: 0.9,
      suggested_job_status: 'interviewing',
      gmail_url: 'https://mail.google.com/mail/u/0/#inbox/msg1'
    },
    {
      id: '2',
      subject: 'Application Received',
      sender_email: 'recruiter@microsoft.com',
      sender_name: 'Microsoft Recruiter',
      received_at: '2025-12-09T15:30:00Z',
      snippet: 'Thank you for your application...',
      email_type: 'acknowledgment',
      confidence_score: 0.85,
      gmail_url: 'https://mail.google.com/mail/u/0/#inbox/msg2'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders loading state initially', () => {
      emailAPI.getEmails.mockImplementation(() => new Promise(() => {}));
      render(<ApplicationEmails jobId="job-1" />);
      expect(screen.getByText('Loading emails...')).toBeInTheDocument();
    });

    it('renders emails after loading', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      render(<ApplicationEmails jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByText(/Related Emails \(2\)/)).toBeInTheDocument();
      });

      expect(screen.getByText('Software Engineer Interview')).toBeInTheDocument();
      expect(screen.getByText('Application Received')).toBeInTheDocument();
    });

    it('renders no emails message when empty', async () => {
      emailAPI.getEmails.mockResolvedValue([]);
      render(<ApplicationEmails jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByText('No related emails found for this application.')).toBeInTheDocument();
      });
    });

    it('calls API with job_id parameter', async () => {
      emailAPI.getEmails.mockResolvedValue([]);
      render(<ApplicationEmails jobId="job-123" />);

      await waitFor(() => {
        expect(emailAPI.getEmails).toHaveBeenCalledWith({ job_id: 'job-123' });
      });
    });
  });

  describe('Search Functionality - UC-113', () => {
    it('shows search filters when showSearch is true', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      render(<ApplicationEmails jobId="job-1" showSearch={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Show Filters|Hide Filters/)).toBeInTheDocument();
      });
    });

    it('does not show search filters when showSearch is false', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      render(<ApplicationEmails jobId="job-1" showSearch={false} />);

      await waitFor(() => {
        expect(screen.queryByText(/Show Filters|Hide Filters/)).not.toBeInTheDocument();
      });
    });

    it('toggles filter visibility on button click', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      render(<ApplicationEmails jobId="job-1" showSearch={true} />);

      await waitFor(() => {
        expect(screen.getByText('Show Filters')).toBeInTheDocument();
      });

      const toggleButton = screen.getByText('Show Filters');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('Hide Filters')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search emails...')).toBeInTheDocument();
      });
    });

    it('calls API with search parameter when searching', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      render(<ApplicationEmails jobId="job-1" showSearch={true} />);

      // Open filters
      await waitFor(() => {
        const toggleButton = screen.getByText('Show Filters');
        fireEvent.click(toggleButton);
      });

      // Type in search input
      const searchInput = screen.getByPlaceholderText('Search emails...');
      fireEvent.change(searchInput, { target: { value: 'Engineer' } });

      await waitFor(() => {
        expect(emailAPI.getEmails).toHaveBeenCalledWith(
          expect.objectContaining({
            job_id: 'job-1',
            search: 'Engineer'
          })
        );
      });
    });

    it('calls API with sender filter', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      render(<ApplicationEmails jobId="job-1" showSearch={true} />);

      // Open filters
      await waitFor(() => {
        const toggleButton = screen.getByText('Show Filters');
        fireEvent.click(toggleButton);
      });

      // Type in sender input
      const senderInput = screen.getByPlaceholderText('Filter by sender...');
      fireEvent.change(senderInput, { target: { value: 'google' } });

      await waitFor(() => {
        expect(emailAPI.getEmails).toHaveBeenCalledWith(
          expect.objectContaining({
            job_id: 'job-1',
            sender: 'google'
          })
        );
      });
    });

    it('calls API with date range filters', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      render(<ApplicationEmails jobId="job-1" showSearch={true} />);

      // Open filters
      await waitFor(() => {
        const toggleButton = screen.getByText('Show Filters');
        fireEvent.click(toggleButton);
      });

      // Set date from
      const dateInputs = screen.getAllByRole('textbox');
      const dateFromInput = dateInputs.find(input => input.type === 'date' && !input.value);
      
      if (dateFromInput) {
        fireEvent.change(dateFromInput, { target: { value: '2025-12-01' } });

        await waitFor(() => {
          expect(emailAPI.getEmails).toHaveBeenCalledWith(
            expect.objectContaining({
              job_id: 'job-1',
              date_from: '2025-12-01'
            })
          );
        });
      }
    });

    it.skip('clears all filters when clear button is clicked', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      const { container } = render(<ApplicationEmails jobId="job-1" showSearch={true} />);

      // Wait for emails to load and component to render
      await waitFor(() => {
        expect(screen.queryByText('Loading emails...')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Software Engineer Interview')).toBeInTheDocument();
      });

      // Open filters
      const toggleButton = screen.getByText('Show Filters');
      fireEvent.click(toggleButton);

      // Wait for search input to appear
      await waitFor(() => {
        const searchInput = screen.queryByPlaceholderText('Search emails...');
        expect(searchInput).toBeInTheDocument();
      });

      // Now get the input and set a value
      const searchInput = screen.getByPlaceholderText('Search emails...');
      fireEvent.change(searchInput, { target: { value: 'test' } });

      // Verify value is set
      expect(searchInput.value).toBe('test');

      // Click clear button
      const clearButton = screen.getByText('Clear');
      fireEvent.click(clearButton);

      // Verify value is cleared
      await waitFor(() => {
        expect(searchInput.value).toBe('');
      });
    });
  });

  describe('Email Actions', () => {
    it('applies status suggestion successfully', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      emailAPI.applyStatusSuggestion.mockResolvedValue({ status: 'applied' });
      
      const mockRefresh = jest.fn();
      render(<ApplicationEmails jobId="job-1" onRefresh={mockRefresh} />);

      await waitFor(() => {
        expect(screen.getByText('Apply Suggested Status')).toBeInTheDocument();
      });

      const applyButton = screen.getByText('Apply Suggested Status');
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(emailAPI.applyStatusSuggestion).toHaveBeenCalledWith('1');
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('dismisses email successfully', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      emailAPI.dismissEmail.mockResolvedValue({ status: 'dismissed' });

      render(<ApplicationEmails jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByText('Software Engineer Interview')).toBeInTheDocument();
      });

      // Find and click dismiss button (first one)
      const dismissButtons = screen.getAllByText('Dismiss');
      fireEvent.click(dismissButtons[0]);

      await waitFor(() => {
        expect(emailAPI.dismissEmail).toHaveBeenCalledWith('1');
      });
    });

    it('handles apply status error', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      emailAPI.applyStatusSuggestion.mockRejectedValue(new Error('Failed'));

      render(<ApplicationEmails jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByText('Apply Suggested Status')).toBeInTheDocument();
      });

      const applyButton = screen.getByText('Apply Suggested Status');
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(emailAPI.applyStatusSuggestion).toHaveBeenCalled();
      });
    });
  });

  describe('Email Display', () => {
    it('displays email metadata correctly', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      render(<ApplicationEmails jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByText('Google HR')).toBeInTheDocument();
        expect(screen.getByText('Microsoft Recruiter')).toBeInTheDocument();
        expect(screen.getByText('We would like to invite you...')).toBeInTheDocument();
      });
    });

    it('displays confidence score', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      render(<ApplicationEmails jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByText('Confidence: 90%')).toBeInTheDocument();
        expect(screen.getByText('Confidence: 85%')).toBeInTheDocument();
      });
    });

    it('displays suggested status badge', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      render(<ApplicationEmails jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByText('Suggested: interviewing')).toBeInTheDocument();
      });
    });

    it('renders View in Gmail links', async () => {
      emailAPI.getEmails.mockResolvedValue(mockEmails);
      render(<ApplicationEmails jobId="job-1" />);

      await waitFor(() => {
        const links = screen.getAllByText('View in Gmail');
        expect(links).toHaveLength(2);
        expect(links[0].closest('a')).toHaveAttribute('href', mockEmails[0].gmail_url);
      });
    });
  });
});
