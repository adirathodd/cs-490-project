import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from './ResetPassword';

const {
  verifyPasswordResetCode,
  confirmPasswordReset,
} = require('../services/firebase');

describe('ResetPassword', () => {
  it('shows password validation errors for weak password', async () => {
    verifyPasswordResetCode.mockResolvedValueOnce('user@example.com');
    renderWithRoute();
    expect(await screen.findByText(/reset your password/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/^confirm new password$/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    // All errors are joined in one span, so match the whole string
    expect(
      screen.getByText(
        /at least 8 characters long.*uppercase letter.*one number/i
      )
    ).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    verifyPasswordResetCode.mockResolvedValueOnce('user@example.com');
    renderWithRoute();
    expect(await screen.findByText(/reset your password/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText(/^confirm new password$/i), { target: { value: 'Password2' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('shows errors when fields are empty', async () => {
    verifyPasswordResetCode.mockResolvedValueOnce('user@example.com');
    renderWithRoute();
    expect(await screen.findByText(/reset your password/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    expect(screen.getByText(/please confirm your password/i)).toBeInTheDocument();
  });
  it('renders verifyError paragraph and footer link when reset link is invalid or expired', async () => {
    verifyPasswordResetCode.mockRejectedValueOnce(new Error('expired'));
    renderWithRoute('/reset-password?oobCode=expired');
    // Line 64: setVerifyError('This reset link is invalid or has expired.')
    // Line 70: <p className="auth-subtitle">{verifyError}</p>
    // Line 72: <div className="auth-footer"> ... <Link to="/forgot-password">Request a new reset link</Link>
    const errorParagraph = await screen.findByText('This reset link is invalid or has expired.');
    expect(errorParagraph).toBeInTheDocument();
    expect(errorParagraph).toHaveClass('auth-subtitle');
    const footer = errorParagraph.closest('.auth-card').querySelector('.auth-footer');
    expect(footer).toBeInTheDocument();
    expect(footer.textContent).toMatch(/request a new reset link/i);
    expect(footer.querySelector('a')).toHaveAttribute('href', '/forgot-password');
  });
  it('renders error UI when verifyPasswordResetCode throws (expired/invalid)', async () => {
    verifyPasswordResetCode.mockRejectedValueOnce(new Error('expired'));
    renderWithRoute('/reset-password?oobCode=expired');
    // Line 64: setVerifyError('This reset link is invalid or has expired.')
    // Line 70: verifyError UI
    // Line 72: error message in UI
    expect(await screen.findByText(/this reset link is invalid or has expired/i)).toBeInTheDocument();
    expect(screen.getByText(/reset link error/i)).toBeInTheDocument();
    expect(screen.getByText(/request a new reset link/i)).toBeInTheDocument();
  });
  it('shows loading spinner and verifying message while verifying', async () => {
    // Simulate verifying state by delaying verifyPasswordResetCode
    verifyPasswordResetCode.mockImplementation(() => new Promise(() => {}));
    renderWithRoute();
    expect(screen.getByText(/verifying link/i)).toBeInTheDocument();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithRoute = (route = '/reset-password?oobCode=valid') =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <ResetPassword />
      </MemoryRouter>
    );

  it('shows error when verification fails', async () => {
    verifyPasswordResetCode.mockRejectedValueOnce(new Error('bad code'));
    renderWithRoute('/reset-password?oobCode=bad');

    expect(await screen.findByText(/reset link error/i)).toBeInTheDocument();
    expect(screen.getByText(/request a new reset link/i)).toBeInTheDocument();
  });

  it('shows error when oobCode is missing', async () => {
    renderWithRoute('/reset-password');
    expect(await screen.findByText(/missing or invalid reset code/i)).toBeInTheDocument();
    expect(screen.getByText(/request a new reset link/i)).toBeInTheDocument();
  });

  it('shows error when verifyPasswordResetCode throws (expired/invalid)', async () => {
    verifyPasswordResetCode.mockRejectedValueOnce(new Error('expired'));
    renderWithRoute('/reset-password?oobCode=expired');
    expect(await screen.findByText(/reset link error/i)).toBeInTheDocument();
    expect(screen.getByText(/request a new reset link/i)).toBeInTheDocument();
  });

  it('shows error when password reset fails', async () => {
    verifyPasswordResetCode.mockResolvedValueOnce('user@example.com');
    confirmPasswordReset.mockRejectedValueOnce(new Error('fail'));
    renderWithRoute();
    expect(await screen.findByText(/reset your password/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText(/^confirm new password$/i), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText(/failed to reset password/i)).toBeInTheDocument();
  });

  it('confirms new password when form is valid', async () => {
    verifyPasswordResetCode.mockResolvedValueOnce('user@example.com');
    confirmPasswordReset.mockResolvedValueOnce();

    renderWithRoute();

    expect(await screen.findByText(/reset your password/i)).toBeInTheDocument();
    expect(screen.getByText(/user@example.com/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText(/^confirm new password$/i), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => expect(confirmPasswordReset).toHaveBeenCalled());
    expect(await screen.findByText(/password reset successful/i)).toBeInTheDocument();
  });
});
