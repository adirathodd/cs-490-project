import React from 'react';
import './ContactDiscovery.css';

const ContactSuggestionCard = ({
  suggestion,
  onMarkContacted,
  onConvertToContact,
  onDismiss,
}) => {
  const getSuggestionTypeColor = (type) => {
    const colors = {
      target_company: '#2563eb',
      alumni: '#059669',
      industry_leader: '#dc2626',
      mutual_connection: '#7c3aed',
      conference_speaker: '#ea580c',
      similar_role: '#0891b2',
    };
    return colors[type] || '#6b7280';
  };

  const renderActions = () => {
    if (suggestion.status === 'connected') {
      return (
        <div className="suggestion-status connected">
          <span className="status-icon">✓</span> Connected
        </div>
      );
    }

    if (suggestion.status === 'contacted') {
      return (
        <div className="suggestion-actions">
          <button
            onClick={() => onConvertToContact(suggestion.id)}
            className="btn-success"
          >
            Mark as Connected
          </button>
          <div className="suggestion-status contacted">
            <span className="status-icon">📧</span> Contacted
          </div>
        </div>
      );
    }

    if (suggestion.status === 'dismissed') {
      return (
        <div className="suggestion-status dismissed">
          <span className="status-icon">✕</span> Dismissed
        </div>
      );
    }

    // Default: suggested status
    return (
      <div className="suggestion-actions">
        <button
          onClick={() => onMarkContacted(suggestion.id)}
          className="btn-primary"
        >
          Mark Contacted
        </button>
        <button
          onClick={() => onConvertToContact(suggestion.id)}
          className="btn-success"
        >
          Add to Contacts
        </button>
        <button
          onClick={() => onDismiss(suggestion.id)}
          className="btn-secondary"
        >
          Dismiss
        </button>
      </div>
    );
  };

  return (
    <div className="contact-suggestion-card">
      <div className="suggestion-header">
        <div
          className="suggestion-type-badge"
          style={{ backgroundColor: getSuggestionTypeColor(suggestion.suggestion_type) }}
        >
          {suggestion.suggestion_type_display}
        </div>
        <div className="suggestion-relevance">
          {(suggestion.relevance_score * 100).toFixed(0)}% Match
        </div>
      </div>

      <div className="suggestion-body">
        <h3 className="suggestion-name">{suggestion.suggested_name}</h3>
        {suggestion.suggested_title && (
          <div className="suggestion-title">{suggestion.suggested_title}</div>
        )}
        {suggestion.suggested_company && (
          <div className="suggestion-company">
            <span className="icon">🏢</span> {suggestion.suggested_company}
          </div>
        )}
        {suggestion.suggested_location && (
          <div className="suggestion-location">
            <span className="icon">📍</span> {suggestion.suggested_location}
          </div>
        )}
        {suggestion.suggested_industry && (
          <div className="suggestion-industry">
            <span className="icon">💼</span> {suggestion.suggested_industry}
          </div>
        )}

        <div className="suggestion-reason">
          <strong>Why this person:</strong>
          <p>{suggestion.reason}</p>
        </div>

        {suggestion.mutual_connections && suggestion.mutual_connections.length > 0 && (
          <div className="mutual-connections">
            <strong>Mutual Connections:</strong>
            <div className="mutual-connections-list">
              {suggestion.mutual_connections.map((conn, idx) => (
                <span key={idx} className="mutual-connection-badge">
                  {conn}
                </span>
              ))}
            </div>
          </div>
        )}

        {suggestion.shared_institution && (
          <div className="shared-info">
            <span className="icon">🎓</span> Alumni: {suggestion.shared_institution}
            {suggestion.shared_degree && ` (${suggestion.shared_degree})`}
          </div>
        )}

        {suggestion.suggested_linkedin_url && (
          <a
            href={suggestion.suggested_linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="linkedin-link"
          >
            View on LinkedIn →
          </a>
        )}
      </div>

      <div className="suggestion-footer">{renderActions()}</div>
    </div>
  );
};

export default ContactSuggestionCard;
