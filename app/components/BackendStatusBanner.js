import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Banner } from 'react-native-paper';
import { checkApiHealth } from '../utils/apiHealthCheck';

const BackendStatusBanner = () => {
  const [isBackendDown, setIsBackendDown] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let checkInterval;

    const checkBackendStatus = async () => {
      try {
        const health = await checkApiHealth();
        const isDown = !health.isHealthy;
        
        if (isDown !== isBackendDown) {
          setIsBackendDown(isDown);
          setVisible(isDown);
        }
      } catch (error) {
        console.error('BackendStatus: Error checking backend:', error);
        setIsBackendDown(true);
        setVisible(true);
      }
    };

    // Check immediately
    checkBackendStatus();

    // Check every 30 seconds
    checkInterval = setInterval(checkBackendStatus, 30000);

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [isBackendDown]);

  if (!visible) {
    return null;
  }

  return (
    <Banner
      visible={visible}
      actions={[
        {
          label: 'Dismiss',
          onPress: () => setVisible(false),
        },
      ]}
      icon="alert"
      style={styles.banner}
    >
      <Text style={styles.bannerText}>
        Backend server is not responding. Some features may be limited.
        {'\n'}Please ensure the server is running on port 8000.
      </Text>
    </Banner>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FFF3CD',
    borderBottomWidth: 1,
    borderBottomColor: '#FFEAA7',
  },
  bannerText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
});

export default BackendStatusBanner;