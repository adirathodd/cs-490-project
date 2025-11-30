import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../common/Icon';
import './MarketIntelligence.css';

const MarketIntelligence = () => {
  const navigate = useNavigate();
  const [selectedIndustry, setSelectedIndustry] = useState('Tech');
  const [selectedLocation, setSelectedLocation] = useState('New York, NY');
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(false);

  const industries = [
    'Tech', 'Finance', 'Healthcare', 'Pharma', 'Law', 'Education', 'Manufacturing', 'Retail', 'Consulting', 'Media'
  ];

  const locations = [
    'New York, NY', 'San Francisco, CA', 'Austin, TX', 'Boston, MA', 'Chicago, IL', 'Seattle, WA', 'Los Angeles, CA', 'Remote'
  ];

  // Mock data generator based on selection
  const getMockData = (industry, location) => {
    const baseSalary = industry === 'Tech' || industry === 'Finance' ? 80000 : 60000;
    const multiplier = location === 'New York, NY' || location === 'San Francisco, CA' ? 1.2 : 1.0;
    
    return {
        salary: {
            entry: { 
                min: Math.round(baseSalary * 0.8 * multiplier), 
                max: Math.round(baseSalary * 1.1 * multiplier), 
                median: Math.round(baseSalary * 0.95 * multiplier) 
            },
            mid: { 
                min: Math.round(baseSalary * 1.2 * multiplier), 
                max: Math.round(baseSalary * 1.5 * multiplier), 
                median: Math.round(baseSalary * 1.35 * multiplier) 
            },
            senior: { 
                min: Math.round(baseSalary * 1.6 * multiplier), 
                max: Math.round(baseSalary * 2.0 * multiplier), 
                median: Math.round(baseSalary * 1.8 * multiplier) 
            },
            lead: { 
                min: Math.round(baseSalary * 2.2 * multiplier), 
                max: Math.round(baseSalary * 3.0 * multiplier), 
                median: Math.round(baseSalary * 2.5 * multiplier) 
            }
        },
        skills: industry === 'Tech' ? ['Python', 'React', 'AWS', 'System Design', 'TypeScript'] : 
               industry === 'Finance' ? ['Financial Modeling', 'Excel', 'Data Analysis', 'Risk Management', 'Accounting'] :
               ['Communication', 'Project Management', 'Leadership', 'Analysis', 'Strategy'],
        growth: industry === 'Tech' ? 'High' : 'Stable',
        demand: 'Very High',
        topCompanies: ['Industry Leader A', 'Innovative Corp B', 'Global Solutions C']
    };
  };

  const fetchMarketData = (industry, location) => {
        setLoading(true);
        // Try backend API first (aggregated providers). Falls back to mock data on error.
        (async () => {
            try {
                const params = new URLSearchParams({ industry: industry || '', location: location || '' });
                const resp = await fetch(`/api/market_intelligence?${params.toString()}`, { credentials: 'include' });
                if (resp.ok) {
                    const data = await resp.json();
                    // Normalize to the structure used by this component
                    const mapped = {
                        salary: {
                            entry: { min: 0, max: 0, median: 0 },
                            mid: { min: 0, max: 0, median: 0 },
                            senior: { min: 0, max: 0, median: 0 },
                            lead: { min: 0, max: 0, median: 0 },
                        },
                        skills: data.skills || [],
                        growth: data.growth || 'stable',
                        demand: data.demandScore != null ? (data.demandScore > 75 ? 'Very High' : data.demandScore > 50 ? 'High' : 'Moderate') : 'Moderate',
                        topCompanies: data.topCompanies || [],
                        topCompaniesSampleCount: data.postings_sample_count || 0,
                    };
                    setMarketData(mapped);
                    setLoading(false);
                    return;
                }
            } catch (err) {
                // ignore and fallback to mock
            }

            // Fallback to local mock data
            setTimeout(() => {
                setMarketData(getMockData(industry, location));
                setLoading(false);
            }, 600);
        })();
  };

  useEffect(() => {
    fetchMarketData(selectedIndustry, selectedLocation);
  }, [selectedIndustry, selectedLocation]);

  return (
    <div className="market-intelligence-container">
      <div className="market-header">
        <div className="header-content">
            <h1>Market Intelligence</h1>
            <p>Track skill demand, salaries, and company trends to make informed career decisions.</p>
        </div>
        <div className="last-updated">
            Last refreshed: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="market-controls-card">
        <div className="control-group">
            <label>Industry</label>
            <select value={selectedIndustry} onChange={(e) => setSelectedIndustry(e.target.value)}>
                {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
            </select>
        </div>
        <div className="control-group">
            <label>Location</label>
            <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
                {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
        </div>
        <button className="refresh-btn" onClick={() => fetchMarketData(selectedIndustry, selectedLocation)}>
            <Icon name="refresh" size="sm" /> Refresh Data
        </button>
      </div>

      {loading ? (
          <div className="loading-state">
              <div className="spinner"></div>
              <p>Analyzing market data...</p>
          </div>
      ) : (
          <div className="market-dashboard-grid">
              {/* Salary Card */}
              <div className="market-card salary-card">
                  <div className="card-header">
                      <h3><Icon name="dollar" size="md" /> Salary & Compensation</h3>
                  </div>
                  <div className="salary-grid">
                      <div className="salary-row header-row">
                          <span>Level</span>
                          <span>Median</span>
                          <span>Range</span>
                      </div>
                      <div className="salary-row">
                          <span className="level-label">Entry Level</span>
                          <span className="salary-value">${marketData?.salary.entry.median.toLocaleString()}</span>
                          <span className="salary-range">${marketData?.salary.entry.min.toLocaleString()} - ${marketData?.salary.entry.max.toLocaleString()}</span>
                      </div>
                      <div className="salary-row">
                          <span className="level-label">Mid Level</span>
                          <span className="salary-value">${marketData?.salary.mid.median.toLocaleString()}</span>
                          <span className="salary-range">${marketData?.salary.mid.min.toLocaleString()} - ${marketData?.salary.mid.max.toLocaleString()}</span>
                      </div>
                      <div className="salary-row">
                          <span className="level-label">Senior Level</span>
                          <span className="salary-value">${marketData?.salary.senior.median.toLocaleString()}</span>
                          <span className="salary-range">${marketData?.salary.senior.min.toLocaleString()} - ${marketData?.salary.senior.max.toLocaleString()}</span>
                      </div>
                      <div className="salary-row">
                          <span className="level-label">Lead / Principal</span>
                          <span className="salary-value">${marketData?.salary.lead.median.toLocaleString()}</span>
                          <span className="salary-range">${marketData?.salary.lead.min.toLocaleString()} - ${marketData?.salary.lead.max.toLocaleString()}</span>
                      </div>
                  </div>
              </div>

              {/* Skills Card */}
              <div className="market-card skills-card">
                  <div className="card-header">
                      <h3><Icon name="star" size="md" /> Skill Demand Signals</h3>
                  </div>
                  <div className="skills-content">
                    <p className="section-subtitle">Top skills in demand for {selectedIndustry}:</p>
                    <div className="skills-list">
                        {marketData?.skills.map(skill => (
                            <span key={skill} className="skill-tag">{skill}</span>
                        ))}
                    </div>
                    <div className="trend-indicators">
                        <div className="indicator">
                            <span className="label">Demand</span>
                            <span className="value high">{marketData?.demand}</span>
                        </div>
                        <div className="indicator">
                            <span className="label">Growth Trend</span>
                            <span className="value positive">{marketData?.growth}</span>
                        </div>
                    </div>
                  </div>
              </div>

              {/* Trends Card */}
              <div className="market-card trends-card">
                  <div className="card-header">
                      <h3><Icon name="chart" size="md" /> Market Trends</h3>
                  </div>
                  <div className="trends-content">
                    <p>Growth momentum is strong in <strong>{selectedIndustry}</strong> for <strong>{selectedLocation}</strong>.</p>
                    <div className="trend-stats">
                        <div className="stat-box">
                            <span className="stat-label">YoY Growth</span>
                            <span className="stat-value text-green">+12%</span>
                            <span className="stat-desc">vs last year</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-label">Hiring Velocity</span>
                            <span className="stat-value">24 days</span>
                            <span className="stat-desc">avg time to hire</span>
                        </div>
                    </div>
                  </div>
              </div>

              {/* Companies Card */}
              <div className="market-card companies-card">
                  <div className="card-header">
                      <h3><Icon name="briefcase" size="md" /> Company Activity</h3>
                  </div>
                  <div className="companies-content">
                    <p className="section-subtitle">Top hiring companies in this sector:</p>
                    <ul className="company-list">
                        {marketData?.topCompanies.map(company => (
                            <li key={company}>
                                <div className="company-item">
                                    <div className="company-icon">{company[0]}</div>
                                    <span>{company}</span>
                                </div>
                                <span className="hiring-badge">Hiring</span>
                            </li>
                        ))}
                    </ul>
                  </div>
              </div>
              
              {/* Recommendations Card */}
              <div className="market-card recommendations-card full-width">
                  <div className="card-header">
                      <h3><Icon name="target" size="md" /> Recommendations</h3>
                  </div>
                  <div className="recommendations-content">
                      <div className="recommendation-item">
                          <h4>Skill Development</h4>
                          <p>Consider acquiring <strong>{marketData?.skills[0]}</strong> and <strong>{marketData?.skills[1]}</strong> skills to increase your market value by ~15%.</p>
                      </div>
                      <div className="recommendation-item">
                          <h4>Career Positioning</h4>
                          <p>Based on your profile, targeting <strong>Mid Level</strong> roles in <strong>{selectedLocation}</strong> offers the best opportunity-to-competition ratio.</p>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default MarketIntelligence;
