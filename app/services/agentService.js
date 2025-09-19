// Dummy agent service for status logic
import * as SecureStore from 'expo-secure-store';
import config from '../config';

// Use config API URL instead of hardcoded
const API_BASE_URL = config.API_URL;

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
    } else {
      const errorData = await response.json();
      console.error('❌ AgentService: Status update failed:', errorData);
      throw new Error(errorData.detail || 'Failed to update status');
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
      const agentData = await response.json();
      console.log('🏦 Agent profile data:', agentData);
      return agentData; // Returns agent profile with wallet_balance
    } else if (response.status === 404) {
      console.log('❌ No agent profile found for user:', userId);
      return null; // No agent profile found
    } else {
      console.error('❌ AgentService: HTTP error:', response.status, response.statusText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('❌ AgentService: Network error checking agent profile:', error);
    
    // If it's a network error, return null so the app can continue
    if (error.message.includes('Network request failed') || error.name === 'TypeError') {
      console.log('🔧 AgentService: Network failure - assuming no agent profile exists');
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
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/agents/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    console.log('📡 AgentService: Stats response status:', response.status);

    if (response.ok) {
      const stats = await response.json();
      console.log('📊 Agent stats data:', stats);
      return stats;
    } else {
      const errorData = await response.json();
      console.error('❌ AgentService: Stats fetch failed:', errorData);
      throw new Error(errorData.detail || 'Failed to fetch stats');
    }
  } catch (error) {
    console.error('❌ AgentService: Error fetching stats:', error);
    
    // Return default stats if API fails
    return {
      today_earnings: 0,
      today_bookings: 0,
      today_distance: 0,
      total_earnings: 0,
      total_bookings: 0,
      avg_rating: 0
    };
  }
}

export async function updateAgentLocation(latitude, longitude, area) {
  try {
    console.log('📍 AgentService: Updating agent location:', { latitude, longitude, area });
    
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

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
    } else {
      const errorData = await response.json();
      console.error('❌ AgentService: Location update failed:', errorData);
      // Don't throw error for location updates - just log it
      return null;
    }
  } catch (error) {
    console.error('❌ AgentService: Error updating location:', error);
    // Return null instead of throwing - location updates are not critical
    return null;
  }
}
