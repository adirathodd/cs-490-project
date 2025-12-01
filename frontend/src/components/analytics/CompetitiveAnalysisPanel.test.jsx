import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../services/api', () => ({
  jobsAPI: {
    getCompetitiveAnalysis: jest.fn(),
  },
}));

const { jobsAPI } = require('../../services/api');
const CompetitiveAnalysisPanel = require('./CompetitiveAnalysisPanel').default;

const basePayload = {
  cohort: { industry: 'Technology', experience_level: 'entry', sample_size: 5 },
  user_metrics: { apps_per_week: 2, response_rate: 50, interview_rate: 40, offer_rate: 10 },
  peer_benchmarks: { apps_per_week: 3, response_rate: 60, interview_rate: 50, offer_rate: 20 },
  employment: { user: { avg_positions: 1, avg_years: 0.5 }, peers: { avg_positions: 2, avg_years: 3 } },
  skill_gaps: [{ name: 'Ruby', prevalence: 60 }],
  differentiators: [{ name: 'Go', note: 'Less common peer skill to highlight' }],
  recommendations: {
    deterministic: ['Peers average 3.0 applications/week; increase your pace from 2.0.'],
    ai: ['Here are 3 concise tips: - Showcase React and SQL depth.'],
  },
  progression: {
    sample_size: 1,
    metrics: { apps_per_week: 3, response_rate: 70, interview_rate: 60, offer_rate: 20 },
    skill_gaps: [{ name: 'Kubernetes', prevalence: 50 }],
  },
};

const renderPanel = async (payload = basePayload) => {
  jobsAPI.getCompetitiveAnalysis.mockResolvedValueOnce(payload);
  render(<CompetitiveAnalysisPanel />);
  await waitFor(() => expect(screen.getByText(/Competitive Analysis/i)).toBeInTheDocument());
};

describe('CompetitiveAnalysisPanel', () => {
  beforeEach(() => {
    jobsAPI.getCompetitiveAnalysis.mockReset();
  });

  it('shows metrics, deltas, employment, progression, skills, and recommendations', async () => {
    await renderPanel();

    expect(jobsAPI.getCompetitiveAnalysis).toHaveBeenCalled();
    expect(screen.getAllByText(/Δ/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Average positions held/i)).toBeInTheDocument();
    expect(screen.getByText(/You: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Peers: 2/)).toBeInTheDocument();

    expect(screen.getByText(/Next-step skills to add/i)).toBeInTheDocument();
    expect(screen.getByText(/Kubernetes - 50% of higher-level peers/i)).toBeInTheDocument();

    expect(screen.getByText(/Ruby - 60% of peers have this skill/i)).toBeInTheDocument();
    expect(screen.getByText(/Go - Less common peer skill to highlight/i)).toBeInTheDocument();

    expect(screen.getByText(/Showcase React and SQL depth/i)).toBeInTheDocument();
  });

  it('shows fallback when progression metrics are unavailable', async () => {
    const payload = { ...basePayload, progression: {} };
    await renderPanel(payload);
    expect(screen.getByText(/Not enough higher-level peers yet/i)).toBeInTheDocument();
  });

  it('applies filters and passes params to API', async () => {
    await renderPanel();

    jobsAPI.getCompetitiveAnalysis.mockResolvedValueOnce(basePayload);
    fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText(/Salary Min/i), { target: { value: '50' } });
    fireEvent.click(screen.getByLabelText(/Full-time/i));
    fireEvent.click(screen.getByRole('button', { name: /Apply Filters/i }));

    await waitFor(() => expect(jobsAPI.getCompetitiveAnalysis).toHaveBeenCalledTimes(2));
    const params = jobsAPI.getCompetitiveAnalysis.mock.calls[1][0];
    expect(params.start_date).toBe('2025-01-01');
    expect(params.salary_min).toBe(50);
    expect(params.job_types).not.toContain('ft');
  });
});
