import React, { useState } from 'react';
import { contactsAPI } from '../../../services/contactsAPI';

const ImportContacts = () => {
  const [status, setStatus] = useState('idle');
  const [authUrl, setAuthUrl] = useState('');
  const [error, setError] = useState(null);

  const startImport = async () => {
    setStatus('starting');
    try {
      const res = await contactsAPI.importStart('google');
      setAuthUrl(res.auth_url);
      setStatus('ready');
      if (res.auth_url) {
        // Redirect user to Google consent
        window.location.href = res.auth_url;
      }
    } catch (err) {
      setError(err?.message || 'Failed to start import');
      setStatus('error');
    }
  };

  return (
    <div className="import-contacts">
      <h3>Import Contacts</h3>
      <p>Import your Google contacts into Resume Rocket.</p>
      <div>
        <button onClick={startImport} disabled={status === 'starting'}>Import from Google</button>
      </div>
      {status === 'ready' && authUrl && <p>Redirecting to Google…</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
};

export default ImportContacts;
