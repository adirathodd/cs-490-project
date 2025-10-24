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
};

export default api;
