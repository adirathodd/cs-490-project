import React, { useState, useEffect } from 'react';
import Icon from '../common/Icon';
import './AutomationAnalytics.css';
import { automationAPI } from '../../services/automationAPI';

const AutomationAnalytics = ({ rules, logs, packages }) => {
  const [timeRange, setTimeRange] = useState('7days');
  const [analyticsData, setAnalyticsData] = useState({
    ruleExecutions: [],
    packageGeneration: [],
    successRate: 0,
    topPerformingRules: [],
    activityTimeline: []
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  useEffect(() => {
    calculateAnalytics();
  }, [rules, logs, packages, timeRange]);

  const calculateAnalytics = () => {
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case '24hours':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const filteredLogs = logs.filter(log => new Date(log.created_at) >= startDate);
    const filteredPackages = packages.filter(pkg => new Date(pkg.created_at) >= startDate);

    // Calculate rule execution statistics
    const ruleExecutionStats = rules.map(rule => {
      const ruleLogs = filteredLogs.filter(log => log.automation_rule === rule.id);
      const successfulExecutions = ruleLogs.filter(log => log.level === 'info').length;
      const failedExecutions = ruleLogs.filter(log => log.level === 'error').length;
      
      return {
        name: rule.name,
        successful: successfulExecutions,
        failed: failedExecutions,
        total: successfulExecutions + failedExecutions,
        successRate: successfulExecutions + failedExecutions > 0 
          ? Math.round((successfulExecutions / (successfulExecutions + failedExecutions)) * 100)
          : 0
      };
    });

    // Calculate package generation by status
    const packageStats = filteredPackages.reduce((acc, pkg) => {
      acc[pkg.status] = (acc[pkg.status] || 0) + 1;
      return acc;
    }, {});

    const packageGeneration = Object.entries(packageStats).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count
    }));

    // Calculate overall success rate
    const totalExecutions = filteredLogs.length;
    const successfulExecutions = filteredLogs.filter(log => log.level === 'info').length;
    const overallSuccessRate = totalExecutions > 0 
      ? Math.round((successfulExecutions / totalExecutions) * 100)
      : 0;

    // Find top performing rules
    const topPerformingRules = ruleExecutionStats
      .filter(rule => rule.total > 0)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    // Calculate activity timeline
    const activityByDay = {};
    filteredLogs.forEach(log => {
      const date = new Date(log.created_at).toDateString();
      if (!activityByDay[date]) {
        activityByDay[date] = { date, successful: 0, failed: 0 };
      }
      if (log.level === 'info') {
        activityByDay[date].successful++;
      } else {
        activityByDay[date].failed++;
      }
    });

    const activityTimeline = Object.values(activityByDay).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    setAnalyticsData({
      ruleExecutions: ruleExecutionStats,
      packageGeneration,
      successRate: overallSuccessRate,
      topPerformingRules,
      activityTimeline
    });
  };

  const StatCard = ({ title, value, subtitle, icon, color = 'primary' }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" component="h3" color="textSecondary">
              {title}
            </Typography>
            <Typography variant="h4" component="h2" color={`${color}.main`}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="textSecondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box color={`${color}.main`}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Time Range Selector */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">
          Automation Analytics
        </Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            label="Time Range"
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <MenuItem value="24hours">Last 24 Hours</MenuItem>
            <MenuItem value="7days">Last 7 Days</MenuItem>
            <MenuItem value="30days">Last 30 Days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Success Rate"
            value={`${analyticsData.successRate}%`}
            subtitle="Overall automation success"
            icon={<CheckCircleIcon fontSize="large" />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Rules"
            value={rules.filter(rule => rule.is_active).length}
            subtitle={`of ${rules.length} total rules`}
            icon={<AutoModeIcon fontSize="large" />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Packages Generated"
            value={analyticsData.packageGeneration.reduce((sum, item) => sum + item.value, 0)}
            subtitle={`in ${timeRange.replace(/\d+/, match => match + ' ')}`}
            icon={<ScheduleIcon fontSize="large" />}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Executions"
            value={logs.length}
            subtitle="All time automation runs"
            icon={<AssessmentIcon fontSize="large" />}
            color="info"
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Rule Execution Performance */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Rule Execution Performance
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.ruleExecutions}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="successful" stackId="a" fill="#4caf50" name="Successful" />
                  <Bar dataKey="failed" stackId="a" fill="#f44336" name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Package Generation Status */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Package Generation Status
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analyticsData.packageGeneration}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analyticsData.packageGeneration.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Activity Timeline */}
      {analyticsData.activityTimeline.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Daily Activity Timeline
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analyticsData.activityTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="successful" 
                      stroke="#4caf50" 
                      name="Successful Executions"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="failed" 
                      stroke="#f44336" 
                      name="Failed Executions"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Top Performing Rules */}
      {analyticsData.topPerformingRules.length > 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Top Performing Rules
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Rule Name</TableCell>
                        <TableCell align="center">Executions</TableCell>
                        <TableCell align="center">Success Rate</TableCell>
                        <TableCell align="center">Performance</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analyticsData.topPerformingRules.map((rule, index) => (
                        <TableRow key={rule.name}>
                          <TableCell>{rule.name}</TableCell>
                          <TableCell align="center">{rule.total}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={`${rule.successRate}%`}
                              color={rule.successRate >= 80 ? 'success' : 
                                     rule.successRate >= 60 ? 'warning' : 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Box display="flex" alignItems="center">
                              <LinearProgress
                                variant="determinate"
                                value={rule.successRate}
                                sx={{ width: 100, mr: 1 }}
                                color={rule.successRate >= 80 ? 'success' : 
                                       rule.successRate >= 60 ? 'warning' : 'error'}
                              />
                              <Typography variant="caption">
                                {rule.successRate}%
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default AutomationAnalytics;