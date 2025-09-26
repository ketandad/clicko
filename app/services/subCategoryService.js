import config from '../config';

const { API_URL: API_BASE_URL } = config;

export const getSubCategories = async (categoryId) => {
  try {
    console.log(`🔍 SubCategoryService: Fetching sub-categories for category: ${categoryId}`);
    const response = await fetch(`${API_BASE_URL}/categories/${categoryId}/sub-categories/`);
    
    if (!response.ok) {
      console.error(`❌ SubCategoryService: Failed to fetch sub-categories: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ SubCategoryService: Fetched ${data.length} sub-categories`);
    return data;
  } catch (error) {
    console.error('❌ SubCategoryService: Error fetching sub-categories:', error);
    throw error;
  }
};

export const getAllSubCategories = async () => {
  try {
    console.log('🔍 SubCategoryService: Fetching all sub-categories');
    const response = await fetch(`${API_BASE_URL}/categories/sub-categories/all`);
    
    if (!response.ok) {
      console.error(`❌ SubCategoryService: Failed to fetch all sub-categories: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ SubCategoryService: Fetched ${data.length} total sub-categories`);
    return data;
  } catch (error) {
    console.error('❌ SubCategoryService: Error fetching all sub-categories:', error);
    throw error;
  }
};