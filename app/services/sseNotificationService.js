/**
 * Server-Sent Events (SSE) Notification Service
 * Alternative to WebSocket that works better with GitHub Codespaces
 */

import { getApiUrl } from '../utils/urlConfig';

class SSENotificationService {
  constructor() {
    this.eventSource = null;
    this.isConnected = false;
    this.listeners = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.agentId = null;
  }

  /**
   * Connect to SSE endpoint for notifications
   */
  connect(agentId, authToken) {
    if (this.eventSource && this.isConnected) {
      console.log('🔔 Already connected to SSE notifications');
      return;
    }

    this.agentId = agentId;

    try {
      const sseUrl = `${getApiUrl()}/notifications/sse/agent/${agentId}`;
      console.log('📡 Connecting to SSE:', sseUrl);
      
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onopen = () => {
        console.log('🔔 Connected to SSE notification system');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyListeners('connected', { agentId });
      };

      this.eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📩 SSE Notification received:', message.type);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.log('📡 SSE connection error, attempting fallback to polling');
        this.isConnected = false;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => {
            this.connect(agentId, authToken);
          }, 2000 * this.reconnectAttempts);
        } else {
          console.log('📊 Switching to polling mode for notifications');
          this.startPolling(agentId, authToken);
        }
      };

    } catch (error) {
      console.log('📊 SSE unavailable, using polling mode');
      this.startPolling(agentId, authToken);
    }
  }

  /**
   * Fallback polling method for notifications
   */
  startPolling(agentId, authToken) {
    this.pollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`${getApiUrl()}/notifications/poll/agent/${agentId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.notifications && data.notifications.length > 0) {
            data.notifications.forEach(notification => {
              this.handleMessage(notification);
            });
          }
        }
      } catch (error) {
        console.log('📊 Polling request failed:', error.message);
      }
    }, 5000); // Poll every 5 seconds
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    this.notifyListeners('message', message);
    
    if (message.type === 'bell_notification') {
      this.notifyListeners('bell_notification', message);
    } else if (message.type === 'booking_update') {
      this.notifyListeners('booking_update', message);
    }
  }

  /**
   * Send response via HTTP API (since SSE is one-way)
   */
  async sendResponse(notificationId, response, responseData = {}) {
    try {
      const apiResponse = await fetch(`${getApiUrl()}/notifications/response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notification_id: notificationId,
          agent_id: this.agentId,
          response: response,
          data: responseData
        })
      });

      if (apiResponse.ok) {
        console.log('✅ Response sent successfully');
        return true;
      } else {
        console.error('❌ Failed to send response');
        return false;
      }
    } catch (error) {
      console.error('❌ Error sending response:', error);
      return false;
    }
  }

  /**
   * Add event listener
   */
  addEventListener(type, callback) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(type, callback) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
    }
  }

  /**
   * Notify listeners
   */
  notifyListeners(type, data) {
    if (this.listeners[type]) {
      this.listeners[type].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in notification listener:', error);
        }
      });
    }
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      console.log('🛑 Disconnected from SSE notifications');
    }

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('🛑 Stopped notification polling');
    }
  }
}

export default new SSENotificationService();