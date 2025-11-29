import React, { useState, useEffect } from 'react';
import Icon from '../common/Icon';
import './AutomationAnalytics.css';

const AutomationAnalytics = ({ rules, logs, packages }) => {
  const [timeRange, setTimeRange] = useState('7days');
  const [analyticsData, setAnalyticsData] = useState({
    totalExecutions: 0,
    successfulExecutions: 0,
    successRate: 0,
    packagesGenerated: 0,
    topPerformingRules: [],
    recentActivity: []
  });

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

    const totalExecutions = filteredLogs.length;
    const successfulExecutions = filteredLogs.filter(log => log.level === 'info').length;
    const successRate = totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0;
    const packagesGenerated = filteredPackages.length;

    // Calculate top performing rules
    const ruleStats = rules.map(rule => {
      const ruleLogs = filteredLogs.filter(log => log.automation_rule === rule.id);
      const successful = ruleLogs.filter(log => log.level === 'info').length;
      const total = ruleLogs.length;
      return {
        rule,
        successful,
        total,
        successRate: total > 0 ? Math.round((successful / total) * 100) : 0
      };
    });

    const topPerformingRules = ruleStats
      .filter(stat => stat.total > 0)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    // Recent activity (last 10 logs)
    const recentActivity = [...filteredLogs]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);

    setAnalyticsData({
      totalExecutions,
      successfulExecutions,
      successRate,
      packagesGenerated,
      topPerformingRules,
      recentActivity
    });
  };

  const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getLogIcon = (level) => {
    return level === 'info' ? 'check' : 'times-circle';
  };

  const getLogClass = (level) => {
    return level === 'info' ? 'log-success' : 'log-error';
  };

  return (
    <div className="automation-analytics">
      <div className="analytics-header">
        <h2>Automation Analytics</h2>
        <div className="time-range-selector">
          <label>Time Range:</label>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="24hours">Last 24 Hours</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
        </div>
      </div>

      <div className="analytics-stats">
        <div className="stat-card">
          <div className="stat-header">
            <Icon name="sync-alt" size="lg" color="var(--primary-color)" />
            <div className="stat-info">
              <h3>{analyticsData.totalExecutions}</h3>
              <p>Total Executions</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <Icon name="check" size="lg" color="var(--accent-green)" />
            <div className="stat-info">
              <h3>{analyticsData.successfulExecutions}</h3>
              <p>Successful</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <Icon name="chart-line" size="lg" color="var(--accent-blue)" />
            <div className="stat-info">
              <h3>{analyticsData.successRate}%</h3>
              <p>Success Rate</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <Icon name="folder-open" size="lg" color="var(--accent-orange)" />
            <div className="stat-info">
              <h3>{analyticsData.packagesGenerated}</h3>
              <p>Packages Generated</p>
            </div>
          </div>
        </div>
      </div>

      <div className="analytics-sections">
        <div className="analytics-section">
          <h3>Top Performing Rules</h3>
          <div className="rules-performance">
            {analyticsData.topPerformingRules.length > 0 ? (
              analyticsData.topPerformingRules.map((stat, index) => (
                <div key={stat.rule.id} className="performance-item">
                  <div className="rule-info">
                    <span className="rank">#{index + 1}</span>
                    <div className="rule-details">
                      <h4>{stat.rule.name}</h4>
                      <p>{stat.total} executions</p>
                    </div>
                  </div>
                  <div className="success-rate">
                    <span className={`rate ${stat.successRate >= 80 ? 'high' : stat.successRate >= 60 ? 'medium' : 'low'}`}>
                      {stat.successRate}%
                    </span>
                    <div className="rate-bar">
                      <div 
                        className="rate-fill"
                        style={{ width: `${stat.successRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">No rule executions in selected time range</p>
            )}
          </div>
        </div>

        <div className="analytics-section">
          <h3>Recent Activity</h3>
          <div className="recent-activity">
            {analyticsData.recentActivity.length > 0 ? (
              analyticsData.recentActivity.map((log, index) => (
                <div key={index} className={`activity-item ${getLogClass(log.level)}`}>
                  <Icon name={getLogIcon(log.level)} size="sm" />
                  <div className="activity-details">
                    <div className="activity-message">{log.message}</div>
                    <div className="activity-time">{formatDateTime(log.created_at)}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomationAnalytics;