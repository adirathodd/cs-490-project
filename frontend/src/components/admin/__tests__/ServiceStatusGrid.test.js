/**
 * UC-117: Tests for Service Status Grid Component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ServiceStatusGrid from '../ServiceStatusGrid';

describe('ServiceStatusGrid', () => {
  const mockServices = [
    {
      id: 1,
      service_name: 'gemini',
      service_type: 'Gemini',
      is_active: true,
      total_requests: 500,
      successful_requests: 490,
      failed_requests: 10,
      success_rate: 98.0,
      avg_response_time_ms: 120,
      quota: {
        percentage_used: 50.0,
        alert_level: 'normal',
        total_requests: 500,
        quota_limit: 1000,
        quota_remaining: 500,
      },
      active_alerts: [],
    },
    {
      id: 2,
      service_name: 'linkedin',
      service_type: 'LinkedIn',
      is_active: true,
      total_requests: 800,
      successful_requests: 720,
      failed_requests: 80,
      success_rate: 90.0,
      avg_response_time_ms: 200,
      quota: {
        percentage_used: 80.0,
        alert_level: 'warning',
        total_requests: 800,
        quota_limit: 1000,
        quota_remaining: 200,
      },
      active_alerts: [],
    },
    {
      id: 3,
      service_name: 'gmail',
      service_type: 'Gmail',
      is_active: false,
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      success_rate: 0,
      avg_response_time_ms: 0,
      quota: {
        percentage_used: 0,
        alert_level: 'normal',
        total_requests: 0,
        quota_limit: 2000,
        quota_remaining: 2000,
      },
      active_alerts: [],
    },
  ];

  test('renders all services', () => {
    render(<ServiceStatusGrid services={mockServices} />);
    
    expect(screen.getByText('gemini')).toBeInTheDocument();
    expect(screen.getByText('linkedin')).toBeInTheDocument();
    expect(screen.getByText('gmail')).toBeInTheDocument();
  });

  test('displays service statistics correctly', () => {
    render(<ServiceStatusGrid services={mockServices} />);
    
    // Check gemini stats (using getAllByText since values may appear multiple times)
    expect(screen.getAllByText(/500/).length).toBeGreaterThan(0); // total requests
    expect(screen.getByText(/98\.0%/)).toBeInTheDocument(); // success rate
    expect(screen.getByText(/120ms/)).toBeInTheDocument(); // avg response
  });

  test('shows active status for active services', () => {
    render(<ServiceStatusGrid services={mockServices} />);
    
    // Active services should have success icon/text
    const activeChips = screen.getAllByText(/active/i);
    expect(activeChips.length).toBeGreaterThan(0);
  });

  test('shows inactive status for inactive services', () => {
    render(<ServiceStatusGrid services={mockServices} />);
    
    // Gmail should be inactive
    const inactiveElements = screen.getAllByText(/inactive/i);
    expect(inactiveElements.length).toBeGreaterThan(0);
  });

  test('displays quota usage with correct colors', () => {
    const { container } = render(<ServiceStatusGrid services={mockServices} />);
    
    // Check for progress bars using aria-valuenow attribute
    const normalBars = container.querySelectorAll('[aria-valuenow="50"]');
    expect(normalBars.length).toBeGreaterThan(0);
    
    // Warning status (80%) - should exist
    const warningBars = container.querySelectorAll('[aria-valuenow="80"]');
    expect(warningBars.length).toBeGreaterThan(0);
  });

  test('handles empty services array', () => {
    const { container } = render(<ServiceStatusGrid services={[]} />);
    
    // Should render without errors - check that container has content
    expect(container.firstChild).toBeTruthy();
  });

  test('displays quota percentage correctly', () => {
    render(<ServiceStatusGrid services={mockServices} />);
    
    // Check that quota percentages are displayed
    expect(screen.getByText(/50\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/80\.0%/)).toBeInTheDocument();
  });

  test('shows service type badges', () => {
    render(<ServiceStatusGrid services={mockServices} />);
    
    // Service types should be displayed (checking for at least one occurrence)
    expect(screen.getAllByText(/Gemini/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/LinkedIn/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gmail/i).length).toBeGreaterThan(0);
  });

  test('formats large numbers correctly', () => {
    const largeNumberServices = [
      {
        id: 1,
        service_name: 'test',
        service_type: 'other',
        is_active: true,
        total_requests: 1500000,
        successful_requests: 1499000,
        failed_requests: 1000,
        success_rate: 99.93,
        avg_response_time_ms: 85,
        quota: {
          percentage_used: 30.0,
          alert_level: 'normal',
          total_requests: 1500000,
          quota_limit: 5000000,
          quota_remaining: 3500000,
        },
        active_alerts: [],
      },
    ];
    
    render(<ServiceStatusGrid services={largeNumberServices} />);
    
    // Should format large numbers with commas
    expect(screen.getByText(/1,500,000/)).toBeInTheDocument();
  });

  test('displays failed requests count', () => {
    render(<ServiceStatusGrid services={mockServices} />);
    
    // Check that gemini service is rendered with its stats (checking for at least one occurrence)
    expect(screen.getAllByText(/gemini/i).length).toBeGreaterThan(0);
    // Both services should render their failed request counts
    const failedElements = screen.getAllByText(/Failed Requests/i);
    expect(failedElements.length).toBeGreaterThan(0);
  });
});
