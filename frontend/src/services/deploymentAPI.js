/**
 * Deployment Tracking API Service
 * Provides methods for interacting with deployment tracking endpoints
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const deploymentAPI = {
  /**
   * Get list of deployments with optional filters
   * @param {Object} filters - Optional filters (environment, status, days, branch)
   * @returns {Promise<Array>} List of deployments
   */
  async getDeployments(filters = {}) {
    const params = new URLSearchParams();
    if (filters.environment) params.append('environment', filters.environment);
    if (filters.status) params.append('status', filters.status);
    if (filters.days) params.append('days', filters.days);
    if (filters.branch) params.append('branch', filters.branch);
    
    const response = await api.get(`/deployments/?${params.toString()}`);
    return response.data;
  },

  /**
   * Get a single deployment by ID
   * @param {string} id - Deployment UUID
   * @returns {Promise<Object>} Deployment details
   */
  async getDeployment(id) {
    const response = await api.get(`/deployments/${id}/`);
    return response.data;
  },

  /**
   * Get deployment statistics
   * @param {Object} options - Optional filters (environment, days)
   * @returns {Promise<Object>} Deployment statistics
   */
  async getStats(options = {}) {
    const params = new URLSearchParams();
    if (options.environment) params.append('environment', options.environment);
    if (options.days) params.append('days', options.days);
    
    const response = await api.get(`/deployments/stats/?${params.toString()}`);
    return response.data;
  },

  /**
   * Get comprehensive deployment metrics for dashboard
   * @param {number} days - Number of days to include
   * @returns {Promise<Object>} Deployment metrics
   */
  async getMetrics(days = 30) {
    const response = await api.get(`/deployments/metrics/?days=${days}`);
    return response.data;
  },

  /**
   * Get recent deployments
   * @param {Object} options - Optional filters (environment, limit)
   * @returns {Promise<Array>} Recent deployments
   */
  async getRecent(options = {}) {
    const params = new URLSearchParams();
    if (options.environment) params.append('environment', options.environment);
    if (options.limit) params.append('limit', options.limit);
    
    const response = await api.get(`/deployments/recent/?${params.toString()}`);
    return response.data;
  },

  /**
   * Get deployment summary for dashboard widget
   * @returns {Promise<Object>} Quick summary
   */
  async getSummary() {
    const response = await api.get('/deployments/summary/');
    return response.data;
  },

  /**
   * Trigger a rollback for a deployment
   * @param {string} deploymentId - Deployment to rollback
   * @param {Object} data - Rollback data (target_sha, reason)
   * @returns {Promise<Object>} New rollback deployment
   */
  async triggerRollback(deploymentId, data) {
    const response = await api.post(`/deployments/${deploymentId}/rollback/`, data);
    return response.data;
  },

  /**
   * Add a log entry to a deployment
   * @param {string} deploymentId - Deployment ID
   * @param {Object} logData - Log data (level, message, step)
   * @returns {Promise<Object>} Created log entry
   */
  async addLog(deploymentId, logData) {
    const response = await api.post(`/deployments/${deploymentId}/logs/`, logData);
    return response.data;
  },

  /**
   * Mark a deployment as complete
   * @param {string} deploymentId - Deployment ID
   * @param {Object} data - Completion data (status, health_check_passed)
   * @returns {Promise<Object>} Updated deployment
   */
  async markComplete(deploymentId, data) {
    const response = await api.post(`/deployments/${deploymentId}/complete/`, data);
    return response.data;
  },
};

export default deploymentAPI;
