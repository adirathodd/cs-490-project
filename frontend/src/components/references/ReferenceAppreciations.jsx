import React, { useState, useEffect } from 'react';
import { referencesAPI } from '../../services/referencesAPI';
import Icon from '../common/Icon';

const ReferenceAppreciations = ({ reference, onClose }) => {
  const [appreciations, setAppreciations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    reference: reference.id,
    appreciation_type: 'thank_you_note',
    date: new Date().toISOString().split('T')[0],
    description: '',
    notes: '',
  });

  useEffect(() => {
    loadAppreciations();
  }, []);

  const loadAppreciations = async () => {
    try {
      setLoading(true);
      const data = await referencesAPI.getAppreciations({ reference_id: reference.id });
      setAppreciations(data);
    } catch (err) {
      console.error('Failed to load appreciations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await referencesAPI.createAppreciation(formData);
      setShowForm(false);
      setFormData({
        reference: reference.id,
        appreciation_type: 'thank_you_note',
        date: new Date().toISOString().split('T')[0],
        description: '',
        notes: '',
      });
      loadAppreciations();
    } catch (err) {
      console.error('Failed to save appreciation:', err);
      alert('Failed to save appreciation');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this appreciation record?')) return;
    try {
      await referencesAPI.deleteAppreciation(id);
      loadAppreciations();
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Failed to delete appreciation');
    }
  };

  const appreciationTypeDisplay = {
    thank_you_note: 'Thank You Note',
    coffee_meetup: 'Coffee/Lunch Meetup',
    gift: 'Gift/Token of Appreciation',
    linkedin_endorsement: 'LinkedIn Endorsement',
    recommendation: 'Written Recommendation',
    referral_returned: 'Returned Referral/Favor',
    update_call: 'Update Call',
    holiday_greeting: 'Holiday Greeting',
    other: 'Other',
  };

  const getTypeIcon = (type) => {
    const iconMap = {
      thank_you_note: 'mail',
      coffee_meetup: 'calendar',
      gift: 'gift',
      linkedin_endorsement: 'thumbs-up',
      recommendation: 'star',
      referral_returned: 'users',
      update_call: 'phone',
      holiday_greeting: 'heart',
      other: 'info',
    };
    return iconMap[type] || 'info';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2><Icon name="heart" size="md" /> Appreciation History - {reference.name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: '20px' }}>
            <button className="add-button" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : '+ Record Appreciation'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="card" style={{ padding: '16px', marginBottom: '20px' }}>
            <div className="form-group">
              <label>Appreciation Type *</label>
              <select
                value={formData.appreciation_type}
                onChange={(e) => setFormData({ ...formData, appreciation_type: e.target.value })}
                required
              >
                {Object.entries(appreciationTypeDisplay).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                placeholder="What did you do to show appreciation?"
              />
            </div>

            <div className="form-group">
              <label>Private Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="2"
                placeholder="Any notes for your records"
              />
            </div>

            <button type="submit" className="btn-primary">
              Save Appreciation
            </button>
          </form>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
        ) : appreciations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <Icon name="heart" size="xl" />
            <p style={{ marginTop: '16px' }}>No appreciation records yet. Start tracking your relationship maintenance!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {appreciations.map(appreciation => (
              <div key={appreciation.id} className="card" style={{ padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Icon name={getTypeIcon(appreciation.appreciation_type)} size="sm" />
                      <strong>{appreciationTypeDisplay[appreciation.appreciation_type]}</strong>
                      <span style={{ color: '#666', fontSize: '14px' }}>
                        • {new Date(appreciation.date).toLocaleDateString()}
                      </span>
                    </div>
                    {appreciation.description && (
                      <p style={{ color: '#666', fontSize: '14px', margin: '8px 0 0 24px' }}>
                        {appreciation.description}
                      </p>
                    )}
                  </div>
                  <button
                    className="btn-danger"
                    onClick={() => handleDelete(appreciation.id)}
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                  >
                    <Icon name="trash" size="sm" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '20px', padding: '16px', background: '#f0f9ff', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#1e40af' }}>
            <Icon name="lightbulb" size="sm" /> Maintenance Tips
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#1e3a8a', fontSize: '14px' }}>
            <li>Send thank you notes within 24 hours of receiving help</li>
            <li>Check in every 6 months to maintain the relationship</li>
            <li>Offer to return the favor or provide a recommendation</li>
            <li>Share updates about your career progress</li>
          </ul>
        </div>
        </div>
      </div>
    </div>
  );
};

export default ReferenceAppreciations;
