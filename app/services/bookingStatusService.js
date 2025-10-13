/**
 * Booking Status Tracking Service
 * Manages real-time status updates and progress monitoring
 * Integrates with WebSocket for live updates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

class BookingStatusService {
    constructor() {
        this.baseUrl = 'http://localhost:8000';
        this.websocket = null;
        this.statusListeners = new Map(); // booking_id -> callback functions
    }

    /**
     * Update booking status
     */
    async updateBookingStatus(bookingId, newStatus, options = {}) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${this.baseUrl}/booking-status/update-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    booking_id: bookingId,
                    new_status: newStatus,
                    reason: options.reason,
                    notes: options.notes,
                    metadata: options.metadata,
                    location: options.location
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to update status');
            }

            const result = await response.json();
            
            // Trigger local status update
            this.notifyStatusListeners(bookingId, newStatus, result.data);
            
            console.log('📊 Status updated:', bookingId, '->', newStatus);
            return result;

        } catch (error) {
            console.error('Error updating booking status:', error);
            throw error;
        }
    }

    /**
     * Update agent location during active booking
     */
    async updateAgentLocation(bookingId, location) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${this.baseUrl}/booking-status/update-location`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    booking_id: bookingId,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    eta_minutes: location.eta_minutes,
                    status_message: location.status_message
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to update location');
            }

            const result = await response.json();
            console.log('📍 Location updated for booking:', bookingId);
            return result;

        } catch (error) {
            console.error('Error updating agent location:', error);
            throw error;
        }
    }

    /**
     * Get current booking progress
     */
    async getBookingProgress(bookingId) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${this.baseUrl}/booking-status/progress/${bookingId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to get progress');
            }

            return await response.json();

        } catch (error) {
            console.error('Error getting booking progress:', error);
            throw error;
        }
    }

    /**
     * Get booking status history
     */
    async getBookingStatusHistory(bookingId) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${this.baseUrl}/booking-status/history/${bookingId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to get history');
            }

            return await response.json();

        } catch (error) {
            console.error('Error getting booking history:', error);
            throw error;
        }
    }

    /**
     * Get active bookings for agent
     */
    async getAgentActiveBookings(agentId) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${this.baseUrl}/booking-status/agent/${agentId}/active-bookings`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to get active bookings');
            }

            return await response.json();

        } catch (error) {
            console.error('Error getting agent active bookings:', error);
            throw error;
        }
    }

    /**
     * Get booking analytics
     */
    async getBookingAnalytics(bookingId) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${this.baseUrl}/booking-status/analytics/${bookingId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to get analytics');
            }

            return await response.json();

        } catch (error) {
            console.error('Error getting booking analytics:', error);
            throw error;
        }
    }

    /**
     * Connect to WebSocket for real-time status updates
     */
    connectToStatusUpdates(bookingId, onStatusUpdate) {
        try {
            // Create WebSocket connection if not exists
            if (!this.websocket || this.websocket.readyState === WebSocket.CLOSED) {
                this.websocket = new WebSocket(`ws://localhost:8000/ws/booking-status`);
                
                this.websocket.onopen = () => {
                    console.log('🔌 Connected to booking status WebSocket');
                    
                    // Subscribe to booking updates
                    this.websocket.send(JSON.stringify({
                        type: 'subscribe_booking',
                        booking_id: bookingId
                    }));
                };

                this.websocket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        
                        if (data.type === 'status_update' && data.booking_id === bookingId) {
                            console.log('📊 Received status update:', data);
                            
                            // Notify all listeners for this booking
                            this.notifyStatusListeners(bookingId, data.new_status, data);
                        }
                        
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                this.websocket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                };

                this.websocket.onclose = () => {
                    console.log('🔌 Booking status WebSocket disconnected');
                    
                    // Attempt to reconnect after 3 seconds
                    setTimeout(() => {
                        if (this.statusListeners.size > 0) {
                            console.log('🔄 Attempting to reconnect to booking status WebSocket');
                            this.connectToStatusUpdates(bookingId, onStatusUpdate);
                        }
                    }, 3000);
                };
            }

            // Add status listener
            this.addStatusListener(bookingId, onStatusUpdate);
            
        } catch (error) {
            console.error('Error connecting to status updates:', error);
        }
    }

    /**
     * Disconnect from WebSocket
     */
    disconnectFromStatusUpdates(bookingId) {
        try {
            // Remove listener
            if (this.statusListeners.has(bookingId)) {
                this.statusListeners.delete(bookingId);
            }

            // Close WebSocket if no more listeners
            if (this.statusListeners.size === 0 && this.websocket) {
                this.websocket.close();
                this.websocket = null;
            }
            
        } catch (error) {
            console.error('Error disconnecting from status updates:', error);
        }
    }

    /**
     * Add status listener for a booking
     */
    addStatusListener(bookingId, callback) {
        if (!this.statusListeners.has(bookingId)) {
            this.statusListeners.set(bookingId, []);
        }
        this.statusListeners.get(bookingId).push(callback);
    }

    /**
     * Remove status listener
     */
    removeStatusListener(bookingId, callback) {
        if (this.statusListeners.has(bookingId)) {
            const listeners = this.statusListeners.get(bookingId);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
                
                // Remove booking from map if no more listeners
                if (listeners.length === 0) {
                    this.statusListeners.delete(bookingId);
                }
            }
        }
    }

    /**
     * Notify all status listeners for a booking
     */
    notifyStatusListeners(bookingId, newStatus, data) {
        if (this.statusListeners.has(bookingId)) {
            const listeners = this.statusListeners.get(bookingId);
            listeners.forEach(callback => {
                try {
                    callback(newStatus, data);
                } catch (error) {
                    console.error('Error in status listener callback:', error);
                }
            });
        }
    }

    /**
     * Get status display information
     */
    getStatusInfo(status) {
        const statusMap = {
            'pending': {
                label: 'Booking Pending',
                color: '#FFA500',
                icon: '⏳',
                description: 'Waiting for agent to accept'
            },
            'accepted': {
                label: 'Booking Accepted',
                color: '#4CAF50',
                icon: '✅',
                description: 'Agent has accepted your booking'
            },
            'agent_en_route': {
                label: 'Agent En Route',
                color: '#2196F3',
                icon: '🚗',
                description: 'Agent is on the way to you'
            },
            'service_in_progress': {
                label: 'Service In Progress',
                color: '#FF9800',
                icon: '🔧',
                description: 'Service is currently being performed'
            },
            'completed': {
                label: 'Service Completed',
                color: '#4CAF50',
                icon: '✅',
                description: 'Service has been completed successfully'
            },
            'cancelled': {
                label: 'Booking Cancelled',
                color: '#F44336',
                icon: '❌',
                description: 'Booking has been cancelled'
            }
        };

        return statusMap[status] || {
            label: status,
            color: '#757575',
            icon: '❓',
            description: 'Unknown status'
        };
    }

    /**
     * Calculate progress percentage based on status
     */
    getProgressPercentage(status) {
        const progressMap = {
            'pending': 10,
            'accepted': 25,
            'agent_en_route': 50,
            'service_in_progress': 75,
            'completed': 100,
            'cancelled': 0
        };

        return progressMap[status] || 0;
    }

    /**
     * Format time duration
     */
    formatDuration(minutes) {
        if (minutes < 60) {
            return `${minutes} min${minutes !== 1 ? 's' : ''}`;
        }
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (remainingMinutes === 0) {
            return `${hours} hour${hours !== 1 ? 's' : ''}`;
        }
        
        return `${hours}h ${remainingMinutes}m`;
    }

    /**
     * Format estimated arrival time
     */
    formatETA(etaMinutes) {
        if (!etaMinutes) return 'Calculating...';
        
        const now = new Date();
        const arrivalTime = new Date(now.getTime() + (etaMinutes * 60000));
        
        return {
            time: arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            duration: this.formatDuration(etaMinutes),
            minutes: etaMinutes
        };
    }
}

// Export singleton instance
export default new BookingStatusService();