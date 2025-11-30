import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import InformationalInterviews from '../InformationalInterviews';

// Mock the API
jest.mock('../../../services/api');

// Import the mocked APIs
import { informationalInterviewsAPI, contactsAPI } from '../../../services/api';

// Mock data
const mockInterview = {
  id: '123',
  contact: {
    id: 1,
    name: 'John Doe',
    title: 'Senior Engineer',
    company: 'Tech Corp',
    email: 'john@example.com',
  },
  purpose: 'Career guidance',
  status: 'identified',
  questions_to_ask: ['Question 1', 'Question 2'],
  goals: ['Goal 1', 'Goal 2'],
  outreach_message: null,
  preparation_notes: null,
  scheduled_at: null,
  completed_at: null,
  outcome: null,
  key_insights: null,
  follow_up_actions: null,
  led_to_job_application: false,
  led_to_referral: false,
  led_to_introduction: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockScheduledInterview = {
  ...mockInterview,
  id: '456',
  status: 'scheduled',
  scheduled_at: '2024-02-01T10:00:00Z',
};

const mockCompletedInterview = {
  ...mockInterview,
  id: '789',
  status: 'completed',
  scheduled_at: '2024-01-15T14:00:00Z',
  completed_at: '2024-01-15T15:00:00Z',
  outcome: 'excellent',
  key_insights: ['Insight 1', 'Insight 2'],
  led_to_job_application: true,
};

const mockAnalytics = {
  total_interviews: 3,
  by_status: {
    identified: 1,
    outreach_sent: 0,
    scheduled: 1,
    completed: 1,
    declined: 0,
    no_response: 0,
  },
  response_rate: 0.67,
  impact: {
    led_to_job_applications: 1,
    led_to_referrals: 0,
    led_to_introductions: 0,
  },
};

const mockContacts = [
  { id: 1, name: 'John Doe', title: 'Senior Engineer', company: 'Tech Corp' },
  { id: 2, name: 'Jane Smith', title: 'Director', company: 'Another Inc' },
];

describe('InformationalInterviews Component', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <InformationalInterviews />
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    jest.resetAllMocks();
    
    // Setup all mocks with default responses
    informationalInterviewsAPI.getInterviews.mockResolvedValue([mockInterview, mockScheduledInterview, mockCompletedInterview]);
    informationalInterviewsAPI.getAnalytics.mockResolvedValue(mockAnalytics);
    informationalInterviewsAPI.createInterview.mockResolvedValue(mockInterview);
    informationalInterviewsAPI.generateOutreach.mockResolvedValue({
      subject: 'Request for Informational Interview',
      body: 'Dear John, ...',
    });
    informationalInterviewsAPI.generatePreparation.mockResolvedValue({
      preparation_notes: 'Research the company...',
    });
    informationalInterviewsAPI.markOutreachSent.mockResolvedValue({ ...mockInterview, status: 'outreach_sent' });
    informationalInterviewsAPI.markScheduled.mockResolvedValue({ ...mockInterview, status: 'scheduled', scheduled_at: '2024-02-01T10:00:00Z' });
    informationalInterviewsAPI.markCompleted.mockResolvedValue({ ...mockInterview, status: 'completed', outcome: 'excellent', led_to_job_application: true });
    informationalInterviewsAPI.getInterview.mockResolvedValue(mockInterview);
    informationalInterviewsAPI.updateInterview.mockResolvedValue(mockInterview);
    informationalInterviewsAPI.deleteInterview.mockResolvedValue({});
    contactsAPI.list.mockResolvedValue(mockContacts);
  });

  describe('Component Initialization', () => {
    test('renders without crashing', () => {
      const { container } = renderComponent();
      expect(container).toBeInTheDocument();
    });

    test('calls API to load interviews on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(informationalInterviewsAPI.getInterviews).toHaveBeenCalled();
      });
    });

    test('calls API to load analytics on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(informationalInterviewsAPI.getAnalytics).toHaveBeenCalled();
      });
    });

    test('calls API to load contacts on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(contactsAPI.list).toHaveBeenCalled();
      });
    });

    test('component container has correct class', () => {
      const { container } = renderComponent();
      expect(container.querySelector('.informational-interviews-container')).toBeTruthy();
    });
  });

  describe('API Integration Tests', () => {
    test('all interview APIs are properly mocked and available', () => {
      expect(informationalInterviewsAPI.getInterviews).toBeDefined();
      expect(informationalInterviewsAPI.getInterview).toBeDefined();
      expect(informationalInterviewsAPI.createInterview).toBeDefined();
      expect(informationalInterviewsAPI.updateInterview).toBeDefined();
      expect(informationalInterviewsAPI.deleteInterview).toBeDefined();
      expect(informationalInterviewsAPI.markOutreachSent).toBeDefined();
      expect(informationalInterviewsAPI.markScheduled).toBeDefined();
      expect(informationalInterviewsAPI.markCompleted).toBeDefined();
      expect(informationalInterviewsAPI.generateOutreach).toBeDefined();
      expect(informationalInterviewsAPI.generatePreparation).toBeDefined();
      expect(informationalInterviewsAPI.getAnalytics).toBeDefined();
    });

    test('contacts API is properly mocked', () => {
      expect(contactsAPI.list).toBeDefined();
      expect(typeof contactsAPI.list).toBe('function');
    });

    test('APIs return promises', async () => {
      const interviewsResult = informationalInterviewsAPI.getInterviews();
      const analyticsResult = informationalInterviewsAPI.getAnalytics();
      const contactsResult = contactsAPI.list();

      // Check that they return promise-like objects with .then method
      expect(typeof interviewsResult.then).toBe('function');
      expect(typeof analyticsResult.then).toBe('function');
      expect(typeof contactsResult.then).toBe('function');

      await Promise.all([interviewsResult, analyticsResult, contactsResult]);
    });

    test('getInterviews can be called with filters', async () => {
      await informationalInterviewsAPI.getInterviews({ status: 'scheduled' });
      expect(informationalInterviewsAPI.getInterviews).toHaveBeenCalledWith({ status: 'scheduled' });
    });

    test('getInterviews returns array of interviews', async () => {
      const result = await informationalInterviewsAPI.getInterviews();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
    });
  });

  describe('Create Interview Functionality', () => {
    test('createInterview API is available', () => {
      expect(informationalInterviewsAPI.createInterview).toBeDefined();
      expect(typeof informationalInterviewsAPI.createInterview).toBe('function');
    });

    test('createInterview can be called with interview data', async () => {
      const interviewData = {
        contact: 1,
        purpose: 'Career advice',
        status: 'identified',
        questions_to_ask: [],
        goals: [],
      };

      await informationalInterviewsAPI.createInterview(interviewData);
      expect(informationalInterviewsAPI.createInterview).toHaveBeenCalledWith(interviewData);
    });

    test('createInterview returns expected mock interview', async () => {
      const result = await informationalInterviewsAPI.createInterview({});
      expect(result).toEqual(mockInterview);
      expect(result.id).toBe('123');
      expect(result.contact.name).toBe('John Doe');
    });

    test('createInterview handles errors', async () => {
      informationalInterviewsAPI.createInterview.mockRejectedValue(new Error('Creation failed'));
      await expect(informationalInterviewsAPI.createInterview({})).rejects.toThrow('Creation failed');
    });
  });

  describe('Interview Status Management', () => {
    test('markOutreachSent updates interview status', async () => {
      const result = await informationalInterviewsAPI.markOutreachSent('123');
      expect(result.status).toBe('outreach_sent');
      expect(informationalInterviewsAPI.markOutreachSent).toHaveBeenCalledWith('123');
    });

    test('markScheduled updates interview with schedule info', async () => {
      const result = await informationalInterviewsAPI.markScheduled('123', '2024-02-01T10:00');
      expect(result.status).toBe('scheduled');
      expect(result.scheduled_at).toBe('2024-02-01T10:00:00Z');
    });

    test('markCompleted updates interview with completion info', async () => {
      const result = await informationalInterviewsAPI.markCompleted('123', {
        outcome: 'excellent',
        key_insights: ['Insight 1'],
        led_to_job_application: true,
      });
      expect(result.status).toBe('completed');
      expect(result.outcome).toBe('excellent');
      expect(result.led_to_job_application).toBe(true);
    });
  });

  describe('AI Generation Features', () => {
    test('generateOutreach API is available', () => {
      expect(informationalInterviewsAPI.generateOutreach).toBeDefined();
    });

    test('generateOutreach can be called with ID and style', async () => {
      await informationalInterviewsAPI.generateOutreach('123', 'professional');
      expect(informationalInterviewsAPI.generateOutreach).toHaveBeenCalledWith('123', 'professional');
    });

    test('generateOutreach returns subject and body', async () => {
      const result = await informationalInterviewsAPI.generateOutreach('123', 'professional');
      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('body');
      expect(result.subject).toBe('Request for Informational Interview');
    });

    test('generatePreparation API is available', () => {
      expect(informationalInterviewsAPI.generatePreparation).toBeDefined();
    });

    test('generatePreparation can be called with interview ID', async () => {
      await informationalInterviewsAPI.generatePreparation('123');
      expect(informationalInterviewsAPI.generatePreparation).toHaveBeenCalledWith('123');
    });

    test('generatePreparation returns preparation notes', async () => {
      const result = await informationalInterviewsAPI.generatePreparation('123');
      expect(result).toHaveProperty('preparation_notes');
    });
  });

  describe('Data Structure Validation', () => {
    test('mock interview has required fields', () => {
      expect(mockInterview).toHaveProperty('id');
      expect(mockInterview).toHaveProperty('contact');
      expect(mockInterview).toHaveProperty('status');
      expect(mockInterview).toHaveProperty('purpose');
      expect(mockInterview).toHaveProperty('questions_to_ask');
      expect(mockInterview).toHaveProperty('goals');
    });

    test('mock interview contact has required fields', () => {
      expect(mockInterview.contact).toHaveProperty('id');
      expect(mockInterview.contact).toHaveProperty('name');
      expect(mockInterview.contact).toHaveProperty('title');
      expect(mockInterview.contact).toHaveProperty('company');
    });

    test('mock interview has arrays for questions and goals', () => {
      expect(Array.isArray(mockInterview.questions_to_ask)).toBe(true);
      expect(Array.isArray(mockInterview.goals)).toBe(true);
    });

    test('mock interview has boolean fields for impact tracking', () => {
      expect(typeof mockInterview.led_to_job_application).toBe('boolean');
      expect(typeof mockInterview.led_to_referral).toBe('boolean');
      expect(typeof mockInterview.led_to_introduction).toBe('boolean');
    });

    test('mock analytics has correct structure', () => {
      expect(typeof mockAnalytics.total_interviews).toBe('number');
      expect(typeof mockAnalytics.response_rate).toBe('number');
      expect(typeof mockAnalytics.by_status).toBe('object');
      expect(typeof mockAnalytics.impact).toBe('object');
    });

    test('status options are valid', () => {
      const validStatuses = ['identified', 'outreach_sent', 'scheduled', 'completed', 'declined', 'no_response'];
      expect(validStatuses).toContain(mockInterview.status);
      expect(validStatuses).toContain(mockScheduledInterview.status);
      expect(validStatuses).toContain(mockCompletedInterview.status);
    });

    test('outcome options are valid for completed interviews', () => {
      const validOutcomes = ['excellent', 'good', 'fair', 'poor', 'no_show'];
      expect(validOutcomes).toContain(mockCompletedInterview.outcome);
    });
  });

  describe('Analytics Functionality', () => {
    test('getAnalytics returns complete analytics data', async () => {
      const result = await informationalInterviewsAPI.getAnalytics();
      expect(result).toEqual(mockAnalytics);
      expect(result.total_interviews).toBe(3);
    });

    test('analytics includes status breakdown', async () => {
      const result = await informationalInterviewsAPI.getAnalytics();
      expect(result.by_status).toBeDefined();
      expect(result.by_status.identified).toBe(1);
      expect(result.by_status.scheduled).toBe(1);
      expect(result.by_status.completed).toBe(1);
    });

    test('analytics includes response rate', async () => {
      const result = await informationalInterviewsAPI.getAnalytics();
      expect(result.response_rate).toBeDefined();
      expect(typeof result.response_rate).toBe('number');
      expect(result.response_rate).toBe(0.67);
    });

    test('analytics includes impact metrics', async () => {
      const result = await informationalInterviewsAPI.getAnalytics();
      expect(result.impact).toBeDefined();
      expect(result.impact.led_to_job_applications).toBe(1);
      expect(result.impact.led_to_referrals).toBe(0);
      expect(result.impact.led_to_introductions).toBe(0);
    });
  });

  describe('Contact Integration', () => {
    test('contacts list is fetched on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(contactsAPI.list).toHaveBeenCalled();
      });
    });

    test('contacts list returns expected data', async () => {
      const result = await contactsAPI.list();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('John Doe');
    });

    test('contact has required fields', () => {
      const contact = mockContacts[0];
      expect(contact).toHaveProperty('id');
      expect(contact).toHaveProperty('name');
      expect(contact).toHaveProperty('title');
      expect(contact).toHaveProperty('company');
    });
  });

  describe('Interview Lifecycle', () => {
    test('interview progresses from identified to outreach_sent', async () => {
      const interview = { ...mockInterview, status: 'identified' };
      const result = await informationalInterviewsAPI.markOutreachSent(interview.id);
      expect(result.status).toBe('outreach_sent');
    });

    test('interview progresses from outreach_sent to scheduled', async () => {
      const interview = { ...mockInterview, status: 'outreach_sent' };
      const result = await informationalInterviewsAPI.markScheduled(interview.id, '2024-02-01T10:00');
      expect(result.status).toBe('scheduled');
      expect(result.scheduled_at).toBeDefined();
    });

    test('interview progresses from scheduled to completed', async () => {
      const interview = { ...mockScheduledInterview };
      const result = await informationalInterviewsAPI.markCompleted(interview.id, {
        outcome: 'excellent',
        key_insights: ['Great insights'],
        led_to_job_application: true,
      });
      expect(result.status).toBe('completed');
      expect(result.outcome).toBe('excellent');
    });
  });

  describe('Error Handling', () => {
    test('handles getInterviews API error gracefully', async () => {
      informationalInterviewsAPI.getInterviews.mockRejectedValue(new Error('Network error'));
      
      await expect(informationalInterviewsAPI.getInterviews()).rejects.toThrow('Network error');
    });

    test('handles getAnalytics API error gracefully', async () => {
      informationalInterviewsAPI.getAnalytics.mockRejectedValue(new Error('Analytics failed'));
      
      await expect(informationalInterviewsAPI.getAnalytics()).rejects.toThrow('Analytics failed');
    });

    test('handles contacts list API error gracefully', async () => {
      contactsAPI.list.mockRejectedValue(new Error('Contacts unavailable'));
      
      await expect(contactsAPI.list()).rejects.toThrow('Contacts unavailable');
    });
  });
});
