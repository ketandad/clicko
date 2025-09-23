// API Health Check Utility
import config from '../config';

export async function checkApiHealth() {
  try {
    console.log('🔍 API Health Check: Testing backend connectivity...');
    
    const response = await fetch(`${config.API_URL.replace('/api', '')}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000, // 5 second timeout
    });

    console.log('📡 API Health Check: Response status:', response.status);

    if (response.ok) {
      // Check if response is actually JSON
      const responseText = await response.text();
      if (responseText.trim().startsWith('<') || responseText.includes('<!doctype html>')) {
        console.warn('⚠️ API Health Check: Received HTML instead of JSON - backend not running');
        return {
          isHealthy: false,
          error: 'Backend server appears to be down (received HTML instead of API response)',
          recommendation: 'Please start the backend server using the start-app.sh script'
        };
      }
      
      try {
        const healthData = JSON.parse(responseText);
        console.log('✅ API Health Check: Backend is healthy:', healthData);
        return {
          isHealthy: true,
          data: healthData
        };
      } catch (parseError) {
        console.error('❌ API Health Check: Failed to parse health response:', parseError);
        return {
          isHealthy: false,
          error: 'Backend returned invalid JSON response',
          recommendation: 'Backend server may be starting up - please wait and try again'
        };
      }
    } else {
      console.error('❌ API Health Check: Health endpoint returned error:', response.status);
      return {
        isHealthy: false,
        error: `Health check failed with status ${response.status}`,
        recommendation: 'Backend server may be experiencing issues'
      };
    }
  } catch (error) {
    console.error('❌ API Health Check: Network error:', error);
    return {
      isHealthy: false,
      error: 'Cannot connect to backend server',
      recommendation: 'Please ensure the backend server is running on port 8000'
    };
  }
}

export async function isBackendAccessible() {
  const health = await checkApiHealth();
  return health.isHealthy;
}