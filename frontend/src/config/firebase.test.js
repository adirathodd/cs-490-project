/**
 * Tests for src/config/firebase.js
 * Verifies that the default export reflects environment variables.
 */

describe('config/firebase', () => {
  const KEYS = [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_STORAGE_BUCKET',
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    'REACT_APP_FIREBASE_APP_ID',
  ];

  const originalEnv = {};

  beforeEach(() => {
    // snapshot originals of just the keys we use
    KEYS.forEach((k) => {
      originalEnv[k] = process.env[k];
    });
  });

  afterEach(() => {
    // restore originals
    KEYS.forEach((k) => {
      if (typeof originalEnv[k] === 'undefined') {
        delete process.env[k];
      } else {
        process.env[k] = originalEnv[k];
      }
    });
  });

  it('exports firebaseConfig from environment variables', async () => {
    // arrange test env
    process.env.REACT_APP_FIREBASE_API_KEY = 'test-api-key';
    process.env.REACT_APP_FIREBASE_AUTH_DOMAIN = 'test-auth-domain';
    process.env.REACT_APP_FIREBASE_PROJECT_ID = 'test-project-id';
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET = 'test-storage-bucket';
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID = 'test-sender-id';
    process.env.REACT_APP_FIREBASE_APP_ID = 'test-app-id';

    // load module in an isolated registry so env is picked up fresh
    let cfg;
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      cfg = require('./firebase').default;
    });

    expect(cfg).toEqual({
      apiKey: 'test-api-key',
      authDomain: 'test-auth-domain',
      projectId: 'test-project-id',
      storageBucket: 'test-storage-bucket',
      messagingSenderId: 'test-sender-id',
      appId: 'test-app-id',
    });
  });
});
