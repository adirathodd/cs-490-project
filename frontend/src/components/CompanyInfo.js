import React from 'react';
import './CompanyInfo.css';
import Icon from './Icon';

/**
 * UC-043: Company Information Display Component
 * 
 * Displays comprehensive company information including:
 * - Basic details (name, industry, size, location)
 * - Company description and mission statement
 * - Glassdoor rating
 * - Employee count
 * - Recent news and updates
 * - Company logo and contact information
 */
const CompanyInfo = ({ companyInfo }) => {
  if (!companyInfo || !companyInfo.name) {
    return null; // Don't show anything if no company info
  }

  const {
    name,
    industry,
    size,
    hq_location,
    domain,
    website,
    linkedin_url,
    description,
    mission_statement,
    glassdoor_rating,
    employee_count,
    recent_news = []
  } = companyInfo;

  return (
    <div className="education-form-card">
      <div className="form-header">
        <h3><Icon name="briefcase" size="md" /> {name}</h3>
        {glassdoor_rating && (
          <div className="company-rating" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            color: 'white',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            <Icon name="star" size="sm" />
            <span>{glassdoor_rating}</span>
            <span style={{ fontSize: '12px', opacity: 0.9 }}>Glassdoor</span>
          </div>
        )}
      </div>

      {/* Basic Information Grid */}
      <div className="company-info-grid">
        {industry && (
          <div className="company-info-item">
            <div className="info-label">
              <Icon name="tag" size="sm" /> Industry
            </div>
            <div className="info-value">{industry}</div>
          </div>
        )}
        
        {size && (
          <div className="company-info-item">
            <div className="info-label">
              <Icon name="users" size="sm" /> Company Size
            </div>
            <div className="info-value">{size}</div>
          </div>
        )}
        
        {employee_count && (
          <div className="company-info-item">
            <div className="info-label">
              <Icon name="users" size="sm" /> Employees
            </div>
            <div className="info-value">{employee_count.toLocaleString()}</div>
          </div>
        )}
        
        {hq_location && (
          <div className="company-info-item">
            <div className="info-label">
              <Icon name="location" size="sm" /> Headquarters
            </div>
            <div className="info-value">{hq_location}</div>
          </div>
        )}
        
        {(website || domain) && (
          <div className="company-info-item">
            <div className="info-label">
              <Icon name="link" size="sm" /> Website
            </div>
            <div className="info-value">
              <a 
                href={(website && website.startsWith('http')) ? website : `https://${domain || website}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="company-website-link"
              >
                {domain || website} <Icon name="external-link" size="sm" />
              </a>
            </div>
          </div>
        )}
        
        {linkedin_url && (
          <div className="company-info-item">
            <div className="info-label">
              <Icon name="linkedin" size="sm" /> LinkedIn
            </div>
            <div className="info-value">
              <a 
                href={linkedin_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="company-website-link"
              >
                View Profile <Icon name="external-link" size="sm" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      {description && (
        <div className="company-info-section">
          <h4 className="section-title">
            <Icon name="info" size="sm" /> About {name}
          </h4>
          <p className="company-description">{description}</p>
        </div>
      )}

      {/* Mission Statement */}
      {mission_statement && (
        <div className="company-info-section">
          <h4 className="section-title">
            <Icon name="target" size="sm" /> Mission Statement
          </h4>
          <p className="company-mission">{mission_statement}</p>
        </div>
      )}

      {/* Recent News */}
      {recent_news && recent_news.length > 0 && (
        <div className="company-info-section">
          <h4 className="section-title">
            <Icon name="newspaper" size="sm" /> Recent News
          </h4>
          <div className="news-list">
            {recent_news.map((news, index) => (
              <div key={index} className="news-item">
                <div className="news-header">
                  <h5 className="news-title">
                    {news.url ? (
                      <a 
                        href={news.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="news-link"
                      >
                        {news.title}
                      </a>
                    ) : (
                      news.title
                    )}
                  </h5>
                  {news.date && (() => {
                    const ds = news.date;
                    const isDateOnly = typeof ds === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ds);
                    const date = isDateOnly ? new Date(`${ds}T00:00:00`) : new Date(ds);
                    return (
                      <span className="news-date">{date.toLocaleDateString()}</span>
                    );
                  })()}
                </div>
                {news.summary && (
                  <p className="news-summary">{news.summary}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyInfo;
