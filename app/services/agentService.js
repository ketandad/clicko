// Dummy agent service for status logic
import * as SecureStore from 'expo-secure-store';
import config from '../config';
import { checkApiHealth } from '../utils/apiHealthCheck';
import { validateStoredToken, clearExpiredToken } from '../utils/tokenValidation';

// Use config API URL instead of hardcoded
const API_BASE_URL = config.API_URL;

// Simple fallback data for when backend is unavailable
const createFallbackAgentStats = () => ({
  today_earnings: 0,
  today_bookings: 0,
  today_distance: 0,
  total_earnings: 0,
  total_bookings: 0,
  avg_rating: 0
});

// Helper function to handle fetch responses and detect HTML responses
async function handleApiResponse(response, defaultValue = null) {
  try {
    const responseText = await response.text();
    
    // Check if response is HTML (indicates backend not running)
    if (responseText.trim().startsWith('<') || responseText.includes('<!doctype html>')) {
      console.warn('⚠️ AgentService: Received HTML instead of JSON - backend may not be running');
      
      // Check API health only once to avoid spam
      const health = await checkApiHealth();
      if (!health.isHealthy) {
        console.error('🚨 AgentService: Backend health check failed:', health.error);
        console.log('💡 AgentService: Recommendation:', health.recommendation);
      }
      
      return defaultValue;
    }
    
    // Try to parse JSON
    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ AgentService: Failed to parse JSON response:', parseError);
      console.log('📄 AgentService: Response text preview:', responseText.substring(0, 200));
      return defaultValue;
    }
  } catch (error) {
    console.error('❌ AgentService: Error reading response:', error);
    return defaultValue;
  }
}

export async function acceptBooking(agentId) {
  // Simulate API call: set agent offline for 2 hours
  return { success: true, status: 'offline', offlineUntil: Date.now() + 2 * 60 * 60 * 1000 };
}

export async function updateAgentStatus(isOnline) {
  try {
    console.log('🔄 AgentService: Updating agent status to:', isOnline ? 'online' : 'offline');
    
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/agents/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ is_online: isOnline }),
    });

    console.log('📡 AgentService: Status update response:', response.status);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Agent status updated successfully:', result);
      return result;
    } else if (response.status === 401) {
      console.log('🔐 AgentService: Authentication failed for status update');
      throw new Error('Authentication failed - please log in again');
    } else if (response.status === 404) {
      console.log('👤 AgentService: No agent profile found for status update');
      throw new Error('Agent profile not found - please complete agent onboarding first');
    } else {
      // Handle non-JSON error responses (HTML error pages)
      let errorMessage = 'Failed to update status';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch (parseError) {
        // If response is not JSON (e.g., HTML error page), use status text
        console.log('📄 AgentService: Non-JSON error response, status:', response.status);
        errorMessage = `Server error: ${response.status} ${response.statusText}`;
      }
      console.error('❌ AgentService: Status update failed:', errorMessage);
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('❌ AgentService: Error updating status:', error);
    throw error;
  }
}

export async function checkAgentProfile(userId) {
  try {
    console.log('🔍 AgentService: Checking agent profile for user:', userId);
    console.log('🌐 AgentService: API URL:', `${API_BASE_URL}/agents/profile/${userId}`);
    
    const response = await fetch(`${API_BASE_URL}/agents/profile/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });

    console.log('📡 AgentService: Response status:', response.status);

    if (response.ok) {
      const agentData = await handleApiResponse(response, null);
      if (agentData && typeof agentData === 'object') {
        console.log('🏦 Agent profile data:', agentData);
        return agentData; // Returns agent profile with wallet_balance
      }
      console.log('🔧 AgentService: No valid agent data received');
      return null;
    } else if (response.status === 404) {
      console.log('❌ No agent profile found for user:', userId);
      return null; // No agent profile found
    } else {
      console.error('❌ AgentService: HTTP error:', response.status, response.statusText);
      
      // Check if error response is HTML
      try {
        const errorText = await response.text();
        if (errorText.trim().startsWith('<') || errorText.includes('<!doctype html>')) {
          console.warn('⚠️ AgentService: Error response is HTML - backend may not be running');
          const health = await checkApiHealth();
          if (!health.isHealthy) {
            console.error('🚨 AgentService: Backend health check failed:', health.error);
          }
          return null;
        }
      } catch (readError) {
        console.log('📄 AgentService: Could not read error response');
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('❌ AgentService: Network error checking agent profile:', error);
    
    // If it's a network error or JSON parse error, return null so the app can continue
    if (error.message.includes('Network request failed') || 
        error.name === 'TypeError' || 
        error.name === 'SyntaxError') {
      console.log('🔧 AgentService: Network/Parse failure - assuming no agent profile exists');
      return null;
    }
    
    throw error; // Re-throw other errors
  }
}

export async function getAgentStats() {
  try {
    console.log('📊 AgentService: Fetching agent stats');
    
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) {
      console.log('❌ AgentService: No authentication token found');
      console.log('🔧 AgentService: Using default stats due to missing token');
      return createFallbackAgentStats();
    }

    const response = await fetch(`${API_BASE_URL}/agents/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    console.log('📡 AgentService: Stats response status:', response.status);

    const defaultStats = createFallbackAgentStats();

    if (response.ok) {
      const stats = await handleApiResponse(response, defaultStats);
      if (stats && typeof stats === 'object') {
        console.log('📊 Agent stats data:', stats);
        return stats;
      }
      console.log('🔧 AgentService: Using default stats due to invalid response');
      return defaultStats;
    } else if (response.status === 401) {
      console.log('🚨 AgentService: Authentication failed - token may be expired');
      
      // Only clear token if it's actually expired, not just for any 401
      const tokenValidation = await validateStoredToken();
      if (!tokenValidation.isValid && tokenValidation.reason === 'expired') {
        console.log('⏰ AgentService: Token is confirmed expired, clearing credentials');
        await clearExpiredToken();
      } else {
        console.log('🔍 AgentService: 401 error but token appears valid - may be JWT validation issue');
      }
      
      console.log('🔧 AgentService: Using default stats due to authentication failure');
      return defaultStats;
    } else if (response.status === 404) {
      console.log('👤 AgentService: No agent profile found in database - user needs to complete agent onboarding');
      console.log('� AgentService: Frontend shows agent=true but no Agent record exists in database');
      console.log('🔧 AgentService: User should use agent onboarding flow to create Agent profile');
      console.log('�🔧 AgentService: Using default stats due to missing agent profile');
      return defaultStats;
    } else {
      // Handle non-JSON error responses (HTML error pages)
      let errorMessage = 'Failed to fetch stats';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch (parseError) {
        // If response is not JSON (e.g., HTML error page), use status text
        console.log('📄 AgentService: Non-JSON error response, status:', response.status);
        errorMessage = `Server error: ${response.status} ${response.statusText}`;
      }
      console.error('❌ AgentService: Stats fetch failed:', errorMessage);
      
      // Return default stats instead of throwing
      console.log('🔧 AgentService: Using default stats due to error');
      return defaultStats;
    }
  } catch (error) {
    console.error('❌ AgentService: Error fetching stats:', error);
    
    // Return default stats if API fails
    console.log('🔧 AgentService: Using default stats due to network error');
    return createFallbackAgentStats();
  }
}

export async function updateAgentLocation(latitude, longitude, area) {
  try {
    console.log('📍 AgentService: Updating agent location:', { latitude, longitude, area });
    
    // Validate token before making request
    const tokenValidation = await validateStoredToken();
    if (!tokenValidation.isValid) {
      console.log('❌ AgentService: Token validation failed for location update:', tokenValidation.reason);
      if (tokenValidation.reason === 'expired') {
        console.log('⏰ AgentService: Token expired, clearing credentials');
        await clearExpiredToken();
      }
      console.log('⚠️ AgentService: Skipping location update due to invalid token');
      return null;
    }
    
    const token = tokenValidation.token;

    const response = await fetch(`${API_BASE_URL}/agents/location`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        latitude, 
        longitude, 
        area 
      }),
    });

    console.log('📡 AgentService: Location update response:', response.status);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Agent location updated successfully:', result);
      return result;
    } else if (response.status === 401) {
      console.log('� AgentService: Authentication failed for location update - token may be expired');
      console.log('⏰ AgentService: Clearing potentially expired token');
      await clearExpiredToken();
      return null;
    } else if (response.status === 404) {
      console.log('👤 AgentService: No agent profile found - user may not be an agent yet');
      return null;
    } else {
      // Handle other non-JSON error responses (HTML error pages)
      let errorMessage = 'Failed to update location';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch (parseError) {
        // If response is not JSON (e.g., HTML error page), use status text
        console.log('📄 AgentService: Non-JSON error response, status:', response.status);
        errorMessage = `Server error: ${response.status} ${response.statusText}`;
      }
      console.error('❌ AgentService: Location update failed:', errorMessage);
      // Don't throw error for location updates - just log it
      return null;
    }
  } catch (error) {
    console.error('❌ AgentService: Error updating location:', error);
    // Return null instead of throwing - location updates are not critical
    return null;
  }
}
