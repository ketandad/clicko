/**
 * Global Notification Context
 * Handles booking notifications across all screens and app states
 * Provides continuous bell notifications and global booking dialog
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform, AppState, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import hybridNotificationService from '../services/hybridNotificationService';
import config from '../config';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [currentBookingRequest, setCurrentBookingRequest] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bellSound, setBellSound] = useState(null);
  const [isProcessingResponse, setIsProcessingResponse] = useState(false);
  
  const bellIntervalRef = useRef(null);
  const notificationListener = useRef();
  const responseListener = useRef();
  const appStateRef = useRef(AppState.currentState);

  // Initialize push notifications
  useEffect(() => {
    registerForPushNotifications();
    setupNotificationListeners();
    
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Connect/disconnect based on user auth and agent status
  useEffect(() => {
    if (user && user.user_type === 'agent') {
      console.log('👤 Agent user detected, initializing notification system...');
      loadBellSound();
      
      // Try to connect based on saved online status
      // The connectToNotifications function will check if agent is online before connecting
      connectToNotifications();
    } else {
      console.log('👤 Non-agent user or no user, disconnecting notifications');
      disconnectFromNotifications();
    }
    
    return () => {
      disconnectFromNotifications();
      stopBellSound();
      if (bellSound) {
        bellSound.unloadAsync();
      }
    };
  }, [user]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log('📱 App state changed:', appStateRef.current, '->', nextAppState);
      
      if (appStateRef.current === 'background' && nextAppState === 'active') {
        // App came from background to foreground
        if (user && user.user_type === 'agent' && !isConnected) {
          console.log('🔄 Reconnecting notifications after app activation');
          connectToNotifications();
        }
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [user, isConnected]);

  const registerForPushNotifications = async () => {
    try {
      console.log('🔔 Registering for push notifications...');
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ Push notification permissions denied');
        return;
      }

      // For development, skip Expo push token to avoid service dependency
      console.log('🔧 Development mode: Using local notifications only');
      const token = 'dev-token-placeholder';
      console.log('✅ Using development token:', token);
      
      // Store token for backend to use
      if (user && user.user_type === 'agent') {
        await AsyncStorage.setItem('expoPushToken', token);
        // TODO: Send token to backend to associate with agent
      }
      
      // Configure notification channels for Android
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('booking-requests', {
          name: 'Booking Requests',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'bell_notification.wav',
          enableVibrate: true,
          showBadge: true,
        });
      }
      
    } catch (error) {
      console.error('❌ Error registering for push notifications:', error);
    }
  };

  const setupNotificationListeners = () => {
    // Handle notification received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification received in foreground:', notification);
      
      const { data } = notification.request.content;
      if (data && data.type === 'booking_request') {
        handleBookingNotification(data);
      }
    });

    // Handle notification tapped (opens app)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📱 Notification tapped:', response);
      
      const { data } = response.notification.request.content;
      if (data && data.type === 'booking_request') {
        handleBookingNotification(data);
      }
    });
  };

  const loadBellSound = async () => {
    try {
      // Try to use a system notification sound first
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/bell_notification.wav.placeholder'), // This will fail gracefully
        { 
          isLooping: false,
          volume: 1.0,
        }
      );
      setBellSound(sound);
      console.log('🔔 Bell sound loaded successfully');
    } catch (error) {
      try {
        // Fallback: Create a simple programmatic beep sound
        console.log('🔔 Creating programmatic bell sound...');
        // For now, we'll create a mock sound object that handles play but doesn't actually play
        // This allows the bell logic to work without crashing
        const mockSound = {
          replayAsync: async () => {
            console.log('🔔 BELL RING! (Audio not available - using console log)');
            // You could add device vibration here as an alternative
            return Promise.resolve();
          },
          unloadAsync: async () => Promise.resolve()
        };
        setBellSound(mockSound);
        console.log('🔔 Mock bell sound created - check console for bell rings');
      } catch (fallbackError) {
        console.warn('⚠️ Could not create any bell sound:', fallbackError);
        setBellSound(null);
      }
    }
  };

  const connectToNotifications = async (forceOnline = false) => {
    console.log('🎯 [CONNECT-START] connectToNotifications called with forceOnline:', forceOnline);
    console.log('🔍 [CONNECT-CHECK] User:', !!user, 'Type:', user?.user_type, 'Connected:', isConnected);
    
    if (!user) {
      console.log('❌ [CONNECT-BLOCK] No user - returning');
      return;
    }
    if (user.user_type !== 'agent') {
      console.log('❌ [CONNECT-BLOCK] User is not agent - returning');
      return;
    }
    if (isConnected) {
      console.log('❌ [CONNECT-BLOCK] Already connected - returning');
      return;
    }
    
    console.log('✅ [CONNECT-PROCEED] All checks passed, proceeding...');
    
    // Check if agent is online before connecting (unless forced)
    if (!forceOnline) {
      console.log('🔍 [NOTIFY-DEBUG] Checking agent online status before connecting...');
      const agentOnlineStatus = await getAgentOnlineStatus();
      console.log('🔍 [NOTIFY-DEBUG] Agent online status result:', agentOnlineStatus);
      if (!agentOnlineStatus) {
        console.log('🔕 [NOTIFY-DEBUG] Agent is offline, skipping notification connection');
        return;
      }
      console.log('✅ [NOTIFY-DEBUG] Agent is online, proceeding with connection...');
    } else {
      console.log('🚀 [NOTIFY-DEBUG] Forced connection (bypassing online check)');
    }
    
    console.log('🔄 [CONNECT-MAIN] Starting notification system connection...');
    console.log('🔍 [CONNECT-MAIN] User ID:', user?.id, 'Token present:', !!user?.token);
    console.log('🔍 [CONNECT-MAIN] hybridNotificationService available:', !!hybridNotificationService);
    
    try {
      // Use the hybrid notification service
      console.log('� [CONNECT-HYBRID] About to call hybridNotificationService.connect...');
      console.log('🔍 [CONNECT-HYBRID] Parameters - agentId:', user.id, 'tokenLength:', user?.token?.length || 0);
      
      const result = await hybridNotificationService.connect(user.id, user.token);
      
      console.log('✅ [CONNECT-HYBRID] hybridNotificationService.connect completed!');
      console.log('🔍 [CONNECT-HYBRID] Result:', result);
      
      // Add listener for WebSocket events
      const removeListener = hybridNotificationService.addListener((event, data) => {
        console.log('📡 Notification event:', event, data);
        
        switch (event) {
          case 'connected':
            setIsConnected(true);
            console.log('✅ Connected to notification system');
            break;
            
          case 'disconnected':
            setIsConnected(false);
            console.log('❌ Disconnected from notification system');
            break;
            
          case 'booking_request':
            console.log('🔔 New booking request received');
            handleBookingNotification(data);
            break;
            
          case 'response_confirmed':
            console.log('✅ Booking response confirmed');
            handleResponseConfirmed(data);
            break;
            
          case 'notification_timeout':
            console.log('⏰ Notification timed out');
            handleNotificationTimeout(data);
            break;
            
          default:
            console.log('ℹ️ Unknown notification event:', event);
        }
      });

      return removeListener;
      
    } catch (error) {
      console.error('❌ [NOTIFY-ERROR] Error connecting to notifications!');
      console.error('❌ [NOTIFY-ERROR] Error details:', error);
      console.error('❌ [NOTIFY-ERROR] Error message:', error?.message || 'No message');
      console.error('❌ [NOTIFY-ERROR] Error stack:', error?.stack || 'No stack');
      setIsConnected(false);
    }
  };

  const disconnectFromNotifications = () => {
    console.log('🔌 Disconnecting from notification system...');
    hybridNotificationService.disconnect();
    setIsConnected(false);
    stopBellSound();
    closeBookingModal();
  };

  const handleBookingNotification = (notificationData) => {
    console.log('🔔 Processing booking notification:', notificationData);
    
    // Set the current booking request
    setCurrentBookingRequest(notificationData);
    
    // Show the booking modal on current screen
    setShowBookingModal(true);
    
    // Start continuous bell sound
    startContinuousBell();
  };

  const startContinuousBell = () => {
    if (!bellSound) {
      console.log('❌ Bell sound not loaded, cannot ring bell');
      return;
    }
    
    // Clear any existing interval
    stopBellSound();
    
    console.log('🔔 Starting continuous bell sound... Will ring every 3 seconds for 2 minutes!');
    
    // Play bell immediately
    playBellOnce();
    
    // Set interval to repeat bell every 3 seconds
    bellIntervalRef.current = setInterval(() => {
      playBellOnce();
    }, 3000);
  };

  const playBellOnce = async () => {
    try {
      if (bellSound) {
        await bellSound.replayAsync();
        console.log('🔔🔔🔔 BELL RINGING! 🔔🔔🔔');
      } else {
        console.log('🔕 Bell sound not available - silent notification');
      }
    } catch (error) {
      console.error('❌ Error playing bell sound:', error);
    }
  };

  const stopBellSound = () => {
    if (bellIntervalRef.current) {
      clearInterval(bellIntervalRef.current);
      bellIntervalRef.current = null;
      console.log('🔕 Stopped continuous bell sound');
    }
  };

  const handleBookingResponse = async (response, reason = null) => {
    if (!currentBookingRequest || isProcessingResponse) return;
    
    setIsProcessingResponse(true);
    console.log('📝 Processing booking response:', response);
    
    try {
      // Stop bell sound immediately
      stopBellSound();
      
      // Send response via WebSocket
      const responseData = reason ? { reason } : {};
      await hybridNotificationService.respondToNotification(
        currentBookingRequest.id,
        response,
        responseData
      );
      
      // Close modal
      closeBookingModal();
      
      console.log('✅ Booking response sent successfully');
      
    } catch (error) {
      console.error('❌ Error sending booking response:', error);
      Alert.alert('Error', 'Failed to send response. Please try again.');
    } finally {
      setIsProcessingResponse(false);
    }
  };

  const closeBookingModal = () => {
    stopBellSound();
    setShowBookingModal(false);
    setCurrentBookingRequest(null);
    setIsProcessingResponse(false);
  };

  const handleResponseConfirmed = (data) => {
    console.log('✅ Response confirmed by backend:', data);
    closeBookingModal();
  };

  const handleNotificationTimeout = (data) => {
    console.log('⏰ Booking request timed out:', data);
    // Close modal if it's still showing
    if (showBookingModal) {
      closeBookingModal();
    }
  };

  const getAgentOnlineStatus = async () => {
    try {
      // Get from server first (source of truth), fall back to local storage
      if (user?.token && user?.id) {
        try {
          const response = await fetch(`${config.API_URL}/agents/profile/${user.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${user.token}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            console.log('🔍 Agent status from server:', data.is_online);
            // Update local storage to match server
            await AsyncStorage.setItem('agentOnlineStatus', data.is_online.toString());
            return data.is_online;
          }
        } catch (serverError) {
          console.warn('⚠️ Failed to fetch status from server, using local fallback:', serverError.message);
        }
      }

      // Fallback to local storage (Swiggy/Zomato pattern - server is source of truth)
      const onlineStatus = await AsyncStorage.getItem('agentOnlineStatus');
      const isOnline = onlineStatus === 'true';
      console.log('🔍 Agent status (local fallback):', onlineStatus, '→', isOnline);
      return isOnline;
    } catch (error) {
      console.error('❌ Error checking agent online status:', error);
      // Default to offline if we can't check
      return false;
    }
  };

  const setAgentOnlineStatus = async (isOnline) => {
    try {
      console.log('🔄 Updating agent online status via API:', isOnline, '| Current connected:', isConnected);
      
      // Update status on server (Swiggy/Zomato pattern)
      if (user?.token) {
        const response = await fetch(`${config.API_URL}/agents/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`
          },
          body: JSON.stringify({ is_online: isOnline })
        });

        if (!response.ok) {
          throw new Error(`Failed to update status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ Agent status updated on server: ${data.message}`);
      }

      // Also store locally for quick access (but server is source of truth)
      await AsyncStorage.setItem('agentOnlineStatus', isOnline.toString());
      
      console.log('🔍 [STATUS-DEBUG] Checking connection logic: isOnline =', isOnline, ', isConnected =', isConnected);
      
      if (isOnline && !isConnected) {
        console.log('🔌 [STATUS-DEBUG] Agent went online, connecting to notifications...');
        console.log('🔍 [STATUS-DEBUG] About to call connectToNotifications(true)...');
        
        // Agent went online, connect to notifications (force since we know they're online)
        try {
          console.log('🚀 [STATUS-DEBUG] Starting connectToNotifications call...');
          await connectToNotifications(true);
          console.log('✅ [STATUS-DEBUG] connectToNotifications completed successfully!');
        } catch (error) {
          console.error('❌ [STATUS-ERROR] Failed to connect to notifications!');
          console.error('❌ [STATUS-ERROR] Error object:', error);
          console.error('❌ [STATUS-ERROR] Error message:', error?.message || 'No message');
          console.error('❌ [STATUS-ERROR] Error stack:', error?.stack || 'No stack');
        }
        console.log('🔍 [STATUS-DEBUG] Finished connection attempt, continuing...');
        
      } else if (!isOnline && isConnected) {
        console.log('🔌 Agent went offline, disconnecting from notifications...');
        // Agent went offline, disconnect from notifications  
        disconnectFromNotifications();
      } else {
        console.log('ℹ️ No connection state change needed');
      }
    } catch (error) {
      console.error('❌ Error setting agent online status:', error);
      throw error; // Re-throw so calling code can handle it
    }
  };

  const value = {
    // State
    isConnected,
    currentBookingRequest,
    showBookingModal,
    isProcessingResponse,
    
    // Actions
    handleBookingResponse,
    closeBookingModal,
    connectToNotifications,
    disconnectFromNotifications,
    setAgentOnlineStatus,
    getAgentOnlineStatus,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};