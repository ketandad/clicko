/**
 * Nearby Agents Service
 * ====================
 * 
 * Efficient service for discovering nearby agents with performance optimizations.
 * Integrates with userLocationService for optimal location-based searches.
 * Handles caching, retry logic, and error recovery for >1M scale operations.
 */

import config from '../config';
import { getToken } from './authService';
import { userLocationService } from './userLocationService';

const { API_URL: API_BASE_URL } = config;

class NearbyAgentsService {
  constructor() {
    this.searchCache = new Map(); // Cache search results
    this.CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache for agent searches
    this.requestQueue = new Map(); // Prevent duplicate concurrent requests
    this.retryDelays = [1000, 2000, 5000]; // Exponential backoff
  }

  /**
   * Find nearby agents with advanced filtering and caching
   * @param {Object} options - Search parameters
   * @param {number} options.categoryId - Category to filter by
   * @param {number} options.radiusKm - Search radius in kilometers
   * @param {number} options.limit - Maximum number of results
   * @param {string} options.sortBy - Sort by: distance, rating, price
   * @param {boolean} options.forceRefresh - Skip cache and get fresh data
   * @returns {Promise<Array>} Array of nearby agents
   */
  async findNearbyAgents(options = {}) {
    try {
      const {
        categoryId = null,
        radiusKm = 10,
        limit = 20,
        sortBy = 'distance',
        forceRefresh = false
      } = options;

      console.log('🔍 NearbyAgentsService: Searching for nearby agents...', options);

      // Get user's current location
      const userLocation = await userLocationService.getLocationForAgentSearch(radiusKm);
      console.log('📍 NearbyAgentsService: User location:', {
        lat: userLocation.latitude.toFixed(6),
        lng: userLocation.longitude.toFixed(6),
        radius: userLocation.radiusKm
      });

      // Create cache key
      const cacheKey = this.createCacheKey({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        categoryId,
        radiusKm,
        sortBy,
        limit
      });

      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          console.log('💾 NearbyAgentsService: Returning cached results');
          return cached;
        }
      }

      // Prevent duplicate concurrent requests
      if (this.requestQueue.has(cacheKey)) {
        console.log('⏳ NearbyAgentsService: Request already in progress, waiting...');
        return await this.requestQueue.get(cacheKey);
      }

      // Create and execute the request
      const requestPromise = this.executeNearbyAgentsRequest({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        categoryId,
        radiusKm,
        sortBy,
        limit
      });

      this.requestQueue.set(cacheKey, requestPromise);

      try {
        const agents = await requestPromise;
        
        // Cache successful results
        this.setCache(cacheKey, agents);
        
        console.log(`✅ NearbyAgentsService: Found ${agents.length} nearby agents`);
        return agents;

      } finally {
        // Clean up request queue
        this.requestQueue.delete(cacheKey);
      }

    } catch (error) {
      console.error('❌ NearbyAgentsService: Error finding nearby agents:', error);
      
      // Try to return cached data as fallback
      const fallbackKey = this.createCacheKey({
        latitude: 0, longitude: 0, // Use generic key for any location
        categoryId, radiusKm, sortBy, limit
      });
      
      const fallback = this.getFromCache(fallbackKey, true); // Allow stale cache
      if (fallback && fallback.length > 0) {
        console.log('📦 NearbyAgentsService: Returning fallback cached data');
        return fallback;
      }
      
      throw new Error(`Failed to find nearby agents: ${error.message}`);
    }
  }

  /**
   * Execute the actual API request with retry logic
   */
  async executeNearbyAgentsRequest(params) {
    const { latitude, longitude, categoryId, radiusKm, sortBy, limit } = params;

    // Build query parameters
    const queryParams = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius: radiusKm.toString(),
      limit: limit.toString(),
      sort_by: sortBy
    });

    if (categoryId) {
      queryParams.append('category_id', categoryId.toString());
    }

    const url = `${API_BASE_URL}/agents/nearby?${queryParams.toString()}`;
    console.log('🌐 NearbyAgentsService: API URL:', url);

    // Execute with retry logic
    let lastError;
    for (let attempt = 0; attempt < this.retryDelays.length; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.detail) {
              errorMessage = Array.isArray(errorData.detail) 
                ? errorData.detail.map(err => err.msg || err).join(', ')
                : errorData.detail;
            }
          } catch (parseError) {
            errorMessage = `${response.status} - ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const agents = await response.json();
        
        // Validate response structure
        if (!Array.isArray(agents)) {
          throw new Error('Invalid response format: expected array');
        }

        // Enrich agent data with additional computed properties
        const enrichedAgents = agents.map(agent => ({
          ...agent,
          distanceText: this.formatDistance(agent.distance_km),
          ratingText: this.formatRating(agent.avg_rating, agent.total_ratings),
          visitChargeText: this.formatVisitCharge(agent.rate_per_km, agent.distance_km),
          isNearby: agent.distance_km <= 5, // Flag for very nearby agents
          responseTime: this.estimateResponseTime(agent.distance_km),
          searchTimestamp: Date.now()
        }));

        return enrichedAgents;

      } catch (error) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          lastError = new Error('Request timeout - please check your connection');
        }
        
        // If this is the last attempt, throw the error
        if (attempt === this.retryDelays.length - 1) {
          break;
        }
        
        // Wait before retrying
        console.log(`⚠️ NearbyAgentsService: Attempt ${attempt + 1} failed, retrying in ${this.retryDelays[attempt]}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelays[attempt]));
      }
    }

    throw lastError;
  }

  /**
   * Get agents by category with location
   */
  async getAgentsByCategory(categoryId, options = {}) {
    return this.findNearbyAgents({
      categoryId,
      ...options
    });
  }

  /**
   * Search agents by query string with location prioritization
   */
  async searchAgentsNearby(query, options = {}) {
    try {
      const authToken = await getToken();
      const userLocation = await userLocationService.getCurrentLocation();
      
      const queryParams = new URLSearchParams({
        query: query,
        latitude: userLocation.latitude.toString(),
        longitude: userLocation.longitude.toString(),
        max_distance: (options.radiusKm || 25).toString(),
        limit: (options.limit || 20).toString(),
        is_online: 'true'
      });

      const response = await fetch(`${API_BASE_URL}/agents/search?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const agents = await response.json();
      console.log(`🔍 NearbyAgentsService: Search found ${agents.length} agents for "${query}"`);
      
      return agents;

    } catch (error) {
      console.error('❌ NearbyAgentsService: Search error:', error);
      throw error;
    }
  }

  /**
   * Cache management methods
   */
  createCacheKey(params) {
    const { latitude, longitude, categoryId, radiusKm, sortBy, limit } = params;
    // Round coordinates to reduce cache fragmentation
    const roundedLat = Math.round(latitude * 1000) / 1000; // ~100m precision
    const roundedLng = Math.round(longitude * 1000) / 1000;
    
    return `nearby_${roundedLat}_${roundedLng}_${categoryId || 'all'}_${radiusKm}_${sortBy}_${limit}`;
  }

  setCache(key, data) {
    this.searchCache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    this.cleanupCache();
  }

  getFromCache(key, allowStale = false) {
    const cached = this.searchCache.get(key);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    const isStale = age > this.CACHE_DURATION;
    
    if (isStale && !allowStale) {
      this.searchCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  cleanupCache() {
    const now = Date.now();
    const maxAge = this.CACHE_DURATION * 2; // Keep cache for 2x duration
    
    for (const [key, cached] of this.searchCache.entries()) {
      if (now - cached.timestamp > maxAge) {
        this.searchCache.delete(key);
      }
    }
    
    // Limit cache size
    if (this.searchCache.size > 100) {
      const entries = Array.from(this.searchCache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      
      // Keep only the 50 most recent entries
      this.searchCache.clear();
      entries.slice(0, 50).forEach(([key, value]) => {
        this.searchCache.set(key, value);
      });
    }
  }

  /**
   * Utility formatting methods
   */
  formatDistance(distanceKm) {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m away`;
    }
    return `${distanceKm}km away`;
  }

  formatRating(avgRating, totalRatings) {
    if (totalRatings === 0) return 'New agent';
    return `${avgRating.toFixed(1)} ★ (${totalRatings} reviews)`;
  }

  formatVisitCharge(ratePerKm, distanceKm) {
    const charge = Math.ceil(ratePerKm * distanceKm);
    return `₹${charge} visit charge`;
  }

  estimateResponseTime(distanceKm) {
    // Estimate based on distance (assuming 30 km/h average speed in city)
    const timeMinutes = Math.ceil(distanceKm * 2); // 2 minutes per km
    return `~${timeMinutes} min away`;
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.searchCache.clear();
    this.requestQueue.clear();
    console.log('🧹 NearbyAgentsService: Cache cleared');
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    return {
      cacheSize: this.searchCache.size,
      activeRequests: this.requestQueue.size,
      cacheKeys: Array.from(this.searchCache.keys())
    };
  }
}

// Export singleton instance
export const nearbyAgentsService = new NearbyAgentsService();
export default nearbyAgentsService;