import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';

// Default mocks; some tests will override using isolateModules
jest.mock('../services/firebase', () => {
  return {
    auth: {},
    onAuthStateChanged: jest.fn(),
    signOut: jest.fn(() => Promise.resolve()),
  };
});

jest.mock('../services/api', () => {
  return {
    authAPI: {
      getCurrentUser: jest.fn(() => Promise.resolve({ profile: {} })),
    },
  };
});

// Helper Test Consumer to access context values and actions
let AuthContextModule;
let AuthProvider;
let useAuth;

beforeEach(() => {
  // Re-require with default mocks (do NOT reset modules to avoid duplicate React instances)
  AuthContextModule = require('./AuthContext');
  AuthProvider = AuthContextModule.AuthProvider;
  useAuth = AuthContextModule.useAuth;
  jest.clearAllMocks();
  // Clean localStorage
  localStorage.clear();
  // Remove any test-added nodes between tests
  document
    .querySelectorAll(
      '[data-testid="refreshed-token"], [data-testid="signout-error"], [data-testid="refresh-profile-error"]'
    )
    .forEach((n) => n.remove());
});

function TestConsumer() {
  const ctx = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(ctx.loading)}</div>
      <div data-testid="user">{ctx.currentUser ? 'user' : 'null'}</div>
      <div data-testid="portfolio">{ctx.userProfile?.portfolio_url || ''}</div>
      <div data-testid="error">{ctx.error || ''}</div>
      <button
        onClick={async () => {
          try {
            await ctx.signOut();
          } catch (e) {
            const span = document.createElement('span');
            span.setAttribute('data-testid', 'signout-error');
            span.textContent = e.message;
            document.body.appendChild(span);
          }
        }}
        data-testid="signout"
      >
        signout
      </button>
      <button onClick={async () => {
        const token = await ctx.refreshToken();
        const span = document.createElement('span');
        span.setAttribute('data-testid', 'refreshed-token');
        span.textContent = token || '';
        document.body.appendChild(span);
      }} data-testid="refresh-token">refresh-token</button>
      <button onClick={() => ctx.refreshUserProfile()} data-testid="refresh-profile">refresh-profile</button>
      <button
        onClick={async () => {
          try {
            await ctx.refreshUserProfile();
          } catch (e) {
            const span = document.createElement('span');
            span.setAttribute('data-testid', 'refresh-profile-error');
            span.textContent = e.message;
            document.body.appendChild(span);
          }
        }}
        data-testid="refresh-profile-error-trigger"
      >
        refresh-profile-error
      </button>
    </div>
  );
}

// Error Boundary to catch hook error for use outside provider
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <div data-testid="error">{this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

const { onAuthStateChanged, signOut: firebaseSignOut } = require('../services/firebase');
const { authAPI } = require('../services/api');


describe('AuthContext', () => {
  test('useAuth throws when used outside AuthProvider', () => {
    // suppress React error noise
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    function Outside() {
      useAuth();
      return null;
    }

    render(
      <ErrorBoundary>
        <Outside />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error').textContent).toMatch(
      'useAuth must be used within an AuthProvider'
    );

    spy.mockRestore();
  });

  test('skips real auth when injectedValue is provided', async () => {
    const injected = {
      currentUser: null,
      userProfile: { portfolio_url: 'x' },
      loading: false,
      error: null,
      signOut: jest.fn(),
      refreshToken: jest.fn(),
      refreshUserProfile: jest.fn(),
      setUserProfile: jest.fn(),
    };

    render(
      <AuthProvider value={injected}>
        <TestConsumer />
      </AuthProvider>
    );

    // onAuthStateChanged should not be called at all
    expect(onAuthStateChanged).not.toHaveBeenCalled();
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('portfolio').textContent).toBe('x');
  });

  test('handles user sign-in: stores token and merges photoURL into profile when backend missing portfolio_url', async () => {
    const user = {
      getIdToken: jest.fn((force) => Promise.resolve(force ? 'token-new' : 'token-abc')),
      photoURL: 'http://photo/url.png',
    };
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      // simulate immediate auth callback
      cb(user);
      return () => {};
    });
    authAPI.getCurrentUser.mockResolvedValueOnce({ profile: {} });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    // token stored from initial getIdToken()
    expect(localStorage.getItem('firebaseToken')).toBe('token-abc');

    // profile uses photoURL fallback when backend missing value
    expect(screen.getByTestId('portfolio').textContent).toBe('http://photo/url.png');

    // refresh token path forces new token
    await act(async () => {
      fireEvent.click(screen.getByTestId('refresh-token'));
    });
    await waitFor(() => {
      expect(localStorage.getItem('firebaseToken')).toBe('token-new');
      expect(screen.getByTestId('refreshed-token').textContent).toBe('token-new');
    });
  });

  test('preserves backend portfolio_url when present even if user has photoURL', async () => {
    const user = {
      getIdToken: jest.fn(() => Promise.resolve('tkn')),
      photoURL: 'http://photo/user.png',
    };
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(user);
      return () => {};
    });
    authAPI.getCurrentUser.mockResolvedValueOnce({ profile: { portfolio_url: 'http://backend/photo.png' } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('portfolio').textContent).toBe('http://backend/photo.png');
  });

  test('sets error when backend profile fetch fails (initial load)', async () => {
    const user = {
      getIdToken: jest.fn(() => Promise.resolve('tok')),
      photoURL: 'http://photo/user.png',
    };
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(user);
      return () => {};
    });
    authAPI.getCurrentUser.mockRejectedValueOnce(new Error('boom'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('error').textContent).toBe('boom');
  });

  test('handles user sign-out flow: clears token and resets state', async () => {
    const user = {
      getIdToken: jest.fn(() => Promise.resolve('tok')),
      photoURL: null,
    };
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(user);
      return () => {};
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('signout'));
    });

    const { signOut: firebaseSignOutLocal } = require('../services/firebase');
    expect(firebaseSignOutLocal).toHaveBeenCalled();
    expect(localStorage.getItem('firebaseToken')).toBe(null);
    // After signOut, context state should reflect no user
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('null'));
    expect(screen.getByTestId('portfolio').textContent).toBe('');
  });

  test('refreshUserProfile updates profile and respects photoURL fallback', async () => {
    const user = {
      getIdToken: jest.fn(() => Promise.resolve('tok')),
      photoURL: 'http://u/p.png',
    };
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(user);
      return () => {};
    });

    // First call for initial load -> backend without portfolio_url
    authAPI.getCurrentUser.mockResolvedValueOnce({ profile: {} });
    // Second call for refresh -> backend now has portfolio_url
    authAPI.getCurrentUser.mockResolvedValueOnce({ profile: { portfolio_url: 'http://backend/after.png' } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    // initial fallback uses user photo
    expect(screen.getByTestId('portfolio').textContent).toBe('http://u/p.png');

    await act(async () => {
      fireEvent.click(screen.getByTestId('refresh-profile'));
    });

    // After refresh, backend value should take precedence
    await waitFor(() => expect(screen.getByTestId('portfolio').textContent).toBe('http://backend/after.png'));
  });

  test('refreshUserProfile on refresh uses currentUser.photoURL when backend lacks portfolio_url', async () => {
    const user = {
      getIdToken: jest.fn(() => Promise.resolve('tok')),
      photoURL: 'http://u/p2.png',
    };
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(user);
      return () => {};
    });
    // initial effect: missing portfolio_url -> fallback to photoURL
    authAPI.getCurrentUser.mockResolvedValueOnce({ profile: {} });
    // refresh path: still missing -> fallback again
    authAPI.getCurrentUser.mockResolvedValueOnce({ profile: {} });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('portfolio').textContent).toBe('http://u/p2.png');

    await act(async () => {
      fireEvent.click(screen.getByTestId('refresh-profile'));
    });
    await waitFor(() => expect(screen.getByTestId('portfolio').textContent).toBe('http://u/p2.png'));
  });

  test('refreshUserProfile error path throws and is catchable by caller', async () => {
    const user = {
      getIdToken: jest.fn(() => Promise.resolve('tok')),
      photoURL: null,
    };
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(user);
      return () => {};
    });
    // initial load ok
    authAPI.getCurrentUser.mockResolvedValueOnce({ profile: {} });
    // refresh fails
    authAPI.getCurrentUser.mockRejectedValueOnce(new Error('refresh-fail'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('refresh-profile-error-trigger'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('refresh-fail');
    });
  });

  test('refreshToken returns null when no currentUser and does not write storage', async () => {
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(null);
      return () => {};
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('refresh-token'));
    });
    expect(localStorage.getItem('firebaseToken')).toBe(null);
    const tokens = screen.getAllByTestId('refreshed-token');
    expect(tokens[tokens.length - 1].textContent).toBe('');
  });

  test('refreshUserProfile without photoURL uses backend profile as-is', async () => {
    const user = {
      getIdToken: jest.fn(() => Promise.resolve('tok')),
      photoURL: null,
    };
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(user);
      return () => {};
    });
    // initial load
    authAPI.getCurrentUser.mockResolvedValueOnce({ profile: { portfolio_url: 'http://backend/initial.png' } });
    // after refresh
    authAPI.getCurrentUser.mockResolvedValueOnce({ profile: { portfolio_url: 'http://backend/refreshed.png' } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('portfolio').textContent).toBe('http://backend/initial.png');

    await act(async () => {
      fireEvent.click(screen.getByTestId('refresh-profile'));
    });
    await waitFor(() => expect(screen.getByTestId('portfolio').textContent).toBe('http://backend/refreshed.png'));
  });

  test('signOut propagates error when firebaseSignOut rejects', async () => {
    const user = {
      getIdToken: jest.fn(() => Promise.resolve('tok')),
      photoURL: null,
    };
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(user);
      return () => {};
    });
    const firebase = require('../services/firebase');
    firebase.signOut.mockRejectedValueOnce(new Error('signout-fail'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('signout'));
    });
    // Error is caught and surfaced via DOM by TestConsumer
    expect(firebase.signOut).toHaveBeenCalled();
    expect(screen.getByTestId('signout-error').textContent).toBe('signout-fail');
    expect(screen.getByTestId('user').textContent).toBe('user');
  });

  test('handles null user from onAuthStateChanged: clears token and profile', async () => {
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(null);
      return () => {};
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(localStorage.getItem('firebaseToken')).toBe(null);
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('portfolio').textContent).toBe('');
  });
});
