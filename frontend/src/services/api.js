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

    // Prefer backend error shape if present, but only surface minimal shape expected by tests/consumers
    const backendErr = error?.response?.data?.error;
    const code = (backendErr && backendErr.code) ? backendErr.code : 'network_error';
    const message = (backendErr && backendErr.message) ? backendErr.message : 'Network error. Please try again.';

    // Return minimal normalized error to satisfy existing tests and callers:
    // { error: { code, message } }
    return Promise.reject({ error: { code, message } });
  }
);

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
      throw error.response?.data?.error || { message: 'Failed to fetch projects' };
    }
  },

  getProject: async (id) => {
    try {
      const response = await api.get(`/projects/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch project' };
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
      throw error.response?.data?.error || { message: 'Failed to add project' };
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
      throw error.response?.data?.error || { message: 'Failed to update project' };
    }
  },

  deleteProject: async (id) => {
    try {
      const response = await api.delete(`/projects/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to delete project' };
    }
  },

  deleteProjectMedia: async (projectId, mediaId) => {
    try {
      const response = await api.delete(`/projects/${projectId}/media/${mediaId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to delete media' };
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
  materialsAPI,
  resumeAIAPI,
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
    module.exports.resumeAIAPI = resumeAIAPI;
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
    _defaultExport.resumeAIAPI = resumeAIAPI;
  }
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = _defaultExport;
    module.exports.authAPI = authAPI;
    module.exports.jobsAPI = jobsAPI;
    module.exports.materialsAPI = materialsAPI;
    module.exports.resumeAIAPI = resumeAIAPI;
  }
} catch (e) {
  // ignore any errors during best-effort compatibility wiring
}
