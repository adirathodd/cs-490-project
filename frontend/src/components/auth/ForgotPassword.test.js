import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';

const { sendPasswordResetEmail } = require('../../services/firebase');

describe('ForgotPassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setup = () =>
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

  it('requires a valid email before submitting', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'bad-email' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText(/please enter a valid email/i)).toBeInTheDocument();
  });

  it('sends reset email and shows confirmation state', async () => {
    sendPasswordResetEmail.mockResolvedValueOnce();
    setup();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalled());
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
  });
});
