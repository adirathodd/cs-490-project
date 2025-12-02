import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import NetworkingEvents from '../NetworkingEvents';

// Mock the networkingAPI used by the component
jest.mock('../../../services/api', () => ({
  networkingAPI: {
    getEvents: jest.fn(),
    getAnalytics: jest.fn(),
    getEvent: jest.fn(),
    createEvent: jest.fn(),
    updateEvent: jest.fn(),
    deleteEvent: jest.fn(),
  }
}));

import { networkingAPI } from '../../../services/api';

const buildAnalytics = (overrides = {}) => ({
  overview: {
    total_events: 1,
    attended_events: 1,
    total_connections: 0,
    high_value_connections: 0,
    goals_achievement_rate: 0,
    follow_up_completion_rate: 0,
    manual_outreach_attempts_30d: 0,
    interactions_logged_30d: 0,
    strong_relationships: 0,
    ...(overrides.overview || {}),
  },
  activity_volume: {
    events_planned: 0,
    events_registered: 0,
    events_attended: 0,
    followups_open: 0,
    followups_completed_30d: 0,
    connections_added_60d: 0,
    interactions_logged_30d: 0,
    outreach_attempts_30d: 0,
    ...(overrides.activity_volume || {}),
  },
  relationship_health: {
    avg_relationship_strength: 0,
    recent_relationship_strength: 0,
    relationship_trend: 0,
    engaged_contacts_60d: 0,
    high_value_ratio: 0,
    ...(overrides.relationship_health || {}),
  },
  referral_pipeline: {
    referrals_requested: 0,
    referrals_received: 0,
    referrals_used: 0,
    networking_sourced_jobs: 0,
    networking_offers: 0,
    introductions_created: 0,
    opportunities_from_interviews: 0,
    ...(overrides.referral_pipeline || {}),
  },
  event_roi: {
    total_spend: 0,
    connections_per_event: 0,
    followups_per_connection: 0,
    cost_per_connection: 0,
    cost_per_high_value_connection: 0,
    paid_events_count: 0,
    paid_connections: 0,
    paid_high_value_connections: 0,
    ...(overrides.event_roi || {}),
  },
  conversion_rates: {
    connection_to_followup_rate: 0,
    follow_up_completion_rate: 0,
    outreach_response_rate: 0,
    networking_to_application_rate: 0,
    referral_conversion_rate: 0,
    ...(overrides.conversion_rates || {}),
  },
  insights: {
    strengths: [],
    focus: [],
    recommendations: [],
    ...(overrides.insights || {}),
  },
  industry_benchmarks: {
    industry: 'general',
    benchmarks: {
      outreach_to_meeting_rate: 0,
      follow_up_completion: 0,
      high_value_ratio: 0,
      connections_per_event: 0,
      referral_conversion: 0,
      ...(overrides.industry_benchmarks?.benchmarks || {}),
    },
  },
  ...(overrides || {}),
});

describe('NetworkingEvents component (simple smoke tests)', () => {
  beforeEach(() => {
    // default mock implementations
    networkingAPI.getEvents.mockResolvedValue([
      {
        id: 1,
        name: 'Test Conference',
        event_type: 'conference',
        attendance_status: 'planned',
        is_virtual: false,
        event_date: '2025-11-18T16:00:00Z',
        location: 'Virtual Hall',
        connections_count: 0,
        pending_follow_ups_count: 0,
      }
    ]);

    networkingAPI.getAnalytics.mockResolvedValue(buildAnalytics());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders Add Event button and opens Add form modal', async () => {
    render(<NetworkingEvents />);

    // wait for events to be loaded
    await waitFor(() => expect(networkingAPI.getEvents).toHaveBeenCalled());

    const addButton = screen.getByRole('button', { name: /Add Event/i });
    expect(addButton).toBeInTheDocument();

    // open add form
    fireEvent.click(addButton);

    // modal heading appears
    expect(await screen.findByText(/Add Networking Event/i)).toBeInTheDocument();

  // virtual checkbox present inside the modal (use getByLabelText to avoid matching option text)
  const checkbox = screen.getByLabelText(/Virtual Event/i);
  expect(checkbox).toBeInTheDocument();

  // checkbox's label should be inside the virtual-toggle container
  const virtualToggle = checkbox.closest('.virtual-toggle');
  expect(virtualToggle).toBeTruthy();
  });

  test('renders an event card with formatted badges', async () => {
    const { container } = render(<NetworkingEvents />);

    // wait for events to be loaded and name to appear
    await waitFor(() => expect(networkingAPI.getEvents).toHaveBeenCalled());
    expect(await screen.findByText('Test Conference')).toBeInTheDocument();
    const typeBadge = container.querySelector('.badge-conference');
    expect(typeBadge).toBeTruthy();
    expect(typeBadge.textContent).toMatch(/Conference/i);
    // Attendance badge should be present
    const attendanceBadge = container.querySelector('.badge-planned');
    expect(attendanceBadge).toBeTruthy();
    expect(attendanceBadge.textContent).toMatch(/Planned/i);
  });
});
