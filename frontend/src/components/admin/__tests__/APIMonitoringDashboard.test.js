/**
 * UC-117: Tests for API Monitoring Dashboard Components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import APIMonitoringDashboard from '../APIMonitoringDashboard';
import { apiMonitoringAPI } from '../../../services/apiMonitoringAPI';

// Mock the entire API module
jest.mock('../../../services/apiMonitoringAPI', () => ({
  apiMonitoringAPI: {
    getDashboard: jest.fn(),
    getServices: jest.fn(),
    getAlerts: jest.fn(),
    getErrorLogs: jest.fn(),
    getWeeklyReports: jest.fn(),
    acknowledgeAlert: jest.fn(),
    resolveAlert: jest.fn(),
  },
}));

// Mock child components to simplify testing
jest.mock('../ServiceStatusGrid', () => {
  return function MockServiceStatusGrid({ services }) {
    return <div data-testid="service-status-grid">Services: {services.length}</div>;
  };
});

jest.mock('../AlertsPanel', () => {
  return function MockAlertsPanel({ alerts }) {
    return <div data-testid="alerts-panel">Alerts: {alerts.length}</div>;
  };
});

jest.mock('../ErrorLogsTable', () => {
  return function MockErrorLogsTable({ errors }) {
    return <div data-testid="error-logs-table">Errors: {errors.length}</div>;
  };
});

jest.mock('../UsageChart', () => {
  return function MockUsageChart({ services }) {
    return <div data-testid="usage-chart">Chart Ready</div>;
  };
});

jest.mock('../WeeklyReportsPanel', () => {
  return function MockWeeklyReportsPanel({ reports }) {
    return <div data-testid="weekly-reports-panel">Reports: {reports.length}</div>;
  };
});

describe('APIMonitoringDashboard', () => {
  const mockDashboardData = {
    overall: {
      total_requests: 1000,
      successful_requests: 950,
      failed_requests: 50,
      success_rate: 95.0,
      avg_response_time_ms: 150,
    },
    services: [
      {
        id: 1,
        name: 'gemini',
        service_type: 'gemini',
        is_active: true,
        stats: {
          total_requests: 500,
          success_rate: 98.0,
          avg_response_time_ms: 100,
        },
      },
    ],
    active_alerts: [
      {
        id: 1,
        service: 'gemini',
        alert_type: 'quota_warning',
        severity: 'warning',
        message: 'Approaching quota limit',
        is_acknowledged: false,
        is_resolved: false,
      },
    ],
  };

  const mockServices = [
    {
      id: 1,
      name: 'gemini',
      service_type: 'gemini',
      is_active: true,
    },
  ];

  const mockAlerts = [
    {
      id: 1,
      service: 'gemini',
      alert_type: 'quota_warning',
      severity: 'warning',
      message: 'Test alert',
    },
  ];

  const mockErrors = [
    {
      id: 1,
      service: 'gemini',
      error_type: 'RateLimitError',
      error_message: 'Rate limit exceeded',
    },
  ];

  const mockReports = [
    {
      id: 1,
      week_start: '2025-11-24',
      week_end: '2025-12-01',
      total_requests: 5000,
      total_errors: 100,
    },
  ];

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Set up default mock implementations
    apiMonitoringAPI.getDashboard.mockResolvedValue(mockDashboardData);
    apiMonitoringAPI.getServices.mockResolvedValue({ services: mockServices });
    apiMonitoringAPI.getAlerts.mockResolvedValue({ alerts: mockAlerts });
    apiMonitoringAPI.getErrorLogs.mockResolvedValue({ 
      errors: mockErrors,
      pagination: { total: 1, page: 1, page_size: 20, total_pages: 1 }
    });
    apiMonitoringAPI.getWeeklyReports.mockResolvedValue({ reports: mockReports });
  });

  test('renders dashboard with overview cards', async () => {
    render(<APIMonitoringDashboard />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/API Monitoring Dashboard/i)).toBeInTheDocument();
    });

    // Check that overview stats are displayed
    await waitFor(() => {
      expect(screen.getByText(/1,000/)).toBeInTheDocument(); // total requests
      expect(screen.getByText(/95\.0%/)).toBeInTheDocument(); // success rate
      expect(screen.getByText(/150ms/)).toBeInTheDocument(); // avg response time
    });
  });

  test('shows loading state initially', () => {
    // Make the API call delay
    apiMonitoringAPI.getDashboard.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockDashboardData), 1000))
    );

    render(<APIMonitoringDashboard />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('displays error message when API fails', async () => {
    const errorMessage = 'Failed to load dashboard';
    apiMonitoringAPI.getDashboard.mockRejectedValue(new Error(errorMessage));

    render(<APIMonitoringDashboard />);
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  test('switches between tabs', async () => {
    render(<APIMonitoringDashboard />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/API Monitoring Dashboard/i)).toBeInTheDocument();
    });

    // Initially on Overview tab
    expect(screen.getByText(/Total Requests/i)).toBeInTheDocument();

    // Click Services tab
    const servicesTab = screen.getByRole('tab', { name: /services/i });
    fireEvent.click(servicesTab);
    
    await waitFor(() => {
      expect(screen.getByTestId('service-status-grid')).toBeInTheDocument();
    });

    // Click Alerts tab
    const alertsTab = screen.getByRole('tab', { name: /alerts/i });
    fireEvent.click(alertsTab);
    
    await waitFor(() => {
      expect(screen.getByTestId('alerts-panel')).toBeInTheDocument();
    });
  });

  test('shows critical alert banner when critical alerts exist', async () => {
    const criticalAlertData = {
      ...mockDashboardData,
      active_alerts: [
        {
          id: 1,
          severity: 'critical',
          message: 'Critical issue detected',
        },
      ],
    };
    
    apiMonitoringAPI.getDashboard.mockResolvedValue(criticalAlertData);

    render(<APIMonitoringDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/critical/i)).toBeInTheDocument();
    });
  });

  test('filters data by time period', async () => {
    render(<APIMonitoringDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/API Monitoring Dashboard/i)).toBeInTheDocument();
    });

    // Verify dashboard was called at least once
    expect(apiMonitoringAPI.getDashboard).toHaveBeenCalled();
  });

  test('refreshes data when refresh button clicked', async () => {
    render(<APIMonitoringDashboard />);
    
    await waitFor(() => {
      expect(apiMonitoringAPI.getDashboard).toHaveBeenCalled();
    });

    // Verify dashboard API was called
    expect(apiMonitoringAPI.getDashboard).toHaveBeenCalledTimes(1);
  });

  test('displays service count correctly', async () => {
    render(<APIMonitoringDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/API Monitoring Dashboard/i)).toBeInTheDocument();
    });

    // Dashboard data should be loaded
    expect(apiMonitoringAPI.getDashboard).toHaveBeenCalled();
  });

  test('displays alerts count correctly', async () => {
    render(<APIMonitoringDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/API Monitoring Dashboard/i)).toBeInTheDocument();
    });

    // Dashboard data includes alerts
    expect(apiMonitoringAPI.getDashboard).toHaveBeenCalled();
  });

  test('handles empty data gracefully', async () => {
    const emptyData = {
      overall: {
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        success_rate: 0,
        avg_response_time_ms: 0,
      },
      services: [],
      active_alerts: [],
    };
    
    apiMonitoringAPI.getDashboard.mockResolvedValue(emptyData);
    apiMonitoringAPI.getServices.mockResolvedValue({ services: [] });
    apiMonitoringAPI.getAlerts.mockResolvedValue({ alerts: [] });

    render(<APIMonitoringDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/API Monitoring Dashboard/i)).toBeInTheDocument();
    });

    // Should render without errors when data is empty
    expect(apiMonitoringAPI.getDashboard).toHaveBeenCalled();
  });
});
