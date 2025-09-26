/**
 * NotificationTestService.js
 * Simple test service to simulate booking notifications for development
 */

export const notificationTestService = {
  /**
   * Simulate a booking notification being sent to an agent
   */
  async simulateBookingNotification(agentId, testData = null) {
    const defaultTestData = {
      booking_id: `test-booking-${Date.now()}`,
      agent_id: agentId,
      customer_name: "John Smith",
      customer_phone: "+91 98765 43210",
      service_type: "Home Cleaning",
      service_details: {
        rooms: 3,
        bathrooms: 2,
        kitchen: true,
        balcony: true
      },
      location: {
        latitude: 19.0760,
        longitude: 72.8777
      },
      address: "123 Test Street, Mumbai, Maharashtra 400001",
      scheduled_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      estimated_cost: 850.00,
      visit_charges: 100.00,
      service_charges: 750.00,
      emergency: false,
      customer_notes: "Please bring your own cleaning supplies. Ring the doorbell twice."
    };

    const notificationData = testData || defaultTestData;

    try {
      const response = await fetch(`http://localhost:8000/api/notifications/send-booking-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer test-token`,
        },
        body: JSON.stringify(notificationData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to send test notification');
      }

      const result = await response.json();
      console.log('🔔 Test notification sent successfully:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to send test notification:', error);
      throw error;
    }
  },

  /**
   * Simulate an emergency booking notification
   */
  async simulateEmergencyNotification(agentId) {
    const emergencyData = {
      booking_id: `emergency-booking-${Date.now()}`,
      agent_id: agentId,
      customer_name: "Sarah Emergency",
      customer_phone: "+91 99999 99999",
      service_type: "Plumbing - Emergency",
      service_details: {
        issue: "Pipe burst in bathroom",
        urgency: "critical",
        access: "24/7"
      },
      location: {
        latitude: 19.0760,
        longitude: 72.8777
      },
      address: "Emergency Address, Near Hospital, Mumbai 400001",
      scheduled_time: new Date().toISOString(), // Right now
      estimated_cost: 1500.00,
      visit_charges: 200.00,
      service_charges: 1300.00,
      emergency: true,
      customer_notes: "EMERGENCY: Pipe burst causing flooding. Immediate help needed!"
    };

    return this.simulateBookingNotification(agentId, emergencyData);
  },

  /**
   * Check if backend is available for testing
   */
  async checkBackendConnection() {
    try {
      const response = await fetch(`http://localhost:8000/api/notifications/debug/pending-notifications`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer test-token`,
        },
      });

      return response.ok;
    } catch (error) {
      console.warn('Backend not available for notification testing:', error.message);
      return false;
    }
  },

  /**
   * Get agent connection status for testing
   */
  async getAgentConnectionStatus(agentId) {
    try {
      const response = await fetch(`http://localhost:8000/api/notifications/agent/${agentId}/connection-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer test-token`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get agent status');
      }

      const result = await response.json();
      console.log('📊 Agent connection status:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to get agent status:', error);
      return {
        agent_id: agentId,
        is_connected: false,
        connection_count: 0,
        pending_notifications: 0,
        last_seen: null
      };
    }
  }
};