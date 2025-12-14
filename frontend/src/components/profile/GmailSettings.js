import React, { useState, useEffect } from 'react';
import emailAPI from '../../services/emailAPI';
import Toast from '../common/Toast';
import ConfirmDialog from '../common/ConfirmDialog';
import APIErrorBanner from '../common/APIErrorBanner'; // UC-117: User-facing API error handling
import './GmailSettings.css';

const GmailSettings = () => {
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'info' });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false });
  const [pollingInterval, setPollingInterval] = useState(null);
  const [apiError, setApiError] = useState(null); // UC-117: Track API errors

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    // Auto-refresh when scanning
    if (integration && integration.status === 'scanning') {
      const interval = setInterval(() => {
        loadStatus();
      }, 3000); // Poll every 3 seconds
      setPollingInterval(interval);
      
      return () => clearInterval(interval);
    } else if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
      
      // Dispatch event when scan completes
      if (integration && integration.status === 'connected') {
        window.dispatchEvent(new CustomEvent('gmail-scan-complete'));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration?.status]);

  const loadStatus = async () => {
    try {
      const data = await emailAPI.getGmailStatus();
      setIntegration(data);
    } catch (error) {
      console.error('Failed to load Gmail status:', error);
      setIntegration(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const redirectUri = `${window.location.origin}/gmail-callback`;
      const { auth_url, state } = await emailAPI.startGmailAuth(redirectUri);
      
      sessionStorage.setItem('gmail_oauth_state', state);
      window.location.href = auth_url;
    } catch (error) {
      console.error('Failed to start Gmail connection:', error);
      setToast({
        isOpen: true,
        message: 'Failed to start Gmail connection. Please try again.',
        type: 'error'
      });
    }
  };

  const handleDisconnect = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Disconnect Gmail',
      message: 'Are you sure you want to disconnect Gmail? All scanned emails will be deleted and scanning will stop.',
      onConfirm: async () => {
        try {
          await emailAPI.disconnectGmail();
          await loadStatus();
          
          // Dispatch custom event to notify other components
          window.dispatchEvent(new CustomEvent('gmail-disconnected'));
          
          setToast({
            isOpen: true,
            message: 'Gmail disconnected successfully. All emails have been removed.',
            type: 'success'
          });
        } catch (error) {
          console.error('Failed to disconnect Gmail:', error);
          setToast({
            isOpen: true,
            message: 'Failed to disconnect Gmail. Please try again.',
            type: 'error'
          });
        }
      }
    });
  };

  const handleScanNow = async () => {
    setScanning(true);
    setApiError(null); // UC-117: Clear previous errors
    try {
      await emailAPI.triggerScan();
      setToast({
        isOpen: true,
        message: 'Email scan started. This may take a few minutes. Refresh the page to see updates.',
        type: 'success',
        duration: 6000
      });
    } catch (error) {
      console.error('Failed to start scan:', error);
      // UC-117: Set structured error for user-facing display
      setApiError(error);
    } finally {
      setScanning(false);
    }
  };

  const handleEnableScanning = async () => {
    setScanning(true);
    try {
      await emailAPI.enableScanning();
      
      // Reload to get updated status
      await loadStatus();
      
      setToast({
        isOpen: true,
        message: 'Email scanning enabled! You can now scan for emails manually.',
        type: 'success',
        duration: 4000
      });
    } catch (error) {
      console.error('Failed to enable scanning:', error);
      setToast({
        isOpen: true,
        message: 'Failed to enable scanning. Please try again.',
        type: 'error'
      });
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return <div className="gmail-settings-loading">Loading Gmail settings...</div>;
  }

  const isConnected = integration && (integration.status === 'connected' || integration.status === 'scanning');

  return (
    <>
    <div className="gmail-settings">
      <h3>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
        Email Integration
      </h3>
      
      {/* UC-117: Display API error banner when Gmail operations fail */}
      {apiError && (
        <APIErrorBanner 
          serviceName="Gmail API"
          error={apiError}
          severity="warning"
          onRetry={handleScanNow}
          dismissible={true}
        />
      )}
      
      {!isConnected ? (
        <div className="gmail-not-connected">
          <p>Connect your Gmail to automatically track application-related emails and stay organized.</p>
          
          <div className="gmail-benefits">
            <ul>
              <li>
                <span>🔒</span>
                <span>Read-only access (we never send emails)</span>
              </li>
              <li>
                <span>📬</span>
                <span>Scan for interview invitations, rejections, offers</span>
              </li>
              <li>
                <span>✨</span>
                <span>Auto-suggest job status updates</span>
              </li>
              <li>
                <span>🔗</span>
                <span>Link emails to specific applications</span>
              </li>
            </ul>
          </div>
          <button onClick={handleConnect} className="gmail-connect-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"></path>
            </svg>
            Connect with Google
          </button>
          <p className="gmail-privacy-note">
            <small>🔐 Your privacy is important. We only access emails to help track your applications. You can disconnect anytime.</small>
          </p>
        </div>
      ) : (
        <div className="gmail-connected">
          <div className={`status-badge status-${integration.status}`}>
            {integration.status_display || integration.status}
          </div>
          
          {!integration.scan_enabled ? (
            // Show consent UI when connected but scanning not enabled
            <div className="scanning-consent">
              <div className="consent-header">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <h4>Gmail Connected Successfully!</h4>
                <p className="consent-account">Connected to: <strong>{integration.gmail_address}</strong></p>
              </div>
              
              <div className="consent-body">
                <p className="consent-question">Would you like to enable automatic email scanning?</p>
                <div className="consent-details">
                  <p><strong>What we'll do:</strong></p>
                  <ul>
                    <li>✅ Scan your inbox for job application-related emails</li>
                    <li>✅ Automatically link emails to your job applications</li>
                    <li>✅ Suggest status updates based on email content</li>
                    <li>✅ Help you stay organized without manual work</li>
                  </ul>
                  <p><strong>Your privacy:</strong></p>
                  <ul>
                    <li>🔒 Read-only access (we never send emails)</li>
                    <li>🔒 Only job-related emails are processed</li>
                    <li>🔒 You can disable or disconnect anytime</li>
                    <li>🔒 All data is deleted when you disconnect</li>
                  </ul>
                </div>
                
                <div className="consent-actions">
                  <button 
                    onClick={handleEnableScanning}
                    className="btn-primary btn-enable-scanning"
                    disabled={scanning}
                  >
                    {scanning ? 'Enabling...' : 'Yes, Enable Email Scanning'}
                  </button>
                  <button 
                    onClick={handleDisconnect}
                    className="btn-text"
                  >
                    No thanks, disconnect
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Show normal connected UI when scanning is enabled
            <>
              <div className="gmail-info">
                <p>
                  <strong>📧 Connected Account</strong>
                  <span>{integration.gmail_address}</span>
                </p>
                <p>
                  <strong>📊 Emails Scanned</strong>
                  <span>{integration.emails_scanned_count || 0}</span>
                </p>
                {integration.last_scan_at && (
                  <p>
                    <strong>🕒 Last Scan</strong>
                    <span>{new Date(integration.last_scan_at).toLocaleString()}</span>
                  </p>
                )}
              </div>
              
              <p style={{ marginTop: '20px', color: '#6b7280', fontSize: '14px' }}>
                Click "Scan Now" to manually search for job-related emails in your inbox.
              </p>
              
              <div className="gmail-actions">
            <button 
              onClick={handleScanNow} 
              className="btn-secondary"
              disabled={scanning || integration.status === 'scanning'}
            >
              {scanning || integration.status === 'scanning' ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 6v6l4 2"></path>
                  </svg>
                  Scanning...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                  </svg>
                  Scan Now
                </>
              )}
            </button>
            <button onClick={handleDisconnect} className="btn-danger">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
              Disconnect
            </button>
          </div>
          
          {integration.last_error && integration.last_error.trim() !== '' && (
            <div className="gmail-error-box">
              <strong>Error:</strong> <span style={{ display: 'inline' }}>{integration.last_error}</span>
            </div>
          )}
            </>
          )}
        </div>
      )}
    </div>
    
    <Toast
      isOpen={toast.isOpen}
      onClose={() => setToast({ ...toast, isOpen: false })}
      message={toast.message}
      type={toast.type}
      duration={toast.duration}
    />
    
    <ConfirmDialog
      isOpen={confirmDialog.isOpen}
      onClose={() => setConfirmDialog({ isOpen: false })}
      onConfirm={confirmDialog.onConfirm}
      title={confirmDialog.title}
      message={confirmDialog.message}
      confirmText="Disconnect"
      cancelText="Cancel"
      variant="danger"
    />
    </>
  );
};

export default GmailSettings;
