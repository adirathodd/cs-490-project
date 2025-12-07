/**
 * UC-117: Alerts Panel Component
 * Displays and manages API alerts
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert as MuiAlert,
  IconButton,
  Tooltip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { apiMonitoringAPI } from '../../services/apiMonitoringAPI';

const AlertsPanel = ({ alerts: initialAlerts, onRefresh, daysFilter }) => {
  const [alerts, setAlerts] = useState(initialAlerts || []);
  const [loading, setLoading] = useState(false);
  const [filterResolve, setFilterResolve] = useState('false');
  const [filterSeverity, setFilterSeverity] = useState('all');

  useEffect(() => {
    loadAlerts();
  }, [filterResolve, filterSeverity, daysFilter]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const params = { days: daysFilter };
      if (filterResolve !== 'all') {
        params.is_resolved = filterResolve;
      }
      if (filterSeverity !== 'all') {
        params.severity = filterSeverity;
      }
      const data = await apiMonitoringAPI.getAlerts(params);
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      await apiMonitoringAPI.acknowledgeAlert(alertId);
      await loadAlerts();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleResolve = async (alertId) => {
    try {
      await apiMonitoringAPI.resolveAlert(alertId);
      await loadAlerts();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  if (loading && alerts.length === 0) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Filters */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={filterResolve}
              onChange={(e) => setFilterResolve(e.target.value)}
              label="Status"
            >
              <MenuItem value="false">Active</MenuItem>
              <MenuItem value="true">Resolved</MenuItem>
              <MenuItem value="all">All</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Severity</InputLabel>
            <Select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              label="Severity"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="info">Info</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadAlerts}
            disabled={loading}
            fullWidth
          >
            Refresh
          </Button>
        </Grid>
      </Grid>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <Box textAlign="center" py={4}>
          <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No alerts found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All systems operating normally
          </Typography>
        </Box>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {alerts.map((alert) => (
            <Card key={alert.id} variant="outlined">
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box flex={1}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Chip
                        label={alert.severity.toUpperCase()}
                        color={getSeverityColor(alert.severity)}
                        size="small"
                      />
                      <Chip
                        label={alert.alert_type}
                        variant="outlined"
                        size="small"
                      />
                      {alert.is_acknowledged && (
                        <Chip
                          label="Acknowledged"
                          size="small"
                          color="info"
                        />
                      )}
                      {alert.is_resolved && (
                        <Chip
                          label="Resolved"
                          size="small"
                          color="success"
                        />
                      )}
                    </Box>
                    <Typography variant="h6" component="h3" mb={1}>
                      {alert.service_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={1}>
                      {alert.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Triggered: {new Date(alert.triggered_at).toLocaleString()}
                    </Typography>
                    {alert.details && Object.keys(alert.details).length > 0 && (
                      <Box mt={1}>
                        <Typography variant="caption" color="text.secondary" fontWeight="bold">
                          Details:
                        </Typography>
                        {Object.entries(alert.details).map(([key, value]) => (
                          <Typography key={key} variant="caption" display="block" color="text.secondary">
                            {key}: {typeof value === 'number' ? value.toLocaleString() : String(value)}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Box>
                  
                  {!alert.is_resolved && (
                    <Box display="flex" gap={1}>
                      {!alert.is_acknowledged && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleAcknowledge(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={() => handleResolve(alert.id)}
                      >
                        Resolve
                      </Button>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default AlertsPanel;
