import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TechnicalPrepSuite from './TechnicalPrepSuite';

const mockData = {
  has_data: true,
  job_title: 'Software Engineer',
  role_profile: 'technical',
  tech_stack: {
    languages: ['Python'],
    frameworks: ['React'],
    tooling: ['PostgreSQL'],
  },
  focus_areas: [
    {
      id: 'focus-1',
      skill: 'System Design',
      category: 'Technical',
      recommended_hours: 6,
      practice_tip: 'Drill traceability diagrams.',
      relevance: 'core',
    },
  ],
  performance_tracking: {
    total_practice_minutes: 45,
    last_session_at: '2025-01-01T12:00:00Z',
  },
  coding_challenges: [
    {
      id: 'challenge-1',
      title: 'API Reliability Challenge',
      description: 'Build resilient API handlers.',
      difficulty: 'mid',
      timer: { recommended_minutes: 45 },
      objectives: ['Clarify requirements'],
      best_practices: ['Narrate tradeoffs'],
      practice_stats: { attempts: 4, best_time_seconds: 860, best_accuracy: 95 },
      recent_attempts: [
        { id: 1, attempted_at: '2025-01-01T10:00:00Z', duration_seconds: 900, accuracy: 90, notes: 'Solid run' },
        { id: 2, attempted_at: '2025-01-02T10:00:00Z', duration_seconds: 930, accuracy: 88, notes: '' },
        { id: 3, attempted_at: '2025-01-03T10:00:00Z', duration_seconds: 870, accuracy: 92, notes: 'Improved tests' },
        { id: 4, attempted_at: '2025-01-04T10:00:00Z', duration_seconds: 860, accuracy: 95, notes: 'Great pacing' },
      ],
      reference_links: [
        { label: 'LeetCode – Group Anagrams', url: 'https://leetcode.com/problems/group-anagrams/' },
      ],
    },
  ],
  suggested_challenges: [
    {
      id: 'suggested-1',
      title: 'Additional API Challenge',
      description: 'Practice building rate limits',
      difficulty: 'senior',
      timer: { recommended_minutes: 40 },
      objectives: ['Design throttling'],
      best_practices: ['Log insights'],
      practice_stats: {},
      recent_attempts: [],
    },
  ],
  system_design_scenarios: [
    {
      id: 'sd-1',
      title: 'Event Streaming',
      scenario: 'Design ingestion layer',
      requirements: ['Low latency'],
      constraints: ['Multi region'],
      evaluation: ['Scalability'],
    },
  ],
  case_studies: [
    {
      id: 'case-1',
      title: 'Market Entry',
      role_focus: 'Consulting',
      scenario: 'Launch new product',
      tasks: ['Quantify impact'],
    },
  ],
  technical_questions: [
    {
      id: 'tq-1',
      prompt: 'Describe scaling pattern',
      linked_skill: 'Scalability',
      answer_framework: ['Context', 'Decision', 'Result'],
    },
  ],
  whiteboarding_practice: {
    techniques: ['State assumptions'],
  },
  solution_frameworks: [
    {
      name: 'ACE',
      steps: ['Assess', 'Construct', 'Explain'],
    },
  ],
  real_world_alignment: [
    {
      id: 'rw-1',
      skill: 'Systems Thinking',
      scenario: 'Coordinate launches',
      business_link: 'Improves retention',
    },
  ],
};

describe('TechnicalPrepSuite', () => {
  test('renders technical prep sections', () => {
    render(<TechnicalPrepSuite data={mockData} />);

    expect(screen.getByText(/technical interview prep/i)).toBeInTheDocument();
    expect(screen.getByText(/coding challenges/i)).toBeInTheDocument();
    expect(screen.getAllByText(/API Reliability Challenge/i)[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /suggested/i })).toBeInTheDocument();
    expect(screen.getByText(/system design scenarios/i)).toBeInTheDocument();
    expect(screen.getByText(/case study practice/i)).toBeInTheDocument();
    expect(screen.getByText(/whiteboarding & frameworks/i)).toBeInTheDocument();
    expect(screen.getAllByText(/system design/i)[0]).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /LeetCode – Group Anagrams/i })).toBeInTheDocument();
  });

  test('logs coding challenge attempt and toggles history', async () => {
    const onLogAttempt = jest.fn().mockResolvedValue({});

    render(<TechnicalPrepSuite data={mockData} onLogAttempt={onLogAttempt} />);

    const suggestedTab = screen.getByRole('button', { name: /suggested/i });
    await userEvent.click(suggestedTab);
    const suggestedCards = await screen.findAllByText(/additional api challenge/i);
    expect(suggestedCards.length).toBeGreaterThan(0);

    const primaryTab = screen.getByRole('button', { name: /primary/i });
    await userEvent.click(primaryTab);

    const showAll = await screen.findByRole('button', { name: /show all 4 attempts/i });
    await userEvent.click(showAll);
    expect(await screen.findByRole('button', { name: /show fewer attempts/i })).toBeInTheDocument();

    const testsPassed = screen.getByLabelText(/tests passed/i);
    await userEvent.type(testsPassed, '3');
    const totalTests = screen.getByLabelText(/total tests/i);
    await userEvent.type(totalTests, '4');

    const notes = screen.getByPlaceholderText(/what worked well/i);
    await userEvent.type(notes, 'Focused on caching');

    const submitBtn = screen.getByRole('button', { name: /log attempt/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(onLogAttempt).toHaveBeenCalledWith(expect.objectContaining({
        challenge_id: 'challenge-1',
        tests_passed: 3,
        tests_total: 4,
      }));
    });
  });

  test('hides coding block and renders business layout for business roles', () => {
    const businessData = {
      ...mockData,
      role_profile: 'business',
      coding_challenges: [],
      suggested_challenges: [],
    };
    render(<TechnicalPrepSuite data={businessData} />);

    expect(screen.getByText(/business readiness tracks/i)).toBeInTheDocument();
    expect(screen.queryByText(/coding challenges/i)).not.toBeInTheDocument();
    expect(screen.getByText(/case study practice/i)).toBeInTheDocument();
  });

  test('shows cached plan when refresh fails', () => {
    render(<TechnicalPrepSuite data={mockData} error="Failed to refresh" />);

    expect(screen.getByText(/cached plan/i)).toBeInTheDocument();
    expect(screen.getByText(/coding challenges/i)).toBeInTheDocument();
  });
});
