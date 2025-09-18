// config.js - Auto-generated configuration (Future-proof)
import { Platform } from 'react-native';

const isBrowser = typeof window !== 'undefined';

let hostname = 'localhost';
if (isBrowser && window.location) {
  hostname = window.location.hostname;
}

const getApiUrl = () => {
  // For React Native / Expo Go - use Platform.OS for reliable mobile detection
  // Expo Go creates window object even on mobile, so typeof window check fails
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return 'https://vigilant-trout-7q6q675j4vq2pg6w-8000.app.github.dev/api';
  }
  
  // For web browsers - use current hostname logic
  if (hostname.includes('github.dev') || hostname.includes('githubpreview.dev')) {
    return 'https://' + hostname.replace(/^[^-]+-/, '').replace(/\.github\.dev$/, '') + '-8000.app.github.dev/api';
  }
  
  if (hostname.includes('gitpod.io')) {
    return 'https://8000-' + hostname + '/api';
  }
  
  // Local development fallback
  return 'http://localhost:8000/api';
};

const config = {
  API_URL: getApiUrl(),
  API_TIMEOUT: 30000,
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6', 
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    background: '#F2F2F7',
    surface: '#FFFFFF',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#C6C6C8',
    accent: '#FF3B30',
    disabled: '#C6C6C8'
  },
  DEBUG: __DEV__ || false,
  LOG_LEVEL: 'info'
};

console.log('API Configuration:', config.API_URL);

export default config;
