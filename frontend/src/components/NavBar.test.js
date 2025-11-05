import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NavBar from './NavBar';

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const { useAuth } = require('../context/AuthContext');

const renderNav = () => render(
  <MemoryRouter>
    <NavBar />
  </MemoryRouter>
);

describe('NavBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows preferred display name and toggles menu actions', async () => {
    const signOut = jest.fn().mockResolvedValue();
    useAuth.mockReturnValue({
      currentUser: { email: 'user@example.com', displayName: 'Firebase Name' },
      userProfile: { full_name: 'Backend Name', first_name: 'Backend', last_name: 'Name' },
      signOut,
    });

    renderNav();

    // Display name from backend profile
    const menuButton = screen.getByRole('button', { name: /backend name/i });
    expect(menuButton).toBeInTheDocument();

    // Toggle menu open and trigger actions
    fireEvent.click(menuButton);
    const menu = await screen.findByRole('menu');
    const profileBtn = within(menu).getByRole('button', { name: /view profile/i });
    fireEvent.click(profileBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/profile');

    // Reopen menu to sign out
    fireEvent.click(menuButton);
    const signOutBtn = within(await screen.findByRole('menu')).getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });

  it('falls back to email when no profile name exists', () => {
    useAuth.mockReturnValue({
      currentUser: { email: 'user@example.com', displayName: '' },
      userProfile: { full_name: '', first_name: '', last_name: '' },
      signOut: jest.fn(),
    });

    renderNav();
    expect(screen.getByRole('button', { name: /user@example.com/i })).toBeInTheDocument();
  });
});
