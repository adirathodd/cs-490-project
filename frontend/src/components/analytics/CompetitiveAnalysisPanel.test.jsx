import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Recharts to avoid jsdom issues during render
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  LineChart: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Line: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  CartesianGrid: () => null,
  PieChart: ({ children }) => <div>{children}</div>,
  Pie: () => null,
}));

// Mock Icon to keep markup simple
jest.mock('../common/Icon', () => {
  return function Icon({ name, ...rest }) {
    return (
      <span data-testid={`icon-${name}`} {...rest}>
        {name}
      </span>
    );
  };
});

import CompetitiveAnalysisPanel from './CompetitiveAnalysisPanel';

describe('CompetitiveAnalysisPanel', () => {
  const mockAnalytics = {
    metrics: {
      your_success_rate: 35,
      industry_average: 15,
      total_candidates: 120,
    },
    deltas: {
      success_rate_delta: 20,
    },
    employment: {
      employed_percentage: 62,
      industries: [
        { name: 'Software', percentage: 45 },
        { name: 'Finance', percentage: 20 },
      ],
    },
    progression: {
      average_steps_to_offer: 5,
    },
    skills: [
      { name: 'JavaScript', match_score: 80 },
      { name: 'React', match_score: 70 },
    ],
    recommendations: [
      'Increase targeted applications to companies with higher industry fit',
      'Add more technical projects to portfolio',
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows metrics, deltas, employment, progression, skills, and recommendations', async () => {
    render(<CompetitiveAnalysisPanel analytics={mockAnalytics} />);

    await waitFor(() => {
      expect(screen.getByText(/your success rate/i)).toBeInTheDocument();
      expect(screen.getByText(/industry average/i)).toBeInTheDocument();
      expect(screen.getByText(/20%/i)).toBeInTheDocument();
      expect(screen.getByText(/employment/i)).toBeInTheDocument();
      expect(screen.getByText(/software/i)).toBeInTheDocument();
      expect(screen.getByText(/progression/i)).toBeInTheDocument();
      expect(screen.getByText(/javascript/i)).toBeInTheDocument();
      expect(screen.getByText(/react/i)).toBeInTheDocument();
      expect(screen.getByText(/increase targeted applications/i)).toBeInTheDocument();
    });
  });
});

