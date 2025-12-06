import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import emailAPI from '../../services/emailAPI';
import './GmailCallback.css';

const GmailCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Connecting your Gmail account...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const storedState = sessionStorage.getItem('gmail_oauth_state');

      // Handle OAuth errors
      if (error) {
        setStatus('error');
        setMessage(`Authentication failed: ${error}`);
        setTimeout(() => navigate('/profile/edit'), 3000);
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setMessage('Missing required parameters from Google');
        setTimeout(() => navigate('/profile/edit'), 3000);
        return;
      }

      if (state !== storedState) {
        setStatus('error');
        setMessage('Invalid OAuth state. Please try connecting again.');
        setTimeout(() => navigate('/profile/edit'), 3000);
        return;
      }

      const redirectUri = `${window.location.origin}/gmail-callback`;
      await emailAPI.completeGmailAuth(code, state, redirectUri);

      sessionStorage.removeItem('gmail_oauth_state');
      setStatus('success');
      setMessage('Gmail connected successfully! Scanning your emails...');
      
      setTimeout(() => {
        navigate('/profile/edit');
      }, 2000);

    } catch (error) {
      console.error('Gmail OAuth failed:', error);
      setStatus('error');
      
      // Extract error message from various possible error formats
      let errorMessage = 'Failed to connect Gmail. Please try again.';
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setMessage(errorMessage);
      setTimeout(() => navigate('/profile/edit'), 5000); // Give more time to read error
    }
  };

  return (
    <div className="gmail-callback">
      <div className="gmail-callback-card">
        {status === 'processing' && (
          <>
            <div className="spinner"></div>
            <h2>{message}</h2>
            <p>Please wait...</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="success-icon">✓</div>
            <h2>Success!</h2>
            <p>{message}</p>
            <p className="redirect-message">Redirecting to your profile...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="error-icon">✗</div>
            <h2>Connection Failed</h2>
            <p>{message}</p>
            <p className="redirect-message">Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default GmailCallback;
