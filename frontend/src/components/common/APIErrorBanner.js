/**
 * UC-117: Inline API Error Banner
 * Non-blocking error notifications for API failures
 */

import React, { useState } from 'react';
import './APIErrorFallback.css'; // Reuses styles

const APIErrorBanner = ({ 
  serviceName = 'API service',
  error = null,
  severity = 'warning', // 'warning' | 'critical' | 'info'
  onRetry = null,
  dismissible = true 
}) => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const getErrorInfo = () => {
    if (error?.message?.includes('Rate limit')) {
      return {
        title: `${serviceName} Rate Limited`,
        message: 'Please wait a few minutes before trying again.',
        icon: '⏳'
      };
    }
    
    if (error?.message?.includes('quota')) {
      return {
        title: `${serviceName} Quota Reached`,
        message: 'Daily limit exceeded. Will reset tomorrow.',
        icon: '📊'
      };
    }
    
    return {
      title: `${serviceName} Unavailable`,
      message: 'Some features may not work correctly. Please try again later.',
      icon: '⚠️'
    };
  };

  const { title, message, icon } = getErrorInfo();

  return (
    <div className={`api-error-banner ${severity}`}>
      <div className="api-error-banner-icon">{icon}</div>
      <div className="api-error-banner-content">
        <p className="api-error-banner-title">{title}</p>
        <p className="api-error-banner-message">
          {message}
          {onRetry && (
            <>
              {' '}
              <button 
                onClick={() => { onRetry(); setVisible(false); }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'inherit', 
                  textDecoration: 'underline', 
                  cursor: 'pointer',
                  padding: 0,
                  font: 'inherit'
                }}
              >
                Retry now
              </button>
            </>
          )}
        </p>
      </div>
      {dismissible && (
        <button 
          className="api-error-banner-close" 
          onClick={() => setVisible(false)}
          aria-label="Close"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default APIErrorBanner;
