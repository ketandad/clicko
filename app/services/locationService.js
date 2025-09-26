/**
 * Location Service
 * Handles location tracking, geocoding, and address management
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://localhost:8000';

class LocationService {
    /**
     * Reverse geocode coordinates to get address
     */
    async reverseGeocode(latitude, longitude) {
        try {
            // For now, return a mock address structure
            // In production, you'd use Google Maps Geocoding API or similar
            return {
                formatted_address: `Address near ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                street_number: Math.floor(Math.random() * 999) + 1,
                street_name: 'Main Street',
                locality: 'Central Area',
                city: 'Mumbai',
                state: 'Maharashtra',
                country: 'India',
                pincode: '400001',
                landmark: 'Near Metro Station',
                latitude,
                longitude
            };
        } catch (error) {
            console.error('Reverse geocode error:', error);
            throw new Error('Failed to get address from coordinates');
        }
    }

    /**
     * Forward geocode address to get coordinates
     */
    async geocodeAddress(address) {
        try {
            // Mock geocoding - in production use Google Maps Geocoding API
            const mockCoordinates = {
                latitude: 19.0760 + (Math.random() - 0.5) * 0.1,
                longitude: 72.8777 + (Math.random() - 0.5) * 0.1
            };
            
            return {
                ...mockCoordinates,
                formatted_address: address,
                accuracy: 'high'
            };
        } catch (error) {
            console.error('Geocode address error:', error);
            throw new Error('Failed to get coordinates from address');
        }
    }

    /**
     * Get address suggestions for autocomplete
     */
    async getAddressSuggestions(query, userLocation = null) {
        try {
            // Mock address suggestions
            const suggestions = [
                `${query} Main Street, Mumbai`,
                `${query} Road, Andheri, Mumbai`,
                `${query} Complex, Bandra, Mumbai`,
                `${query} Heights, Powai, Mumbai`,
                `${query} Plaza, Malad, Mumbai`
            ];

            return suggestions.map((suggestion, index) => ({
                id: index,
                description: suggestion,
                place_id: `place_${index}`,
                structured_formatting: {
                    main_text: suggestion.split(',')[0],
                    secondary_text: suggestion.split(',').slice(1).join(',')
                }
            }));
        } catch (error) {
            console.error('Get address suggestions error:', error);
            return [];
        }
    }

    /**
     * Save address to user's saved addresses
     */
    async saveUserAddress(userId, addressData) {
        try {
            const savedAddresses = await this.getSavedAddresses(userId);
            
            const newAddress = {
                id: Date.now(),
                ...addressData,
                saved_at: new Date().toISOString(),
                is_default: savedAddresses.length === 0 // First address becomes default
            };

            const updatedAddresses = [...savedAddresses, newAddress];
            
            await AsyncStorage.setItem(
                `saved_addresses_${userId}`,
                JSON.stringify(updatedAddresses)
            );

            return newAddress;
        } catch (error) {
            console.error('Save user address error:', error);
            throw error;
        }
    }

    /**
     * Get user's saved addresses
     */
    async getSavedAddresses(userId) {
        try {
            const savedData = await AsyncStorage.getItem(`saved_addresses_${userId}`);
            return savedData ? JSON.parse(savedData) : [];
        } catch (error) {
            console.error('Get saved addresses error:', error);
            return [];
        }
    }

    /**
     * Update agent location during service
     */
    async updateAgentLocation(agentId, lat, lng) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${API_BASE_URL}/api/agents/${agentId}/location`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    latitude: lat,
                    longitude: lng,
                    timestamp: new Date().toISOString()
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update agent location');
            }

            return await response.json();
        } catch (error) {
            console.error('Update agent location error:', error);
            // Return success for offline mode
            return { success: true };
        }
    }

    /**
     * Get agent location for booking tracking
     */
    async getAgentLocation(bookingId) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}/agent-location`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to get agent location');
            }

            return await response.json();
        } catch (error) {
            console.error('Get agent location error:', error);
            // Return mock location for offline mode
            return { 
                lat: 19.0760 + (Math.random() - 0.5) * 0.01, 
                lng: 72.8777 + (Math.random() - 0.5) * 0.01,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Calculate distance between two coordinates
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in kilometers
    }

    /**
     * Convert degrees to radians
     */
    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Validate coordinates
     */
    validateCoordinates(latitude, longitude) {
        return (
            typeof latitude === 'number' &&
            typeof longitude === 'number' &&
            latitude >= -90 && latitude <= 90 &&
            longitude >= -180 && longitude <= 180
        );
    }

    /**
     * Get current location with high accuracy
     */
    async getCurrentLocationHighAccuracy() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    });
                },
                (error) => {
                    reject(new Error(`Location error: ${error.message}`));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }

    /**
     * Check if address is within service area
     */
    async isAddressInServiceArea(latitude, longitude, serviceAreaRadius = 25) {
        try {
            // Define service center (can be dynamic based on city)
            const serviceCenterLat = 19.0760; // Mumbai coordinates
            const serviceCenterLng = 72.8777;
            
            const distance = this.calculateDistance(
                latitude, longitude,
                serviceCenterLat, serviceCenterLng
            );
            
            return {
                inServiceArea: distance <= serviceAreaRadius,
                distance: distance,
                maxDistance: serviceAreaRadius
            };
        } catch (error) {
            console.error('Service area check error:', error);
            return { inServiceArea: true, distance: 0 }; // Default to allowing service
        }
    }
}

// Legacy exports for compatibility
export async function updateAgentLocation(agentId, lat, lng) {
    return locationService.updateAgentLocation(agentId, lat, lng);
}

export async function getAgentLocation(bookingId) {
    return locationService.getAgentLocation(bookingId);
}

const locationService = new LocationService();
export default locationService;
