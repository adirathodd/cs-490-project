import React, { useState, useEffect } from 'react';
import { automationAPI } from '../../services/automationAPI';
import AutomationRulesList from './AutomationRulesList';
import AutomationRuleForm from './AutomationRuleForm';
import ScheduledSubmissions from './ScheduledSubmissions';
import ApplicationPackages from './ApplicationPackages';
import LoadingSpinner from '../common/LoadingSpinner';
import Icon from '../common/Icon';
import './AutomationDashboard.css';

const AutomationDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [automationRules, setAutomationRules] = useState([]);
  const [scheduledSubmissions, setScheduledSubmissions] = useState([]);
  const [applicationPackages, setApplicationPackages] = useState([]);
  const [automationLogs, setAutomationLogs] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    totalRules: 0,
    activeRules: 0,
    scheduledSubmissions: 0,
    generatedPackages: 0,
    automationActivity: 0
  });
  const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch real data from API
      const [rulesData, submissionsData, packagesData, logsData] = await Promise.all([
        automationAPI.getAutomationRules().catch(() => ({ rules: [] })),
        automationAPI.getScheduledSubmissions().catch(() => ({ submissions: [] })),
        automationAPI.getApplicationPackages().catch(() => ({ packages: [] })),
        automationAPI.getAutomationLogs().catch(() => ({ logs: [] }))
      ]);

      const rules = rulesData.rules || [];
      const submissions = submissionsData.submissions || [];
      const packages = packagesData.packages || [];
      const logs = logsData.logs || [];

      setAutomationRules(rules);
      setScheduledSubmissions(submissions);
      setApplicationPackages(packages);
      setAutomationLogs(logs);

      // Calculate dashboard stats
      setDashboardStats({
        totalRules: rules.length,
        activeRules: rules.filter(rule => rule.is_active).length,
        scheduledSubmissions: submissions.length,
        generatedPackages: packages.length,
        automationActivity: logs.length
      });

      setError('');
    } catch (error) {
      console.error('Failed to load automation dashboard data:', error);
      setError('Failed to load automation data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = () => {
    setSelectedRule(null);
    setIsRuleFormOpen(true);
  };

  const handleEditRule = (rule) => {
    setSelectedRule(rule);
    setIsRuleFormOpen(true);
  };

  const handleRuleFormClose = () => {
    setIsRuleFormOpen(false);
    setSelectedRule(null);
  };

  const handleRuleFormSubmit = async (ruleData) => {
    try {
      if (selectedRule) {
        await automationAPI.updateAutomationRule(selectedRule.id, ruleData);
      } else {
        await automationAPI.createAutomationRule(ruleData);
      }
      
      handleRuleFormClose();
      loadDashboardData(); // Refresh data
    } catch (err) {
      console.error('Failed to save automation rule:', err);
      setError('Failed to save automation rule');
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      await automationAPI.deleteAutomationRule(ruleId);
      loadDashboardData(); // Refresh data
    } catch (err) {
      console.error('Failed to delete automation rule:', err);
      setError('Failed to delete automation rule');
    }
  };

  if (loading) {
    return (
      <div className="automation-dashboard">
        <div className="loading-container">
          <LoadingSpinner />
          <p>Loading automation dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="automation-dashboard">
      <div className="automation-header">
        <div className="automation-title-section">
          <h1>Application Workflow Automation</h1>
          <p>Manage automated job application workflows, scheduling, and analytics</p>
        </div>
        
        <div className="automation-tabs">
          <button
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Icon name="assessment" />
            Overview
          </button>
          <button
            className={`tab-button ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            <Icon name="auto_mode" />
            Automation Rules
          </button>
          <button
            className={`tab-button ${activeTab === 'scheduled' ? 'active' : ''}`}
            onClick={() => setActiveTab('scheduled')}
          >
            <Icon name="schedule" />
            Scheduled Submissions
          </button>
          <button
            className={`tab-button ${activeTab === 'packages' ? 'active' : ''}`}
            onClick={() => setActiveTab('packages')}
          >
            <Icon name="folder" />
            Application Packages
          </button>
        </div>

        {activeTab === 'rules' && (
          <button className="btn btn-primary" onClick={handleCreateRule}>
            <Icon name="add" />
            Create Rule
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          <Icon name="error" />
          {error}
          <button onClick={() => setError('')} className="alert-close">×</button>
        </div>
      )}

      <div className="automation-content">
        {activeTab === 'overview' && (
          <>
            {/* Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <Icon name="auto_mode" />
                </div>
                <div className="stat-content">
                  <h3>{dashboardStats.totalRules}</h3>
                  <p>Total Rules</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon success">
                  <Icon name="check_circle" />
                </div>
                <div className="stat-content">
                  <h3>{dashboardStats.activeRules}</h3>
                  <p>Active Rules</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon warning">
                  <Icon name="schedule" />
                </div>
                <div className="stat-content">
                  <h3>{dashboardStats.scheduledSubmissions}</h3>
                  <p>Scheduled</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon info">
                  <Icon name="folder" />
                </div>
                <div className="stat-content">
                  <h3>{dashboardStats.generatedPackages}</h3>
                  <p>Packages</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon secondary">
                  <Icon name="assessment" />
                </div>
                <div className="stat-content">
                  <h3>{dashboardStats.automationActivity}</h3>
                  <p>24h Activity</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <div className="card-header">
                <h3>Quick Actions</h3>
              </div>
              <div className="card-content">
                <div className="quick-actions">
                  <button className="btn btn-outline" onClick={handleCreateRule}>
                    <Icon name="add" />
                    Create Automation Rule
                  </button>
                  <button className="btn btn-outline" onClick={() => setActiveTab('scheduled')}>
                    <Icon name="schedule" />
                    View Scheduled Submissions
                  </button>
                  <button className="btn btn-outline" onClick={() => setActiveTab('packages')}>
                    <Icon name="folder" />
                    View Application Packages
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card">
              <div className="card-header">
                <h3>Recent Automation Activity</h3>
              </div>
              <div className="card-content">
                {automationLogs.length > 0 ? (
                  <div className="activity-list">
                    {automationLogs.slice(0, 5).map((log, index) => (
                      <div key={log.id || index} className={`activity-item ${log.level}`}>
                        <div className="activity-icon">
                          <Icon name={log.level === 'error' ? 'error' : 'check_circle'} />
                        </div>
                        <div className="activity-content">
                          <p>{log.message}</p>
                          <span className="activity-time">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className={`activity-badge ${log.level}`}>
                          {log.level}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-data">No recent automation activity</p>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'rules' && (
          <AutomationRulesList
            rules={automationRules}
            onEdit={handleEditRule}
            onDelete={handleDeleteRule}
            onRefresh={loadDashboardData}
          />
        )}

        {activeTab === 'scheduled' && (
          <ScheduledSubmissions
            submissions={scheduledSubmissions}
            onRefresh={loadDashboardData}
          />
        )}

        {activeTab === 'packages' && (
          <ApplicationPackages
            packages={applicationPackages}
            onRefresh={loadDashboardData}
          />
        )}
      </div>

      {/* Inline Rule Form - No Modal */}
      {isRuleFormOpen && (
        <div className="form-section" style={{ marginTop: '20px' }}>
          <div className="form-header">
            <h3>{selectedRule ? 'Edit Automation Rule' : 'Create Automation Rule'}</h3>
            <button 
              className="btn-secondary" 
              onClick={handleRuleFormClose}
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              Cancel
            </button>
          </div>
          <AutomationRuleForm
            rule={selectedRule}
            onSubmit={handleRuleFormSubmit}
            onCancel={handleRuleFormClose}
          />
        </div>
      )}
    </div>
  );
};

export default AutomationDashboard;