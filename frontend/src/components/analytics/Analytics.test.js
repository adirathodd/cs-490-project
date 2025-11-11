import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the API and Auth context used by the component
jest.mock('../../services/api', () => ({
  jobsAPI: {
    getAnalytics: jest.fn(),
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

const { jobsAPI } = require('../../services/api');
const { useAuth } = require('../../context/AuthContext');

// Import the component under test (after mocks)
import Analytics from './Analytics';

describe('Analytics component', () => {
  beforeEach(() => {
    // reset mocks
    jest.clearAllMocks();
    // default auth is not loading
    useAuth.mockReturnValue({ loading: false });
  });

  test('shows loading indicator when auth is still loading', () => {
    useAuth.mockReturnValue({ loading: true });
    const { container } = render(<Analytics />);
    expect(container).toHaveTextContent('Loading analytics dashboard…');
  });

  test('shows error message when API fails', async () => {
    jobsAPI.getAnalytics.mockRejectedValue(new Error('boom'));

    render(<Analytics />);

    // wait for effect to run and error to be shown
    await waitFor(() => expect(screen.getByText(/Failed to load analytics data/i)).toBeInTheDocument());
  });

  test('renders analytics UI when API returns data', async () => {

    const sampleData = {
      funnel_analytics: {
        total_applications: 5,
        success_rate: 30,
        response_rate: 30,
        status_breakdown: { interested: 2, applied: 5, phone_screen: 1, interview: 1, offer: 1 },
      },
      industry_benchmarks: {},
      response_trends: { monthly_trends: [] },
      volume_patterns: {},
      goal_progress: {
        weekly_goal: { current: 5, target: 5, progress_percent: 100 },
      },
      insights_recommendations: {
        insights: ["You've applied to 5 positions; keep up the momentum!"],
        recommendations: ["Focus more on tailored cover letters."]
      },
    };

    jobsAPI.getAnalytics.mockResolvedValue(sampleData);

    render(<Analytics />);

    // Wait for main header
    await waitFor(() => expect(screen.getByText(/Application Analytics Dashboard/i)).toBeInTheDocument());

  // Check key metric cards
  expect(screen.getByText('TOTAL APPLICATIONS')).toBeInTheDocument();
  // The number "5" appears in multiple places (funnel and metrics). Ensure at least one instance exists.
  expect(screen.getAllByText(/^5$/).length).toBeGreaterThan(0);

  // Response Rate card (may appear in multiple places) - ensure at least one match
  expect(screen.getAllByText(/30\s*%/).length).toBeGreaterThan(0);

  // Funnel stage labels should be present (match exact stage labels)
  expect(screen.getByText(/^APPLIED$/i)).toBeInTheDocument();
  expect(screen.getByText(/^INTERVIEW$/i)).toBeInTheDocument();

  // Goal progress should show weekly goal current/target within one of the weekly headers
  const weeklyHeaders = screen.getAllByText(/Weekly Goal Progress/i);
  // find one header whose next sibling contains the "5/5" text
  const found = weeklyHeaders.some(h => {
    const sib = h.nextElementSibling;
    return sib && sib.textContent.replace(/\s+/g, '').match(/5\/5/);
  });
  expect(found).toBe(true);

    // Insights panel should contain our generated insight string
    expect(screen.getByText(/You've applied to 5 positions/)).toBeInTheDocument();
  });

  test('exportAnalytics triggers a download on successful fetch', async () => {
    const sampleData = { counts: { applied: 1 }, monthly_applications: [], daily_applications: [], response_rate_percent: 0 };
  jobsAPI.getAnalytics.mockResolvedValue(sampleData);

    // Mock fetch to return ok and a blob
    const fakeBlob = new Blob(['a,b,c\n1,2,3'], { type: 'text/csv' });
    const origFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => fakeBlob });

    // Spy on URL.createObjectURL and on anchor click
    const createObjectURLSpy = jest.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:fake-url');
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<Analytics />);

    // wait for content so button is present
    await waitFor(() => expect(screen.getByText(/Export Report/i)).toBeInTheDocument());

    const button = screen.getByText(/Export Report/i);
    fireEvent.click(button);

    // wait for fetch to be called
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // ensure createObjectURL was called with the blob and the anchor was clicked
    expect(createObjectURLSpy).toHaveBeenCalled();
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());

    // cleanup spies and restore fetch
    createObjectURLSpy.mockRestore();
    clickSpy.mockRestore();
    global.fetch = origFetch;
  });

  test('exportAnalytics shows error message when fetch fails', async () => {
    const sampleData = { counts: { applied: 1 }, monthly_applications: [], daily_applications: [], response_rate_percent: 0 };
  jobsAPI.getAnalytics.mockResolvedValue(sampleData);

    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    render(<Analytics />);

    await waitFor(() => expect(screen.getByText(/Export Report/i)).toBeInTheDocument());

    const button = screen.getByText(/Export Report/i);
    fireEvent.click(button);

    // wait for error
    await waitFor(() => expect(screen.getByText(/Failed to export analytics report/i)).toBeInTheDocument());
  });
});
