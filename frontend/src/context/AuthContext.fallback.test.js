import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Mock firebase to simulate missing onAuthStateChanged and hit fallback subscribe path
jest.mock('../services/firebase', () => ({
  auth: {},
  onAuthStateChanged: undefined,
  signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock('../services/api', () => ({
  authAPI: {
    getCurrentUser: jest.fn(() => Promise.resolve({ profile: {} })),
  },
}));

const { AuthProvider, useAuth } = require('./AuthContext');

function Consumer() {
  const ctx = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(ctx.loading)}</div>
      <div data-testid="user">{ctx.currentUser ? 'user' : 'null'}</div>
    </div>
  );
}

test('falls back when onAuthStateChanged is not a function', async () => {
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>
  );

  await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
  expect(screen.getByTestId('user').textContent).toBe('null');
});
