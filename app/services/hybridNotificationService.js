/**
 * Hybrid Notification Service
 * Tries WebSocket -> SSE -> Polling for maximum compatibility
 */

import notificationService from './notificationService';
import sseNotificationService from './sseNotificationService';

class HybridNotificationService {
  constructor() {
    this.activeService = null;
    this.connectionType = null;
    this.listeners = [];
    this.agentId = null;
    this.authToken = null;
  }

  /**
   * Connect using the best available method
   */
  async connect(agentId, authToken) {
    console.log('🎯 [HYBRID-START] Hybrid notification service connect called');
    console.log('🔍 [HYBRID-PARAMS] AgentId:', agentId, 'AuthToken length:', authToken?.length || 0);
    
    this.agentId = agentId;
    this.authToken = authToken;

    console.log('🔄 [HYBRID-TRY] Attempting notification connection...');
    console.log('🔍 [HYBRID-STATE] Current activeService:', this.activeService, 'connectionType:', this.connectionType);
    
    // Try WebSocket first
    try {
      console.log('🌐 [HYBRID-WS-TRY] Starting WebSocket attempt...');
      await this.tryWebSocket();
      console.log('✅ [HYBRID-WS-SUCCESS] WebSocket connection successful');
      return;
    } catch (error) {
      console.error('❌ [HYBRID-WS-FAIL] WebSocket failed:', error);
      console.log('📡 [HYBRID-SSE-SWITCH] WebSocket failed, trying SSE...');
    }

    // Try SSE as fallback
    try {
      console.log('📡 [HYBRID-SSE-TRY] Starting SSE attempt...');
      await this.trySSE();
      console.log('✅ [HYBRID-SSE-SUCCESS] SSE connection successful');
      return;
    } catch (error) {
      console.error('❌ [HYBRID-SSE-FAIL] SSE failed:', error);
      console.log('📊 [HYBRID-POLL-SWITCH] SSE failed, using polling...');
    }

    // Use polling as final fallback
    console.log('🔄 [HYBRID-POLL-TRY] Starting polling...');
    this.usePolling();
    console.log('✅ [HYBRID-POLL-SUCCESS] Polling started');
  }

  /**
   * Try WebSocket connection
   */
  async tryWebSocket() {
    console.log('🔌 [WS-PROMISE-START] Creating WebSocket promise...');
    return new Promise((resolve, reject) => {
      console.log('⏰ [WS-TIMEOUT-SET] Setting 5-second timeout...');
      const timeout = setTimeout(() => {
        console.log('⏱️ [WS-TIMEOUT-HIT] WebSocket connection timeout after 5 seconds');
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      const onConnected = () => {
        console.log('🎉 [WS-CONNECTED] WebSocket connected callback fired');
        clearTimeout(timeout);
        this.activeService = notificationService;
        this.connectionType = 'websocket';
        console.log('✅ [WS-SUCCESS] Connected via WebSocket, forwarding events...');
        
        // Forward events
        this.forwardEvents();
        console.log('📤 [WS-FORWARD] Events forwarding setup complete');
        resolve();
      };

      const onError = (error) => {
        console.error('❌ [WS-ERROR] WebSocket error callback:', error);
        clearTimeout(timeout);
        reject(error);
      };

      console.log('👂 [WS-LISTENERS] Setting up WebSocket event listeners...');
      notificationService.addEventListener('connected', onConnected);
      notificationService.addEventListener('error', onError);
      
      console.log('🚀 [WS-CONNECT] Calling notificationService.connect with agentId:', this.agentId);
      notificationService.connect(this.agentId, this.authToken);
    });
  }

  /**
   * Try SSE connection
   */
  async trySSE() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('SSE connection timeout'));
      }, 5000);

      const onConnected = () => {
        clearTimeout(timeout);
        this.activeService = sseNotificationService;
        this.connectionType = 'sse';
        console.log('✅ Connected via Server-Sent Events');
        
        // Forward events
        this.forwardEvents();
        resolve();
      };

      const onError = (error) => {
        clearTimeout(timeout);
        reject(error);
      };

      sseNotificationService.addEventListener('connected', onConnected);
      sseNotificationService.addEventListener('error', onError);
      
      sseNotificationService.connect(this.agentId, this.authToken);
    });
  }

  /**
   * Use polling as final fallback
   */
  usePolling() {
    this.activeService = sseNotificationService;
    this.connectionType = 'polling';
    console.log('📊 Using polling for notifications');
    
    // SSE service has polling fallback built-in
    sseNotificationService.connect(this.agentId, this.authToken);
    this.forwardEvents();
  }

  /**
   * Forward events from active service to listeners
   */
  forwardEvents() {
    const eventTypes = ['connected', 'disconnected', 'message', 'bell_notification', 'booking_update', 'error'];
    
    eventTypes.forEach(eventType => {
      this.activeService.addEventListener(eventType, (data) => {
        this.notifyListeners(eventType, data);
      });
    });
  }

  /**
   * Send response using active service
   */
  async sendResponse(notificationId, response, responseData = {}) {
    if (this.activeService) {
      return await this.activeService.sendResponse(notificationId, response, responseData);
    }
    return false;
  }

  /**
   * Respond to a booking notification (convenience method)
   */
  async respondToNotification(notificationId, response, responseData = {}) {
    console.log(`📝 Responding to notification ${notificationId}: ${response}`);
    return await this.sendResponse(notificationId, response, responseData);
  }

  /**
   * Add event listener (compatible with existing notificationService API)
   */
  addListener(callback) {
    // Use single callback approach like original service
    this.mainCallback = callback;
    
    // Set up event forwarding
    const eventTypes = ['connected', 'disconnected', 'message', 'bell_notification', 'booking_update', 'error', 'booking_request'];
    
    eventTypes.forEach(eventType => {
      this.addEventListener(eventType, (data) => {
        if (this.mainCallback) {
          this.mainCallback(eventType, data);
        }
      });
    });

    // Return cleanup function
    return () => {
      this.mainCallback = null;
    };
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
   * Start heartbeat (compatibility method)
   */
  startHeartbeat() {
    console.log('💓 Heartbeat started (hybrid service)');
  }

  /**
   * Stop heartbeat (compatibility method)
   */
  stopHeartbeat() {
    console.log('💔 Heartbeat stopped (hybrid service)');
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
   * Disconnect from all services
   */
  disconnect() {
    if (this.activeService) {
      this.activeService.disconnect();
      this.activeService = null;
      this.connectionType = null;
      console.log('🛑 Disconnected from notification service');
    }
  }

  /**
   * Get connection status
   */
  getConnectionInfo() {
    return {
      isConnected: this.activeService !== null,
      connectionType: this.connectionType,
      serviceType: this.activeService?.constructor.name || 'none'
    };
  }
}

export default new HybridNotificationService();