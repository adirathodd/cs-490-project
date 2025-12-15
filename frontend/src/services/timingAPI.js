/**
 * UC-124: Job Application Timing Optimizer API
 * 
 * API service for scheduled submissions, reminders, and timing analytics
 */

import { api } from './api';

class TimingAPI {
  // ========================================
  // Scheduled Submissions
  // ========================================

  /**
   * Get all scheduled submissions
   * @param {Object} params - Query parameters (status, etc.)
   * @returns {Promise<Array>} List of scheduled submissions
   */
  async getScheduledSubmissions(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `/scheduled-submissions/?${queryString}` : '/scheduled-submissions/';
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      throw this._handleError(error, 'Failed to fetch scheduled submissions');
    }
  }

  /**
   * Get a specific scheduled submission
   * @param {number} id - Submission ID
   * @returns {Promise<Object>} Scheduled submission details
   */
  async getScheduledSubmission(id) {
    try {
      const response = await api.get(`/scheduled-submissions/${id}/`);
      return response.data;
    } catch (error) {
      throw this._handleError(error, 'Failed to fetch scheduled submission');
    }
  }

  /**
   * Create a new scheduled submission
   * @param {Object} data - Submission data
   * @returns {Promise<Object>} Created submission
   */
  async createScheduledSubmission(data) {
    try {
      const response = await api.post('/scheduled-submissions/', data);
      return response.data;
    } catch (error) {
      throw this._handleError(error, 'Failed to create scheduled submission');
    }
  }

  /**
   * Update a scheduled submission
   * @param {number} id - Submission ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated submission
   */
  async updateScheduledSubmission(id, data) {
    try {
      const response = await api.put(`/scheduled-submissions/${id}/`, data);
      return response.data;
    } catch (error) {
      throw this._handleError(error, 'Failed to update scheduled submission');
    }
  }

  /**
   * Delete a scheduled submission
   * @param {number} id - Submission ID
   * @returns {Promise<void>}
   */
  async deleteScheduledSubmission(id) {
    try {
      await api.delete(`/scheduled-submissions/${id}/`);
    } catch (error) {
      throw this._handleError(error, 'Failed to delete scheduled submission');
    }
  }

  /**
   * Cancel a scheduled submission
   * @param {number} id - Submission ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Updated submission
   */
  async cancelScheduledSubmission(id, reason = '') {
    try {
      const response = await api.post(`/scheduled-submissions/${id}/cancel/`, { reason });
      return response.data;
    } catch (error) {
      throw this._handleError(error, 'Failed to cancel scheduled submission');
    }
  }

  /**
   * Execute a scheduled submission immediately
   * @param {number} id - Submission ID
   * @returns {Promise<Object>} Updated submission
   */
  async executeScheduledSubmission(id) {
    try {
      const response = await api.post(`/scheduled-submissions/${id}/execute/`);
      return response.data;
    } catch (error) {
      throw this._handleError(error, 'Failed to execute scheduled submission');
    }
  }

  // ========================================
  // Reminders
  // ========================================

  /**
   * Get all reminders
   * @param {Object} params - Query parameters (status, type, etc.)
   * @returns {Promise<Array>} List of reminders
   */
  async getReminders(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `/reminders/?${queryString}` : '/reminders/';
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      throw this._handleError(error, 'Failed to fetch reminders');
    }
  }

  /**
   * Get a specific reminder
   * @param {number} id - Reminder ID
   * @returns {Promise<Object>} Reminder details
   */
  async getReminder(id) {
    try {
      const response = await api.get(`/reminders/${id}/`);
      return response.data;
    } catch (error) {
      throw this._handleError(error, 'Failed to fetch reminder');
    }
  }

  /**
   * Create a new reminder
   * @param {Object} data - Reminder data
   * @returns {Promise<Object>} Created reminder
   */
  async createReminder(data) {
    try {
      const response = await api.post('/reminders/', data);
      return response.data;
    } catch (error) {
      throw this._handleError(error, 'Failed to create reminder');
    }
  }

  /**
   * Update a reminder
   * @param {number} id - Reminder ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated reminder
   */
  async updateReminder(id, data) {
    try {
      const response = await api.put(`/reminders/${id}/`, data);
      return response.data;
    } catch (error) {
      throw this._handleError(error, 'Failed to update reminder');
    }
  }

  /**
   * Delete a reminder
   * @param {number} id - Reminder ID
   * @returns {Promise<void>}
   */
  async deleteReminder(id) {
    try {
      await api.delete(`/reminders/${id}/`);
    } catch (error) {
      throw this._handleError(error, 'Failed to delete reminder');
    }
  }

  /**
   * Dismiss a reminder
   * @param {number} id - Reminder ID
   * @returns {Promise<Object>} Updated reminder
   */
  async dismissReminder(id) {
    try {
      const response = await api.post(`/reminders/${id}/dismiss/`);
      return response.data;
    } catch (error) {
      throw this._handleError(error, 'Failed to dismiss reminder');
    }
  }

  // ========================================
  // Timing Best Practices & Analytics
  // ========================================

  /**
   * Get general application timing best practices
   * @returns {Promise<Object>} Best practices data
   */
  async getBestPractices() {
    try {
      const response = await api.get('/application-timing/best-practices/');
      return response.data;
    } catch (error) {
      throw this._handleError(error, 'Failed to fetch best practices');
    }
  }

  /**
   * Get user's personalized timing analytics
   * @returns {Promise<Object>} Analytics data
   */
  async getTimingAnalytics() {
    try {
      const response = await api.get('/application-timing/analytics/');
      return response.data;
    } catch (error) {
      throw this._handleError(error, 'Failed to fetch timing analytics');
    }
  }

  /**
   * Get calendar view of scheduled and completed applications
   * @param {string} startDate - Start date (ISO format)
   * @param {string} endDate - End date (ISO format)
   * @returns {Promise<Object>} Calendar events data
   */
  async getCalendarView(startDate, endDate) {
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const response = await api.get(`/application-timing/calendar/?${params}`);
      return response.data;
    } catch (error) {
      throw this._handleError(error, 'Failed to fetch calendar view');
    }
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Handle API errors consistently
   * @private
   */
  _handleError(error, defaultMessage) {
    if (error.error) {
      return error.error;
    }
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.response?.data) {
      return {
        message: error.response.data.detail || error.response.data.message || defaultMessage,
        ...error.response.data
      };
    }
    return {
      message: defaultMessage,
      details: error.message
    };
  }
}

// Export singleton instance
export const timingAPI = new TimingAPI();
export default timingAPI;
