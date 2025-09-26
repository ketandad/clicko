import config from '../config';

const API_BASE_URL = config.API_URL;

/**
 * Upload image to backend server
 * @param {string} imageUri - Local image URI
 * @param {string} type - Image type: 'profile' | 'selfie' | 'document'
 * @param {object} options - Additional upload options
 * @returns {Promise<object>} Upload result with URL
 */
export const uploadImage = async (imageUri, type = 'profile', options = {}) => {
  try {
    console.log('📸 Starting image upload:', { imageUri, type });
    
    // Create form data for multipart upload
    const formData = new FormData();
    
    // Get file extension and create filename
    const fileExtension = imageUri.split('.').pop() || 'jpg';
    const fileName = `${type}_${Date.now()}.${fileExtension}`;
    
    formData.append('file', {
      uri: imageUri,
      type: `image/${fileExtension}`,
      name: fileName,
    });
    
    formData.append('type', type);
    
    if (options.userId) {
      formData.append('userId', options.userId);
    }

    // Get authentication token
    const { getToken } = await import('./authService');
    const token = await getToken();
    
    if (!token) {
      throw new Error('Authentication required for image upload');
    }

    console.log('📤 Uploading to:', `${API_BASE_URL}/upload/image`);
    
    const response = await fetch(`${API_BASE_URL}/upload/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type for FormData - let the browser set it with boundary
      },
      body: formData,
    });

    console.log('📡 Upload response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Upload failed:', errorText);
      throw new Error(`Upload failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Upload successful:', result);
    
    return {
      success: true,
      url: result.url,
      fileName: result.fileName,
      fileSize: result.fileSize,
      type: type,
    };
  } catch (error) {
    console.error('❌ Image upload error:', error);
    
    // For development: Return mock URL when backend is not available
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      console.log('🔄 Using mock upload for development');
      const mockUrl = `https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=${type.toUpperCase()}`;
      
      return {
        success: true,
        url: mockUrl,
        fileName: `mock_${type}_${Date.now()}.jpg`,
        fileSize: 0,
        type: type,
        isMock: true,
      };
    }
    
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Delete uploaded image
 * @param {string} imageUrl - Image URL to delete
 * @returns {Promise<object>} Deletion result
 */
export const deleteImage = async (imageUrl) => {
  try {
    if (!imageUrl || imageUrl.includes('placeholder')) {
      return { success: true, message: 'No image to delete' };
    }

    const { getToken } = await import('./authService');
    const token = await getToken();
    
    if (!token) {
      throw new Error('Authentication required for image deletion');
    }

    const response = await fetch(`${API_BASE_URL}/upload/image`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl }),
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      message: result.message,
    };
  } catch (error) {
    console.error('❌ Image delete error:', error);
    
    // For development: Return success when backend is not available
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return {
        success: true,
        message: 'Mock deletion successful',
        isMock: true,
      };
    }
    
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get image upload progress (for future enhancement)
 * @param {string} uploadId - Upload ID for tracking
 * @returns {Promise<object>} Upload progress
 */
export const getUploadProgress = async (uploadId) => {
  // Placeholder for future implementation
  return {
    uploadId,
    progress: 100,
    status: 'completed',
  };
};

/**
 * Validate image file before upload
 * @param {string} imageUri - Image URI to validate
 * @returns {Promise<object>} Validation result
 */
export const validateImage = async (imageUri) => {
  try {
    // Basic validation
    if (!imageUri) {
      return {
        valid: false,
        error: 'No image selected',
      };
    }

    // Check file extension
    const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const extension = imageUri.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(extension)) {
      return {
        valid: false,
        error: 'Invalid file type. Please use JPG, PNG, or WebP format.',
      };
    }

    // For React Native, we can't easily check file size without additional libraries
    // In a real implementation, you might want to add file size validation
    
    return {
      valid: true,
      extension,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
};

export default {
  uploadImage,
  deleteImage,
  getUploadProgress,
  validateImage,
};