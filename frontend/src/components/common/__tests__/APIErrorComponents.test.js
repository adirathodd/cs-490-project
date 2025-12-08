/**
 * UC-117: API Error Components Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import APIErrorFallback from '../APIErrorFallback';
import APIErrorBanner from '../APIErrorBanner';

describe('APIErrorFallback', () => {
  test('renders rate limit error message', () => {
    const error = { message: 'Rate limit exceeded' };
    render(<APIErrorFallback serviceName="Gemini" error={error} />);
    
    expect(screen.getByText(/Service Temporarily Unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/usage limit for now/i)).toBeInTheDocument();
  });

  test('renders quota exceeded error message', () => {
    const error = { message: 'Quota exceeded' };
    render(<APIErrorFallback serviceName="LinkedIn" error={error} />);
    
    expect(screen.getByText(/Daily Limit Reached/i)).toBeInTheDocument();
    expect(screen.getByText(/will reset tomorrow/i)).toBeInTheDocument();
  });

  test('renders service unavailable error', () => {
    const error = { status: 503 };
    render(<APIErrorFallback serviceName="Gmail" error={error} />);
    
    expect(screen.getByText(/Temporarily Down/i)).toBeInTheDocument();
  });

  test('calls onRetry when retry button clicked', () => {
    const onRetry = jest.fn();
    render(<APIErrorFallback serviceName="Test API" onRetry={onRetry} />);
    
    const retryButton = screen.getByText(/Try Again/i);
    fireEvent.click(retryButton);
    
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('renders fallback content when provided', () => {
    const fallback = <div>Fallback tips go here</div>;
    render(<APIErrorFallback fallbackContent={fallback} />);
    
    expect(screen.getByText('Fallback tips go here')).toBeInTheDocument();
  });
});

describe('APIErrorBanner', () => {
  test('renders inline error banner', () => {
    const error = { message: 'Rate limit exceeded' };
    render(<APIErrorBanner serviceName="Gemini" error={error} />);
    
    expect(screen.getByText(/Rate Limited/i)).toBeInTheDocument();
  });

  test('dismisses banner when close button clicked', () => {
    render(<APIErrorBanner serviceName="Test" />);
    
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);
    
    expect(screen.queryByText(/Test/i)).not.toBeInTheDocument();
  });

  test('applies correct severity class', () => {
    const { container, rerender } = render(
      <APIErrorBanner serviceName="Test" severity="warning" />
    );
    expect(container.querySelector('.warning')).toBeInTheDocument();
    
    rerender(<APIErrorBanner serviceName="Test" severity="critical" />);
    expect(container.querySelector('.critical')).toBeInTheDocument();
  });

  test('calls onRetry and dismisses banner', () => {
    const onRetry = jest.fn();
    render(<APIErrorBanner serviceName="Test" onRetry={onRetry} />);
    
    const retryLink = screen.getByText(/Retry now/i);
    fireEvent.click(retryLink);
    
    expect(onRetry).toHaveBeenCalledTimes(1);
    // Banner should be dismissed after retry
    expect(screen.queryByText(/Retry now/i)).not.toBeInTheDocument();
  });

  test('does not show close button when not dismissible', () => {
    render(<APIErrorBanner serviceName="Test" dismissible={false} />);
    
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });
});
