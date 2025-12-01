import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { act } from 'react-dom/test-utils';

// Mock API before any imports
jest.mock('../../../services/api', () => ({
  informationalInterviewsAPI: {
    getInterviews: jest.fn(() => Promise.resolve([])),
    getAnalytics: jest.fn(() => Promise.resolve({ 
      total_interviews: 0, 
      by_status: {}, 
      response_rate: 0, 
      avg_relationship_strength: 0, 
      impact: {} 
    })),
    getInterview: jest.fn(),
    createInterview: jest.fn(),
    updateInterview: jest.fn(),
    deleteInterview: jest.fn(),
    markOutreachSent: jest.fn(),
    markScheduled: jest.fn(),
    markCompleted: jest.fn(),
    generateOutreach: jest.fn(),
    generatePreparation: jest.fn(),
  },
  contactsAPI: {
    list: jest.fn(() => Promise.resolve([])),
  },
}));

const InformationalInterviews = require('../InformationalInterviews').default;

describe('UC-090 Informational Interviews - Basic Verification', () => {
  test('Page renders with title and subtitle', async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <InformationalInterviews />
        </BrowserRouter>
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('Loading informational interviews...')).not.toBeInTheDocument();
    });
    
    expect(screen.getByText('Informational Interviews')).toBeInTheDocument();
    expect(screen.getByText(/Request and manage informational interviews/)).toBeInTheDocument();
  });

  test('Page has create button', async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <InformationalInterviews />
        </BrowserRouter>
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('Loading informational interviews...')).not.toBeInTheDocument();
    });
    
    expect(screen.getByText(/New Interview Request/i)).toBeInTheDocument();
  });

  test('Page has all filter tabs', async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <InformationalInterviews />
        </BrowserRouter>
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('Loading informational interviews...')).not.toBeInTheDocument();
    });
    
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Identified')).toBeInTheDocument();
    expect(screen.getByText('Outreach Sent')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Declined')).toBeInTheDocument();
    expect(screen.getByText('No Response')).toBeInTheDocument();
  });
});
