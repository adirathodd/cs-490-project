import { api } from './api';

const base = '/contacts';

export const contactsAPI = {
  list: async (q = '') => {
    const url = q ? `${base}?q=${encodeURIComponent(q)}` : base;
    const res = await api.get(url);
    return res.data;
  },

  create: async (payload) => {
    const res = await api.post(base, payload);
    return res.data;
  },

  get: async (id) => {
    const res = await api.get(`${base}/${id}`);
    return res.data;
  },

  update: async (id, payload) => {
    const res = await api.patch(`${base}/${id}`, payload);
    return res.data;
  },

  remove: async (id) => {
    const res = await api.delete(`${base}/${id}`);
    return res.data;
  },

  interactions: async (contactId) => {
    const res = await api.get(`${base}/${contactId}/interactions`);
    return res.data;
  },
  createInteraction: async (contactId, payload) => {
    const res = await api.post(`${base}/${contactId}/interactions`, payload);
    return res.data;
  },

  notes: async (contactId) => {
    const res = await api.get(`${base}/${contactId}/notes`);
    return res.data;
  },
  createNote: async (contactId, payload) => {
    const res = await api.post(`${base}/${contactId}/notes`, payload);
    return res.data;
  },

  reminders: async (contactId) => {
    const res = await api.get(`${base}/${contactId}/reminders`);
    return res.data;
  }
  ,
  createReminder: async (contactId, payload) => {
    const res = await api.post(`${base}/${contactId}/reminders`, payload);
    return res.data;
  }
  ,
  importStart: async (provider = 'google') => {
    const res = await api.post(`${base}/import/start`, { provider });
    return res.data;
  },
  getImports: async () => {
    const res = await api.get(`${base}/imports`);
    return res.data;
  },
  getImport: async (jobId) => {
    const res = await api.get(`${base}/import/${jobId}`);
    return res.data;
  },
  importCallback: async (data) => {
    const res = await api.post(`${base}/import/callback`, data);
    return res.data;
  }
  ,
  mutuals: async (contactId) => {
    const res = await api.get(`${base}/${contactId}/mutuals`);
    return res.data;
  },
  
  addMutual: async (contactId, payload) => {
    const res = await api.post(`${base}/${contactId}/mutuals`, payload);
    return res.data;
  },
  
  removeMutual: async (contactId, mutualId) => {
    const res = await api.delete(`${base}/${contactId}/mutuals/${mutualId}`);
    return res.data;
  },
  
  getAllReminders: async () => {
    const res = await api.get(`${base}/reminders/all`);
    return res.data;
  },
  
  dismissReminder: async (reminderId) => {
    const res = await api.patch(`${base}/reminders/${reminderId}/dismiss`);
    return res.data;
  },
  
  // Company links
  companyLinks: async (contactId) => {
    const res = await api.get(`${base}/${contactId}/company-links`);
    return res.data;
  },
  
  addCompanyLink: async (contactId, payload) => {
    const res = await api.post(`${base}/${contactId}/company-links`, payload);
    return res.data;
  },
  
  removeCompanyLink: async (contactId, linkId) => {
    const res = await api.delete(`${base}/${contactId}/company-links/${linkId}`);
    return res.data;
  },
  
  // Job links
  jobLinks: async (contactId) => {
    const res = await api.get(`${base}/${contactId}/job-links`);
    return res.data;
  },
  
  addJobLink: async (contactId, payload) => {
    const res = await api.post(`${base}/${contactId}/job-links`, payload);
    return res.data;
  },
  
  removeJobLink: async (contactId, linkId) => {
    const res = await api.delete(`${base}/${contactId}/job-links/${linkId}`);
    return res.data;
  }
};
