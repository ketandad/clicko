import axios from 'axios';
import config from '../config';

const api = axios.create({
  baseURL: config.API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const registerUser = async (userData) => {
  try {
    const response = await api.post('/auth/register', userData);
    return response.data;
  } catch (error) {
    console.error('Registration error:', error.response?.data || error.message);
    throw error;
  }
};

export const loginUser = async (email, password) => {
  try {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await axios({
      method: 'post',
      url: `${config.API_URL}/auth/login`,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    if (response.data.access_token) {
      setAuthToken(response.data.access_token);
    }
    
    return response.data;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw error;
  }
};

export const requestPasswordReset = async (email) => {
  try {
    const response = await api.post('/auth/request-password-reset', { email });
    return response.data;
  } catch (error) {
    console.error('Password reset request error:', error.response?.data || error.message);
    throw error;
  }
};

export const resetPassword = async (token, newPassword) => {
  try {
    const response = await api.post('/auth/reset-password', { token, new_password: newPassword });
    return response.data;
  } catch (error) {
    console.error('Password reset error:', error.response?.data || error.message);
    throw error;
  }
};
