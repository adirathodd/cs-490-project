import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { teamAPI } from '../../services/api';
import './TeamDashboard.css';

export default function TeamInviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');
  const [teamName, setTeamName] = useState('');

  useEffect(() => {
    const acceptInvite = async () => {
      try {
        const result = await teamAPI.acceptInvite(token);
        setTeamName(result.team?.name || 'the team');
        setStatus('success');
        setMessage('You have successfully joined the team!');
        // Redirect to team dashboard after 2 seconds
        setTimeout(() => {
          navigate('/team');
        }, 2000);
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Failed to accept invitation. It may have expired or already been used.');
      }
    };

    if (token) {
      acceptInvite();
    }
  }, [token, navigate]);

  return (
    <div className="team-page">
      <div className="invite-accept-container">
        {status === 'loading' && (
          <div className="invite-accept-card">
            <div className="invite-accept-icon">⏳</div>
            <h2>Accepting invitation...</h2>
            <p className="muted">Please wait while we process your invitation.</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="invite-accept-card success">
            <div className="invite-accept-icon">🎉</div>
            <h2>Welcome to {teamName}!</h2>
            <p>{message}</p>
            <p className="muted">Redirecting to team dashboard...</p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="invite-accept-card error">
            <div className="invite-accept-icon">❌</div>
            <h2>Invitation Error</h2>
            <p>{message}</p>
            <button 
              className="primary-btn" 
              onClick={() => navigate('/login')}
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
