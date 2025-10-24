
import React, { useEffect, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  auth,
  verifyPasswordResetCode,
  confirmPasswordReset,
  signInWithEmailAndPassword,
} from '../services/firebase';
import './Auth.css';

const useQuery = () => new URLSearchParams(useLocation().search);

const ResetPassword = () => {
  const navigate = useNavigate();
  const query = useQuery();
  const oobCode = query.get('oobCode');
  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState('');
  const [email, setEmail] = useState('');
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        if (!oobCode) {
          setVerifyError('Missing or invalid reset code.');
          return;
        }
        const mail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(mail);
      } catch (err) {
        setVerifyError('This reset link is invalid or has expired.');
      } finally {
        setVerifying(false);
      }
    };
    run();
  }, [oobCode]);

  const validatePassword = (password) => {
    const problems = [];
    if (password.length < 8) problems.push('Password must be at least 8 characters long');
    if (!/[A-Z]/.test(password)) problems.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password)) problems.push('Password must contain at least one lowercase letter');
    if (!/[0-9]/.test(password)) problems.push('Password must contain at least one number');
    return problems;
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const [resetSuccess, setResetSuccess] = useState(false);
  const onSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.password) {
      nextErrors.password = 'Password is required';
    } else {
      const pwErrors = validatePassword(form.password);
      if (pwErrors.length) nextErrors.password = pwErrors.join('. ');
    }
    if (!form.confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password';
    } else if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, form.password);
      setResetSuccess(true);
    } catch (err) {
      setErrors({ password: 'Failed to reset password. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {verifying ? (
          <>
            <h2>Verifying link…</h2>
          </>
        ) : verifyError ? (
          <>
            <h2>Reset Link Error</h2>
            <p className="auth-subtitle">{verifyError}</p>
            <div className="auth-footer">
              <p><Link to="/forgot-password">Request a new reset link</Link></p>
            </div>
          </>
        ) : resetSuccess ? (
          <>
            <h2>Password Reset Successful</h2>
            <p className="auth-subtitle">Your password has been reset. You may now return to the login page.</p>
            <div className="auth-footer">
              <Link to="/login" className="auth-button" style={{ color: '#fff' }}>Return to Login</Link>
            </div>
          </>
        ) : (
          <>
            <h2>Reset Your Password</h2>
            <p className="auth-subtitle">Resetting password for {email}</p>
            <form onSubmit={onSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={form.password}
                  onChange={onChange}
                  className={errors.password ? 'error' : ''}
                  disabled={submitting}
                  autoComplete="new-password"
                />
                {errors.password && <span className="error-message">{errors.password}</span>}
                <div className="password-requirements">
                  <small>Must be 8+ chars, include uppercase, lowercase, and a number</small>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={onChange}
                  className={errors.confirmPassword ? 'error' : ''}
                  disabled={submitting}
                  autoComplete="new-password"
                />
                {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
              </div>
              <button type="submit" className="auth-button" disabled={submitting}>
                {submitting ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;

