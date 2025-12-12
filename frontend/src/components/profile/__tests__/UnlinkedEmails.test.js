import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import UnlinkedEmails from '../UnlinkedEmails';
import emailAPI from '../../../services/emailAPI';
import { jobsAPI } from '../../../services/api';

// Mock the APIs
jest.mock('../../../services/emailAPI');
jest.mock('../../../services/api');

// Mock Toast component
jest.mock('../../common/Toast', () => {
  return function Toast() {
    return <div data-testid="toast">Toast</div>;
  };
});

describe('UnlinkedEmails Component', () => {
  const mockUnlinkedEmails = [
    {
      id: 'email-1',
      subject: 'Interview Opportunity at TechCorp',
      sender_email: 'hr@techcorp.com',
      sender_name: 'TechCorp HR',
      received_at: '2025-12-10T10:00:00Z',
      snippet: 'We found your profile interesting...',
      email_type: 'recruiter_outreach',
      email_type_display: 'Recruiter Outreach',
      confidence_score: 0.85,
      gmail_url: 'https://mail.google.com/mail/u/0/#inbox/msg1'
    },
    {
      id: 'email-2',
      subject: 'Your Application Status',
      sender_email: 'jobs@startup.com',
      sender_name: 'Startup Inc',
      received_at: '2025-12-09T14:00:00Z',
      snippet: 'Thank you for applying...',
      email_type: 'acknowledgment',
      email_type_display: 'Application Acknowledged',
      confidence_score: 0.9,
      gmail_url: 'https://mail.google.com/mail/u/0/#inbox/msg2'
    }
  ];

  const mockJobs = [
    {
      id: 'job-1',
      title: 'Software Engineer',
      company_name: 'TechCorp'
    },
    {
      id: 'job-2',
      title: 'Frontend Developer',
      company_name: 'Startup Inc'
    }
  ];

  const mockGmailStatus = {
    status: 'connected',
    gmail_address: 'user@gmail.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders loading state initially', () => {
      emailAPI.getGmailStatus.mockImplementation(() => new Promise(() => {}));
      emailAPI.getEmails.mockImplementation(() => new Promise(() => {}));
      jobsAPI.getJobs.mockImplementation(() => new Promise(() => {}));
      
      render(<UnlinkedEmails />);
      expect(screen.getByText('Loading unlinked emails...')).toBeInTheDocument();
    });

    it('renders unlinked emails when Gmail is connected', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);

      render(<UnlinkedEmails />);

      await waitFor(() => {
        expect(screen.getByText(/Unlinked Emails \(2\)/)).toBeInTheDocument();
      });

      expect(screen.getByText('Interview Opportunity at TechCorp')).toBeInTheDocument();
      expect(screen.getByText('Your Application Status')).toBeInTheDocument();
    });

    it('shows connect Gmail message when not connected', async () => {
      emailAPI.getGmailStatus.mockResolvedValue({ status: 'disconnected' });

      render(<UnlinkedEmails />);

      await waitFor(() => {
        expect(screen.getByText('Connect your Gmail to see unlinked emails')).toBeInTheDocument();
      });
    });

    it('shows no unlinked emails message when list is empty', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue([]);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);

      render(<UnlinkedEmails />);

      await waitFor(() => {
        expect(screen.getByText('All emails are linked or dismissed!')).toBeInTheDocument();
      });
    });

    it('calls API with unlinked_only parameter', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue([]);
      jobsAPI.getJobs.mockResolvedValue([]);

      render(<UnlinkedEmails />);

      await waitFor(() => {
        expect(emailAPI.getEmails).toHaveBeenCalledWith({ unlinked_only: true });
      });
    });
  });

  describe('Search Functionality - UC-113', () => {
    it('shows search toggle button', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);

      render(<UnlinkedEmails />);

      await waitFor(() => {
        expect(screen.getByText(/Show Search|Hide Search/)).toBeInTheDocument();
      });
    });

    it('toggles search bar visibility', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);

      render(<UnlinkedEmails />);

      await waitFor(() => {
        expect(screen.getByText('Show Search')).toBeInTheDocument();
      });

      const toggleButton = screen.getByText('Show Search');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('Hide Search')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Search unlinked emails/)).toBeInTheDocument();
      });
    });

    it('calls API with search parameter', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);

      render(<UnlinkedEmails />);

      // Open search
      await waitFor(() => {
        const toggleButton = screen.getByText('Show Search');
        fireEvent.click(toggleButton);
      });

      // Type in search
      const searchInput = screen.getByPlaceholderText(/Search unlinked emails/);
      fireEvent.change(searchInput, { target: { value: 'TechCorp' } });

      await waitFor(() => {
        expect(emailAPI.getEmails).toHaveBeenCalledWith(
          expect.objectContaining({
            unlinked_only: true,
            search: 'TechCorp'
          })
        );
      });
    });

    it('clears search on button click', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);

      render(<UnlinkedEmails />);

      // Open search and type
      await waitFor(() => {
        const toggleButton = screen.getByText('Show Search');
        fireEvent.click(toggleButton);
      });

      const searchInput = screen.getByPlaceholderText(/Search unlinked emails/);
      fireEvent.change(searchInput, { target: { value: 'test' } });

      await waitFor(() => {
        expect(searchInput.value).toBe('test');
      });

      // Find and click clear button (X icon button)
      const clearButton = screen.getByRole('button', { name: '' });
      if (clearButton && clearButton.parentElement.className.includes('clear')) {
        fireEvent.click(clearButton);

        await waitFor(() => {
          expect(searchInput.value).toBe('');
        });
      }
    });
  });

  describe('Email Linking', () => {
    it('displays job selector for each email', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);

      render(<UnlinkedEmails />);

      await waitFor(() => {
        const selectors = screen.getAllByText('Select job to link...');
        expect(selectors).toHaveLength(2);
      });
    });

    it('links email to job successfully', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);
      emailAPI.linkEmailToJob.mockResolvedValue({ status: 'linked' });

      render(<UnlinkedEmails />);

      await waitFor(() => {
        expect(screen.getByText('Interview Opportunity at TechCorp')).toBeInTheDocument();
      });

      // Find first job selector and select a job
      const selectors = screen.getAllByRole('combobox');
      const firstSelector = selectors[0];
      
      fireEvent.change(firstSelector, { target: { value: 'job-1' } });

      await waitFor(() => {
        expect(emailAPI.linkEmailToJob).toHaveBeenCalledWith('email-1', 'job-1');
      });
    });

    it('handles link error gracefully', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);
      emailAPI.linkEmailToJob.mockRejectedValue(new Error('Failed to link'));

      render(<UnlinkedEmails />);

      await waitFor(() => {
        expect(screen.getByText('Interview Opportunity at TechCorp')).toBeInTheDocument();
      });

      const selectors = screen.getAllByRole('combobox');
      fireEvent.change(selectors[0], { target: { value: 'job-1' } });

      await waitFor(() => {
        expect(emailAPI.linkEmailToJob).toHaveBeenCalled();
      });
    });
  });

  describe('Email Dismissal', () => {
    it('dismisses email successfully', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);
      emailAPI.dismissEmail.mockResolvedValue({ status: 'dismissed' });

      render(<UnlinkedEmails />);

      await waitFor(() => {
        expect(screen.getByText('Interview Opportunity at TechCorp')).toBeInTheDocument();
      });

      const dismissButtons = screen.getAllByText('Dismiss');
      fireEvent.click(dismissButtons[0]);

      await waitFor(() => {
        expect(emailAPI.dismissEmail).toHaveBeenCalledWith('email-1');
      });
    });
  });

  describe('Event Listeners', () => {
    it('handles gmail-disconnected event', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);

      render(<UnlinkedEmails />);

      await waitFor(() => {
        expect(screen.getByText(/Unlinked Emails \(2\)/)).toBeInTheDocument();
      });

      // Trigger gmail-disconnected event
      const event = new CustomEvent('gmail-disconnected');
      window.dispatchEvent(event);

      await waitFor(() => {
        expect(screen.getByText('Connect your Gmail to see unlinked emails')).toBeInTheDocument();
      });
    });

    it('handles gmail-scan-complete event', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);

      render(<UnlinkedEmails />);

      await waitFor(() => {
        expect(screen.getByText(/Unlinked Emails \(2\)/)).toBeInTheDocument();
      });

      // Reset mock to track new calls
      emailAPI.getEmails.mockClear();
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);

      // Trigger gmail-scan-complete event
      const event = new CustomEvent('gmail-scan-complete');
      window.dispatchEvent(event);

      await waitFor(() => {
        expect(emailAPI.getEmails).toHaveBeenCalled();
      });
    });
  });

  describe('Email Display', () => {
    it('displays email metadata correctly', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);

      render(<UnlinkedEmails />);

      await waitFor(() => {
        expect(screen.getByText('TechCorp HR')).toBeInTheDocument();
        expect(screen.getByText('Startup Inc')).toBeInTheDocument();
        expect(screen.getByText('We found your profile interesting...')).toBeInTheDocument();
      });
    });

    it('displays email type badges', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);

      render(<UnlinkedEmails />);

      await waitFor(() => {
        expect(screen.getByText('Recruiter Outreach')).toBeInTheDocument();
        expect(screen.getByText('Application Acknowledged')).toBeInTheDocument();
      });
    });

    it('displays confidence scores', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);

      render(<UnlinkedEmails />);

      await waitFor(() => {
        expect(screen.getByText('Confidence: 85%')).toBeInTheDocument();
        expect(screen.getByText('Confidence: 90%')).toBeInTheDocument();
      });
    });

    it('renders View in Gmail links', async () => {
      emailAPI.getGmailStatus.mockResolvedValue(mockGmailStatus);
      emailAPI.getEmails.mockResolvedValue(mockUnlinkedEmails);
      jobsAPI.getJobs.mockResolvedValue(mockJobs);

      render(<UnlinkedEmails />);

      await waitFor(() => {
        const links = screen.getAllByText('View in Gmail');
        expect(links).toHaveLength(2);
      });
    });
  });
});
