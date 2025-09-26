import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import WalletScreen from '../screens/WalletScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import HomeScreen from '../screens/HomeScreen';
import AgentHomeScreen from '../screens/AgentHomeScreen';
import AgentListScreen from '../screens/AgentListScreen';
import AgentKYCUploadScreen from '../screens/AgentKYCUploadScreen';
import AgentProfileScreen from '../screens/AgentProfileScreen';
import AgentNotificationScreen from '../screens/AgentNotificationScreen';
import BookingScreen from '../screens/BookingScreen';
import BookingHistoryScreen from '../screens/BookingHistoryScreen';
import MyBookingsScreen from '../screens/MyBookingsScreen';
import AgentScheduleScreen from '../screens/AgentScheduleScreen';
import AgentPricingScreen from '../screens/AgentPricingScreen';
import AgentServiceCRUD from '../screens/AgentServiceCRUDSimple';
import SupportScreen from '../screens/SupportScreen';
import LocationScreen from '../screens/LocationScreen';
import AgentOnboardingScreen from '../screens/AgentOnboardingScreen';
import AgentDiscoveryScreen from '../screens/AgentDiscoveryScreen';
import AgentDetailScreen from '../screens/AgentDetailScreen';
import BookingEstimateScreen from '../screens/BookingEstimateScreen';
import BookingConfirmationScreen from '../screens/BookingConfirmationScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SplashScreen from '../components/SplashScreen';
import AgentSplashScreen from '../components/AgentSplashScreen';
import UserSplashScreen from '../components/UserSplashScreen';
import AgentProfilePage from '../screens/AgentProfilePage';
import CustomerProfilePage from '../screens/CustomerProfilePage';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();
const AuthStack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Home stack
const HomeStack = createStackNavigator();
function HomeStackScreen() {
  const { user } = useAuth();
  
  console.log('🏠 HomeStackScreen: User state', {
    isAgent: user?.isAgent,
    agentOnboardingCompleted: user?.agentOnboardingCompleted
  });
  
  // If user is in agent mode but hasn't completed onboarding, show onboarding
  const shouldShowOnboarding = user?.currentMode === 'agent' && !user?.agentOnboardingCompleted;
  const initialRoute = shouldShowOnboarding ? 'AgentOnboarding' : 'HomeMain';
  
  console.log('🏠 HomeStackScreen: Initial route:', initialRoute);
  console.log('🏠 HomeStackScreen: User mode:', user?.currentMode, 'Has agent profile:', user?.agentOnboardingCompleted);
  
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      <HomeStack.Screen 
        name="HomeMain" 
        component={user?.currentMode === 'agent' ? AgentHomeScreen : HomeScreen} 
      />
      <HomeStack.Screen name="AgentList" component={AgentListScreen} />
      <HomeStack.Screen name="AgentDiscovery" component={AgentDiscoveryScreen} />
      <HomeStack.Screen name="AgentProfile" component={AgentProfileScreen} />
      <HomeStack.Screen name="AgentDetail" component={AgentDetailScreen} />
      <HomeStack.Screen name="Booking" component={BookingScreen} />
      <HomeStack.Screen name="BookingEstimate" component={BookingEstimateScreen} />
      <HomeStack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
      <HomeStack.Screen name="BookingHistory" component={BookingHistoryScreen} />
      <HomeStack.Screen name="AgentOnboarding" component={AgentOnboardingScreen} />
      <HomeStack.Screen 
        name="AgentNotifications" 
        component={AgentNotificationScreen} 
        options={{ headerShown: true, title: 'Booking Notifications' }}
      />
    </HomeStack.Navigator>
  );
}

// Profile stack
const ProfileStack = createStackNavigator();
function ProfileStackScreen() {
  const { user } = useAuth();
  
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen 
        name="ProfileMain" 
        component={user?.currentMode === 'agent' ? AgentProfilePage : CustomerProfilePage} 
      />
      <ProfileStack.Screen name="AgentOnboarding" component={AgentOnboardingScreen} />
      <ProfileStack.Screen name="AgentPricing" component={AgentPricingScreen} />
      <ProfileStack.Screen name="AgentServiceCRUD" component={AgentServiceCRUD} />
      <ProfileStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <ProfileStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </ProfileStack.Navigator>
  );
}

// Support stack  
const SupportStack = createStackNavigator();
function SupportStackScreen() {
  return (
    <SupportStack.Navigator screenOptions={{ headerShown: false }}>
      <SupportStack.Screen name="SupportMain" component={SupportScreen} />
      <SupportStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <SupportStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </SupportStack.Navigator>
  );
}

// Main tab navigator
function MainTabNavigator() {
  const { user } = useAuth();
  const isAgent = user?.currentMode === 'agent';
  
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#2196f3',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeStackScreen}
        options={{
          tabBarLabel: isAgent ? 'Dashboard' : 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons 
              name={isAgent ? "view-dashboard" : "home"} 
              color={color} 
              size={size} 
            />
          ),
        }}
      />
      <Tab.Screen 
        name="Bookings" 
        component={isAgent ? BookingHistoryScreen : MyBookingsScreen}
        options={{
          tabBarLabel: isAgent ? 'History' : 'Bookings',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="history" color={color} size={size} />
          ),
        }}
      />
      {isAgent ? (
        <Tab.Screen 
          name="Schedule" 
          component={AgentScheduleScreen}
          options={{
            tabBarLabel: 'Schedule',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="calendar" color={color} size={size} />
            ),
          }}
        />
      ) : (
        <Tab.Screen 
          name="Location" 
          component={LocationScreen}
          options={{
            tabBarLabel: 'Location',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="map-marker" color={color} size={size} />
            ),
          }}
        />
      )}
      <Tab.Screen 
        name="Support" 
        component={SupportStackScreen}
        options={{
          tabBarLabel: 'Support',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="help-circle-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStackScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Auth navigator
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

// Loading screen component
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Loading ClickO...</Text>
    </View>
  );
}

// Main app navigator
export default function AppNavigator() {
  const { user, loading } = useAuth();
  const [showUserSplash, setShowUserSplash] = React.useState(false);
  const [showAgentSplash, setShowAgentSplash] = React.useState(false);
  const [hasShownSplash, setHasShownSplash] = React.useState(false);
  const [lastMode, setLastMode] = React.useState(null);

  console.log('DEBUG AppNavigator - Loading:', loading, 'User:', user ? 'Logged in' : 'Not logged in');

  // Show appropriate splash when user logs in for the first time or mode changes
  React.useEffect(() => {
    if (!loading && user) {
      const currentMode = user.currentMode || 'user'; // Use actual currentMode, not isAgent flag
      
      console.log('🧭 AppNavigator: Mode effect triggered', {
        currentMode,
        userCurrentMode: user.currentMode,
        lastMode,
        hasShownSplash,
        agentOnboardingCompleted: user.agentOnboardingCompleted,
        isAgent: user.isAgent
      });
      
      // Show splash on first load or mode change
      if (!hasShownSplash || (lastMode && lastMode !== currentMode)) {
        if (currentMode === 'agent' && user.agentOnboardingCompleted) {
          console.log('🎯 AppNavigator: Showing agent splash for agent mode');
          setShowAgentSplash(true);
        } else if (currentMode === 'user') {
          console.log('🎯 AppNavigator: Showing user splash for user mode');
          setShowUserSplash(true);
        } else if (currentMode === 'agent' && !user.agentOnboardingCompleted) {
          console.log('🎯 AppNavigator: Agent mode but onboarding not completed - will show onboarding');
          // No splash needed, user will be directed to onboarding
        }
        setHasShownSplash(true);
        setLastMode(currentMode);
      }
    }
  }, [loading, user, hasShownSplash, lastMode]);

  const handleUserSplashComplete = () => {
    setShowUserSplash(false);
  };

  const handleAgentSplashComplete = () => {
    setShowAgentSplash(false);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (showUserSplash) {
    return <UserSplashScreen user={user} onSplashEnd={handleUserSplashComplete} />;
  }

  if (showAgentSplash) {
    return <AgentSplashScreen onComplete={handleAgentSplashComplete} agentName={user?.name} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text,
  },
});
