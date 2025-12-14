import React, { useEffect, useState } from 'react';
import { geoAPI } from '../../services/api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const JobMapSection = ({ job, home }) => {
  const [coords, setCoords] = useState(null);
  const [commute, setCommute] = useState(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!job) return;
        const loc = job.office_address || job.location;
        if (!job.lat || !job.lon) {
          const resolved = await geoAPI.resolve(loc);
          const r = resolved.resolved;
          if (active && r && r.lat && r.lon) setCoords({ lat: r.lat, lon: r.lon });
        } else {
          if (active) setCoords({ lat: job.lat, lon: job.lon });
        }
      } catch (e) {
        // swallow
      }
    })();
    return () => { active = false; };
  }, [job]);

  useEffect(() => {
    (async () => {
      if (!coords || !home) return;
      try {
        const est = await geoAPI.commuteEstimate({ from_lat: home.lat, from_lon: home.lon, to_lat: coords.lat, to_lon: coords.lon });
        setCommute(est);
      } catch (e) {}
    })();
  }, [coords, home]);

  if (!coords) return <div className="muted">Resolving job location...</div>;

  const center = [coords.lat, coords.lon];
  return (
    <div className="job-map-section">
      <div className="meta" style={{ marginBottom: 8 }}>
        {commute ? (
          <span>Commute: {commute.distance_km} km • ~{commute.eta_min} min</span>
        ) : (
          <span>Commute: calculating…</span>
        )}
      </div>
      <MapContainer center={center} zoom={12} style={{ height: 240, borderRadius: 12 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        <Marker position={center}>
          <Popup>
            <div>
              <strong>{job.company}</strong><br />
              {job.title}<br />
              {job.location}
            </div>
          </Popup>
        </Marker>
        {home && (
          <Marker position={[home.lat, home.lon]}>
            <Popup>
              <div>
                <strong>Home</strong>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default JobMapSection;
