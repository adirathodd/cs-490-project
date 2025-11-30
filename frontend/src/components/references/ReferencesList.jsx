import React from 'react';
import Icon from '../common/Icon';

const ReferencesList = ({ references, onEdit, onDelete, onRequestReference, onShowAppreciations }) => {
  const getAvailabilityBadge = (status) => {
    const badges = {
      available: { color: '#10b981', label: 'Available' },
      limited: { color: '#f59e0b', label: 'Limited' },
      unavailable: { color: '#ef4444', label: 'Unavailable' },
      pending_permission: { color: '#6b7280', label: 'Pending' },
    };
    const badge = badges[status] || badges.pending_permission;
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        background: `${badge.color}20`,
        color: badge.color,
        fontWeight: '500',
      }}>
        {badge.label}
      </span>
    );
  };

  const getRelationshipIcon = (type) => {
    const icons = {
      supervisor: 'briefcase',
      manager: 'briefcase',
      colleague: 'users',
      mentor: 'award',
      professor: 'book',
      client: 'dollar-sign',
      other: 'user',
    };
    return icons[type] || 'user';
  };

  if (!references || references.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px',
        background: '#f9fafb',
        borderRadius: '8px',
        border: '2px dashed #e5e7eb'
      }}>
        <Icon name="users" size="lg" style={{ color: '#9ca3af', marginBottom: '16px' }} />
        <p style={{ color: '#6b7280', fontSize: '16px' }}>No references yet</p>
        <p style={{ color: '#9ca3af', fontSize: '14px' }}>Add your first professional reference to get started</p>
      </div>
    );
  }

  return (
    <div className="references-grid">
      {references.map((reference) => (
        <div key={reference.id} className="reference-card">
          <div className="reference-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="reference-icon">
                <Icon name={getRelationshipIcon(reference.relationship_type)} size="md" />
              </div>
              <div>
                <h3 className="reference-name">{reference.name}</h3>
                <p className="reference-title">{reference.title}</p>
              </div>
            </div>
            {getAvailabilityBadge(reference.availability_status)}
          </div>

          <div className="reference-details">
            <div className="reference-detail-row">
              <Icon name="building" size="sm" />
              <span>{reference.company}</span>
            </div>
            <div className="reference-detail-row">
              <Icon name="mail" size="sm" />
              <span>{reference.email}</span>
            </div>
            {reference.phone && (
              <div className="reference-detail-row">
                <Icon name="phone" size="sm" />
                <span>{reference.phone}</span>
              </div>
            )}
            <div className="reference-detail-row">
              <Icon name="user-check" size="sm" />
              <span>{reference.relationship_type.replace('_', ' ')}</span>
            </div>
          </div>

          <div className="reference-stats">
            <div className="stat-item">
              <span className="stat-value">{reference.times_used || 0}</span>
              <span className="stat-label">Times Used</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{reference.pending_requests_count || 0}</span>
              <span className="stat-label">Pending</span>
            </div>
            {reference.last_used_date && (
              <div className="stat-item">
                <span className="stat-value">
                  {new Date(reference.last_used_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="stat-label">Last Used</span>
              </div>
            )}
          </div>

          <div className="reference-actions">
            <button
              className="btn-secondary"
              onClick={() => onRequestReference(reference)}
              disabled={reference.availability_status === 'unavailable'}
              style={{ flex: 1 }}
            >
              <Icon name="send" size="sm" /> Request
            </button>
            {onShowAppreciations && (
              <button
                className="btn-secondary"
                onClick={() => onShowAppreciations(reference)}
                title="View appreciation history"
                style={{ padding: '8px' }}
              >
                <Icon name="heart" size="sm" />
              </button>
            )}
            <button
              className="btn-icon"
              onClick={() => onEdit(reference)}
              title="Edit reference"
            >
              <Icon name="edit" size="sm" />
            </button>
            <button
              className="btn-icon btn-danger"
              onClick={() => onDelete(reference.id)}
              title="Delete reference"
            >
              <Icon name="trash-2" size="sm" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReferencesList;
