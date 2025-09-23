import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Snackbar, Button } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { validateStoredToken } from '../utils/tokenValidation';

const SessionExpiredNotification = () => {
  const [visible, setVisible] = useState(false);
  const [hasShownExpiration, setHasShownExpiration] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    let checkInterval;

    const checkTokenExpiration = async () => {
      if (!user) return;

      try {
        const tokenValidation = await validateStoredToken();
        if (!tokenValidation.isValid && tokenValidation.reason === 'expired' && !hasShownExpiration) {
          console.log('🚨 SessionExpiredNotification: Token expired, showing notification');
          setVisible(true);
          setHasShownExpiration(true);
        }
      } catch (error) {
        console.error('SessionExpiredNotification: Error checking token:', error);
      }
    };

    if (user) {
      // Check immediately
      checkTokenExpiration();
      
      // Check every 60 seconds
      checkInterval = setInterval(checkTokenExpiration, 60000);
    }

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [user, hasShownExpiration]);

  const handleLoginAgain = async () => {
    setVisible(false);
    setHasShownExpiration(false);
    await logout();
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  return (
    <Snackbar
      visible={visible}
      onDismiss={handleDismiss}
      duration={Snackbar.DURATION_INDEFINITE}
      style={styles.snackbar}
      action={{
        label: 'Login Again',
        onPress: handleLoginAgain,
      }}
    >
      <Text style={styles.text}>
        Your session has expired. Please log in again to continue.
      </Text>
    </Snackbar>
  );
};

const styles = StyleSheet.create({
  snackbar: {
    backgroundColor: '#FF6B6B',
    marginBottom: 80,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default SessionExpiredNotification;