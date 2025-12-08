import apiSvc from './api';

const base = '/references';

export const referencesAPI = {
  // References CRUD
  getReferences: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${base}/?${queryString}` : `${base}/`;
    const res = await apiSvc.http.get(url);
    return res.data;
  },

  getReference: async (id) => {
    const res = await apiSvc.http.get(`${base}/${id}/`);
    return res.data;
  },

  createReference: async (payload) => {
    const res = await apiSvc.http.post(`${base}/`, payload);
    return res.data;
  },

  updateReference: async (id, payload) => {
    const res = await apiSvc.http.patch(`${base}/${id}/`, payload);
    return res.data;
  },

  deleteReference: async (id) => {
    const res = await apiSvc.http.delete(`${base}/${id}/`);
    return res.data;
  },

  checkInReference: async (id, monthsAhead = 6) => {
    const res = await apiSvc.http.post(`${base}/${id}/check-in/`, { months_ahead: monthsAhead });
    return res.data;
  },

  // Reference Requests
  getReferenceRequests: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${base}/requests/?${queryString}` : `${base}/requests/`;
    const res = await apiSvc.http.get(url);
    return res.data;
  },

  getReferenceRequest: async (id) => {
    const res = await apiSvc.http.get(`${base}/requests/${id}/`);
    return res.data;
  },

  createReferenceRequest: async (payload) => {
    const res = await apiSvc.http.post(`${base}/requests/`, payload);
    return res.data;
  },

  updateReferenceRequest: async (id, payload) => {
    const res = await apiSvc.http.patch(`${base}/requests/${id}/`, payload);
    return res.data;
  },

  deleteReferenceRequest: async (id) => {
    const res = await apiSvc.http.delete(`${base}/requests/${id}/`);
    return res.data;
  },

  markRequestSent: async (id) => {
    const res = await apiSvc.http.post(`${base}/requests/${id}/mark-sent/`);
    return res.data;
  },

  markRequestCompleted: async (id, feedback = {}) => {
    const res = await apiSvc.http.post(`${base}/requests/${id}/mark-completed/`, feedback);
    return res.data;
  },

  // Templates
  getTemplates: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${base}/templates/?${queryString}` : `${base}/templates/`;
    const res = await apiSvc.http.get(url);
    return res.data;
  },

  getTemplate: async (id) => {
    const res = await apiSvc.http.get(`${base}/templates/${id}/`);
    return res.data;
  },

  createTemplate: async (payload) => {
    const res = await apiSvc.http.post(`${base}/templates/`, payload);
    return res.data;
  },

  updateTemplate: async (id, payload) => {
    const res = await apiSvc.http.patch(`${base}/templates/${id}/`, payload);
    return res.data;
  },

  deleteTemplate: async (id) => {
    const res = await apiSvc.http.delete(`${base}/templates/${id}/`);
    return res.data;
  },

  // Appreciations
  getAppreciations: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${base}/appreciations/?${queryString}` : `${base}/appreciations/`;
    const res = await apiSvc.http.get(url);
    return res.data;
  },

  createAppreciation: async (payload) => {
    const res = await apiSvc.http.post(`${base}/appreciations/`, payload);
    return res.data;
  },

  updateAppreciation: async (id, payload) => {
    const res = await apiSvc.http.patch(`${base}/appreciations/${id}/`, payload);
    return res.data;
  },

  deleteAppreciation: async (id) => {
    const res = await apiSvc.http.delete(`${base}/appreciations/${id}/`);
    return res.data;
  },

  // Portfolios
  getPortfolios: async () => {
    const res = await apiSvc.http.get(`${base}/portfolios/`);
    return res.data;
  },

  getPortfolio: async (id) => {
    const res = await apiSvc.http.get(`${base}/portfolios/${id}/`);
    return res.data;
  },

  createPortfolio: async (payload) => {
    const res = await apiSvc.http.post(`${base}/portfolios/`, payload);
    return res.data;
  },

  updatePortfolio: async (id, payload) => {
    const res = await apiSvc.http.patch(`${base}/portfolios/${id}/`, payload);
    return res.data;
  },

  deletePortfolio: async (id) => {
    const res = await apiSvc.http.delete(`${base}/portfolios/${id}/`);
    return res.data;
  },

  // Analytics
  getAnalytics: async () => {
    const res = await apiSvc.http.get(`${base}/analytics/`);
    return res.data;
  },

  // Preparation Guide
  generatePreparationGuide: async (payload) => {
    const res = await apiSvc.http.post(`${base}/preparation-guide/`, payload);
    return res.data;
  },
};
