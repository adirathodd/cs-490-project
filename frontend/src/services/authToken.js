import { auth } from './firebase';

const isValidToken = (token) => {
  if (!token) return false;
  const trimmed = String(token).trim();
  return trimmed.length > 0 && trimmed !== 'null' && trimmed !== 'undefined';
};

export const getStoredFirebaseToken = () => {
  try {
    const token = localStorage.getItem('firebaseToken');
    return isValidToken(token) ? token : null;
  } catch (_) {
    return null;
  }
};

export const ensureFirebaseToken = async (forceRefresh = false) => {
  if (!forceRefresh) {
    const existing = getStoredFirebaseToken();
    if (existing) return existing;
  }

  const currentUser = auth?.currentUser;
  if (!currentUser) {
    if (forceRefresh) {
      try {
        localStorage.removeItem('firebaseToken');
      } catch (_) {
        // ignore
      }
    }
    return getStoredFirebaseToken();
  }

  try {
    const token = await currentUser.getIdToken(forceRefresh);
    localStorage.setItem('firebaseToken', token);
    return token;
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Failed to refresh Firebase token', error);
    }
    return getStoredFirebaseToken();
  }
};

const normalizeHeaders = (headers = {}) => {
  if (headers instanceof Headers) {
    const result = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  if (Array.isArray(headers)) {
    return headers.reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }
  return { ...headers };
};

const buildConfigWithToken = async (init = {}, forceRefresh = false) => {
  const token = await ensureFirebaseToken(forceRefresh);
  const headers = normalizeHeaders(init.headers);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (headers.Authorization) {
    delete headers.Authorization;
  }
  return {
    ...init,
    headers,
  };
};

/**
 * Wrap fetch with automatic Firebase token injection and a single retry on 401.
 */
export const authorizedFetch = async (input, init = {}, options = {}) => {
  const { retryOnAuthError = true } = options;
  let response = await fetch(input, await buildConfigWithToken(init, false));

  if (retryOnAuthError && response && response.status === 401) {
    const retryConfig = await buildConfigWithToken(init, true);
    response = await fetch(input, retryConfig);
  }

  return response;
};
