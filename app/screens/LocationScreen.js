import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, List, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocation } from '../contexts/LocationContext';
import LocationPickerModal from '../components/LocationPickerModal';
import { colors } from '../theme';

export default function LocationScreen() {
  const { 
    selectedLocation, 
    currentLocation, 
    loading, 
    error, 
    locationPermission,
    refreshLocation, 
    requestLocationPermission,
  } = useLocation();
  
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  const handleRefreshLocation = async () => {
    try {
      await refreshLocation();
    } catch (error) {
      console.error('Failed to refresh location:', error);
    }
  };

  const handleRequestPermission = async () => {
    try {
      await requestLocationPermission();
    } catch (error) {
      console.error('Failed to request permission:', error);
    }
  };

  const formatLocationText = (location) => {
    if (!location) return 'No location selected';
    
    if (location.area && location.city) {
      return `${location.area}, ${location.city}`;
    }
    
    return location.address || 'Unknown location';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Location Settings</Text>
        <Text style={styles.subtitle}>Manage your location preferences</Text>

        {/* Current Location */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Current Location</Text>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Getting location...</Text>
              </View>
            ) : (
              <>
                <List.Item
                  title="Selected Location"
                  description={formatLocationText(selectedLocation)}
                  left={(props) => <List.Icon {...props} icon="map-marker" color={colors.primary} />}
                  right={(props) => <List.Icon {...props} icon="pencil" color={colors.primary} />}
                  onPress={() => setLocationPickerVisible(true)}
                  style={styles.listItem}
                />
                
                {currentLocation && (
                  <List.Item
                    title="Detected Location"
                    description={formatLocationText(currentLocation)}
                    left={(props) => <List.Icon {...props} icon="crosshairs-gps" color={colors.textSecondary} />}
                    style={styles.listItem}
                  />
                )}
              </>
            )}
          </Card.Content>
        </Card>

        {/* Location Actions */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Location Actions</Text>
            
            <Button
              mode="outlined"
              onPress={() => setLocationPickerVisible(true)}
              style={styles.actionButton}
              icon="map-search"
            >
              Change Location
            </Button>
            
            <Button
              mode="outlined"
              onPress={handleRefreshLocation}
              style={styles.actionButton}
              icon="refresh"
              loading={loading}
              disabled={loading}
            >
              Refresh Current Location
            </Button>
            
            {locationPermission !== 'granted' && (
              <Button
                mode="contained"
                onPress={handleRequestPermission}
                style={styles.actionButton}
                icon="map-marker-check"
              >
                Enable Location Access
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* Location Info */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Location Information</Text>
            
            <List.Item
              title="Permission Status"
              description={locationPermission || 'Not requested'}
              left={(props) => <List.Icon {...props} icon="shield-check" color={colors.textSecondary} />}
              style={styles.listItem}
            />
            
            {selectedLocation?.coordinates && (
              <>
                <List.Item
                  title="Latitude"
                  description={selectedLocation.coordinates.latitude.toFixed(6)}
                  left={(props) => <List.Icon {...props} icon="latitude" color={colors.textSecondary} />}
                  style={styles.listItem}
                />
                
                <List.Item
                  title="Longitude"
                  description={selectedLocation.coordinates.longitude.toFixed(6)}
                  left={(props) => <List.Icon {...props} icon="longitude" color={colors.textSecondary} />}
                  style={styles.listItem}
                />
              </>
            )}
            
            {selectedLocation?.timestamp && (
              <List.Item
                title="Last Updated"
                description={new Date(selectedLocation.timestamp).toLocaleString()}
                left={(props) => <List.Icon {...props} icon="clock" color={colors.textSecondary} />}
                style={styles.listItem}
              />
            )}
          </Card.Content>
        </Card>

        {/* Location Tips */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Location Tips</Text>
            
            <View style={styles.tipItem}>
              <MaterialCommunityIcons name="lightbulb-outline" size={20} color={colors.primary} />
              <Text style={styles.tipText}>
                Accurate location helps us show nearby service providers
              </Text>
            </View>
            
            <View style={styles.tipItem}>
              <MaterialCommunityIcons name="shield-check" size={20} color={colors.primary} />
              <Text style={styles.tipText}>
                Your location data is stored securely and never shared without permission
              </Text>
            </View>
            
            <View style={styles.tipItem}>
              <MaterialCommunityIcons name="map-search" size={20} color={colors.primary} />
              <Text style={styles.tipText}>
                You can manually select a different location if needed
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
      
      <LocationPickerModal
        visible={locationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginVertical: 20,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  listItem: {
    paddingVertical: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 12,
    color: colors.textSecondary,
  },
  actionButton: {
    marginVertical: 4,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  tipText: {
    flex: 1,
    marginLeft: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
});