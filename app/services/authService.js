import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import config from '../config';

export const api = axios.create({
  baseURL: config.API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token) => {
  if (!api || !api.defaults) {
    console.error('❌ AuthService: API instance not properly initialized');
    return;
  }
  
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const registerUser = async (userData) => {
  try {
    console.log('🔐 Registration: Attempting registration for:', userData.email);
    console.log('🔐 Registration: Request URL:', `${config.API_URL}/auth/register`);
    console.log('🔐 Registration: Request data:', { ...userData, password: '[HIDDEN]' });
    
    const response = await api.post('/auth/register', userData);
    
    console.log('✅ Registration: Success for:', userData.email);
    console.log('✅ Registration: Response data:', { 
      ...response.data, 
      access_token: response.data.access_token ? '[TOKEN_PRESENT]' : '[NO_TOKEN]' 
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Registration error for:', userData.email);
    console.error('❌ Registration error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: error.config?.url,
      method: error.config?.method
    });
    throw error;
  }
};

export const loginUser = async (email, password) => {
  try {
    console.log('🔐 Login: Attempting login for:', email);
    console.log('🔐 Login: Request URL:', `${config.API_URL}/auth/login`);
    
    // Create URL-encoded form data for OAuth2PasswordRequestForm
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await axios({
      method: 'post',
      url: `${config.API_URL}/auth/login`,
      data: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    console.log('✅ Login: Success for:', email);
    console.log('✅ Login: Response data:', { 
      ...response.data, 
      access_token: response.data.access_token ? '[TOKEN_PRESENT]' : '[NO_TOKEN]' 
    });
    
    if (response.data.access_token) {
      setAuthToken(response.data.access_token);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Login error for:', email);
    console.error('❌ Login error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: error.config?.url,
      method: error.config?.method,
      headers: error.config?.headers
    });
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

export const getToken = async () => {
  try {
    const token = await SecureStore.getItemAsync('userToken');
    console.log('🔐 AuthService: Token retrieved for request:', token ? 'Present' : 'Not found');
    return token;
  } catch (error) {
    console.error('❌ AuthService: Error retrieving token:', error);
    return null;
  }
};
