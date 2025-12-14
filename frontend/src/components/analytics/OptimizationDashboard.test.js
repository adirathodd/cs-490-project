import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../services/api', () => ({
  __esModule: true,
  jobsAPI: {
    getOptimizationInsights: jest.fn(),
  },
}));

jest.mock('../common/Icon', () => ({
  __esModule: true,
  default: ({ name, children, style }) => (
    <span data-testid={`icon-${name}`} style={style}>
      {children || name}
    </span>
  ),
}));

const { jobsAPI } = require('../../services/api');

import OptimizationDashboard from './OptimizationDashboard';

describe('OptimizationDashboard', () => {
  const payload = {
    success_metrics: {
      response_rate: 42,
      interview_rate: 28,
      offer_rate: 12,
      total_applications: 30,
      applied: 20,
    },
    materials_performance: {
      resume_versions: [
        { document_id: '1', label: 'Resume A', applications: 8, response_rate: 60, interview_rate: 40, offer_rate: 25 },
      ],
      cover_letters: [
        { document_id: '2', label: 'Cover Letter B', applications: 5, response_rate: 55, interview_rate: 30, offer_rate: 10 },
      ],
    },
    approach_effectiveness: {
      by_method: [
        { code: 'direct_contact', label: 'Direct Contact', applications: 6, response_rate: 70, interview_rate: 50, offer_rate: 30 },
        { code: 'online', label: 'Online Forms', applications: 10, response_rate: 40, interview_rate: 20, offer_rate: 5 },
      ],
      by_source: [
        { code: 'referral', label: 'Referral', applications: 4, response_rate: 80, interview_rate: 60, offer_rate: 35 },
      ],
      top_method: { code: 'direct_contact', label: 'Direct Contact', response_rate: 70, offer_rate: 30 },
      top_source: { code: 'referral', label: 'Referral', response_rate: 80, offer_rate: 35 },
    },
    timing_insights: {
      best_day: { day: 'Tuesday', offer_rate: 30 },
      best_time: { time_slot: 'morning', offer_rate: 22 },
      by_day_of_week: [
        { day: 'Tuesday', offer_rate: 30 },
        { day: 'Thursday', offer_rate: 20 },
      ],
      by_time_of_day: [
        { time_slot: 'morning', response_rate: 50 },
        { time_slot: 'afternoon', response_rate: 20 },
      ],
    },
    role_fit: {
      job_types: [
        { code: 'ft', label: 'Full-time', response_rate: 50 },
      ],
      industries: [
        { industry: 'Tech', offer_rate: 25 },
      ],
    },
    recommendations: [
      { type: 'high_impact', category: 'customization', message: 'Customize your resume.' },
    ],
    experiments: [
      {
        id: 'resume',
        title: 'Resume A/B',
        winner: 'Resume A',
        variants: [
          { label: 'Resume A', applications: 4, offer_rate: 30, response_rate: 60 },
          { label: 'Resume B', applications: 4, offer_rate: 15, response_rate: 45 },
        ],
        insight: 'Resume A is outperforming B.',
      },
    ],
    trend: {
      success_trend: [
        { month: '2025-01-01', offer_rate: 10, response_rate: 30 },
        { month: '2025-02-01', offer_rate: 12, response_rate: 32 },
      ],
      offer_rate_change: 2,
      response_rate_change: 2,
      momentum: 'up',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jobsAPI.getOptimizationInsights = jest.fn().mockResolvedValue(payload);
  });

  test('renders dashboard with key sections', async () => {
    render(<OptimizationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Optimization Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Success Metrics')).toBeInTheDocument();
    expect(screen.getByText('Materials Performance')).toBeInTheDocument();
    expect(screen.getByText('Experiments & A/B Tests')).toBeInTheDocument();
    expect(screen.getByText('Actionable Recommendations')).toBeInTheDocument();
  });

  test('shows error state when API call fails', async () => {
    jobsAPI.getOptimizationInsights.mockRejectedValueOnce(new Error('boom'));

    render(<OptimizationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load optimization insights right now.')).toBeInTheDocument();
    });
  });
});
