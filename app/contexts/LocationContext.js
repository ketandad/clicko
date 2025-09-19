import React, { createContext, useState, useContext, useEffect } from 'react';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

const LocationContext = createContext();

export function useLocation() {
  return useContext(LocationContext);
}

export function LocationProvider({ children }) {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeLocation();
  }, []);

  const initializeLocation = async () => {
    try {
      setLoading(true);
      console.log('📍 LocationContext: Initializing location services...');

      // Load saved location first
      const savedLocation = await loadSavedLocation();
      if (savedLocation) {
        console.log('📍 LocationContext: Setting saved location:', savedLocation);
        setSelectedLocation(savedLocation);
        console.log('📍 LocationContext: Loaded saved location:', savedLocation.area);
      }

      // Request location permissions
      const permissionResult = await requestLocationPermission();
      console.log('📍 LocationContext: Permission result:', permissionResult);
      if (permissionResult) {
        // Get current location if permission granted
        console.log('📍 LocationContext: Getting current location...');
        await getCurrentLocation();
      } else {
        console.log('❌ LocationContext: Permission denied, using saved location only');
      }
    } catch (error) {
      console.error('❌ LocationContext: Error initializing location:', error);
      setError('Failed to initialize location services');
    } finally {
      setLoading(false);
      console.log('📍 LocationContext: Initialization complete');
    }
  };  const requestLocationPermission = async () => {
    try {
      console.log('🔐 LocationContext: Requesting location permission...');
      
      // Check current permission status
      let { status } = await Location.getForegroundPermissionsAsync();
      console.log('📋 LocationContext: Current permission status:', status);

      if (status !== 'granted') {
        console.log('❓ LocationContext: Permission not granted, requesting...');
        const permission = await Location.requestForegroundPermissionsAsync();
        status = permission.status;
        console.log('📋 LocationContext: New permission status:', status);
      }

      setLocationPermission(status);

      if (status === 'granted') {
        console.log('✅ LocationContext: Location permission granted');
        return true;
      } else {
        console.log('❌ LocationContext: Location permission denied');
        setError('Location permission is required for better service experience');
        return false;
      }
    } catch (error) {
      console.error('❌ LocationContext: Error requesting permission:', error);
      setError('Failed to request location permission');
      return false;
    }
  };

  const getCurrentLocation = async () => {
    try {
      console.log('📍 LocationContext: Getting current location...');
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000,
      });

      console.log('📍 LocationContext: Got coordinates:', {
        lat: location.coords.latitude,
        lng: location.coords.longitude
      });

      // Reverse geocode to get address
      const address = await reverseGeocode(location.coords);
      
      const locationData = {
        coordinates: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        address: address.formattedAddress,
        area: address.area,
        city: address.city,
        country: address.country,
        timestamp: new Date().toISOString(),
      };

      console.log('✅ LocationContext: Setting location data:', locationData);
      setCurrentLocation(locationData);
      
      // If no selected location, use current location
      if (!selectedLocation) {
        console.log('📍 LocationContext: Setting as selected location');
        setSelectedLocation(locationData);
        await saveLocation(locationData);
      }

      console.log('✅ LocationContext: Location updated successfully');
      return locationData;
    } catch (error) {
      console.error('❌ LocationContext: Error getting current location:', error);
      setError('Failed to get current location');
      return null;
    }
  };

  const reverseGeocode = async (coords) => {
    try {
      console.log('🔍 LocationContext: Reverse geocoding coordinates...');
      
      const geocoded = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      if (geocoded.length > 0) {
        const place = geocoded[0];
        console.log('📍 LocationContext: Geocoded result:', place);
        
        // Extract area information with better fallback logic
        const area = place.district || place.subregion || place.name || place.street;
        const city = place.city || place.region || place.subregion;
        const country = place.country;
        
        console.log('📍 LocationContext: Raw geocoding place data:', {
          name: place.name,
          street: place.street,
          district: place.district,
          subregion: place.subregion,
          city: place.city,
          region: place.region,
          country: place.country
        });
        
        // Create a more readable area name
        let displayArea = area;
        if (area && city && area !== city) {
          displayArea = `${area}, ${city}`;
        } else if (city) {
          displayArea = city;
        } else if (place.name) {
          displayArea = place.name;
        } else {
          displayArea = 'Current Location';
        }
        
        const formattedAddress = [
          place.name,
          place.street,
          place.district,
          place.city,
          place.region
        ].filter(Boolean).join(', ');

        console.log('📍 LocationContext: Processed geocoding data:', {
          originalArea: area,
          displayArea,
          city,
          formattedAddress
        });

        return {
          area: displayArea || 'Current Location',
          city: city || 'Unknown City',
          country: country || 'Unknown Country',
          formattedAddress: formattedAddress || 'Unknown Address',
          rawData: place
        };
      } else {
        throw new Error('No geocoding results found');
      }
    } catch (error) {
      console.error('❌ LocationContext: Error reverse geocoding:', error);
      return {
        area: 'Current Location',
        city: 'Unknown City',
        country: 'Unknown Country',
        formattedAddress: 'Current Location'
      };
    }
  };

  const selectLocation = async (location) => {
    try {
      console.log('📍 LocationContext: Selecting new location:', location);
      setSelectedLocation(location);
      await saveLocation(location);
    } catch (error) {
      console.error('❌ LocationContext: Error selecting location:', error);
    }
  };

  const saveLocation = async (location) => {
    try {
      await SecureStore.setItemAsync('selectedLocation', JSON.stringify(location));
      console.log('💾 LocationContext: Location saved to storage');
    } catch (error) {
      console.error('❌ LocationContext: Error saving location:', error);
    }
  };

  const loadSavedLocation = async () => {
    try {
      const saved = await SecureStore.getItemAsync('selectedLocation');
      if (saved) {
        const location = JSON.parse(saved);
        console.log('📦 LocationContext: Found saved location:', location);
        return location;
      }
      return null;
    } catch (error) {
      console.error('❌ LocationContext: Error loading saved location:', error);
      return null;
    }
  };

  const refreshLocation = async () => {
    setLoading(true);
    setError(null);
    
    if (locationPermission === 'granted') {
      await getCurrentLocation();
    } else {
      const permissionGranted = await requestLocationPermission();
      if (permissionGranted) {
        await getCurrentLocation();
      }
    }
    
    setLoading(false);
  };

  const value = {
    currentLocation,
    selectedLocation,
    locationPermission,
    loading,
    error,
    selectLocation,
    refreshLocation,
    requestLocationPermission,
    getCurrentLocation,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}