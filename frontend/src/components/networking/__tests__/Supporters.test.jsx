import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Supporters from '../Supporters';

jest.mock('../../../services/api', () => ({
  supportersAPI: {
    listInvites: jest.fn(),
    createInvite: jest.fn(),
    updateInvite: jest.fn(),
    deleteInvite: jest.fn(),
    listEncouragements: jest.fn(),
    getMood: jest.fn(),
    updateMood: jest.fn(),
    candidateChat: jest.fn(),
    candidateSendChat: jest.fn(),
  },
}));

import { supportersAPI } from '../../../services/api';

const invite = {
  id: 1,
  email: 'ally@example.com',
  name: 'Ally',
  is_active: true,
  expires_at: '2025-12-31T00:00:00Z',
  token: 'tok123',
  last_access_at: null,
  accepted_at: null,
};

describe('Supporters', () => {
  beforeEach(() => {
    supportersAPI.listInvites.mockResolvedValue([invite]);
    supportersAPI.listEncouragements.mockResolvedValue([
      { id: 1, supporter_name: 'Sam', message: 'You got this!', created_at: '2025-11-30T00:00:00Z' },
    ]);
    supportersAPI.getMood.mockResolvedValue({ score: 7, note: 'Feeling OK' });
    supportersAPI.candidateChat.mockResolvedValue([
      { id: 10, sender_role: 'supporter', sender_name: 'Pat', message: 'Cheering for you!', created_at: '2025-11-30T00:00:00Z' },
    ]);
    supportersAPI.createInvite.mockResolvedValue({ ...invite, permissions: {} });
    supportersAPI.updateInvite.mockResolvedValue({ ...invite, is_active: false });
    supportersAPI.deleteInvite.mockResolvedValue({});
    supportersAPI.updateMood.mockResolvedValue({ score: 8, note: 'Updated' });
    supportersAPI.candidateSendChat.mockResolvedValue({ id: 11, sender_role: 'candidate', sender_name: 'You', message: 'Hi' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders invite list and remove/pause actions', async () => {
    render(<Supporters />);
    await waitFor(() => expect(supportersAPI.listInvites).toHaveBeenCalled());
    expect(screen.getByText(/Family & Supporters/i)).toBeInTheDocument();
    expect(screen.getByText(invite.email)).toBeInTheDocument();

    // Pause/resume
    fireEvent.click(screen.getByRole('button', { name: /Pause/i }));
    await waitFor(() => expect(supportersAPI.updateInvite).toHaveBeenCalledWith(invite.id, { is_active: false }));

    // Remove
    fireEvent.click(screen.getByRole('button', { name: /Remove/i }));
    await waitFor(() => expect(supportersAPI.deleteInvite).toHaveBeenCalledWith(invite.id));
  });

  test('creates invite with permission toggles and copies link', async () => {
    render(<Supporters />);
    await waitFor(() => expect(supportersAPI.listInvites).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'New Person' } });
    fireEvent.change(screen.getByLabelText(/Link expiry/i), { target: { value: '0' } });
    fireEvent.click(screen.getByLabelText(/Allow company names/i));
    fireEvent.click(screen.getByLabelText(/Show practice stats/i));
    fireEvent.click(screen.getByLabelText(/Show milestones\/achievements/i));

    fireEvent.click(screen.getByRole('button', { name: /Create link/i }));
    await waitFor(() =>
      expect(supportersAPI.createInvite).toHaveBeenCalledWith({
        email: 'new@example.com',
        name: 'New Person',
        expires_in_days: 0,
        permissions: { show_company: true, show_practice: false, show_achievements: false },
      })
    );
  });

  test('saves mood and renders encouragements/chat', async () => {
    render(<Supporters />);
    await waitFor(() => expect(supportersAPI.listEncouragements).toHaveBeenCalled());
    expect(screen.getByText(/You got this/i)).toBeInTheDocument();

    // Mood
    fireEvent.change(screen.getByLabelText(/Score/i), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText(/How I’m feeling/i), { target: { value: 'Great' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    await waitFor(() => expect(supportersAPI.updateMood).toHaveBeenCalledWith({ score: 9, note: 'Great' }));

    // Chat render
    await waitFor(() => expect(supportersAPI.candidateChat).toHaveBeenCalled());
    expect(screen.getByText(/Cheering for you/i)).toBeInTheDocument();
  });
});
