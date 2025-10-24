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
};

export default authAPI;
