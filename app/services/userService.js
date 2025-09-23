import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import config from '../config';
import { checkApiHealth } from '../utils/apiHealthCheck';

const api = axios.create({
  baseURL: config.API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Set auth token for all requests
api.interceptors.request.use(
  async config => {
    const token = await SecureStore.getItemAsync('userToken');
    console.log('🔐 UserService: Token retrieved for request:', token ? 'Present' : 'Missing');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('📤 UserService: Making authenticated request to:', config.url);
    } else {
      console.log('⚠️ UserService: No token found, making unauthenticated request');
    }
    return config;
  },
  error => {
    console.error('❌ UserService: Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration and HTML responses
api.interceptors.response.use(
  response => {
    // Check if response data is HTML (indicates backend not running)
    if (typeof response.data === 'string' && 
        (response.data.trim().startsWith('<') || response.data.includes('<!doctype html>'))) {
      console.warn('⚠️ UserService: Received HTML instead of JSON - backend may not be running');
      
      // Check API health
      checkApiHealth().then(health => {
        if (!health.isHealthy) {
          console.error('🚨 UserService: Backend health check failed:', health.error);
          console.log('💡 UserService: Recommendation:', health.recommendation);
        }
      }).catch(err => {
        console.error('❌ UserService: Health check error:', err);
      });
      
      // Create a custom error for HTML responses
      const htmlError = new Error('Backend server is not responding (received HTML instead of JSON)');
      htmlError.isHtmlResponse = true;
      htmlError.originalData = response.data;
      return Promise.reject(htmlError);
    }
    
    return response;
  },
  async error => {
    const originalRequest = error.config;
    
    // Handle HTML responses in error cases
    if (error.response && typeof error.response.data === 'string' && 
        (error.response.data.trim().startsWith('<') || error.response.data.includes('<!doctype html>'))) {
      console.warn('⚠️ UserService: Error response is HTML - backend may not be running');
      const htmlError = new Error('Backend server is not responding properly');
      htmlError.isHtmlResponse = true;
      htmlError.originalError = error;
      return Promise.reject(htmlError);
    }
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log('🚨 UserService: 401 Unauthorized - Token expired or invalid');
      originalRequest._retry = true;
      
      // Clear stored credentials
      try {
        await SecureStore.deleteItemAsync('userToken');
        await SecureStore.deleteItemAsync('userId');
        await SecureStore.deleteItemAsync('userName');
        await SecureStore.deleteItemAsync('isAgent');
        console.log('🧹 UserService: Cleared expired credentials');
        
        // You might want to emit an event here to trigger logout in AuthContext
        // For now, we'll let the error propagate and handle it in the UI
      } catch (clearError) {
        console.error('❌ UserService: Error clearing credentials:', clearError);
      }
    }
    
    return Promise.reject(error);
  }
);

export const getCurrentUser = async () => {
  try {
    const response = await api.get('/users/me');
    return response.data;
  } catch (error) {
    console.error('Error fetching current user:', error.response?.data || error.message);
    throw error;
  }
};

export const getUserProfile = async (userId) => {
  try {
    const response = await api.get(`/users/${userId}/`);
    return response.data;
  } catch (error) {
    // Handle HTML response errors gracefully
    if (error.isHtmlResponse) {
      console.error('❌ UserService: Backend not responding properly (HTML response)');
      // Return a basic user profile structure so the app doesn't crash
      return {
        id: userId,
        name: 'User',
        email: '',
        phone: '',
        address: '',
        error: 'Backend server not available'
      };
    }
    
    console.error('Error fetching user profile:', error.response?.data || error.message);
    throw error;
  }
};

export const updateUserProfile = async (userId, userData) => {
  try {
    const response = await api.put(`/users/${userId}/`, userData);
    return response.data;
  } catch (error) {
    console.error('Error updating user profile:', error.response?.data || error.message);
    throw error;
  }
};

export const updateUserAddress = async (userId, address) => {
  try {
    const response = await api.put(`/users/${userId}/address/`, { address });
    return response.data;
  } catch (error) {
    console.error('Error updating address:', error.response?.data || error.message);
    throw error;
  }
};

export const uploadProfileImage = async (userId, imageUri) => {
  try {
    // Create form data for image upload
    const formData = new FormData();
    const filename = imageUri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image';
    
    formData.append('profile_image', {
      uri: imageUri,
      name: filename,
      type,
    });

    const response = await api.post(`/users/${userId}/profile-image/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Error uploading profile image:', error.response?.data || error.message);
    throw error;
  }
};
