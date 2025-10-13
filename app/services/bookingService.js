/**
 * Booking Service
 * Handles service booking with real-time agent notifications and status tracking
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'http://localhost:8000';

class BookingService {
    
    /**
     * Get authentication token from secure storage
     */
    async getAuthToken() {
        try {
            console.log('🔑 BookingService: Getting auth token...');
            let token = await AsyncStorage.getItem('authToken');
            console.log('🔑 BookingService: AsyncStorage authToken:', token ? 'Found' : 'Not found');
            
            if (!token) {
                token = await SecureStore.getItemAsync('userToken');
                console.log('🔑 BookingService: SecureStore userToken:', token ? 'Found' : 'Not found');
            }
            
            return token;
        } catch (error) {
            console.error('❌ BookingService: Error getting auth token:', error);
            throw new Error('Failed to retrieve authentication token: ' + error.message);
        }
    }
    
    /**
     * Create a new service booking
     * Triggers bell notification to agent that rings until accept/reject
     */
    async createBooking(bookingData) {
        try {
            const token = await this.getAuthToken();
            console.log('🔑 BookingService: Token retrieved:', token ? 'Present' : 'Missing');
            console.log('🔄 BookingService: Sending booking request to:', `${API_BASE_URL}/api/bookings/create`);
            console.log('📋 BookingService: Booking data:', JSON.stringify(bookingData, null, 2));
            
            const response = await fetch(`${API_BASE_URL}/api/bookings/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(bookingData),
            });

            console.log('📡 BookingService: API Response status:', response.status);
            console.log('📡 BookingService: API Response headers:', response.headers);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ BookingService: API Error response:', errorData);
                throw new Error(errorData.detail || 'Failed to create booking');
            }

            const result = await response.json();
            console.log('✅ BookingService: API Success response:', result);
            
            // Store booking UUID locally for tracking
            await AsyncStorage.setItem(`booking_${result.booking_uuid}`, JSON.stringify({
                uuid: result.booking_uuid,
                status: result.status || 'pending',
                created_at: new Date().toISOString(),
                agent_id: bookingData.agent_id,
            }));

            // NOTE: Backend already sends WebSocket notification to agent
            // No need for duplicate client-side notification call
            console.log('✅ BookingService: Backend handles agent notification via WebSocket');

            return result;
        } catch (error) {
            console.error('❌ BookingService: Create booking error:', error);
            throw error;
        }
    }

    /**
     * Update booking status (accept/reject by agent, cancel by customer)
     */
    async updateBookingStatus(bookingUuid, status, reason = null, locationData = null) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const updateData = { status };
            if (reason) updateData.reason = reason;
            if (locationData) {
                updateData.location_latitude = locationData.latitude;
                updateData.location_longitude = locationData.longitude;
            }

            const response = await fetch(`${API_BASE_URL}/api/bookings/${bookingUuid}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(updateData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to update booking status');
            }

            const result = await response.json();
            
            // Update local storage
            const bookingKey = `booking_${bookingUuid}`;
            const storedBooking = await AsyncStorage.getItem(bookingKey);
            if (storedBooking) {
                const booking = JSON.parse(storedBooking);
                booking.status = status;
                booking.updated_at = new Date().toISOString();
                await AsyncStorage.setItem(bookingKey, JSON.stringify(booking));
            }

            return result;
        } catch (error) {
            console.error('Update booking status error:', error);
            throw error;
        }
    }

    /**
     * Send bell notification to agent for new booking
     * Agent gets continuous bell notification until they accept/reject (30-second timeout)
     */
    async sendAgentNotification(bookingId, bookingData) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            // Prepare notification data for agent
            const notificationData = {
                booking_id: bookingId,
                agent_id: bookingData.agent_id,
                customer_name: bookingData.customer_name,
                customer_phone: bookingData.customer_phone,
                service_type: bookingData.service_type,
                service_details: bookingData.service_details,
                location: {
                    latitude: bookingData.location?.latitude,
                    longitude: bookingData.location?.longitude
                },
                address: bookingData.address,
                scheduled_time: bookingData.scheduled_time,
                estimated_cost: bookingData.total_cost,
                visit_charges: bookingData.visit_charges,
                service_charges: bookingData.service_charges,
                emergency: bookingData.emergency || false,
                customer_notes: bookingData.notes
            };

            const response = await fetch(`${API_BASE_URL}/api/notifications/send-booking-notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(notificationData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to send agent notification');
            }

            const result = await response.json();
            console.log('🔔 Bell notification sent to agent:', result);
            
            return result;
        } catch (error) {
            console.error('Send agent notification error:', error);
            throw error;
        }
    }

    /**
     * Get agent connection status (whether they can receive notifications)
     */
    async getAgentConnectionStatus(agentId) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${API_BASE_URL}/api/notifications/agent/${agentId}/connection-status`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to get agent status');
            }

            return await response.json();
        } catch (error) {
            console.error('Get agent connection status error:', error);
            throw error;
        }
    }

    /**
     * Get agent notifications (for bell notifications)
     * Used by agents to get pending booking requests
     */
    async getAgentNotifications(includeExpired = false) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(
                `${API_BASE_URL}/api/bookings/agent/notifications?include_expired=${includeExpired}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to get notifications');
            }

            return await response.json();
        } catch (error) {
            console.error('Get agent notifications error:', error);
            throw error;
        }
    }

    /**
     * Calculate total booking cost with visit charges and service charges
     */
    calculateBookingCost(agentPricing, selectedServices = []) {
        let totalCost = 0;
        
        // Add visit charge (base charge for agent to visit)
        if (agentPricing.visit_charge) {
            totalCost += parseFloat(agentPricing.visit_charge);
        }
        
        // Add selected service charges
        selectedServices.forEach(service => {
            if (service.price && service.quantity) {
                totalCost += parseFloat(service.price) * parseInt(service.quantity);
            }
        });
        
        return totalCost;
    }

    /**
     * Format booking status for display
     */
    formatBookingStatus(status) {
        const statusMap = {
            'pending': { text: 'Pending Agent Response', color: '#FFA500' },
            'accepted': { text: 'Accepted', color: '#4CAF50' },
            'rejected': { text: 'Rejected', color: '#F44336' },
            'cancelled': { text: 'Cancelled', color: '#757575' },
            'agent_en_route': { text: 'Agent En Route', color: '#2196F3' },
            'service_started': { text: 'Service in Progress', color: '#FF9800' },
            'service_completed': { text: 'Service Completed', color: '#8BC34A' },
            'payment_pending': { text: 'Payment Pending', color: '#9C27B0' },
            'completed': { text: 'Completed', color: '#4CAF50' },
            'refunded': { text: 'Refunded', color: '#607D8B' },
        };
        
        return statusMap[status] || { text: status, color: '#757575' };
    }

    /**
     * Helper function to validate booking data before submission
     */
    validateBookingData(bookingData) {
        const required = [
            'agent_id', 'service_category', 'service_latitude', 'service_longitude',
            'service_address', 'service_city', 'service_state', 'service_pincode',
            'total_amount'
        ];
        
        const missing = required.filter(field => !bookingData[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }
        
        // Validate coordinates
        if (bookingData.service_latitude < -90 || bookingData.service_latitude > 90) {
            throw new Error('Invalid latitude');
        }
        
        if (bookingData.service_longitude < -180 || bookingData.service_longitude > 180) {
            throw new Error('Invalid longitude');
        }
        
        // Validate amount
        if (parseFloat(bookingData.total_amount) <= 0) {
            throw new Error('Total amount must be greater than 0');
        }
        
        return true;
    }

    /**
     * Complete a booking and trigger review prompt
     * Called when agent marks service as completed
     */
    async completeBooking(bookingId) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to complete booking');
            }

            const result = await response.json();
            
            // Update local storage
            const storedBooking = await AsyncStorage.getItem(`booking_${bookingId}`);
            if (storedBooking) {
                const bookingData = JSON.parse(storedBooking);
                bookingData.status = 'completed';
                bookingData.completed_at = new Date().toISOString();
                await AsyncStorage.setItem(`booking_${bookingId}`, JSON.stringify(bookingData));
            }
            
            return {
                success: true,
                booking: result.booking,
                message: result.message || 'Booking completed successfully'
            };
        } catch (error) {
            console.error('Complete booking error:', error);
            throw error;
        }
    }

    /**
     * Check if a booking is eligible for review
     */
    async checkReviewEligibility(bookingId) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}/review-eligibility`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to check review eligibility');
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Check review eligibility error:', error);
            throw error;
        }
    }
}

// Legacy function for compatibility
export async function estimateBooking({ userLat, userLng, agentLat, agentLng, rate }) {
  // Simulate distance calculation (Haversine formula)
  function haversine(lat1, lon1, lat2, lon2) {
    const toRad = x => (x * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  const distance = haversine(userLat, userLng, agentLat, agentLng);
  const charge = Math.round(distance * rate);
  return { distance, charge };
}

export default new BookingService();
