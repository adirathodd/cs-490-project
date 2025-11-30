import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SalaryNegotiation from './SalaryNegotiation';
import { jobsAPI, salaryNegotiationAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  jobsAPI: {
    getJob: jest.fn(),
  },
  salaryNegotiationAPI: {
    getPlan: jest.fn(),
    refreshPlan: jest.fn(),
    getOutcomes: jest.fn(),
    createOutcome: jest.fn(),
  },
}));

const mockJob = {
  id: 12,
  title: 'Senior Product Manager',
  company_name: 'Acme Corp',
  location: 'Remote',
  job_type: 'Full-time',
};

const mockPlan = {
  job_id: 12,
  plan_id: 5,
  updated_at: '2025-11-20T10:00:00Z',
  plan: {
    market_context: {
      location: 'Remote',
      job_type: 'Full-time',
      salary_range: { display: '$120k – $150k', recommended_target: '$148k' },
      market_trend: 'up',
      sample_size: 24,
    },
    talking_points: [
      { title: 'Experience Edge', detail: 'Highlight global launch metrics tied to revenue.' },
    ],
    scenario_scripts: [
      { scenario: 'Initial Offer', objective: 'Anchor high', script: ['Lead with enthusiasm.', 'Share data-backed number.'] },
    ],
    total_comp_framework: {
      cash_components: [{ label: 'Base Range', display: '$120k – $150k' }],
      benefits_checklist: ['401k match'],
    },
    counter_offer_templates: [
      { name: 'Collaborative Counter', body: 'Thanks for the offer…', checklist: ['Restate value'] },
    ],
    timing_strategy: { preparation: ['Rehearse talking points'] },
    confidence_exercises: [{ name: 'Breathing Ladder', duration_minutes: 3, instructions: 'Inhale 4, hold 4, exhale 6.' }],
    offer_guidance: {
      offer_details: { base_salary: 120000, bonus: 15000, equity: 20000, respond_by: '2025-11-30' },
      gaps: [{ component: 'Base salary', display: '$5,000' }],
      decision_filters: ['Does this accelerate your goals?'],
    },
    readiness_checklist: [{ label: 'Market data summarized', done: true }],
  },
  offer_details: { base_salary: 120000, bonus: 15000, equity: 20000, respond_by: '2025-11-30', notes: 'Initial pass' },
  outcomes: [],
  progression: { attempts: 0, avg_lift_percent: 0, timeline: [] },
};

const renderComponent = () => {
  return render(
    <MemoryRouter initialEntries={["/jobs/12/salary-negotiation"]}>
      <Routes>
        <Route path="/jobs/:jobId/salary-negotiation" element={<SalaryNegotiation />} />
      </Routes>
    </MemoryRouter>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  jobsAPI.getJob.mockResolvedValue(mockJob);
  salaryNegotiationAPI.getPlan.mockResolvedValue(mockPlan);
  salaryNegotiationAPI.getOutcomes.mockResolvedValue({ results: [], stats: mockPlan.progression });
  salaryNegotiationAPI.refreshPlan.mockResolvedValue(mockPlan);
  salaryNegotiationAPI.createOutcome.mockResolvedValue({ result: {} });
});

describe('SalaryNegotiation (UC-083)', () => {
  test('renders job context and talking points', async () => {
    renderComponent();

    expect(await screen.findByRole('heading', { name: /salary negotiation prep/i })).toBeInTheDocument();
    expect(screen.getByText(/Senior Product Manager/i)).toBeInTheDocument();
    expect(screen.getByText(/Experience Edge/i)).toBeInTheDocument();
    expect(screen.getByText(/Highlight global launch metrics/i)).toBeInTheDocument();
  });

  test('logs a negotiation outcome', async () => {
    renderComponent();

    const companyOfferInput = await screen.findByLabelText(/company offer/i);
    await userEvent.clear(companyOfferInput);
    await userEvent.type(companyOfferInput, '123000');

    const submitButton = screen.getByRole('button', { name: /log outcome/i });
    await userEvent.click(submitButton);

    await waitFor(() => expect(salaryNegotiationAPI.createOutcome).toHaveBeenCalledTimes(1));
    expect(salaryNegotiationAPI.createOutcome).toHaveBeenCalledWith('12', expect.objectContaining({
      company_offer: 123000,
      stage: 'offer',
    }));
    expect(salaryNegotiationAPI.getOutcomes).toHaveBeenCalled();
  });

  test('saves offer details and refreshes plan', async () => {
    renderComponent();

    // There are two 'Base Salary' inputs (offer capture and outcome form).
    // Target the offer-capture input which is prefilled from the plan (120000).
    const baseInputs = await screen.findAllByLabelText(/base salary/i);
    const baseInput = baseInputs.find((el) => el.value === '120000') || baseInputs[0];
    expect(baseInput).toBeDefined();
    await userEvent.clear(baseInput);
    await userEvent.type(baseInput, '130000');

    const saveButton = screen.getByRole('button', { name: /save offer details/i });
    await userEvent.click(saveButton);

    await waitFor(() => expect(salaryNegotiationAPI.refreshPlan).toHaveBeenCalledTimes(1));
    expect(salaryNegotiationAPI.refreshPlan).toHaveBeenCalledWith('12', expect.objectContaining({
      force_refresh: true,
      offer_details: expect.objectContaining({ base_salary: 130000 })
    }));
  });
});
