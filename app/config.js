// config.js - Production Configuration for ClickO

const isBrowser = typeof window !== 'undefined';

// Get hostname safely
let hostname = 'localhost';
if (isBrowser && window.location) {
  hostname = window.location.hostname;
}

// Smart API URL detection
const getApiUrl = () => {
  // React Native / Expo Go environment
  if (typeof window === 'undefined') {
    return 'http://10.0.1.42:8000/api';
  }
  
  // GitHub Codespace web environment
  if (hostname.includes('github.dev') || hostname.includes('githubpreview.dev')) {
    return 'https://vigilant-trout-7q6q675j4vq2pg6w-8000.app.github.dev/api';
  }
  
  // Local development
  return 'http://localhost:8000/api';
};

export const config = {
  API_URL: getApiUrl(),
  API_TIMEOUT: 15000,
  
  // Theme colors - React Native Paper compatible
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
  
  // Development settings
  DEBUG: __DEV__ || false,
  LOG_LEVEL: 'info'
};

export default config;
