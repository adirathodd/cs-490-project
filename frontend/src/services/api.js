import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('firebaseToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Normalize errors and add light retry for transient GET failures
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config || {};
    const status = error?.response?.status;
    const method = (config.method || '').toLowerCase();
    const isGet = method === 'get';
    const isTransient = !error.response || [408, 429, 500, 502, 503, 504].includes(status);

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

const extractErrorMessage = (error, fallback) => {
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
      // If document file is included, send multipart
      if (data.document instanceof File) {
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
      if (data.document instanceof File || data.document === null) {
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

  getJobInterviewInsights: async (id) => {
    try {
      const response = await api.get(`/jobs/${id}/interview-insights/`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch interview insights' };
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
          // Convert boolean to string for URL params
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
          throw { scheduled_at: errorMessage };
        }
        throw error.error[0];
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
          throw { scheduled_at: errorMessage };
        }
        throw error.error[0];
      }
      
      throw error.response?.data || error.error || { message: 'Failed to update interview' };
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
          throw errorData.error || { code: 'export_failed', message: 'Export failed' };
        } catch {
          throw { code: 'export_failed', message: 'Export failed' };
        }
      }
      throw error.error || error.response?.data?.error || { code: 'export_failed', message: 'Export failed' };
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
          throw errorData.error || { code: 'export_failed', message: 'Export failed' };
        } catch {
          throw { code: 'export_failed', message: 'Export failed' };
        }
      }
      throw error.error || error.response?.data?.error || { code: 'export_failed', message: 'Export failed' };
    }
  },
};

// Provide a forgiving default export that supports both
// - `import authAPI from './services/api'` (legacy/default import)
// - `import { authAPI } from './services/api'` (named import)
// and also exposes other API groups as properties for callers that expect `api.authAPI`.
const _defaultExport = {
  // spread authAPI methods to the top-level for backwards compatibility
  ...authAPI,
  // include grouped namespaces as properties
  authAPI,
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
  interviewsAPI,
};

export default _defaultExport;

// CommonJS compatibility: some consumers (tests or older imports) may `require()` the module
// and expect `module.exports.authAPI` or `module.exports.default` to exist. Provide both.
/* istanbul ignore next */
try {
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = _defaultExport; // override CommonJS export
    module.exports.default = _defaultExport;
    module.exports.authAPI = authAPI;
    module.exports.jobsAPI = jobsAPI;
    module.exports.materialsAPI = materialsAPI;
    module.exports.salaryAPI = salaryAPI;
    module.exports.resumeAIAPI = resumeAIAPI;
    module.exports.resumeExportAPI = resumeExportAPI;
    module.exports.interviewsAPI = interviewsAPI;
  }
} catch (e) {
  // ignore in strict ESM environments
}

// Defensive fallbacks: in some bundler/runtime interop cases the `authAPI` object
// ends up missing properties. Provide runtime-safe fallbacks that call the
// underlying axios `api` instance so callers like `authAPI.getBasicProfile()`
// and `authAPI.getProfilePicture()` always exist.
/* istanbul ignore next */
try {
  if (!authAPI || typeof authAPI.getBasicProfile !== 'function') {
    authAPI.getBasicProfile = async () => {
      const response = await api.get('/profile/basic');
      return response.data;
    };
  }

  if (!authAPI || typeof authAPI.getProfilePicture !== 'function') {
    authAPI.getProfilePicture = async () => {
      const response = await api.get('/profile/picture');
      return response.data;
    };
  }

  // Ensure the default export and CommonJS export expose these as well
  if (_defaultExport) {
    _defaultExport.authAPI = authAPI;
    _defaultExport.getBasicProfile = authAPI.getBasicProfile;
    _defaultExport.getProfilePicture = authAPI.getProfilePicture;
    _defaultExport.jobsAPI = jobsAPI;
    _defaultExport.materialsAPI = materialsAPI;
    _defaultExport.salaryAPI = salaryAPI;
    _defaultExport.resumeAIAPI = resumeAIAPI;
    _defaultExport.resumeExportAPI = resumeExportAPI;
    _defaultExport.interviewsAPI = interviewsAPI;
  }
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = _defaultExport;
    module.exports.authAPI = authAPI;
    module.exports.jobsAPI = jobsAPI;
    module.exports.materialsAPI = materialsAPI;
    module.exports.salaryAPI = salaryAPI;
    module.exports.resumeAIAPI = resumeAIAPI;
    module.exports.resumeExportAPI = resumeExportAPI;
    module.exports.interviewsAPI = interviewsAPI;
  }
} catch (e) {
  // ignore any errors during best-effort compatibility wiring
}
