/**
 * UC-099: Deployment Tracking Dashboard
 * Admin dashboard for monitoring CI/CD deployments, metrics, and history
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Replay as ReplayIcon,
  GitHub as GitHubIcon,
  Cloud as CloudIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';
import { deploymentAPI } from '../../services/deploymentAPI';
import './DeploymentDashboard.css';

// Status color mapping
const getStatusColor = (status) => {
  const colors = {
    success: '#4caf50',
    failed: '#f44336',
    in_progress: '#2196f3',
    pending: '#ff9800',
    rolled_back: '#9c27b0',
  };
  return colors[status] || '#9e9e9e';
};

// Status icon mapping
const StatusIcon = ({ status }) => {
  const icons = {
    success: <CheckCircleIcon sx={{ color: '#4caf50' }} />,
    failed: <ErrorIcon sx={{ color: '#f44336' }} />,
    in_progress: <ScheduleIcon sx={{ color: '#2196f3' }} />,
    pending: <ScheduleIcon sx={{ color: '#ff9800' }} />,
    rolled_back: <ReplayIcon sx={{ color: '#9c27b0' }} />,
  };
  return icons[status] || <ScheduleIcon />;
};

// Format duration
const formatDuration = (seconds) => {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

// Format date
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString();
};

// Format relative time
const formatRelativeTime = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const DeploymentDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [deployments, setDeployments] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [daysFilter, setDaysFilter] = useState(30);
  const [environmentFilter, setEnvironmentFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState(null);
  const [rollbackReason, setRollbackReason] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [metricsData, deploymentsData] = await Promise.all([
        deploymentAPI.getMetrics(daysFilter),
        deploymentAPI.getDeployments({
          environment: environmentFilter !== 'all' ? environmentFilter : undefined,
          days: daysFilter,
        }),
      ]);
      
      setMetrics(metricsData);
      setDeployments(deploymentsData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load deployment data:', err);
      setError(err.message || 'Failed to load deployment data');
    } finally {
      setLoading(false);
    }
  }, [daysFilter, environmentFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadData();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleRollback = async () => {
    if (!selectedDeployment || !rollbackReason) return;
    
    try {
      await deploymentAPI.triggerRollback(selectedDeployment.id, {
        reason: rollbackReason,
      });
      setRollbackDialogOpen(false);
      setRollbackReason('');
      setSelectedDeployment(null);
      await loadData();
    } catch (err) {
      console.error('Rollback failed:', err);
      setError('Failed to trigger rollback');
    }
  };

  const openRollbackDialog = (deployment) => {
    setSelectedDeployment(deployment);
    setRollbackDialogOpen(true);
  };

  // Stats Summary Card
  const StatCard = ({ title, value, subtitle, icon, color }) => (
    <Card className="stat-card" sx={{ borderTop: `4px solid ${color}` }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="subtitle2" color="textSecondary">
              {title}
            </Typography>
            <Typography variant="h4" sx={{ color, fontWeight: 'bold', my: 1 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ color, opacity: 0.7 }}>{icon}</Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Environment Status Card
  const EnvironmentCard = ({ environment, stats, lastDeployment }) => (
    <Card className="environment-card">
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <CloudIcon color={environment === 'production' ? 'error' : 'primary'} />
          <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
            {environment}
          </Typography>
          <Chip
            size="small"
            label={stats?.last_deployment?.status || 'No deployments'}
            sx={{
              backgroundColor: getStatusColor(stats?.last_deployment?.status),
              color: 'white',
              ml: 'auto',
            }}
          />
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">Success Rate</Typography>
            <Typography variant="h6">
              {stats?.success_rate?.toFixed(1) || 0}%
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">Total</Typography>
            <Typography variant="h6">{stats?.total || 0}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">Avg Duration</Typography>
            <Typography variant="h6">
              {formatDuration(stats?.avg_duration)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">Failed</Typography>
            <Typography variant="h6" color="error">{stats?.failed || 0}</Typography>
          </Grid>
        </Grid>
        
        {lastDeployment && (
          <Box mt={2} pt={2} borderTop="1px solid #eee">
            <Typography variant="body2" color="textSecondary">
              Last Deployment
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mt={0.5}>
              <GitHubIcon fontSize="small" />
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {lastDeployment.commit_sha?.slice(0, 7)}
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ ml: 'auto' }}>
                {formatRelativeTime(lastDeployment.started_at)}
              </Typography>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // Deployments Table
  const DeploymentsTable = () => (
    <TableContainer component={Paper} className="deployments-table">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Status</TableCell>
            <TableCell>Environment</TableCell>
            <TableCell>Commit</TableCell>
            <TableCell>Branch</TableCell>
            <TableCell>Deployed By</TableCell>
            <TableCell>Started</TableCell>
            <TableCell>Duration</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {deployments.map((deployment) => (
            <TableRow key={deployment.id} hover>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  <StatusIcon status={deployment.status} />
                  <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                    {deployment.status?.replace('_', ' ')}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={deployment.environment}
                  color={deployment.environment === 'production' ? 'error' : 'primary'}
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {deployment.commit_sha?.slice(0, 7)}
                </Typography>
              </TableCell>
              <TableCell>{deployment.branch}</TableCell>
              <TableCell>{deployment.deployed_by || 'System'}</TableCell>
              <TableCell>{formatRelativeTime(deployment.started_at)}</TableCell>
              <TableCell>{deployment.duration_display || 'N/A'}</TableCell>
              <TableCell>
                {deployment.status === 'success' && deployment.environment === 'production' && (
                  <Tooltip title="Rollback">
                    <IconButton
                      size="small"
                      onClick={() => openRollbackDialog(deployment)}
                    >
                      <ReplayIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // Deployment Trend Chart
  const DeploymentTrendChart = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Deployment Activity
        </Typography>
        <Box height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics?.daily_deployments || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis />
              <RechartsTooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#2196f3"
                fill="#2196f3"
                fillOpacity={0.3}
                name="Deployments"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading && !metrics) {
    return (
      <Container maxWidth="xl">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" className="deployment-dashboard">
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Deployment Dashboard
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Monitor CI/CD pipeline and deployment history
          </Typography>
        </Box>
        
        <Box display="flex" alignItems="center" gap={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Environment</InputLabel>
            <Select
              value={environmentFilter}
              label="Environment"
              onChange={(e) => setEnvironmentFilter(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="production">Production</MenuItem>
              <MenuItem value="staging">Staging</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={daysFilter}
              label="Period"
              onChange={(e) => setDaysFilter(e.target.value)}
            >
              <MenuItem value={7}>7 days</MenuItem>
              <MenuItem value={14}>14 days</MenuItem>
              <MenuItem value={30}>30 days</MenuItem>
              <MenuItem value={90}>90 days</MenuItem>
            </Select>
          </FormControl>
          
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={() => setAutoRefresh(!autoRefresh)}
                size="small"
              />
            }
            label="Auto-refresh"
          />
          
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <RefreshIcon className={refreshing ? 'spinning' : ''} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {refreshing && <LinearProgress sx={{ mb: 2 }} />}

      {/* Stats Summary */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Deployments"
            value={(metrics?.production_stats?.total || 0) + (metrics?.staging_stats?.total || 0)}
            subtitle={`Last ${daysFilter} days`}
            icon={<CloudIcon fontSize="large" />}
            color="#2196f3"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Success Rate"
            value={`${(
              ((metrics?.production_stats?.success_rate || 0) + (metrics?.staging_stats?.success_rate || 0)) / 2
            ).toFixed(1)}%`}
            subtitle="Average across environments"
            icon={<CheckCircleIcon fontSize="large" />}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Failed Deployments"
            value={(metrics?.production_stats?.failed || 0) + (metrics?.staging_stats?.failed || 0)}
            subtitle="Requires attention"
            icon={<ErrorIcon fontSize="large" />}
            color="#f44336"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Avg Duration"
            value={formatDuration(
              ((metrics?.production_stats?.avg_duration || 0) + (metrics?.staging_stats?.avg_duration || 0)) / 2
            )}
            subtitle="Deployment time"
            icon={<ScheduleIcon fontSize="large" />}
            color="#ff9800"
          />
        </Grid>
      </Grid>

      {/* Environment Status Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <EnvironmentCard
            environment="production"
            stats={metrics?.production_stats}
            lastDeployment={metrics?.last_production_deployment}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <EnvironmentCard
            environment="staging"
            stats={metrics?.staging_stats}
            lastDeployment={metrics?.last_staging_deployment}
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab icon={<HistoryIcon />} label="Deployment History" />
        <Tab icon={<TrendingUpIcon />} label="Trends" />
      </Tabs>

      {/* Tab Content */}
      {activeTab === 0 && <DeploymentsTable />}
      {activeTab === 1 && <DeploymentTrendChart />}

      {/* Last refresh indicator */}
      {lastRefresh && (
        <Box mt={2} textAlign="center">
          <Typography variant="caption" color="textSecondary">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Typography>
        </Box>
      )}

      {/* Rollback Dialog */}
      <Dialog
        open={rollbackDialogOpen}
        onClose={() => setRollbackDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Rollback</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to rollback from commit{' '}
            <code>{selectedDeployment?.commit_sha?.slice(0, 7)}</code>?
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Reason for rollback"
            value={rollbackReason}
            onChange={(e) => setRollbackReason(e.target.value)}
            placeholder="Please provide a reason for this rollback..."
            sx={{ mt: 2 }}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRollbackDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRollback}
            color="error"
            variant="contained"
            disabled={!rollbackReason}
          >
            Confirm Rollback
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DeploymentDashboard;
