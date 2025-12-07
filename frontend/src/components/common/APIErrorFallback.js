/**
 * UC-117: API Error Fallback Component
 * User-facing error messages when external APIs are unavailable
 */

import React from 'react';
import './APIErrorFallback.css';

const APIErrorFallback = ({ 
  serviceName = 'API service',
  feature = 'this feature',
  error = null,
  onRetry = null,
  fallbackContent = null 
}) => {
  const getErrorMessage = () => {
    if (error?.message?.includes('Rate limit')) {
      return {
        title: 'Service Temporarily Unavailable',
        message: `We've reached our ${serviceName} usage limit for now. Please try again in a few minutes.`,
        icon: '⏳'
      };
    }
    
    if (error?.message?.includes('quota') || error?.message?.includes('Quota')) {
      return {
        title: 'Daily Limit Reached',
        message: `Our ${serviceName} daily quota has been reached. This will reset tomorrow. Thank you for your patience!`,
        icon: '📊'
      };
    }
    
    if (error?.status === 503 || error?.message?.includes('unavailable')) {
      return {
        title: `${serviceName} Temporarily Down`,
        message: `${serviceName} is currently experiencing issues. We're working to restore service. Please try again shortly.`,
        icon: '🔧'
      };
    }
    
    return {
      title: 'Service Issue',
      message: `We're having trouble connecting to ${serviceName}. ${feature} may not work correctly right now.`,
      icon: '⚠️'
    };
  };

  const { title, message, icon } = getErrorMessage();

  return (
    <div className="api-error-fallback">
      <div className="api-error-icon">{icon}</div>
      <h3 className="api-error-title">{title}</h3>
      <p className="api-error-message">{message}</p>
      
      {fallbackContent && (
        <div className="api-error-fallback-content">
          {fallbackContent}
        </div>
      )}
      
      <div className="api-error-actions">
        {onRetry && (
          <button className="api-error-retry-btn" onClick={onRetry}>
            Try Again
          </button>
        )}
        <a href="/dashboard" className="api-error-home-link">
          Return to Dashboard
        </a>
      </div>
      
      <p className="api-error-help">
        If this problem persists, please <a href="/supporters">contact support</a>.
      </p>
    </div>
  );
};

export default APIErrorFallback;
