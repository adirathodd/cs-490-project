import React, { useEffect, useState } from 'react';
import { geoAPI } from '../../services/api';
import Icon from '../common/Icon';
import { jobsAPI } from '../../services/api';

const OfficeLocationsPanel = ({ jobId, onChanged }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [commutes, setCommutes] = useState({ offices: [], best_office_id: null });
  const [loadingCommute, setLoadingCommute] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const resp = await geoAPI.listOfficeLocations(jobId);
      setItems(resp.locations || []);
    } catch (e) {
      setError('Failed to load office locations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [jobId]);

  const loadCommute = async () => {
    setLoadingCommute(true);
    try {
      const data = await jobsAPI.getJobCommute(jobId, { mode: 'drive' });
      const items = Array.isArray(data?.commute) ? data.commute : [];
      // Normalize into expected shape
      setCommutes({
        offices: items.map(it => ({
          office_id: it.office_id,
          duration_sec: typeof it.eta_min === 'number' ? Math.round(it.eta_min * 60) : null,
          distance_m: typeof it.distance_km === 'number' ? Math.round(it.distance_km * 1000) : null,
        })),
        best_office_id: null,
      });
    } catch (e) {
      // Silent fail; show hint in UI
    } finally {
      setLoadingCommute(false);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {};
      if (label) payload.label = label;
      if (address) payload.address = address;
      const resp = await geoAPI.addOfficeLocation(jobId, payload);
      setLabel(''); setAddress('');
      await load();
      if (onChanged) onChanged();
    } catch (e) {
      setError('Failed to add office location');
    }
  };

  const update = async (locId, patch) => {
    setError('');
    try {
      await geoAPI.updateOfficeLocation(jobId, locId, patch);
      await load();
      if (onChanged) onChanged();
    } catch (e) {
      setError('Failed to update office location');
    }
  };

  const remove = async (locId) => {
    setError('');
    try {
      await geoAPI.deleteOfficeLocation(jobId, locId);
      await load();
      if (onChanged) onChanged();
    } catch (e) {
      setError('Failed to delete office location');
    }
  };

  return (
    <div className="education-form-card">
      <div className="form-header">
        <h3>
          <Icon name="map-pin" size="md" /> Office Locations
        </h3>
      </div>
      <div className="education-form" style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ color: '#6b7280' }}>Loading...</div>
        ) : (
          <>
            {error ? <div className="error-banner" style={{ marginBottom: '12px' }}>{error}</div> : null}
            {(items || []).length === 0 ? (
              <div style={{ color: '#9ca3af', fontStyle: 'italic', marginBottom: '12px' }}>No offices yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {items.map((it) => (
                  <div key={it.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    background: '#f9fafb'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{it.label || 'Office'}</div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>{it.address || ''}</div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                        {(() => {
                          const m = (commutes.offices || []).find(o => o.office_id === it.id);
                          if (loadingCommute) return 'Calculating drive time…';
                          if (!m) return 'Drive time unavailable • Set your home address in Profile';
                          const mins = Math.round((m.duration_sec || 0) / 60);
                          const miles = Math.round(((m.distance_m || 0) / 1609.34) * 10) / 10;
                          return `Drive: ${mins} min • ${miles} mi`;
                        })()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => update(it.id, { label: prompt('Label', it.label || '') || it.label })}
                      >
                        <Icon name="edit" size="sm" /> Label
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          const newAddr = prompt('Address', it.address || '') || it.address;
                          update(it.id, { address: newAddr });
                        }}
                      >
                        <Icon name="edit" size="sm" /> Address
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => remove(it.id)}
                        style={{ color: '#dc2626', borderColor: '#dc2626' }}
                      >
                        <Icon name="trash" size="sm" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={loadCommute}>
                    <Icon name="refresh-cw" size="sm" /> Refresh Drive Times
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={add}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="office-label">Label (optional)</label>
                  <input id="office-label" value={label} onChange={(e) => setLabel(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="office-address">Office Address</label>
                  <input id="office-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g., 123 Main St, City, State" />
                </div>
              </div>
              <div className="form-actions" style={{ marginTop: '12px' }}>
                <button type="submit" className="save-button" style={{ width: '100%' }}>
                  <Icon name="plus" size="sm" /> Add Office
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default OfficeLocationsPanel;