import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../services/api', () => ({
  interviewsAPI: {
    getPerformanceAnalytics: jest.fn(),
  },
}));

jest.mock('../common/Icon', () => ({
  __esModule: true,
  default: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

const { interviewsAPI } = require('../../services/api');

import InterviewPerformanceAnalytics from './InterviewPerformanceAnalytics';

const sampleAnalytics = {
  summary: {
    interview_to_offer_rate: 50,
    offers_won: 2,
    unique_processes: 4,
    avg_interviews_per_offer: 2,
    readiness_signal: 82.5,
    recent_completed: 3,
  },
  company_type_trends: [
    {
      company_type: 'Tech',
      interviews: 5,
      unique_processes: 3,
      offers: 2,
      conversion_rate: 66.7,
      avg_outcome_score: 0.8,
    },
  ],
  format_performance: [
    {
      interview_type: 'video',
      label: 'Video Interview',
      interviews: 4,
      unique_processes: 3,
      avg_duration: 45,
      offers: 2,
      conversion_rate: 66.7,
      avg_outcome_score: 0.85,
    },
  ],
  preparation_areas: {
    areas: [
      { category: 'Company Research', completion_rate: 92, success_rate: 60, total_tasks: 10 },
    ],
    strongest: { category: 'Company Research', completion_rate: 92, success_rate: 60 },
    weakest: { category: 'Logistics', completion_rate: 50, success_rate: 20 },
  },
  practice_impact: {
    summary: {
      jobs_with_practice: 2,
      avg_sessions_per_job: 3,
      avg_score: 78,
      sessions_leading_to_offers: 4,
      sessions_without_offers: 1,
    },
    skill_focus: { coding: 3, system_design: 1 },
    timeline_overlay: { '2025-10': { sessions: 2, avg_score: 80 } },
  },
  timeline: {
    monthly: [
      { month: '2025-09', interviews: 2, offers: 0, avg_outcome_score: 0.6 },
      { month: '2025-10', interviews: 3, offers: 2, avg_outcome_score: 0.9, practice_sessions: 2 },
    ],
    outcome_trend_delta: 0.3,
  },
  benchmarks: {
    industry_interview_to_offer_rate: 35,
    candidate_interview_to_offer_rate: 50,
    industry_avg_rounds_per_offer: 3,
    candidate_avg_rounds_per_offer: 2,
    industry_sample_size: 120,
    practice_sessions_per_offer: 3,
  },
  insights: {
    insights: [{ headline: 'Video interviews convert best', detail: 'Keep prioritizing them.' }],
    recommendations: ['Increase logistics checklist completion.'],
  },
  ai_recommendations: {
    executive_summary: 'Focus on keeping momentum with technical interviews.',
    priority_actions: ['Schedule more mock interviews'],
    confidence_boosters: ['Interview prep is trending upward'],
  },
};

describe('InterviewPerformanceAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows loading state before analytics resolve', () => {
    interviewsAPI.getPerformanceAnalytics.mockImplementation(() => new Promise(() => {}));
    render(<InterviewPerformanceAnalytics />);
    expect(screen.getByText(/Crunching interview performance metrics/i)).toBeInTheDocument();
  });

  test('renders analytics data when API succeeds', async () => {
    interviewsAPI.getPerformanceAnalytics.mockResolvedValue(sampleAnalytics);
    await act(async () => {
      render(<InterviewPerformanceAnalytics />);
    });

    await waitFor(() => expect(screen.getByText(/Interview Performance Analytics/i)).toBeInTheDocument());

    const heroLabel = screen.getAllByText(/Interview → Offer/i)[0];
    expect(heroLabel.nextSibling.textContent).toContain('50.0%');
    expect(screen.getByText(/Companies Responding Best/i)).toBeInTheDocument();
    expect(screen.getByText('Tech')).toBeInTheDocument();
    expect(screen.getByText(/Format Performance/i)).toBeInTheDocument();
    const formatLabels = screen.getAllByText(/Video Interview/i);
    expect(formatLabels.length).toBeGreaterThan(0);
    expect(screen.getByText(/Gemini Coaching Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Focus on keeping momentum/i)).toBeInTheDocument();
  });

  test('shows error state when API fails', async () => {
    interviewsAPI.getPerformanceAnalytics.mockRejectedValue(new Error('boom'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      render(<InterviewPerformanceAnalytics />);
    });

    await waitFor(() => expect(screen.getByText(/Unable to load interview analytics/i)).toBeInTheDocument());
    errorSpy.mockRestore();
  });
});
