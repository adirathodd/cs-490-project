import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, fetchSignInMethodsForEmail, linkWithCredential, GoogleAuthProvider, GithubAuthProvider, signInWithCustomToken } from 'firebase/auth';
import { auth, googleProvider, githubProvider } from '../services/firebase';
import { authAPI } from '../services/api';
import './Auth.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    return errors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear field-specific error when user starts typing
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

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // First name validation
    if (!formData.firstName) {
      newErrors.firstName = 'First name is required';
    }

    // Last name validation
    if (!formData.lastName) {
      newErrors.lastName = 'Last name is required';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const passwordErrors = validatePassword(formData.password);
      if (passwordErrors.length > 0) {
        newErrors.password = passwordErrors.join('. ');
      }
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      // Step 1: Register with backend (this creates the Firebase user)
      const backendResponse = await authAPI.register({
        email: formData.email,
        password: formData.password,
        confirm_password: formData.confirmPassword,
        first_name: formData.firstName,
        last_name: formData.lastName,
      });

      // Step 2: Sign in with Firebase using the credentials
      // (User already created by backend, so we just sign in)
      await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Step 3: Get Firebase ID token and store it
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        localStorage.setItem('firebaseToken', token);
      }

      // Step 4: Redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      console.log('Error details:', error.response?.data);
      
      if (error.response?.data?.error?.message) {
        setApiError(error.response.data.error.message);
      } else if (error.response?.data?.error) {
        setApiError(error.response.data.error);
      } else if (error.code === 'auth/email-already-in-use') {
        setApiError('An account with this email already exists. Please try logging in instead.');
      } else if (error.code === 'auth/weak-password') {
        setApiError('Password is too weak');
      } else {
        setApiError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => handleOAuthPopup(googleProvider, 'Google');

  const handleOAuthPopup = async (provider, providerName) => {
    setApiError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();
      localStorage.setItem('firebaseToken', token);
      navigate('/dashboard');
    } catch (error) {
      console.error(`${providerName} sign-up error:`, error);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        setApiError(`${providerName} sign-up was cancelled.`);
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        // Attempt to resolve by linking the pending credential to the existing account
        let pendingCred = error.credential;
        if (!pendingCred) {
          try {
            pendingCred = GoogleAuthProvider.credentialFromError ? GoogleAuthProvider.credentialFromError(error) : null;
            if (!pendingCred) {
              pendingCred = GithubAuthProvider.credentialFromError ? GithubAuthProvider.credentialFromError(error) : null;
            }
          } catch (e) {
            pendingCred = pendingCred || null;
          }
        }

        let email = error.customData?.email || error.email;

        // If provider didn't return an email (GitHub private email), ask the user for it
        if (!email) {
          const supplied = window.prompt('We could not read your email from the provider. Please enter the email for the account you already have so we can link providers:');
          if (supplied) {
            email = supplied.trim();
          }
        }

        if (!email) {
          setApiError('An account with this email exists. Try signing in with the provider used previously or email/password.');
        } else {
          // Try server-side exchange for GitHub to enable immediate sign-in if possible
          try {
            const accessToken = pendingCred?.accessToken || pendingCred?.oauthToken || pendingCred?.idToken;
            if (providerName === 'GitHub' && accessToken) {
              try {
                const resp = await authAPI.linkProviderToken('github', accessToken);
                const customToken = resp.custom_token || resp.customToken;
                if (customToken) {
                  await signInWithCustomToken(auth, customToken);
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
                // fallthrough to existing linking flow
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
        setApiError(`${providerName} sign-up failed. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  // LinkedIn/back-end flows removed — only Google and GitHub handled client-side via Firebase

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Create Your Account</h2>
        <p className="auth-subtitle">Start your job search journey today</p>

        {apiError && (
          <div className="error-banner">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className={errors.firstName ? 'error' : ''}
                disabled={loading}
              />
              {errors.firstName && (
                <span className="error-message">{errors.firstName}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className={errors.lastName ? 'error' : ''}
                disabled={loading}
              />
              {errors.lastName && (
                <span className="error-message">{errors.lastName}</span>
              )}
            </div>
          </div>

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
              autoComplete="new-password"
            />
            {errors.password && (
              <span className="error-message">{errors.password}</span>
            )}
            <div className="password-requirements">
              <small>
                Password must be at least 8 characters and contain uppercase, lowercase, and a number
              </small>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={errors.confirmPassword ? 'error' : ''}
              disabled={loading}
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <span className="error-message">{errors.confirmPassword}</span>
            )}
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div style={{textAlign: 'center', marginTop: 12}}>
          <div style={{margin: '12px 0', color: '#94a3b8'}}>or</div>
          <div style={{display: 'flex', gap: 8, flexDirection: 'column'}}>
            <button
              className="auth-button"
              onClick={handleGoogleSignUp}
              disabled={loading}
              aria-label="Sign up with Google"
            >
              {loading ? 'Processing...' : 'Sign up with Google'}
            </button>

            <button
              className="auth-button"
              onClick={() => handleOAuthPopup(githubProvider, 'GitHub')}
              disabled={loading}
              aria-label="Sign up with GitHub"
            >
              {loading ? 'Processing...' : 'Sign up with GitHub'}
            </button>

            {/* Only Google and GitHub sign-up provided */}
          </div>
        </div>

        <div className="auth-footer">
          <p>
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
