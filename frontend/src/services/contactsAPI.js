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
  importCallback: async (data) => {
    const res = await api.post(`${base}/import/callback`, data);
    return res.data;
  }
};
