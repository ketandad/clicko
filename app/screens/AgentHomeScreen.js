import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Banner, Button } from 'react-native-paper';

export default function AgentHomeScreen() {
  // Dummy state for agent status and offline timer
  const [status, setStatus] = React.useState('offline');
  const [offlineUntil, setOfflineUntil] = React.useState(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
  const [showBanner, setShowBanner] = React.useState(true);

  // Countdown timer logic
  const [remaining, setRemaining] = React.useState(offlineUntil - Date.now());
  React.useEffect(() => {
    if (status === 'offline') {
      const interval = setInterval(() => {
        setRemaining(offlineUntil - Date.now());
        if (Date.now() >= offlineUntil) {
          setStatus('online');
          setShowBanner(false);
          clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, offlineUntil]);

  // Format timer
  const formatTime = (ms) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {showBanner && status === 'offline' && (
        <Banner
          visible={true}
          actions={[
            {
              label: 'Go Online',
              onPress: () => {
                setStatus('online');
                setShowBanner(false);
              },
            },
          ]}
          icon="alert"
          style={{ backgroundColor: '#ffebee', borderColor: 'red', borderWidth: 1 }}
        >
          <Text style={{ color: 'red', fontWeight: 'bold' }}>
            You are offline for 2 hours. Go Online?
          </Text>
          <Text style={{ color: 'red' }}>
            Time remaining: {formatTime(remaining)}
          </Text>
        </Banner>
      )}
      <View style={[styles.statusBar, { backgroundColor: status === 'online' ? '#e8f5e9' : '#ffebee' }] }>
        <Text style={{ color: status === 'online' ? 'green' : 'red', fontWeight: 'bold' }}>
          Status: {status === 'online' ? 'Online' : 'Offline'}
        </Text>
      </View>
      <Text variant="headlineMedium">Agent Home</Text>
      {status === 'offline' && (
        <Button mode="outlined" onPress={() => { setStatus('online'); setShowBanner(false); }} style={{ marginTop: 16 }}>
          Go Online
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  statusBar: {
    width: '100%',
    padding: 8,
    marginBottom: 16,
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
});
