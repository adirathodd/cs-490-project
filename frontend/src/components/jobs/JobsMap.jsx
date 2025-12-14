import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geoAPI as defaultGeoAPI } from '../../services/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Ensure Leaflet's default marker assets resolve correctly in CRA builds
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const JobsMap = ({ filters = {}, home, services }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const api = services?.geoAPI || defaultGeoAPI;

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError('');
      try {
        const data = await api.jobsGeo(filters);
        if (active) {
          const items = Array.isArray(data.jobs) ? data.jobs : [];
          // Client-side safeguard: if a job has any office markers, hide its general job marker
          const officeIds = new Set(items.filter(i => i && i.kind === 'office' && i.id != null).map(i => i.id));
          const filtered = items.filter(i => !(i && i.kind === 'job' && officeIds.has(i.id)));
          setJobs(filtered);
        }
      } catch (e) {
        if (active) setError('Failed to load jobs map');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [filters, api]);

  const center = useMemo(() => {
    const first = jobs.find(j => j.lat && j.lon);
    return first ? [first.lat, first.lon] : [40.71, -74.01];
  }, [jobs]);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    try {
      const map = L.map(mapRef.current).setView(center, 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      mapInstanceRef.current = map;
    } catch (e) {
      // In non-browser test environments, Leaflet may not initialize; fail gracefully
      // so the component can still render other UI parts.
    }
  }, [center]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    // Clear existing layers except tile
    map.eachLayer(layer => {
      if (!(layer instanceof L.TileLayer)) {
        map.removeLayer(layer);
      }
    });
    jobs.forEach(j => {
      if (j.lat && j.lon) {
        // Different icon for office vs general job points
        let icon = undefined;
        if (j.kind === 'office') {
          icon = L.icon({
            iconUrl: markerIcon,
            iconRetinaUrl: markerIcon2x,
            shadowUrl: markerShadow,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            className: 'office-marker',
          });
        }
        const marker = L.marker([j.lat, j.lon], icon ? { icon } : undefined).addTo(map);
        const label = j.kind === 'office' && j.label ? `<div class="muted">${j.label}</div>` : '';
        const precision = j.geo_precision ? `<div class="muted">precision: ${j.geo_precision}</div>` : '';
        marker.bindPopup(`<div><strong>${j.company}</strong><br/>${j.title}<br/>${j.location || ''}${label}${precision}</div>`);
      }
    });
    if (home) {
      L.marker([home.lat, home.lon]).addTo(map).bindPopup('<strong>Home</strong>');
    }
    map.setView(center, 4);
  }, [jobs, home, center]);

  return (
    <div className="jobs-map">
      {loading ? <div className="muted">Loading map…</div> : error ? <div className="error-banner">{error}</div> : (
        <div ref={mapRef} style={{ height: 320, borderRadius: 12 }} />
      )}
    </div>
  );
};

export default JobsMap;
