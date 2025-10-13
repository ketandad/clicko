/**
 * Global Booking Modal
 * Displays booking requests that appear on ANY screen
 * Shows continuous bell notifications until agent responds
 */

import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Vibration,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Surface,
  Avatar,
  Chip,
  ActivityIndicator,
} from 'react-native-paper';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNotifications } from '../contexts/NotificationContext';

const { width, height } = Dimensions.get('window');

// Professional theme colors
const theme = {
  primary: '#2563EB',
  success: '#059669',
  warning: '#F59E0B',
  error: '#EF4444',
  text: '#1F2937',
  textSecondary: '#6B7280',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
};

const GlobalBookingModal = () => {
  const {
    showBookingModal,
    currentBookingRequest,
    isProcessingResponse,
    handleBookingResponse,
    closeBookingModal,
  } = useNotifications();

  const [pulseAnimation] = React.useState(new Animated.Value(1));
  const [shakeAnimation] = React.useState(new Animated.Value(0));
  const [timeRemaining, setTimeRemaining] = React.useState(120); // 2 minutes in seconds

  // Start animations and countdown when modal opens
  React.useEffect(() => {
    if (showBookingModal) {
      // Reset countdown to 2 minutes
      setTimeRemaining(120);
      
      // Pulse animation for urgency
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      
      // Shake animation for attention
      const shakeLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnimation, {
            toValue: 10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: -10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.delay(2000),
        ])
      );

      pulseLoop.start();
      shakeLoop.start();

      // Vibrate device
      Vibration.vibrate([0, 500, 200, 500]);

      // Countdown timer
      const countdown = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Time expired - auto close modal
            clearInterval(countdown);
            closeBookingModal();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        pulseLoop.stop();
        shakeLoop.stop();
        clearInterval(countdown);
      };
    }
  }, [showBookingModal]);

  const formatAmount = (amount) => {
    return `₹${parseFloat(amount).toFixed(0)}`;
  };

  const formatAddress = (address) => {
    if (!address) return 'Address not provided';
    return address.length > 50 ? `${address.substring(0, 50)}...` : address;
  };

  const formatTimeRemaining = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCountdownColor = (seconds) => {
    if (seconds <= 30) return theme.error; // Red for last 30 seconds
    if (seconds <= 60) return theme.warning; // Orange for last minute
    return theme.primary; // Blue for normal time
  };

  const handleAccept = () => {
    handleBookingResponse('accepted');
  };

  const handleReject = () => {
    // Could add reason selection here
    handleBookingResponse('rejected', 'Agent not available');
  };

  if (!showBookingModal || !currentBookingRequest) {
    return null;
  }

  return (
    <Modal
      visible={showBookingModal}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={closeBookingModal}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.8)" barStyle="light-content" />
      
      {/* Dark overlay */}
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.overlayTouch}
          activeOpacity={1}
          onPress={closeBookingModal}
        />
        
        {/* Modal content */}
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              transform: [
                { scale: pulseAnimation },
                { translateX: shakeAnimation }
              ]
            }
          ]}
        >
          <LinearGradient
            colors={['#ffffff', '#f8fafc']}
            style={styles.gradient}
          >
            {/* Header */}
            <Surface style={styles.header} elevation={2}>
              <View style={styles.headerContent}>
                <View style={styles.headerLeft}>
                  <Avatar.Icon
                    size={50}
                    icon="bell-ring"
                    style={[styles.bellIcon, { backgroundColor: theme.primary }]}
                  />
                  <View style={styles.headerText}>
                    <Text variant="titleLarge" style={styles.title}>
                      🔔 New Booking Request
                    </Text>
                    <View style={styles.timeContainer}>
                      <Text variant="bodyMedium" style={styles.subtitle}>
                        Respond within:
                      </Text>
                      <Text 
                        variant="headlineSmall" 
                        style={[styles.countdown, { color: getCountdownColor(timeRemaining) }]}
                      >
                        ⏰ {formatTimeRemaining(timeRemaining)}
                      </Text>
                    </View>
                  </View>
                </View>
                
                {currentBookingRequest.is_emergency && (
                  <Chip
                    icon="alert"
                    style={[styles.emergencyChip, { backgroundColor: theme.error }]}
                    textStyle={styles.emergencyText}
                  >
                    URGENT
                  </Chip>
                )}
              </View>
            </Surface>

            {/* Customer Info */}
            <Card style={styles.customerCard}>
              <Card.Content>
                <View style={styles.customerInfo}>
                  <Avatar.Icon
                    size={45}
                    icon="account"
                    style={[styles.customerAvatar, { backgroundColor: theme.success }]}
                  />
                  <View style={styles.customerDetails}>
                    <Text variant="titleMedium" style={styles.customerName}>
                      {currentBookingRequest.user_name || 'Customer'}
                    </Text>
                    <Text variant="bodyMedium" style={styles.serviceType}>
                      {currentBookingRequest.service_category}
                    </Text>
                  </View>
                  <View style={styles.amountContainer}>
                    <Text variant="headlineSmall" style={styles.amount}>
                      {formatAmount(currentBookingRequest.total_amount)}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* Service Details */}
            <Card style={styles.detailsCard}>
              <Card.Content>
                <View style={styles.detailsRow}>
                  <Ionicons name="location" size={20} color={theme.primary} />
                  <Text variant="bodyMedium" style={styles.detailsText}>
                    {formatAddress(currentBookingRequest.service_address)}
                  </Text>
                </View>
                
                {currentBookingRequest.service_description && (
                  <View style={styles.detailsRow}>
                    <Ionicons name="document-text" size={20} color={theme.primary} />
                    <Text variant="bodyMedium" style={styles.detailsText}>
                      {currentBookingRequest.service_description}
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
              <Button
                mode="outlined"
                onPress={handleReject}
                disabled={isProcessingResponse}
                style={[styles.actionButton, styles.rejectButton]}
                labelStyle={styles.rejectButtonText}
                icon="close"
              >
                Reject
              </Button>
              
              <Button
                mode="contained"
                onPress={handleAccept}
                disabled={isProcessingResponse}
                style={[styles.actionButton, styles.acceptButton, { backgroundColor: theme.success }]}
                labelStyle={styles.acceptButtonText}
                icon="check"
              >
                {isProcessingResponse ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  'Accept'
                )}
              </Button>
            </View>

            {/* Processing indicator */}
            {isProcessingResponse && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text variant="bodySmall" style={styles.processingText}>
                  Sending response...
                </Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  overlayTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    width: Math.min(width - 40, 400),
    backgroundColor: 'transparent',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  gradient: {
    padding: 0,
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bellIcon: {
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontWeight: 'bold',
    color: theme.text,
  },
  subtitle: {
    color: theme.textSecondary,
    marginTop: 2,
  },
  timeContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  countdown: {
    fontWeight: 'bold',
    marginTop: 4,
    fontSize: 18,
  },
  emergencyChip: {
    marginLeft: 10,
  },
  emergencyText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  customerCard: {
    margin: 20,
    marginBottom: 10,
    backgroundColor: '#ffffff',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    marginRight: 12,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontWeight: 'bold',
    color: theme.text,
  },
  serviceType: {
    color: theme.textSecondary,
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontWeight: 'bold',
    color: theme.success,
  },
  detailsCard: {
    margin: 20,
    marginTop: 0,
    marginBottom: 10,
    backgroundColor: '#ffffff',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailsText: {
    marginLeft: 10,
    flex: 1,
    color: theme.text,
    lineHeight: 20,
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 10,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
  },
  rejectButton: {
    borderColor: theme.error,
  },
  rejectButtonText: {
    color: theme.error,
    fontWeight: 'bold',
  },
  acceptButton: {
    // backgroundColor handled in component
  },
  acceptButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  processingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  processingText: {
    color: theme.textSecondary,
  },
});

export default GlobalBookingModal;