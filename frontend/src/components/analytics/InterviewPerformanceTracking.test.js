import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InterviewPerformanceTracking from './InterviewPerformanceTracking';
import { interviewsAPI } from '../../services/api';

// Mock the API
jest.mock('../../services/api', () => ({
  interviewsAPI: {
    getPerformanceTracking: jest.fn(),
  },
}));

// Mock recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  LineChart: () => <div data-testid="line-chart">LineChart</div>,
  BarChart: () => <div data-testid="bar-chart">BarChart</div>,
  RadarChart: () => <div data-testid="radar-chart">RadarChart</div>,
  Line: () => null,
  Bar: () => null,
  Radar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  PolarGrid: () => null,
  PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null,
}));

// Mock Icon component
jest.mock('../common/Icon', () => {
  return function Icon({ name }) {
    return <span data-testid={`icon-${name}`}>{name}</span>;
  };
});

describe('InterviewPerformanceTracking', () => {
  const mockAnalysisData = {
    conversion_rates_over_time: [
      { period: '2024-10-01', conversion_rate: 30, rejection_rate: 70 },
      { period: '2024-11-01', conversion_rate: 35, rejection_rate: 65 },
    ],
    performance_by_format: [
      {
        format_label: 'Phone Screen',
        total_interviews: 5,
        conversion_rate: 40,
        avg_confidence: 4.0,
      },
      {
        format_label: 'Technical',
        total_interviews: 3,
        conversion_rate: 33,
        avg_confidence: 3.5,
      },
    ],
    mock_to_real_improvement: {
      total_mock_sessions: 10,
      total_real_interviews: 8,
      mock_average_score: 75,
      real_average_score: 80,
      improvement_trend: 5,
    },
    performance_by_industry: [
      { industry: 'Technology', conversion_rate: 35, avg_confidence: 4.2 },
      { industry: 'Finance', conversion_rate: 25, avg_confidence: 3.8 },
    ],
    feedback_themes: {
      improvement_areas: [
        { area: 'Clarity', percentage: 40 },
        { area: 'Structure', percentage: 30 },
      ],
      positive_themes: [
        { theme: 'Strong technical knowledge' },
        { theme: 'Good communication' },
      ],
    },
    confidence_progression: {
      current_avg_confidence: 4.2,
      previous_avg_confidence: 3.8,
      trend_percentage: 10.5,
      confidence_progression: [
        {
          date: '2024-11-28',
          interview_type: 'phone_screen',
          confidence_level: 4,
          outcome: 'offer_received',
        },
        {
          date: '2024-11-25',
          interview_type: 'technical',
          confidence_level: 5,
          outcome: 'rejected',
        },
      ],
    },
    coaching_recommendations: [
      {
        area: 'practice',
        priority: 'high',
        recommendation: 'Increase mock interview frequency',
        action_items: ['Schedule 2 mock interviews per week', 'Practice common questions'],
      },
      {
        area: 'format',
        priority: 'medium',
        recommendation: 'Improve technical interview performance',
        action_items: ['Focus on coding practice and system design', 'Review data structures'],
      },
    ],
    benchmark_comparison: {
      conversion_rate: {
        user: 35,
        average: 25,
        top_performers: 40,
        },
      conversion_rate: {
        user: 35,
        average: 25,
        top_performers: 40,
      },
      mock_average_score: {
        user: 75,
        average: 65,
        top_performers: 80,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading state initially', () => {
    interviewsAPI.getPerformanceTracking.mockImplementation(() => new Promise(() => {}));
    render(<InterviewPerformanceTracking />);
    expect(screen.getByText(/Loading interview performance tracking/i)).toBeInTheDocument();
  });

  test('renders error state when API call fails', async () => {
    interviewsAPI.getPerformanceTracking.mockRejectedValue(new Error('API Error'));

    render(<InterviewPerformanceTracking />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load interview performance tracking/i)).toBeInTheDocument();
    });
  });

  test('renders empty state when no data is available', async () => {
    interviewsAPI.getPerformanceTracking.mockResolvedValue(null);

    render(<InterviewPerformanceTracking />);

    await waitFor(() => {
      expect(
        screen.getByText(/No interview data available. Start tracking your interviews to see performance insights!/i)
      ).toBeInTheDocument();
    });
  });

  test('renders all sections with complete data', async () => {
    interviewsAPI.getPerformanceTracking.mockResolvedValue(mockAnalysisData);

    render(<InterviewPerformanceTracking />);

    // Wait for the data to load first
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Personalized Coaching Recommendations/i })).toBeInTheDocument();
    });

    // Check main sections are rendered using more specific queries
    expect(screen.getByRole('heading', { name: /Performance Benchmarking/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Interview Success Rate Trends/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Performance by Interview Format/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Practice to Performance Journey/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Performance by Industry/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Common Feedback Themes/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Confidence Progression/i })).toBeInTheDocument();
  });

  test('displays coaching recommendations with correct priorities', async () => {
    interviewsAPI.getPerformanceTracking.mockResolvedValue(mockAnalysisData);

    render(<InterviewPerformanceTracking />);

    await waitFor(() => {
      expect(screen.getByText(/Increase mock interview frequency/i)).toBeInTheDocument();
      expect(screen.getByText(/Improve technical interview performance/i)).toBeInTheDocument();
    });

    // Check priority labels
    expect(screen.getByText(/high priority/i)).toBeInTheDocument();
    expect(screen.getByText(/medium priority/i)).toBeInTheDocument();
  });

  test('displays performance by format table', async () => {
    interviewsAPI.getPerformanceTracking.mockResolvedValue(mockAnalysisData);

    render(<InterviewPerformanceTracking />);

    await waitFor(() => {
      const phoneScreenElements = screen.getAllByText(/Phone Screen/i);
      const technicalElements = screen.getAllByText(/Technical/i);
      expect(phoneScreenElements.length).toBeGreaterThan(0);
      expect(technicalElements.length).toBeGreaterThan(0);
    });
  });

  test('displays feedback themes with improvement areas and strengths', async () => {
    interviewsAPI.getPerformanceTracking.mockResolvedValue(mockAnalysisData);

    render(<InterviewPerformanceTracking />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Common Feedback Themes/i })).toBeInTheDocument();
      const clarityElements = screen.getAllByText(/Clarity/i);
      expect(clarityElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/Strong technical knowledge/i)).toBeInTheDocument();
    });
  });

  test('displays confidence progression with trend', async () => {
    interviewsAPI.getPerformanceTracking.mockResolvedValue(mockAnalysisData);

    render(<InterviewPerformanceTracking />);

    await waitFor(() => {
      expect(screen.getByText('4.2')).toBeInTheDocument(); // current avg
      expect(screen.getByText('3.8')).toBeInTheDocument(); // previous avg
      expect(screen.getByText(/\+10.5%/i)).toBeInTheDocument(); // trend percentage
    });
  });

  test('displays recent confidence levels timeline', async () => {
    interviewsAPI.getPerformanceTracking.mockResolvedValue(mockAnalysisData);

    render(<InterviewPerformanceTracking />);

    await waitFor(() => {
      expect(screen.getByText(/2024-11-28/i)).toBeInTheDocument();
      expect(screen.getByText(/2024-11-25/i)).toBeInTheDocument();
      // Just check that timeline section exists
      expect(screen.getByText(/Recent Confidence Levels/i)).toBeInTheDocument();
    });
  });

  test('displays performance by industry table', async () => {
    interviewsAPI.getPerformanceTracking.mockResolvedValue(mockAnalysisData);

    render(<InterviewPerformanceTracking />);

    await waitFor(() => {
      expect(screen.getByText(/Technology/i)).toBeInTheDocument();
      expect(screen.getByText(/Finance/i)).toBeInTheDocument();
    });
  });

  test('renders charts when data is available', async () => {
    interviewsAPI.getPerformanceTracking.mockResolvedValue(mockAnalysisData);

    render(<InterviewPerformanceTracking />);

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  test('handles empty feedback themes gracefully', async () => {
    const dataWithoutFeedback = {
      ...mockAnalysisData,
      feedback_themes: {
        improvement_areas: [],
        positive_themes: [],
      },
    };

    interviewsAPI.getPerformanceTracking.mockResolvedValue(dataWithoutFeedback);

    render(<InterviewPerformanceTracking />);

    await waitFor(() => {
      expect(
        screen.getByText(/Complete mock interviews to start tracking feedback themes/i)
      ).toBeInTheDocument();
    });
  });

  test('handles zero mock sessions', async () => {
    const dataWithoutMocks = {
      ...mockAnalysisData,
      mock_to_real_improvement: {
        total_mock_sessions: 0,
        total_real_interviews: 5,
        mock_average_score: 0,
        real_average_score: 75,
        improvement_trend: 0,
      },
    };

    interviewsAPI.getPerformanceTracking.mockResolvedValue(dataWithoutMocks);

    render(<InterviewPerformanceTracking />);

    await waitFor(() => {
      // Check that the practice section renders with zero mock sessions
      expect(screen.getByText(/Practice to Performance Journey/i)).toBeInTheDocument();
      expect(screen.getByText(/Mock Sessions/i)).toBeInTheDocument();
    });
  });

  test('displays negative trend with correct styling', async () => {
    const dataWithNegativeTrend = {
      ...mockAnalysisData,
      confidence_progression: {
        ...mockAnalysisData.confidence_progression,
        trend_percentage: -5.2,
      },
    };

    interviewsAPI.getPerformanceTracking.mockResolvedValue(dataWithNegativeTrend);

    render(<InterviewPerformanceTracking />);

    await waitFor(() => {
      expect(screen.getByText(/-5.2%/i)).toBeInTheDocument();
    });
  });

  test('handles empty conversion rates over time', async () => {
    const dataWithoutTimeSeries = {
      ...mockAnalysisData,
      conversion_rates_over_time: [],
    };

    interviewsAPI.getPerformanceTracking.mockResolvedValue(dataWithoutTimeSeries);

    render(<InterviewPerformanceTracking />);

    await waitFor(() => {
      expect(screen.getByText(/Interview Performance Tracking/i)).toBeInTheDocument();
    });
  });

  test('handles empty performance by format', async () => {
    const dataWithoutFormats = {
      ...mockAnalysisData,
      performance_by_format: [],
    };

    interviewsAPI.getPerformanceTracking.mockResolvedValue(dataWithoutFormats);

    render(<InterviewPerformanceTracking />);

    await waitFor(() => {
      expect(screen.getByText(/Interview Performance Tracking/i)).toBeInTheDocument();
    });
  });
});
