import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const firebaseAuth = require('firebase/auth');
const { signInWithEmailAndPassword, signInWithPopup, fetchSignInMethodsForEmail, linkWithCredential, signInWithCustomToken } = firebaseAuth;

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

  it('shows cancelled message when popup closed by user', async () => {
    signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });

    setup();
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));

    expect(await screen.findByText(/Google sign-in was cancelled\./i)).toBeInTheDocument();
  });

  it('resolves account-exists-with-different-credential by signing in with existing oauth provider and linking', async () => {
    // First popup (GitHub) fails with account-exists-with-different-credential
    const pendingCred = { accessToken: 'atoken' };
    signInWithPopup
      .mockRejectedValueOnce({ code: 'auth/account-exists-with-different-credential', email: 'linkme@example.com', credential: pendingCred })
      // Second popup (Google) will succeed
      .mockResolvedValueOnce({ user: { getIdToken: jest.fn().mockResolvedValue('oauth-linked-token') } });

    // fetchSignInMethodsForEmail returns google.com
    if (fetchSignInMethodsForEmail) {
      fetchSignInMethodsForEmail.mockResolvedValueOnce(['google.com']);
    } else {
      firebaseAuth.fetchSignInMethodsForEmail = jest.fn().mockResolvedValueOnce(['google.com']);
    }

    // linkWithCredential resolves
    if (linkWithCredential) {
      linkWithCredential.mockResolvedValueOnce(true);
    } else {
      firebaseAuth.linkWithCredential = jest.fn().mockResolvedValueOnce(true);
    }

    const navigate = jest.fn();
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigate);

    setup();
    // Trigger GitHub sign in which will start the account-exists flow
    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));

    await waitFor(() => expect(signInWithPopup).toHaveBeenCalled());
    // Will attempt to fetch sign-in methods for the returned email
    await waitFor(() => expect(firebaseAuth.fetchSignInMethodsForEmail).toHaveBeenCalledWith(expect.anything(), 'linkme@example.com'));

    // After successful Google popup, token stored and navigation
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('oauth-linked-token'));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('resolves account-exists-with-different-credential by prompting for password and linking to existing account', async () => {
    const pendingCred = { providerId: 'github.com' };
    signInWithPopup.mockRejectedValueOnce({ code: 'auth/account-exists-with-different-credential', email: 'pwlink@example.com', credential: pendingCred });

    // fetchSignInMethodsForEmail returns password
    if (fetchSignInMethodsForEmail) {
      fetchSignInMethodsForEmail.mockResolvedValueOnce(['password']);
    } else {
      firebaseAuth.fetchSignInMethodsForEmail = jest.fn().mockResolvedValueOnce(['password']);
    }

    // Simulate user inputting password via prompt
    window.prompt = jest.fn(() => 'supplied-password');

    // Signing in with email/password succeeds
    signInWithEmailAndPassword.mockResolvedValueOnce({ user: { getIdToken: jest.fn().mockResolvedValue('pw-linked-token') } });

    // linkWithCredential resolves
    if (linkWithCredential) {
      linkWithCredential.mockResolvedValueOnce(true);
    } else {
      firebaseAuth.linkWithCredential = jest.fn().mockResolvedValueOnce(true);
    }

    const navigate = jest.fn();
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigate);

    setup();
    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));

    await waitFor(() => expect(signInWithPopup).toHaveBeenCalled());
    await waitFor(() => expect(firebaseAuth.fetchSignInMethodsForEmail).toHaveBeenCalledWith(expect.anything(), 'pwlink@example.com'));
    await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'pwlink@example.com', 'supplied-password'));
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('pw-linked-token'));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('exchanges GitHub access token on server and signs in with custom token', async () => {
    // Simulate initial popup failure with credential containing accessToken
    const pendingCred = { accessToken: 'gh-access-token' };
    signInWithPopup.mockRejectedValueOnce({
      code: 'auth/account-exists-with-different-credential',
      email: 'exchange@example.com',
      credential: pendingCred,
    });

    // Mock server call to exchange provider token for firebase custom token
    const api = require('../../services/api').authAPI;
    api.linkProviderToken = jest.fn().mockResolvedValueOnce({ custom_token: 'custom-ctoken' });

    // Mock signInWithCustomToken to sign the user in and set auth.currentUser
    const firebase = require('firebase/auth');
    const servicesFirebase = require('../../services/firebase');
    // ensure auth object exists
    servicesFirebase.auth = servicesFirebase.auth || {};
    // signInWithCustomToken will set servicesFirebase.auth.currentUser so Login.js can call getIdToken on it
    firebase.signInWithCustomToken = jest.fn().mockImplementationOnce(async () => {
      servicesFirebase.auth.currentUser = { getIdToken: async () => 'after-custom-token' };
      return { user: servicesFirebase.auth.currentUser };
    });
    // linkWithCredential should be attempted after custom token sign-in
    firebase.linkWithCredential = jest.fn().mockResolvedValueOnce(true);

    const navigate = jest.fn();
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigate);

    setup();
    // Trigger GitHub sign in which will start the exchange flow
    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));

    await waitFor(() => expect(signInWithPopup).toHaveBeenCalled());
    await waitFor(() => expect(api.linkProviderToken).toHaveBeenCalledWith('github', 'gh-access-token'));
    await waitFor(() => expect(firebase.signInWithCustomToken).toHaveBeenCalledWith(expect.anything(), 'custom-ctoken'));
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('after-custom-token'));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('prompts for email when provider email missing then links via password', async () => {
    // provider error without email
    const pendingCred = { providerId: 'github.com' };
    signInWithPopup.mockRejectedValueOnce({ code: 'auth/account-exists-with-different-credential', credential: pendingCred });

    // Simulate user entering email when prompted
    window.prompt = jest.fn(() => 'prompted@example.com');

    // fetchSignInMethodsForEmail returns password flow
    const firebase = require('firebase/auth');
    firebase.fetchSignInMethodsForEmail = jest.fn().mockResolvedValueOnce(['password']);

    // sign in with email/password resolves
    signInWithEmailAndPassword.mockResolvedValueOnce({ user: { getIdToken: jest.fn().mockResolvedValue('prompt-linked-token') } });

    const navigate = jest.fn();
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigate);

    setup();
    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));

    await waitFor(() => expect(signInWithPopup).toHaveBeenCalled());
    await waitFor(() => expect(firebase.fetchSignInMethodsForEmail).toHaveBeenCalledWith(expect.anything(), 'prompted@example.com'));
    await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'prompted@example.com', expect.any(String)));
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('prompt-linked-token'));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('attempts OAuth->OAuth linking when existing method is google.com', async () => {
    const pendingCred = { providerId: 'github.com', accessToken: 'x' };
    // First popup (GitHub) fails, second (Google) succeeds
    signInWithPopup
      .mockRejectedValueOnce({ code: 'auth/account-exists-with-different-credential', email: 'oauthlink@example.com', credential: pendingCred })
      .mockResolvedValueOnce({ user: { getIdToken: jest.fn().mockResolvedValue('oauth-flow-token') } });

    const firebase = require('firebase/auth');
    firebase.fetchSignInMethodsForEmail = jest.fn().mockResolvedValueOnce(['google.com']);
    firebase.linkWithCredential = jest.fn().mockResolvedValueOnce(true);

    const navigate = jest.fn();
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigate);

    setup();
    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));

    await waitFor(() => expect(signInWithPopup).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(firebase.linkWithCredential).toHaveBeenCalled());
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('oauth-flow-token'));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('handles missing pending credential and cancelled prompt by showing linking message', async () => {
    // error with no credential and no email
    signInWithPopup.mockRejectedValueOnce({ code: 'auth/account-exists-with-different-credential' });

    // Make provider helper credentialFromError throw to simulate edge behavior
    const firebase = require('firebase/auth');
    firebase.GoogleAuthProvider = { credentialFromError: jest.fn(() => { throw new Error('no'); }) };
    firebase.GithubAuthProvider = { credentialFromError: jest.fn(() => null) };

    // user cancels prompt (no email supplied)
    window.prompt = jest.fn(() => null);

    setup();
    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));

    // expect the friendly linking message to be shown
    expect(await screen.findByText(/An account with this email exists\. Please sign in with the original provider or email\/password to link accounts\./i)).toBeInTheDocument();
  });

  it('falls back to password linking when server exchange fails', async () => {
    const pendingCred = { accessToken: 'gh-access-token' };
    // initial popup fails and we have accessToken
    signInWithPopup.mockRejectedValueOnce({ code: 'auth/account-exists-with-different-credential', email: 'fallback@example.com', credential: pendingCred });

    // server exchange fails
    const api = require('../../services/api').authAPI;
    api.linkProviderToken = jest.fn().mockRejectedValueOnce(new Error('server fail'));

    // fetchSignInMethodsForEmail returns password so we'll prompt for password
    const firebase = require('firebase/auth');
    firebase.fetchSignInMethodsForEmail = jest.fn().mockResolvedValueOnce(['password']);

    // prompt returns password
    window.prompt = jest.fn(() => 'thepw');

    // sign in with email/password succeeds
    signInWithEmailAndPassword.mockResolvedValueOnce({ user: { getIdToken: jest.fn().mockResolvedValue('fallback-token') } });

    const navigate = jest.fn();
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigate);

    setup();
    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));

    await waitFor(() => expect(api.linkProviderToken).toHaveBeenCalled());
    await waitFor(() => expect(firebase.fetchSignInMethodsForEmail).toHaveBeenCalledWith(expect.anything(), 'fallback@example.com'));
    await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'fallback@example.com', 'thepw'));
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('fallback-token'));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows message when no supported sign-in methods exist for the email', async () => {
    const pendingCred = { providerId: 'github.com' };
    signInWithPopup.mockRejectedValueOnce({ code: 'auth/account-exists-with-different-credential', email: 'nosupport@example.com', credential: pendingCred });

    const firebase = require('firebase/auth');
    firebase.fetchSignInMethodsForEmail = jest.fn().mockResolvedValueOnce(['facebook.com']);

    setup();
    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));

    expect(await screen.findByText(/An account with this email exists. Please sign in with the original provider to link accounts\./i)).toBeInTheDocument();
  });

  it('uses provider helper credentialFromError when error.credential is missing', async () => {
    // simulate popup error with no credential, but provider helper returns one
    const pendingCred = { providerId: 'github.com', oauthToken: 'helper-token' };
    signInWithPopup.mockRejectedValueOnce({ code: 'auth/account-exists-with-different-credential', email: 'helper@example.com' });

    const firebase = require('firebase/auth');
    // make GoogleAuthProvider.credentialFromError return our pendingCred
    firebase.GoogleAuthProvider = { credentialFromError: jest.fn(() => pendingCred) };
    firebase.GithubAuthProvider = { credentialFromError: jest.fn(() => null) };

    // fetchSignInMethodsForEmail returns password so it will go to password flow after using helper
    firebase.fetchSignInMethodsForEmail = jest.fn().mockResolvedValueOnce(['password']);
    // prompt for password
    window.prompt = jest.fn(() => 'helper-pw');
    // sign in with email/password resolves
    signInWithEmailAndPassword.mockResolvedValueOnce({ user: { getIdToken: jest.fn().mockResolvedValue('helper-token-stored') } });

    const navigate = jest.fn();
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigate);

    setup();
    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));

    await waitFor(() => expect(firebase.GoogleAuthProvider.credentialFromError).toHaveBeenCalled());
    await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'helper@example.com', 'helper-pw'));
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('helper-token-stored'));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('handles fetchSignInMethodsForEmail throwing and shows linking error', async () => {
    const pendingCred = { providerId: 'github.com' };
    signInWithPopup.mockRejectedValueOnce({ code: 'auth/account-exists-with-different-credential', email: 'throw@example.com', credential: pendingCred });

    const firebase = require('firebase/auth');
    firebase.fetchSignInMethodsForEmail = jest.fn().mockRejectedValueOnce(new Error('boom'));

    setup();
    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));

    expect(await screen.findByText(/Could not automatically link accounts\. Please sign in with your existing method and link providers from account settings\./i)).toBeInTheDocument();
  });

  it('handles oauthProvider === github.com linking path', async () => {
    const pendingCred = { providerId: 'github.com' };
    signInWithPopup
      .mockRejectedValueOnce({ code: 'auth/account-exists-with-different-credential', email: 'ghlink@example.com', credential: pendingCred })
      .mockResolvedValueOnce({ user: { getIdToken: jest.fn().mockResolvedValue('gh-linked-token') } });

    const firebase = require('firebase/auth');
    firebase.fetchSignInMethodsForEmail = jest.fn().mockResolvedValueOnce(['github.com']);
    firebase.linkWithCredential = jest.fn().mockResolvedValueOnce(true);

    const navigate = jest.fn();
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigate);

    setup();
    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));

    await waitFor(() => expect(signInWithPopup).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(firebase.linkWithCredential).toHaveBeenCalled());
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('gh-linked-token'));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('clears field error and apiError when user types after a failed sign-in', async () => {
    // Mock sign-in to fail with wrong-password so an apiError is shown
    signInWithEmailAndPassword.mockRejectedValueOnce({ code: 'auth/wrong-password' });

    setup();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'u@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    // wait for API error to be displayed
    expect(await screen.findByText(/Incorrect password/i)).toBeInTheDocument();

    // Type into email field - should clear the apiError
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'u2@example.com' } });
    expect(screen.queryByText(/Incorrect password/i)).not.toBeInTheDocument();
  });

  it('disables submit button while sign-in promise is pending', async () => {
    let resolveSign;
    signInWithEmailAndPassword.mockImplementationOnce(() => new Promise(res => { resolveSign = res; }));

    setup();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Secret123!' } });

    const btn = screen.getByRole('button', { name: /^sign in$/i });
    fireEvent.click(btn);

    // Button should be disabled while pending
    expect(btn).toBeDisabled();

    // resolve the sign-in
    resolveSign({ user: { getIdToken: jest.fn().mockResolvedValue('x') } });
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('x'));
  });

  const authErrorCases = [
    ['auth/invalid-email', /Invalid email address/i],
    ['auth/user-disabled', /This account has been disabled/i],
    ['auth/too-many-requests', /Too many failed attempts/i],
    ['auth/invalid-credential', /Invalid email or password/i],
  ];

  test.each(authErrorCases)('shows friendly message for %s', async (code, expected) => {
    signInWithEmailAndPassword.mockRejectedValueOnce({ code });

    setup();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it('accepts server response with customToken key and signs in', async () => {
    const pendingCred = { accessToken: 'gh-access-token' };
    signInWithPopup.mockRejectedValueOnce({ code: 'auth/account-exists-with-different-credential', email: 'alt@example.com', credential: pendingCred });

    const api = require('../../services/api').authAPI;
    api.linkProviderToken = jest.fn().mockResolvedValueOnce({ customToken: 'alt-ctoken' });

    const firebase = require('firebase/auth');
    const servicesFirebase = require('../../services/firebase');
    servicesFirebase.auth = servicesFirebase.auth || {};
    firebase.signInWithCustomToken = jest.fn().mockImplementationOnce(async () => {
      servicesFirebase.auth.currentUser = { getIdToken: async () => 'alt-token' };
      return { user: servicesFirebase.auth.currentUser };
    });

    const navigate = jest.fn();
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigate);

    setup();
    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));

    await waitFor(() => expect(api.linkProviderToken).toHaveBeenCalledWith('github', 'gh-access-token'));
    await waitFor(() => expect(firebase.signInWithCustomToken).toHaveBeenCalledWith(expect.anything(), 'alt-ctoken'));
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('alt-token'));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows linking cancelled if user declines to supply password', async () => {
    const pendingCred = { providerId: 'github.com' };
    signInWithPopup.mockRejectedValueOnce({ code: 'auth/account-exists-with-different-credential', email: 'cancelpw@example.com', credential: pendingCred });

    const firebase = require('firebase/auth');
    firebase.fetchSignInMethodsForEmail = jest.fn().mockResolvedValueOnce(['password']);

    // user cancels prompt
    window.prompt = jest.fn(() => '');

    setup();
    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));

    expect(await screen.findByText(/Linking cancelled. Please sign in with your existing method to link providers\./i)).toBeInTheDocument();
  });
});
