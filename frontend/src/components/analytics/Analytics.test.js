import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the API and Auth context used by the component
jest.mock('../../services/api', () => ({
  jobsAPI: {
    getAnalytics: jest.fn(),
    updateAnalyticsGoals: jest.fn(),
  },
}));

// Provide a mockable useAuth hook
jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock the Icon component to avoid rendering complexities
jest.mock('../common/Icon', () => ({
  __esModule: true,
  default: ({ name, children, style }) => (
    <span data-testid={`icon-${name}`} style={style}>{children || name}</span>
  ),
}));

// Mock child components
jest.mock('./InterviewPerformanceTracking', () => ({
  __esModule: true,
  default: () => <div data-testid="interview-performance-tracking">Interview Performance Tracking</div>,
}));

jest.mock('./ApplicationSuccessAnalysis', () => ({
  __esModule: true,
  default: () => <div data-testid="application-success-analysis">Application Success Analysis</div>,
}));

jest.mock('./OptimizationDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="optimization-dashboard">Optimization Dashboard</div>,
}));

const { jobsAPI } = require('../../services/api');
const { useAuth } = require('../../context/AuthContext');

// Import the component under test (after mocks)
import Analytics from './Analytics';

describe('Analytics component', () => {
  const mockAnalyticsData = {
    funnel_analytics: {
      total_applications: 25,
      success_rate: 20,
      response_rate: 40,
      status_breakdown: {
        interested: 5,
        applied: 25,
        phone_screen: 10,
        interview: 8,
        offer: 5,
        rejected: 7,
      },
    },
    industry_benchmarks: {
      industry_standards: {
        conversion_rates: {
          overall_success_rate: 15,
        },
        application_volume: {
          applications_per_week: 10,
        },
      },
    },
    response_trends: {
      monthly_trends: [
        { month: '2025-01', response_rate: 35 },
        { month: '2025-02', response_rate: 40 },
        { month: '2025-03', response_rate: 45 },
      ],
    },
    volume_patterns: {
      weekly_volume: [
        { week: '2025-11-01', count: 5 },
        { week: '2025-11-08', count: 8 },
        { week: '2025-11-15', count: 6 },
      ],
    },
    goal_progress: {
      weekly_goal: {
        current: 8,
        target: 10,
        progress_percent: 80,
        period: '2025-11-24 to 2025-11-30',
      },
      monthly_goal: {
        current: 25,
        target: 30,
        progress_percent: 83.33,
        period: 'November 2025',
      },
    },
    insights_recommendations: {
      insights: [
        'Your response rate increased by 15% this month',
        'Tech industry applications have highest success rate',
      ],
      recommendations: [
        'Consider applying to more positions in the tech sector',
        'Optimize your resume for ATS systems',
      ],
    },
    time_to_response: {
      avg_application_to_response_days: 7,
      avg_application_to_interview_days: 14,
      avg_interview_to_offer_days: 5,
      samples: {
        application_to_response: 15,
        application_to_interview: 8,
        interview_to_offer: 5,
      },
    },
    salary_insights: {
      average_salary: 95000,
      interview_rate: 35,
      offer_rate: 20,
    },
    cover_letter_performance: {
      total_cover_letters: 15,
      best_performing_tone: 'professional',
      tone_performance: {
        professional: {
          total_applications: 10,
          responses: 6,
          interviews: 4,
          offers: 2,
          response_rate: 60,
          interview_rate: 40,
          offer_rate: 20,
        },
        enthusiastic: {
          total_applications: 5,
          responses: 2,
          interviews: 1,
          offers: 1,
          response_rate: 40,
          interview_rate: 20,
          offer_rate: 20,
        },
      },
      insights: [
        'Professional tone has 50% higher response rate',
        'Consider using professional tone for corporate roles',
      ],
    },
    filters: {
      start_date: '2025-11-01',
      end_date: '2025-11-30',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ loading: false });
    jobsAPI.getAnalytics.mockResolvedValue(mockAnalyticsData);
    try {
      window.localStorage.setItem('firebaseToken', 'test-token');
    } catch (_) {
      // ignore in non-browser test environments
    }
  });

  describe('Main Analytics Component', () => {
    test('renders main header and tabs', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Analytics Command Center')).toBeInTheDocument();
      });

      expect(screen.getByText('Track metrics, analyze patterns, and optimize your job search strategy')).toBeInTheDocument();
      expect(screen.getByText('Applications')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Interviews')).toBeInTheDocument();
      expect(screen.getByText('Optimization')).toBeInTheDocument();
    });

    test('switches between tabs correctly', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Application Analytics Dashboard')).toBeInTheDocument();
      });

      // Click Success tab
      const successTab = screen.getByText('Success');
      fireEvent.click(successTab);

      await waitFor(() => {
        expect(screen.getByTestId('application-success-analysis')).toBeInTheDocument();
      });

      // Click Interviews tab
      const interviewTab = screen.getByText('Interviews');
      fireEvent.click(interviewTab);

      await waitFor(() => {
        expect(screen.getByTestId('interview-performance-tracking')).toBeInTheDocument();
      });

      // Switch back to applications
      const applicationsTab = screen.getByText('Applications');
      fireEvent.click(applicationsTab);

      await waitFor(() => {
        expect(screen.getByText('Application Analytics Dashboard')).toBeInTheDocument();
      });
    });

    test('shows optimization dashboard content when tab selected', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Application Analytics Dashboard')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Optimization'));

      await waitFor(() => {
        expect(screen.getByTestId('optimization-dashboard')).toBeInTheDocument();
      });
    });

    test('shows loading state when auth is loading', () => {
      useAuth.mockReturnValue({ loading: true });
      render(<Analytics />);

      expect(screen.getByText('Loading analytics dashboard…')).toBeInTheDocument();
    });
  });

  describe('ApplicationAnalyticsPanel', () => {
    test('renders all key metrics correctly', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('TOTAL APPLICATIONS')).toBeInTheDocument();
      });

      expect(screen.getAllByText('25').length).toBeGreaterThan(0);
      expect(screen.getByText('SUCCESS RATE')).toBeInTheDocument();
      expect(screen.getAllByText(/20%/).length).toBeGreaterThan(0);
      expect(screen.getByText('RESPONSE RATE')).toBeInTheDocument();
      expect(screen.getAllByText(/40%/).length).toBeGreaterThan(0);
      expect(screen.getByText('WEEKLY GOAL PROGRESS')).toBeInTheDocument();
      expect(screen.getAllByText('8/10').length).toBeGreaterThan(0);
    });

    test('shows error message when API fails', async () => {
      jobsAPI.getAnalytics.mockRejectedValue(new Error('API Error'));

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument();
      });
    });

    test('renders filter controls', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByLabelText('Start date')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('End date')).toBeInTheDocument();
      expect(screen.getByLabelText('Salary minimum')).toBeInTheDocument();
      expect(screen.getByLabelText('Salary maximum')).toBeInTheDocument();
      expect(screen.getByText('Apply filters')).toBeInTheDocument();
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    test('applies filters correctly', async () => {
      render(<Analytics />);

      // Wait for initial load to complete
      await screen.findByLabelText('Start date');
      await screen.findByText('Apply filters');

      // Change start date and wait for re-render to settle
      fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2025-11-01' } });
      await screen.findByLabelText('Start date'); // Wait for component to settle after potential reload

      // Change end date and wait for re-render to settle  
      fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2025-11-30' } });
      await screen.findByLabelText('End date');

      // Change salary min and wait for re-render to settle
      fireEvent.change(screen.getByLabelText('Salary minimum'), { target: { value: '80000' } });
      await screen.findByLabelText('Salary minimum');

      // Click apply filters
      fireEvent.click(screen.getByText('Apply filters'));

      await waitFor(() => {
        expect(jobsAPI.getAnalytics).toHaveBeenCalledWith(
          expect.objectContaining({
            start_date: '2025-11-01',
            end_date: '2025-11-30',
            salary_min: 80000,
          })
        );
      });
    });

    test('resets filters correctly', async () => {
      render(<Analytics />);

      // Wait for initial load to complete
      await screen.findByLabelText('Start date');
      await screen.findByText('Reset');

      // Change start date and wait for component to settle
      fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2025-11-01' } });
      await screen.findByLabelText('Start date');

      // Click reset
      fireEvent.click(screen.getByText('Reset'));

      await waitFor(() => {
        // After reset, the API is called again without filters
        const lastCall = jobsAPI.getAnalytics.mock.calls[jobsAPI.getAnalytics.mock.calls.length - 1][0];
        expect(lastCall.start_date).toBeUndefined();
      });
    });

    test('toggles job type filters', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Full-time')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const fullTimeCheckbox = checkboxes[0]; // First checkbox is Full-time
      
      expect(fullTimeCheckbox).toBeChecked();

      fireEvent.click(fullTimeCheckbox);
      expect(fullTimeCheckbox).not.toBeChecked();
    });

    test('exports analytics report', async () => {
      const fakeBlob = new Blob(['test,data'], { type: 'text/csv' });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        blob: async () => fakeBlob,
      });

      const createObjectURLSpy = jest.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:fake-url');
      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Export Report')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export Report');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/jobs/stats?export=csv',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: expect.any(String),
            }),
          })
        );
      });

      expect(createObjectURLSpy).toHaveBeenCalledWith(fakeBlob);
      expect(clickSpy).toHaveBeenCalled();

      createObjectURLSpy.mockRestore();
      clickSpy.mockRestore();
    });

    test('shows error when export fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false });

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Export Report')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export Report');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to export analytics report')).toBeInTheDocument();
      });
    });
  });

  describe('Goal Management', () => {
    test('updates and saves goals', async () => {
      jobsAPI.updateAnalyticsGoals.mockResolvedValue({ success: true });

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Customize Targets')).toBeInTheDocument();
      });

      const weeklyInput = screen.getByLabelText('Weekly applications target');
      const monthlyInput = screen.getByLabelText('Monthly applications target');

      fireEvent.change(weeklyInput, { target: { value: '15' } });
      fireEvent.change(monthlyInput, { target: { value: '50' } });

      const saveButton = screen.getByText('Save targets');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(jobsAPI.updateAnalyticsGoals).toHaveBeenCalledWith({
          weekly_target: 15,
          monthly_target: 50,
        });
      });

      expect(screen.getByText('Saving targets...')).toBeInTheDocument();

      await waitFor(() => {
        expect(jobsAPI.getAnalytics).toHaveBeenCalledTimes(2); // Initial load + after save
      });
    });

    test('shows error when saving goals without input', async () => {
      const noGoalsData = {
        ...mockAnalyticsData,
        goal_progress: {
          weekly_goal: {
            current: 0,
            target: null,
            progress_percent: 0,
          },
        },
      };

      jobsAPI.getAnalytics.mockResolvedValue(noGoalsData);

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Customize Targets')).toBeInTheDocument();
      });

      // Inputs should be empty since target is null
      const saveButton = screen.getByText('Save targets');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Please provide at least one goal target to update.')).toBeInTheDocument();
      });
    });

    test('shows error when goal save fails', async () => {
      jobsAPI.updateAnalyticsGoals.mockRejectedValue(new Error('Save failed'));

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Customize Targets')).toBeInTheDocument();
      });

      const weeklyInput = screen.getByLabelText('Weekly applications target');
      fireEvent.change(weeklyInput, { target: { value: '20' } });

      const saveButton = screen.getByText('Save targets');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to save application targets')).toBeInTheDocument();
      });
    });
  });

  describe('Application Funnel', () => {
    test('renders funnel stages with correct counts', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Application Funnel Analytics')).toBeInTheDocument();
      });

      expect(screen.getByText('INTERESTED')).toBeInTheDocument();
      expect(screen.getByText('APPLIED')).toBeInTheDocument();
      expect(screen.getByText('PHONE SCREEN')).toBeInTheDocument();
      expect(screen.getByText('INTERVIEW')).toBeInTheDocument();
      expect(screen.getByText('OFFER')).toBeInTheDocument();
    });

    test('shows message when no applications exist', async () => {
      const emptyData = {
        ...mockAnalyticsData,
        funnel_analytics: {
          total_applications: 0,
          success_rate: 0,
          response_rate: 0,
          status_breakdown: {},
        },
      };

      jobsAPI.getAnalytics.mockResolvedValue(emptyData);

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('No applications yet. Start adding jobs to see your funnel.')).toBeInTheDocument();
      });
    });
  });

  describe('Stage Timing', () => {
    test('renders stage timing metrics', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Stage Timing')).toBeInTheDocument();
      });

      expect(screen.getByText('Application -> Response')).toBeInTheDocument();
      expect(screen.getByText('7 days')).toBeInTheDocument();
      expect(screen.getByText('Application -> Interview')).toBeInTheDocument();
      expect(screen.getByText('14 days')).toBeInTheDocument();
      expect(screen.getByText('Interview -> Offer')).toBeInTheDocument();
      expect(screen.getByText('5 days')).toBeInTheDocument();
    });

    test('shows "No data" when timing data is missing', async () => {
      const noTimingData = {
        ...mockAnalyticsData,
        time_to_response: {},
      };

      jobsAPI.getAnalytics.mockResolvedValue(noTimingData);

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getAllByText('No data').length).toBeGreaterThan(0);
      });
    });

    test('shows hours for sub-day timing', async () => {
      const subDayData = {
        ...mockAnalyticsData,
        time_to_response: {
          avg_application_to_response_days: 0.5,
          samples: { application_to_response: 3 },
        },
      };

      jobsAPI.getAnalytics.mockResolvedValue(subDayData);

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('12.0 hrs')).toBeInTheDocument();
      });
    });
  });

  describe('Salary Insights', () => {
    test('renders salary metrics', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Salary Insights')).toBeInTheDocument();
      });

      expect(screen.getByText('Average salary applied')).toBeInTheDocument();
      expect(screen.getByText('$95,000')).toBeInTheDocument();
      expect(screen.getByText('Interview rate in this range')).toBeInTheDocument();
      expect(screen.getAllByText(/35%/).length).toBeGreaterThan(0);
      expect(screen.getByText('Offer rate in this range')).toBeInTheDocument();
      expect(screen.getAllByText(/20%/).length).toBeGreaterThan(0);
    });

    test('shows N/A when salary data is missing', async () => {
      const noSalaryData = {
        ...mockAnalyticsData,
        salary_insights: {},
      };

      jobsAPI.getAnalytics.mockResolvedValue(noSalaryData);

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Industry Benchmarks', () => {
    test('renders benchmark comparison', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Performance vs Industry Benchmarks')).toBeInTheDocument();
      });

      expect(screen.getByText('YOUR SUCCESS RATE')).toBeInTheDocument();
      expect(screen.getByText('INDUSTRY AVERAGE')).toBeInTheDocument();
      expect(screen.getByText('15%')).toBeInTheDocument();
      expect(screen.getByText('RECOMMENDED WEEKLY APPS')).toBeInTheDocument();
    });
  });

  describe('Response Rate Trends', () => {
    test('renders trend chart', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Response Rate Trends')).toBeInTheDocument();
      });

      // Check that trend chart renders - month labels may vary based on date parsing
      // Just verify the response rates are shown
      expect(screen.getAllByText(/35%|40%|45%/).length).toBeGreaterThan(0);
    });

    test('shows message when no trend data available', async () => {
      const noTrendsData = {
        ...mockAnalyticsData,
        response_trends: { monthly_trends: [] },
      };

      jobsAPI.getAnalytics.mockResolvedValue(noTrendsData);

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('No trend data available')).toBeInTheDocument();
      });
    });
  });

  describe('Volume Patterns', () => {
    test('renders volume chart', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Application Volume Patterns')).toBeInTheDocument();
      });

      expect(screen.getByText('Applications by Day')).toBeInTheDocument();
    });

    test('shows empty chart when no volume data', async () => {
      const noVolumeData = {
        ...mockAnalyticsData,
        volume_patterns: {},
      };

      jobsAPI.getAnalytics.mockResolvedValue(noVolumeData);

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Applications by Day')).toBeInTheDocument();
      });
    });
  });

  describe('Cover Letter Performance', () => {
    test('renders cover letter analytics', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Cover Letter Performance')).toBeInTheDocument();
      });

      expect(screen.getByText('15')).toBeInTheDocument(); // total_cover_letters
      expect(screen.getByText('Cover Letters Tracked')).toBeInTheDocument();
      expect(screen.getAllByText(/professional/i).length).toBeGreaterThan(0);
      expect(screen.getByText('Best Performing Tone')).toBeInTheDocument();
      expect(screen.getByText('Performance by Tone')).toBeInTheDocument();
    });

    test('shows best performing tone with trophy', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('🏆 Best')).toBeInTheDocument();
      });
    });

    test('hides cover letter section when no data', async () => {
      const noCoverLetterData = {
        ...mockAnalyticsData,
        cover_letter_performance: null,
      };

      jobsAPI.getAnalytics.mockResolvedValue(noCoverLetterData);

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.queryByText('Cover Letter Performance')).not.toBeInTheDocument();
      });
    });

    test('shows fallback message when no tone performance data', async () => {
      const emptyToneData = {
        ...mockAnalyticsData,
        cover_letter_performance: {
          tone_performance: null,
        },
      };

      jobsAPI.getAnalytics.mockResolvedValue(emptyToneData);

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('No cover letter analytics data available. Start applying with AI-generated cover letters to see performance insights.')).toBeInTheDocument();
      });
    });
  });

  describe('Insights and Recommendations', () => {
    test('renders insights and recommendations', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Insights & Recommendations')).toBeInTheDocument();
      });

      expect(screen.getByText('Key Insights')).toBeInTheDocument();
      expect(screen.getByText('Your response rate increased by 15% this month')).toBeInTheDocument();
      expect(screen.getByText('Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Consider applying to more positions in the tech sector')).toBeInTheDocument();
    });

    test('shows fallback message when no insights', async () => {
      const noInsightsData = {
        ...mockAnalyticsData,
        insights_recommendations: {
          insights: [],
          recommendations: [],
        },
      };

      jobsAPI.getAnalytics.mockResolvedValue(noInsightsData);

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Apply to more positions to generate insights')).toBeInTheDocument();
      });

      expect(screen.getByText('Keep tracking applications for personalized recommendations')).toBeInTheDocument();
    });
  });

  describe('Goal Progress', () => {
    test('renders weekly and monthly goals', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Goal Progress')).toBeInTheDocument();
      });

      expect(screen.getByText('Monthly Goal Progress')).toBeInTheDocument();
      expect(screen.getByText('80.0%')).toBeInTheDocument();
      expect(screen.getByText('83.3%')).toBeInTheDocument();
    });

    test('shows only weekly goal when monthly not available', async () => {
      const weeklyOnlyData = {
        ...mockAnalyticsData,
        goal_progress: {
          weekly_goal: mockAnalyticsData.goal_progress.weekly_goal,
        },
      };

      jobsAPI.getAnalytics.mockResolvedValue(weeklyOnlyData);

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Goal Progress')).toBeInTheDocument();
      });

      expect(screen.queryByText('Monthly Goal Progress')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles null analytics data gracefully', async () => {
      jobsAPI.getAnalytics.mockResolvedValue(null);

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.queryByText('Application Analytics Dashboard')).not.toBeInTheDocument();
      });
    });

    test('handles missing nested data gracefully', async () => {
      const minimalData = {
        funnel_analytics: {
          total_applications: 0,
          success_rate: 0,
          response_rate: 0,
        },
        goal_progress: {},
        insights_recommendations: {},
      };

      jobsAPI.getAnalytics.mockResolvedValue(minimalData);

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Application Analytics Dashboard')).toBeInTheDocument();
      });

      // Should render without crashing - check for the first occurrence of "0"
      const zeroElements = screen.getAllByText('0');
      expect(zeroElements.length).toBeGreaterThan(0);
    });

    test('handles invalid date formats in trends', async () => {
      const invalidDateData = {
        ...mockAnalyticsData,
        response_trends: {
          monthly_trends: [
            { month: 'invalid-date', response_rate: 35 },
          ],
        },
      };

      jobsAPI.getAnalytics.mockResolvedValue(invalidDateData);

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Response Rate Trends')).toBeInTheDocument();
      });

      // Should handle gracefully - the component will still render with the invalid date showing as "N/A"
      // Just verify the component doesn't crash
      expect(screen.getAllByText(/35%/).length).toBeGreaterThan(0);
    });

    test('handles filter with salary max only', async () => {
      render(<Analytics />);

      // Wait for initial load to complete
      await screen.findByLabelText('Salary maximum');
      await screen.findByText('Apply filters');

      // Change salary max and wait for component to settle
      fireEvent.change(screen.getByLabelText('Salary maximum'), { target: { value: '150000' } });
      await screen.findByLabelText('Salary maximum');

      // Click apply
      fireEvent.click(screen.getByText('Apply filters'));

      await waitFor(() => {
        expect(jobsAPI.getAnalytics).toHaveBeenCalledWith(
          expect.objectContaining({
            salary_max: 150000,
          })
        );
      });
    });

    test('filters out unchecked job types', async () => {
      render(<Analytics />);

      // Wait for initial load to complete
      await screen.findByText('Full-time');
      await screen.findByText('Apply filters');

      // Uncheck Part-time and wait for component to settle
      const checkboxes = screen.getAllByRole('checkbox');
      const partTimeCheckbox = checkboxes.find(cb => cb.parentElement.textContent.includes('Part-time'));
      
      fireEvent.click(partTimeCheckbox);
      await screen.findByText('Part-time');

      // Click apply
      fireEvent.click(screen.getByText('Apply filters'));

      await waitFor(() => {
        const lastCall = jobsAPI.getAnalytics.mock.calls[jobsAPI.getAnalytics.mock.calls.length - 1][0];
        expect(lastCall.job_types).not.toContain('pt');
        expect(lastCall.job_types).toContain('ft');
      });
    });

    test('displays active filter info', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Active: 2025-11-01 - 2025-11-30')).toBeInTheDocument();
      });
    });
  });

  describe('Success Rate Color Coding', () => {
    test('shows green for good success rate', async () => {
      const goodSuccessData = {
        ...mockAnalyticsData,
        funnel_analytics: {
          ...mockAnalyticsData.funnel_analytics,
          success_rate: 25,
        },
      };

      jobsAPI.getAnalytics.mockResolvedValue(goodSuccessData);

      render(<Analytics />);

      await waitFor(() => {
        const successRateElements = screen.getAllByText('25%');
        const successRateValue = successRateElements.find(el => 
          el.previousElementSibling?.textContent === 'SUCCESS RATE'
        );
        expect(successRateValue).toHaveStyle({ color: '#059669' });
      });
    });

    test('shows red for poor success rate', async () => {
      const poorSuccessData = {
        ...mockAnalyticsData,
        funnel_analytics: {
          ...mockAnalyticsData.funnel_analytics,
          success_rate: 5,
        },
      };

      jobsAPI.getAnalytics.mockResolvedValue(poorSuccessData);

      render(<Analytics />);

      await waitFor(() => {
        const successRateElements = screen.getAllByText('5%');
        const successRateValue = successRateElements.find(el => 
          el.previousElementSibling?.textContent === 'SUCCESS RATE'
        );
        expect(successRateValue).toHaveStyle({ color: '#dc2626' });
      });
    });
  });
});
