/**
 * UC-117: Service Status Grid Component
 * Displays per-service statistics and quota information
 */

import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

const ServiceStatusGrid = ({ services, onRefresh }) => {
  if (!services || services.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography color="text.secondary">No services configured</Typography>
      </Box>
    );
  }

  const getQuotaColor = (alertLevel) => {
    switch (alertLevel) {
      case 'exceeded':
        return 'error';
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'success';
    }
  };

  const getStatusIcon = (successRate, hasActiveAlerts) => {
    if (hasActiveAlerts) {
      return <WarningIcon color="warning" />;
    }
    if (successRate >= 95) {
      return <CheckCircleIcon color="success" />;
    }
    if (successRate >= 80) {
      return <WarningIcon color="warning" />;
    }
    return <ErrorIcon color="error" />;
  };

  return (
    <Grid container spacing={3}>
      {services.map((service) => {
        const hasActiveAlerts = service.active_alerts && service.active_alerts.length > 0;
        const quotaPercentage = service.quota?.percentage_used || 0;
        
        return (
          <Grid item xs={12} md={6} lg={4} key={service.service_name}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box>
                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                      {getStatusIcon(service.success_rate, hasActiveAlerts)}
                      <Typography variant="h6" component="h3">
                        {service.service_name}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {service.service_type}
                    </Typography>
                  </Box>
                  <Chip
                    label={service.is_active ? 'Active' : 'Inactive'}
                    color={service.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                {/* Statistics */}
                <Box mb={2}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Total Requests
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {service.total_requests?.toLocaleString() || 0}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Success Rate
                    </Typography>
                    <Typography 
                      variant="body2" 
                      fontWeight="bold"
                      color={service.success_rate >= 95 ? 'success.main' : service.success_rate >= 80 ? 'warning.main' : 'error.main'}
                    >
                      {service.success_rate?.toFixed(1) || 0}%
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Avg Response Time
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {service.avg_response_time_ms?.toFixed(0) || 0}ms
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Failed Requests
                    </Typography>
                    <Typography 
                      variant="body2" 
                      fontWeight="bold"
                      color={service.failed_requests > 0 ? 'error.main' : 'text.primary'}
                    >
                      {service.failed_requests?.toLocaleString() || 0}
                    </Typography>
                  </Box>
                </Box>

                {/* Quota Status */}
                {service.quota && service.quota.quota_limit && (
                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        Daily Quota
                      </Typography>
                      <Typography variant="body2">
                        {service.quota.total_requests} / {service.quota.quota_limit}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(quotaPercentage, 100)}
                      color={getQuotaColor(service.quota.alert_level)}
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {quotaPercentage.toFixed(1)}% used
                      {service.quota.quota_remaining > 0 && 
                        ` • ${service.quota.quota_remaining} remaining`}
                    </Typography>
                  </Box>
                )}

                {/* Active Alerts */}
                {hasActiveAlerts && (
                  <Box>
                    <Typography variant="caption" color="error" fontWeight="bold">
                      {service.active_alerts.length} Active Alert{service.active_alerts.length !== 1 ? 's' : ''}
                    </Typography>
                    {service.active_alerts.slice(0, 2).map((alert, idx) => (
                      <Typography key={idx} variant="caption" display="block" color="text.secondary">
                        • {alert.alert_type}
                      </Typography>
                    ))}
                  </Box>
                )}

                {/* Recent Errors */}
                {service.recent_errors && service.recent_errors.length > 0 && (
                  <Box mt={2}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      Recent Errors:
                    </Typography>
                    {service.recent_errors.slice(0, 2).map((error, idx) => (
                      <Tooltip key={idx} title={error.message} arrow>
                        <Typography 
                          variant="caption" 
                          display="block" 
                          color="error"
                          sx={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          • {error.error_type}
                        </Typography>
                      </Tooltip>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
};

export default ServiceStatusGrid;
