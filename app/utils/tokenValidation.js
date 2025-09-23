// Token validation and expiration utilities
import * as SecureStore from 'expo-secure-store';

export function decodeJWTPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    let payload = parts[1];
    // Add padding if needed
    payload += '='.repeat((4 - payload.length % 4) % 4);
    
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('❌ Token Validation: Error decoding JWT:', error);
    return null;
  }
}

export function isTokenExpired(token) {
  const payload = decodeJWTPayload(token);
  if (!payload || !payload.exp) {
    return true; // Consider invalid tokens as expired
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime >= payload.exp;
}

export async function validateStoredToken() {
  try {
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) {
      console.log('🔍 Token Validation: No token found in storage');
      return { isValid: false, reason: 'no_token' };
    }
    
    if (isTokenExpired(token)) {
      console.log('⏰ Token Validation: Token has expired');
      const payload = decodeJWTPayload(token);
      const expDate = new Date(payload.exp * 1000);
      console.log('📅 Token Validation: Token expired at:', expDate.toISOString());
      return { isValid: false, reason: 'expired', expiredAt: expDate };
    }
    
    console.log('✅ Token Validation: Token is valid');
    return { isValid: true, token };
  } catch (error) {
    console.error('❌ Token Validation: Error validating token:', error);
    return { isValid: false, reason: 'error', error };
  }
}

export async function clearExpiredToken() {
  try {
    console.log('🧹 Token Validation: Clearing expired token from storage');
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userId');
    await SecureStore.deleteItemAsync('userName');
    await SecureStore.deleteItemAsync('isAgent');
    await SecureStore.deleteItemAsync('agentOnboardingCompleted');
    await SecureStore.deleteItemAsync('walletBalance');
    await SecureStore.deleteItemAsync('currentMode');
    console.log('✅ Token Validation: Expired credentials cleared');
  } catch (error) {
    console.error('❌ Token Validation: Error clearing credentials:', error);
  }
}