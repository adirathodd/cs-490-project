import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import SupporterPublic from '../SupporterPublic';

jest.mock('../../../services/api', () => ({
  supportersAPI: {
    fetchDashboard: jest.fn(),
    sendEncouragement: jest.fn(),
    fetchChat: jest.fn(),
    sendChat: jest.fn(),
  },
}));

import { supportersAPI } from '../../../services/api';

const dashboardPayload = {
  mentee: { name: 'Alex Candidate' },
  funnel_analytics: {
    status_breakdown: { phone_screen: 2, interview: 1, offer: 0 },
  },
  achievements: [
    { title: 'Alex received a Interview', description: 'Advanced', date: '2025-11-30', emoji: '🎙️' },
  ],
  practice_engagement: { total_sessions: 3 },
  encouragements: [],
  ai_recommendations: [
    'Send a short note of encouragement. Resource: https://example.com/resource',
  ],
  mood: { score: 7, note: 'Feeling okay' },
};

describe('SupporterPublic', () => {
  beforeEach(() => {
    supportersAPI.fetchDashboard.mockResolvedValue(dashboardPayload);
    supportersAPI.sendEncouragement.mockResolvedValue({});
    supportersAPI.fetchChat.mockResolvedValue([]);
    supportersAPI.sendChat.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders funnel, achievements, mood, and AI guidance', async () => {
    render(<SupporterPublic />);
    await waitFor(() => expect(supportersAPI.fetchDashboard).toHaveBeenCalled());

    expect(screen.getByText(/Application funnel/i)).toBeInTheDocument();
    expect(screen.getByText(/phone screen/i)).toBeInTheDocument();
    expect(screen.getByText(/Alex received a Interview/i)).toBeInTheDocument();
    expect(screen.getByText(/How they’re feeling/i)).toBeInTheDocument();
    expect(screen.getByText(/Score: 7/)).toBeInTheDocument();
    expect(screen.getByText(/How you can support/i)).toBeInTheDocument();
    // Linkified AI tip
    const link = screen.getByText('https://example.com/resource');
    expect(link).toHaveAttribute('href', 'https://example.com/resource');
  });
});
