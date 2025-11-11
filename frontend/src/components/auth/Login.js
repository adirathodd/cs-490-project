import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, fetchSignInMethodsForEmail, linkWithCredential, GoogleAuthProvider, GithubAuthProvider, signInWithCustomToken } from 'firebase/auth';
import { auth, googleProvider, githubProvider } from '../../services/firebase';
import { authAPI } from '../../services/api';
import './Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    setApiError('');
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Get and store Firebase ID token
      const token = await userCredential.user.getIdToken();
      localStorage.setItem('firebaseToken', token);

      // Check for return URL and redirect accordingly
      const returnUrl = localStorage.getItem('returnUrl');
      if (returnUrl) {
        localStorage.removeItem('returnUrl');
        navigate(returnUrl);
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      
      if (error.code === 'auth/user-not-found') {
        setApiError('No account found with this email address');
      } else if (error.code === 'auth/wrong-password') {
        setApiError('Incorrect password');
      } else if (error.code === 'auth/invalid-email') {
        setApiError('Invalid email address');
      } else if (error.code === 'auth/user-disabled') {
        setApiError('This account has been disabled');
      } else if (error.code === 'auth/too-many-requests') {
        setApiError('Too many failed attempts. Please try again later');
      } else if (error.code === 'auth/invalid-credential') {
        setApiError('Invalid email or password');
      } else {
        setApiError('Login failed. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => handleOAuthPopup(googleProvider, 'Google');

  const handleOAuthPopup = async (provider, providerName) => {
    setApiError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();
      localStorage.setItem('firebaseToken', token);
      
      // Check for return URL and redirect accordingly
      const returnUrl = localStorage.getItem('returnUrl');
      if (returnUrl) {
        localStorage.removeItem('returnUrl');
        navigate(returnUrl);
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error(`${providerName} sign-in error:`, error);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        setApiError(`${providerName} sign-in was cancelled.`);
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        // Try to resolve by linking the pending credential to the existing account
        // Some errors may not include error.credential directly; attempt to extract
        // the pending credential using provider helpers as a fallback.
        let pendingCred = error.credential;
        if (!pendingCred) {
          try {
            // Try both provider helpers; credentialFromError will return the credential when available
            pendingCred = GoogleAuthProvider.credentialFromError ? GoogleAuthProvider.credentialFromError(error) : null;
            if (!pendingCred) {
              pendingCred = GithubAuthProvider.credentialFromError ? GithubAuthProvider.credentialFromError(error) : null;
            }
          } catch (e) {
            // ignore - we'll handle missing credential below
            pendingCred = pendingCred || null;
          }
        }

        let email = error.customData?.email || error.email;

        // Some providers (notably GitHub when email is private) don't return the email.
        // Ask the user for their account email so we can look up sign-in methods and link.
        if (!email) {
          const supplied = window.prompt('We could not read your email from the provider. Please enter the email for the account you already have so we can link providers:');
          if (supplied) {
            email = supplied.trim();
          }
        }

        if (!email) {
          setApiError('An account with this email exists. Please sign in with the original provider or email/password to link accounts.');
        } else {
          // If GitHub provided an access token, try to exchange it on the server for a
          // Firebase custom token for the existing account so we can sign in immediately.
          try {
            const accessToken = pendingCred?.accessToken || pendingCred?.oauthToken || pendingCred?.idToken;
            if (providerName === 'GitHub' && accessToken) {
              try {
                const resp = await authAPI.linkProviderToken('github', accessToken);
                const customToken = resp.custom_token || resp.customToken;
                if (customToken) {
                  // Sign in with custom token, then link the pending credential so future logins work
                  const signed = await signInWithCustomToken(auth, customToken);
                  if (pendingCred) {
                    try { await linkWithCredential(auth.currentUser, pendingCred); } catch (linkErr) { console.warn('Link after custom token failed', linkErr); }
                  }
                  const token = await auth.currentUser.getIdToken();
                  localStorage.setItem('firebaseToken', token);
                  navigate('/dashboard');
                  return;
                }
              } catch (err) {
                console.warn('Server exchange for custom token failed', err);
                // fallthrough to normal linking flow
              }
            }
          } catch (e) {
            console.warn('Automatic provider exchange failed', e);
          }
          try {
            const methods = await fetchSignInMethodsForEmail(auth, email);

            // Prefer OAuth->OAuth linking: if an OAuth provider exists, attempt it first (automatic popup)
            const oauthProvider = methods.find(m => m === 'google.com' || m === 'github.com');

            if (oauthProvider && pendingCred) {
              // If there is a matching OAuth provider, prompt the user to sign in with it and then link
              if (oauthProvider === 'google.com') {
                const res = await signInWithPopup(auth, googleProvider);
                await linkWithCredential(res.user, pendingCred);
                const token = await res.user.getIdToken();
                localStorage.setItem('firebaseToken', token);
                navigate('/dashboard');
              } else if (oauthProvider === 'github.com') {
                const res = await signInWithPopup(auth, githubProvider);
                await linkWithCredential(res.user, pendingCred);
                const token = await res.user.getIdToken();
                localStorage.setItem('firebaseToken', token);
                navigate('/dashboard');
              }
            } else if (methods.includes('password')) {
              // If the existing account uses email/password, prompt for password and link
              const password = window.prompt('An account with this email already exists. Please enter your password to sign in and link the OAuth provider to your account:');
              if (!password) {
                setApiError('Linking cancelled. Please sign in with your existing method to link providers.');
              } else {
                const userCred = await signInWithEmailAndPassword(auth, email, password);
                if (pendingCred) {
                  await linkWithCredential(userCred.user, pendingCred);
                }
                const token = await userCred.user.getIdToken();
                localStorage.setItem('firebaseToken', token);
                navigate('/dashboard');
              }
            } else {
              setApiError('An account with this email exists. Please sign in with the original provider to link accounts.');
            }
          } catch (linkError) {
            console.error('Error while resolving account linking:', linkError);
            setApiError('Could not automatically link accounts. Please sign in with your existing method and link providers from account settings.');
          }
        }
      } else {
        setApiError(`${providerName} sign-in failed. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Welcome Back</h2>
        <p className="auth-subtitle">Sign in to continue your job search</p>

        {apiError && (
          <div className="error-banner">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'error' : ''}
              disabled={loading}
              autoComplete="email"
            />
            {errors.email && (
              <span className="error-message">{errors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={errors.password ? 'error' : ''}
              disabled={loading}
              autoComplete="current-password"
            />
            {errors.password && (
              <span className="error-message">{errors.password}</span>
            )}
          </div>

          <div className="form-options">
            <Link to="/forgot-password" className="forgot-password">
              Forgot Password?
            </Link>
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

          <div style={{textAlign: 'center', marginTop: 12}}>
            <div style={{margin: '12px 0', color: '#94a3b8'}}>or</div>
            <div style={{display: 'flex', gap: 8, flexDirection: 'column'}}>
              <button
                className="auth-button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                aria-label="Sign in with Google"
              >
                {loading ? 'Processing...' : 'Sign in with Google'}
              </button>

              <button
                className="auth-button"
                onClick={() => handleOAuthPopup(githubProvider, 'GitHub')}
                disabled={loading}
                aria-label="Sign in with GitHub"
              >
                {loading ? 'Processing...' : 'Sign in with GitHub'}
              </button>
            </div>
        </div>

        <div className="auth-footer">
          <p>
            Don't have an account? <Link to="/register">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
