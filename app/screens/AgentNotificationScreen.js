/**
 * AgentNotificationScreen.js
 * Agent interface for receiving and responding to bell notifications
 * Displays incoming booking requests with accept/reject functionality
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Vibration,
  AppState,
  Animated,
  Dimensions,
  ScrollView,
  Image
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const AgentNotificationScreen = ({ route, navigation }) => {
  const { agentId, authToken } = route.params;
  
  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [pendingNotifications, setPendingNotifications] = useState([]);
  const [currentNotification, setCurrentNotification] = useState(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [isProcessingResponse, setIsProcessingResponse] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [notificationHistory, setNotificationHistory] = useState([]);

  // Refs for audio and animations
  const websocketRef = useRef(null);
  const bellSoundRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const reconnectTimeoutRef = useRef(null);

  // WebSocket connection management
  useEffect(() => {
    connectWebSocket();
    loadBellSound();
    
    // Handle app state changes
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        connectWebSocket();
      } else if (nextAppState === 'background') {
        // Keep connection alive for notifications
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
      disconnectWebSocket();
      if (bellSoundRef.current) {
        bellSoundRef.current.unloadAsync();
      }
    };
  }, [agentId]);

  const connectWebSocket = async () => {
    try {
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        return; // Already connected
      }

      setConnectionStatus('Connecting...');
      
      // Use your backend WebSocket URL
      const wsUrl = `ws://localhost:8000/api/notifications/ws/agent/${agentId}`;
      
      websocketRef.current = new WebSocket(wsUrl);
      
      websocketRef.current.onopen = () => {
        console.log('🔔 WebSocket connected for agent notifications');
        setIsConnected(true);
        setConnectionStatus('Connected');
        
        // Send heartbeat ping
        startHeartbeat();
      };
      
      websocketRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📩 Received notification message:', message);
          
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      websocketRef.current.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('Disconnected');
        
        // Attempt to reconnect after delay
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connectWebSocket();
        }, 5000); // Reconnect after 5 seconds
      };
      
      websocketRef.current.onerror = (error) => {
        console.error('🚨 WebSocket error:', error);
        setConnectionStatus('Connection Error');
      };
      
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      setConnectionStatus('Connection Failed');
    }
  };

  const disconnectWebSocket = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const startHeartbeat = () => {
    const heartbeatInterval = setInterval(() => {
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({ type: 'ping' }));
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000); // Ping every 30 seconds
  };

  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'bell_notification':
        handleBellNotification(message.notification);
        break;
        
      case 'response_confirmed':
        handleResponseConfirmation(message);
        break;
        
      case 'notification_timeout':
        handleNotificationTimeout(message);
        break;
        
      case 'booking_status_update':
        handleStatusUpdate(message);
        break;
        
      case 'system_message':
        handleSystemMessage(message);
        break;
        
      case 'pong':
        // Heartbeat response
        console.log('💓 Heartbeat pong received');
        break;
        
      case 'error':
        console.error('WebSocket error:', message.message);
        Alert.alert('Notification Error', message.message);
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const handleBellNotification = async (notification) => {
    console.log('🔔 Bell notification received:', notification);
    
    // Add to pending notifications
    setPendingNotifications(prev => [...prev, notification]);
    
    // Show current notification if none is showing
    if (!currentNotification) {
      setCurrentNotification(notification);
      setShowNotificationModal(true);
      
      // Start bell sound and vibration
      await startBellAlert();
      
      // Start visual animations
      startPulseAnimation();
      startShakeAnimation();
    }
    
    // Add to history
    setNotificationHistory(prev => [
      {
        ...notification,
        status: 'received',
        receivedAt: new Date().toISOString()
      },
      ...prev.slice(0, 19) // Keep last 20 notifications
    ]);
  };

  const loadBellSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        // You'll need to add a bell sound file to assets/sounds/
        require('../assets/sounds/bell-notification.mp3'), // Create this file
        {
          shouldPlay: false,
          isLooping: true,
          volume: 1.0,
        }
      );
      
      bellSoundRef.current = sound;
    } catch (error) {
      console.error('Error loading bell sound:', error);
    }
  };

  const startBellAlert = async () => {
    try {
      // Start continuous vibration pattern
      const vibrationPattern = [0, 500, 200, 500, 200, 500]; // ms
      Vibration.vibrate(vibrationPattern, true); // true = repeat
      
      // Play bell sound continuously
      if (bellSoundRef.current) {
        await bellSoundRef.current.replayAsync();
      }
    } catch (error) {
      console.error('Error starting bell alert:', error);
    }
  };

  const stopBellAlert = async () => {
    try {
      // Stop vibration
      Vibration.cancel();
      
      // Stop bell sound
      if (bellSoundRef.current) {
        await bellSoundRef.current.stopAsync();
      }
      
      // Stop animations
      pulseAnim.stopAnimation();
      shakeAnim.stopAnimation();
    } catch (error) {
      console.error('Error stopping bell alert:', error);
    }
  };

  const startPulseAnimation = () => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        })
      ]).start(() => {
        if (showNotificationModal) {
          pulse(); // Continue pulsing
        }
      });
    };
    pulse();
  };

  const startShakeAnimation = () => {
    const shake = () => {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start(() => {
        if (showNotificationModal) {
          setTimeout(shake, 1000); // Shake every second
        }
      });
    };
    shake();
  };

  const handleAgentResponse = async (response) => {
    if (!currentNotification || isProcessingResponse) {
      return;
    }

    setIsProcessingResponse(true);
    
    try {
      // Stop bell alert immediately
      await stopBellAlert();
      
      // Send response via WebSocket
      const responseMessage = {
        type: 'response',
        notification_id: currentNotification.id,
        response: response,
        data: {
          timestamp: new Date().toISOString(),
          agent_id: agentId
        }
      };
      
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify(responseMessage));
      }
      
      // Update notification history
      setNotificationHistory(prev => 
        prev.map(n => 
          n.id === currentNotification.id 
            ? { ...n, status: response, respondedAt: new Date().toISOString() }
            : n
        )
      );
      
      // Show success message
      const message = response === 'accepted' 
        ? '✅ Booking accepted successfully!' 
        : '❌ Booking rejected';
      
      Alert.alert(
        'Response Sent',
        message,
        [
          {
            text: 'OK',
            onPress: () => {
              // Close current notification and show next if any
              closeCurrentNotification();
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error sending response:', error);
      Alert.alert('Error', 'Failed to send response. Please try again.');
    } finally {
      setIsProcessingResponse(false);
    }
  };

  const closeCurrentNotification = () => {
    // Remove current notification from pending
    setPendingNotifications(prev => 
      prev.filter(n => n.id !== currentNotification.id)
    );
    
    setCurrentNotification(null);
    setShowNotificationModal(false);
    
    // Show next pending notification if any
    setPendingNotifications(prev => {
      if (prev.length > 0) {
        const nextNotification = prev[0];
        setCurrentNotification(nextNotification);
        setShowNotificationModal(true);
        startBellAlert();
        startPulseAnimation();
        startShakeAnimation();
      }
      return prev;
    });
  };

  const handleResponseConfirmation = (message) => {
    console.log('✅ Response confirmed:', message);
    // Response was successfully processed
  };

  const handleNotificationTimeout = (message) => {
    console.log('⏰ Notification timeout:', message);
    Alert.alert(
      'Booking Request Timeout',
      'The booking request has timed out and was automatically rejected.',
      [{ text: 'OK' }]
    );
    
    closeCurrentNotification();
  };

  const handleStatusUpdate = (message) => {
    console.log('📢 Status update:', message);
    // Handle booking status updates
  };

  const handleSystemMessage = (message) => {
    Alert.alert('System Message', message.message);
  };

  const formatTime = (timeString) => {
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timeString;
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount?.toFixed(2) || '0.00'}`;
  };

  const renderNotificationModal = () => {
    if (!currentNotification) return null;

    const { data } = currentNotification;

    return (
      <Modal
        visible={showNotificationModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          // Prevent closing modal without response
          Alert.alert(
            'Response Required',
            'Please accept or reject the booking request.',
            [{ text: 'OK' }]
          );
        }}
      >
        <View style={styles.modalContainer}>
          <Animated.View 
            style={[
              styles.notificationCard,
              {
                transform: [
                  { scale: pulseAnim },
                  { translateX: shakeAnim }
                ]
              }
            ]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Animated.View style={[styles.bellIcon, { transform: [{ scale: pulseAnim }] }]}>
                <Ionicons name="notifications" size={32} color="#FF6B35" />
              </Animated.View>
              <Text style={styles.modalTitle}>New Booking Request</Text>
              {data.emergency && (
                <View style={styles.emergencyBadge}>
                  <Text style={styles.emergencyText}>EMERGENCY</Text>
                </View>
              )}
            </View>

            {/* Customer Info */}
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Customer Details</Text>
                <View style={styles.customerInfo}>
                  <Ionicons name="person" size={20} color="#666" />
                  <Text style={styles.customerName}>{data.customer_name}</Text>
                </View>
                <View style={styles.customerInfo}>
                  <Ionicons name="call" size={20} color="#666" />
                  <Text style={styles.customerPhone}>{data.customer_phone}</Text>
                </View>
              </View>

              {/* Service Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Service Details</Text>
                <Text style={styles.serviceType}>{data.service_type}</Text>
                {data.service_details && (
                  <Text style={styles.serviceDetails}>{JSON.stringify(data.service_details)}</Text>
                )}
              </View>

              {/* Location */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Location</Text>
                <View style={styles.locationInfo}>
                  <Ionicons name="location" size={20} color="#666" />
                  <Text style={styles.address}>{data.address}</Text>
                </View>
              </View>

              {/* Timing */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Scheduled Time</Text>
                <View style={styles.timeInfo}>
                  <Ionicons name="time" size={20} color="#666" />
                  <Text style={styles.scheduledTime}>
                    {formatTime(data.scheduled_time)}
                  </Text>
                </View>
              </View>

              {/* Pricing */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pricing</Text>
                <View style={styles.pricingInfo}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Visit Charges:</Text>
                    <Text style={styles.priceValue}>{formatCurrency(data.visit_charges)}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Service Charges:</Text>
                    <Text style={styles.priceValue}>{formatCurrency(data.service_charges)}</Text>
                  </View>
                  <View style={[styles.priceRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Total Estimated:</Text>
                    <Text style={styles.totalValue}>{formatCurrency(data.estimated_cost)}</Text>
                  </View>
                </View>
              </View>

              {/* Notes */}
              {data.customer_notes && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Customer Notes</Text>
                  <Text style={styles.notes}>{data.customer_notes}</Text>
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleAgentResponse('rejected')}
                disabled={isProcessingResponse}
              >
                <Ionicons name="close-circle" size={24} color="white" />
                <Text style={styles.actionButtonText}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => handleAgentResponse('accepted')}
                disabled={isProcessingResponse}
              >
                <Ionicons name="checkmark-circle" size={24} color="white" />
                <Text style={styles.actionButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>

            {/* Processing Indicator */}
            {isProcessingResponse && (
              <View style={styles.processingOverlay}>
                <Text style={styles.processingText}>Sending response...</Text>
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.connectionIndicator}>
          <View style={[
            styles.connectionDot,
            { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }
          ]} />
          <Text style={styles.connectionText}>{connectionStatus}</Text>
        </View>
      </View>

      {/* Status Info */}
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Notification Status</Text>
        <Text style={styles.statusText}>
          {isConnected ? 
            '🔔 Ready to receive booking requests' :
            '🔌 Disconnected - Trying to reconnect...'
          }
        </Text>
        {pendingNotifications.length > 0 && (
          <Text style={styles.pendingText}>
            {pendingNotifications.length} pending notification(s)
          </Text>
        )}
      </View>

      {/* Notification History */}
      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>Recent Notifications</Text>
        <ScrollView style={styles.historyList}>
          {notificationHistory.length > 0 ? (
            notificationHistory.map((notification, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyCustomer}>
                    {notification.data.customer_name}
                  </Text>
                  <Text style={styles.historyTime}>
                    {formatTime(notification.receivedAt)}
                  </Text>
                </View>
                <Text style={styles.historyService}>
                  {notification.data.service_type}
                </Text>
                <View style={styles.historyFooter}>
                  <Text style={[
                    styles.historyStatus,
                    {
                      color: notification.status === 'accepted' ? '#4CAF50' :
                             notification.status === 'rejected' ? '#F44336' : '#FF9800'
                    }
                  ]}>
                    {notification.status.toUpperCase()}
                  </Text>
                  <Text style={styles.historyCost}>
                    {formatCurrency(notification.data.estimated_cost)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noHistory}>No notifications yet</Text>
          )}
        </ScrollView>
      </View>

      {/* Notification Modal */}
      {renderNotificationModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  connectionText: {
    fontSize: 12,
    color: '#666',
  },
  statusCard: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  pendingText: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
  },
  historySection: {
    flex: 1,
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    padding: 20,
    paddingBottom: 10,
  },
  historyList: {
    flex: 1,
  },
  historyItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  historyCustomer: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  historyTime: {
    fontSize: 12,
    color: '#999',
  },
  historyService: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  historyCost: {
    fontSize: 12,
    color: '#666',
  },
  noHistory: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    padding: 40,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationCard: {
    backgroundColor: 'white',
    width: width * 0.95,
    maxHeight: height * 0.85,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    backgroundColor: '#FF6B35',
    padding: 20,
    alignItems: 'center',
  },
  bellIcon: {
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  emergencyBadge: {
    backgroundColor: '#FF1744',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 5,
  },
  emergencyText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalContent: {
    maxHeight: height * 0.5,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  customerPhone: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  serviceType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF6B35',
  },
  serviceDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduledTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  pricingInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 8,
    marginTop: 5,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  notes: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 5,
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default AgentNotificationScreen;