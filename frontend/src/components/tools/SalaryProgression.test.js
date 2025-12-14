import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SalaryProgression from './SalaryProgression';
import { offerAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  jobsAPI: {
    getJobs: jest.fn().mockResolvedValue({ results: [] }),
    getJob: jest.fn(),
  },
  salaryNegotiationAPI: {
    getPlan: jest.fn(),
    getOutcomes: jest.fn(),
  },
  offerAPI: {
    getComparison: jest.fn(),
    create: jest.fn(),
    runScenario: jest.fn(),
    archive: jest.fn(),
  },
}));

const mockComparison = {
  offers: [
    {
      id: 1,
      company_name: 'Axis Labs',
      role_title: 'Senior PM',
      overall_score: 82,
      negotiation_recommendations: ['Use market data to raise base salary.'],
    },
  ],
  matrix: {
    headers: [
      {
        id: 1,
        label: 'Senior PM',
        company: 'Axis Labs',
        location: 'New York, NY',
        remote_policy: 'hybrid',
      },
    ],
    rows: [
      { key: 'total_comp', label: 'Total compensation', format: 'currency', values: [200000] },
      { key: 'overall_score', label: 'Weighted score', format: 'score', values: [82] },
    ],
  },
  summary: {
    top_overall: { company: 'Axis Labs', score: 82 },
    highest_total_comp: { company: 'Axis Labs', adjusted_total_comp: 200000 },
    notes: ['Axis Labs leads overall.'],
  },
  scenario: { applied: false, label: 'Baseline view' },
  raw_offers: [
    {
      id: 1,
      company_name: 'Axis Labs',
      role_title: 'Senior PM',
      location: 'New York, NY',
      base_salary: 150000,
      bonus: 30000,
      equity: 20000,
      benefits_total_value: 10000,
    },
  ],
  archived_offers: [],
  weights: { financial: 0.6, non_financial: 0.4, non_financial_breakdown: {} },
};

const mockScenario = {
  ...mockComparison,
  summary: {
    ...mockComparison.summary,
    notes: ['Scenario applied to offers.'],
  },
  scenario: { applied: true, label: 'Scenario adjustment', params: { salary_increase_percent: 10 } },
};

describe('SalaryProgression offer comparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    offerAPI.getComparison.mockResolvedValue(mockComparison);
    offerAPI.create.mockResolvedValue({ id: 99 });
    offerAPI.runScenario.mockResolvedValue(mockScenario);
  });

  it('renders comparison lab and saves new offers', async () => {
    render(<SalaryProgression />);
    await waitFor(() => expect(offerAPI.getComparison).toHaveBeenCalled());

    fireEvent.change(await screen.findByLabelText(/Role title/i), { target: { value: 'Staff PM' } });
    fireEvent.change(screen.getByLabelText(/Company/i), { target: { value: 'Nova' } });
    fireEvent.change(screen.getByLabelText(/Location/i), { target: { value: 'Remote' } });
    fireEvent.change(screen.getByLabelText(/Base salary/i), { target: { value: '150000' } });

    fireEvent.submit(screen.getByText(/Save offer/i).closest('form'));
    await waitFor(() => expect(offerAPI.create).toHaveBeenCalled());

    expect(screen.getByText(/Comparison matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/Axis Labs leads overall/i)).toBeInTheDocument();
  });

  it('runs scenario analysis for offers', async () => {
    render(<SalaryProgression />);
    await waitFor(() => expect(offerAPI.getComparison).toHaveBeenCalled());

    fireEvent.change(await screen.findByLabelText(/Salary increase/i), { target: { value: '10' } });
    fireEvent.submit(screen.getByText(/Run scenario/i).closest('form'));

    await waitFor(() => expect(offerAPI.runScenario).toHaveBeenCalledWith({ salary_increase_percent: 10 }));
    expect(await screen.findByText(/Scenario applied to offers/i)).toBeInTheDocument();
  });
});
