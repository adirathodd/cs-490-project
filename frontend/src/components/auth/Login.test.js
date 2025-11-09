import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const { signInWithEmailAndPassword, signInWithPopup } = require('firebase/auth');

describe('Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  const setup = () =>
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

  it('validates required fields before attempting login', async () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('performs email/password login and stores firebase token', async () => {
    const navigate = jest.fn();
    const useNavigateSpy = jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigate);
    signInWithEmailAndPassword.mockResolvedValueOnce({
      user: { getIdToken: jest.fn().mockResolvedValue('jwt-token') },
    });

    setup();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Secret123!' } });

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'user@example.com', 'Secret123!'));
    expect(localStorage.getItem('firebaseToken')).toBe('jwt-token');
    expect(navigate).toHaveBeenCalledWith('/dashboard');
    useNavigateSpy.mockRestore();
  });

  it('shows friendly error message from Firebase auth codes', async () => {
    signInWithEmailAndPassword.mockRejectedValueOnce({ code: 'auth/wrong-password' });

    setup();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Secret123!' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(/incorrect password/i)).toBeInTheDocument();
  });

  it('initiates Google sign-in through popup', async () => {
    const navigate = jest.fn();
    const useNavigateSpy = jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigate);
    signInWithPopup.mockResolvedValueOnce({
      user: { getIdToken: jest.fn().mockResolvedValue('google-token') },
    });

    setup();
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));

    await waitFor(() => expect(signInWithPopup).toHaveBeenCalled());
    expect(localStorage.getItem('firebaseToken')).toBe('google-token');
    expect(navigate).toHaveBeenCalledWith('/dashboard');
    useNavigateSpy.mockRestore();
  });
});
