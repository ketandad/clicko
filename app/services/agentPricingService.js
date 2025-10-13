import config from '../config';
import { getToken } from './authService';

const API_BASE_URL = config?.API_URL || 'http://localhost:8000';

/**
 * Get all service pricing for the current agent
 * @param {string} authToken - Authentication token
 * @returns {Promise<Array>} Array of pricing data
 */
export const getAgentServicePricing = async (authToken) => {
  try {
    console.log('🔍 AgentPricingService: Fetching agent service pricing');
    console.log('🔗 URL:', `${API_BASE_URL}/agents/service-pricing`);
    
    // Add timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(`${API_BASE_URL}/agents/service-pricing`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `Failed to fetch service pricing (${response.status})`;
      try {
        const errorData = await response.json();
        console.log('❌ AgentPricingService: Error response:', errorData);
        
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            // Handle FastAPI validation errors
            errorMessage = errorData.detail.map(err => `${err.loc?.join('.')}: ${err.msg}`).join(', ');
          } else {
            errorMessage = errorData.detail;
          }
        }
      } catch (jsonError) {
        console.warn('Could not parse error response as JSON');
        errorMessage = `HTTP ${response.status} - ${response.statusText || 'Unknown error'}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✅ AgentPricingService: Successfully fetched pricing:', data);
    return data;
  } catch (error) {
    console.error('❌ AgentPricingService: Error fetching pricing:', error);
    console.error('❌ AgentPricingService: Error message:', error.message);
    console.error('❌ AgentPricingService: Error stack:', error.stack);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please check your internet connection');
    }
    
    if (error.message.includes('Network request failed')) {
      throw new Error('Network error - please check your internet connection');
    }
    
    // Better error message handling
    let errorMessage = 'Failed to fetch service pricing';
    if (error.message && typeof error.message === 'string') {
      errorMessage = error.message;
    } else if (error.toString && typeof error.toString === 'function') {
      errorMessage = error.toString();
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Create or update service pricing for a subcategory
 * @param {Object} pricingData - Pricing data
 * @param {string} authToken - Authentication token
 * @returns {Promise<Object>} Created pricing data
 */
export const createServicePricing = async (pricingData, authToken) => {
  try {
    console.log('📤 AgentPricingService: Creating service pricing:', pricingData);
    console.log('🔗 POST URL:', `${API_BASE_URL}/agents/service-pricing`);
    const response = await fetch(`${API_BASE_URL}/agents/service-pricing`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pricingData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to create service pricing');
    }

    const data = await response.json();
    console.log('✅ AgentPricingService: Successfully created pricing:', data);
    return data;
  } catch (error) {
    console.error('❌ AgentPricingService: Error creating pricing:', error);
    throw error;
  }
};

/**
 * Update existing service pricing
 * @param {number} pricingId - Pricing ID to update
 * @param {Object} pricingData - Updated pricing data
 * @param {string} authToken - Authentication token
 * @returns {Promise<Object>} Updated pricing data
 */
export const updateServicePricing = async (pricingId, pricingData, authToken) => {
  try {
    console.log('📝 AgentPricingService: Updating service pricing:', pricingId, pricingData);
    console.log('🔗 PUT URL:', `${API_BASE_URL}/agents/service-pricing/${pricingId}`);
    const response = await fetch(`${API_BASE_URL}/agents/service-pricing/${pricingId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pricingData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update service pricing');
    }

    const data = await response.json();
    console.log('✅ AgentPricingService: Successfully updated pricing:', data);
    return data;
  } catch (error) {
    console.error('❌ AgentPricingService: Error updating pricing:', error);
    throw error;
  }
};

/**
 * Delete service pricing
 * @param {number} pricingId - Pricing ID to delete
 * @param {string} authToken - Authentication token
 * @returns {Promise<Object>} Success response
 */
export const deleteServicePricing = async (pricingId, authToken) => {
  try {
    console.log('🗑️ AgentPricingService: Deleting service pricing:', pricingId);
    console.log('🔗 DELETE URL:', `${API_BASE_URL}/agents/service-pricing/${pricingId}`);
    const response = await fetch(`${API_BASE_URL}/agents/service-pricing/${pricingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete service pricing');
    }

    const data = await response.json();
    console.log('✅ AgentPricingService: Successfully deleted pricing:', data);
    return data;
  } catch (error) {
    console.error('❌ AgentPricingService: Error deleting pricing:', error);
    throw error;
  }
};