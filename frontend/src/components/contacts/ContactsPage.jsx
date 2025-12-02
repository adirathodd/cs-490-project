import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ContactsPanel from './ContactsPanel';
import ContactsCalendar from './ContactsCalendar';
import Icon from '../common/Icon';
import { contactsAPI } from '../../services/contactsAPI';
import ImportStatusModal from './ImportStatusModal';
import { useLocation } from 'react-router-dom';
import RelationshipMaintenancePanel from './RelationshipMaintenancePanel';

const ContactsPage = () => {
  const navigate = useNavigate();
  const [openCreate, setOpenCreate] = useState(false);
  const [importError, setImportError] = useState('');
  const calendarRef = useRef(null);
  const location = useLocation();
  const [importJobToShow, setImportJobToShow] = useState(null);
  const [calendarRefreshToken, setCalendarRefreshToken] = useState(0);

  const handleRefreshCalendar = useCallback(() => {
    if (calendarRef.current && calendarRef.current.refresh) {
      calendarRef.current.refresh();
    }
    setCalendarRefreshToken((t) => t + 1);
  }, []);

  const handleImport = async () => {
    try {
      setImportError('');
      const response = await contactsAPI.importStart('google');
      if (response.auth_url) {
        window.location.href = response.auth_url;
      }
    } catch (err) {
      console.error('Import failed:', err);
      setImportError('Failed to start Google import.');
    }
  };

  // Load recent import job status on mount
  React.useEffect(() => {
    // detect import_job query param to auto-open modal
    try {
      const params = new URLSearchParams(location.search);
      const jid = params.get('import_job');
      if (jid) setImportJobToShow(jid);
    } catch (e) {}
  }, []);

  const closeImportModal = () => {
    setImportJobToShow(null);
    try {
      const params = new URLSearchParams(location.search);
      if (params.has('import_job')) {
        params.delete('import_job');
        const q = params.toString();
        if (q) navigate(`${location.pathname}?${q}`, { replace: true });
        else navigate(location.pathname, { replace: true });
      }
    } catch (e) {}
  };

  return (
    <div className="employment-container">
      <div className="employment-page-header">
        <div className="page-backbar">
          <a
            className="btn-back"
            href="/dashboard"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            ← Back to Dashboard
          </a>
        </div>
        <h1 className="employment-page-title">Contacts</h1>
      </div>

      <div className="employment-header">
        <h2><Icon name="users" size="md" /> Your Contacts</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="add-button"
            onClick={handleImport}
            style={{ background: '#059669' }}
            title="Import contacts from Google"
          >
            Import from Google
          </button>
          <button className="add-button" onClick={() => setImportJobToShow(new URLSearchParams(location.search).get('import_job'))} title="Check import status">Check import status</button>
          <button
            className="add-button"
            onClick={() => setOpenCreate(true)}
          >
            + Add Contact
          </button>
        </div>
      </div>

      {importError && (
        <div style={{ padding: '12px', margin: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fecaca' }}>
          {importError}
        </div>
      )}

      {/* Last import message removed per request */}

      <div style={{ padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12 }}>
          <div>
            <ContactsPanel 
              inline 
              openCreate={openCreate} 
              onClose={() => navigate('/dashboard')}
              onReminderChange={handleRefreshCalendar}
            />
          </div>
          <div>
            <ContactsCalendar ref={calendarRef} refreshSignal={calendarRefreshToken} />
          </div>
        </div>
        <RelationshipMaintenancePanel onReminderChange={handleRefreshCalendar} />
        {importJobToShow && (
          <ImportStatusModal jobId={importJobToShow} onClose={closeImportModal} />
        )}
      </div>
    </div>
  );
};

export default ContactsPage;
