// Automation API Service for UC-069 Application Workflow Automation

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

class AutomationAPI {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Helper method to get auth headers
  getAuthHeaders() {
    const token = localStorage.getItem('firebaseToken'); // Use firebaseToken, not authToken
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  // Helper method to handle API requests
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        let errorText = '';
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          errorText = await response.text().catch(() => '');
        }
        const message = errorData.error || errorData.message || errorText || `HTTP ${response.status}`;
        console.warn(`API request failed: ${endpoint} (${response.status})`, message);
        return { error: message, status: response.status };
      }

      // Handle no-content responses
      if (response.status === 204) {
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      return {};
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      if (error?.message === 'Network error' || error?.name === 'TypeError') {
        return { error: 'Network error' };
      }
      return { error: error?.message || 'Request failed' };
    }
  }

  // Automation Rules Management
  async getAutomationRules() {
    return this.request('/automation/rules/');
  }

  async getAutomationRule(id) {
    return this.request(`/automation/rules/${id}/`);
  }

  async createAutomationRule(ruleData) {
    return this.request('/automation/rules/', {
      method: 'POST',
      body: JSON.stringify(ruleData),
    });
  }

  async updateAutomationRule(id, ruleData) {
    return this.request(`/automation/rules/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(ruleData),
    });
  }

  async deleteAutomationRule(id) {
    return this.request(`/automation/rules/${id}/`, {
      method: 'DELETE',
    });
  }

  // Application Package Management
  async getApplicationPackages() {
    return this.request('/automation/packages/');
  }

  async getApplicationPackageDetails(id) {
    return this.request(`/automation/packages/${id}/`);
  }

  async generateApplicationPackage(jobId, parameters = {}) {
    return this.request('/automation/generate-package/', {
      method: 'POST',
      body: JSON.stringify({
        job_id: jobId,
        parameters: parameters,
      }),
    });
  }

  async regenerateApplicationPackage(packageId) {
    return this.request(`/automation/packages/${packageId}/regenerate/`, {
      method: 'POST',
    });
  }

  async downloadApplicationPackage(packageId) {
    const response = await fetch(`${this.baseURL}/automation/packages/${packageId}/download/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to download package');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    return url;
  }

  // Scheduled Submissions Management
  async getScheduledSubmissions() {
    return this.request('/automation/scheduled-submissions/');
  }

  async createScheduledSubmission(submissionData) {
    return this.request('/automation/scheduled-submissions/', {
      method: 'POST',
      body: JSON.stringify(submissionData),
    });
  }

  async updateScheduledSubmission(id, submissionData) {
    return this.request(`/automation/scheduled-submissions/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(submissionData),
    });
  }

  async cancelScheduledSubmission(id) {
    return this.request(`/automation/scheduled-submissions/${id}/cancel/`, {
      method: 'POST',
    });
  }

  async executeScheduledSubmission(id) {
    return this.request(`/automation/scheduled-submissions/${id}/execute/`, {
      method: 'POST',
    });
  }

  // Automation Logs
  async getAutomationLogs(params = {}) {
    const queryParams = new URLSearchParams();
    
    if (params.rule_id) queryParams.append('rule_id', params.rule_id);
    if (params.level) queryParams.append('level', params.level);
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.limit) queryParams.append('limit', params.limit);

    const endpoint = `/automation/logs/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return this.request(endpoint);
  }

  // Analytics and Reporting
  async getAutomationAnalytics(timeRange = '7days') {
    return this.request(`/automation/analytics/?time_range=${timeRange}`);
  }

  async getRuleExecutionStats(ruleId) {
    return this.request(`/automation/rules/${ruleId}/stats/`);
  }

  // Bulk Operations
  async bulkCreateRules(rulesData) {
    return this.request('/automation/bulk/rules/', {
      method: 'POST',
      body: JSON.stringify({ rules: rulesData }),
    });
  }

  async bulkUpdateRules(updates) {
    return this.request('/automation/bulk/rules/update/', {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    });
  }

  async bulkDeleteRules(ruleIds) {
    return this.request('/automation/bulk/rules/delete/', {
      method: 'DELETE',
      body: JSON.stringify({ rule_ids: ruleIds }),
    });
  }

  async bulkGeneratePackages(jobIds, parameters = {}) {
    return this.request('/automation/bulk/generate-packages/', {
      method: 'POST',
      body: JSON.stringify({
        job_ids: jobIds,
        parameters,
      }),
    });
  }

  // Follow-up Reminders
  async getFollowUpReminders() {
    return this.request('/automation/follow-ups/');
  }

  async createFollowUpReminder(reminderData) {
    return this.request('/automation/follow-ups/', {
      method: 'POST',
      body: JSON.stringify(reminderData),
    });
  }

  async updateFollowUpReminder(id, reminderData) {
    return this.request(`/automation/follow-ups/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(reminderData),
    });
  }

  async deleteFollowUpReminder(id) {
    return this.request(`/automation/follow-ups/${id}/`, {
      method: 'DELETE',
    });
  }

  // Application Checklists
  async getApplicationChecklists() {
    return this.request('/automation/checklists/');
  }

  async createApplicationChecklist(checklistData) {
    return this.request('/automation/checklists/', {
      method: 'POST',
      body: JSON.stringify(checklistData),
    });
  }

  async updateApplicationChecklist(id, checklistData) {
    return this.request(`/automation/checklists/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(checklistData),
    });
  }

  async deleteApplicationChecklist(id) {
    return this.request(`/automation/checklists/${id}/`, {
      method: 'DELETE',
    });
  }

  async updateChecklistTask(checklistId, taskId, taskData) {
    return this.request(`/automation/checklists/${checklistId}/tasks/${taskId}/`, {
      method: 'PUT',
      body: JSON.stringify(taskData),
    });
  }

  // Manual Automation Triggers
  async triggerAutomation(triggerData) {
    return this.request('/automation/trigger/', {
      method: 'POST',
      body: JSON.stringify(triggerData),
    });
  }

  async triggerRuleExecution(ruleId, context = {}) {
    return this.request(`/automation/rules/${ruleId}/execute/`, {
      method: 'POST',
      body: JSON.stringify({ context }),
    });
  }

  // System Health and Status
  async getAutomationStatus() {
    return this.request('/automation/status/');
  }

  async getSystemHealth() {
    return this.request('/automation/health/');
  }

  // Template Management (for automation parameters)
  async getActionTemplates(actionType) {
    return this.request(`/automation/templates/${actionType}/`);
  }

  async createActionTemplate(actionType, templateData) {
    return this.request(`/automation/templates/${actionType}/`, {
      method: 'POST',
      body: JSON.stringify(templateData),
    });
  }

  // Integration Helpers
  async testIntegration(integrationType, credentials) {
    return this.request('/automation/integrations/test/', {
      method: 'POST',
      body: JSON.stringify({
        type: integrationType,
        credentials,
      }),
    });
  }

  async getIntegrationStatus() {
    return this.request('/automation/integrations/status/');
  }
}

// Create and export a singleton instance
export const automationAPI = new AutomationAPI();
export default automationAPI;
