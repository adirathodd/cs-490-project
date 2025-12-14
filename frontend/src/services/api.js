import axios from 'axios';
import { ensureFirebaseToken } from './authToken';

// ⚠️ UC-117: Backend API monitoring tracks all external API calls.
// See backend/core/api_monitoring.py for implementation details.

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Create axios instance with base configuration
export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add token to requests if available
api.interceptors.request.use(
  async (config) => {
    const token = await ensureFirebaseToken(false);
    if (!config.headers) config.headers = {};
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Normalize errors and add light retry for transient GET failures
// Also handle token expiration by refreshing the token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config || {};
    const status = error?.response?.status;
    const method = (config.method || '').toLowerCase();
    const isGet = method === 'get';
    const isTransient = !error.response || [408, 429, 500, 502, 503, 504].includes(status);

    // Handle token expiration (401/403 with authentication error)
    if (status === 401 || status === 403) {
      const errorMessage = (error?.response?.data?.error?.message || error?.response?.data?.detail || '').toLowerCase();
      if (!config.__tokenRefreshAttempted && (errorMessage.includes('token') || errorMessage.includes('authentication'))) {
        try {
          config.__tokenRefreshAttempted = true;
          const newToken = await ensureFirebaseToken(true);
          if (newToken) {
            if (!config.headers) config.headers = {};
            config.headers.Authorization = `Bearer ${newToken}`;
            return api.request(config);
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          try {
            localStorage.removeItem('firebaseToken');
          } catch (_) {
            // ignore
          }
        }
      }
    }

    if (isGet && isTransient && (config.__retryCount || 0) < 1) {
      config.__retryCount = (config.__retryCount || 0) + 1;
      await new Promise((r) => setTimeout(r, 500));
      return api.request(config);
    }

    // Prefer backend error shape if present, preserving any details/messages for callers
    const backendErr = error?.response?.data?.error;
    if (backendErr) {
      return Promise.reject({ error: backendErr });
    }

    return Promise.reject({
      error: {
        code: 'network_error',
        message: 'Network error. Please try again.',
      },
    });
  }
);

// eslint-disable-next-line no-unused-vars
const _extractErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  if (!data) return fallback;

  if (typeof data === 'string') return data;

  if (typeof data.detail === 'string' && data.detail.trim()) {
    return data.detail;
  }

  for (const value of Object.values(data)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const first = value.find((v) => typeof v === 'string' && v.trim().length);
      if (first) return first;
    }
    if (typeof value === 'string' && value.trim().length) {
      return value;
    }
  }

  return fallback;
};

// Contacts API (minimal surface used by referrals components)
export const contactsAPI = {
  list: async (params = {}) => {
    try {
      const usp = new URLSearchParams(params).toString();
      const path = usp ? `/contacts?${usp}` : '/contacts';
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch contacts' };
    }
  },

  get: async (id) => {
    try {
      const response = await api.get(`/contacts/${id}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch contact' };
    }
  },

  create: async (payload) => {
    try {
      const response = await api.post('/contacts', payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to create contact' };
    }
  },

  update: async (id, payload) => {
    try {
      const response = await api.patch(`/contacts/${id}`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update contact' };
    }
  },

  remove: async (id) => {
    try {
      const response = await api.delete(`/contacts/${id}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete contact' };
    }
  },
};

// Profile API calls
export const profileAPI = {
  getUserProfile: async (userId) => {
    try {
      const response = await api.get(userId ? `/users/${userId}/profile` : '/users/profile');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  updateProfile: async (userId, profileData) => {
    try {
      const response = await api.put(userId ? `/users/${userId}/profile` : '/users/profile', profileData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
};

// Auth API calls
export const authAPI = {
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { code: 'registration_failed', message: 'Registration failed' };
    }
  },

  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { code: 'login_failed', message: 'Login failed' };
    }
  },

  getCurrentUser: async () => {
    try {
      const response = await api.get('/users/me');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { code: 'fetch_user_failed', message: 'Failed to fetch user' };
    }
  },

  updateProfile: async (profileData) => {
    try {
      const response = await api.patch('/users/me', profileData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { code: 'update_profile_failed', message: 'Failed to update profile' };
    }
  },

  // UC-021: Basic Profile Information
  getBasicProfile: async () => {
    try {
      const response = await api.get('/profile/basic');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateBasicProfile: async (profileData) => {
    try {
      const response = await api.patch('/profile/basic', profileData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Exchange a provider access token (e.g., GitHub) for a Firebase custom token
  // when the provider reports an email matching an existing account. Returns { custom_token, email }
  linkProviderToken: async (provider, accessToken) => {
    try {
      const response = await api.post('/auth/oauth/link', { provider, access_token: accessToken });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // UC-022: Profile Picture Upload
  getProfilePicture: async () => {
    try {
      const response = await api.get('/profile/picture');
      return response.data; // Returns { profile_picture_url, has_profile_picture, profile_picture_uploaded_at }
    } catch (error) {
      throw error;
    }
  },

  uploadProfilePicture: async (file) => {
    try {
      const formData = new FormData();
      formData.append('profile_picture', file);
      
      const response = await api.post('/profile/picture/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  deleteProfilePicture: async () => {
    try {
      const response = await api.delete('/profile/picture/delete');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // UC-009: Account Deletion
  deleteAccount: async () => {
    try {
      const response = await api.delete('/users/me');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  requestAccountDeletion: async () => {
    try {
      const response = await api.post('/users/me/delete-request');
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

// UC-026: Skills API calls
export const skillsAPI = {
  // Get all skills for the current user
  getSkills: async () => {
    try {
      const response = await api.get('/skills');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch skills' };
    }
  },

  // Add a new skill
  addSkill: async (skillData) => {
    try {
      const response = await api.post('/skills', skillData);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to add skill' };
    }
  },

  // Update skill proficiency level or years
  updateSkill: async (skillId, skillData) => {
    try {
      const response = await api.patch(`/skills/${skillId}`, skillData);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to update skill' };
    }
  },

  // Delete a skill
  deleteSkill: async (skillId) => {
    try {
      const response = await api.delete(`/skills/${skillId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to delete skill' };
    }
  },

  // Get autocomplete suggestions for skills
  autocompleteSkills: async (query, category = '', limit = 10) => {
    try {
      const params = new URLSearchParams({ q: query, limit });
      if (category) params.append('category', category);
      const response = await api.get(`/skills/autocomplete?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch suggestions' };
    }
  },

  // Get available skill categories
  getCategories: async () => {
    try {
      const response = await api.get('/skills/categories');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch categories' };
    }
  },
  
  // UC-027: Category Organization endpoints
  
  // Get skills grouped by category
  getSkillsByCategory: async () => {
    try {
      const response = await api.get('/skills/by-category');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch skills by category' };
    }
  },
  
  // Reorder a single skill
  reorderSkill: async (skillId, newOrder, newCategory = null) => {
    try {
      const data = { skill_id: skillId, new_order: newOrder };
      if (newCategory) data.new_category = newCategory;
      const response = await api.post('/skills/reorder', data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to reorder skill' };
    }
  },
  
  // Bulk reorder skills
  bulkReorderSkills: async (skillsData) => {
    try {
      const response = await api.post('/skills/bulk-reorder', { skills: skillsData });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to reorder skills' };
    }
  },
  
  // Export skills
  exportSkills: async (format = 'json') => {
    try {
      const response = await api.get(`/skills/export?format=${format}`, {
        responseType: format === 'csv' ? 'blob' : 'json'
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to export skills' };
    }
  },
};

// Education API calls
export const educationAPI = {
  getLevels: async () => {
    try {
      const response = await api.get('/education/levels');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch education levels' };
    }
  },

  getEducations: async () => {
    try {
      const response = await api.get('/education');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch education entries' };
    }
  },

  addEducation: async (data) => {
    try {
      const response = await api.post('/education', data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to add education' };
    }
  },

  updateEducation: async (id, data) => {
    try {
      const response = await api.patch(`/education/${id}` , data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to update education' };
    }
  },

  deleteEducation: async (id) => {
    try {
      const response = await api.delete(`/education/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to delete education' };
    }
  }
};

// UC-030: Certifications API calls
export const certificationsAPI = {
  getCategories: async () => {
    try {
      const response = await api.get('/certifications/categories');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch certification categories' };
    }
  },

  searchOrganizations: async (query, limit = 10) => {
    try {
      const params = new URLSearchParams({ q: query, limit });
      const response = await api.get(`/certifications/orgs?${params.toString()}`);
      return response.data; // array of strings
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to search organizations' };
    }
  },

  getCertifications: async () => {
    try {
      const response = await api.get('/certifications');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch certifications' };
    }
  },

  addCertification: async (data) => {
    try {
      // If document or badge file is included, send multipart
      if (data.document instanceof File || data.badge_image instanceof File) {
        const form = new FormData();
        Object.entries(data).forEach(([k, v]) => {
          if (v !== undefined && v !== null) form.append(k, v);
        });
        const response = await api.post('/certifications', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        return response.data;
      }
      const response = await api.post('/certifications', data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to add certification' };
    }
  },

  updateCertification: async (id, data) => {
    try {
      const requiresMultipart =
        data.document instanceof File ||
        data.document === null ||
        data.badge_image instanceof File ||
        data.badge_image === null;
      if (requiresMultipart) {
        const form = new FormData();
        Object.entries(data).forEach(([k, v]) => {
          if (v === null) {
            form.append(k, ''); // allow clearing fields
          } else if (v !== undefined) {
            form.append(k, v);
          }
        });
        const response = await api.patch(`/certifications/${id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        return response.data;
      }
      const response = await api.patch(`/certifications/${id}`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to update certification' };
    }
  },

  deleteCertification: async (id) => {
    try {
      const response = await api.delete(`/certifications/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to delete certification' };
    }
  },
};

// UC-031: Projects API calls
export const projectsAPI = {
  getProjects: async (params = {}) => {
    try {
      // Support filters/sort/search via query params
      const usp = new URLSearchParams();
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return;
        usp.append(k, Array.isArray(v) ? v.join(',') : v);
      });
      const path = usp.toString() ? `/projects?${usp.toString()}` : '/projects';
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch projects' };
    }
  },

  getProject: async (id) => {
    try {
      const response = await api.get(`/projects/${id}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch project' };
    }
  },

  addProject: async (data) => {
    try {
      // If files present, use multipart
      if (data.media && Array.isArray(data.media) && data.media.length > 0) {
        const form = new FormData();
        Object.entries(data).forEach(([k, v]) => {
          if (k === 'media') return; // handle separately
          if (k === 'technologies' && Array.isArray(v)) {
            form.append('technologies', JSON.stringify(v));
          } else if (v !== undefined && v !== null) {
            form.append(k, v);
          }
        });
        data.media.forEach((file) => form.append('media', file));
        const response = await api.post('/projects', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        return response.data;
      }
      const payload = { ...data };
      const response = await api.post('/projects', payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to add project' };
    }
  },

  updateProject: async (id, data) => {
    try {
      if (data.media && Array.isArray(data.media) && data.media.length > 0) {
        const form = new FormData();
        Object.entries(data).forEach(([k, v]) => {
          if (k === 'media') return;
          if (k === 'technologies' && Array.isArray(v)) {
            form.append('technologies', JSON.stringify(v));
          } else if (v !== undefined) {
            form.append(k, v === null ? '' : v);
          }
        });
        data.media.forEach((file) => form.append('media', file));
        const response = await api.patch(`/projects/${id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        return response.data;
      }
      const response = await api.patch(`/projects/${id}`, data);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update project' };
    }
  },

  deleteProject: async (id) => {
    try {
      const response = await api.delete(`/projects/${id}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete project' };
    }
  },

  deleteProjectMedia: async (projectId, mediaId) => {
    try {
      const response = await api.delete(`/projects/${projectId}/media/${mediaId}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete media' };
    }
  },
};

// UC-023, UC-024, UC-025: Employment History API calls
authAPI.getEmploymentHistory = async () => {
  try {
    const response = await api.get('/employment');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// UC-036: Jobs API calls
// UC-039: Enhanced with search/filter params support
export const jobsAPI = {
  getJobs: async (params = {}) => {
    try {
      // Build query string from params object
      const usp = new URLSearchParams();
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return;
        usp.append(k, v);
      });
      const path = usp.toString() ? `/jobs?${usp.toString()}` : '/jobs';
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch jobs' };
    }
  },

  getJob: async (id) => {
    try {
      const response = await api.get(`/jobs/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch job' };
    }
  },

  getJobCompanyInsights: async (id) => {
    try {
      const response = await api.get(`/jobs/${id}/company`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch company insights' };
    }
  },

  // UC-074: Generate company profile using AI when DB fields are missing
  generateCompanyProfile: async (id, options = {}) => {
    try {
      const response = await api.post(`/jobs/${id}/company/generate`, options);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to generate company profile' };
    }
  },

  getJobInterviewInsights: async (id) => {
    try {
      const response = await api.get(`/jobs/${id}/interview-insights/`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch interview insights' };
    }
  },

  getJobTechnicalPrep: async (id, options = {}) => {
    try {
      const params = new URLSearchParams();
      if (options.refresh) params.append('refresh', 'true');
      const path = params.toString() ? `/jobs/${id}/technical-prep/?${params.toString()}` : `/jobs/${id}/technical-prep/`;
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch technical prep' };
    }
  },

  // Interview practice question bank (alias to questionBankAPI)
  getJobQuestionBank: async (jobId, refresh = false) => {
    return questionBankAPI.getQuestionBank(jobId, refresh);
  },

  logQuestionPractice: async (jobId, data) => {
    return questionBankAPI.logQuestionPractice(jobId, data);
  },
  getQuestionPracticeHistory: async (jobId, questionId) => {
    return questionBankAPI.getQuestionPracticeHistory(jobId, questionId);
  },
  coachQuestionResponse: async (jobId, data) => {
    return questionBankAPI.coachQuestionResponse(jobId, data);
  },
  logTechnicalPrepAttempt: async (id, data) => {
    try {
      const response = await api.post(`/jobs/${id}/technical-prep/practice/`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to log technical prep attempt' };
    }
  },

  togglePreparationChecklist: async (id, data) => {
    try {
      const response = await api.post(`/jobs/${id}/preparation-checklist/`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to update checklist' };
    }
  },

  // UC-066: Skills Gap Analysis
  getJobSkillsGap: async (id, options = {}) => {
    try {
      const params = new URLSearchParams();
      if (options.refresh) params.append('refresh', 'true');
      if (options.include_similar) params.append('include_similar', 'true');
      const path = params.toString() ? `/jobs/${id}/skills-gap/?${params.toString()}` : `/jobs/${id}/skills-gap/`;
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch skills gap analysis' };
    }
  },

  logSkillProgress: async (skillId, data) => {
    try {
      const response = await api.post(`/skills/${skillId}/progress/`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to log skill progress' };
    }
  },

  getSkillProgress: async (skillId) => {
    try {
      const response = await api.get(`/skills/${skillId}/progress/`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch skill progress' };
    }
  },

  addJob: async (data) => {
    const response = await api.post('/jobs', data);
    return response.data;
  },

  updateJob: async (id, data) => {
    const response = await api.patch(`/jobs/${id}`, data);
    return response.data;
  },

  deleteJob: async (id) => {
    const response = await api.delete(`/jobs/${id}`);
    return response.data;
  },

  // importFromUrl defined below (keep a single implementation)

  // UC-037 additions
  getJobStats: async (params = {}) => {
    const response = await api.get('/jobs/stats', { params });
    return response.data; // { interested: n, applied: n, ... }
  },

  getAnalytics: async (params = {}) => {
    const response = await api.get('/jobs/analytics', { params });
    return response.data; // Enhanced analytics data
  },
  getProductivityAnalytics: async () => {
    const response = await api.get('/productivity/analytics');
    return response.data;
  },
  getCompetitiveAnalysis: async (params = {}) => {
    const response = await api.get('/jobs/competitive-analysis', { params });
    return response.data;
  },
  updateAnalyticsGoals: async (payload) => {
    const response = await api.patch('/jobs/analytics/goals', payload);
    return response.data;
  },

  // UC-097: Application Success Rate Analysis
  getSuccessAnalysis: async () => {
    const response = await api.get('/jobs/success-analysis');
    return response.data;
  },

  bulkUpdateStatus: async (ids, status) => {
    const response = await api.post('/jobs/bulk-status', { ids, status });
    return response.data; // { updated: n }
  },
  bulkUpdateDeadline: async (ids, deadline) => {
    // deadline should be a string 'YYYY-MM-DD' or null to clear
    const response = await api.post('/jobs/bulk-deadline', { ids, deadline });
    return response.data; // { updated: n }
  },
  getUpcomingDeadlines: async (limit = 5) => {
    const response = await api.get(`/jobs/upcoming-deadlines?limit=${limit}`);
    return response.data;
  },

  // UC-045: Job archiving methods
  archiveJob: async (id, reason = 'other') => {
    const response = await api.post(`/jobs/${id}/archive`, { reason });
    return response.data;
  },

  restoreJob: async (id) => {
    const response = await api.post(`/jobs/${id}/restore`);
    return response.data;
  },

  bulkArchiveJobs: async (ids, reason = 'other') => {
    const response = await api.post('/jobs/bulk-archive', { ids, reason });
    return response.data;
  },

  bulkRestoreJobs: async (ids) => {
    const response = await api.post('/jobs/bulk-restore', { ids });
    return response.data;
  },

  permanentlyDeleteJob: async (id) => {
    const response = await api.delete(`/jobs/${id}/delete`);
    return response.data;
  },

  importFromUrl: async (url) => {
    try {
      const response = await api.post('/jobs/import-from-url', { url });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to import job from URL' };
    }
  },

  // UC-065: Job Matching Algorithm
  getJobMatchScore: async (id, options = {}) => {
    try {
      const params = new URLSearchParams();
      if (options.refresh) params.append('refresh', 'true');
      const path = params.toString() ? `/jobs/${id}/match-score/?${params.toString()}` : `/jobs/${id}/match-score/`;
      const response = await api.get(path);
      return response;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch job match score' };
    }
  },

  updateJobMatchWeights: async (id, data) => {
    try {
      const response = await api.post(`/jobs/${id}/match-score/`, data);
      return response;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to update match weights' };
    }
  },

  getBulkJobMatchScores: async (options = {}) => {
    try {
      const params = new URLSearchParams();
      if (options.job_ids) params.append('job_ids', options.job_ids);
      if (options.limit) params.append('limit', options.limit);
      if (options.min_score) params.append('min_score', options.min_score);
      if (options.sort_by) params.append('sort_by', options.sort_by);
      if (options.order) params.append('order', options.order);
      const path = params.toString() ? `/jobs/match-scores/?${params.toString()}` : `/jobs/match-scores/`;
      const response = await api.get(path);
      return response;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch bulk job match scores' };
    }
  },

  // Application quality scoring
  getApplicationQuality: async (id, options = {}) => {
    try {
      const params = new URLSearchParams();
      if (options.refresh) params.append('refresh', 'true');
      const path = params.toString() ? `/jobs/${id}/quality/?${params.toString()}` : `/jobs/${id}/quality/`;
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch application quality' };
    }
  },

  refreshApplicationQuality: async (id, data = {}) => {
    try {
      const response = await api.post(`/jobs/${id}/quality/`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to score application quality' };
    }
  },
};

export const companyAPI = {
  searchCompanies: async (query = '') => {
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      params.append('limit', '10');
      const path = params.toString() ? `/companies/search?${params.toString()}` : '/companies/search';
      const response = await api.get(path);
      return response.data?.results || [];
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to search companies' };
    }
  },
};

// UC-075 & UC-076: Question Bank and Response Coaching API
export const questionBankAPI = {
  // Get question bank for a job
  getQuestionBank: async (jobId, refresh = false) => {
    try {
      const params = new URLSearchParams();
      if (refresh) params.append('refresh', 'true');
      const path = params.toString() 
        ? `/jobs/${jobId}/question-bank/?${params.toString()}` 
        : `/jobs/${jobId}/question-bank/`;
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch question bank' };
    }
  },

  // Log practice session for a question
  logQuestionPractice: async (jobId, data) => {
    try {
      const response = await api.post(`/jobs/${jobId}/question-bank/practice/`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to log practice' };
    }
  },

  // Get practice history for a specific question
  getQuestionPracticeHistory: async (jobId, questionId) => {
    try {
      const response = await api.get(`/jobs/${jobId}/question-bank/practice/${questionId}/`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch practice history' };
    }
  },

  // Get AI coaching for a response
  coachQuestionResponse: async (jobId, data) => {
    try {
      const response = await api.post(`/jobs/${jobId}/question-bank/coach/`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to generate coaching feedback' };
    }
  },
};

// UC-042: Application Materials API calls
export const materialsAPI = {
  // List documents with optional type filter
  listDocuments: async (type = '') => {
    try {
      const path = type ? `/documents/?type=${type}` : '/documents/';
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch documents' };
    }
  },

  // Upload a new document
  uploadDocument: async (data) => {
    try {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('document_type', data.document_type);
      formData.append('document_name', data.document_name);
      formData.append('version_number', data.version_number || '1');
      
      const response = await api.post('/documents/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to upload document' };
    }
  },

  // Delete a document
  deleteDocument: async (docId) => {
    try {
      const response = await api.delete(`/documents/${docId}/`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to delete document' };
    }
  },

  // Download a document (returns the file URL)
  getDownloadUrl: (docId) => {
    return `${API_BASE_URL}/documents/${docId}/download/`;
  },

  // Get materials for a specific job
  getJobMaterials: async (jobId) => {
    try {
      const response = await api.get(`/jobs/${jobId}/materials/`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch job materials' };
    }
  },

  // Update materials for a specific job
  updateJobMaterials: async (jobId, data) => {
    try {
      const response = await api.post(`/jobs/${jobId}/materials/`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to update job materials' };
    }
  },

  // Get default materials
  getDefaults: async () => {
    try {
      const response = await api.get('/materials/defaults/');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch defaults' };
    }
  },

  // Set default materials
  setDefaults: async (data) => {
    try {
      const response = await api.post('/materials/defaults/', data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to set defaults' };
    }
  },

  // Get materials usage analytics
  getAnalytics: async () => {
    try {
      const response = await api.get('/materials/analytics/');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch analytics' };
    }
  },
};

// UC-067: Salary Research and Benchmarking API calls
export const salaryAPI = {
  // Get salary research data for a job
  getSalaryResearch: async (jobId) => {
    try {
      const response = await api.get(`/jobs/${jobId}/salary-research/`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch salary research' };
    }
  },

  // Trigger new salary research or refresh existing data
  triggerResearch: async (jobId, options = {}) => {
    try {
      const response = await api.post(`/jobs/${jobId}/salary-research/`, options);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to trigger salary research' };
    }
  },

  // Export salary research report
  exportResearch: async (jobId, format = 'json') => {
    try {
      const response = await api.get(`/jobs/${jobId}/salary-research/export/`, {
        params: { format },
        responseType: format === 'pdf' ? 'blob' : 'json'
      });
      
      if (format === 'pdf') {
        // Create blob URL for PDF download
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        return { url, blob };
      }
      
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to export salary research' };
    }
  },

  // Get salary benchmarks (BLS + community) with caching
  getSalaryBenchmarks: async (jobId, options = {}) => {
    try {
      const params = new URLSearchParams();
      if (options.refresh) params.append('refresh', 'true');
      const path = params.toString()
        ? `/jobs/${jobId}/salary-benchmarks/?${params.toString()}`
        : `/jobs/${jobId}/salary-benchmarks/`;
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch salary benchmarks' };
    }
  },
};

// UC-083: Salary Negotiation planning + outcome tracking
export const salaryNegotiationAPI = {
  getPlan: async (jobId) => {
    try {
      const response = await api.get(`/jobs/${jobId}/salary-negotiation/`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to load negotiation plan' };
    }
  },

  refreshPlan: async (jobId, payload = {}) => {
    try {
      const response = await api.post(`/jobs/${jobId}/salary-negotiation/`, payload);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to refresh negotiation plan' };
    }
  },

  getOutcomes: async (jobId) => {
    try {
      const response = await api.get(`/jobs/${jobId}/salary-negotiation/outcomes/`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to load negotiation outcomes' };
    }
  },

  createOutcome: async (jobId, payload) => {
    try {
      const response = await api.post(`/jobs/${jobId}/salary-negotiation/outcomes/`, payload);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to log negotiation outcome' };
    }
  },

  deleteOutcome: async (jobId, outcomeId) => {
    try {
      const response = await api.delete(`/jobs/${jobId}/salary-negotiation/outcomes/${outcomeId}/`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to delete negotiation outcome' };
    }
  },
};

// UC-047: AI Resume Generation API calls
export const resumeAIAPI = {
  generateForJob: async (jobId, options = {}) => {
    try {
      const response = await api.post(`/jobs/${jobId}/resume/generate`, {
        tone: options.tone,
        variation_count: options.variation_count,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to generate AI resume content' };
    }
  },
  generateExperienceVariations: async (jobId, experienceId, options = {}) => {
    try {
      const response = await api.post(`/jobs/${jobId}/resume/tailor-experience/${experienceId}`, {
        tone: options.tone,
        variation_count: options.variation_count,
        bullet_index: options.bullet_index,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to generate experience variations' };
    }
  },
  regenerateExperienceBullet: async (jobId, experienceId, options = {}) => {
    try {
      const response = await api.post(`/jobs/${jobId}/resume/tailor-experience/${experienceId}/bullet`, {
        tone: options.tone,
        bullet_index: options.bullet_index,
        variant_id: options.variant_id,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to regenerate bullet' };
    }
  },
  
  compileLatex: async (latexContent) => {
    try {
      const response = await api.post('/resume/compile-latex/', {
        latex_content: latexContent,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to compile LaTeX' };
    }
  },
};

// UC-071: Interview Scheduling API calls
export const interviewsAPI = {
  // Get all interviews with optional filters
  getInterviews: async (params = {}) => {
    try {
      const usp = new URLSearchParams();
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          usp.append(k, String(v));
        }
      });
      const path = usp.toString() ? `/interviews/?${usp.toString()}` : '/interviews/';
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch interviews' };
    }
  },

  // Get a specific interview by ID
  getInterview: async (id) => {
    try {
      const response = await api.get(`/interviews/${id}/`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch interview' };
    }
  },

  // Create a new interview
  createInterview: async (data) => {
    try {
      const response = await api.post('/interviews/', data);
      return response.data;
    } catch (error) {
      console.error('createInterview API error:', error);
      console.error('error.response:', error.response);
      console.error('error.response.data:', error.response?.data);
      console.error('error.error:', error.error);
      
      // The response interceptor transforms errors, so check both error.response.data and error.error
      // If error.error is an array, it's from the interceptor wrapping backend validation errors
      if (error.error && Array.isArray(error.error) && error.error.length > 0) {
        // Backend returns validation errors as strings in an array
        // We need to wrap it in an object so the component can display it
        const errorMessage = error.error[0];
        if (typeof errorMessage === 'string') {
          // This is likely a conflict message, so put it in scheduled_at field
          throw new Error(JSON.stringify({ scheduled_at: errorMessage }));
        }
        throw new Error(JSON.stringify(error.error[0]));
      }
      
      throw error.response?.data || error.error || { message: 'Failed to create interview' };
    }
  },

  // Update an interview (including reschedule)
  updateInterview: async (id, data) => {
    try {
      const response = await api.put(`/interviews/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error('updateInterview API error:', error);
      console.error('error.response:', error.response);
      console.error('error.response.data:', error.response?.data);
      console.error('error.error:', error.error);
      
      // The response interceptor transforms errors, so check both error.response.data and error.error
      if (error.error && Array.isArray(error.error) && error.error.length > 0) {
        const errorMessage = error.error[0];
        if (typeof errorMessage === 'string') {
          // This is likely a conflict message, so put it in scheduled_at field
          const err = new Error(errorMessage);
          err.scheduled_at = errorMessage;
          throw err;
        }
        throw new Error(JSON.stringify(error.error[0]));
      }
      
      const errData = error.response?.data || error.error || { message: 'Failed to update interview' };
      throw new Error(typeof errData === 'string' ? errData : JSON.stringify(errData));
    }
  },

  // Cancel an interview
  cancelInterview: async (id, reason = '') => {
    try {
      const response = await api.delete(`/interviews/${id}/`, {
        data: { cancelled_reason: reason }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to cancel interview' };
    }
  },

  // Delete an interview permanently
  deleteInterview: async (id) => {
    try {
      const response = await api.delete(`/interviews/${id}/`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to delete interview' };
    }
  },

  // Mark interview as completed with outcome
  completeInterview: async (id, data) => {
    try {
      const response = await api.post(`/interviews/${id}/complete/`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to complete interview' };
    }
  },

  // Dismiss a reminder (24h or 1h)
  dismissReminder: async (id, reminderType) => {
    try {
      const response = await api.post(`/interviews/${id}/dismiss-reminder/`, {
        reminder_type: reminderType // '24h' or '1h'
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to dismiss reminder' };
    }
  },

  // Get all active reminders for the user
  getActiveReminders: async () => {
    try {
      const response = await api.get('/interviews/reminders/');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch reminders' };
    }
  },

  // Toggle a preparation task completion
  togglePreparationTask: async (taskId) => {
    try {
      const response = await api.put(`/interviews/tasks/${taskId}/toggle/`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to toggle task' };
    }
  },

  // UC-081: Get comprehensive preparation checklist for an interview
  getPreparationChecklist: async (interviewId) => {
    try {
      const response = await api.get(`/interviews/${interviewId}/checklist/`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch preparation checklist' };
    }
  },

  // UC-081: Toggle a checklist item completion
  toggleChecklistItem: async (interviewId, taskData) => {
    try {
      const response = await api.post(`/interviews/${interviewId}/checklist/toggle/`, taskData);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to toggle checklist item' };
    }
  },

  // UC-085: Interview success probability forecast
  getSuccessForecast: async ({ jobId, refresh } = {}) => {
    try {
      const params = new URLSearchParams();
      if (jobId) params.append('job', jobId);
      if (refresh) params.append('refresh', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get(`/interviews/success-forecast/${query}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || error.response?.data || { message: 'Failed to load success forecast' };
    }
  },

  // UC-082: Generate interview follow-up templates
  generateFollowUp: async (data) => {
    try {
      const response = await api.post('/interviews/follow-up/generate/', data);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to generate follow-up' };
    }
  },

  // UC-080: Interview performance analytics
  getPerformanceAnalytics: async () => {
    try {
      const response = await api.get('/interviews/performance-analytics/');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to load interview analytics' };
    }
  },

  // UC-098: Interview performance tracking
  getPerformanceTracking: async () => {
    try {
      const response = await api.get('/interviews/performance-tracking/');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to load performance tracking' };
    }
  },
};

// UC-079: Calendar integrations (Google, Outlook, etc.)
export const calendarAPI = {
  getIntegrations: async () => {
    try {
      const response = await api.get('/calendar/integrations/');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load calendar integrations' };
    }
  },

  startGoogleConnect: async (payload = {}) => {
    try {
      const response = await api.post('/calendar/google/start', payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to start Google authorization' };
    }
  },

  fetchGoogleEvents: async (params = {}) => {
    try {
      const usp = new URLSearchParams();
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        usp.append(key, String(value));
      });
      const path = usp.toString() ? `/calendar/google/events?${usp.toString()}` : '/calendar/google/events';
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load Google calendar events' };
    }
  },

  disconnectGoogle: async (integrationId, reason) => {
    try {
      const payload = { integration_id: integrationId };
      if (reason) {
        payload.reason = reason;
      }
      const response = await api.post('/calendar/google/disconnect', payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to disconnect Google Calendar' };
    }
  },

  updateIntegration: async (provider, payload) => {
    try {
      const response = await api.patch(`/calendar/integrations/${provider}/`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update calendar integration' };
    }
  },
};

// UC-056: AI Cover Letter Generation API calls
export const coverLetterAIAPI = {
  generateForJob: async (jobId, options = {}) => {
    try {
      const response = await api.post(`/jobs/${jobId}/cover-letter/generate`, {
        tone: options.tone,
        variation_count: options.variation_count,
        length: options.length,
        writing_style: options.writing_style,
        company_culture: options.company_culture,
        industry: options.industry,
        custom_instructions: options.custom_instructions,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to generate AI cover letter content' };
    }
  },
  
  compileLatex: async (latexContent) => {
    try {
      const response = await api.post('/cover-letter/compile-latex/', {
        latex_content: latexContent,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to compile LaTeX' };
    }
  },
  
  // UC-061: Export cover letter as Word document
  exportDocx: async (coverLetterData) => {
    try {
      const response = await api.post('/cover-letter/export-docx/', coverLetterData, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to export Word document' };
    }
  },

  saveToDocuments: async (payload) => {
    try {
      const response = await api.post('/cover-letter/save-document/', payload);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to save cover letter to Documents' };
    }
  },
};

authAPI.getEmploymentTimeline = async () => {
  try {
    const response = await api.get('/employment/timeline');
    return response.data;
  } catch (error) {
    throw error;
  }
};

authAPI.getEmployment = async (id) => {
  try {
    const response = await api.get(`/employment/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

authAPI.createEmployment = async (employmentData) => {
  try {
    const response = await api.post('/employment', employmentData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

authAPI.updateEmployment = async (id, employmentData) => {
  try {
    const response = await api.patch(`/employment/${id}`, employmentData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

authAPI.deleteEmployment = async (id) => {
  try {
    const response = await api.delete(`/employment/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Cover Letter Template API
export const coverLetterTemplateAPI = {
  // Get all templates (shared + user's custom)
  getTemplates: async () => {
    const response = await api.get('/cover-letter-templates');
    return response.data;
  },

  // Get a specific template by ID
  getTemplate: async (id) => {
    const response = await api.get(`/cover-letter-templates/${id}`);
    return response.data;
  },

  // Create a new template
  createTemplate: async (templateData) => {
    const response = await api.post('/cover-letter-templates', templateData);
    return response.data;
  },

  // Update an existing template
  updateTemplate: async (id, templateData) => {
    const response = await api.put(`/cover-letter-templates/${id}`, templateData);
    return response.data;
  },

  // Delete a template
  deleteTemplate: async (id) => {
    await api.delete(`/cover-letter-templates/${id}`);
  },

  // Import a custom template
  importTemplate: async (templateData) => {
    // For file uploads, create a new request without the default Content-Type header
    if (templateData instanceof FormData) {
      const token = localStorage.getItem('firebaseToken');
      const response = await axios.post(
        `${API_BASE_URL}/cover-letter-templates/import`, 
        templateData,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
            // Don't set Content-Type - let browser handle it for FormData
          },
        }
      );
      return response.data;
    } else {
      // For JSON data, use the normal api instance
      const response = await api.post('/cover-letter-templates/import', templateData);
      return response.data;
    }
  },

  // Share a template (make it public)
  shareTemplate: async (id) => {
    const response = await api.post(`/cover-letter-templates/${id}/share`);
    return response.data;
  },

  // Track template usage analytics
  trackUsage: async (id) => {
    const response = await api.post(`/cover-letter-templates/${id}/analytics`);
    return response.data;
  },

  // Get comprehensive template statistics
  getStats: async () => {
    const response = await api.get('/cover-letter-templates/stats');
    return response.data;
  },

  // Download template in specified format (txt, docx, pdf)
  downloadTemplate: async (id, format = 'txt') => {
    const response = await api.get(`/cover-letter-templates/${id}/download/${format}`, {
      responseType: 'blob', // Important for file downloads
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Get filename from response headers or create default
    const contentDisposition = response.headers['content-disposition'];
    let filename = `cover-letter-template.${format}`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) filename = match[1];
    }
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    return { success: true, filename };
  },

  // Customize template styling options
  customize: async (id, customizationOptions) => {
    const response = await api.post(`/cover-letter-templates/${id}/customize`, customizationOptions);
    return response.data;
  },
};

// UC-051: Resume Export API
export const resumeExportAPI = {
  getThemes: async () => {
    try {
      const response = await api.get('/resume/export/themes');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { code: 'fetch_failed', message: 'Failed to fetch themes' };
    }
  },

  exportResume: async (format, theme = 'professional', watermark = '', filename = '') => {
    try {
      const params = new URLSearchParams({ format });
      if (theme) params.append('theme', theme);
      if (watermark) params.append('watermark', watermark);
      if (filename) params.append('filename', filename);

      const response = await api.get(`/resume/export?${params.toString()}`, {
        responseType: 'blob', // Important for file downloads
      });

      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let downloadFilename = `resume.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch && filenameMatch[1]) {
          downloadFilename = filenameMatch[1];
        }
      }

      link.setAttribute('download', downloadFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return { success: true, filename: downloadFilename };
    } catch (error) {
      // For blob responses, error.response.data is a Blob, need to parse it
      if (error.response?.data instanceof Blob) {
        const text = await error.response.data.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(JSON.stringify(errorData.error || { code: 'export_failed', message: 'Export failed' }));
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message.includes('export_failed')) throw parseErr;
          throw new Error(JSON.stringify({ code: 'export_failed', message: 'Export failed' }));
        }
      }
      const errInfo = error.error || error.response?.data?.error || { code: 'export_failed', message: 'Export failed' };
      throw new Error(typeof errInfo === 'string' ? errInfo : JSON.stringify(errInfo));
    }
  },

  // Export AI-generated resume with custom options
  exportAIResume: async (latexContent, format, theme = 'professional', watermark = '', filename = '', profileData = null) => {
    try {
      const response = await api.post('/resume/export/ai', {
        latex_content: latexContent,
        format,
        theme,
        watermark,
        filename,
        profile_data: profileData
      }, {
        responseType: 'blob', // Important for file downloads
      });

      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let downloadFilename = `resume.${format}`;
      if (contentDisposition) {
        // Try multiple patterns to extract filename
        const patterns = [
          /filename\*=UTF-8''([^;]+)/,  // RFC 5987 format
          /filename="([^"]+)"/,           // Quoted filename
          /filename=([^;]+)/              // Unquoted filename
        ];
        
        for (const pattern of patterns) {
          const match = contentDisposition.match(pattern);
          if (match && match[1]) {
            downloadFilename = decodeURIComponent(match[1].trim());
            break;
          }
        }
      }

      link.setAttribute('download', downloadFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return { success: true, filename: downloadFilename };
    } catch (error) {
      // For blob responses, error.response.data is a Blob, need to parse it
      if (error.response?.data instanceof Blob) {
        const text = await error.response.data.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(JSON.stringify(errorData.error || { code: 'export_failed', message: 'Export failed' }));
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message.includes('export_failed')) throw parseErr;
          throw new Error(JSON.stringify({ code: 'export_failed', message: 'Export failed' }));
        }
      }
      const errInfo = error.error || error.response?.data?.error || { code: 'export_failed', message: 'Export failed' };
      throw new Error(typeof errInfo === 'string' ? errInfo : JSON.stringify(errInfo));
    }
  },
};

// UC-061: Cover Letter Export API
export const coverLetterExportAPI = {
  getThemes: async () => {
    try {
      const response = await api.get('/cover-letter/export/themes');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { code: 'fetch_failed', message: 'Failed to fetch themes' };
    }
  },

  // Export AI-generated cover letter with custom options
  exportAICoverLetter: async (latexContent, format, theme = 'professional', watermark = '', filename = '', profileData = null, jobData = null) => {
    try {
      const response = await api.post('/cover-letter/export/ai', {
        latex_content: latexContent,
        format,
        theme,
        watermark,
        filename,
        profile_data: profileData,
        job_data: jobData
      }, {
        responseType: 'blob', // Important for file downloads
      });

      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let downloadFilename = `cover_letter.${format}`;
      if (contentDisposition) {
        // Try multiple patterns to extract filename
        const patterns = [
          /filename\*=UTF-8''([^;]+)/,  // RFC 5987 format
          /filename="([^"]+)"/,           // Quoted filename
          /filename=([^;]+)/              // Unquoted filename
        ];
        
        for (const pattern of patterns) {
          const match = contentDisposition.match(pattern);
          if (match && match[1]) {
            downloadFilename = decodeURIComponent(match[1].trim());
            break;
          }
        }
      }

      link.setAttribute('download', downloadFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return { success: true, filename: downloadFilename };
    } catch (error) {
      // For blob responses, error.response.data is a Blob, need to parse it
      if (error.response?.data instanceof Blob) {
        const text = await error.response.data.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(JSON.stringify(errorData.error || { code: 'export_failed', message: 'Export failed' }));
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message.includes('export_failed')) throw parseErr;
          throw new Error(JSON.stringify({ code: 'export_failed', message: 'Export failed' }));
        }
      }
      const errInfo = error.error || error.response?.data?.error || { code: 'export_failed', message: 'Export failed' };
      throw new Error(typeof errInfo === 'string' ? errInfo : JSON.stringify(errInfo));
    }
  },
};

// Application follow-up reminders (UC-124 intelligent reminders)
export const followupAPI = {
  getPlaybook: async ({ jobId, stage }) => {
    try {
      const params = stage ? `?stage=${encodeURIComponent(stage)}` : '';
      const response = await api.get(`/reminders/playbook/${jobId}/${params}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.response?.data?.error || { message: 'Failed to load follow-up suggestion' };
    }
  },

  createFromPlaybook: async ({ jobId, stage }) => {
    try {
      const response = await api.post(`/reminders/playbook/${jobId}/`, stage ? { stage } : {});
      return response.data;
    } catch (error) {
      throw error.response?.data || error.response?.data?.error || { message: 'Failed to schedule follow-up' };
    }
  },

  list: async () => {
    try {
      const response = await api.get('/reminders/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.response?.data?.error || { message: 'Failed to fetch reminders' };
    }
  },

  snooze: async (id, payload) => {
    try {
      const response = await api.post(`/reminders/${id}/snooze/`, payload || {});
      return response.data;
    } catch (error) {
      throw error.response?.data || error.response?.data?.error || { message: 'Failed to snooze reminder' };
    }
  },

  dismiss: async (id) => {
    try {
      const response = await api.post(`/reminders/${id}/dismiss/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.response?.data?.error || { message: 'Failed to dismiss reminder' };
    }
  },

  complete: async (id, payload) => {
    try {
      const response = await api.post(`/reminders/${id}/complete/`, payload || {});
      return response.data;
    } catch (error) {
      throw error.response?.data || error.response?.data?.error || { message: 'Failed to complete reminder' };
    }
  },
};

// UC-114: GitHub Integration API (define before default export to avoid TDZ)
export const githubAPI = {
  connect: async (includePrivate = false) => {
    // Use authenticated request so Authorization header is sent, then follow redirect/URL
    const usp = new URLSearchParams();
    if (includePrivate) usp.append('include_private', 'true');
    const path = usp.toString() ? `/github/connect/?${usp.toString()}` : '/github/connect/';
    try {
      const response = await api.get(path, { maxRedirects: 0, headers: { Accept: 'application/json' } });
      const redirectUrl = response.data?.authorize_url || response.headers?.location || `${API_BASE_URL}${path}`;
      window.location.href = redirectUrl;
    } catch (error) {
      // If server responds with 302, axios may treat as error when maxRedirects: 0
      const loc = error?.response?.headers?.location;
      const fallback = `${API_BASE_URL}${path}`;
      window.location.href = loc || fallback;
    }
  },
  disconnect: async () => {
    try {
      const response = await api.delete('/github/disconnect/');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to disconnect GitHub' };
    }
  },

  listRepos: async (refresh = false) => {
    try {
      const usp = new URLSearchParams();
      if (refresh) usp.append('refresh', 'true');
      const path = usp.toString() ? `/github/repos/?${usp.toString()}` : '/github/repos/';
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load GitHub repositories' };
    }
  },

  getFeatured: async () => {
    try {
      const response = await api.get('/github/featured/');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load featured repositories' };
    }
  },

  setFeatured: async (repoIds = []) => {
    try {
      const response = await api.post('/github/featured/', { featured_repo_ids: repoIds });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update featured repositories' };
    }
  },

  contribSummary: async () => {
    try {
      const response = await api.get('/github/contrib/summary/');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load contributions summary' };
    }
  },

  totalCommits: async (fromIso, toIso) => {
    try {
      const params = new URLSearchParams();
      if (fromIso) params.append('from', fromIso);
      if (toIso) params.append('to', toIso);
      const path = params.toString() ? `/github/contrib/commits/?${params.toString()}` : '/github/contrib/commits/';
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load total commits' };
    }
  },

  commitsByRepo: async (fromIso, toIso) => {
    try {
      const params = new URLSearchParams();
      if (fromIso) params.append('from', fromIso);
      if (toIso) params.append('to', toIso);
      const path = params.toString() ? `/github/contrib/commits-by-repo/?${params.toString()}` : '/github/contrib/commits-by-repo/';
      const response = await api.get(path);
      return response.data; // { repos: [{ full_name, commits }], total_commits }
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load commits by repo' };
    }
  },
};

// Provide a forgiving default export that supports both
// - `import authAPI from './services/api'` (legacy/default import)
// - `import { authAPI } from './services/api'` (named import)
// and also exposes other API groups as properties for callers that expect `api.authAPI`.
const _defaultExport = {
  // Expose the raw axios instance under a stable key to avoid property collisions
  http: api,
  // include grouped namespaces as properties
  authAPI,
  // Legacy convenience aliases expected by tests and older code
  getBasicProfile: (...args) => authAPI.getBasicProfile(...args),
  updateBasicProfile: (...args) => authAPI.updateBasicProfile(...args),
  profileAPI,
  skillsAPI,
  educationAPI,
  certificationsAPI,
  projectsAPI,
  jobsAPI,
  coverLetterTemplateAPI,
  materialsAPI,
  resumeAIAPI,
  resumeExportAPI,
  coverLetterExportAPI,
  interviewsAPI,
  calendarAPI,
  githubAPI,
};

export default _defaultExport;


// UC-052: Resume Version Management API calls
export const resumeVersionAPI = {
  // List all resume versions
  listVersions: async (includeArchived = false) => {
    try {
      const response = await api.get('/resume-versions/', {
        params: { include_archived: includeArchived }
      });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch resume versions' };
    }
  },

  // Get a specific version
  getVersion: async (versionId) => {
    try {
      const response = await api.get(`/resume-versions/${versionId}/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch resume version' };
    }
  },

  // Create a new version
  createVersion: async (versionData) => {
    try {
      const response = await api.post('/resume-versions/', versionData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to create resume version' };
    }
  },

  // Update a version
  updateVersion: async (versionId, versionData) => {
    try {
      const response = await api.put(`/resume-versions/${versionId}/`, versionData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update resume version' };
    }
  },

  // Delete a version
  deleteVersion: async (versionId) => {
    try {
      const response = await api.delete(`/resume-versions/${versionId}/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete resume version' };
    }
  },

  // Set as default version
  setDefault: async (versionId) => {
    try {
      const response = await api.post(`/resume-versions/${versionId}/set-default/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to set default version' };
    }
  },

  // Archive a version
  archiveVersion: async (versionId) => {
    try {
      const response = await api.post(`/resume-versions/${versionId}/archive/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to archive version' };
    }
  },

  // Restore an archived version
  restoreVersion: async (versionId) => {
    try {
      const response = await api.post(`/resume-versions/${versionId}/restore/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to restore version' };
    }
  },

  // Duplicate a version
  duplicateVersion: async (versionId, newVersionName) => {
    try {
      const response = await api.post(`/resume-versions/${versionId}/duplicate/`, {
        new_version_name: newVersionName
      });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to duplicate version' };
    }
  },

  // Compare two versions
  compareVersions: async (version1Id, version2Id) => {
    try {
      const response = await api.post('/resume-versions/compare/', {
        version1_id: version1Id,
        version2_id: version2Id
      });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to compare versions' };
    }
  },

  // Merge versions
  mergeVersions: async (sourceVersionId, targetVersionId, mergeFields = [], createNew = false, newVersionName = null) => {
    try {
      const response = await api.post('/resume-versions/merge/', {
        source_version_id: sourceVersionId,
        target_version_id: targetVersionId,
        merge_fields: mergeFields,
        create_new: createNew,
        new_version_name: newVersionName
      });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to merge versions' };
    }
  },

  // Get version history
  getVersionHistory: async (versionId) => {
    try {
      const response = await api.get(`/resume-versions/${versionId}/history/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch version history' };
    }
  }
};

// ESM-only: no CommonJS interop here to avoid init-order issues



// Default export: axios instance used across services
// Also export the raw axios instance for callers that need it (named export)
// Avoid named export of axios instance to reduce init-order issues

// UC-052: Resume Sharing and Feedback API calls
export const resumeSharingAPI = {
  // List all shares for user's resumes
  listShares: async () => {
    try {
      const response = await api.get('/resume-shares/');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch resume shares' };
    }
  },

  // Create a new share link
  createShare: async (shareData) => {
    try {
      const response = await api.post('/resume-shares/', shareData);
      console.log('API Response:', response);
      console.log('API Response Data:', response.data);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to create share link' };
    }
  },

  // Get share details
  getShare: async (shareId) => {
    try {
      const response = await api.get(`/resume-shares/${shareId}/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch share details' };
    }
  },

  // Update share settings
  updateShare: async (shareId, shareData) => {
    try {
      const response = await api.put(`/resume-shares/${shareId}/`, shareData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update share' };
    }
  },

  // Delete share
  deleteShare: async (shareId) => {
    try {
      const response = await api.delete(`/resume-shares/${shareId}/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete share' };
    }
  },

  // List shares available to the logged-in reviewer
  listReviewerShares: async () => {
    try {
      const response = await api.get('/resume-shares/reviewer/');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch shared resumes' };
    }
  },

  getReviewerStats: async () => {
    try {
      const response = await api.get('/resume-shares/reviewer/stats/');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch reviewer stats' };
    }
  },

  // View shared resume (public endpoint)
  viewSharedResume: async (shareToken, accessData = {}) => {
    try {
      console.log('Sending access data:', accessData); // Debug log
      console.log('Share token:', shareToken); // Debug log
      console.log('Request URL:', `/shared-resume/${shareToken}/`); // Debug log
      const response = await api.post(`/shared-resume/${shareToken}/`, accessData);
      console.log('Success response:', response.data); // Debug log
      return response.data;
    } catch (error) {
      console.log('Full error object:', error); // Debug log
      console.log('Error response:', error.response); // Debug log
      console.log('Error response status:', error.response?.status); // Debug log
      console.log('Error response data:', error.response?.data); // Debug log
      console.log('Error message:', error.message); // Debug log
      
      // Pass through the response data which contains requires_password, requires_reviewer_info flags
      const errorData = error.response?.data || {};
      const errObj = new Error(errorData.error || error.message || 'Failed to access shared resume');
      errObj.status = error.response?.status;
      errObj.requires_password = errorData.requires_password || false;
      errObj.requires_reviewer_info = errorData.requires_reviewer_info || false;
      errObj.requires_email = errorData.requires_email || false;
      Object.assign(errObj, errorData);
      throw errObj;
    }
  },
  // Download PDF for shared resume (with auth context)
  previewSharePdf: async (shareToken, accessData = {}) => {
    try {
      const response = await api.get(`/shared-resume/${shareToken}/pdf/`, {
        params: accessData,
        responseType: 'arraybuffer',
      });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load shared PDF' };
    }
  },
  // Update shared resume (if editing is enabled on the share)
  editSharedResume: async (shareToken, data) => {
    try {
      const response = await api.put(`/shared-resume/${shareToken}/`, data);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update shared resume' };
    }
  },
};

export const feedbackAPI = {
  // List all feedback for user's resumes
  listFeedback: async (filters = {}) => {
    try {
      const response = await api.get('/feedback/', { params: filters });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch feedback' };
    }
  },

  // Create feedback (public endpoint)
  createFeedback: async (feedbackData) => {
    try {
      const response = await api.post('/feedback/create/', feedbackData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to submit feedback' };
    }
  },

  // Get feedback details
  getFeedback: async (feedbackId) => {
    try {
      const response = await api.get(`/feedback/${feedbackId}/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch feedback details' };
    }
  },

  // Update feedback status
  updateFeedback: async (feedbackId, updates) => {
    try {
      const response = await api.put(`/feedback/${feedbackId}/`, updates);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update feedback' };
    }
  },

  // Delete feedback
  deleteFeedback: async (feedbackId) => {
    try {
      const response = await api.delete(`/feedback/${feedbackId}/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete feedback' };
    }
  },

  // Mark feedback as resolved
  resolveFeedback: async (feedbackId, resolutionNotes = '', incorporatedVersionId = null) => {
    try {
      const response = await api.put(`/feedback/${feedbackId}/`, {
        is_resolved: true,
        resolution_notes: resolutionNotes,
        incorporated_in_version_id: incorporatedVersionId
      });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to resolve feedback' };
    }
  },

  // Export feedback summary
  exportFeedbackSummary: async (versionId, options = {}) => {
    try {
      const response = await api.post('/feedback/export/', {
        resume_version_id: versionId,
        include_resolved: options.includeResolved !== false,
        include_comments: options.includeComments !== false,
        format: options.format || 'json'
      });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to export feedback' };
    }
  },
};

export const commentAPI = {
  // Create a comment on feedback
  createComment: async (commentData) => {
    try {
      const response = await api.post('/comments/create/', commentData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to post comment' };
    }
  },

  // Update comment (resolve/unresolve)
  updateComment: async (commentId, updates) => {
    try {
      const response = await api.put(`/comments/${commentId}/`, updates);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update comment' };
    }
  },

  // Delete comment
  deleteComment: async (commentId) => {
    try {
      const response = await api.delete(`/comments/${commentId}/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete comment' };
    }
  },

  // Resolve a comment
  resolveComment: async (commentId) => {
    try {
      const response = await api.put(`/comments/${commentId}/`, {
        is_resolved: true
      });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to resolve comment' };
    }
  },
};

export const notificationAPI = {
  // Get feedback notifications
  getFeedbackNotifications: async (filters = {}) => {
    try {
      const response = await api.get('/feedback-notifications/', { params: filters });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch notifications' };
    }
  },

  // Mark notification as read
  markNotificationRead: async (notificationId) => {
    try {
      const response = await api.put(`/feedback-notifications/${notificationId}/read/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to mark notification as read' };
    }
  },
};

// =====================
// UC-088: Networking Event Management API
// =====================

export const networkingAPI = {
  // Events
  getEvents: async (filters = {}) => {
    try {
      const response = await api.get('/networking-events', { params: filters });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch networking events' };
    }
  },

  getEvent: async (eventId) => {
    try {
      const response = await api.get(`/networking-events/${eventId}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch event details' };
    }
  },

  createEvent: async (eventData) => {
    try {
      const response = await api.post('/networking-events', eventData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to create networking event' };
    }
  },

  updateEvent: async (eventId, eventData) => {
    try {
      const response = await api.patch(`/networking-events/${eventId}`, eventData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update event' };
    }
  },

  deleteEvent: async (eventId) => {
    try {
      await api.delete(`/networking-events/${eventId}`);
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete event' };
    }
  },

  // Goals
  getGoals: async (eventId) => {
    try {
      const response = await api.get(`/networking-events/${eventId}/goals`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch goals' };
    }
  },

  createGoal: async (eventId, goalData) => {
    try {
      const response = await api.post(`/networking-events/${eventId}/goals`, goalData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to create goal' };
    }
  },

  updateGoal: async (eventId, goalId, goalData) => {
    try {
      const response = await api.patch(`/networking-events/${eventId}/goals/${goalId}`, goalData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update goal' };
    }
  },

  deleteGoal: async (eventId, goalId) => {
    try {
      await api.delete(`/networking-events/${eventId}/goals/${goalId}`);
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete goal' };
    }
  },

  // Connections
  getConnections: async (eventId) => {
    try {
      const response = await api.get(`/networking-events/${eventId}/connections`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch connections' };
    }
  },

  createConnection: async (eventId, connectionData) => {
    try {
      const response = await api.post(`/networking-events/${eventId}/connections`, connectionData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to add connection' };
    }
  },

  updateConnection: async (eventId, connectionId, connectionData) => {
    try {
      const response = await api.patch(`/networking-events/${eventId}/connections/${connectionId}`, connectionData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update connection' };
    }
  },

  deleteConnection: async (eventId, connectionId) => {
    try {
      await api.delete(`/networking-events/${eventId}/connections/${connectionId}`);
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete connection' };
    }
  },

  // Follow-ups
  getFollowUps: async (eventId) => {
    try {
      const response = await api.get(`/networking-events/${eventId}/follow-ups`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch follow-ups' };
    }
  },

  createFollowUp: async (eventId, followUpData) => {
    try {
      const response = await api.post(`/networking-events/${eventId}/follow-ups`, followUpData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to create follow-up' };
    }
  },

  updateFollowUp: async (eventId, followUpId, followUpData) => {
    try {
      const response = await api.patch(`/networking-events/${eventId}/follow-ups/${followUpId}`, followUpData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update follow-up' };
    }
  },

  deleteFollowUp: async (eventId, followUpId) => {
    try {
      await api.delete(`/networking-events/${eventId}/follow-ups/${followUpId}`);
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete follow-up' };
    }
  },

  completeFollowUp: async (eventId, followUpId) => {
    try {
      const response = await api.post(`/networking-events/${eventId}/follow-ups/${followUpId}/complete`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to complete follow-up' };
    }
  },

  // Analytics
  getAnalytics: async () => {
    try {
      const response = await api.get('/networking-events/analytics');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch analytics' };
    }
  },
};

// UC-090: Informational Interview Management API
export const informationalInterviewsAPI = {
  // List and filter informational interviews
  getInterviews: async (filters = {}) => {
    try {
      const response = await api.get('/informational-interviews', { params: filters });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch informational interviews' };
    }
  },

  // Get specific interview
  getInterview: async (id) => {
    try {
      const response = await api.get(`/informational-interviews/${id}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch interview details' };
    }
  },

  // Create new interview
  createInterview: async (interviewData) => {
    try {
      const response = await api.post('/informational-interviews', interviewData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to create informational interview' };
    }
  },

  // Update interview
  updateInterview: async (id, interviewData) => {
    try {
      const response = await api.patch(`/informational-interviews/${id}`, interviewData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update interview' };
    }
  },

  // Delete interview
  deleteInterview: async (id) => {
    try {
      await api.delete(`/informational-interviews/${id}`);
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete interview' };
    }
  },

  // Mark outreach as sent
  markOutreachSent: async (id) => {
    try {
      const response = await api.post(`/informational-interviews/${id}/mark-outreach-sent`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to mark outreach as sent' };
    }
  },

  // Mark as scheduled
  markScheduled: async (id, scheduledAt) => {
    try {
      const response = await api.post(`/informational-interviews/${id}/mark-scheduled`, {
        scheduled_at: scheduledAt
      });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to mark interview as scheduled' };
    }
  },

  // Mark as completed
  markCompleted: async (id, outcome) => {
    try {
      const response = await api.post(`/informational-interviews/${id}/mark-completed`, {
        outcome
      });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to mark interview as completed' };
    }
  },

  // Generate outreach message template
  generateOutreach: async (id, style = 'professional') => {
    try {
      const response = await api.post(`/informational-interviews/${id}/generate-outreach`, {
        style
      });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to generate outreach template' };
    }
  },

  // Generate preparation framework
  generatePreparation: async (id) => {
    try {
      const response = await api.post(`/informational-interviews/${id}/generate-preparation`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to generate preparation framework' };
    }
  },

  // Get analytics
  getAnalytics: async () => {
    try {
      const response = await api.get('/informational-interviews/analytics');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch analytics' };
    }
  },
};

export const mentorshipAPI = {
  getRequests: async () => {
    try {
      const response = await api.get('/mentorship/requests');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to load mentorship requests' };
    }
  },

  getRelationships: async () => {
    try {
      const response = await api.get('/mentorship/relationships');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to load mentorship relationships' };
    }
  },

  sendRequest: async (payload) => {
    try {
      const response = await api.post('/mentorship/requests', payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to send mentorship request' };
    }
  },

  respondToRequest: async (requestId, action) => {
    try {
      const response = await api.post(`/mentorship/requests/${requestId}/respond`, { action });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to update mentorship request' };
    }
  },

  cancelRequest: async (requestId) => {
    try {
      const response = await api.post(`/mentorship/requests/${requestId}/cancel`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to cancel mentorship request' };
    }
  },

  getShareSettings: async (teamMemberId) => {
    try {
      const response = await api.get(`/mentorship/relationships/${teamMemberId}/sharing`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to load sharing settings' };
    }
  },

  updateShareSettings: async (teamMemberId, payload) => {
    try {
      const response = await api.put(`/mentorship/relationships/${teamMemberId}/sharing`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to update sharing settings' };
    }
  },

  getSharedData: async (teamMemberId) => {
    try {
      const response = await api.get(`/mentorship/relationships/${teamMemberId}/shared-data`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to load shared data' };
    }
  },

  getGoals: async (teamMemberId) => {
    try {
      const response = await api.get(`/mentorship/relationships/${teamMemberId}/goals`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to load mentorship goals' };
    }
  },

  createGoal: async (teamMemberId, payload) => {
    try {
      const response = await api.post(`/mentorship/relationships/${teamMemberId}/goals`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to create mentorship goal' };
    }
  },

  updateGoal: async (goalId, payload) => {
    try {
      const response = await api.patch(`/mentorship/goals/${goalId}`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to update mentorship goal' };
    }
  },

  deleteGoal: async (goalId) => {
    try {
      await api.delete(`/mentorship/goals/${goalId}`);
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to delete mentorship goal' };
    }
  },

  getProgressReport: async (teamMemberId, params = {}) => {
    try {
      const search = new URLSearchParams(params).toString();
      const path = search
        ? `/mentorship/relationships/${teamMemberId}/progress-report?${search}`
        : `/mentorship/relationships/${teamMemberId}/progress-report`;
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to load progress report' };
    }
  },

  getAnalytics: async (teamMemberId) => {
    try {
      const response = await api.get(`/mentorship/relationships/${teamMemberId}/analytics`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to load mentee analytics' };
    }
  },

  getMessages: async (teamMemberId, params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      const url = query
        ? `/mentorship/relationships/${teamMemberId}/messages?${query}`
        : `/mentorship/relationships/${teamMemberId}/messages`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to load messages' };
    }
  },

  sendMessage: async (teamMemberId, payload) => {
    try {
      const response = await api.post(`/mentorship/relationships/${teamMemberId}/messages`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to send message' };
    }
  },
};

// (moved earlier)

export const supportersAPI = {
  listInvites: () => api.get('/supporters').then((res) => res.data),
  createInvite: (payload) => api.post('/supporters', payload).then((res) => res.data),
  updateInvite: (inviteId, payload) => api.patch(`/supporters/${inviteId}`, payload).then((res) => res.data),
  deleteInvite: (inviteId) => api.delete(`/supporters/${inviteId}`).then((res) => res.data),
  fetchDashboard: (token, params = {}) =>
    api.get('/supporters/dashboard', { params: { token, ...params } }).then((res) => res.data),
  sendEncouragement: (token, payload) =>
    api.post('/supporters/encouragements', { token, ...payload }).then((res) => res.data),
  listEncouragements: () => api.get('/supporters/encouragements/list').then((res) => res.data),
  fetchChat: (token) => api.get('/supporters/chat', { params: { token } }).then((res) => res.data),
  sendChat: (token, payload) => api.post('/supporters/chat', { token, ...payload }).then((res) => res.data),
  candidateChat: () => api.get('/supporters/chat/candidate').then((res) => res.data),
  candidateSendChat: (payload) => api.post('/supporters/chat/candidate', payload).then((res) => res.data),
  getMood: () => api.get('/supporters/mood').then((res) => res.data),
  updateMood: (payload) => api.patch('/supporters/mood', payload).then((res) => res.data),
};

// UC-095: Referral / Reference requests API
export const referralAPI = {
  list: async (params = {}) => {
    try {
      const usp = new URLSearchParams();
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return;
        usp.append(k, v);
      });
      const path = usp.toString() ? `/referrals?${usp.toString()}` : '/referrals';
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch referrals' };
    }
  },

  getAnalytics: async () => {
    try {
      const response = await api.get('/referrals/analytics');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch referral analytics' };
    }
  },

  create: async (payload) => {
    try {
      const response = await api.post('/referrals', payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to create referral' };
    }
  },

  update: async (id, payload) => {
    try {
      const response = await api.patch(`/referrals/${id}`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update referral' };
    }
  },

  remove: async (id) => {
    try {
      const response = await api.delete(`/referrals/${id}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete referral' };
    }
  },

  generateMessage: async (payload) => {
    try {
      const response = await api.post('/referrals/generate-message', payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to generate referral message' };
    }
  },

  markSent: async (id) => {
    try {
      const response = await api.post(`/referrals/${id}/mark-sent`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to mark referral as sent' };
    }
  },

  markResponse: async (id, payload) => {
    try {
      const response = await api.post(`/referrals/${id}/response`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to record referral response' };
    }
  },

  markCompleted: async (id) => {
    try {
      const response = await api.post(`/referrals/${id}/complete`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to mark referral completed' };
    }
  },

  unmarkCompleted: async (id) => {
    try {
      const response = await api.post(`/referrals/${id}/uncomplete`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to unmark referral completed' };
    }
  },

  expressGratitude: async (id, payload = {}) => {
    try {
      const response = await api.post(`/referrals/${id}/express-gratitude`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to record gratitude' };
    }
  },

  suggestFollowUp: async (id) => {
    try {
      const response = await api.get(`/referrals/${id}/suggest-follow-up`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to suggest follow-up' };
    }
  },

  updateOutcome: async (id, payload) => {
    try {
      const response = await api.post(`/referrals/${id}/outcome`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update outcome' };
    }
  },
};

// UC-101: Career Goals API
export const goalsAPI = {
  // Goals CRUD
  getGoals: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.goal_type) params.append('goal_type', filters.goal_type);
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get(`/career-goals/${query}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch goals' };
    }
  },

  getGoal: async (goalId) => {
    try {
      const response = await api.get(`/career-goals/${goalId}/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch goal details' };
    }
  },

  createGoal: async (goalData) => {
    try {
      const response = await api.post('/career-goals/', goalData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to create goal' };
    }
  },

  updateGoal: async (goalId, goalData) => {
    try {
      const response = await api.patch(`/career-goals/${goalId}/`, goalData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update goal' };
    }
  },

  deleteGoal: async (goalId) => {
    try {
      await api.delete(`/career-goals/${goalId}/`);
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete goal' };
    }
  },

  // Progress tracking
  updateProgress: async (goalId, currentValue) => {
    try {
      const response = await api.post(`/career-goals/${goalId}/update-progress/`, {
        current_value: currentValue,
      });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update progress' };
    }
  },

  completeGoal: async (goalId) => {
    try {
      const response = await api.post(`/career-goals/${goalId}/complete/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to complete goal' };
    }
  },

  // Milestones
  getMilestones: async (goalId) => {
    try {
      const response = await api.get(`/career-goals/${goalId}/milestones/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch milestones' };
    }
  },

  createMilestone: async (goalId, milestoneData) => {
    try {
      const response = await api.post(`/career-goals/${goalId}/milestones/`, milestoneData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to create milestone' };
    }
  },

  updateMilestone: async (goalId, milestoneId, milestoneData) => {
    try {
      const response = await api.patch(`/career-goals/${goalId}/milestones/${milestoneId}/`, milestoneData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update milestone' };
    }
  },

  deleteMilestone: async (goalId, milestoneId) => {
    try {
      await api.delete(`/career-goals/${goalId}/milestones/${milestoneId}/`);
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete milestone' };
    }
  },

  completeMilestone: async (goalId, milestoneId) => {
    try {
      const response = await api.post(`/career-goals/${goalId}/milestones/${milestoneId}/complete/`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to complete milestone' };
    }
  },

  // Analytics
  getAnalytics: async () => {
    try {
      const response = await api.get('/career-goals/analytics/');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch analytics' };
    }
  },
};

// UC-077: Mock Interview API
export const mockInterviewAPI = {
  // Start a new mock interview session
  startSession: async (sessionData) => {
    try {
      const response = await api.post('/mock-interviews/start', sessionData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to start mock interview' };
    }
  },

  // Submit an answer to a question
  submitAnswer: async (answerData) => {
    try {
      const response = await api.post('/mock-interviews/answer', answerData);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to submit answer' };
    }
  },

  // Complete a mock interview session
  completeSession: async (sessionId) => {
    try {
      const response = await api.post('/mock-interviews/complete', { session_id: sessionId });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to complete interview' };
    }
  },

  // List all mock interview sessions
  listSessions: async (params = {}) => {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `/mock-interviews?${queryString}` : '/mock-interviews';
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch sessions' };
    }
  },

  // Get details of a specific session
  getSession: async (sessionId) => {
    try {
      const response = await api.get(`/mock-interviews/${sessionId}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to fetch session' };
    }
  },

  // Get summary of a completed session
  getSummary: async (sessionId) => {
    try {
      const response = await api.get(`/mock-interviews/${sessionId}/summary`);
      return response.data;
    } catch (error) {
      const errorData = error.error || error.response?.data?.error || { message: 'Failed to fetch summary' };
      if (error.response?.status === 404) {
        errorData.code = 'not_found';
      }
      throw errorData;
    }
  },

  // Delete a mock interview session
  deleteSession: async (sessionId) => {
    try {
      const response = await api.delete(`/mock-interviews/${sessionId}/delete`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete session' };
    }
  },
};

// LinkedIn Integration API (UC-089)
export const linkedInAPI = {
  // OAuth flow
  initiateOAuth: async () => {
    try {
      const response = await api.get('/auth/oauth/linkedin/initiate');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to initiate LinkedIn OAuth' };
    }
  },

  completeOAuth: async (code, state) => {
    try {
      const response = await api.post('/auth/oauth/linkedin/callback', { code, state });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to complete LinkedIn OAuth' };
    }
  },

  // Integration status
  getIntegrationStatus: async () => {
    try {
      const response = await api.get('/linkedin/integration-status');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to get integration status' };
    }
  },

  // Profile optimization
  getProfileOptimization: async () => {
    try {
      const response = await api.post('/linkedin/profile-optimization');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to get profile optimization' };
    }
  },

  // Networking message generation
  generateNetworkingMessage: async (params) => {
    try {
      const response = await api.post('/linkedin/networking-message', params);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to generate message' };
    }
  },

  // Content strategy
  getContentStrategy: async () => {
    try {
      const response = await api.get('/linkedin/content-strategy');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data || { message: 'Failed to get content strategy' };
    }
  },
};

// Team accounts & collaboration
export const teamAPI = {
  listAccounts: async () => {
    try {
      const response = await api.get('/team/accounts');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load team accounts' };
    }
  },
  createAccount: async (payload) => {
    try {
      const response = await api.post('/team/accounts', payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Unable to create team' };
    }
  },
  getAccount: async (teamId) => {
    try {
      const response = await api.get(`/team/accounts/${teamId}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load team details' };
    }
  },
  updateSubscription: async (teamId, payload) => {
    try {
      const response = await api.patch(`/team/accounts/${teamId}/subscription`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update subscription' };
    }
  },
  listInvitations: async (teamId) => {
    try {
      const response = await api.get(`/team/accounts/${teamId}/invites`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load invites' };
    }
  },
  inviteMember: async (teamId, payload) => {
    try {
      const response = await api.post(`/team/accounts/${teamId}/invites`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to send invite' };
    }
  },
  acceptInvite: async (token) => {
    try {
      const response = await api.post(`/team/invites/${token}/accept`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to accept invite' };
    }
  },
  updateMember: async (membershipId, payload) => {
    try {
      const response = await api.patch(`/team/memberships/${membershipId}`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update member' };
    }
  },
  listAccess: async (teamId) => {
    try {
      const response = await api.get(`/team/accounts/${teamId}/access`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load access controls' };
    }
  },
  upsertAccess: async (teamId, payload) => {
    try {
      const response = await api.post(`/team/accounts/${teamId}/access`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to update access' };
    }
  },
  getDashboard: async (teamId) => {
    try {
      const response = await api.get(`/team/accounts/${teamId}/dashboard`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load dashboard' };
    }
  },
  getReports: async (teamId) => {
    try {
      const response = await api.get(`/team/accounts/${teamId}/reports`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load reports' };
    }
  },
  listMessages: async (teamId) => {
    try {
      const response = await api.get(`/team/accounts/${teamId}/messages`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load team messages' };
    }
  },
  postMessage: async (teamId, payload) => {
    try {
      const response = await api.post(`/team/accounts/${teamId}/messages`, payload);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to send message' };
    }
  },
  getMyPendingInvites: async () => {
    try {
      const response = await api.get('/team/my-invites');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load pending invitations' };
    }
  },
  // Shared Jobs
  getMyShareableJobs: async () => {
    try {
      const response = await api.get('/team/my-shareable-jobs');
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load your jobs' };
    }
  },
  listSharedJobs: async (teamId) => {
    try {
      const response = await api.get(`/team/accounts/${teamId}/shared-jobs`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load shared jobs' };
    }
  },
  shareJob: async (teamId, payload) => {
    try {
      const response = await api.post(`/team/accounts/${teamId}/share-job`, payload);
      return response.data;
    } catch (error) {
      const errMsg = error.response?.data?.error || 'Failed to share job';
      throw new Error(errMsg);
    }
  },
  unshareJob: async (teamId, sharedJobId) => {
    try {
      const response = await api.delete(`/team/accounts/${teamId}/shared-jobs/${sharedJobId}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to unshare job' };
    }
  },
  listSharedJobComments: async (teamId, sharedJobId) => {
    try {
      const response = await api.get(`/team/accounts/${teamId}/shared-jobs/${sharedJobId}/comments`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to load comments' };
    }
  },
  addSharedJobComment: async (teamId, sharedJobId, content) => {
    try {
      const response = await api.post(`/team/accounts/${teamId}/shared-jobs/${sharedJobId}/comments`, { content });
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to add comment' };
    }
  },
  deleteSharedJobComment: async (teamId, sharedJobId, commentId) => {
    try {
      const response = await api.delete(`/team/accounts/${teamId}/shared-jobs/${sharedJobId}/comments/${commentId}`);
      return response.data;
    } catch (error) {
      throw error.error || error.response?.data?.error || { message: 'Failed to delete comment' };
    }
  },
};

// UC-128: Career Growth Calculator API
export const careerGrowthAPI = {
  getScenarios: () => api.get('/career-growth/scenarios/'),
  getScenario: (scenarioId) => api.get(`/career-growth/scenarios/${scenarioId}/`),
  createScenario: (data) => api.post('/career-growth/scenarios/', data),
  updateScenario: (scenarioId, data) => api.put(`/career-growth/scenarios/${scenarioId}/`, data),
  deleteScenario: (scenarioId) => api.delete(`/career-growth/scenarios/${scenarioId}/`),
  calculateProjection: (data) => api.post('/career-growth/calculate/', data),
  compareScenarios: (scenarioIds) => api.post('/career-growth/compare/', { scenario_ids: scenarioIds }),
  getProgressionData: (jobTitle, companyName, industry) => 
    api.get('/career-growth/progression-data/', {
      params: { job_title: jobTitle, company_name: companyName, industry }
    }),
};

// ESM-only: no CommonJS interop here to avoid init-order issues
