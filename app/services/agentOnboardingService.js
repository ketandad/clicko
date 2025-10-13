import config from '../config';
import { getToken } from './authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { API_URL: API_BASE_URL } = config;

/**
 * Complete agent onboarding with all data in a single submission
 * @param {object} onboardingData - Complete onboarding data with images
 * @returns {Promise<object>} Onboarding result
 */
export const submitAgentOnboarding = async (onboardingData) => {
  try {
    console.log('📤 Starting comprehensive agent onboarding submission...');

    // Get authentication token
    const token = await getToken();
    if (!token) {
      throw new Error('Authentication required for onboarding submission');
    }

    // Create FormData for multipart upload
    const formData = new FormData();

    // Add personal details
    formData.append('formatted_phone', onboardingData.phone || '');
    formData.append('experience_years', onboardingData.experienceYears || 0);
    formData.append('bio', onboardingData.bio || '');

    // Add address details
    formData.append('address_line_1', onboardingData.addressLine1 || '');
    formData.append('address_line_2', onboardingData.addressLine2 || '');
    formData.append('city', onboardingData.city || '');
    formData.append('state', onboardingData.state || '');
    formData.append('postal_code', onboardingData.postalCode || '');
    formData.append('location', onboardingData.location || ''); // "lat,lng"

    // Add category selections
    formData.append('primary_category_id', onboardingData.primaryCategoryId || '');
    formData.append('sub_category_ids', JSON.stringify(onboardingData.subCategoryIds || []));

    // Add KYC details
    formData.append('kyc_document_type', onboardingData.kycDocumentType || '');

    // Add image files
    if (onboardingData.profilePhoto) {
      const profilePhotoFile = {
        uri: onboardingData.profilePhoto,
        type: 'image/jpeg',
        name: 'profile_photo.jpg',
      };
      formData.append('profile_image', profilePhotoFile);
    }

    if (onboardingData.selfiePhoto) {
      const selfieFile = {
        uri: onboardingData.selfiePhoto,
        type: 'image/jpeg',
        name: 'selfie_verification.jpg',
      };
      formData.append('selfie_verification', selfieFile);
    }

    if (onboardingData.kycDocument) {
      const kycFile = {
        uri: onboardingData.kycDocument,
        type: 'image/jpeg',
        name: 'kyc_document.jpg',
      };
      formData.append('kyc_document', kycFile);
    }

    console.log('📤 Submitting onboarding data to:', `${API_BASE_URL}/users/agent/onboard`);

    const response = await fetch(`${API_BASE_URL}/users/agent/onboard`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type for FormData - let the browser set it with boundary
      },
      body: formData,
    });

    console.log('📡 Onboarding response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Onboarding failed:', errorText);
      
      // Special handling for "User already has agent profile"
      if (response.status === 400 && errorText.includes('already has an agent profile')) {
        console.log('🎯 User already has agent profile - this should trigger state sync');
        // Return a special object indicating the user already has a profile
        return {
          success: true,
          alreadyExists: true,
          message: 'Agent profile already exists',
          shouldSyncState: true
        };
      }
      
      throw new Error(`Onboarding failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Agent onboarding completed successfully:', result);
    
    // Cache initial wallet balance of 1000 for new agents
    try {
      await AsyncStorage.setItem('agent_wallet_balance', '1000');
      console.log('💳 Initial wallet balance (1000) cached successfully');
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache initial wallet balance:', cacheError);
    }
    
    return result;

  } catch (error) {
    console.error('❌ AgentOnboardingService: Error submitting onboarding:', error);
    throw error;
  }
};

/**
 * Check agent onboarding status
 * @returns {Promise<object>} Onboarding status
 */
export const checkOnboardingStatus = async () => {
  try {
    const token = await getToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const userData = await response.json();
    return {
      isAgent: userData.is_agent,
      onboardingCompleted: userData.agent_onboarding_completed || false,
    };

  } catch (error) {
    console.error('❌ AgentOnboardingService: Error checking status:', error);
    throw error;
  }
};