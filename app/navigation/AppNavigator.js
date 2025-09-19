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
import AgentProfileScreen from '../screens/AgentProfileScreen';
import BookingScreen from '../screens/BookingScreen';
import BookingHistoryScreen from '../screens/BookingHistoryScreen';
import AgentOnboardingScreen from '../screens/AgentOnboardingScreen';
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
  const shouldShowOnboarding = user?.isAgent && !user?.agentOnboardingCompleted;
  const initialRoute = shouldShowOnboarding ? 'AgentOnboarding' : 'HomeMain';
  
  console.log('🏠 HomeStackScreen: Initial route:', initialRoute);
  
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      <HomeStack.Screen 
        name="HomeMain" 
        component={user?.isAgent ? AgentHomeScreen : HomeScreen} 
      />
      <HomeStack.Screen name="AgentList" component={AgentListScreen} />
      <HomeStack.Screen name="AgentProfile" component={AgentProfileScreen} />
      <HomeStack.Screen name="Booking" component={BookingScreen} />
      <HomeStack.Screen name="BookingHistory" component={BookingHistoryScreen} />
      <HomeStack.Screen name="AgentOnboarding" component={AgentOnboardingScreen} />
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
        component={user?.isAgent ? AgentProfilePage : CustomerProfilePage} 
      />
      <ProfileStack.Screen name="AgentOnboarding" component={AgentOnboardingScreen} />
    </ProfileStack.Navigator>
  );
}

// Main tab navigator
function MainTabNavigator() {
  const { user } = useAuth();
  
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
          tabBarLabel: user?.isAgent ? 'Dashboard' : 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons 
              name={user?.isAgent ? "view-dashboard" : "home"} 
              color={color} 
              size={size} 
            />
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
      const currentMode = user.isAgent ? 'agent' : 'user';
      
      console.log('🧭 AppNavigator: Mode effect triggered', {
        currentMode,
        lastMode,
        hasShownSplash,
        agentOnboardingCompleted: user.agentOnboardingCompleted,
        isAgent: user.isAgent
      });
      
      // Show splash on first load or mode change
      if (!hasShownSplash || (lastMode && lastMode !== currentMode)) {
        if (user.isAgent && user.agentOnboardingCompleted) {
          console.log('🎯 AppNavigator: Showing agent splash for completed agent');
          setShowAgentSplash(true);
        } else if (!user.isAgent) {
          console.log('🎯 AppNavigator: Showing user splash');
          setShowUserSplash(true);
        } else if (user.isAgent && !user.agentOnboardingCompleted) {
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
