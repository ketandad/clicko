import * as React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, Button } from 'react-native-paper';
import MapView, { Marker, Polyline } from 'react-native-maps';

const agentInitialLocation = { latitude: 28.6139, longitude: 77.2090 };
const userLocation = { latitude: 28.7041, longitude: 77.1025 };

export default function TrackAgentScreen() {
  const [agentLocation, setAgentLocation] = React.useState(agentInitialLocation);

  // Simulate agent moving every 5 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      setAgentLocation(loc => ({
        latitude: loc.latitude + 0.0005,
        longitude: loc.longitude + 0.0005,
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={{ marginBottom: 8 }}>Track Agent</Text>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: agentLocation.latitude,
          longitude: agentLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <Marker coordinate={userLocation} title="You" pinColor="blue" />
        <Marker coordinate={agentLocation} title="Agent" pinColor="red" />
        <Polyline
          coordinates={[userLocation, agentLocation]}
          strokeColor="#000"
          strokeWidth={2}
        />
      </MapView>
      <Button mode="outlined" style={{ marginTop: 16 }} onPress={() => setAgentLocation(agentInitialLocation)}>
        Refresh Location
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
    backgroundColor: '#fff',
  },
  map: {
    width: Dimensions.get('window').width - 16,
    height: 400,
    borderRadius: 8,
  },
});
