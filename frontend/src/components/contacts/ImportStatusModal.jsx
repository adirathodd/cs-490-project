import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { contactsAPI } from '../../services/contactsAPI';
import { useNavigate } from 'react-router-dom';

const ImportStatusModal = ({ jobId, onClose }) => {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const navigate = useNavigate();

  const fetchJob = async () => {
    try {
      setLoading(true);
      const j = await contactsAPI.getImport(jobId);
      // Normalize result_summary if it's a string
      if (j && typeof j.result_summary === 'string' && j.result_summary) {
        try { j.result_summary = JSON.parse(j.result_summary.replace(/'/g, '"')); } catch (e) { /* keep as-is */ }
      }
      setJob(j);
      return j;
    } catch (e) {
      setJob(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let timer = null;

    (async () => {
      const j = await fetchJob();
      if (!mounted) return;
      if (j && (j.status === 'pending' || j.status === 'processing')) {
        setPolling(true);
        timer = setInterval(async () => {
          const updated = await fetchJob();
          if (!updated) return;
          if (!(updated.status === 'pending' || updated.status === 'processing')) {
            clearInterval(timer);
            setPolling(false);
          }
        }, 3000);
      }
    })();

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [jobId]);

  const handleRetry = async () => {
    try {
      const res = await contactsAPI.importStart('google');
      if (res && res.auth_url) {
        window.location.href = res.auth_url;
      }
    } catch (e) {
      // ignore for now
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // small visual feedback could be added
    } catch (e) {
      // fallback: do nothing
    }
  };

  const handleSearch = (term) => {
    // Navigate to contacts list with search query
    if (!term) return;
    navigate(`/contacts?q=${encodeURIComponent(term)}`);
    if (onClose) onClose();
  };

  if (!job) return null;

  return (
    <div className="import-modal-overlay">
      <div className="import-modal">
        <div className="import-modal-header">
          <h3>Import status</h3>
          <div>
            <button className="contacts-btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="import-modal-body">
          <div><strong>Status:</strong> {job.status}{polling && <span style={{ marginLeft: 8 }}>(polling...)</span>}</div>
          {job.result_summary && (
            <div style={{ marginTop: 8 }}><strong>Summary:</strong> {job.result_summary.imported} imported of {job.result_summary.total_found}</div>
          )}

          {job.errors && job.errors.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong style={{ color: '#b91c1c' }}>Errors</strong>
              <ul style={{ marginTop: 8 }}>
                {job.errors.map((err, i) => (
                  <li key={i} style={{ fontSize: '0.95rem', marginTop: 8, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontWeight: 600 }}>{err.id}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="contacts-btn-secondary" onClick={() => handleCopy(err.message)}>Copy</button>
                        <button className="contacts-btn-secondary" onClick={() => handleSearch(err.id)}>Search</button>
                      </div>
                    </div>
                    <div style={{ marginTop: 6 }}>{err.message}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="add-button" onClick={handleRetry}>Retry import</button>
            <button className="contacts-btn-secondary" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
      <style>{`
        .import-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 1200; }
        .import-modal { width: 680px; background: #fff; border-radius: 8px; padding: 18px; max-height: 80vh; overflow: auto; box-shadow: 0 8px 30px rgba(0,0,0,0.15); }
        .import-modal-header { display: flex; justify-content: space-between; align-items: center; }
        .import-modal-body { margin-top: 12px; }
        .add-button { background: #059669; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
        .contacts-btn-secondary { background: #f3f4f6; border: 1px solid #e5e7eb; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
      `}</style>
    </div>
  );
};

ImportStatusModal.propTypes = {
  jobId: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default ImportStatusModal;
