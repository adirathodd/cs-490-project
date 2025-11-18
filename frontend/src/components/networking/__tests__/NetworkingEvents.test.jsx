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

    networkingAPI.getAnalytics.mockResolvedValue({ overview: { total_events: 1, total_connections: 0, high_value_connections: 0, goals_achievement_rate: 0, follow_up_completion_rate: 0 } });
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
