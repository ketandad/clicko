import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import AppNavigator from './navigation/AppNavigator';
import { AuthProvider } from './contexts/AuthContext';
import { LocationProvider } from './contexts/LocationContext';
import { NotificationProvider } from './contexts/NotificationContext';
import BackendStatusBanner from './components/BackendStatusBanner';
import GlobalBookingModal from './components/GlobalBookingModal';
import { theme } from './theme';

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <SafeAreaProvider>
        <AuthProvider>
          <LocationProvider>
            <NotificationProvider>
              <NavigationContainer>
                <StatusBar style="auto" />
                <View style={{ flex: 1 }}>
                  <BackendStatusBanner />
                  <AppNavigator />
                  {/* Global booking modal that appears on any screen */}
                  <GlobalBookingModal />
                </View>
              </NavigationContainer>
            </NotificationProvider>
          </LocationProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </PaperProvider>
  );
}
