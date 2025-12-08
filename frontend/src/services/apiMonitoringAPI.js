/**
 * UC-117: API Rate Limiting and Error Handling Dashboard
 * API client functions for admin monitoring endpoints
 */

import { api } from './api';

export const apiMonitoringAPI = {
  /**
   * Get comprehensive dashboard data
   * @param {number} days - Number of days to look back (default: 7)
   */
  getDashboard: async (days = 7) => {
    try {
      // Get client timezone offset in minutes (negative of getTimezoneOffset)
      const tzOffset = -new Date().getTimezoneOffset();
      const response = await api.get(`/admin/api-monitoring/dashboard/?days=${days}&tz_offset=${tzOffset}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load dashboard' };
    }
  },

  /**
   * Get list of all API services
   */
  getServices: async () => {
    try {
      const response = await api.get('/admin/api-monitoring/services/');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load services' };
    }
  },

  /**
   * Get detailed stats for a specific service
   * @param {number} serviceId - Service ID
   * @param {number} days - Number of days to look back
   */
  getServiceDetail: async (serviceId, days = 7) => {
    try {
      const response = await api.get(`/admin/api-monitoring/services/${serviceId}/?days=${days}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load service details' };
    }
  },

  /**
   * Get paginated usage logs
   * @param {Object} params - Query parameters
   */
  getUsageLogs: async (params = {}) => {
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await api.get(`/admin/api-monitoring/usage-logs/?${queryString}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load usage logs' };
    }
  },

  /**
   * Get paginated error logs
   * @param {Object} params - Query parameters
   */
  getErrorLogs: async (params = {}) => {
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await api.get(`/admin/api-monitoring/errors/?${queryString}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load error logs' };
    }
  },

  /**
   * Get alerts
   * @param {Object} params - Query parameters
   */
  getAlerts: async (params = {}) => {
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await api.get(`/admin/api-monitoring/alerts/?${queryString}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load alerts' };
    }
  },

  /**
   * Acknowledge an alert
   * @param {number} alertId - Alert ID
   */
  acknowledgeAlert: async (alertId) => {
    try {
      const response = await api.post(`/admin/api-monitoring/alerts/${alertId}/acknowledge/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to acknowledge alert' };
    }
  },

  /**
   * Resolve an alert
   * @param {number} alertId - Alert ID
   */
  resolveAlert: async (alertId) => {
    try {
      const response = await api.post(`/admin/api-monitoring/alerts/${alertId}/resolve/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to resolve alert' };
    }
  },

  /**
   * Get list of weekly reports
   * @param {number} limit - Number of reports to return
   */
  getWeeklyReports: async (limit = 10) => {
    try {
      const response = await api.get(`/admin/api-monitoring/weekly-reports/?limit=${limit}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load weekly reports' };
    }
  },

  /**
   * Get detailed weekly report
   * @param {number} reportId - Report ID
   */
  getWeeklyReportDetail: async (reportId) => {
    try {
      const response = await api.get(`/admin/api-monitoring/weekly-reports/${reportId}/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load report details' };
    }
  },
};

export default apiMonitoringAPI;
