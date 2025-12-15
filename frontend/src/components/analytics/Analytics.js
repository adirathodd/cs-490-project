import React, { useCallback, useEffect, useState } from 'react';
import { jobsAPI } from '../../services/api';
import { authorizedFetch } from '../../services/authToken';
import { useAuth } from '../../context/AuthContext';
import Icon from '../common/Icon';
import InterviewPerformanceTracking from './InterviewPerformanceTracking';
import ApplicationSuccessAnalysis from './ApplicationSuccessAnalysis';
import CompetitiveAnalysisPanel from './CompetitiveAnalysisPanel';
import ProductivityAnalytics from './ProductivityAnalytics';
import OptimizationDashboard from './OptimizationDashboard';

const card = { padding: 16, borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb', marginBottom: 16 };
const sectionTitle = { fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#1f2937' };
const jobTypeOptions = [
  { id: 'ft', label: 'Full-time' },
  { id: 'pt', label: 'Part-time' },
  { id: 'contract', label: 'Contract' },
  { id: 'temp', label: 'Temporary' },
  { id: 'intern', label: 'Internship' },
];
const createDefaultJobTypeState = () =>
  jobTypeOptions.reduce((acc, option) => {
    acc[option.id] = true;
    return acc;
  }, {});

const tabsConfig = [
  { id: 'applications', label: 'Applications', icon: 'briefcase', description: 'Track job applications' },
  { id: 'success', label: 'Success', icon: 'check-circle', description: 'Analyze success patterns' },
  { id: 'interviews', label: 'Interviews', icon: 'calendar', description: 'Performance tracking' },
  { id: 'competitive', label: 'Competitive', icon: 'users', description: 'Market comparison' },
  { id: 'productivity', label: 'Productivity', icon: 'activity', description: 'Efficiency metrics' },
  { id: 'optimization', label: 'Optimization', icon: 'target', description: 'AI recommendations' },
];

const tabContainerStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 12,
  maxWidth: 1200,
  margin: '0 auto',
  padding: '0 0 8px 0',
};

const getTabStyle = (isActive) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px 12px',
  borderRadius: 12,
  border: isActive ? '2px solid #2563eb' : '1px solid #e5e7eb',
  background: isActive ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : '#fff',
  color: isActive ? '#1d4ed8' : '#4b5563',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: isActive ? '0 4px 12px rgba(37, 99, 235, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.05)',
  minHeight: 90,
  textAlign: 'center',
});

const tabIconStyle = (isActive) => ({
  width: 36,
  height: 36,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 8,
  background: isActive ? '#2563eb' : '#f3f4f6',
  color: isActive ? '#fff' : '#6b7280',
  transition: 'all 0.2s ease',
});

const tabLabelStyle = {
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 2,
};

const tabDescriptionStyle = {
  fontSize: 11,
  fontWeight: 400,
  opacity: 0.75,
};

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('applications');

  return (
    <div style={{ padding: 16, background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ 
            width: 42, 
            height: 42, 
            borderRadius: 12, 
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
          }}>
            <Icon name="bar-chart" size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>Analytics Command Center</h1>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
              Track metrics, analyze patterns, and optimize your job search strategy
            </p>
          </div>
        </div>
      </div>
      
      <div style={tabContainerStyle}>
        {tabsConfig.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={getTabStyle(isActive)}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = '#c7d2fe';
                  e.currentTarget.style.background = '#fafbff';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                }
              }}
            >
              <div style={tabIconStyle(isActive)}>
                <Icon name={tab.icon} size={18} />
              </div>
              <span style={tabLabelStyle}>{tab.label}</span>
              <span style={tabDescriptionStyle}>{tab.description}</span>
            </button>
          );
        })}
      </div>
      
      <div style={{ marginTop: 24, maxWidth: 1200, margin: '24px auto 0' }}>
        {activeTab === 'applications' && <ApplicationAnalyticsPanel />}
        {activeTab === 'success' && <ApplicationSuccessAnalysis />}
        {activeTab === 'interviews' && <InterviewPerformanceTracking />}
        {activeTab === 'competitive' && <CompetitiveAnalysisPanel />}
        {activeTab === 'productivity' && <ProductivityAnalytics />}
        {activeTab === 'optimization' && <OptimizationDashboard />}
      </div>
    </div>
  );
}

function ApplicationAnalyticsPanel() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(() => ({
    startDate: '',
    endDate: '',
    salaryMin: '',
    salaryMax: '',
    jobTypes: createDefaultJobTypeState(),
  }));
  const [goalInputs, setGoalInputs] = useState({ weekly: '', monthly: '' });
  const [savingGoals, setSavingGoals] = useState(false);

  const { loading: authLoading } = useAuth();

  const buildParams = (currentFilters) => {
    const params = {};
    if (currentFilters.startDate) params.start_date = currentFilters.startDate;
    if (currentFilters.endDate) params.end_date = currentFilters.endDate;
    const selectedJobTypes = Object.entries(currentFilters.jobTypes)
      .filter(([, checked]) => checked)
      .map(([key]) => key);
    if (selectedJobTypes.length) params.job_types = selectedJobTypes;
    if (currentFilters.salaryMin !== '') {
      const min = parseFloat(currentFilters.salaryMin);
      if (!Number.isNaN(min)) params.salary_min = min;
    }
    if (currentFilters.salaryMax !== '') {
      const max = parseFloat(currentFilters.salaryMax);
      if (!Number.isNaN(max)) params.salary_max = max;
    }
    return params;
  };

  const loadAnalytics = useCallback(async (activeFilters = filters) => {
    setLoading(true);
    try {
      const params = buildParams(activeFilters);
      const data = await jobsAPI.getAnalytics(params);
      setAnalytics(data);
      setGoalInputs({
        weekly: data.goal_progress?.weekly_goal?.target?.toString() || '',
        monthly: data.goal_progress?.monthly_goal?.target?.toString() || '',
      });
      setError('');
    } catch (e) {
      setError('Failed to load analytics data');
      console.error('Analytics error:', e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!authLoading) {
      loadAnalytics();
    }
  }, [authLoading, loadAnalytics]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleJobTypeToggle = (id) => {
    setFilters((prev) => ({
      ...prev,
      jobTypes: { ...prev.jobTypes, [id]: !prev.jobTypes[id] },
    }));
  };

  const handleResetFilters = () => {
    const resetState = {
      startDate: '',
      endDate: '',
      salaryMin: '',
      salaryMax: '',
      jobTypes: createDefaultJobTypeState(),
    };
    setFilters(resetState);
    loadAnalytics(resetState);
  };

  const handleGoalInputChange = (field, value) => {
    setGoalInputs((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveGoals = async () => {
    const payload = {};
    if (goalInputs.weekly) payload.weekly_target = parseInt(goalInputs.weekly, 10);
    if (goalInputs.monthly) payload.monthly_target = parseInt(goalInputs.monthly, 10);
    if (!payload.weekly_target && !payload.monthly_target) {
      setError('Please provide at least one goal target to update.');
      return;
    }
    try {
      setSavingGoals(true);
      await jobsAPI.updateAnalyticsGoals(payload);
      await loadAnalytics();
      setError('');
    } catch (e) {
      setError('Failed to save application targets');
    } finally {
      setSavingGoals(false);
    }
  };

  const exportAnalytics = async () => {
    try {
      const response = await authorizedFetch('/api/jobs/stats?export=csv');
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = 'analytics_report.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      setError('Failed to export analytics report');
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading analytics dashboard…</div>;
  if (error) return <div style={{ padding: 20, color: '#b91c1c' }}>{error}</div>;
  if (!analytics) return null;

  const {
    funnel_analytics,
    industry_benchmarks,
    response_trends,
    volume_patterns,
    goal_progress,
    insights_recommendations,
    time_to_response,
    salary_insights,
    filters: appliedFilters = {},
  } = analytics;

  const timeMetrics = time_to_response || {};
  const salaryMetrics = salary_insights || {};

  return (
    <div style={{ display: 'grid', gap: 16, padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Application Analytics Dashboard</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280' }}>
            Comprehensive insights into your job search performance
          </p>
        </div>
        <button 
          className="back-button" 
          onClick={exportAnalytics}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Icon name="download" />
          Export Report
        </button>
      </div>

      <div style={card}>
        <h2 style={sectionTitle}>Filter Analytics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label htmlFor="start-date" style={{ fontSize: 12, color: '#6b7280' }}>
              Start date
            </label>
            <input
              id="start-date"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
            />
          </div>
          <div>
            <label htmlFor="end-date" style={{ fontSize: 12, color: '#6b7280' }}>
              End date
            </label>
            <input
              id="end-date"
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
            />
          </div>
          <div>
            <label htmlFor="salary-min" style={{ fontSize: 12, color: '#6b7280' }}>
              Salary minimum
            </label>
            <input
              id="salary-min"
              type="number"
              placeholder="e.g., 70000"
              value={filters.salaryMin}
              onChange={(e) => handleFilterChange('salaryMin', e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
            />
          </div>
          <div>
            <label htmlFor="salary-max" style={{ fontSize: 12, color: '#6b7280' }}>
              Salary maximum
            </label>
            <input
              id="salary-max"
              type="number"
              placeholder="e.g., 120000"
              value={filters.salaryMax}
              onChange={(e) => handleFilterChange('salaryMax', e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
            />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
            Job types
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {jobTypeOptions.map((option) => (
              <label key={option.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={filters.jobTypes[option.id]}
                  onChange={() => handleJobTypeToggle(option.id)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => loadAnalytics(filters)}
            style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontWeight: 600 }}
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600 }}
          >
            Reset
          </button>
          {appliedFilters.start_date && (
            <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>
              Active: {appliedFilters.start_date} - {appliedFilters.end_date || 'today'}
            </span>
          )}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>TOTAL APPLICATIONS</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{funnel_analytics?.total_applications || 0}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>SUCCESS RATE</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: funnel_analytics?.success_rate > 10 ? '#059669' : '#dc2626' }}>
            {funnel_analytics?.success_rate || 0}%
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>WEEKLY GOAL PROGRESS</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: goal_progress?.weekly_goal?.progress_percent >= 100 ? '#059669' : '#f59e0b' }}>
            {goal_progress?.weekly_goal?.current || 0}/{goal_progress?.weekly_goal?.target || 5}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            {goal_progress?.weekly_goal?.progress_percent || 0}% complete
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>RESPONSE RATE</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {funnel_analytics?.response_rate || 0}%
          </div>
        </div>
      </div>

      {/* Stage Timing */}
      <div style={card}>
        <h2 style={sectionTitle}>Stage Timing</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <StageTimingCard label="Application -> Response" value={timeMetrics.avg_application_to_response_days} samples={timeMetrics.samples?.application_to_response} />
          <StageTimingCard label="Application -> Interview" value={timeMetrics.avg_application_to_interview_days} samples={timeMetrics.samples?.application_to_interview} />
          <StageTimingCard label="Interview -> Offer" value={timeMetrics.avg_interview_to_offer_days} samples={timeMetrics.samples?.interview_to_offer} />
        </div>
      </div>

      {/* Application Funnel */}
      <div style={card}>
        <h2 style={sectionTitle}>Application Funnel Analytics</h2>
        <ApplicationFunnel funnel={funnel_analytics} />
      </div>

      {/* Goal Progress */}
      <div style={{ display: 'grid', gridTemplateColumns: goal_progress?.monthly_goal ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div style={card}>
          <h2 style={sectionTitle}>Weekly Goal Progress</h2>
          <GoalProgress goal={goal_progress?.weekly_goal} />
        </div>
        {goal_progress?.monthly_goal && (
          <div style={card}>
            <h2 style={sectionTitle}>Monthly Goal Progress</h2>
            <GoalProgress goal={goal_progress?.monthly_goal} />
          </div>
        )}
      </div>

      {/* Customize Targets */}
      <div style={card}>
        <h2 style={sectionTitle}>Customize Targets</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, color: '#6b7280' }}>
            Weekly applications target
            <input
              type="number"
              min="1"
              value={goalInputs.weekly}
              onChange={(e) => handleGoalInputChange('weekly', e.target.value)}
              style={{ width: '100%', marginTop: 4, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
            />
          </label>
          <label style={{ fontSize: 12, color: '#6b7280' }}>
            Monthly applications target
            <input
              type="number"
              min="1"
              value={goalInputs.monthly}
              onChange={(e) => handleGoalInputChange('monthly', e.target.value)}
              style={{ width: '100%', marginTop: 4, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
            />
          </label>
          <button
            type="button"
            onClick={handleSaveGoals}
            disabled={savingGoals}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: savingGoals ? '#93c5fd' : '#2563eb',
              color: '#fff',
              fontWeight: 600,
              cursor: savingGoals ? 'not-allowed' : 'pointer',
            }}
          >
            {savingGoals ? 'Saving targets...' : 'Save targets'}
          </button>
        </div>
      </div>

      {/* Salary Insights */}
      <div style={card}>
        <h2 style={sectionTitle}>Salary Insights</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Average salary applied</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {salaryMetrics.average_salary ? `$${salaryMetrics.average_salary.toLocaleString()}` : 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Interview rate in this range</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {salaryMetrics.interview_rate ? `${salaryMetrics.interview_rate}%` : 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Offer rate in this range</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {salaryMetrics.offer_rate ? `${salaryMetrics.offer_rate}%` : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Industry Benchmarks */}
      <div style={card}>
        <h2 style={sectionTitle}>Performance vs Industry Benchmarks</h2>
        <BenchmarkComparison benchmarks={industry_benchmarks} analytics={analytics} />
      </div>

      {/* Response Rate Trends */}
      <div style={card}>
        <h2 style={sectionTitle}>Response Rate Trends</h2>
        <ResponseRateTrends trends={response_trends?.monthly_trends} />
      </div>

      {/* Volume Patterns */}
      <div style={card}>
        <h2 style={sectionTitle}>Application Volume Patterns</h2>
        <VolumePatterns patterns={volume_patterns} />
      </div>

      {/* Cover Letter Performance */}
      {analytics.cover_letter_performance && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <Icon name="document" style={{ marginRight: 8 }} />
            Cover Letter Performance
          </h2>
          <CoverLetterPerformancePanel analytics={analytics.cover_letter_performance} />
        </div>
      )}

      {/* Insights & Recommendations */}
      <div style={card}>
        <h2 style={sectionTitle}>Insights & Recommendations</h2>
        <InsightsPanel insights={insights_recommendations} />
      </div>
    </div>
  );
}

// Application Funnel Component
function ApplicationFunnel({ funnel }) {
  const defaultStages = {
    interested: 0,
    applied: 0,
    phone_screen: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
  };
  const counts = { ...defaultStages, ...(funnel?.status_breakdown || {}) };
  const total = Object.values(counts).reduce((sum, val) => sum + (val || 0), 0);
  
  // Use the same structure as JobStats - iterate over actual keys
  const stages = Object.keys(counts).map(key => ({
    name: key.replace('_', ' ').toUpperCase(),
    count: counts[key],
    color: getStageColor(key)
  }));

  // Helper function to assign colors to stages
  function getStageColor(stageName) {
    const colorMap = {
      'interested': '#c084fc', // brighter violet for clear contrast
      'applied': '#60a5fa',
      'phone_screen': '#34d399',
      'interview': '#fbbf24',
      'offer': '#10b981',
      'rejected': '#ef4444'
    };
    return colorMap[stageName] || '#9ca3af';
  }

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
        {stages.map((stage, index) => (
          <div key={stage.name} style={{ textAlign: 'center' }}>
            <div 
              style={{ 
                height: 80, 
                backgroundColor: stage.color, 
                borderRadius: 4,
                display: 'flex',
                alignItems: 'end',
                justifyContent: 'center',
                paddingBottom: 8,
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                position: 'relative',
                opacity: maxCount > 0 ? Math.max(0.3, stage.count / maxCount) : 0.3
              }}
            >
              {stage.count}
            </div>
            <div style={{ fontSize: 12, marginTop: 4, color: '#6b7280' }}>{stage.name}</div>
          </div>
        ))}
      </div>
      {total === 0 && (
        <div style={{ fontSize: 12, color: '#6b7280' }}>No applications yet. Start adding jobs to see your funnel.</div>
      )}
    </div>
  );
}

function StageTimingCard({ label, value, samples }) {
  return (
    <div style={{ padding: 12, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
        {value == null
          ? 'No data'
          : value >= 1
            ? `${value} days`
            : `${(value * 24).toFixed(1)} hrs`}
      </div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>
        {samples ? `${samples} samples` : 'No recent samples'}
      </div>
    </div>
  );
}

// Goal Progress Component
function GoalProgress({ goal }) {
  if (!goal) return <div>No goal data available</div>;

  const progress = goal.progress_percent || 0;
  const isCompleted = progress >= 100;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{goal.current}/{goal.target}</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{progress.toFixed(1)}%</span>
      </div>
      <div style={{ 
        width: '100%', 
        height: 8, 
        backgroundColor: '#e5e7eb', 
        borderRadius: 4, 
        overflow: 'hidden',
        marginBottom: 8
      }}>
        <div 
          style={{ 
            width: `${Math.min(100, progress)}%`, 
            height: '100%', 
            backgroundColor: isCompleted ? '#10b981' : progress > 70 ? '#f59e0b' : '#60a5fa',
            transition: 'width 0.3s ease'
          }} 
        />
      </div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>
        Period: {goal.period}
      </div>
    </div>
  );
}

// Benchmark Comparison Component
function BenchmarkComparison({ benchmarks, analytics }) {
  if (!benchmarks || !analytics) return <div>No benchmark data available</div>;

  const userSuccess = analytics.funnel_analytics?.success_rate || 0;
  const industryAvg = benchmarks.industry_standards?.conversion_rates?.overall_success_rate || 10;
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
      <div style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 6 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>YOUR SUCCESS RATE</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: userSuccess > industryAvg ? '#059669' : '#dc2626' }}>
          {userSuccess}%
        </div>
      </div>
      <div style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 6 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>INDUSTRY AVERAGE</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{industryAvg}%</div>
      </div>
      <div style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 6 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>RECOMMENDED WEEKLY APPS</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          {benchmarks.industry_standards?.application_volume?.applications_per_week || 5}
        </div>
      </div>
    </div>
  );
}

// Response Rate Trends Component
function ResponseRateTrends({ trends }) {
  if (!trends || !Array.isArray(trends) || trends.length === 0) {
    return <div>No trend data available</div>;
  }

  const maxRate = Math.max(...trends.map(t => t.response_rate || 0), 1);

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'end', height: 120, marginBottom: 16 }}>
        {trends.slice(-6).map((trend, index) => {
          // Parse the date properly
          let monthLabel = 'N/A';
          try {
            if (trend.month) {
              // Handle both ISO date strings and YYYY-MM format
              const dateStr = trend.month.includes('-01') ? trend.month : `${trend.month}-01`;
              const date = new Date(dateStr);
              if (!isNaN(date.getTime())) {
                monthLabel = date.toLocaleDateString('en', { month: 'short' });
              }
            }
          } catch (e) {
            console.warn('Date parsing error:', e);
          }

          return (
            <div key={trend.month || index} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div 
                  style={{ 
                    height: `${maxRate > 0 ? (trend.response_rate / maxRate) * 80 : 4}px`,
                    minHeight: '4px',
                    backgroundColor: trend.response_rate > 20 ? '#10b981' : '#60a5fa',
                    width: '20px',
                    borderRadius: '2px 2px 0 0'
                  }}
                />
                <div style={{ fontSize: 10, color: '#6b7280' }}>
                  {monthLabel}
                </div>
              </div>
              <div style={{ fontSize: 9, color: '#059669', marginTop: 2 }}>
                {trend.response_rate}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Volume Patterns Component  
function VolumePatterns({ patterns }) {
  // Always show a bar graph, even if no data - create empty data structure
  let dailyData = [];
  
  if (patterns && patterns.weekly_volume && patterns.weekly_volume.length > 0) {
    dailyData = patterns.weekly_volume.map(item => ({
      date: item.week,
      count: item.count
    }));
  } else {
    // Create empty data for the last 8 weeks if no data available
    const today = new Date();
    for (let i = 7; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - (i * 7));
      dailyData.push({
        date: date.toISOString().split('T')[0],
        count: 0
      });
    }
  }

  const maxApplications = Math.max(...dailyData.map(d => d.count || 0), 1);

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Applications by Day</h3>
      <div style={{ display: 'flex', gap: 2, alignItems: 'end', height: 80, marginBottom: 8 }}>
        {dailyData.map((day, index) => {
          const date = new Date(day.date);
          const dayOfMonth = date.getDate();
          const monthName = date.toLocaleDateString('en', { month: 'short' });
          
          return (
            <div key={day.date || index} style={{ flex: 1, textAlign: 'center' }}>
              <div 
                style={{ 
                  height: `${Math.max(4, (day.count / maxApplications) * 60)}px`,
                  backgroundColor: day.count > 0 ? '#60a5fa' : '#e5e7eb',
                  width: '100%',
                  borderRadius: '2px 2px 0 0',
                  display: 'flex',
                  alignItems: 'end',
                  justifyContent: 'center',
                  color: day.count > 0 ? '#fff' : 'transparent',
                  fontSize: 10,
                  fontWeight: 600,
                  paddingBottom: 2,
                }}
              >
                {day.count > 0 ? day.count : ''}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                {monthName} {dayOfMonth}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Insights Panel Component
function InsightsPanel({ insights }) {
  if (!insights) return <div>No insights available</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#059669' }}>
          <Icon name="lightBulb" style={{ marginRight: 4 }} />
          Key Insights
        </h3>
        {insights.insights?.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {insights.insights.map((insight, index) => (
              <li key={index} style={{ fontSize: 13, marginBottom: 4, color: '#374151' }}>
                {insight}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Apply to more positions to generate insights
          </p>
        )}
      </div>
      
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#dc2626' }}>
          <Icon name="target" style={{ marginRight: 4 }} />
          Recommendations
        </h3>
        {insights.recommendations?.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {insights.recommendations.map((rec, index) => (
              <li key={index} style={{ fontSize: 13, marginBottom: 4, color: '#374151' }}>
                {rec}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Keep tracking applications for personalized recommendations
          </p>
        )}
      </div>
    </div>
  );
}

// Cover Letter Performance Panel Component
function CoverLetterPerformancePanel({ analytics }) {
  if (!analytics || !analytics.tone_performance) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
      No cover letter analytics data available. Start applying with AI-generated cover letters to see performance insights.
    </div>;
  }

  const { 
    total_cover_letters, 
    tone_performance, 
    best_performing_tone, 
    insights 
  } = analytics;

  const getPerformanceColor = (rate) => {
    if (rate >= 75) return '#059669';
    if (rate >= 50) return '#d97706';
    if (rate >= 25) return '#dc2626';
    return '#6b7280';
  };

  return (
    <div>
      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ textAlign: 'center', padding: 12, background: '#f9fafb', borderRadius: 6 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#059669' }}>
            {total_cover_letters}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Cover Letters Tracked</div>
        </div>
        <div style={{ textAlign: 'center', padding: 12, background: '#f9fafb', borderRadius: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626', textTransform: 'capitalize' }}>
            {best_performing_tone || 'N/A'}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Best Performing Tone</div>
        </div>
      </div>

      {/* Performance by Tone */}
      {Object.keys(tone_performance).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Performance by Tone</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {Object.entries(tone_performance).map(([tone, stats]) => (
              <div 
                key={tone}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: 12, 
                  border: tone === best_performing_tone ? '2px solid #059669' : '1px solid #e5e7eb',
                  borderRadius: 6,
                  background: tone === best_performing_tone ? '#f0fdf4' : '#fff'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize', marginBottom: 4 }}>
                    {tone}
                    {tone === best_performing_tone && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: '#059669' }}>🏆 Best</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {stats.total_applications} applications → {stats.responses} responses → {stats.interviews} interviews → {stats.offers} offers
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: getPerformanceColor(stats.response_rate) }}>
                      {stats.response_rate}%
                    </div>
                    <div style={{ color: '#6b7280' }}>Response</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: getPerformanceColor(stats.interview_rate) }}>
                      {stats.interview_rate}%
                    </div>
                    <div style={{ color: '#6b7280' }}>Interview</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: getPerformanceColor(stats.offer_rate) }}>
                      {stats.offer_rate}%
                    </div>
                    <div style={{ color: '#6b7280' }}>Offer</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {insights && insights.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Insights</h4>
          {insights.map((insight, index) => (
            <div 
              key={index}
              style={{ 
                padding: 8, 
                background: '#f0f9ff', 
                border: '1px solid #0ea5e9', 
                borderRadius: 4,
                fontSize: 13,
                color: '#0c4a6e',
                marginBottom: 6
              }}
            >
              💡 {insight}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
