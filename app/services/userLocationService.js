/**
 * User Location Service for Agent Discovery
 * =======================================
 * 
 * Optimized location service specifically for finding nearby agents.
 * Handles GPS permissions, location accuracy, and caching for performance.
 * Designed to handle >1M communications efficiently.
 */

import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

class UserLocationService {
  constructor() {
    this.currentLocation = null;
    this.lastLocationUpdate = null;
    this.locationCache = new Map(); // In-memory cache for performance
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
    this.LOCATION_ACCURACY_THRESHOLD = 100; // meters
    this.locationWatchers = new Set(); // For real-time location updates
  }

  /**
   * Get current user location with caching and accuracy validation
   * @param {boolean} forceRefresh - Skip cache and get fresh location
   * @returns {Promise<{latitude: number, longitude: number, accuracy: number, timestamp: number}>}
   */
  async getCurrentLocation(forceRefresh = false) {
    try {
      console.log('📍 UserLocationService: Getting current location...');

      // Return cached location if available and fresh
      if (!forceRefresh && this.currentLocation && this.isLocationFresh()) {
        console.log('📍 UserLocationService: Returning cached location');
        return this.currentLocation;
      }

      // Check/request permissions
      const hasPermission = await this.ensureLocationPermission();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      // Get current position with optimal settings
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Good balance of speed and accuracy
        timeout: 10000, // 10 second timeout
        maximumAge: 60000, // Accept cached position up to 1 minute old
      });

      // Validate location accuracy
      if (location.coords.accuracy > this.LOCATION_ACCURACY_THRESHOLD) {
        console.warn('⚠️ UserLocationService: Low accuracy location:', location.coords.accuracy);
        // Still use it but flag as low accuracy
      }

      // Create location object
      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: Date.now(),
        source: 'gps'
      };

      // Cache the location
      this.currentLocation = locationData;
      this.lastLocationUpdate = Date.now();
      
      // Save to persistent storage for offline use
      await this.saveLocationToStorage(locationData);

      console.log('✅ UserLocationService: Location updated:', {
        lat: locationData.latitude.toFixed(6),
        lng: locationData.longitude.toFixed(6),
        accuracy: locationData.accuracy + 'm'
      });

      // Notify watchers
      this.notifyLocationWatchers(locationData);

      return locationData;

    } catch (error) {
      console.error('❌ UserLocationService: Error getting location:', error);
      
      // Try to return cached location as fallback
      if (this.currentLocation) {
        console.log('📍 UserLocationService: Using cached location as fallback');
        return this.currentLocation;
      }

      // Try to load from storage as last resort
      const savedLocation = await this.loadLocationFromStorage();
      if (savedLocation) {
        console.log('📍 UserLocationService: Using saved location as fallback');
        this.currentLocation = savedLocation;
        return savedLocation;
      }

      throw new Error('Unable to get user location: ' + error.message);
    }
  }

  /**
   * Request and validate location permissions
   * @returns {Promise<boolean>} True if permission granted
   */
  async ensureLocationPermission() {
    try {
      // Check current permission status
      let { status } = await Location.getForegroundPermissionsAsync();
      
      // Request permission if not granted
      if (status !== 'granted') {
        console.log('🔐 UserLocationService: Requesting location permission...');
        const permission = await Location.requestForegroundPermissionsAsync();
        status = permission.status;
      }

      if (status === 'granted') {
        console.log('✅ UserLocationService: Location permission granted');
        return true;
      } else {
        console.log('❌ UserLocationService: Location permission denied');
        return false;
      }
    } catch (error) {
      console.error('❌ UserLocationService: Permission request failed:', error);
      return false;
    }
  }

  /**
   * Get location optimized for nearby agent search
   * @param {number} radiusKm - Search radius in kilometers
   * @returns {Promise<{latitude: number, longitude: number, radiusKm: number}>}
   */
  async getLocationForAgentSearch(radiusKm = 10) {
    try {
      const location = await this.getCurrentLocation();
      
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        radiusKm: radiusKm,
        accuracy: location.accuracy,
        searchId: `search_${Date.now()}` // For caching search results
      };
    } catch (error) {
      console.error('❌ UserLocationService: Error getting location for agent search:', error);
      throw error;
    }
  }

  /**
   * Start watching location changes for real-time updates
   * @param {Function} callback - Called when location changes
   * @param {Object} options - Watch options
   * @returns {Object} Watcher object with stop() method
   */
  async startLocationWatcher(callback, options = {}) {
    try {
      const hasPermission = await this.ensureLocationPermission();
      if (!hasPermission) {
        throw new Error('Location permission required for location watching');
      }

      const watchOptions = {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: options.timeInterval || 30000, // 30 seconds
        distanceInterval: options.distanceInterval || 100, // 100 meters
        ...options
      };

      const watcher = await Location.watchPositionAsync(watchOptions, (location) => {
        const locationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          timestamp: Date.now(),
          source: 'watch'
        };

        // Update cached location
        this.currentLocation = locationData;
        this.lastLocationUpdate = Date.now();

        // Call the callback
        if (callback) {
          callback(locationData);
        }

        console.log('📍 UserLocationService: Location watcher update:', {
          lat: locationData.latitude.toFixed(6),
          lng: locationData.longitude.toFixed(6)
        });
      });

      // Store watcher reference
      const watcherObj = {
        id: Date.now(),
        watcher,
        stop: () => {
          watcher.remove();
          this.locationWatchers.delete(watcherObj);
          console.log('🛑 UserLocationService: Location watcher stopped');
        }
      };

      this.locationWatchers.add(watcherObj);
      console.log('👀 UserLocationService: Location watcher started');
      
      return watcherObj;

    } catch (error) {
      console.error('❌ UserLocationService: Error starting location watcher:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param {number} lat1 - Latitude 1
   * @param {number} lon1 - Longitude 1  
   * @param {number} lat2 - Latitude 2
   * @param {number} lon2 - Longitude 2
   * @returns {number} Distance in kilometers
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Utility functions
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  isLocationFresh() {
    return this.lastLocationUpdate && 
           (Date.now() - this.lastLocationUpdate) < this.CACHE_DURATION;
  }

  async saveLocationToStorage(location) {
    try {
      await SecureStore.setItemAsync('user_last_location', JSON.stringify(location));
    } catch (error) {
      console.warn('⚠️ UserLocationService: Failed to save location to storage:', error);
    }
  }

  async loadLocationFromStorage() {
    try {
      const saved = await SecureStore.getItemAsync('user_last_location');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('⚠️ UserLocationService: Failed to load location from storage:', error);
      return null;
    }
  }

  notifyLocationWatchers(location) {
    this.locationWatchers.forEach(watcher => {
      try {
        if (watcher.callback) {
          watcher.callback(location);
        }
      } catch (error) {
        console.warn('⚠️ UserLocationService: Error notifying location watcher:', error);
      }
    });
  }

  /**
   * Stop all location watchers and cleanup
   */
  cleanup() {
    this.locationWatchers.forEach(watcher => {
      try {
        watcher.stop();
      } catch (error) {
        console.warn('⚠️ UserLocationService: Error stopping watcher:', error);
      }
    });
    this.locationWatchers.clear();
    console.log('🧹 UserLocationService: Cleanup completed');
  }

  /**
   * Get location status and debug info
   */
  getStatus() {
    return {
      hasLocation: !!this.currentLocation,
      locationAge: this.lastLocationUpdate ? Date.now() - this.lastLocationUpdate : null,
      isFresh: this.isLocationFresh(),
      watcherCount: this.locationWatchers.size,
      currentLocation: this.currentLocation
    };
  }
}

// Export singleton instance
export const userLocationService = new UserLocationService();
export default userLocationService;