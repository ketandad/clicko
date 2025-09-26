import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Switch,
  Surface,
  Avatar,
  FAB,
  Chip,
  ProgressBar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import { updateAgentStatus, getAgentStats, updateAgentLocation } from '../services/agentService';
import { notificationService } from '../services/notificationService';
import { notificationTestService } from '../services/notificationTestService';

const { width } = Dimensions.get('window');

// Enhanced professional theme colors - no green
const darkTheme = {
  background: '#0A0A0A',
  surface: '#1A1A1A',
  surfaceVariant: '#252525', 
  primary: '#2563EB', // Blue
  primaryLight: '#3B82F6',
  secondary: '#7C3AED', // Purple
  secondaryLight: '#8B5CF6',
  accent: '#DC2626', // Red
  accentLight: '#EF4444',
  text: '#FFFFFF',
  textSecondary: '#E0E0E0',
  textTertiary: '#BDBDBD',
  border: '#333333',
  borderLight: '#424242',
  success: '#059669', // Teal instead of green
  warning: '#F59E0B',
  error: '#EF4444',
  gradient: ['#1A1A1A', '#2D2D2D', '#1A1A1A'],
  headerGradient: ['#1E3A8A', '#3B82F6', '#6366F1'], // Blue gradient
  cardGradient: ['#1A1A1A', '#252525'],
  earning: '#059669', // Teal for earnings
  gold: '#F59E0B', // Amber instead of gold
};

export default function AgentHomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState(null);
  const [currentArea, setCurrentArea] = useState('Loading location...');
  const [fadeAnim] = useState(new Animated.Value(0));
  
  // Agent data - using real user data, default to 0/null for dummy values
  const [agentData, setAgentData] = useState({
    name: user?.name || 'Agent',
    rating: 0, // Will be updated from API
    totalEarnings: 0, // Will be updated from API
    todayEarnings: 0, // Will be updated from API
    pendingBookings: 0,
    completedBookings: 0, // Will be updated from API
    categories: [], // Will be updated from API
    isVerified: user?.agentOnboardingCompleted || true,
    profileImage: null,
    walletBalance: user?.walletBalance || 0,
    serviceArea: 'Service Area', // Default service area, will be updated
  });

  const [todayStats, setTodayStats] = useState({
    bookings: 0, // Will be updated from API
    earnings: 0, // Will be updated from API
    distance: 0, // Will be updated from API
    rating: 0, // Will be updated from API
  });

  // Remove dummy pending requests - will be replaced with real data
  const [pendingRequests, setPendingRequests] = useState([]);
  
  // WebSocket connection for real-time notifications
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = React.useRef(null);

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    loadAgentData();
    
    // Connect to notifications if agent is online
    if (isOnline && user?.id) {
      connectToNotifications();
    }
    
    // Update agent data with real user info
    if (user) {
      setAgentData(prev => ({
        ...prev,
        name: user.name || 'Agent',
        isVerified: user.agentOnboardingCompleted || true,
        walletBalance: user.walletBalance || 0,
      }));
    }
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [user]);

  const loadAgentData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading agent data and stats...');
      
      // Fetch real stats from backend
      const stats = await getAgentStats();
      
      // Update todayStats with real data
      setTodayStats({
        bookings: stats.today_bookings,
        earnings: stats.today_earnings,
        distance: stats.today_distance,
        rating: stats.avg_rating,
      });
      
      // Update agent data with total stats
      setAgentData(prev => ({
        ...prev,
        totalEarnings: stats.total_earnings,
        completedBookings: stats.total_bookings,
        rating: stats.avg_rating,
      }));
      
      console.log('✅ Agent data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading agent data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      console.log('📍 Getting current location...');
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ Location permission not granted');
        setCurrentArea('Location access denied');
        return;
      }

      let locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const coords = locationResult.coords;
      setLocation(coords);
      console.log('📍 Location coordinates:', coords);

      // Reverse geocoding to get area name
      try {
        let geocodeResult = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });

        if (geocodeResult && geocodeResult.length > 0) {
          const address = geocodeResult[0];
          // Prioritize area/sublocality over city
          const area = address.sublocality || address.district || address.city || 'Unknown Area';
          const region = address.region || address.city || '';
          const displayArea = region ? `${area}, ${region}` : area;
          
          setCurrentArea(displayArea);
          console.log('🏘️ Current area:', displayArea);
          
          // Send location update to backend only if user is an agent
          if (user?.isAgent || user?.agentOnboardingCompleted) {
            console.log('📍 AgentHome: User is an agent, updating location');
            updateAgentLocation(coords.latitude, coords.longitude, displayArea);
          } else {
            console.log('👤 AgentHome: User is not an agent, skipping location update');
          }
        } else {
          setCurrentArea('Area unavailable');
        }
      } catch (geocodeError) {
        console.error('❌ Geocoding error:', geocodeError);
        setCurrentArea('Area lookup failed');
      }

    } catch (error) {
      console.error('❌ Error getting location:', error);
      setCurrentArea('Location unavailable');
    }
  };

  // Setup automatic location updates every 5 minutes
  useEffect(() => {
    getCurrentLocation(); // Initial location fetch
    
    const locationInterval = setInterval(() => {
      console.log('🔄 Auto-updating location...');
      getCurrentLocation();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds

    // Cleanup interval on component unmount
    return () => {
      clearInterval(locationInterval);
      disconnectFromNotifications();
      console.log('🛑 Location auto-update stopped');
    };
  }, []);

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;
      console.log('🔄 Updating agent status to:', newStatus ? 'online' : 'offline');
      
      // Call the API to update status in database
      await updateAgentStatus(newStatus);
      
      // Update local state only after successful API call
      setIsOnline(newStatus);
      
      // Connect/disconnect WebSocket based on status
      if (newStatus && user?.id) {
        connectToNotifications();
      } else {
        disconnectFromNotifications();
      }
      
      console.log('✅ Agent status updated successfully:', newStatus ? 'Online' : 'Offline');
    } catch (error) {
      console.error('❌ Error updating agent status:', error);
      // Show error message to user
      Alert.alert(
        'Status Update Failed',
        'Could not update your online status. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const connectToNotifications = () => {
    if (!user?.id) return;

    // Add listener for notification events
    const removeListener = notificationService.addListener((event, data) => {
      switch (event) {
        case 'connected':
          setWsConnected(true);
          notificationService.startHeartbeat();
          break;
          
        case 'disconnected':
          setWsConnected(false);
          notificationService.stopHeartbeat();
          break;
          
        case 'booking_request':
          console.log('🔔 New booking request received');
          
          // Update pending bookings count
          setAgentData(prev => ({
            ...prev,
            pendingBookings: prev.pendingBookings + 1
          }));
          
          // Navigate to notification screen immediately for bell notification
          navigation.navigate('AgentNotifications', { 
            agentId: user?.id, 
            authToken: user?.token 
          });
          break;
          
        case 'response_confirmed':
          console.log('✅ Response confirmed');
          loadAgentData(); // Refresh data
          break;
          
        case 'status_update':
          console.log('📢 Booking status update');
          loadAgentData(); // Refresh data
          break;
          
        case 'system_message':
          Alert.alert('System Message', data.message);
          break;
          
        case 'error':
          console.error('🚨 Notification error:', data);
          break;
          
        default:
          console.log('Unknown notification event:', event);
      }
    });

    // Store listener cleanup function
    wsRef.current = removeListener;
    
    // Connect to notification service
    notificationService.connect(user.id, user.token);
  };

  const disconnectFromNotifications = () => {
    // Remove listener
    if (wsRef.current) {
      wsRef.current(); // Call cleanup function
      wsRef.current = null;
    }
    
    // Disconnect from notification service
    notificationService.disconnect();
    setWsConnected(false);
  };

  const testNotification = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User ID not available for testing');
      return;
    }

    try {
      console.log('🧪 Testing notification system...');
      
      // Check if backend is available
      const backendAvailable = await notificationTestService.checkBackendConnection();
      
      if (!backendAvailable) {
        Alert.alert(
          'Backend Not Available',
          'The backend server is not running. Please start the backend to test notifications.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Send test notification
      await notificationTestService.simulateBookingNotification(user.id);
      
      Alert.alert(
        'Test Notification Sent',
        'A test booking notification has been sent! If you\'re connected to WebSocket, you should receive it shortly.',
        [
          {
            text: 'View Notifications',
            onPress: () => navigation.navigate('AgentNotifications', { 
              agentId: user?.id, 
              authToken: user?.token 
            })
          },
          { text: 'OK' }
        ]
      );
      
    } catch (error) {
      Alert.alert(
        'Test Failed',
        `Failed to send test notification: ${error.message}`,
        [{ text: 'OK' }]
      );
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAgentData();
    setRefreshing(false);
  };

  const acceptBooking = (bookingId) => {
    console.log('Accepting booking:', bookingId);
    // TODO: Accept booking API call
    navigation.navigate('BookingDetails', { bookingId });
  };

  const rejectBooking = (bookingId) => {
    console.log('Rejecting booking:', bookingId);
    setPendingRequests(prev => prev.filter(req => req.id !== bookingId));
  };

  const renderHeader = () => (
    <LinearGradient colors={darkTheme.headerGradient} style={styles.header}>
      <SafeAreaView>
        <View style={styles.headerContent}>
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <Avatar.Text 
                size={40} 
                label={agentData.name.charAt(0).toUpperCase()} 
                style={styles.avatar}
                labelStyle={styles.avatarLabel}
              />
              {agentData.isVerified && (
                <View style={styles.verifiedBadge}>
                  <MaterialCommunityIcons name="check-decagram" size={12} color={darkTheme.gold} />
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.agentName}>{agentData.name}</Text>
              <View style={styles.ratingContainer}>
                <MaterialCommunityIcons name="star" size={14} color={darkTheme.gold} />
                <Text style={styles.rating}>{agentData.rating}</Text>
              </View>
            </View>
          </View>

          <View style={styles.headerActions}>
            {/* Notification Bell */}
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => navigation.navigate('AgentNotifications', { 
                agentId: user?.id, 
                authToken: user?.token 
              })}
            >
              <MaterialCommunityIcons 
                name={agentData.pendingBookings > 0 ? "bell-ring" : "bell"} 
                size={24} 
                color={agentData.pendingBookings > 0 ? darkTheme.warning : darkTheme.text} 
              />
              {/* Connection indicator dot */}
              <View style={[
                styles.connectionDot, 
                { backgroundColor: wsConnected ? darkTheme.success : darkTheme.error }
              ]} />
              {agentData.pendingBookings > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {agentData.pendingBookings > 9 ? '9+' : agentData.pendingBookings}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* Online/Offline Toggle */}
            <View style={styles.onlineToggle}>
              <View style={[styles.statusIndicator, { backgroundColor: isOnline ? darkTheme.success : darkTheme.error }]} />
              <Text style={styles.statusText}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
              <Switch
                value={isOnline}
                onValueChange={toggleOnlineStatus}
                trackColor={{ false: '#424242', true: darkTheme.success }}
                thumbColor={isOnline ? '#FFFFFF' : '#BDBDBD'}
                style={styles.switch}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  const renderStatsCards = () => (
    <View style={styles.statsContainer}>
      <Card style={[styles.statCard, { backgroundColor: darkTheme.surface }]}>
        <Card.Content style={styles.statContent}>
          <MaterialCommunityIcons name="currency-inr" size={24} color={darkTheme.success} />
          <Text style={[styles.statValue, { color: darkTheme.text }]}>₹{todayStats.earnings}</Text>
          <Text style={[styles.statLabel, { color: darkTheme.textSecondary }]}>Today's Earnings</Text>
        </Card.Content>
      </Card>
      
      <Card style={[styles.statCard, { backgroundColor: darkTheme.surface }]}>
        <Card.Content style={styles.statContent}>
          <MaterialCommunityIcons name="clipboard-list" size={24} color={darkTheme.secondary} />
          <Text style={[styles.statValue, { color: darkTheme.text }]}>{todayStats.bookings}</Text>
          <Text style={[styles.statLabel, { color: darkTheme.textSecondary }]}>Bookings</Text>
        </Card.Content>
      </Card>
      
      <Card style={[styles.statCard, { backgroundColor: darkTheme.surface }]}>
        <Card.Content style={styles.statContent}>
          <MaterialCommunityIcons name="map-marker-distance" size={24} color={darkTheme.accent} />
          <Text style={[styles.statValue, { color: darkTheme.text }]}>{todayStats.distance}km</Text>
          <Text style={[styles.statLabel, { color: darkTheme.textSecondary }]}>Distance</Text>
        </Card.Content>
      </Card>
    </View>
  );

  const renderEarningsOverview = () => (
    <Card style={[styles.earningsCard, { backgroundColor: darkTheme.surface }]}>
      <Card.Content>
        <View style={styles.earningsHeader}>
          <Text style={[styles.sectionTitle, { color: darkTheme.text }]}>Earnings Overview</Text>
          <TouchableOpacity>
            <Text style={{ color: darkTheme.primary }}>View All</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.earningsRow}>
          <View style={styles.earningsItem}>
            <Text style={[styles.earningsLabel, { color: darkTheme.textSecondary }]}>This Week</Text>
            <Text style={[styles.earningsValue, { color: darkTheme.text }]}>₹{agentData.weeklyEarnings || 0}</Text>
          </View>
          <View style={styles.earningsItem}>
            <Text style={[styles.earningsLabel, { color: darkTheme.textSecondary }]}>This Month</Text>
            <Text style={[styles.earningsValue, { color: darkTheme.text }]}>₹{agentData.totalEarnings}</Text>
          </View>
        </View>
        
        <ProgressBar 
          progress={agentData.monthlyProgress || 0} 
          color={darkTheme.success} 
          style={styles.progressBar} 
        />
        <Text style={[styles.progressText, { color: darkTheme.textSecondary }]}>
          {Math.round((agentData.monthlyProgress || 0) * 100)}% of monthly goal (₹{agentData.monthlyGoal || 0})
        </Text>
      </Card.Content>
    </Card>
  );

  const renderPendingRequests = () => (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: darkTheme.text }]}>Pending Requests</Text>
        <Chip 
          textStyle={{ color: darkTheme.text }}
          style={{ backgroundColor: darkTheme.accent }}
        >
          {pendingRequests.length} new
        </Chip>
      </View>
      
      {pendingRequests.map((request) => (
        <Card key={request.id} style={[styles.requestCard, { backgroundColor: darkTheme.surface }]}>
          <Card.Content>
            <View style={styles.requestHeader}>
              <View style={styles.requestInfo}>
                <Text style={[styles.serviceName, { color: darkTheme.text }]}>{request.service}</Text>
                {request.urgent && (
                  <Chip 
                    textStyle={{ color: 'white', fontSize: 10 }}
                    style={{ backgroundColor: darkTheme.error, height: 20 }}
                  >
                    URGENT
                  </Chip>
                )}
              </View>
              <Text style={[styles.requestAmount, { color: darkTheme.success }]}>₹{request.amount}</Text>
            </View>
            
            <Text style={[styles.customerName, { color: darkTheme.textSecondary }]}>{request.customer}</Text>
            
            <View style={styles.requestDetails}>
              <View style={styles.requestDetailItem}>
                <MaterialCommunityIcons name="map-marker" size={16} color={darkTheme.textSecondary} />
                <Text style={[styles.requestDetailText, { color: darkTheme.textSecondary }]}>{request.distance}</Text>
              </View>
              <View style={styles.requestDetailItem}>
                <MaterialCommunityIcons name="clock" size={16} color={darkTheme.textSecondary} />
                <Text style={[styles.requestDetailText, { color: darkTheme.textSecondary }]}>{request.time}</Text>
              </View>
            </View>
            
            <View style={styles.requestActions}>
              <Button 
                mode="outlined" 
                onPress={() => rejectBooking(request.id)}
                style={styles.rejectButton}
                textColor={darkTheme.error}
              >
                Decline
              </Button>
              <Button 
                mode="contained" 
                onPress={() => acceptBooking(request.id)}
                style={[styles.acceptButton, { backgroundColor: darkTheme.success }]}
              >
                Accept
              </Button>
            </View>
          </Card.Content>
        </Card>
      ))}
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={[styles.sectionTitle, { color: darkTheme.text }]}>Quick Actions</Text>
      
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity style={[styles.quickAction, { backgroundColor: darkTheme.surface }]}>
          <MaterialCommunityIcons name="history" size={24} color={darkTheme.primary} />
          <Text style={[styles.quickActionText, { color: darkTheme.text }]}>Booking History</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.quickAction, { backgroundColor: darkTheme.surface }]}>
          <MaterialCommunityIcons name="account-edit" size={24} color={darkTheme.secondary} />
          <Text style={[styles.quickActionText, { color: darkTheme.text }]}>Edit Profile</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.quickAction, { backgroundColor: darkTheme.surface }]}>
          <MaterialCommunityIcons name="chart-line" size={24} color={darkTheme.accent} />
          <Text style={[styles.quickActionText, { color: darkTheme.text }]}>Analytics</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.quickAction, { backgroundColor: darkTheme.surface }]}>
          <MaterialCommunityIcons name="help-circle" size={24} color={darkTheme.warning} />
          <Text style={[styles.quickActionText, { color: darkTheme.text }]}>Support</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickAction, { backgroundColor: darkTheme.surface }]}
          onPress={() => navigation.navigate('AgentNotifications', { 
            agentId: user?.id, 
            authToken: user?.token 
          })}
        >
          <MaterialCommunityIcons 
            name="bell-ring" 
            size={24} 
            color={wsConnected ? darkTheme.success : darkTheme.error} 
          />
          <Text style={[styles.quickActionText, { color: darkTheme.text }]}>
            Notifications {agentData.pendingBookings > 0 ? `(${agentData.pendingBookings})` : ''}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickAction, { backgroundColor: darkTheme.accent, opacity: 0.8 }]}
          onPress={testNotification}
        >
          <MaterialCommunityIcons 
            name="bell-ring-outline" 
            size={24} 
            color="white" 
          />
          <Text style={[styles.quickActionText, { color: 'white', fontSize: 12 }]}>
            Test Notification
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLocationArea = () => (
    <View style={styles.locationContainer}>
      <View style={styles.locationContent}>
        <MaterialCommunityIcons 
          name="map-marker" 
          size={16} 
          color={darkTheme.primary} 
          style={styles.locationIcon}
        />
        <View style={styles.locationInfo}>
          <Text style={styles.locationTitle}>Current Location</Text>
          <Text style={styles.locationText}>
            {currentArea}
          </Text>
        </View>
        <MaterialCommunityIcons 
          name="refresh" 
          size={14} 
          color={darkTheme.textSecondary}
        />
      </View>
      
      {/* Notification Status Indicator */}
      <View style={styles.notificationStatus}>
        <View style={[
          styles.notificationStatusDot, 
          { backgroundColor: wsConnected ? darkTheme.success : darkTheme.error }
        ]} />
        <Text style={styles.notificationStatusText}>
          {wsConnected ? 'Notifications Active' : 'Notifications Offline'}
        </Text>
        {agentData.pendingBookings > 0 && (
          <Text style={[styles.notificationStatusText, { color: darkTheme.warning }]}>
            • {agentData.pendingBookings} pending
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: darkTheme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={darkTheme.gradient[0]} />
      
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        {renderHeader()}
        {renderLocationArea()}
        
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {renderStatsCards()}
          {renderEarningsOverview()}
          {renderPendingRequests()}
          {renderQuickActions()}
        </ScrollView>
      </Animated.View>
      
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: darkTheme.primary }]}
        onPress={() => navigation.navigate('CreateService')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkTheme.background,
  },
  header: {
    paddingBottom: 2,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 8,
  },
  avatar: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  avatarLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    borderRadius: 8,
    padding: 1,
  },
  profileInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 12,
    color: 'white',
    marginLeft: 3,
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletBalance: {
    fontSize: 14,
    color: darkTheme.earning,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
    marginRight: 16,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: darkTheme.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  connectionDot: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'white',
  },
  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: 'white',
    fontWeight: '600',
    marginRight: 8,
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  locationContainer: {
    backgroundColor: darkTheme.surface,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: darkTheme.borderLight,
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: darkTheme.border,
  },
  notificationStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  notificationStatusText: {
    fontSize: 12,
    color: darkTheme.textTertiary,
    marginRight: 8,
  },
  locationIcon: {
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 12,
    color: darkTheme.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    color: darkTheme.text,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: darkTheme.background,
    paddingTop: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 0,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    elevation: 6,
    borderRadius: 16,
    backgroundColor: darkTheme.surface,
    borderWidth: 1,
    borderColor: darkTheme.borderLight,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 8,
    color: darkTheme.text,
  },
  statLabel: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    color: darkTheme.textSecondary,
    fontWeight: '500',
  },
  earningsCard: {
    marginBottom: 20,
    elevation: 6,
    borderRadius: 16,
    backgroundColor: darkTheme.surface,
    borderWidth: 1,
    borderColor: darkTheme.borderLight,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: darkTheme.text,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  earningsItem: {
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  requestCard: {
    marginBottom: 15,
    elevation: 4,
    borderRadius: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  requestAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  customerName: {
    fontSize: 14,
    marginBottom: 12,
  },
  requestDetails: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  requestDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  requestDetailText: {
    fontSize: 12,
    marginLeft: 4,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rejectButton: {
    flex: 0.45,
    borderColor: darkTheme.error,
  },
  acceptButton: {
    flex: 0.45,
  },
  quickActionsContainer: {
    marginTop: 20,
    marginBottom: 100,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  quickAction: {
    width: '48%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 4,
  },
  quickActionText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    elevation: 8,
  },
});
