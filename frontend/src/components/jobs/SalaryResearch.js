import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { salaryAPI, jobsAPI } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import Icon from '../common/Icon';
import './SalaryResearch.css';

const SalaryResearch = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState(null);
  const [researchData, setResearchData] = useState(null);
  const [hasData, setHasData] = useState(false);
  const [selectedView, setSelectedView] = useState('overview'); // overview, comparisons, trends, negotiation
  
  useEffect(() => {
    fetchJobAndResearch();
  }, [jobId]);
  
  const fetchJobAndResearch = async () => {
    try {
      setLoading(true);
      setError('');

      const jobData = await jobsAPI.getJob(jobId);
      setJob(jobData);

      const research = await salaryAPI.getSalaryResearch(jobId);
      if (research.has_data) {
        setResearchData(research);
        setHasData(true);
      } else {
        setResearchData(null);
        setHasData(false);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load salary research');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerResearch = async (forceRefresh = false) => {
    try {
      setResearching(true);
      setError('');

      await salaryAPI.triggerResearch(jobId, { force_refresh: forceRefresh });
      await fetchJobAndResearch();
    } catch (err) {
      console.error('Error triggering research:', err);
      setError(err.message || 'Failed to generate salary research');
    } finally {
      setResearching(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await salaryAPI.exportResearch(jobId, 'json');
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `salary_research_${(job?.title || 'job').replace(/\s+/g, '_')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting:', err);
      setError('Failed to export research data');
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return 'N/A';
    }
    return `$${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const formatPercent = (value, fractionDigits = 1) => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return '0%';
    }
    return `${num > 0 ? '+' : ''}${num.toFixed(fractionDigits)}%`;
  };

  const toNumber = (value) => {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const num = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  };

  const historicalTrends = (researchData?.historical_data || []).map((trend) => ({
    ...trend,
    salary_min: toNumber(trend.salary_min),
    salary_max: toNumber(trend.salary_max),
    salary_median: toNumber(trend.salary_median),
    growth_rate: toNumber(trend.growth_rate),
  }));

  const historicalMin = historicalTrends.length ? Math.min(...historicalTrends.map((t) => t.salary_min)) : 0;
  const historicalMax = historicalTrends.length ? Math.max(...historicalTrends.map((t) => t.salary_max)) : 0;
  const historicalRange = historicalMax - historicalMin || 1;

  const clampPercent = (value) => Math.min(100, Math.max(0, value));
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!job) {
    return (
      <div className="salary-research-container">
        <div className="error-message">
          Job not found
        </div>
      </div>
    );
  }
  
  return (
    <div className="salary-research-container">
      {/* Header */}
      <div className="salary-research-header">
        <div>
          <h1 className="salary-research-title">
            <Icon name="briefcase" size="lg" /> Salary Research
          </h1>
          <p className="salary-research-subtitle">
            Market insights for {job.title} at {job.company_name}
          </p>
        </div>
        <div className="salary-research-actions">
          <button className="btn-secondary" onClick={() => navigate('/jobs')}>
            <Icon name="arrow-left" size="sm" /> Back to Jobs
          </button>
          {hasData && (
            <>
              <button className="btn-secondary" onClick={handleExport}>
                <Icon name="download" size="sm" /> Export Report
              </button>
              <button 
                className="btn-primary" 
                onClick={() => handleTriggerResearch(true)}
                disabled={researching}
              >
                <Icon name="refresh" size="sm" /> {researching ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </>
          )}
        </div>
      </div>
      
      {error && (
        <div className="error-message">
          <Icon name="alert" size="sm" /> {error}
        </div>
      )}
      
      {/* No Data State */}
      {!hasData && !researching && (
        <div className="salary-research-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Icon name="briefcase" size="xl" color="#6c3fb5" />
            <h2 style={{ marginTop: '20px', marginBottom: '10px' }}>No Salary Research Available</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>
              Generate comprehensive salary insights for this position including market ranges,
              company comparisons, historical trends, and negotiation recommendations.
            </p>
            <button 
              className="btn-primary" 
              onClick={() => handleTriggerResearch(false)}
              disabled={researching}
              style={{ padding: '14px 32px', fontSize: '16px' }}
            >
              {researching ? (
                <>
                  <Icon name="refresh" size="sm" /> Generating Research...
                </>
              ) : (
                <>
                  <Icon name="idea" size="sm" /> Generate Salary Research
                </>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Research Data View */}
      {hasData && researchData && (
        <>
          {/* Navigation Tabs */}
          <div className="tabs-container" style={{ marginBottom: '24px' }}>
            <div className="tabs">
              <button
                className={`tab ${selectedView === 'overview' ? 'active' : ''}`}
                onClick={() => setSelectedView('overview')}
              >
                Overview
              </button>
              <button
                className={`tab ${selectedView === 'comparisons' ? 'active' : ''}`}
                onClick={() => setSelectedView('comparisons')}
              >
                Company Comparisons
              </button>
              <button
                className={`tab ${selectedView === 'trends' ? 'active' : ''}`}
                onClick={() => setSelectedView('trends')}
              >
                Historical Trends
              </button>
              <button
                className={`tab ${selectedView === 'negotiation' ? 'active' : ''}`}
                onClick={() => setSelectedView('negotiation')}
              >
                Negotiation Tips
              </button>
            </div>
          </div>
          
          {/* Overview Tab */}
          {selectedView === 'overview' && (
            <div className="salary-research-grid">
              {/* Salary Range Card */}
              <div className="salary-research-card">
                <h2>Salary Range</h2>
                <div className="salary-stats">
                  <div className="stat-row">
                    <div className="stat-item">
                      <div className="stat-label">Minimum</div>
                      <div className="stat-value">{formatCurrency(researchData.salary_min)}</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-label">Median</div>
                      <div className="stat-value" style={{ color: '#6c3fb5', fontSize: '28px', fontWeight: 'bold' }}>
                        {formatCurrency(researchData.salary_median)}
                      </div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-label">Maximum</div>
                      <div className="stat-value">{formatCurrency(researchData.salary_max)}</div>
                    </div>
                  </div>
                  
                  {/* Salary Range Bar */}
                  <div style={{ margin: '24px 0' }}>
                    <div style={{ 
                      height: '12px', 
                      background: 'linear-gradient(90deg, #e0e0e0 0%, #6c3fb5 50%, #a855f7 100%)',
                      borderRadius: '6px',
                      position: 'relative'
                    }}>
                      {researchData.salary_median && (
                        <div style={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '4px',
                          height: '20px',
                          backgroundColor: '#fff',
                          border: '2px solid #6c3fb5',
                          borderRadius: '2px'
                        }} />
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#666' }}>
                      <span>25th Percentile: {formatCurrency(researchData.percentile_25)}</span>
                      <span>75th Percentile: {formatCurrency(researchData.percentile_75)}</span>
                    </div>
                  </div>
                  
                </div>
              </div>
              
              {/* Total Compensation Card */}
              <div className="salary-research-card">
                <h2>Total Compensation</h2>
                <div className="compensation-breakdown">
                  <div className="comp-item">
                    <span className="comp-label">Base Salary</span>
                    <span className="comp-value">{formatCurrency(researchData.base_salary)}</span>
                  </div>
                  <div className="comp-item">
                    <span className="comp-label">Average Bonus</span>
                    <span className="comp-value">{formatCurrency(researchData.bonus_avg)}</span>
                  </div>
                  <div className="comp-item">
                    <span className="comp-label">Stock/Equity</span>
                    <span className="comp-value">{formatCurrency(researchData.stock_equity)}</span>
                  </div>
                  <div className="comp-divider"></div>
                  <div className="comp-item comp-total">
                    <span className="comp-label">Total Comp Range</span>
                    <span className="comp-value">
                      {formatCurrency(researchData.total_comp_min)} - {formatCurrency(researchData.total_comp_max)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Market Insights Card */}
              <div className="salary-research-card">
                <h2>Market Insights</h2>
                <div className="market-insights">
                  <div className="insight-item">
                    <Icon name="chart" size="md" color="#6c3fb5" />
                    <div>
                      <div className="insight-label">Market Trend</div>
                      <div className="insight-value" style={{ textTransform: 'capitalize' }}>
                        {researchData.market_trend || 'Stable'}
                        {researchData.market_trend === 'up' && ' 📈'}
                        {researchData.market_trend === 'down' && ' 📉'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="insight-item">
                    <Icon name="users" size="md" color="#6c3fb5" />
                    <div>
                      <div className="insight-label">Data Points</div>
                      <div className="insight-value">{researchData.sample_size || 'N/A'} salaries analyzed</div>
                    </div>
                  </div>
                  
                  <div className="insight-item">
                    <Icon name="location" size="md" color="#6c3fb5" />
                    <div>
                      <div className="insight-label">Location</div>
                      <div className="insight-value">{researchData.location}</div>
                    </div>
                  </div>
                  
                  <div className="insight-item">
                    <Icon name="briefcase" size="md" color="#6c3fb5" />
                    <div>
                      <div className="insight-label">Experience Level</div>
                      <div className="insight-value" style={{ textTransform: 'capitalize' }}>
                        {researchData.experience_level || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Benefits Card */}
              {researchData.benefits && Object.keys(researchData.benefits).length > 0 && (
                <div className="salary-research-card">
                  <h2>Benefits Package</h2>
                  <div className="benefits-list">
                    {Object.entries(researchData.benefits).map(([key, value]) => (
                      <div key={key} className="benefit-item">
                        <Icon name="check" size="sm" color="#4caf50" />
                        <div>
                          <div className="benefit-name">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                          <div className="benefit-value">{value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Company Comparisons Tab */}
          {selectedView === 'comparisons' && (
            <div className="salary-research-card">
              <h2>Company Salary Comparisons</h2>
              {researchData.company_comparisons && researchData.company_comparisons.length > 0 ? (
                <div className="comparisons-table">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Company</th>
                        <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Min</th>
                        <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Median</th>
                        <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Max</th>
                        <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Total Comp</th>
                        <th style={{ textAlign: 'center', padding: '12px', fontWeight: '600' }}>Benefits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {researchData.company_comparisons.map((comp, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '12px', fontWeight: '500' }}>{comp.company}</td>
                          <td style={{ textAlign: 'right', padding: '12px' }}>{formatCurrency(comp.salary_min)}</td>
                          <td style={{ textAlign: 'right', padding: '12px', fontWeight: '600', color: '#6c3fb5' }}>
                            {formatCurrency(comp.salary_median)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '12px' }}>{formatCurrency(comp.salary_max)}</td>
                          <td style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>
                            {formatCurrency(comp.total_comp_estimated)}
                          </td>
                          <td style={{ textAlign: 'center', padding: '12px' }}>
                            <span className="badge" style={{
                              background: comp.benefits_rating === 'Excellent' ? '#4caf50' :
                                         comp.benefits_rating === 'Good' ? '#2196f3' : '#9e9e9e',
                              color: 'white',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px'
                            }}>
                              {comp.benefits_rating}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
                  No company comparison data available
                </p>
              )}
            </div>
          )}
          
          {/* Historical Trends Tab */}
          {selectedView === 'trends' && (
            <div className="salary-research-card">
              <h2>Historical Salary Trends</h2>
              {historicalTrends.length > 0 ? (
                <div className="trends-chart">
                  {historicalTrends.map((trend, idx) => {
                    const rangeStart = clampPercent(((trend.salary_min - historicalMin) / historicalRange) * 100);
                    const rangeEnd = clampPercent(((trend.salary_max - historicalMin) / historicalRange) * 100);
                    const rawWidth = Math.max(rangeEnd - rangeStart, 0);
                    const width = Math.min(100 - rangeStart, Math.max(rawWidth, 6));
                    const growthColor = trend.growth_rate > 0 ? '#16a34a' : trend.growth_rate < 0 ? '#dc2626' : '#64748b';
                    return (
                      <div
                        key={`${trend.year}-${idx}`}
                        className="trend-row"
                        style={{ borderBottom: idx === historicalTrends.length - 1 ? 'none' : '1px solid #f0f0f0' }}
                      >
                        <div className="trend-year">{trend.year}</div>
                        <div className="trend-details">
                          <div className="trend-bar-wrapper">
                            <div className="trend-bar-track">
                              <div
                                className="trend-bar-range"
                                style={{ left: `${rangeStart}%`, width: `${width}%` }}
                              >
                                {formatCurrency(trend.salary_median)}
                              </div>
                            </div>
                            <div className="trend-growth" style={{ color: growthColor }}>
                              {formatPercent(trend.growth_rate, 0)}
                            </div>
                          </div>
                          <div className="trend-range-text">
                            Range: {formatCurrency(trend.salary_min)} - {formatCurrency(trend.salary_max)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
                  No historical trend data available
                </p>
              )}
            </div>
          )}
          
          {/* Negotiation Tips Tab */}
          {selectedView === 'negotiation' && (
            <div className="salary-research-grid">
              <div className="salary-research-card">
                <h2>Negotiation Recommendations</h2>
                <div className="negotiation-content">
                  <div className="negotiation-summary" style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    marginBottom: '24px'
                  }}>
                    <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>
                      Recommended Target Salary
                    </div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' }}>
                      {formatCurrency(researchData.recommended_ask)}
                    </div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>
                      Negotiation Leverage: <strong style={{ textTransform: 'capitalize' }}>
                        {researchData.negotiation_leverage || 'Medium'}
                      </strong>
                    </div>
                  </div>
                  
                  {researchData.negotiation_tips && (
                    <div className="tips-list">
                      {researchData.negotiation_tips.split('\n\n').filter(tip => tip.trim()).map((tip, idx) => (
                        <div key={idx} className="tip-item" style={{
                          display: 'flex',
                          gap: '12px',
                          padding: '16px',
                          background: '#f5f5f5',
                          borderRadius: '8px',
                          marginBottom: '12px'
                        }}>
                          <div style={{ 
                            minWidth: '24px', 
                            height: '24px', 
                            background: '#6c3fb5', 
                            color: 'white',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            marginTop: '2px'
                          }}>
                            {idx + 1}
                          </div>
                          <div style={{ flex: 1, fontSize: '14px', lineHeight: '1.6' }}>
                            {tip}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SalaryResearch;
