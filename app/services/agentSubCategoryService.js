import config from '../config';

// Get agent's current subcategories
export const getAgentSubCategories = async (authToken) => {
  try {
    console.log('🔍 AgentSubCategoryService: Fetching agent subcategories');
    console.log('🔗 URL:', `${config.API_URL}/agents/subcategories`);
    
    // Add timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(`${config.API_URL}/agents/subcategories`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = 'Failed to fetch agent subcategories';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch (jsonError) {
        console.warn('Could not parse error response as JSON');
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✅ AgentSubCategoryService: Successfully fetched subcategories:', data);
    return data;
  } catch (error) {
    console.error('❌ AgentSubCategoryService: Error fetching subcategories:', error);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please check your internet connection');
    }
    
    if (error.message.includes('Network request failed')) {
      throw new Error('Network error - please check your internet connection');
    }
    
    throw error;
  }
};

// Get available subcategories that agent can add
export const getAvailableSubCategories = async (authToken) => {
  try {
    console.log('🔍 AgentSubCategoryService: Fetching available subcategories');
    const response = await fetch(`${config.API_URL}/agents/available-subcategories`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch available subcategories');
    }

    const data = await response.json();
    console.log('✅ AgentSubCategoryService: Successfully fetched available subcategories:', data);
    return data;
  } catch (error) {
    console.error('❌ AgentSubCategoryService: Error fetching available subcategories:', error);
    throw error;
  }
};

// Add a subcategory to agent's services
export const addAgentSubCategory = async (subCategoryId, authToken) => {
  try {
    console.log('➕ AgentSubCategoryService: Adding subcategory:', subCategoryId);
    const response = await fetch(`${config.API_URL}/agents/subcategories`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sub_category_id: subCategoryId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to add subcategory');
    }

    const data = await response.json();
    console.log('✅ AgentSubCategoryService: Successfully added subcategory:', data);
    return data;
  } catch (error) {
    console.error('❌ AgentSubCategoryService: Error adding subcategory:', error);
    throw error;
  }
};

// Remove a subcategory from agent's services
export const removeAgentSubCategory = async (subCategoryId, authToken) => {
  try {
    console.log('➖ AgentSubCategoryService: Removing subcategory:', subCategoryId);
    const response = await fetch(`${config.API_URL}/agents/subcategories/${subCategoryId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to remove subcategory');
    }

    const data = await response.json();
    console.log('✅ AgentSubCategoryService: Successfully removed subcategory:', data);
    return data;
  } catch (error) {
    console.error('❌ AgentSubCategoryService: Error removing subcategory:', error);
    throw error;
  }
};

// Get agent's main categories (fallback when no subcategories)
export const getAgentCategories = async (authToken) => {
  try {
    console.log('🔍 AgentSubCategoryService: Fetching agent categories');
    const response = await fetch(`${config.API_URL}/agents/categories`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch agent categories');
    }

    const data = await response.json();
    console.log('✅ AgentSubCategoryService: Successfully fetched categories:', data);
    return data;
  } catch (error) {
    console.error('❌ AgentSubCategoryService: Error fetching categories:', error);
    throw error;
  }
};

// Get available categories for agent to add
export const getAvailableCategories = async (authToken) => {
  try {
    console.log('🔍 AgentSubCategoryService: Fetching available categories');
    const response = await fetch(`${config.API_URL}/agents/available-categories`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch available categories');
    }

    const data = await response.json();
    console.log('✅ AgentSubCategoryService: Successfully fetched available categories:', data);
    return data;
  } catch (error) {
    console.error('❌ AgentSubCategoryService: Error fetching available categories:', error);
    throw error;
  }
};

// Add category to agent's services
export const addAgentCategory = async (categoryId, authToken) => {
  try {
    console.log('➕ AgentSubCategoryService: Adding category:', categoryId);
    const response = await fetch(`${config.API_URL}/agents/categories/${categoryId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to add category');
    }

    const data = await response.json();
    console.log('✅ AgentSubCategoryService: Successfully added category:', data);
    return data;
  } catch (error) {
    console.error('❌ AgentSubCategoryService: Error adding category:', error);
    throw error;
  }
};

// Remove category from agent's services
export const removeAgentCategory = async (categoryId, authToken) => {
  try {
    console.log('➖ AgentSubCategoryService: Removing category:', categoryId);
    const response = await fetch(`${config.API_URL}/agents/categories/${categoryId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to remove category');
    }

    const data = await response.json();
    console.log('✅ AgentSubCategoryService: Successfully removed category:', data);
    return data;
  } catch (error) {
    console.error('❌ AgentSubCategoryService: Error removing category:', error);
    throw error;
  }
};