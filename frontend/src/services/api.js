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
      throw error.response?.data?.error || { message: 'Registration failed' };
    }
  },

  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Login failed' };
    }
  },

  getCurrentUser: async () => {
    try {
      const response = await api.get('/users/me');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch user' };
    }
  },

  updateProfile: async (profileData) => {
    try {
      const response = await api.patch('/users/me', profileData);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to update profile' };
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
  getProjects: async () => {
    try {
      const response = await api.get('/projects');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || { message: 'Failed to fetch projects' };
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
      if (Array.isArray(payload.technologies)) {
        payload.technologies = payload.technologies; // send as JSON by axios
      }
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

export default authAPI;
