/**
 * NotificationService.js
 * Helper service for handling agent notifications and WebSocket connections
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWebSocketUrl } from '../utils/urlConfig';

class NotificationService {
  constructor() {
    this.wsConnection = null;
    this.isConnected = false;
    this.listeners = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 2; // Reduced attempts to avoid spam
  }

  /**
   * Connect agent to notification WebSocket
   */
  connect(agentId, authToken) {
    console.log('🎯 [NS-CONNECT-START] NotificationService.connect() called');
    console.log('🔍 [NS-PARAMS] AgentId:', agentId, 'AuthToken length:', authToken?.length || 0);
    
    if (this.wsConnection && this.isConnected) {
      console.log('🔔 [NS-ALREADY] Already connected to notifications');
      return;
    }

    try {
      const wsUrl = getWebSocketUrl(agentId);
      console.log('🔗 [WS-DEBUG] Starting WebSocket connection...');
      console.log('🔗 [WS-DEBUG] URL:', wsUrl);
      console.log('🔗 [WS-DEBUG] Agent ID:', agentId);
      console.log('🔗 [WS-DEBUG] Platform:', require('react-native').Platform.OS);
      
      // Test URL reachability first
      console.log('🔍 [WS-DEBUG] Testing HTTP connectivity to same host...');
      
      this.wsConnection = new WebSocket(wsUrl);
      console.log('✅ [WS-DEBUG] WebSocket object created successfully');

      // Debug timer to detect hanging connections
      const debugTimer = setTimeout(() => {
        console.log('⚠️ [WS-DEBUG] WebSocket connection hanging - no events fired after 3 seconds');
        console.log('⚠️ [WS-DEBUG] ReadyState:', this.wsConnection?.readyState);
        console.log('⚠️ [WS-DEBUG] ReadyState meanings: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED');
      }, 3000);

      this.wsConnection.onopen = () => {
        clearTimeout(debugTimer);
        console.log('✅ [WS-CONNECT] WebSocket connection established successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyListeners('connected', { agentId });
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📩 [WS-MESSAGE] Notification received:', message.type);
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ [WS-ERROR] Error parsing notification message:', error);
        }
      };

      this.wsConnection.onclose = (event) => {
        console.log('🔌 [WS-CLOSE] WebSocket connection closed:', { code: event.code, reason: event.reason, wasClean: event.wasClean });
        this.isConnected = false;
        this.wsConnection = null;
        
        this.notifyListeners('disconnected', { code: event.code });
        
        // Auto-reconnect if it wasn't a manual close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => {
            this.connect(agentId, authToken);
          }, Math.pow(2, this.reconnectAttempts) * 1000); // Exponential backoff
        }
      };

      this.wsConnection.onerror = (error) => {
        clearTimeout(debugTimer);
        console.error('❌ [WS-ERROR] WebSocket connection failed!');
        console.error('❌ [WS-ERROR] Error object:', error);
        console.error('❌ [WS-ERROR] Error message:', error?.message || 'No message');
        console.error('❌ [WS-ERROR] Error type:', error?.type || 'No type');
        console.error('❌ [WS-ERROR] URL attempted:', wsUrl);
        console.error('❌ [WS-ERROR] Agent ID:', agentId);
        console.error('❌ [WS-ERROR] ReadyState when error occurred:', this.wsConnection?.readyState);
        console.log('📵 [WS-STATUS] Notifications service unavailable - continuing without real-time updates');
        this.notifyListeners('error', error);
      };

    } catch (error) {
      console.log('📵 Notifications service unavailable - continuing without real-time updates');
      this.notifyListeners('error', error);
    }
  }

  /**
   * Disconnect from notification WebSocket
   */
  disconnect() {
    if (this.wsConnection) {
      this.wsConnection.close(1000, 'Manual disconnect'); // Normal closure
      this.wsConnection = null;
      this.isConnected = false;
      console.log('🛑 Manually disconnected from notifications');
    }
  }

  /**
   * Send response to booking notification
   */
  sendResponse(notificationId, response, responseData = {}) {
    if (!this.wsConnection || !this.isConnected) {
      throw new Error('Not connected to notification system');
    }

    const message = {
      type: 'response',
      notification_id: notificationId,
      response: response, // 'accepted' or 'rejected'
      data: {
        timestamp: new Date().toISOString(),
        ...responseData
      }
    };

    this.wsConnection.send(JSON.stringify(message));
    console.log(`📤 Response sent: ${response} for notification ${notificationId}`);
  }

  /**
   * Send heartbeat ping
   */
  sendHeartbeat() {
    if (this.wsConnection && this.isConnected) {
      this.wsConnection.send(JSON.stringify({ type: 'ping' }));
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(message) {
    switch (message.type) {
      case 'bell_notification':
        this.notifyListeners('booking_request', message.notification);
        break;
        
      case 'response_confirmed':
        this.notifyListeners('response_confirmed', message);
        break;
        
      case 'notification_timeout':
        this.notifyListeners('notification_timeout', message);
        break;
        
      case 'booking_status_update':
        this.notifyListeners('status_update', message);
        break;
        
      case 'system_message':
        this.notifyListeners('system_message', message);
        break;
        
      case 'pong':
        // Heartbeat response - no action needed
        break;
        
      case 'error':
        this.notifyListeners('error', { message: message.message });
        break;
        
      default:
        console.log('Unknown notification message type:', message.type);
    }
  }

  /**
   * Add event listener
   */
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  /**
   * Notify all listeners of events
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      hasWebSocket: !!this.wsConnection
    };
  }

  /**
   * Check if agent can receive notifications (API call)
   */
  async checkAgentConnectionStatus(agentId) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      const response = await fetch(`http://localhost:8000/api/notifications/agent/${agentId}/connection-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to check connection status');
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking agent connection status:', error);
      throw error;
    }
  }

  /**
   * Start periodic heartbeat
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop periodic heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;