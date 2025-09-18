import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import config from '../config';

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
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

export const getUserProfile = async (userId) => {
  try {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user profile:', error.response?.data || error.message);
    throw error;
  }
};

export const updateUserProfile = async (userId, userData) => {
  try {
    const response = await api.put(`/users/${userId}`, userData);
    return response.data;
  } catch (error) {
    console.error('Error updating user profile:', error.response?.data || error.message);
    throw error;
  }
};

export const updateUserAddress = async (userId, address) => {
  try {
    const response = await api.put(`/users/${userId}/address`, { address });
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

    const response = await api.post(`/users/${userId}/profile-image`, formData, {
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
