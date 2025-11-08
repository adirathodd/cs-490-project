import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileForm from './ProfileForm';
import { AuthProvider } from '../../context/AuthContext';

// Mock authAPI.requestAccountDeletion and signOut
jest.mock('../../services/api', () => ({
  authAPI: {
    requestAccountDeletion: jest.fn().mockResolvedValue({ message: "We've emailed you a confirmation link." })
  }
}));
jest.mock('../../services/firebase', () => ({
  reauthenticateWithCredential: jest.fn().mockResolvedValue(true),
  EmailAuthProvider: { credential: jest.fn() }
}));

const mockSignOut = jest.fn();
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

const mockUser = {
  email: 'testuser@example.com',
  getIdToken: jest.fn().mockResolvedValue('token'),
};

const mockAuthContext = {
  currentUser: mockUser,
  loading: false,
  signOut: mockSignOut,
};

describe('ProfileForm Account Deletion (email confirmation flow)', () => {
  it('shows modal and initiates email confirmation on confirm', async () => {
    render(
      <AuthProvider value={mockAuthContext}>
        <ProfileForm />
      </AuthProvider>
    );
    // Open delete dialog
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(screen.getByText(/confirmation required/i)).toBeInTheDocument();
    // Enter password and confirm
    fireEvent.change(screen.getByPlaceholderText(/your password/i), { target: { value: 'testpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /send confirmation email/i }));
    await waitFor(() => expect(screen.queryByText(/we've sent a confirmation link/i)).toBeInTheDocument());
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
