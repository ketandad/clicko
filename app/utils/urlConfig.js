/**
 * URL Configuration Utility
 * Provides consistent URL generation for both API and WebSocket connections
 */

import { Platform } from 'react-native';

const isBrowser = typeof window !== 'undefined';

let hostname = 'localhost';
if (isBrowser && window.location) {
  hostname = window.location.hostname;
}

export const getBaseUrl = (protocol = 'https') => {
  // For React Native / Expo Go - use Platform.OS for reliable mobile detection
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return `${protocol}://vigilant-trout-7q6q675j4vq2pg6w-8000.app.github.dev`;
  }
  
  // For web browsers - use current hostname logic
  if (hostname.includes('github.dev') || hostname.includes('githubpreview.dev')) {
    const host = hostname.replace(/^[^-]+-/, '').replace(/\.github\.dev$/, '') + '-8000.app.github.dev';
    return `${protocol}://${host}`;
  }
  
  if (hostname.includes('gitpod.io')) {
    return `${protocol}://8000-${hostname}`;
  }
  
  // Local development fallback
  const port = protocol === 'ws' || protocol === 'wss' ? '8000' : '8000';
  return `${protocol}://localhost:${port}`;
};

export const getApiUrl = () => {
  return getBaseUrl('https') + '/api';
};

export const getWebSocketUrl = (agentId, secure = true) => {
  const protocol = secure ? 'wss' : 'ws';
  return getBaseUrl(protocol) + `/api/notifications/ws/agent/${agentId}`;
};

// For debugging
console.log('📡 URL Config - API:', getApiUrl());
console.log('🔗 URL Config - WebSocket Sample:', getWebSocketUrl(1));