import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Set auth token for all requests
api.interceptors.request.use(
  async config => {
    const token = await SecureStore.getItemAsync('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

export const getCategories = async () => {
  try {
    const response = await api.get('/categories');
    
    // Transform the data to include placeholder images for categories that don't have icons
    const categoriesWithIcons = response.data.map(category => ({
      ...category,
      icon_url: category.icon_url || getCategoryPlaceholderIcon(category.name)
    }));
    
    return categoriesWithIcons;
  } catch (error) {
    console.error('Error fetching categories:', error.response?.data || error.message);
    throw error;
  }
};

export const getFeaturedCategories = async () => {
  try {
    const response = await api.get('/categories/featured');
    
    // Transform the data to include placeholder images
    const featuredWithIcons = response.data.map(category => ({
      ...category,
      icon_url: category.icon_url || getCategoryPlaceholderIcon(category.name)
    }));
    
    return featuredWithIcons;
  } catch (error) {
    console.error('Error fetching featured categories:', error.response?.data || error.message);
    // Return some default featured categories in case of error
    return getDefaultFeaturedCategories();
  }
};

export const getCategoryById = async (categoryId) => {
  try {
    const response = await api.get(`/categories/${categoryId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching category ${categoryId}:`, error.response?.data || error.message);
    throw error;
  }
};

// Helper function to get placeholder icons based on category name
const getCategoryPlaceholderIcon = (categoryName) => {
  // Map category names to icon URLs
  const iconMap = {
    'Electrician': 'https://img.icons8.com/color/96/000000/electrical.png',
    'Plumber': 'https://img.icons8.com/color/96/000000/plumbing.png',
    'Carpenter': 'https://img.icons8.com/color/96/000000/saw.png',
    'AC Repair': 'https://img.icons8.com/color/96/000000/air-conditioner.png',
    'Cleaning': 'https://img.icons8.com/color/96/000000/vacuum-cleaner.png',
    'Painter': 'https://img.icons8.com/color/96/000000/paint-roller.png',
    'Appliance Repair': 'https://img.icons8.com/color/96/000000/washing-machine.png',
    'Pest Control': 'https://img.icons8.com/color/96/000000/bug.png',
    'Mobile Repair': 'https://img.icons8.com/color/96/000000/phone-repair.png',
    'Computer Service': 'https://img.icons8.com/color/96/000000/computer-support.png',
    'Tutoring': 'https://img.icons8.com/color/96/000000/training.png',
    'Beauty': 'https://img.icons8.com/color/96/000000/beauty-salon.png',
    'Laundry': 'https://img.icons8.com/color/96/000000/laundry.png',
    'Home Shifting': 'https://img.icons8.com/color/96/000000/truck.png',
    'Driver': 'https://img.icons8.com/color/96/000000/driver.png',
    'Gardener': 'https://img.icons8.com/color/96/000000/rake.png',
    'Cook': 'https://img.icons8.com/color/96/000000/chef-hat.png',
    'Photography': 'https://img.icons8.com/color/96/000000/camera.png',
    'Fitness': 'https://img.icons8.com/color/96/000000/dumbbell.png',
    'Tailor': 'https://img.icons8.com/color/96/000000/sewing-machine.png',
    'Locksmith': 'https://img.icons8.com/color/96/000000/key.png',
    'Water Purifier': 'https://img.icons8.com/color/96/000000/water.png',
    'Car Wash': 'https://img.icons8.com/color/96/000000/car-wash.png',
    'Babysitter': 'https://img.icons8.com/color/96/000000/nanny.png',
    'Pet Care': 'https://img.icons8.com/color/96/000000/dog.png'
  };

  // Return the specific icon or a default one
  return iconMap[categoryName] || 'https://img.icons8.com/color/96/000000/service.png';
};

// Default featured categories in case API fails
const getDefaultFeaturedCategories = () => {
  return [
    {
      id: 1,
      name: 'Electrician',
      icon_url: 'https://img.icons8.com/color/96/000000/electrical.png',
      description: 'Professional electricians for all your electrical needs',
      agent_count: 45
    },
    {
      id: 2,
      name: 'Plumber',
      icon_url: 'https://img.icons8.com/color/96/000000/plumbing.png',
      description: 'Expert plumbers for pipe repairs, installation and more',
      agent_count: 32
    },
    {
      id: 5,
      name: 'Cleaning',
      icon_url: 'https://img.icons8.com/color/96/000000/vacuum-cleaner.png',
      description: 'Professional home and office cleaning services',
      agent_count: 28
    }
  ];
};
