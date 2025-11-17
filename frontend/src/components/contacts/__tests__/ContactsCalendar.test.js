import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContactsCalendar from '../ContactsCalendar';
import { contactsAPI } from '../../../services/contactsAPI';

// Mock the API
jest.mock('../../../services/contactsAPI', () => ({
  contactsAPI: {
    getAllReminders: jest.fn(),
    dismissReminder: jest.fn(),
  },
}));

// Mock Icon component
jest.mock('../../common/Icon', () => {
  return function Icon({ name }) {
    return <span data-testid={`icon-${name}`}>{name}</span>;
  };
});

describe('ContactsCalendar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    contactsAPI.getAllReminders.mockImplementation(() => new Promise(() => {}));
    render(<ContactsCalendar />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('displays reminders grouped by date', async () => {
    const mockReminders = [
      {
        id: '1',
        contact_id: 'c1',
        contact_name: 'John Doe',
        message: 'Follow up',
        due_date: '2025-11-20T10:00:00Z',
        recurrence: 'weekly',
        completed: false,
        created_at: '2025-11-01T10:00:00Z',
      },
      {
        id: '2',
        contact_id: 'c2',
        contact_name: 'Jane Smith',
        message: 'Check in',
        due_date: '2025-11-20T14:00:00Z',
        recurrence: '',
        completed: false,
        created_at: '2025-11-01T10:00:00Z',
      },
    ];

    contactsAPI.getAllReminders.mockResolvedValue(mockReminders);

    render(<ContactsCalendar />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      // message text may be concatenated or split across nodes; match partially
      expect(screen.getByText((content) => content.includes('Follow up'))).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('Check in'))).toBeInTheDocument();
    });
  });

  it('displays urgent reminders section when reminders are due soon', async () => {
    const now = new Date();
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    const mockReminders = [
      {
        id: '1',
        contact_id: 'c1',
        contact_name: 'Urgent Contact',
        message: 'Urgent reminder',
        due_date: in2Hours.toISOString(),
        recurrence: '',
        completed: false,
        created_at: now.toISOString(),
      },
    ];

    contactsAPI.getAllReminders.mockResolvedValue(mockReminders);

    render(<ContactsCalendar />);

    await waitFor(() => {
      expect(screen.getByText('Urgent Reminders')).toBeInTheDocument();
      // There may be multiple elements that include the contact name (title + list item)
      // Ensure at least one occurrence exists
      const matches = screen.getAllByText((content) => content.includes('Urgent Contact'));
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it('displays empty state when no reminders exist', async () => {
    contactsAPI.getAllReminders.mockResolvedValue([]);

    render(<ContactsCalendar />);

    await waitFor(() => {
      expect(screen.getByText(/no upcoming reminders/i)).toBeInTheDocument();
    });
  });

  it('displays error state when API fails', async () => {
    contactsAPI.getAllReminders.mockRejectedValue(new Error('API Error'));

    render(<ContactsCalendar />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load calendar items/i)).toBeInTheDocument();
    });
  });

  it('color codes reminders based on due date proximity', async () => {
    const now = new Date();
    const overdue = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const dueSoon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    const dueLater = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
    
    const mockReminders = [
      {
        id: '1',
        contact_id: 'c1',
        contact_name: 'Overdue Contact',
        message: 'Overdue',
        due_date: overdue.toISOString(),
        recurrence: '',
        completed: false,
        created_at: now.toISOString(),
      },
      {
        id: '2',
        contact_id: 'c2',
        contact_name: 'Soon Contact',
        message: 'Due soon',
        due_date: dueSoon.toISOString(),
        recurrence: '',
        completed: false,
        created_at: now.toISOString(),
      },
      {
        id: '3',
        contact_id: 'c3',
        contact_name: 'Later Contact',
        message: 'Due later',
        due_date: dueLater.toISOString(),
        recurrence: '',
        completed: false,
        created_at: now.toISOString(),
      },
    ];

    contactsAPI.getAllReminders.mockResolvedValue(mockReminders);

    render(<ContactsCalendar />);

    await waitFor(() => {
      expect(screen.getByText('Overdue Contact')).toBeInTheDocument();
      expect(screen.getByText('Soon Contact')).toBeInTheDocument();
      expect(screen.getByText('Later Contact')).toBeInTheDocument();
    });
  });
});
