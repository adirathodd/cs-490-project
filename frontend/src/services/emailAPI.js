import api from './api';

const emailAPI = {
  // Gmail integration
  startGmailAuth: async (redirectUri, state) => {
    const response = await api.post('/gmail/oauth/start/', { 
      redirect_uri: redirectUri,
      state: state
    });
    return response.data;
  },

  completeGmailAuth: async (code, state, redirectUri) => {
    const response = await api.post('/gmail/oauth/callback/', {
      code,
      state,
      redirect_uri: redirectUri
    });
    return response.data;
  },

  getGmailStatus: async () => {
    const response = await api.get('/gmail/status/');
    return response.data;
  },

  disconnectGmail: async () => {
    const response = await api.post('/gmail/disconnect/');
    return response.data;
  },

  enableScanning: async () => {
    const response = await api.post('/gmail/enable-scanning/');
    return response.data;
  },

  triggerScan: async () => {
    const response = await api.post('/gmail/scan/');
    return response.data;
  },

  scanGmailNow: async () => {
    const response = await api.post('/gmail/scan-now/');
    return response.data;
  },

  // Email management
  getEmails: async (params = {}) => {
    const response = await api.get('/emails/', { params });
    return response.data;
  },

  getEmailDetail: async (emailId) => {
    const response = await api.get(`/emails/${emailId}/`);
    return response.data;
  },

  linkEmailToJob: async (emailId, jobId) => {
    const response = await api.post(`/emails/${emailId}/link/`, { job_id: jobId });
    return response.data;
  },

  dismissEmail: async (emailId) => {
    const response = await api.delete(`/emails/${emailId}/`);
    return response.data;
  },

  getScanLogs: async () => {
    const response = await api.get('/gmail/scan-logs/');
    return response.data;
  },
};

export default emailAPI;
