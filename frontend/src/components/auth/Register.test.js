import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../services/api', () => ({
  __esModule: true,
  authAPI: {
    register: jest.fn(),
    linkProviderToken: jest.fn(),
  },
}));

jest.mock('../../services/firebase', () => {
  const auth = { currentUser: null };
  const googleProvider = { providerId: 'google.com' };
  const githubProvider = { providerId: 'github.com' };
  return {
    __esModule: true,
    auth,
    googleProvider,
    githubProvider,
  };
});

jest.mock('firebase/auth', () => ({
  __esModule: true,
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  fetchSignInMethodsForEmail: jest.fn(),
  linkWithCredential: jest.fn(),
  signInWithCustomToken: jest.fn(),
  GoogleAuthProvider: { credentialFromError: jest.fn() },
  GithubAuthProvider: { credentialFromError: jest.fn() },
}));

import Register from './Register';
import { auth, googleProvider, githubProvider } from '../../services/firebase';
import { authAPI } from '../../services/api';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  signInWithCustomToken,
  GoogleAuthProvider,
  GithubAuthProvider,
} from 'firebase/auth';

const originalPrompt = window.prompt;
let consoleWarnSpy;
let consoleErrorSpy;
let consoleLogSpy;

const renderRegister = () =>
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );

const fillForm = (overrides = {}) => {
  fireEvent.change(screen.getByLabelText(/first name/i), {
    target: { value: overrides.firstName ?? 'John' },
  });
  fireEvent.change(screen.getByLabelText(/last name/i), {
    target: { value: overrides.lastName ?? 'Doe' },
  });
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: overrides.email ?? 'john@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: overrides.password ?? 'Password1' },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: overrides.confirmPassword ?? overrides.password ?? 'Password1' },
  });
};

describe('Register', () => {
  beforeAll(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
    auth.currentUser = null;
    localStorage.clear();
    window.prompt = jest.fn();
    signInWithEmailAndPassword.mockReset();
    signInWithPopup.mockReset();
    fetchSignInMethodsForEmail.mockReset();
    linkWithCredential.mockReset();
    signInWithCustomToken.mockReset();
    authAPI.register.mockReset();
    authAPI.linkProviderToken.mockReset();
    GoogleAuthProvider.credentialFromError.mockReset();
    GithubAuthProvider.credentialFromError.mockReset();
    mockNavigate.mockReset();
  });

  afterAll(() => {
    consoleWarnSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    consoleLogSpy?.mockRestore();
    window.prompt = originalPrompt;
  });

  it('renders all form fields and buttons', () => {
    renderRegister();

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign up$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up with github/i })).toBeInTheDocument();
  });

  it('shows validation errors when fields are empty', async () => {
    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(screen.getByText(/please confirm your password/i)).toBeInTheDocument();
    expect(authAPI.register).not.toHaveBeenCalled();
  });

  it('shows error for invalid email format', async () => {
    renderRegister();
    fillForm({ email: 'invalid' });
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
  });

  it('shows password validation feedback when requirements are not met', async () => {
    renderRegister();
    fillForm({ password: 'short', confirmPassword: 'short' });
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    expect(await screen.findByText(/password must be at least 8 characters long/i)).toBeInTheDocument();
    expect(screen.getByText(/password must contain at least one uppercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/password must contain at least one number/i)).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    renderRegister();
    fillForm({ password: 'Password1', confirmPassword: 'Different1' });
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('clears field specific errors when the user edits the input', async () => {
    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    await screen.findByText(/first name is required/i);
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jane' } });

    await waitFor(() => expect(screen.queryByText(/first name is required/i)).not.toBeInTheDocument());
  });

  it('clears API error banner when input changes', async () => {
    authAPI.register.mockRejectedValueOnce({});

    renderRegister();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    expect(await screen.findByText(/registration failed/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'new@example.com' } });

    await waitFor(() => expect(screen.queryByText(/registration failed/i)).not.toBeInTheDocument());
  });

  it('registers and signs in successfully storing firebase token', async () => {
    authAPI.register.mockResolvedValueOnce({});
    signInWithEmailAndPassword.mockImplementation(async () => {
      const user = { getIdToken: jest.fn().mockResolvedValue('token123') };
      auth.currentUser = user;
      return { user };
    });

    renderRegister();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    await waitFor(() =>
      expect(authAPI.register).toHaveBeenCalledWith({
        email: 'john@example.com',
        password: 'Password1',
        confirm_password: 'Password1',
        first_name: 'John',
        last_name: 'Doe',
      })
    );
    await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalled());
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('token123'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('displays backend error messages from response payload', async () => {
    authAPI.register.mockRejectedValueOnce({
      response: { data: { error: { message: 'Email already exists' } } },
    });

    renderRegister();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    expect(await screen.findByText(/email already exists/i)).toBeInTheDocument();
  });

  it('falls back to generic error string from backend', async () => {
    authAPI.register.mockRejectedValueOnce({
      response: { data: { error: 'Server busy' } },
    });

    renderRegister();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    expect(await screen.findByText(/server busy/i)).toBeInTheDocument();
  });

  it('shows message when firebase reports email already in use', async () => {
    authAPI.register.mockRejectedValueOnce({ code: 'auth/email-already-in-use' });

    renderRegister();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    expect(await screen.findByText(/account with this email already exists/i)).toBeInTheDocument();
  });

  it('surfaces weak password error from firebase', async () => {
    authAPI.register.mockRejectedValueOnce({ code: 'auth/weak-password' });

    renderRegister();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    expect(await screen.findByText(/password is too weak/i)).toBeInTheDocument();
  });

  it('shows generic message for unexpected registration errors', async () => {
    authAPI.register.mockRejectedValueOnce({});

    renderRegister();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    expect(await screen.findByText(/registration failed/i)).toBeInTheDocument();
  });

  it('handles successful Google sign up', async () => {
    const googleUser = { getIdToken: jest.fn().mockResolvedValue('google-token') };
    signInWithPopup.mockResolvedValueOnce({ user: googleUser });

    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /sign up with google/i }));

    await waitFor(() => expect(signInWithPopup).toHaveBeenCalledWith(auth, googleProvider));
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('google-token'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('handles successful GitHub sign up', async () => {
    const githubUser = { getIdToken: jest.fn().mockResolvedValue('github-token') };
    signInWithPopup.mockResolvedValueOnce({ user: githubUser });

    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /sign up with github/i }));

    await waitFor(() => expect(signInWithPopup).toHaveBeenCalledWith(auth, githubProvider));
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('github-token'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows cancellation message when Google popup is closed', async () => {
    signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });

    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /sign up with google/i }));

    await waitFor(() => expect(signInWithPopup).toHaveBeenCalled());
    expect(await screen.findByText('Google sign-up was cancelled.')).toBeInTheDocument();
  });

  it('shows cancellation message when GitHub popup is closed', async () => {
    signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });

    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /sign up with github/i }));

    await waitFor(() => expect(signInWithPopup).toHaveBeenCalled());
    expect(await screen.findByText('GitHub sign-up was cancelled.')).toBeInTheDocument();
  });

  it('shows fallback error for unexpected oauth failure', async () => {
    signInWithPopup.mockRejectedValueOnce({ code: 'auth/unknown' });

    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /sign up with google/i }));

    expect(await screen.findByText(/google sign-up failed/i)).toBeInTheDocument();
  });

  it('attempts provider linking via Google when account already exists', async () => {
    const pendingCred = { accessToken: 'access-token' };
    const linkedUser = { getIdToken: jest.fn().mockResolvedValue('linked-google') };

    signInWithPopup
      .mockRejectedValueOnce({
        code: 'auth/account-exists-with-different-credential',
        credential: pendingCred,
        customData: { email: 'user@example.com' },
      })
      .mockResolvedValueOnce({ user: linkedUser });
    authAPI.linkProviderToken.mockRejectedValueOnce(new Error('no exchange'));
    fetchSignInMethodsForEmail.mockResolvedValueOnce(['google.com']);
    linkWithCredential.mockResolvedValueOnce({});

    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /sign up with github/i }));

    await waitFor(() => expect(authAPI.linkProviderToken).toHaveBeenCalledWith('github', 'access-token'));
    await waitFor(() => expect(fetchSignInMethodsForEmail).toHaveBeenCalledWith(auth, 'user@example.com'));
    expect(signInWithPopup.mock.calls[1][1]).toBe(googleProvider);
    await waitFor(() => expect(linkWithCredential).toHaveBeenCalledWith(linkedUser, pendingCred));
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('linked-google'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('links accounts by signing in with existing GitHub provider', async () => {
    const pendingCred = { providerId: 'google.com' };
    const linkedUser = { getIdToken: jest.fn().mockResolvedValue('linked-github') };

    signInWithPopup
      .mockRejectedValueOnce({
        code: 'auth/account-exists-with-different-credential',
        credential: pendingCred,
        customData: { email: 'user@example.com' },
      })
      .mockResolvedValueOnce({ user: linkedUser });
    fetchSignInMethodsForEmail.mockResolvedValueOnce(['github.com']);
    linkWithCredential.mockResolvedValueOnce({});

    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /sign up with google/i }));

    await waitFor(() => expect(fetchSignInMethodsForEmail).toHaveBeenCalledWith(auth, 'user@example.com'));
    expect(signInWithPopup.mock.calls[1][1]).toBe(githubProvider);
    await waitFor(() => expect(linkWithCredential).toHaveBeenCalledWith(linkedUser, pendingCred));
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('linked-github'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('links accounts via password when prompted for email and password', async () => {
    const pendingCred = { providerId: 'google.com' };
    const linkedUser = { getIdToken: jest.fn().mockResolvedValue('pwd-token') };

    signInWithPopup.mockRejectedValueOnce({
      code: 'auth/account-exists-with-different-credential',
      credential: pendingCred,
    });
    window.prompt.mockReturnValueOnce(' user@example.com ').mockReturnValueOnce('Secret123!');
    fetchSignInMethodsForEmail.mockResolvedValueOnce(['password']);
    signInWithEmailAndPassword.mockResolvedValueOnce({ user: linkedUser });
    linkWithCredential.mockResolvedValueOnce({});

    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /sign up with google/i }));

    await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'user@example.com', 'Secret123!'));
    expect(linkWithCredential).toHaveBeenCalledWith(linkedUser, pendingCred);
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('pwd-token'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows message when user cancels password prompt during linking', async () => {
    const pendingCred = { providerId: 'google.com' };

    signInWithPopup.mockRejectedValueOnce({
      code: 'auth/account-exists-with-different-credential',
      credential: pendingCred,
      customData: { email: 'user@example.com' },
    });
    fetchSignInMethodsForEmail.mockResolvedValueOnce(['password']);
    window.prompt.mockReturnValueOnce('');

    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /sign up with google/i }));

    expect(await screen.findByText(/linking cancelled/i)).toBeInTheDocument();
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('prompts user to use the original provider when linking is not possible', async () => {
    const pendingCred = { providerId: 'google.com' };

    signInWithPopup.mockRejectedValueOnce({
      code: 'auth/account-exists-with-different-credential',
      credential: pendingCred,
      customData: { email: 'user@example.com' },
    });
    fetchSignInMethodsForEmail.mockResolvedValueOnce(['phone']);

    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /sign up with google/i }));

    expect(await screen.findByText(/sign in with the original provider/i)).toBeInTheDocument();
  });

  it('requests existing email and shows message when email is not provided', async () => {
    signInWithPopup.mockRejectedValueOnce({
      code: 'auth/account-exists-with-different-credential',
      credential: {},
      customData: {},
    });
    window.prompt.mockReturnValueOnce(null);

    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /sign up with google/i }));

    expect(await screen.findByText(/try signing in with the provider used previously/i)).toBeInTheDocument();
    expect(fetchSignInMethodsForEmail).not.toHaveBeenCalled();
  });

  it('signs in with custom token returned from backend during GitHub linking', async () => {
    const pendingCred = { accessToken: 'access-token', providerId: 'github.com' };
    const linkedUser = { getIdToken: jest.fn().mockResolvedValue('server-token') };

    signInWithPopup.mockRejectedValueOnce({
      code: 'auth/account-exists-with-different-credential',
      credential: null,
      customData: { email: 'user@example.com' },
    });
    GoogleAuthProvider.credentialFromError.mockReturnValueOnce(null);
    GithubAuthProvider.credentialFromError.mockReturnValueOnce(pendingCred);
    authAPI.linkProviderToken.mockResolvedValueOnce({ custom_token: 'custom-123' });
    signInWithCustomToken.mockImplementationOnce(async () => {
      auth.currentUser = linkedUser;
      return { user: linkedUser };
    });
    linkWithCredential.mockResolvedValueOnce({});

    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /sign up with github/i }));

    await waitFor(() => expect(GoogleAuthProvider.credentialFromError).toHaveBeenCalled());
    await waitFor(() => expect(GithubAuthProvider.credentialFromError).toHaveBeenCalled());
    await waitFor(() => expect(authAPI.linkProviderToken).toHaveBeenCalledWith('github', 'access-token'));
    expect(fetchSignInMethodsForEmail).not.toHaveBeenCalled();
    await waitFor(() => expect(linkWithCredential).toHaveBeenCalledWith(linkedUser, pendingCred));
    await waitFor(() => expect(localStorage.getItem('firebaseToken')).toBe('server-token'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
