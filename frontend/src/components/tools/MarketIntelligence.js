import React, { useState, useEffect } from 'react';
import Icon from '../common/Icon';
import './MarketIntelligence.css';

const MarketIntelligence = () => {
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

  const locationCostIndex = {
    'San Francisco, CA': 1.28,
    'New York, NY': 1.2,
    'Seattle, WA': 1.12,
    'Los Angeles, CA': 1.08,
    'Boston, MA': 1.07,
    'Austin, TX': 1.04,
    'Chicago, IL': 1.03,
    'Remote': 0.96,
  };

  const industryProfiles = {
    Tech: {
      baseSalary: 115000,
      skills: ['Python', 'React', 'AWS', 'System Design', 'Kubernetes', 'SQL'],
      demand: 'Very High',
      growth: 'Strong Upward',
      yoyGrowth: 9.5,
      hiringVelocity: 32,
      remoteShareBase: 0.46,
      companies: {
        'San Francisco, CA': ['Google', 'Meta', 'Airbnb', 'Uber', 'Stripe', 'OpenAI'],
        'New York, NY': ['Google', 'Amazon', 'Spotify', 'Datadog', 'Etsy', 'Bloomberg'],
        'Seattle, WA': ['Amazon', 'Microsoft', 'Expedia', 'Snowflake'],
        default: ['Microsoft', 'Apple', 'Nvidia', 'Snowflake', 'Adobe', 'ServiceNow'],
      },
    },
    Finance: {
      baseSalary: 102000,
      skills: ['Financial Modeling', 'Excel', 'SQL', 'Risk Management', 'Python'],
      demand: 'High',
      growth: 'Stable',
      yoyGrowth: 4.1,
      hiringVelocity: 38,
      remoteShareBase: 0.18,
      companies: {
        'New York, NY': ['J.P. Morgan', 'Goldman Sachs', 'Citigroup', 'Morgan Stanley', 'BlackRock'],
        'Chicago, IL': ['CME Group', 'Northern Trust', 'Morningstar', 'CBOE'],
        default: ['Bank of America', 'J.P. Morgan', 'Visa', 'Mastercard', 'Fidelity'],
      },
    },
    Healthcare: {
      baseSalary: 94000,
      skills: ['Clinical Data', 'EMR', 'Public Health', 'SQL', 'Python'],
      demand: 'High',
      growth: 'Upward',
      yoyGrowth: 6.8,
      hiringVelocity: 36,
      remoteShareBase: 0.14,
      companies: {
        'Boston, MA': ['Mass General Brigham', 'Biogen', 'Moderna', 'Vertex'],
        'Austin, TX': ['Baylor Scott & White', 'HCA Healthcare', 'Ascension'],
        default: ['UnitedHealth Group', 'CVS Health', 'HCA Healthcare', 'Kaiser Permanente'],
      },
    },
    Pharma: {
      baseSalary: 98000,
      skills: ['Clinical Trials', 'Regulatory', 'Biostatistics', 'R', 'Data Management'],
      demand: 'High',
      growth: 'Stable',
      yoyGrowth: 5.3,
      hiringVelocity: 42,
      remoteShareBase: 0.16,
      companies: {
        'Boston, MA': ['Pfizer', 'Moderna', 'Takeda', 'Sanofi', 'Novartis'],
        'New York, NY': ['Pfizer', 'Bristol Myers Squibb', 'Johnson & Johnson'],
        default: ['Pfizer', 'Merck', 'AbbVie', 'Roche', 'GSK'],
      },
    },
    Law: {
      baseSalary: 108000,
      skills: ['Contract Drafting', 'Corporate Law', 'Compliance', 'Litigation', 'Research'],
      demand: 'Moderate',
      growth: 'Stable',
      yoyGrowth: 2.9,
      hiringVelocity: 46,
      remoteShareBase: 0.12,
      companies: {
        'New York, NY': ['Skadden', 'Kirkland & Ellis', 'Sullivan & Cromwell', 'Debevoise'],
        'San Francisco, CA': ['Orrick', 'Wilson Sonsini', 'Cooley', 'Latham & Watkins'],
        default: ['Latham & Watkins', 'Baker McKenzie', 'DLA Piper', 'Jones Day'],
      },
    },
    Education: {
      baseSalary: 72000,
      skills: ['Curriculum Design', 'Instructional Design', 'Assessment', 'Online Learning', 'Research'],
      demand: 'Moderate',
      growth: 'Stable',
      yoyGrowth: 1.8,
      hiringVelocity: 48,
      remoteShareBase: 0.27,
      companies: {
        default: ['Khan Academy', 'Coursera', 'Duolingo', 'Chegg', 'Pearson'],
      },
    },
    Manufacturing: {
      baseSalary: 84000,
      skills: ['Lean Manufacturing', 'Six Sigma', 'Supply Chain', 'Quality Assurance', 'Process Improvement'],
      demand: 'Moderate',
      growth: 'Stable',
      yoyGrowth: 3.2,
      hiringVelocity: 40,
      remoteShareBase: 0.11,
      companies: {
        'Chicago, IL': ['Caterpillar', 'Boeing', 'Abbott', '3M'],
        default: ['GE', 'Honeywell', 'Siemens', '3M', 'Caterpillar'],
      },
    },
    Retail: {
      baseSalary: 67000,
      skills: ['Merchandising', 'Inventory Management', 'SQL', 'Category Strategy', 'Vendor Management'],
      demand: 'Moderate',
      growth: 'Stable',
      yoyGrowth: 2.1,
      hiringVelocity: 45,
      remoteShareBase: 0.09,
      companies: {
        'Seattle, WA': ['Amazon', 'Starbucks', 'REI'],
        'New York, NY': ['Walmart', 'Target', 'Nike', 'LVMH'],
        default: ['Walmart', 'Target', 'Costco', 'Nike', 'Home Depot'],
      },
    },
    Consulting: {
      baseSalary: 99000,
      skills: ['Management Consulting', 'Excel', 'Financial Modeling', 'PowerPoint', 'Data Analysis'],
      demand: 'High',
      growth: 'Upward',
      yoyGrowth: 6.1,
      hiringVelocity: 34,
      remoteShareBase: 0.33,
      companies: {
        'Boston, MA': ['Boston Consulting Group', 'McKinsey', 'Bain & Company'],
        'New York, NY': ['McKinsey', 'Bain & Company', 'PwC', 'Deloitte'],
        default: ['McKinsey', 'BCG', 'Bain', 'Deloitte', 'Accenture'],
      },
    },
    Media: {
      baseSalary: 82000,
      skills: ['Content Strategy', 'SEO', 'Analytics', 'Copywriting', 'Audience Development'],
      demand: 'Moderate',
      growth: 'Stable',
      yoyGrowth: 2.4,
      hiringVelocity: 41,
      remoteShareBase: 0.28,
      companies: {
        'New York, NY': ['The New York Times', 'NBCUniversal', 'Bloomberg', 'Spotify'],
        'Los Angeles, CA': ['Netflix', 'Disney', 'Warner Bros. Discovery', 'Snap'],
        default: ['Netflix', 'Disney', 'Spotify', 'Comcast', 'Paramount'],
      },
    },
    default: {
      baseSalary: 88000,
      skills: ['Project Management', 'Analysis', 'Communication', 'Stakeholder Management'],
      demand: 'Moderate',
      growth: 'Stable',
      yoyGrowth: 3.0,
      hiringVelocity: 40,
      remoteShareBase: 0.2,
      companies: {
        default: ['Accenture', 'Deloitte', 'EY', 'PwC', 'KPMG'],
      },
    },
  };

  const scoreToDemandLabel = (score) => {
    if (score >= 85) return 'Very High';
    if (score >= 70) return 'High';
    if (score >= 55) return 'Moderate';
    return 'Emerging';
  };

  const pickProfile = (industry) => industryProfiles[industry] || industryProfiles.default;

  const pickCompanies = (profile, location) => {
    if (profile.companies[location]) return profile.companies[location];
    if (location && location.toLowerCase().includes('remote')) {
      return profile.companies.default;
    }
    return profile.companies.default;
  };

  const estimateRemoteShare = (profile, location) => {
    let share = profile.remoteShareBase ?? industryProfiles.default.remoteShareBase ?? 0.2;
    const normalized = (location || '').toLowerCase();
    if (normalized.includes('remote')) {
      share += 0.12;
    }
    const multiplier = locationCostIndex[location] || 1.0;
    if (multiplier >= 1.2) {
      share += 0.06;
    } else if (multiplier <= 0.98) {
      share += 0.02;
    }
    return Math.max(0.05, Math.min(share, 0.75));
  };

  const getMockData = (industry, location) => {
    const profile = pickProfile(industry);
    const multiplier = locationCostIndex[location] || 1.0;
    const salaryBand = (base) => {
      const median = Math.round(base * multiplier);
      return {
        min: Math.round(median * 0.86),
        max: Math.round(median * 1.15),
        median,
      };
    };

    return {
      salary: {
        entry: salaryBand(profile.baseSalary * 0.8),
        mid: salaryBand(profile.baseSalary * 1.05),
        senior: salaryBand(profile.baseSalary * 1.3),
        lead: salaryBand(profile.baseSalary * 1.55),
      },
      skills: profile.skills,
      demand: profile.demand,
      growth: profile.growth,
      marketTrends: {
        yoyGrowth: profile.yoyGrowth,
        hiringVelocityDays: profile.hiringVelocity,
        openingsMomentum: profile.growth.toLowerCase().includes('up') ? 'accelerating' : 'steady',
        remoteShare: estimateRemoteShare(profile, location),
      },
      topCompanies: pickCompanies(profile, location),
      topCompaniesSampleCount: 0,
    };
  };

  const fetchMarketData = (industry, location) => {
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({ industry: industry || '', location: location || '' });
        const resp = await fetch(`/api/market_intelligence?${params.toString()}`, { credentials: 'include' });
        if (resp.ok) {
          const data = await resp.json();
          const fallback = getMockData(industry, location);
          const mapped = {
            salary: data.salary || fallback.salary,
            skills: data.skills?.length ? data.skills : (data.skill_signals || []).map(s => s.skill),
            demand: data.demandLabel || scoreToDemandLabel(data.demandScore || 60),
            growth: data.growth || (data.marketTrends?.openingsMomentum === 'accelerating' ? 'Strong Upward' : 'Stable'),
            marketTrends: data.marketTrends || fallback.marketTrends,
            topCompanies: data.topCompanies?.length ? data.topCompanies : fallback.topCompanies,
            topCompaniesSampleCount: data.postings_sample_count || fallback.topCompaniesSampleCount || 0,
          };
          setMarketData(mapped);
          setLoading(false);
          return;
        }
      } catch (err) {
        // ignore and fall back to mock data
      }

      setTimeout(() => {
        setMarketData(getMockData(industry, location));
        setLoading(false);
      }, 300);
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

          <div className="market-card trends-card">
            <div className="card-header">
              <h3><Icon name="chart" size="md" /> Market Trends</h3>
            </div>
            <div className="trends-content">
              <p>
                Growth momentum is <strong>{marketData?.marketTrends?.openingsMomentum || 'steady'}</strong> in <strong>{selectedIndustry}</strong> for <strong>{selectedLocation}</strong>.
                {marketData?.topCompaniesSampleCount ? ` Based on ${marketData.topCompaniesSampleCount} recent postings.` : ''}
              </p>
              <div className="trend-stats">
                <div className="stat-box">
                  <span className="stat-label">YoY Growth</span>
                  <span className="stat-value text-green">
                    {marketData?.marketTrends?.yoyGrowth !== undefined
                      ? `${marketData.marketTrends.yoyGrowth > 0 ? '+' : ''}${marketData.marketTrends.yoyGrowth}%`
                      : '—'}
                  </span>
                  <span className="stat-desc">vs last year</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Hiring Velocity</span>
                  <span className="stat-value">
                    {marketData?.marketTrends?.hiringVelocityDays
                      ? `${marketData.marketTrends.hiringVelocityDays} days`
                      : '—'}
                  </span>
                  <span className="stat-desc">avg time to hire</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Remote Share</span>
                  <span className="stat-value">
                    {marketData?.marketTrends?.remoteShare !== undefined
                      ? `${Math.round((marketData.marketTrends.remoteShare || 0) * 100)}%`
                      : '—'}
                  </span>
                  <span className="stat-desc">roles allowing remote</span>
                </div>
              </div>
            </div>
          </div>

          <div className="market-card companies-card">
            <div className="card-header">
              <h3><Icon name="briefcase" size="md" /> Company Activity</h3>
            </div>
            <div className="companies-content">
              <p className="section-subtitle">
                Top hiring companies in this sector {marketData?.topCompaniesSampleCount ? `(sample of ${marketData.topCompaniesSampleCount} postings)` : ''}:
              </p>
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
