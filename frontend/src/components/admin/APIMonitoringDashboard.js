/**
 * UC-117: API Rate Limiting and Error Handling Dashboard
 * Main admin dashboard for API monitoring
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Button,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Speed as SpeedIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { apiMonitoringAPI } from '../../services/apiMonitoringAPI';
import ServiceStatusGrid from './ServiceStatusGrid';
import AlertsPanel from './AlertsPanel';
import ErrorLogsTable from './ErrorLogsTable';
import UsageChart from './UsageChart';
import WeeklyReportsPanel from './WeeklyReportsPanel';
import './APIMonitoringDashboard.css';

const APIMonitoringDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [daysFilter, setDaysFilter] = useState(7);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, [daysFilter]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadDashboard();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, daysFilter]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiMonitoringAPI.getDashboard(daysFilter);
      setDashboardData(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const handleToggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleDaysFilterChange = (event) => {
    setDaysFilter(event.target.value);
  };

  if (loading && !dashboardData) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !dashboardData) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const { overall, services, active_alerts, recent_errors, approaching_limit } = dashboardData || {};

  return (
    <div className="api-dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">API Monitoring Dashboard</h1>
        <div className="dashboard-controls">
          <label className="auto-refresh-label">
            <span className="control-label">Auto Refresh</span>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={handleToggleAutoRefresh}
              className="toggle-switch"
            />
          </label>
          {lastRefresh && (
            <span className="last-updated" key={lastRefresh.getTime()}>
              Updated: {lastRefresh.toLocaleString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="refresh-button"
            title="Refresh Now"
          >
            <RefreshIcon className={refreshing ? 'spinning' : ''} />
          </button>
          <select
            value={daysFilter}
            onChange={(e) => setDaysFilter(Number(e.target.value))}
            className="period-selector"
          >
            <option value={1}>24h</option>
            <option value={7}>7d</option>
            <option value={14}>14d</option>
            <option value={30}>30d</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <Grid container spacing={{ xs: 2, sm: 3 }} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="metric-card">
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TrendingUpIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Total Requests
                </Typography>
              </Box>
              <Typography variant="h4">{overall?.total_requests?.toLocaleString() || 0}</Typography>
              <Typography variant="caption" color="text.secondary">
                Last {daysFilter} days
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="metric-card">
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Success Rate
                </Typography>
              </Box>
              <Typography variant="h4">
                {!overall?.total_requests || overall?.total_requests === 0
                  ? 'N/A'
                  : `${overall?.success_rate?.toFixed(1) || 0}%`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {overall?.successful_requests?.toLocaleString() || 0} successful
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="metric-card error-card">
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <ErrorIcon color="error" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Total Errors
                </Typography>
              </Box>
              <Typography variant="h4">{overall?.failed_requests?.toLocaleString() || 0}</Typography>
              <Typography variant="caption" color="text.secondary">
                {recent_errors?.length || 0} unresolved
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="metric-card">
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <SpeedIcon color="info" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Avg Response Time
                </Typography>
              </Box>
              <Typography variant="h4">{overall?.avg_response_time_ms?.toFixed(0) || 0}ms</Typography>
              <Typography variant="caption" color="text.secondary">
                Across all services
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts Banner */}
      {active_alerts && active_alerts.length > 0 && (
        <Alert 
          severity={active_alerts.some(a => a.severity === 'critical') ? 'error' : 'warning'}
          sx={{ mb: 3 }}
        >
          <strong>{active_alerts.length} Active Alert{active_alerts.length !== 1 ? 's' : ''}</strong>
          {' - '}
          {active_alerts.filter(a => a.severity === 'critical').length > 0 && 
            `${active_alerts.filter(a => a.severity === 'critical').length} critical, `}
          {active_alerts.filter(a => a.severity === 'warning').length > 0 && 
            `${active_alerts.filter(a => a.severity === 'warning').length} warnings`}
        </Alert>
      )}

      {/* Services Approaching Limits */}
      {approaching_limit && approaching_limit.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>Services Approaching Rate Limits:</strong>
          {' '}
          {approaching_limit.map(s => `${s.service_name} (${s.percentage_used.toFixed(0)}%)`).join(', ')}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab label="Services" />
          <Tab label={`Alerts (${active_alerts?.length || 0})`} />
          <Tab label="Error Logs" />
          <Tab label="Usage Trends" />
          <Tab label="Weekly Reports" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <Box role="tabpanel" hidden={activeTab !== 0}>
        {activeTab === 0 && (
          <ServiceStatusGrid services={services} onRefresh={handleRefresh} />
        )}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 1}>
        {activeTab === 1 && (
          <AlertsPanel 
            alerts={active_alerts} 
            onRefresh={handleRefresh}
            daysFilter={daysFilter}
          />
        )}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 2}>
        {activeTab === 2 && (
          <ErrorLogsTable 
            initialErrors={recent_errors}
            daysFilter={daysFilter}
          />
        )}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 3}>
        {activeTab === 3 && (
          <UsageChart services={services} daysFilter={daysFilter} />
        )}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 4}>
        {activeTab === 4 && (
          <WeeklyReportsPanel />
        )}
      </Box>
    </div>
  );
};

export default APIMonitoringDashboard;
