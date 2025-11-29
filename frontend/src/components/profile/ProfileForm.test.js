import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileForm from './ProfileForm';
import { AuthProvider } from '../../context/AuthContext';
import { authAPI, profileAPI } from '../../services/api';
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
    profileAPI.getUserProfile.mockResolvedValue({
      first_name: 'Test',
      last_name: 'User',
      email: 'testuser@example.com',
      summary: '',
    });
    authAPI.requestAccountDeletion.mockResolvedValue({ message: "We've emailed you a confirmation link." });

    render(
      <AuthProvider value={mockAuthContext}>
        <ProfileForm />
      </AuthProvider>
    );
    // Wait for profile form to finish loading and open delete dialog
    const deleteBtn = await screen.findByRole('button', { name: /delete account/i });
    fireEvent.click(deleteBtn);
    expect(screen.getByText(/confirmation required/i)).toBeInTheDocument();
    // Enter password and confirm
    fireEvent.change(screen.getByPlaceholderText(/your password/i), { target: { value: 'testpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /send confirmation email/i }));
    await waitFor(() => expect(screen.queryByText(/we've sent a confirmation link/i)).toBeInTheDocument());
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
